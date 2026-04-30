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
  };
};

export type CaseGenerationCritique = {
  passed: boolean;
  score: number;
  clinicalAccuracyScore: number;
  clueProgressionScore: number;
  differentialQualityScore: number;
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
  difficulty?: string;
  concurrency?: number;
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
      reason: 'duplicate_answer';
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
  created: number;
  skipped: number;
  failed: number;
  results: BatchGeneratedCaseResult[];
};

export type SavedGeneratedCase = Pick<
  PrismaCase,
  'id' | 'title' | 'difficulty' | 'date'
>;
