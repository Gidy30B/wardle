import { IsString, MinLength } from 'class-validator';

export class SubmitGameGuessDto {
  @IsString()
  sessionId!: string;

  @IsString()
  @MinLength(2)
  guess!: string;
}

export type GameplayClinicalClue = {
  id: string;
  type: 'history' | 'symptom' | 'vital' | 'lab' | 'exam' | 'imaging';
  value: string;
  order: number;
};

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
    clues: GameplayClinicalClue[];
  };
  gameOver?: boolean;
  gameOverReason?: 'correct' | 'clues_exhausted' | null;
  explanation?:
    | {
        status: 'ready' | 'processing';
        content?: string;
      }
    | null;
  feedback?: {
    signals?: Record<string, unknown>;
    evaluatorVersion: string;
    retrievalMode: string;
  };
  rewardStatus?: 'processing';
  xpAwarded?: number;
  streakAfter?: number;
};
