export type EvaluationSignals = {
  exact?: boolean;
  synonym?: boolean;
  fuzzy?: number;
  embedding?: number;
  registryCorrectnessAuthority?: boolean;
  retrievalMode?: 'vector' | 'fallback' | 'selected-id-only';
  expectedDiagnosisRegistryId?: string;
  expectedDiagnosisUsable?: boolean;
  expectedDiagnosisStatus?: string;
  submittedDiagnosisRegistryId?: string;
  resolvedDiagnosisRegistryId?: string;
  matchedAliasId?: string;
  matchedAliasTerm?: string;
  diagnosisResolutionMethod?: string;
  diagnosisResolutionReason?: string;
  ontology?: {
    score: number;
    reason: string;
  };
};

export type EvaluationLabel = 'correct' | 'close' | 'wrong';

export type EvaluationResult = {
  score: number;
  label: EvaluationLabel;
  signals: EvaluationSignals;
  normalizedGuess?: string;
  evaluatorVersion?: string;
  retrievalMode?: 'vector' | 'fallback' | 'selected-id-only';
};
