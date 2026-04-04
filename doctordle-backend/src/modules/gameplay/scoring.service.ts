import { Injectable } from '@nestjs/common';

export type ScoreContext = {
  semanticScore: number;
  attemptsCount: number;
  difficulty: string;
  isCorrect: boolean;
};

@Injectable()
export class ScoringService {
  private readonly maxScore = 100;
  private readonly minScore = 10;
  private readonly attemptPenalty = 15;

  compute(context: ScoreContext): number {
    const semanticScore = Math.max(0, Math.min(1, context.semanticScore));
    const attempts = Math.max(1, context.attemptsCount);
    const penalty = (attempts - 1) * this.attemptPenalty;

    let score = semanticScore * this.maxScore;

    if (context.isCorrect && attempts === 1) {
      score += 20;
    }

    score -= penalty;
    score = Math.max(this.minScore, Math.min(this.maxScore, score));

    return Math.round(score);
  }
}
