import { BadRequestException, Injectable, Logger, Optional } from '@nestjs/common';
import {
  CaseEditorialStatus,
  DiagnosisRegistryStatus,
  Prisma,
  PublishTrack,
} from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';
import { CaseEligibilityPolicyService } from '../cases/case-eligibility-policy.service';
import { DiagnosisRegistryLifecyclePolicyService } from '../diagnosis-registry/diagnosis-registry-lifecycle-policy.service';
import { ASSIGNABLE_EDITORIAL_STATUSES } from '../editorial/policies/publish-policy.js';

const TRACK_PRIORITY: Record<PublishTrack, number> = {
  [PublishTrack.DAILY]: 1,
  [PublishTrack.PREMIUM]: 2,
  [PublishTrack.PRACTICE]: 3,
};

function getTrackPriority(track: PublishTrack): number {
  return TRACK_PRIORITY[track] ?? Number.MAX_SAFE_INTEGER;
}

function normalizeDailyDate(value: Date | string = new Date()): Date {
  const parsed = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`Invalid daily case date: ${value}`);
  }

  return new Date(
    Date.UTC(
      parsed.getUTCFullYear(),
      parsed.getUTCMonth(),
      parsed.getUTCDate(),
    ),
  );
}

const assignmentDailyCaseArgs = {
  include: {
    case: {
      select: {
        id: true,
        title: true,
        editorialStatus: true,
        currentRevisionId: true,
        currentRevision: {
          select: {
            id: true,
            date: true,
            publishTrack: true,
          },
        },
      },
    },
  },
} satisfies Prisma.DailyCaseDefaultArgs;

type AssignmentDailyCase = Prisma.DailyCaseGetPayload<
  typeof assignmentDailyCaseArgs
>;

type AssignmentCandidate = {
  id: string;
  title: string;
  diagnosisId: string | null;
  diagnosisRegistryId: string | null;
  diagnosisMappingStatus: string;
  diagnosisRegistry: {
    id: string;
    displayLabel: string | null;
    canonicalName: string;
    status?: DiagnosisRegistryStatus;
    active: boolean;
    isPlayable: boolean;
  } | null;
  clues: Prisma.JsonValue | null;
  explanation: Prisma.JsonValue | null;
  editorialStatus: CaseEditorialStatus | null;
  approvedAt: Date | null;
  currentRevisionId: string | null;
  currentRevision: {
    id: string;
    date: Date;
    publishTrack: PublishTrack | null;
  } | null;
};

export type AssignmentBlockedReason =
  | 'invalid_status'
  | 'already_scheduled'
  | 'invalid_clues'
  | 'no_playable_clues'
  | 'invalid_clue_type'
  | 'missing_diagnosis'
  | 'diagnosis_not_matched'
  | 'registry_not_playable'
  | 'missing_explanation'
  | 'track_mismatch';

export type AssignmentSkippedSlotReason =
  | 'slot_already_exists'
  | 'past_date_immutable'
  | 'no_eligible_case';

export type AssignedSlot = {
  date: string;
  dailyCaseId: string;
  caseId: string;
  track: PublishTrack;
  sequenceIndex: number;
};

export type ExistingSlot = AssignedSlot;

export type BlockedCase = {
  caseId: string;
  diagnosis: string | null;
  editorialStatus: string | null;
  reason: AssignmentBlockedReason;
};

export type SkippedSlot = {
  date: string;
  track: PublishTrack;
  sequenceIndex: number;
  reason: AssignmentSkippedSlotReason;
};

export type AssignmentResult = {
  startDate: string;
  days?: number;
  createdCount: number;
  existingCount: number;
  missingDates: string[];
  createdSlots: AssignedSlot[];
  existingSlots: ExistingSlot[];
  blockedCases: BlockedCase[];
  skippedSlots: SkippedSlot[];
};

type AssignmentMode = 'rolling_window' | 'editorial_date';

@Injectable()
export class CaseAssignmentService {
  private readonly logger = new Logger(CaseAssignmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly caseEligibilityPolicy: CaseEligibilityPolicyService,
    @Optional()
    private readonly lifecyclePolicy?: DiagnosisRegistryLifecyclePolicyService,
  ) {}

  async ensureWindow(input: {
    startDate: string | Date;
    days: number;
    tracks?: PublishTrack[];
    force?: boolean;
    source?: string;
  }): Promise<AssignmentResult> {
    if (!Number.isInteger(input.days) || input.days < 1 || input.days > 31) {
      throw new BadRequestException(
        'Schedule window days must be an integer between 1 and 31',
      );
    }

    return this.assignRange({
      startDate: input.startDate,
      days: input.days,
      tracks: input.tracks ?? [PublishTrack.DAILY],
      force: input.force ?? false,
      source: input.source ?? 'daily_scheduler',
      mode: 'rolling_window',
    });
  }

  async assignDate(input: {
    date: string | Date;
    tracks?: PublishTrack[];
    force?: boolean;
    source?: string;
  }): Promise<AssignmentResult> {
    return this.assignRange({
      startDate: input.date,
      days: 1,
      tracks: input.tracks ?? [
        PublishTrack.DAILY,
        PublishTrack.PREMIUM,
        PublishTrack.PRACTICE,
      ],
      force: input.force ?? false,
      source: input.source ?? 'daily_publisher',
      mode: 'editorial_date',
    });
  }

  evaluateCaseEligibility(
    caseRecord: AssignmentCandidate,
    scheduledCaseIds: Set<string>,
    allowedTracks: Set<PublishTrack>,
    mode: AssignmentMode,
  ): AssignmentBlockedReason | null {
    if (scheduledCaseIds.has(caseRecord.id)) {
      return 'already_scheduled';
    }

    if (
      !this.caseEligibilityPolicy.isAssignableEditorialStatus(
        caseRecord.editorialStatus,
      )
    ) {
      return 'invalid_status';
    }

    const clueReason = this.caseEligibilityPolicy.getSchedulerClueExclusionReason(
      caseRecord.clues,
    );
    if (clueReason) {
      return clueReason;
    }

    if (!caseRecord.diagnosisRegistryId?.trim()) {
      return 'missing_diagnosis';
    }

    if (caseRecord.diagnosisMappingStatus !== 'MATCHED') {
      return 'diagnosis_not_matched';
    }

    if (
      !this.caseEligibilityPolicy.isRegistryPlayable(
        caseRecord.diagnosisRegistry,
      )
    ) {
      return 'registry_not_playable';
    }

    if (
      caseRecord.explanation === null ||
      caseRecord.explanation === undefined
    ) {
      return 'missing_explanation';
    }

    if (mode === 'editorial_date') {
      const track =
        caseRecord.currentRevision?.publishTrack ?? PublishTrack.DAILY;
      if (!allowedTracks.has(track)) {
        return 'track_mismatch';
      }
    }

    return null;
  }

  private async assignRange(input: {
    startDate: string | Date;
    days: number;
    tracks: PublishTrack[];
    force: boolean;
    source: string;
    mode: AssignmentMode;
  }): Promise<AssignmentResult> {
    const normalizedStart = normalizeDailyDate(input.startDate);
    const windowDates = Array.from({ length: input.days }, (_, index) => {
      const date = new Date(normalizedStart);
      date.setUTCDate(date.getUTCDate() + index);
      return date;
    });
    const lastWindowDate = windowDates[windowDates.length - 1];
    const windowEndExclusive = new Date(normalizedStart);
    windowEndExclusive.setUTCDate(windowEndExclusive.getUTCDate() + input.days);
    const today = normalizeDailyDate(new Date());
    const allowedTracks = new Set(input.tracks);

    this.logger.log(
      JSON.stringify({
        event: 'daily_case.assignment.started',
        source: input.source,
        mode: input.mode,
        startDate: normalizedStart.toISOString(),
        days: input.days,
        tracks: input.tracks,
        force: input.force,
      }),
    );

    return this.withSerializableRetry(() =>
      this.prisma.$transaction(
        async (tx) => {
          await this.acquireAssignmentLock(tx);

          const existingSlots = await tx.dailyCase.findMany({
            where: {
              date: {
                gte: normalizedStart,
                lte: lastWindowDate,
              },
              track: {
                in: input.tracks,
              },
            },
            orderBy: [{ date: 'asc' }, { track: 'asc' }, { sequenceIndex: 'asc' }],
            ...assignmentDailyCaseArgs,
          });

          const allScheduledSlots = await tx.dailyCase.findMany({
            orderBy: [
              { date: 'asc' },
              { track: 'asc' },
              { sequenceIndex: 'asc' },
            ],
            select: {
              caseId: true,
            },
          });
          const scheduledCaseIds = new Set(
            allScheduledSlots.map((assignment) => assignment.caseId),
          );

          const candidates = await this.loadCandidates(tx, {
            normalizedStart,
            windowEndExclusive,
            mode: input.mode,
          });

          const blockedCases: BlockedCase[] = [];
          const eligibleCases: AssignmentCandidate[] = [];

          for (const caseRecord of candidates) {
            const reason = this.evaluateCaseEligibility(
              caseRecord,
              scheduledCaseIds,
              allowedTracks,
              input.mode,
            );

            if (reason) {
              blockedCases.push(this.toBlockedCase(caseRecord, reason));
              this.logger.log(
                JSON.stringify({
                  event: 'daily_case.schedule.case.excluded',
                  source: input.source,
                  caseId: caseRecord.id,
                  caseTitle: caseRecord.title,
                  editorialStatus: caseRecord.editorialStatus ?? null,
                  reason,
                }),
              );
              continue;
            }

            eligibleCases.push(caseRecord);
          }

          const createRows = this.planCreateRows({
            dates: windowDates,
            today,
            tracks: input.tracks,
            mode: input.mode,
            existingSlots,
            eligibleCases,
            scheduledCaseIds,
            force: input.force,
          });

          if (createRows.skippedSlots.length > 0) {
            for (const skipped of createRows.skippedSlots) {
              this.logger.warn(
                JSON.stringify({
                  event: 'daily_case.assignment.slot.skipped',
                  source: input.source,
                  ...skipped,
                }),
              );
              if (skipped.reason === 'no_eligible_case') {
                this.logger.warn(
                  JSON.stringify({
                    event:
                      input.mode === 'editorial_date'
                        ? 'daily_case.publish.insufficient_unused_candidates'
                        : 'daily_case.schedule.slot.missing_no_inventory',
                    source: input.source,
                    date: skipped.date,
                    track: skipped.track,
                    sequenceIndex: skipped.sequenceIndex,
                  }),
                );
              }
            }
          }

          const createResult =
            createRows.rows.length > 0
              ? await tx.dailyCase.createMany({
                  data: createRows.rows,
                  skipDuplicates: true,
                })
              : { count: 0 };

          const finalSlots = await tx.dailyCase.findMany({
            where: {
              date: {
                gte: normalizedStart,
                lte: lastWindowDate,
              },
              track: {
                in: input.tracks,
              },
            },
            orderBy: [{ date: 'asc' }, { track: 'asc' }, { sequenceIndex: 'asc' }],
            ...assignmentDailyCaseArgs,
          });

          const createdSlots = this.findCreatedSlots(
            createRows.rows,
            finalSlots,
          );
          await this.markCreatedCasesPublished(tx, createdSlots);
          const missingDates = Array.from(
            new Set(
              createRows.skippedSlots
                .filter((slot) => slot.reason !== 'slot_already_exists')
                .map((slot) => slot.date),
            ),
          );

          const result: AssignmentResult = {
            startDate: this.toDateKey(normalizedStart),
            days: input.days,
            createdCount: createResult.count,
            existingCount: existingSlots.length,
            missingDates,
            createdSlots,
            existingSlots: existingSlots.map((slot) => this.toSlot(slot)),
            blockedCases,
            skippedSlots: createRows.skippedSlots,
          };

          this.logger.log(
            JSON.stringify({
              event: 'daily_case.assignment.completed',
              source: input.source,
              mode: input.mode,
              startDate: result.startDate,
              days: result.days,
              createdCount: result.createdCount,
              existingCount: result.existingCount,
              missingDates: result.missingDates,
              blockedCount: result.blockedCases.length,
              skippedSlotCount: result.skippedSlots.length,
            }),
          );

          return result;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      ),
    );
  }

  private async loadCandidates(
    tx: Prisma.TransactionClient,
    input: {
      normalizedStart: Date;
      windowEndExclusive: Date;
      mode: AssignmentMode;
    },
  ): Promise<AssignmentCandidate[]> {
    const where =
      input.mode === 'editorial_date'
        ? {
            editorialStatus: {
              in: [...ASSIGNABLE_EDITORIAL_STATUSES],
            },
            currentRevision: {
              is: {
                date: {
                  gte: input.normalizedStart,
                  lt: input.windowEndExclusive,
                },
              },
            },
          }
        : {};

    return tx.case.findMany({
      where,
      orderBy: [{ approvedAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        title: true,
        diagnosisId: true,
        diagnosisRegistryId: true,
        diagnosisMappingStatus: true,
        diagnosisRegistry: {
          select: {
            id: true,
            displayLabel: true,
            canonicalName: true,
            status: true,
            active: true,
            isPlayable: true,
          },
        },
        clues: true,
        explanation: true,
        editorialStatus: true,
        approvedAt: true,
        currentRevisionId: true,
        currentRevision: {
          select: {
            id: true,
            date: true,
            publishTrack: true,
          },
        },
      },
    });
  }

  private planCreateRows(input: {
    dates: Date[];
    today: Date;
    tracks: PublishTrack[];
    mode: AssignmentMode;
    existingSlots: AssignmentDailyCase[];
    eligibleCases: AssignmentCandidate[];
    scheduledCaseIds: Set<string>;
    force: boolean;
  }): {
    rows: Array<{
      date: Date;
      caseId: string;
      track: PublishTrack;
      sequenceIndex: number;
    }>;
    skippedSlots: SkippedSlot[];
  } {
    const existingSlotKeys = new Set(
      input.existingSlots.map((slot) =>
        this.getSlotKey(slot.date, slot.track, slot.sequenceIndex),
      ),
    );
    const usedCaseIds = new Set(input.scheduledCaseIds);
    const rows: Array<{
      date: Date;
      caseId: string;
      track: PublishTrack;
      sequenceIndex: number;
    }> = [];
    const skippedSlots: SkippedSlot[] = [];

    for (const date of input.dates) {
      if (input.mode === 'rolling_window') {
        const track = PublishTrack.DAILY;
        const sequenceIndex = 1;
        const dateKey = this.toDateKey(date);
        const slotKey = this.getSlotKey(date, track, sequenceIndex);

        if (existingSlotKeys.has(slotKey) && !input.force) {
          skippedSlots.push({
            date: dateKey,
            track,
            sequenceIndex,
            reason: 'slot_already_exists',
          });
          continue;
        }

        if (date.getTime() < input.today.getTime()) {
          skippedSlots.push({
            date: dateKey,
            track,
            sequenceIndex,
            reason: 'past_date_immutable',
          });
          continue;
        }

        const caseRecord = input.eligibleCases.find(
          (candidate) => !usedCaseIds.has(candidate.id),
        );

        if (!caseRecord) {
          skippedSlots.push({
            date: dateKey,
            track,
            sequenceIndex,
            reason: 'no_eligible_case',
          });
          continue;
        }

        rows.push({ date, caseId: caseRecord.id, track, sequenceIndex });
        usedCaseIds.add(caseRecord.id);
        continue;
      }

      const byTrack = new Map<PublishTrack, AssignmentCandidate[]>();
      for (const candidate of input.eligibleCases) {
        const track = candidate.currentRevision?.publishTrack ?? PublishTrack.DAILY;
        if (!input.tracks.includes(track)) {
          continue;
        }
        const trackCases = byTrack.get(track) ?? [];
        trackCases.push(candidate);
        byTrack.set(track, trackCases);
      }

      for (const track of input.tracks.sort(
        (left, right) => getTrackPriority(left) - getTrackPriority(right),
      )) {
        const candidates = (byTrack.get(track) ?? []).sort((left, right) =>
          left.id.localeCompare(right.id),
        );
        const existingTrackSlotCount = input.existingSlots.filter(
          (slot) =>
            slot.date.getTime() === date.getTime() && slot.track === track,
        ).length;
        const desiredSlotCount = candidates.length + existingTrackSlotCount;

        for (
          let sequenceIndex = 1;
          sequenceIndex <= desiredSlotCount;
          sequenceIndex += 1
        ) {
          const slotKey = this.getSlotKey(date, track, sequenceIndex);
          if (existingSlotKeys.has(slotKey) && !input.force) {
            skippedSlots.push({
              date: this.toDateKey(date),
              track,
              sequenceIndex,
              reason: 'slot_already_exists',
            });
            continue;
          }

          const caseRecord = candidates.find(
            (candidate) => !usedCaseIds.has(candidate.id),
          );
          if (!caseRecord) {
            skippedSlots.push({
              date: this.toDateKey(date),
              track,
              sequenceIndex,
              reason: 'no_eligible_case',
            });
            break;
          }

          rows.push({
            date,
            caseId: caseRecord.id,
            track,
            sequenceIndex,
          });
          usedCaseIds.add(caseRecord.id);
        }
      }
    }

    return { rows, skippedSlots };
  }

  private findCreatedSlots(
    createRows: Array<{
      date: Date;
      caseId: string;
      track: PublishTrack;
      sequenceIndex: number;
    }>,
    finalSlots: AssignmentDailyCase[],
  ): AssignedSlot[] {
    const requested = new Map(
      createRows.map((row) => [
        this.getSlotKey(row.date, row.track, row.sequenceIndex),
        row.caseId,
      ]),
    );

    return finalSlots
      .filter((slot) => {
        const caseId = requested.get(
          this.getSlotKey(slot.date, slot.track, slot.sequenceIndex),
        );
        return caseId === slot.caseId;
      })
      .map((slot) => this.toSlot(slot));
  }

  private async markCreatedCasesPublished(
    tx: Prisma.TransactionClient,
    createdSlots: AssignedSlot[],
  ): Promise<void> {
    const caseIds = Array.from(
      new Set(createdSlots.map((slot) => slot.caseId)),
    );

    if (caseIds.length === 0) {
      return;
    }

    await tx.case.updateMany({
      where: {
        id: {
          in: caseIds,
        },
        editorialStatus: CaseEditorialStatus.READY_TO_PUBLISH,
      },
      data: {
        editorialStatus: CaseEditorialStatus.PUBLISHED,
        publishedAt: new Date(),
      },
    });
  }

  private toBlockedCase(
    caseRecord: AssignmentCandidate,
    reason: AssignmentBlockedReason,
  ): BlockedCase {
    return {
      caseId: caseRecord.id,
      diagnosis:
        caseRecord.diagnosisRegistry?.displayLabel ??
        caseRecord.diagnosisRegistry?.canonicalName ??
        null,
      editorialStatus: caseRecord.editorialStatus ?? null,
      reason,
    };
  }

  private toSlot(dailyCase: AssignmentDailyCase): AssignedSlot {
    return {
      date: this.toDateKey(dailyCase.date),
      dailyCaseId: dailyCase.id,
      caseId: dailyCase.caseId,
      track: dailyCase.track,
      sequenceIndex: dailyCase.sequenceIndex,
    };
  }

  private getSlotKey(
    date: Date,
    track: PublishTrack,
    sequenceIndex: number,
  ): string {
    return `${this.toDateKey(date)}:${track}:${sequenceIndex}`;
  }

  private async acquireAssignmentLock(
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('daily_case_assignment'))`;
  }

  private toDateKey(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private async withSerializableRetry<T>(
    operation: () => Promise<T>,
    maxAttempts = 3,
  ): Promise<T> {
    let attempt = 0;

    while (true) {
      try {
        return await operation();
      } catch (error) {
        attempt += 1;
        const maybePrismaError = error as { code?: string };
        const retryable =
          maybePrismaError.code === 'P2034' ||
          maybePrismaError.code === '40001';

        if (!retryable || attempt >= maxAttempts) {
          throw error;
        }

        this.logger.warn(
          JSON.stringify({
            event: 'daily_case.assignment.transaction_retry',
            attempt,
            maxAttempts,
            code: maybePrismaError.code,
          }),
        );
      }
    }
  }
}
