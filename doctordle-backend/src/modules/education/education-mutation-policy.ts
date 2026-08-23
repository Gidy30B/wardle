import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { DiagnosisEducationStatus } from '@prisma/client';

export const EDUCATION_STALE_CONFLICT_MESSAGE =
  'Education changed since this view was loaded. Refresh before continuing.';

const AUTHORITY_INVALIDATING_STATUSES = new Set<DiagnosisEducationStatus>([
  DiagnosisEducationStatus.APPROVED,
  DiagnosisEducationStatus.PUBLISHED,
]);

export function statusAfterEducationContentMutation(
  currentStatus: DiagnosisEducationStatus,
): DiagnosisEducationStatus {
  if (AUTHORITY_INVALIDATING_STATUSES.has(currentStatus)) {
    return DiagnosisEducationStatus.NEEDS_REVIEW;
  }

  return currentStatus;
}

export function publishedAtAfterEducationContentMutation(input: {
  currentStatus: DiagnosisEducationStatus;
  currentPublishedAt: Date | null;
}): Date | null {
  return input.currentStatus === DiagnosisEducationStatus.PUBLISHED
    ? null
    : input.currentPublishedAt;
}

export function assertExpectedEducationVersion(input: {
  expectedVersion: number | undefined;
  currentVersion: number;
}) {
  if (!Number.isInteger(input.expectedVersion)) {
    throw new BadRequestException(
      'expectedVersion is required for existing diagnosis education',
    );
  }

  if (input.expectedVersion !== input.currentVersion) {
    throw new ConflictException(EDUCATION_STALE_CONFLICT_MESSAGE);
  }
}

export function throwStaleEducationConflict(): never {
  throw new ConflictException(EDUCATION_STALE_CONFLICT_MESSAGE);
}
