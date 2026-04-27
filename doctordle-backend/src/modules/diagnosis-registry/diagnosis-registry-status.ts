import { DiagnosisRegistryStatus } from '@prisma/client';

export function isDiagnosisRegistryUsableStatus(
  status: DiagnosisRegistryStatus,
): boolean {
  return status === DiagnosisRegistryStatus.ACTIVE;
}

export function isDiagnosisRegistryVisibleForDictionaryStatus(
  status: DiagnosisRegistryStatus,
): boolean {
  return status === DiagnosisRegistryStatus.ACTIVE;
}

export function getDiagnosisRegistryCompatibilityActive(
  status: DiagnosisRegistryStatus,
): boolean {
  return isDiagnosisRegistryUsableStatus(status);
}

export function buildDiagnosisRegistryStatusPatch(
  status: DiagnosisRegistryStatus,
): {
  status: DiagnosisRegistryStatus;
  active: boolean;
} {
  return {
    status,
    active: getDiagnosisRegistryCompatibilityActive(status),
  };
}

export function getDiagnosisRegistryLifecycle(status: DiagnosisRegistryStatus) {
  return {
    status,
    usable: isDiagnosisRegistryUsableStatus(status),
    visibleForDictionary: isDiagnosisRegistryVisibleForDictionaryStatus(status),
    hidden: status === DiagnosisRegistryStatus.HIDDEN,
    deprecated: status === DiagnosisRegistryStatus.DEPRECATED,
    draft: status === DiagnosisRegistryStatus.DRAFT,
  };
}

export function getUsableDiagnosisRegistryWhere() {
  return {
    status: DiagnosisRegistryStatus.ACTIVE,
  } as const;
}

export function getDictionaryVisibleDiagnosisRegistryWhere() {
  return {
    status: DiagnosisRegistryStatus.ACTIVE,
  } as const;
}
