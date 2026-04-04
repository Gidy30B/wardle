import { Injectable } from '@nestjs/common';
import { SynonymService } from '../../knowledge/synonym.service';
import { preprocess } from '../pipeline/preprocess';
import { fuzzySimilarity } from '../services/fuzzy';
import { mapLabel } from '../services/score';
import { EvaluationResult } from '../services/types';

@Injectable()
export class EvaluatorV1Service {
  constructor(private readonly synonymService: SynonymService) {}

  async evaluate(guess: string, answer: string): Promise<EvaluationResult> {
    const normalizedGuess = await preprocess(guess);
    const normalizedAnswer = await preprocess(answer);

    const exact = normalizedGuess === normalizedAnswer;
    const synonym = this.synonymService.isExact(normalizedGuess, normalizedAnswer);
    const fuzzy = fuzzySimilarity(normalizedGuess, normalizedAnswer);
    const score = exact ? 1 : synonym ? 0.9 : fuzzy * 0.7;

    return {
      score,
      label: mapLabel(score),
      signals: {
        exact,
        synonym,
        fuzzy,
      },
      normalizedGuess,
      evaluatorVersion: 'v1',
    };
  }
}
