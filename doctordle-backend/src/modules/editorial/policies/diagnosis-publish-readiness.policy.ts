import {
  DiagnosisMappingStatus,
  type DiagnosisRegistryStatus,
} from '@prisma/client';
import { isDiagnosisRegistryUsableStatus } from '../../diagnosis-registry/diagnosis-registry-status.js';

export type DiagnosisPublishReadinessReason =
  | 'missing_registry_link'
  | 'mapping_not_publish_ready'
  | 'registry_not_publishable';

export type DiagnosisPublishReadinessInput = {
  diagnosisRegistryId?: string | null;
  diagnosisMappingStatus?: DiagnosisMappingStatus | null;
  diagnosisRegistryStatus?: DiagnosisRegistryStatus | null;
};

export function isDiagnosisMappingStatusPublishReady(
  status: DiagnosisMappingStatus | null | undefined,
): boolean {
  return status === DiagnosisMappingStatus.MATCHED;
}

export function getCaseDiagnosisPublishReadiness(
  input: DiagnosisPublishReadinessInput,
): {
  ready: boolean;
  reason?: DiagnosisPublishReadinessReason;
} {
  if (!input.diagnosisRegistryId) {
    return {
      ready: false,
      reason: 'missing_registry_link',
    };
  }

  if (!isDiagnosisMappingStatusPublishReady(input.diagnosisMappingStatus)) {
    return {
      ready: false,
      reason: 'mapping_not_publish_ready',
    };
  }

  if (
    input.diagnosisRegistryStatus &&
    !isDiagnosisRegistryUsableStatus(input.diagnosisRegistryStatus)
  ) {
    return {
      ready: false,
      reason: 'registry_not_publishable',
    };
  }

  return {
    ready: true,
  };
}

export function isCaseDiagnosisReadyForPublish(
  input: DiagnosisPublishReadinessInput,
): boolean {
  return getCaseDiagnosisPublishReadiness(input).ready;
}
