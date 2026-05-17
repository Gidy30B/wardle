import { Injectable } from '@nestjs/common';
import { DiagnosisRegistryStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service.js';
import type { PlannedGenerationDiagnosis } from './case-generator.types.js';

const RECENT_USE_WINDOW_DAYS = 30;
const RECENT_USE_WINDOW_MS = RECENT_USE_WINDOW_DAYS * 24 * 60 * 60 * 1000;

export type DiagnosisSelectionInput = {
  count: number;
  specialty?: string;
  bodySystem?: string;
  difficulty?: string;
  excludeRegistryIds?: string[];
};

export type DiagnosisSelectionResult = {
  candidates: PlannedGenerationDiagnosis[];
  candidateCount: number;
  unusedCandidateCount: number;
  repeatedCandidateCount: number;
  existingCaseCountByDiagnosis: Record<string, number>;
  recentUsePenaltyApplied: boolean;
};

@Injectable()
export class DiagnosisSelectionService {
  constructor(private readonly prisma: PrismaService) {}

  async selectDiagnoses(
    input: DiagnosisSelectionInput,
  ): Promise<PlannedGenerationDiagnosis[]> {
    const result = await this.selectDiagnosisCandidates(input);

    return result.candidates.slice(0, Math.max(0, Math.trunc(input.count)));
  }

  async selectDiagnosisCandidates(
    input: DiagnosisSelectionInput,
  ): Promise<DiagnosisSelectionResult> {
    const count = Math.max(0, Math.trunc(input.count));
    if (count === 0) {
      return {
        candidates: [],
        candidateCount: 0,
        unusedCandidateCount: 0,
        repeatedCandidateCount: 0,
        existingCaseCountByDiagnosis: {},
        recentUsePenaltyApplied: false,
      };
    }

    const difficultyBand = input.difficulty
      ? this.mapDifficultyFilter(input.difficulty)
      : undefined;
    const where: Prisma.DiagnosisRegistryWhereInput = {
      active: true,
      status: DiagnosisRegistryStatus.ACTIVE,
      isPlayable: true,
      isGeneratable: true,
      ...(input.specialty
        ? {
            specialty: {
              equals: input.specialty,
              mode: 'insensitive',
            },
          }
        : {}),
      ...(input.bodySystem
        ? {
            bodySystem: {
              equals: input.bodySystem,
              mode: 'insensitive',
            },
          }
        : {}),
      ...(difficultyBand
        ? {
            difficultyBand,
          }
        : {}),
      ...(input.excludeRegistryIds?.length
        ? {
            id: {
              notIn: input.excludeRegistryIds,
            },
          }
        : {}),
    };

    const rows = await this.prisma.diagnosisRegistry.findMany({
      where,
      orderBy: [{ searchPriority: 'desc' }, { displayLabel: 'asc' }],
      select: {
        id: true,
        legacyDiagnosisId: true,
        displayLabel: true,
        canonicalName: true,
        specialty: true,
        category: true,
        bodySystem: true,
        difficultyBand: true,
        searchPriority: true,
        _count: {
          select: {
            cases: true,
          },
        },
        cases: {
          orderBy: {
            date: 'desc',
          },
          take: 1,
          select: {
            date: true,
          },
        },
        aliases: {
          where: {
            active: true,
            acceptedForMatch: true,
          },
          select: {
            term: true,
          },
          orderBy: [{ rank: 'asc' }, { term: 'asc' }],
        },
      },
    });

    const now = Date.now();
    const candidates = rows
      .map((row) => ({
        diagnosisRegistryId: row.id,
        legacyDiagnosisId: row.legacyDiagnosisId,
        displayLabel: row.displayLabel,
        canonicalName: row.canonicalName,
        acceptedAliases: row.aliases.map((alias) => alias.term),
        specialty: row.specialty,
        category: row.category,
        bodySystem: row.bodySystem,
        difficultyBand: row.difficultyBand,
        existingCaseCount: row._count.cases,
        lastGeneratedAt: row.cases[0]?.date ?? null,
        recentUsePenaltyApplied: this.wasRecentlyUsed(
          row.cases[0]?.date ?? null,
          now,
        ),
        metadataFitScore: this.getMetadataFitScore({
          candidate: row,
          input,
          difficultyBand,
        }),
      }))
      .sort((left, right) => {
        const unusedDelta =
          Number(left.existingCaseCount > 0) -
          Number(right.existingCaseCount > 0);
        if (unusedDelta !== 0) {
          return unusedDelta;
        }

        const countDelta = left.existingCaseCount - right.existingCaseCount;
        if (countDelta !== 0) {
          return countDelta;
        }

        const recencyDelta =
          Number(left.recentUsePenaltyApplied) -
          Number(right.recentUsePenaltyApplied);
        if (recencyDelta !== 0) {
          return recencyDelta;
        }

        const fitDelta = right.metadataFitScore - left.metadataFitScore;
        if (fitDelta !== 0) {
          return fitDelta;
        }

        return left.displayLabel.localeCompare(right.displayLabel);
      })
      .map(({ metadataFitScore: _metadataFitScore, ...candidate }) => candidate);
    const existingCaseCountByDiagnosis = Object.fromEntries(
      candidates.map((candidate) => [
        candidate.diagnosisRegistryId,
        candidate.existingCaseCount,
      ]),
    );

    return {
      candidates,
      candidateCount: candidates.length,
      unusedCandidateCount: candidates.filter(
        (candidate) => candidate.existingCaseCount === 0,
      ).length,
      repeatedCandidateCount: candidates.filter(
        (candidate) => candidate.existingCaseCount > 0,
      ).length,
      existingCaseCountByDiagnosis,
      recentUsePenaltyApplied: candidates.some(
        (candidate) => candidate.recentUsePenaltyApplied,
      ),
    };
  }

  private mapDifficultyFilter(value: string) {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'easy' || normalized === 'basic') {
      return 'BASIC' as const;
    }

    if (normalized === 'hard' || normalized === 'advanced') {
      return 'ADVANCED' as const;
    }

    if (normalized === 'medium' || normalized === 'intermediate') {
      return 'INTERMEDIATE' as const;
    }

    return undefined;
  }

  private wasRecentlyUsed(value: Date | null, now: number): boolean {
    if (!value) {
      return false;
    }

    return now - value.getTime() <= RECENT_USE_WINDOW_MS;
  }

  private getMetadataFitScore(input: {
    candidate: {
      specialty: string | null;
      bodySystem: string | null;
      difficultyBand: string | null;
      searchPriority: number;
    };
    input: DiagnosisSelectionInput;
    difficultyBand?: string;
  }): number {
    let score = input.candidate.searchPriority;

    if (
      input.input.specialty &&
      input.candidate.specialty?.toLowerCase() ===
        input.input.specialty.toLowerCase()
    ) {
      score += 10;
    }

    if (
      input.input.bodySystem &&
      input.candidate.bodySystem?.toLowerCase() ===
        input.input.bodySystem.toLowerCase()
    ) {
      score += 10;
    }

    if (
      input.difficultyBand &&
      input.candidate.difficultyBand === input.difficultyBand
    ) {
      score += 5;
    }

    return score;
  }
}
