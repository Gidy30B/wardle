import { Injectable } from '@nestjs/common';
import { EvaluatorEngineService } from './evaluator-engine.service';
import { EvaluationResult } from './types';

@Injectable()
export class EvaluatorApiService {
  constructor(private readonly evaluatorEngineService: EvaluatorEngineService) {}

  evaluateGuessAdvisory(guess: string, answer: string): Promise<EvaluationResult> {
    return this.evaluatorEngineService.evaluateAdvisoryFeedback(guess, answer);
  }

  evaluateGuess(guess: string, answer: string): Promise<EvaluationResult> {
    return this.evaluateGuessAdvisory(guess, answer);
  }
}
