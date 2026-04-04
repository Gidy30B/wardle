import { EvaluationLabel, EvaluationSignals } from './types';
import { getEnv } from '../../../core/config/env.validation';

type ScoreWeights = {
  exactWeight: number;
  synonymWeight: number;
  fuzzyWeight: number;
  embeddingWeight: number;
  ontologyWeight: number;
};

const env = getEnv();

const defaultWeights: ScoreWeights = {
  exactWeight: env.SCORE_WEIGHT_EXACT,
  synonymWeight: env.SCORE_WEIGHT_SYNONYM,
  fuzzyWeight: env.SCORE_WEIGHT_FUZZY,
  embeddingWeight: env.SCORE_WEIGHT_EMBEDDING,
  ontologyWeight: env.SCORE_WEIGHT_ONTOLOGY,
};

export function computeScore(signals: EvaluationSignals): number {
  const ontologyScore = signals.ontology?.score ?? 0;

  return (
    (signals.exact ? 1 : 0) * defaultWeights.exactWeight +
    (signals.synonym ? 1 : 0) * defaultWeights.synonymWeight +
    (signals.fuzzy ?? 0) * defaultWeights.fuzzyWeight +
    (signals.embedding ?? 0) * defaultWeights.embeddingWeight +
    ontologyScore * defaultWeights.ontologyWeight
  );
}

export function mapLabel(score: number): EvaluationLabel {
  if (score > 0.85) {
    return 'correct';
  }

  if (score > 0.65) {
    return 'close';
  }

  return 'wrong';
}
