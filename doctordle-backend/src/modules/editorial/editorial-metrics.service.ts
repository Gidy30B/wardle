import { Injectable } from '@nestjs/common';
import {
  CaseEditorialStatus,
  CaseSource,
  ReviewDecision,
  ValidationOutcome,
} from '@prisma/client';
import { MetricsService } from '../../core/logger/metrics.service.js';

type AssignmentMode = 'explicit' | 'lazy';
type AssignmentDecision = 'accepted' | 'rejected';

const CASE_SOURCES = Object.values(CaseSource);
const VALIDATION_OUTCOMES = Object.values(ValidationOutcome);
const REVIEW_DECISIONS = Object.values(ReviewDecision);
const EDITORIAL_STATUSES = Object.values(CaseEditorialStatus);

@Injectable()
export class EditorialMetricsService {
  private readonly validationCounts = new Map<
    CaseSource,
    Record<ValidationOutcome, number>
  >();

  private readonly reviewOutcomeCounts = new Map<ReviewDecision, number>();
  private readonly revisionCounts = new Map<CaseSource, number>();
  private readonly assignmentCounts = new Map<
    AssignmentMode,
    Record<AssignmentDecision, number>
  >();
  private readonly assignmentRejectedByStatus = new Map<
    AssignmentMode,
    Record<string, number>
  >();
  private lazyNoEligibleCaseMisses = 0;
  private readyToPublishTransitions = 0;

  constructor(private readonly metrics: MetricsService) {
    for (const source of CASE_SOURCES) {
      this.validationCounts.set(source, {
        PASSED: 0,
        FAILED: 0,
        ERROR: 0,
      });
      this.revisionCounts.set(source, 0);
    }

    for (const decision of REVIEW_DECISIONS) {
      this.reviewOutcomeCounts.set(decision, 0);
    }

    for (const mode of ['explicit', 'lazy'] as const) {
      this.assignmentCounts.set(mode, {
        accepted: 0,
        rejected: 0,
      });
      this.assignmentRejectedByStatus.set(
        mode,
        Object.fromEntries(
          ['null', ...EDITORIAL_STATUSES].map((status) => [status, 0]),
        ),
      );
    }
  }

  recordValidationResult(
    source: CaseSource,
    outcome: ValidationOutcome,
  ): void {
    const counts = this.validationCounts.get(source);
    if (!counts) {
      return;
    }

    counts[outcome] += 1;
    this.metrics.increment(`editorial.validation.source.${source}.${outcome}`);
  }

  recordReviewOutcome(decision: ReviewDecision): void {
    this.reviewOutcomeCounts.set(
      decision,
      (this.reviewOutcomeCounts.get(decision) ?? 0) + 1,
    );
    this.metrics.increment(`editorial.review.${decision}`);
  }

  recordRevisionCreated(source: CaseSource): void {
    this.revisionCounts.set(source, (this.revisionCounts.get(source) ?? 0) + 1);
    this.metrics.increment(`editorial.revision.${source}`);
  }

  recordAssignmentAccepted(mode: AssignmentMode): void {
    const counts = this.assignmentCounts.get(mode);
    if (!counts) {
      return;
    }

    counts.accepted += 1;
    this.metrics.increment(`editorial.assignment.${mode}.accepted`);
  }

  recordAssignmentRejected(
    mode: AssignmentMode,
    editorialStatus: CaseEditorialStatus | null,
  ): void {
    const counts = this.assignmentCounts.get(mode);
    const rejectedByStatus = this.assignmentRejectedByStatus.get(mode);
    if (!counts || !rejectedByStatus) {
      return;
    }

    counts.rejected += 1;
    const statusKey = editorialStatus ?? 'null';
    rejectedByStatus[statusKey] = (rejectedByStatus[statusKey] ?? 0) + 1;

    this.metrics.increment(`editorial.assignment.${mode}.rejected`);
    this.metrics.increment(
      `editorial.assignment.${mode}.rejected.status.${statusKey}`,
    );
  }

  recordLazyNoEligibleCaseMiss(): void {
    this.lazyNoEligibleCaseMisses += 1;
    this.metrics.increment('editorial.assignment.lazy.no_eligible_case');
  }

  recordReadyToPublishTransition(): void {
    this.readyToPublishTransitions += 1;
    this.metrics.increment('editorial.publish.ready_to_publish');
  }

  snapshot() {
    return {
      validation: Object.fromEntries(
        CASE_SOURCES.map((source) => [
          source,
          {
            ...this.validationCounts.get(source),
          },
        ]),
      ) as Record<CaseSource, Record<ValidationOutcome, number>>,
      reviews: Object.fromEntries(
        REVIEW_DECISIONS.map((decision) => [
          decision,
          this.reviewOutcomeCounts.get(decision) ?? 0,
        ]),
      ) as Record<ReviewDecision, number>,
      revisions: Object.fromEntries(
        CASE_SOURCES.map((source) => [source, this.revisionCounts.get(source) ?? 0]),
      ) as Record<CaseSource, number>,
      assignments: {
        explicit: {
          ...this.assignmentCounts.get('explicit'),
          rejectedByEditorialStatus: {
            ...this.assignmentRejectedByStatus.get('explicit'),
          },
        },
        lazy: {
          ...this.assignmentCounts.get('lazy'),
          rejectedByEditorialStatus: {
            ...this.assignmentRejectedByStatus.get('lazy'),
          },
          noEligibleCaseMisses: this.lazyNoEligibleCaseMisses,
        },
        readyToPublishTransitions: this.readyToPublishTransitions,
      },
    };
  }
}
