import { Injectable } from '@nestjs/common';
import { ScoringService } from './scoring.service';

type AttemptHistory = {
  result: string;
  clueIndexAtAttempt?: number | null;
};

type ComputeGuessOutcomeInput = {
  attempts: AttemptHistory[];
  semanticScore: number;
  difficulty: string;
  evaluationLabel: 'correct' | 'close' | 'wrong';
  maxClues: number;
};

type GuessOutcome = {
  clueIndex: number;
  attemptsCount: number;
  computedScore: number;
  nextClueIndex: number;
  gameOver: boolean;
  gameOverReason: 'correct' | 'clues_exhausted' | null;
  isTerminalCorrect: boolean;
  shouldRequestReward: boolean;
};

@Injectable()
export class EvaluationService {
  constructor(private readonly scoringService: ScoringService) {}

  getDerivedClueIndex(
    attempts: Array<{
      result: string;
    }>,
    maxClues: number,
  ): number {
    const wrongAttempts = attempts.filter(
      (item) => item.result !== 'correct',
    ).length;
    return Math.min(maxClues, wrongAttempts);
  }

  getClueMismatch(
    attempts: AttemptHistory[],
    maxClues: number,
  ): { expectedFromAudit: number; derivedClueIndex: number } | null {
    const lastAttempt = attempts[attempts.length - 1];
    if (!lastAttempt || lastAttempt.clueIndexAtAttempt == null) {
      return null;
    }

    const derivedClueIndex = this.getDerivedClueIndex(attempts, maxClues);
    const expectedFromAudit =
      lastAttempt.result === 'correct'
        ? lastAttempt.clueIndexAtAttempt
        : Math.min(maxClues, lastAttempt.clueIndexAtAttempt + 1);

    if (expectedFromAudit === derivedClueIndex) {
      return null;
    }

    return {
      expectedFromAudit,
      derivedClueIndex,
    };
  }

  computeGuessOutcome(input: ComputeGuessOutcomeInput): GuessOutcome {
    const clueIndex = this.getDerivedClueIndex(input.attempts, input.maxClues);
    const attemptsCount = input.attempts.length + 1;
    const isCorrect = input.evaluationLabel === 'correct';
    const computedScore = this.scoringService.compute({
      semanticScore: input.semanticScore,
      attemptsCount,
      difficulty: input.difficulty,
      isCorrect,
    });

    const nextWrongAttempts =
      input.attempts.filter((item) => item.result !== 'correct').length +
      (isCorrect ? 0 : 1);
    const cluesExhausted = !isCorrect && nextWrongAttempts >= input.maxClues;
    const gameOverReason: GuessOutcome['gameOverReason'] = isCorrect
      ? 'correct'
      : cluesExhausted
        ? 'clues_exhausted'
        : null;
    const gameOver = gameOverReason !== null;
    const nextClueIndex = gameOver
      ? input.maxClues
      : Math.min(input.maxClues, nextWrongAttempts);

    return {
      clueIndex,
      attemptsCount,
      computedScore,
      nextClueIndex,
      gameOver,
      gameOverReason,
      isTerminalCorrect: gameOverReason === 'correct',
      shouldRequestReward: gameOverReason === 'correct',
    };
  }
}
