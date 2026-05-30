import type { Case as PrismaCase } from '@prisma/client';

export type ClinicalClue = {
  type: 'history' | 'symptom' | 'vital' | 'lab' | 'exam' | 'imaging';
  value: string;
  order: number;
};

export type GeneratedCase = {
  clues: ClinicalClue[];
  answer: string;
  differentials: string[];
  explanation: {
    diagnosis: string;
    summary: string;
    reasoning: string[];
    keyFindings: string[];
    differentialAnalysis: Array<{
      diagnosis: string;
      whyPlausibleEarly: string;
      ruledOutByClues: Array<{
        clueOrder: number;
        evidence: string;
        reason: string;
      }>;
      finalReasonLessLikely: string;
    }>;
  };
};

export type CaseGenerationCritique = {
  passed: boolean;
  score: number;
  clinicalAccuracyScore: number;
  clueProgressionScore: number;
  differentialQualityScore: number;
  differentialRuleOutScore: number;
  differentialPlausibilityScore: number;
  differentialDiscriminationScore: number;
  clinicalEdgeValidityScore: number;
  invalidReasoningEdges: Array<{
    differential: string;
    clueOrder: number;
    evidence: string;
    claimedEffect: 'weakens' | 'rules_out';
    verdict: 'valid' | 'weak_or_neutral' | 'backwards' | 'unsupported';
    issue: string;
  }>;
  educationalValueScore: number;
  graphConsistencyScore: number;
  ambiguitySuitabilityScore: number;
  issues: string[];
  recommendations: string[];
};

export type DifferentialPreflightCategory =
  | 'competing_diagnosis'
  | 'subtype'
  | 'cause_mechanism'
  | 'complication'
  | 'severity_label'
  | 'synonym_or_alias'
  | 'broadly_related_only';

export type DifferentialPreflightVerdict = 'valid' | 'weak' | 'invalid';

export type DifferentialPreflightCritique = {
  passed: boolean;
  score: number;
  issues: string[];
  recommendations: string[];
  assessments: Array<{
    diagnosis: string;
    category: DifferentialPreflightCategory;
    plausibleFromClues0To2: boolean;
    fitsDemographics: boolean;
    fitsTimelineAcuitySetting: boolean;
    sharesEarlyFeatures: boolean;
    separableByLaterClues: boolean;
    verdict: DifferentialPreflightVerdict;
    issue: string | null;
  }>;
};

export type GenerateCaseInput = {
  track?: string;
  difficulty?: string;
  batchId?: string;
  sequence?: number;
};

export type SaveGeneratedCaseOptions = {
  track?: string;
  difficulty?: string;
  seenAnswers?: Set<string>;
  skipExistingAnswerCheck?: boolean;
};

export type GenerateBatchOptions = {
  count: number;
  track?: string;
  bodySystem?: string;
  difficulty?: string;
  concurrency?: number;
  registryFirst?: boolean;
};

export type CaseGenerationFailureCategory =
  | 'objective_detail'
  | 'demographic_incompatible_differential'
  | 'answer_leakage'
  | 'differential_preflight'
  | 'differential_grounding'
  | 'full_critique'
  | 'registry_target_mismatch'
  | 'duplicate_answer'
  | 'duplicate_scenario'
  | 'low_quality'
  | 'specialty_cluster'
  | 'difficulty_balance'
  | 'connection_error'
  | 'openai_empty_response'
  | 'json_parse'
  | 'schema_invalid'
  | 'unknown';

export type CaseGenerationFailureSample = {
  index: number;
  answer?: string | null;
  plannerDiagnosis?: string | null;
  category: CaseGenerationFailureCategory;
  message: string;
  attempt?: number;
};

export type CaseGenerationFailureSummary = {
  byCategory: Record<CaseGenerationFailureCategory, number>;
  samples: CaseGenerationFailureSample[];
};

export type PlannedGenerationDiagnosis = {
  diagnosisRegistryId: string;
  legacyDiagnosisId: string | null;
  displayLabel: string;
  canonicalName: string;
  acceptedAliases: string[];
  specialty: string | null;
  category: string | null;
  bodySystem: string | null;
  difficultyBand: string | null;
  existingCaseCount: number;
  lastGeneratedAt: Date | null;
  recentUsePenaltyApplied: boolean;
};

export type PlannerDiagnosisComparison = {
  aiAnswer: string | null;
  normalizedAiAnswer: string | null;
  normalizedPlannerDiagnosis: string;
  matchesPlanner: boolean | null;
};

export type PlannerSelectionDiagnostics = {
  candidateCount: number;
  unusedCandidateCount: number;
  repeatedCandidateCount: number;
  selectedUnusedCount: number;
  selectedRepeatCount: number;
  repeatReason: string | null;
  existingCaseCountByDiagnosis: Record<string, number>;
  recentUsePenaltyApplied: boolean;
};

export type PlannedGenerationSlot = {
  batchId: string;
  index: number;
  diagnosis: PlannedGenerationDiagnosis | null;
  duplicatePrevented: boolean;
  selectionStatus: 'selected' | 'unavailable';
  repeatReason: string | null;
  existingCaseCount: number | null;
  recentUsePenaltyApplied: boolean;
  diagnostics: PlannerSelectionDiagnostics;
  comparison?: PlannerDiagnosisComparison;
};

export type BatchGeneratedCaseResult =
  | {
      index: number;
      status: 'created';
      caseId: string;
      answer: string;
    }
  | {
      index: number;
      status: 'skipped';
      reason:
        | 'duplicate_answer'
        | 'duplicate_scenario'
        | 'low_quality'
        | 'specialty_cluster'
        | 'difficulty_balance';
      answer: string;
      failureCategory?: CaseGenerationFailureCategory;
    }
  | {
      index: number;
      status: 'failed';
      error: string;
      failureCategory?: CaseGenerationFailureCategory;
    };

export type GenerateBatchResult = {
  batchId: string;
  requested: number;
  generated: number;
  accepted: number;
  rejected: number;
  created: number;
  skipped: number;
  failed: number;
  averageQualityScore: number | null;
  plannerDiagnostics: PlannedGenerationSlot[];
  results: BatchGeneratedCaseResult[];
  failureSummary?: CaseGenerationFailureSummary;
};

export type SavedGeneratedCase = Pick<
  PrismaCase,
  'id' | 'title' | 'difficulty' | 'date'
>;
