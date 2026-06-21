import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/db/prisma.service';
import { RankService } from '../gameplay/rank.service';
import { XpService } from '../gameplay/xp.service';
import { normalizeSpecialtyDisplayName } from '../diagnosis-registry/diagnosis-registry-specialty';
import type {
  StatsDimensionSummary,
  StatsDimensionType,
  UserStatsReport,
  UserWeakAreaSummary,
} from './stats-engine.types';

type CompletedSession = {
  startedAt: Date;
  completedAt: Date | null;
  case: {
    difficulty: string;
    diagnosisRegistry: {
      specialty: string | null;
      category: string | null;
      bodySystem: string | null;
    } | null;
  };
  attempts: Array<{
    result: string;
    clueIndexAtAttempt: number | null;
    createdAt: Date;
  }>;
};

type SessionMetric = {
  solved: boolean;
  attemptsUsed: number;
  cluesUsed: number;
  timeSecs: number | null;
  completedAt: Date;
  specialtyLabel: string;
  bodySystemLabel: string;
  difficultyLabel: string;
};

type DimensionAccumulator = {
  label: string;
  casesCompleted: number;
  solved: number;
  totalAttempts: number;
  totalTimeSecs: number;
  timedCaseCount: number;
};

const RECENT_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const WEAK_AREA_MIN_CASES = 3;
const WEAK_AREA_THRESHOLD = 60;
const LOW_PRIORITY_GAP = 15;

@Injectable()
export class StatsEngineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rankService: RankService,
    private readonly xpService: XpService,
  ) {}

  async getUserStats(userId: string): Promise<UserStatsReport> {
    const [sessions, progress, streak] = await Promise.all([
      this.getCompletedSessions(userId),
      this.prisma.userProgress.findUnique({
        where: { userId },
      }),
      this.prisma.userStats.findUnique({
        where: { userId },
      }),
    ]);
    const metrics = sessions.map((session) => this.toSessionMetric(session));
    const totals = this.summarizeTotals(metrics);
    const bySpecialty = this.summarizeDimension(
      metrics,
      (metric) => metric.specialtyLabel,
    );
    const byBodySystem = this.summarizeDimension(
      metrics,
      (metric) => metric.bodySystemLabel,
    );
    const byDifficulty = this.summarizeDimension(
      metrics,
      (metric) => metric.difficultyLabel,
    );

    return {
      totals,
      progress: {
        ...this.buildProgress(progress, streak),
      },
      bySpecialty,
      byBodySystem,
      byDifficulty,
      weakAreas: this.buildWeakAreas({
        overallAccuracyPct: totals.accuracyPct,
        bySpecialty,
        byBodySystem,
        byDifficulty,
      }),
      recent: this.summarizeRecent(metrics),
    };
  }

  private buildProgress(
    progress: { xpTotal: number } | null,
    streak: { currentStreak: number; bestStreak: number } | null,
  ): UserStatsReport['progress'] {
    const xpTotal = progress?.xpTotal ?? 0;
    const derived = this.xpService.deriveLevelFromXpTotal(xpTotal);

    return {
      xpTotal,
      level: derived.level,
      rank: this.rankService.getRank(derived.level),
      currentLevelXp: derived.xpCurrentLevel,
      currentStreak: streak?.currentStreak ?? 0,
      bestStreak: streak?.bestStreak ?? 0,
    };
  }

  private async getCompletedSessions(userId: string): Promise<CompletedSession[]> {
    return this.prisma.gameSession.findMany({
      where: {
        userId,
        status: 'completed',
        completedAt: {
          not: null,
        },
      },
      orderBy: [{ completedAt: 'desc' }, { startedAt: 'desc' }],
      select: {
        startedAt: true,
        completedAt: true,
        case: {
          select: {
            difficulty: true,
            diagnosisRegistry: {
              select: {
                specialty: true,
                category: true,
                bodySystem: true,
              },
            },
          },
        },
        attempts: {
          select: {
            result: true,
            clueIndexAtAttempt: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });
  }

  private toSessionMetric(session: CompletedSession): SessionMetric {
    const latestAttempt = session.attempts.at(-1);
    const attemptsUsed = session.attempts.length;
    const timeSecs =
      session.completedAt && session.startedAt
        ? Math.max(
            0,
            Math.round(
              (session.completedAt.getTime() - session.startedAt.getTime()) /
                1000,
            ),
          )
        : null;

    return {
      solved: latestAttempt?.result === 'correct',
      attemptsUsed,
      // Current gameplay reveals one clue per submitted attempt in the learn
      // archive, so attempts are the stable v1 clue count across old sessions.
      cluesUsed: attemptsUsed,
      timeSecs,
      completedAt: session.completedAt ?? new Date(0),
      specialtyLabel: this.resolveSpecialtyLabel(session),
      bodySystemLabel: this.resolveBodySystemLabel(session),
      difficultyLabel: this.normalizeLabel(session.case.difficulty, 'unknown'),
    };
  }

  private summarizeTotals(metrics: SessionMetric[]): UserStatsReport['totals'] {
    const casesCompleted = metrics.length;
    const solved = metrics.filter((metric) => metric.solved).length;
    const totalAttempts = metrics.reduce(
      (sum, metric) => sum + metric.attemptsUsed,
      0,
    );
    const totalClues = metrics.reduce(
      (sum, metric) => sum + metric.cluesUsed,
      0,
    );
    const timedMetrics = metrics.filter(
      (metric) => typeof metric.timeSecs === 'number',
    );
    const totalTimeSecs = timedMetrics.reduce(
      (sum, metric) => sum + (metric.timeSecs ?? 0),
      0,
    );

    return {
      casesCompleted,
      solved,
      missed: casesCompleted - solved,
      accuracyPct: this.percent(solved, casesCompleted),
      averageAttempts: this.average(totalAttempts, casesCompleted),
      averageCluesUsed: this.average(totalClues, casesCompleted),
      averageTimeSecs: this.average(totalTimeSecs, timedMetrics.length),
    };
  }

  private summarizeDimension(
    metrics: SessionMetric[],
    labelForMetric: (metric: SessionMetric) => string,
  ): StatsDimensionSummary[] {
    const groups = new Map<string, DimensionAccumulator>();

    for (const metric of metrics) {
      const label = labelForMetric(metric);
      const key = this.toKey(label);
      const group =
        groups.get(key) ??
        ({
          label,
          casesCompleted: 0,
          solved: 0,
          totalAttempts: 0,
          totalTimeSecs: 0,
          timedCaseCount: 0,
        } satisfies DimensionAccumulator);

      group.casesCompleted += 1;
      group.solved += metric.solved ? 1 : 0;
      group.totalAttempts += metric.attemptsUsed;
      if (typeof metric.timeSecs === 'number') {
        group.totalTimeSecs += metric.timeSecs;
        group.timedCaseCount += 1;
      }
      groups.set(key, group);
    }

    return [...groups.entries()]
      .map(([key, group]) => ({
        key,
        label: group.label,
        casesCompleted: group.casesCompleted,
        solved: group.solved,
        missed: group.casesCompleted - group.solved,
        accuracyPct: this.percent(group.solved, group.casesCompleted),
        averageAttempts: this.average(
          group.totalAttempts,
          group.casesCompleted,
        ),
        averageTimeSecs: this.average(
          group.totalTimeSecs,
          group.timedCaseCount,
        ),
      }))
      .sort((left, right) => {
        if (right.casesCompleted !== left.casesCompleted) {
          return right.casesCompleted - left.casesCompleted;
        }
        return left.label.localeCompare(right.label);
      });
  }

  private buildWeakAreas(input: {
    overallAccuracyPct: number | null;
    bySpecialty: StatsDimensionSummary[];
    byBodySystem: StatsDimensionSummary[];
    byDifficulty: StatsDimensionSummary[];
  }): UserWeakAreaSummary[] {
    const candidates: UserWeakAreaSummary[] = [
      ...this.weakAreasForDimension('specialty', input.bySpecialty, input.overallAccuracyPct),
      ...this.weakAreasForDimension('bodySystem', input.byBodySystem, input.overallAccuracyPct),
      ...this.weakAreasForDimension('difficulty', input.byDifficulty, input.overallAccuracyPct),
    ];
    const priorityRank: Record<UserWeakAreaSummary['priority'], number> = {
      high: 0,
      medium: 1,
      low: 2,
    };

    return candidates
      .sort((left, right) => {
        const priorityDelta =
          priorityRank[left.priority] - priorityRank[right.priority];
        if (priorityDelta !== 0) {
          return priorityDelta;
        }
        const accuracyDelta =
          (left.accuracyPct ?? 101) - (right.accuracyPct ?? 101);
        if (accuracyDelta !== 0) {
          return accuracyDelta;
        }
        return right.casesCompleted - left.casesCompleted;
      })
      .slice(0, 5);
  }

  private weakAreasForDimension(
    type: StatsDimensionType,
    summaries: StatsDimensionSummary[],
    overallAccuracyPct: number | null,
  ): UserWeakAreaSummary[] {
    return summaries.flatMap((summary) => {
      if (
        summary.casesCompleted < WEAK_AREA_MIN_CASES ||
        summary.accuracyPct === null
      ) {
        return [];
      }

      if (summary.accuracyPct < 40) {
        return [
          this.buildWeakArea(type, summary, 'high', 'Accuracy below 40%'),
        ];
      }

      if (summary.accuracyPct < WEAK_AREA_THRESHOLD) {
        return [
          this.buildWeakArea(type, summary, 'medium', 'Accuracy below 60%'),
        ];
      }

      if (
        overallAccuracyPct !== null &&
        summary.accuracyPct <= overallAccuracyPct - LOW_PRIORITY_GAP
      ) {
        return [
          this.buildWeakArea(
            type,
            summary,
            'low',
            'Accuracy trails your overall rate',
          ),
        ];
      }

      return [];
    });
  }

  private buildWeakArea(
    type: StatsDimensionType,
    summary: StatsDimensionSummary,
    priority: UserWeakAreaSummary['priority'],
    reason: string,
  ): UserWeakAreaSummary {
    return {
      type,
      key: summary.key,
      label: summary.label,
      reason,
      casesCompleted: summary.casesCompleted,
      accuracyPct: summary.accuracyPct,
      priority,
    };
  }

  private summarizeRecent(metrics: SessionMetric[]): UserStatsReport['recent'] {
    const lastPlayedAt = metrics[0]?.completedAt?.toISOString() ?? null;
    const recentCutoff = Date.now() - RECENT_WINDOW_MS;
    const recentMetrics = metrics.filter(
      (metric) => metric.completedAt.getTime() >= recentCutoff,
    );
    const recentSolved = recentMetrics.filter((metric) => metric.solved).length;

    return {
      lastPlayedAt,
      recentCompletedCases: recentMetrics.length,
      recentAccuracyPct: this.percent(recentSolved, recentMetrics.length),
    };
  }

  private resolveSpecialtyLabel(session: CompletedSession): string {
    const rawSpecialty =
      session.case.diagnosisRegistry?.specialty ??
      session.case.diagnosisRegistry?.category;

    return (
      normalizeSpecialtyDisplayName(rawSpecialty) ??
      this.normalizeLabel(rawSpecialty, 'General')
    );
  }

  private resolveBodySystemLabel(session: CompletedSession): string {
    return this.normalizeLabel(
      session.case.diagnosisRegistry?.bodySystem ??
        session.case.diagnosisRegistry?.category,
      'General',
    );
  }

  private normalizeLabel(value: string | null | undefined, fallback: string): string {
    const trimmed = value?.trim();
    return trimmed ? trimmed : fallback;
  }

  private toKey(label: string): string {
    return label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private percent(numerator: number, denominator: number): number | null {
    if (denominator <= 0) {
      return null;
    }
    return Math.round((numerator / denominator) * 100);
  }

  private average(total: number, count: number): number | null {
    if (count <= 0) {
      return null;
    }
    return Math.round((total / count) * 10) / 10;
  }
}
