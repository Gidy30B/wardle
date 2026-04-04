import { Injectable } from '@nestjs/common';
import { EvaluatorV1Service } from '../v1/evaluator-v1.service';
import { EvaluatorV2Service } from '../v2/evaluator-v2.service';
import { EvaluationResult } from './types';
import { getEnv } from '../../../core/config/env.validation';

@Injectable()
export class EvaluatorEngineService {
  constructor(
    private readonly evaluatorV1Service: EvaluatorV1Service,
    private readonly evaluatorV2Service: EvaluatorV2Service,
  ) {}

  evaluate(guess: string, answer: string): Promise<EvaluationResult> {
    const version = getEnv().EVALUATOR_VERSION.toLowerCase();

    if (version === 'v1') {
      return this.evaluatorV1Service.evaluate(guess, answer);
    }

    return this.evaluatorV2Service.evaluate(guess, answer);
  }
}
