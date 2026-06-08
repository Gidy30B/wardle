import type { RequestJson } from "../../lib/api";
import type {
  DiagnosisDictionary,
  DiagnosisRegistryVersion,
} from "./diagnosisRegistry.types";
import type {
  ClinicalClue,
  GameCase,
  LeaderboardEntry,
  LeaderboardMode,
  LearnLibraryResponse,
  DiagnosisEducation,
  TodayCasesResponse,
  UserLeaderboardPosition,
  GameExplanation,
  GameResult,
  GuessApiResponse,
  GuessPayload,
  StartGameResponse,
  UserProgress,
} from "./game.types";

function attachClueIndex<T extends { clues: ClinicalClue[] }>(
  gameCase: T,
  clueIndex: number,
): T & { clueIndex: number } {
  return {
    ...gameCase,
    clueIndex,
  };
}

function hydrateStartGameCaseMetadata<T extends Omit<GameCase, "clueIndex">>(
  gameCase: T,
  metadata: {
    casePublicNumber?: number | null;
    displayLabel?: string;
    trackDisplayLabel?: string;
  },
): T {
  return {
    ...gameCase,
    casePublicNumber:
      metadata.casePublicNumber ?? gameCase.casePublicNumber ?? null,
    displayLabel: metadata.displayLabel ?? gameCase.displayLabel,
    trackDisplayLabel: metadata.trackDisplayLabel ?? gameCase.trackDisplayLabel,
  };
}

export async function submitGuessApi(
  request: RequestJson,
  payload: GuessPayload,
): Promise<GameResult> {
  if (import.meta.env.DEV) {
    performance.mark?.("game-guess:start");
    console.debug("[game-guess] submit start");
  }

  const response = await request<GuessApiResponse>("/game/guess", {
    method: "POST",
    body: JSON.stringify(payload),
  }).finally(() => {
    if (import.meta.env.DEV) {
      performance.mark?.("game-guess:end");
      performance.measure?.("game-guess", "game-guess:start", "game-guess:end");
      console.debug("[game-guess] submit end");
    }
  });

  return {
    score: response.score,
    attemptsCount: response.attemptsCount,
    label: response.result,
    isTerminalCorrect: response.isTerminalCorrect,
    clueIndex: response.clueIndex,
    startedAt: response.startedAt,
    completedAt: response.completedAt ?? null,
    gameOver: response.gameOver ?? response.result === "correct",
    gameOverReason: response.gameOverReason ?? null,
    xpAwarded: response.xpAwarded,
    streakAfter: response.streakAfter,
    explanation: response.explanation ?? null,
    case: response.case
      ? attachClueIndex(response.case, response.clueIndex)
      : undefined,
  };
}

export async function getDiagnosisDictionaryApi(
  request: RequestJson,
): Promise<DiagnosisDictionary> {
  return request<DiagnosisDictionary>("/diagnosis-registry/dictionary");
}

export async function getDiagnosisRegistryVersionApi(
  request: RequestJson,
): Promise<DiagnosisRegistryVersion> {
  return request<DiagnosisRegistryVersion>("/diagnosis-registry/version");
}

export async function startGameApi(
  request: RequestJson,
): Promise<StartGameResponse> {
  const response = await request<
    | {
        state: "waiting";
        nextCaseAt: string;
      }
    | {
        state: "completed";
        sessionId: string;
        dailyCaseId: string;
        casePublicNumber?: number | null;
        displayLabel?: string;
        trackDisplayLabel?: string;
        startedAt: string;
        completedAt: string;
        clueIndex: number;
        attemptsCount: number;
        attempts: Array<{
          guess: string;
          result: "correct" | "close" | "wrong";
          score: number;
          clueIndexAtAttempt?: number | null;
        }>;
        score: number;
        gameOver: true;
        gameOverReason: "correct" | "clues_exhausted";
        explanation?: GameExplanation | null;
        nextCaseAt: string;
        case: Omit<GameCase, "clueIndex">;
      }
    | {
        state?: "ready";
        sessionId: string;
        dailyCaseId: string;
        casePublicNumber?: number | null;
        displayLabel?: string;
        trackDisplayLabel?: string;
        startedAt?: string;
        completedAt?: string | null;
        clueIndex?: number;
        case: Omit<GameCase, "clueIndex">;
      }
  >("/game/start", {
    method: "POST",
  });

  if (response.state === "waiting") {
    return {
      state: "waiting",
      nextCaseAt: response.nextCaseAt ?? new Date().toISOString(),
    };
  }

  if (response.state === "completed") {
    const hydratedCase = hydrateStartGameCaseMetadata(response.case, {
      casePublicNumber: response.casePublicNumber,
      displayLabel: response.displayLabel,
      trackDisplayLabel: response.trackDisplayLabel,
    });

    return {
      state: "completed",
      sessionId: response.sessionId,
      dailyCaseId: response.dailyCaseId,
      casePublicNumber: hydratedCase.casePublicNumber,
      displayLabel: hydratedCase.displayLabel,
      trackDisplayLabel: hydratedCase.trackDisplayLabel,
      startedAt: response.startedAt,
      completedAt: response.completedAt,
      clueIndex: response.clueIndex,
      attemptsCount: response.attemptsCount,
      attempts: response.attempts,
      score: response.score,
      gameOver: true,
      gameOverReason: response.gameOverReason,
      explanation: response.explanation ?? null,
      nextCaseAt: response.nextCaseAt,
      case: attachClueIndex(hydratedCase, response.clueIndex),
    };
  }

  if (!response.sessionId || !response.case) {
    throw new Error("Invalid start game response");
  }

  const hydratedCase = hydrateStartGameCaseMetadata(response.case, {
    casePublicNumber: response.casePublicNumber,
    displayLabel: response.displayLabel,
    trackDisplayLabel: response.trackDisplayLabel,
  });

  return {
    state: "ready",
    sessionId: response.sessionId,
    dailyCaseId: response.dailyCaseId,
    casePublicNumber: hydratedCase.casePublicNumber,
    displayLabel: hydratedCase.displayLabel,
    trackDisplayLabel: hydratedCase.trackDisplayLabel,
    startedAt: response.startedAt,
    completedAt: response.completedAt ?? null,
    case: attachClueIndex(hydratedCase, response.clueIndex ?? 0),
  };
}

export async function getTodayCasesApi(
  request: RequestJson,
): Promise<TodayCasesResponse> {
  return request<TodayCasesResponse>("/game/today");
}

export async function getLearnLibraryApi(
  request: RequestJson,
): Promise<LearnLibraryResponse> {
  return request<LearnLibraryResponse>("/game/learn");
}

export async function getDiagnosisEducationApi(
  request: RequestJson,
  diagnosisRegistryId: string,
): Promise<DiagnosisEducation> {
  return request<DiagnosisEducation>(
    `/education/diagnoses/${diagnosisRegistryId}`,
  );
}

export async function getLeaderboardApi(
  request: RequestJson,
  mode: LeaderboardMode,
): Promise<LeaderboardEntry[]> {
  const endpoint =
    mode === "daily" ? "/game/leaderboard/today" : "/game/leaderboard/weekly";
  const payload = await request<
    | LeaderboardEntry[]
    | { leaderboard?: LeaderboardEntry[]; entries?: LeaderboardEntry[] }
  >(`${endpoint}?limit=20`);

  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload.leaderboard)) {
    return payload.leaderboard;
  }

  return Array.isArray(payload.entries) ? payload.entries : [];
}

export async function getCurrentUserLeaderboardPositionApi(
  request: RequestJson,
  mode: LeaderboardMode,
): Promise<UserLeaderboardPosition | null> {
  return request<UserLeaderboardPosition | null>(
    `/game/leaderboard/me?mode=${mode}`,
  );
}

export async function getUserProgressApi(
  request: RequestJson,
): Promise<UserProgress> {
  const response = await request<{
    currentStreak: number;
    bestStreak?: number;
    longestStreak?: number;
    level: number;
    rank: string;
    xpTotal: number;
    xpCurrentLevel?: number;
    xpToNextLevel?: number;
  }>("/user/progress");

  return {
    currentStreak: response.currentStreak,
    longestStreak: response.longestStreak ?? response.bestStreak ?? 0,
    level: response.level,
    rank: response.rank,
    xpTotal: response.xpTotal,
    xpCurrentLevel: response.xpCurrentLevel ?? 0,
    xpToNextLevel: response.xpToNextLevel ?? 1,
  };
}
