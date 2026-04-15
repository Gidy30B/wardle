import type {
  CaseEditorialStatus,
  ReviewDecision,
  ValidationOutcome,
} from '../../api/admin';

export type StatusBadgeTone =
  | 'neutral'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info';

export type StatusBadgeValue =
  | CaseEditorialStatus
  | ValidationOutcome
  | ReviewDecision
  | string;

export type StatusBadgeMeta = {
  label: string;
  tone: StatusBadgeTone;
};

export type StatusBadgeKind = 'editorial' | 'validation' | 'review';

const editorialStatusMeta: Record<CaseEditorialStatus, StatusBadgeMeta> = {
  DRAFT: { label: 'Draft', tone: 'neutral' },
  VALIDATING: { label: 'Validating', tone: 'info' },
  VALIDATED: { label: 'Validated', tone: 'info' },
  REVIEW: { label: 'In review', tone: 'warning' },
  NEEDS_EDIT: { label: 'Needs edit', tone: 'danger' },
  APPROVED: { label: 'Approved', tone: 'success' },
  READY_TO_PUBLISH: { label: 'Ready to publish', tone: 'success' },
  PUBLISHED: { label: 'Published', tone: 'success' },
  REJECTED: { label: 'Rejected', tone: 'danger' },
};

const validationOutcomeMeta: Record<ValidationOutcome, StatusBadgeMeta> = {
  PASSED: { label: 'Passed', tone: 'success' },
  FAILED: { label: 'Failed', tone: 'danger' },
  ERROR: { label: 'Error', tone: 'danger' },
};

const reviewDecisionMeta: Record<ReviewDecision, StatusBadgeMeta> = {
  APPROVED: { label: 'Review approved', tone: 'success' },
  NEEDS_EDIT: { label: 'Needs edit', tone: 'warning' },
  REJECTED: { label: 'Review rejected', tone: 'danger' },
};

const fallbackMeta: StatusBadgeMeta = {
  label: 'Unknown',
  tone: 'neutral',
};

function formatStatusLabel(status: string) {
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function getStatusBadgeMeta(
  status: StatusBadgeValue | null | undefined,
  kind?: StatusBadgeKind,
): StatusBadgeMeta {
  if (!status) {
    return fallbackMeta;
  }

  if (kind === 'editorial') {
    return editorialStatusMeta[status as CaseEditorialStatus] ?? {
      label: formatStatusLabel(status),
      tone: fallbackMeta.tone,
    };
  }

  if (kind === 'validation') {
    return validationOutcomeMeta[status as ValidationOutcome] ?? {
      label: formatStatusLabel(status),
      tone: fallbackMeta.tone,
    };
  }

  if (kind === 'review') {
    return reviewDecisionMeta[status as ReviewDecision] ?? {
      label: formatStatusLabel(status),
      tone: fallbackMeta.tone,
    };
  }

  return (
    editorialStatusMeta[status as CaseEditorialStatus] ??
    validationOutcomeMeta[status as ValidationOutcome] ??
    reviewDecisionMeta[status as ReviewDecision] ?? {
      label: formatStatusLabel(status),
      tone: fallbackMeta.tone,
    }
  );
}
