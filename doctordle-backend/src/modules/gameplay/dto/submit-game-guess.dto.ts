import { IsString, MinLength } from 'class-validator';

export class SubmitGameGuessDto {
  @IsString()
  sessionId!: string;

  @IsString()
  @MinLength(2)
  guess!: string;
}

export type SubmitGameGuessResponseDto = {
  result: 'correct' | 'close' | 'wrong';
  score: number;
  attemptsCount: number;
  clueIndex: number;
  isTerminalCorrect: boolean;
  semanticScore?: number;
  duplicate?: boolean;
  case?: {
    id: string;
    difficulty: string;
    date: string;
    history: string;
    symptoms: string[];
  };
  gameOver?: boolean;
  gameOverReason?: 'correct' | 'clues_exhausted' | null;
  explanation?: Record<string, unknown> | null;
  feedback?: {
    signals?: Record<string, unknown>;
    evaluatorVersion: string;
    retrievalMode: string;
  };
  xpAwarded?: number;
  streakAfter?: number;
};
