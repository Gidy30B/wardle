export type EvaluationSignals = {
  exact?: boolean;
  synonym?: boolean;
  fuzzy?: number;
  embedding?: number;
  retrievalMode?: 'vector' | 'fallback';
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
  retrievalMode?: 'vector' | 'fallback';
};
