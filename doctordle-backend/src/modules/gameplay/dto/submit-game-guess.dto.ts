import { IsOptional, IsString } from 'class-validator';

export class SubmitGameGuessDto {
  @IsString()
  sessionId!: string;

  @IsString()
  diagnosisRegistryId!: string;

  @IsOptional()
  @IsString()
  guess?: string;
}

export type GameplayClinicalClue = {
  id: string;
  type: 'history' | 'symptom' | 'vital' | 'lab' | 'exam' | 'imaging';
  value: string;
  order: number;
};

export type GameplayCaseExplanation = {
  summary?: string | null;
  keyFindings?: string[] | null;
  reasoning?: string | null;
  differentials?: string[] | null;
};

export type SubmitGameGuessResponseDto = {
  result: 'correct' | 'close' | 'wrong';
  score: number;
  attemptsCount: number;
  clueIndex: number;
  isTerminalCorrect: boolean;
  startedAt?: string;
  completedAt?: string | null;
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
  explanation?: GameplayCaseExplanation | null;
  feedback?: {
    signals?: Record<string, unknown>;
    evaluatorVersion: string;
    retrievalMode: string;
  };
  rewardStatus?: 'processing';
  xpAwarded?: number;
  streakAfter?: number;
};
