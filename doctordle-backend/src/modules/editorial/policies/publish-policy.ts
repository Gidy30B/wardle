import { CaseEditorialStatus } from '@prisma/client';

export const ASSIGNABLE_EDITORIAL_STATUSES = [
  CaseEditorialStatus.APPROVED,
  CaseEditorialStatus.READY_TO_PUBLISH,
] as const;

export const ADMIN_REVIEW_QUEUE_EDITORIAL_STATUSES = [
  CaseEditorialStatus.REVIEW,
  CaseEditorialStatus.NEEDS_EDIT,
  CaseEditorialStatus.VALIDATED,
] as const;

export const ADMIN_PUBLISH_QUEUE_EDITORIAL_STATUSES =
  ASSIGNABLE_EDITORIAL_STATUSES;

export const EDITORIAL_QUEUE_FILTERS = ['all', 'review', 'publish'] as const;

export type EditorialQueueFilter = (typeof EDITORIAL_QUEUE_FILTERS)[number];

const assignableEditorialStatusSet = new Set<CaseEditorialStatus>(
  ASSIGNABLE_EDITORIAL_STATUSES,
);

export function isPublishEligibleEditorialStatus(
  status: CaseEditorialStatus | null | undefined,
): boolean {
  return status ? assignableEditorialStatusSet.has(status) : false;
}

export function getEditorialStatusesForQueue(
  queue?: EditorialQueueFilter,
): readonly CaseEditorialStatus[] | undefined {
  if (!queue || queue === 'all') {
    return undefined;
  }

  if (queue === 'review') {
    return ADMIN_REVIEW_QUEUE_EDITORIAL_STATUSES;
  }

  return ADMIN_PUBLISH_QUEUE_EDITORIAL_STATUSES;
}
