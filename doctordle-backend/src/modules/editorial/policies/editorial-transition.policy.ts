import {
  CaseEditorialStatus,
  ReviewDecision,
  ValidationOutcome,
} from '@prisma/client';

export function canStartEditorialReview(
  status: CaseEditorialStatus | null,
): boolean {
  return status !== CaseEditorialStatus.PUBLISHED;
}

export function canMoveToReadyToPublish(
  status: CaseEditorialStatus | null,
): boolean {
  return status === CaseEditorialStatus.APPROVED;
}

export function getEditorialStatusForReviewDecision(
  decision: ReviewDecision,
): CaseEditorialStatus {
  if (decision === ReviewDecision.APPROVED) {
    return CaseEditorialStatus.APPROVED;
  }

  if (decision === ReviewDecision.NEEDS_EDIT) {
    return CaseEditorialStatus.NEEDS_EDIT;
  }

  return CaseEditorialStatus.REJECTED;
}

export function getEditorialStatusForValidationOutcome(input: {
  currentStatus: CaseEditorialStatus | null;
  outcome: ValidationOutcome;
}): CaseEditorialStatus | null {
  if (input.outcome === ValidationOutcome.PASSED) {
    if (
      input.currentStatus === CaseEditorialStatus.APPROVED ||
      input.currentStatus === CaseEditorialStatus.READY_TO_PUBLISH
    ) {
      return null;
    }

    return CaseEditorialStatus.VALIDATED;
  }

  return CaseEditorialStatus.NEEDS_EDIT;
}
