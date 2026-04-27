import {
  DiagnosisMappingMethod,
  DiagnosisMappingStatus,
  Prisma,
  ValidationOutcome,
} from '@prisma/client';

export const CASE_VALIDATION_VERSION = 'shadow:v1';

export const validationRuleNames = [
  'structure',
  'clue',
  'differential',
  'explanation',
  'difficulty',
] as const;

export type ValidationRuleName = (typeof validationRuleNames)[number];

export type ValidationSeverity = 'error' | 'warning' | 'info';

export type ValidationIssue = {
  validator: ValidationRuleName;
  severity: ValidationSeverity;
  code: string;
  message: string;
  path?: string;
};

export type ValidatorResult = {
  validator: ValidationRuleName;
  passed: boolean;
  issues: ValidationIssue[];
};

export type ValidationIssueCounts = {
  errors: number;
  warnings: number;
  infos: number;
  total: number;
};

export type ValidationReport = {
  validatorVersion: string;
  outcome: ValidationOutcome;
  issueCounts: ValidationIssueCounts;
  validators: Array<{
    validator: ValidationRuleName;
    passed: boolean;
    issueCounts: ValidationIssueCounts;
  }>;
  issues: ValidationIssue[];
};

export type ValidationPersistencePayload = {
  summary: Prisma.InputJsonValue;
  findings: Prisma.InputJsonValue;
};

export type CaseRevisionSnapshot = {
  caseId: string;
  title: string;
  date: Date;
  difficulty: string;
  history: string;
  symptoms: string[];
  labs: Prisma.JsonValue | null;
  clues: Prisma.JsonValue | null;
  explanation: Prisma.JsonValue | null;
  differentials: string[];
  diagnosisId: string;
  diagnosisRegistryId: string;
  proposedDiagnosisText: string;
  diagnosisMappingStatus: DiagnosisMappingStatus;
  diagnosisMappingMethod: DiagnosisMappingMethod;
  diagnosisMappingConfidence: number | null;
  diagnosisEditorialNote: string | null;
};

export type ValidationClinicalClue = {
  type: 'history' | 'symptom' | 'vital' | 'lab' | 'exam' | 'imaging';
  value: string;
  order: number;
};

export type ValidationExplanation = {
  diagnosis: string;
  summary: string;
  reasoning: string[];
  keyFindings: string[];
};

export type CreatedRevisionResult = {
  status: 'created';
  revisionId: string;
  revisionNumber: number;
  snapshot: CaseRevisionSnapshot;
};

export type SkippedRevisionResult = {
  status: 'skipped';
  reason: 'generated_event_already_processed';
  existingRevisionId: string;
  existingValidationRunId: string;
};

export type CreateRevisionResult =
  | CreatedRevisionResult
  | SkippedRevisionResult;

export type ShadowValidationResult =
  | {
      status: 'created';
      caseId: string;
      revisionId: string;
      revisionNumber: number;
      validationRunId: string;
      outcome: ValidationOutcome;
      issueCounts: ValidationIssueCounts;
    }
  | {
      status: 'skipped';
      caseId: string;
      reason: 'generated_event_already_processed';
      existingRevisionId: string;
      existingValidationRunId: string;
    };
