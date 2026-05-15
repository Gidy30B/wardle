import type {
  GameExplanation,
  GameResult,
  LearnLibraryResponse,
  PublishTrack,
} from "../../game.types";
import type { RoundViewModel } from "../../round.types";
export type LearnTabPageProps = {
  explanation: GameExplanation | null;
  latestResult: GameResult | null;
  latestPlayedExplanation: GameExplanation | null;
  latestPlayedResult: GameResult | null;
  learnLibrary: LearnLibraryResponse | null;
  libraryLoading: boolean;
  libraryError: string | null;
  roundViewModel: RoundViewModel;
};

export type DetailTab = "breakdown" | "differentials" | "clues";

export type LearnPerformanceSummary = {
  accuracyPct: number | null;
  casesDone: number;
  averageCluesUsed: number | null;
  averageTimeSecs: number | null;
  specialties: Array<{
    key: string;
    label: string;
    casesDone: number;
    accuracyPct: number | null;
  }>;
};

export type LearnFilters = {
  specialty: string;
  track: "all" | PublishTrack;
  result: "all" | "solved" | "missed";
  difficulty: string;
};

export type LearnFilterOptions = {
  specialties: LearnPerformanceSummary["specialties"];
  tracks: PublishTrack[];
  difficulties: Array<{ key: string; label: string }>;
};

export type LearnConfidence = "again" | "hard" | "good" | "easy";

export type LearnReviewState = {
  confidence?: LearnConfidence;
  recallAttempts: number;
  recallCorrect: number;
  lastReviewedAt?: string;
  nextReviewAt?: string;
  lastAnswer?: string;
  lastSelectedDiagnosisId?: string;
  lastWasCorrect?: boolean;
};

export type LearnReviewStateByCaseKey = Record<string, LearnReviewState>;


export type RecallAnswerOption = {
  id: string;
  label: string;
  aliases: string[];
  registryId?: string;
  matchKind?: string;
};
