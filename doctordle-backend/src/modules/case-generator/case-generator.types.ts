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
  ambiguitySuitabilityScore: number;
  issues: string[];
  recommendations: string[];
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
    }
  | {
      index: number;
      status: 'failed';
      error: string;
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
};

export type SavedGeneratedCase = Pick<
  PrismaCase,
  'id' | 'title' | 'difficulty' | 'date'
>;
