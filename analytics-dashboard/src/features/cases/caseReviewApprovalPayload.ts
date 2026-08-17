import type {
  EditorialCaseDetail,
  ReviewDecision,
  SubmitCaseReviewPayload,
} from '../../api/admin';

const staleConflictSignals = [
  'Stale approval command',
  'Stale review context',
  'expected revision does not match current revision',
  'expected review does not match active review',
];

function latestReview(detail: EditorialCaseDetail) {
  return [...detail.reviews].sort((left, right) => {
    const leftTimestamp = left.decidedAt ?? left.createdAt;
    const rightTimestamp = right.decidedAt ?? right.createdAt;
    return new Date(rightTimestamp).getTime() - new Date(leftTimestamp).getTime();
  })[0] ?? null;
}

export function buildReviewPayload(input: {
  detail: EditorialCaseDetail;
  decision: ReviewDecision;
  notes?: string;
  commandIdempotencyKey?: string;
  authorityAssignmentReferences?: string[];
}): SubmitCaseReviewPayload {
  const notes = input.notes?.trim() || undefined;
  if (input.decision !== 'APPROVED') {
    return {
      decision: input.decision,
      notes,
    };
  }

  const review = latestReview(input.detail);
  if (!input.detail.currentRevisionId || !review?.id) {
    throw new Error('Approval requires a current revision and active review.');
  }

  return {
    decision: input.decision,
    expectedRevisionId: input.detail.currentRevisionId,
    expectedReviewId: review.id,
    commandIdempotencyKey:
      input.commandIdempotencyKey ?? createCaseReviewIdempotencyKey(input.detail.id),
    authorityAssignmentReferences: input.authorityAssignmentReferences,
    notes,
  };
}

export function createCaseReviewIdempotencyKey(caseId: string): string {
  const randomId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `approve-case-revision:${caseId}:${randomId}`;
}

export function isStaleApprovalConflict(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return staleConflictSignals.some((signal) => message.includes(signal));
}
