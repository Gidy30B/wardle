import {
  DiagnosisMappingMethod,
  DiagnosisMappingStatus,
} from '@prisma/client';

export type MatchedDiagnosisMappingFields = {
  proposedDiagnosisText: string;
  diagnosisMappingStatus: DiagnosisMappingStatus;
  diagnosisMappingMethod: DiagnosisMappingMethod;
  diagnosisMappingConfidence: number;
};

export function buildMatchedDiagnosisMappingFields(input: {
  diagnosisName: string;
  proposedDiagnosisText?: string | null;
  method: DiagnosisMappingMethod;
  confidence?: number;
}): MatchedDiagnosisMappingFields {
  const proposedDiagnosisText = input.proposedDiagnosisText?.trim();

  return {
    proposedDiagnosisText:
      proposedDiagnosisText && proposedDiagnosisText.length > 0
        ? proposedDiagnosisText
        : input.diagnosisName,
    diagnosisMappingStatus: DiagnosisMappingStatus.MATCHED,
    diagnosisMappingMethod: input.method,
    diagnosisMappingConfidence: input.confidence ?? 1,
  };
}

export function determineDiagnosisWriteMappingMethod(input: {
  diagnosisRegistryId?: string | null;
}): DiagnosisMappingMethod {
  return input.diagnosisRegistryId?.trim()
    ? DiagnosisMappingMethod.EDITOR_SELECTED
    : DiagnosisMappingMethod.LEGACY_BACKFILL;
}
