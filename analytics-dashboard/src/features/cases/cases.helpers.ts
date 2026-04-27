import type { EditorialQueueFilter } from '../../api/admin';
import type {
  CaseEditorialStatus,
  CaseSource,
  DiagnosisPublishReadinessReason,
  EditorialCaseDetail,
  EditorialCaseListItem,
  EditorialCaseReview,
  EditorialCaseRevision,
  EditorialCaseValidationRun,
  ValidationOutcome,
} from '../../api/admin';

export const editorialStatusOptions: Array<{
  value: CaseEditorialStatus;
  label: string;
}> = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'VALIDATING', label: 'Validating' },
  { value: 'VALIDATED', label: 'Validated' },
  { value: 'REVIEW', label: 'In review' },
  { value: 'NEEDS_EDIT', label: 'Needs edit' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'READY_TO_PUBLISH', label: 'Ready to publish' },
  { value: 'PUBLISHED', label: 'Published' },
  { value: 'REJECTED', label: 'Rejected' },
];

export const queueFilterOptions = [
  { value: 'all', label: 'All queue' },
  { value: 'review', label: 'Review queue' },
  { value: 'publish', label: 'Publish queue' },
] as const;

export const pageSizeOptions = [10, 20, 50] as const;

function getMostRecentTimestamp(...timestamps: Array<string | null | undefined>) {
  return timestamps.filter(Boolean).sort((left, right) =>
    new Date(right as string).getTime() - new Date(left as string).getTime(),
  )[0] ?? null;
}

export function getLatestValidationRun(
  validationRuns: EditorialCaseValidationRun[],
): EditorialCaseValidationRun | null {
  if (validationRuns.length === 0) {
    return null;
  }

  return [...validationRuns].sort((left, right) => {
    const leftTimestamp = getMostRecentTimestamp(left.completedAt, left.startedAt) ?? '';
    const rightTimestamp =
      getMostRecentTimestamp(right.completedAt, right.startedAt) ?? '';

    return new Date(rightTimestamp).getTime() - new Date(leftTimestamp).getTime();
  })[0];
}

export function getLatestReview(
  reviews: EditorialCaseReview[],
): EditorialCaseReview | null {
  if (reviews.length === 0) {
    return null;
  }

  return [...reviews].sort((left, right) => {
    const leftTimestamp = getMostRecentTimestamp(left.decidedAt, left.createdAt) ?? '';
    const rightTimestamp =
      getMostRecentTimestamp(right.decidedAt, right.createdAt) ?? '';

    return new Date(rightTimestamp).getTime() - new Date(leftTimestamp).getTime();
  })[0];
}

export function getEditorialNextStep(status: CaseEditorialStatus | null) {
  switch (status) {
    case 'DRAFT':
      return 'Awaiting validation';
    case 'VALIDATING':
      return 'Validation in progress';
    case 'VALIDATED':
      return 'Ready for editorial review';
    case 'REVIEW':
      return 'Waiting for review decision';
    case 'NEEDS_EDIT':
      return 'Needs editorial changes';
    case 'APPROVED':
      return 'Eligible for assignment';
    case 'READY_TO_PUBLISH':
      return 'Ready for publish queue';
    case 'PUBLISHED':
      return 'Already live';
    case 'REJECTED':
      return 'Rejected from current flow';
    default:
      return 'Waiting for editorial status';
  }
}

export function isPublishReadyStatus(status: CaseEditorialStatus | null | undefined) {
  return status === 'READY_TO_PUBLISH';
}

export function getQueueHeading(queue: EditorialQueueFilter) {
  if (queue === 'publish') {
    return {
      eyebrow: 'Publish queue',
      title: 'Focus on publish-ready cases',
      description:
        'Surface cases that are closest to assignment and publishing inside the existing editorial queue.',
    };
  }

  if (queue === 'review') {
    return {
      eyebrow: 'Review queue',
      title: 'Review cases by workflow state',
      description:
        'Filter the queue by editorial stage and inspect the selected case in the side panel.',
    };
  }

  return {
    eyebrow: 'Editorial queue',
    title: 'Review cases by workflow state',
    description:
      'Filter the queue by editorial stage and inspect the selected case in the side panel.',
  };
}

export function getQueueFocusedNextStep(
  status: CaseEditorialStatus | null,
  queue: EditorialQueueFilter,
) {
  if (queue === 'publish' && status === 'READY_TO_PUBLISH') {
    return 'Ready for publish assignment';
  }

  if (queue === 'publish' && status === 'APPROVED') {
    return 'Approved and nearing publish readiness';
  }

  return getEditorialNextStep(status);
}

export function getPublishReadinessSummary(status: CaseEditorialStatus | null) {
  if (status === 'READY_TO_PUBLISH') {
    return {
      title: 'Publish-ready now',
      description:
        'This case is already marked ready to publish by the backend and should be easy to spot in the queue.',
      tone: 'success' as const,
    };
  }

  if (status === 'APPROVED') {
    return {
      title: 'Close to publish-ready',
      description:
        'This case is approved and may be the next candidate for publish-readiness review.',
      tone: 'info' as const,
    };
  }

  return {
    title: 'Not yet publish-ready',
    description:
      'Keep using the editorial workflow to move this case toward publish readiness.',
    tone: 'neutral' as const,
  };
}

function formatDiagnosisReason(
  reason: DiagnosisPublishReadinessReason | undefined,
) {
  switch (reason) {
    case 'missing_registry_link':
      return 'No registry diagnosis linked yet.';
    case 'mapping_not_publish_ready':
      return 'Diagnosis link exists, but mapping still needs editorial confirmation.';
    case 'registry_not_publishable':
      return 'Linked registry diagnosis is not currently publishable.';
    default:
      return 'Diagnosis standardization still needs editorial work.';
  }
}

export function getDiagnosisWorkflowSummary(
  caseItem: Pick<
    EditorialCaseListItem | EditorialCaseDetail,
    | 'diagnosisRegistryId'
    | 'diagnosisMappingStatus'
    | 'diagnosisMappingMethod'
    | 'diagnosisPublishReadiness'
    | 'diagnosisRegistrySummary'
  >,
) {
  if (caseItem.diagnosisPublishReadiness.ready) {
    return {
      label: 'Diagnosis ready',
      description: 'Linked and publish-ready.',
      tone: 'success' as const,
    };
  }

  if (caseItem.diagnosisRegistryId) {
    return {
      label: 'Linked, needs review',
      description: formatDiagnosisReason(caseItem.diagnosisPublishReadiness.reason),
      tone: 'warning' as const,
    };
  }

  return {
    label: 'Diagnosis unresolved',
    description: formatDiagnosisReason(caseItem.diagnosisPublishReadiness.reason),
    tone: 'danger' as const,
  };
}

export function getValidationTone(outcome: ValidationOutcome | null | undefined) {
  if (outcome === 'PASSED') {
    return 'success';
  }

  if (outcome === 'FAILED') {
    return 'danger';
  }

  if (outcome === 'ERROR') {
    return 'warning';
  }

  return 'neutral';
}

export function formatLabel(value: string | null | undefined) {
  if (!value) {
    return 'Not recorded';
  }

  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function formatSourceLabel(source: CaseSource | null | undefined) {
  return formatLabel(source);
}

export function formatDateLabel(value: string | null | undefined) {
  if (!value) {
    return 'Not recorded';
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function getCaseDisplaySummary(
  caseItem: EditorialCaseListItem | EditorialCaseDetail,
) {
  const latestValidation = getLatestValidationRun(caseItem.validationRuns);
  const latestReview = getLatestReview(caseItem.reviews);

  return {
    latestValidation,
    latestReview,
    nextStep: getEditorialNextStep(caseItem.editorialStatus),
  };
}

export function isCurrentRevision(
  detail: EditorialCaseDetail,
  revision: EditorialCaseRevision,
) {
  return detail.currentRevisionId === revision.id;
}
