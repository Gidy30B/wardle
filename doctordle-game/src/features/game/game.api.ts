import type { RequestJson } from '../../lib/api'
import type { DiagnosisDictionary } from './diagnosisRegistry.types'
import type {
  ClinicalClue,
  GameCase,
  LeaderboardEntry,
  LeaderboardMode,
  LearnLibraryResponse,
  TodayCasesResponse,
  UserLeaderboardPosition,
  GameResult,
  GuessApiResponse,
  GuessPayload,
  StartGameResponse,
  UserProgress,
} from './game.types'

function attachClueIndex<T extends { clues: ClinicalClue[] }>(
  gameCase: T,
  clueIndex: number,
): T & { clueIndex: number } {
  return {
    ...gameCase,
    clueIndex,
  }
}

export async function submitGuessApi(
  request: RequestJson,
  payload: GuessPayload,
): Promise<GameResult> {
  const response = await request<GuessApiResponse>('/game/guess', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  return {
    score: response.score,
    attemptsCount: response.attemptsCount,
    label: response.result,
    isTerminalCorrect: response.isTerminalCorrect,
    clueIndex: response.clueIndex,
    startedAt: response.startedAt,
    completedAt: response.completedAt ?? null,
    gameOver: response.gameOver ?? response.result === 'correct',
    gameOverReason: response.gameOverReason ?? null,
    xpAwarded: response.xpAwarded,
    streakAfter: response.streakAfter,
    explanation: response.explanation ?? null,
    case: response.case ? attachClueIndex(response.case, response.clueIndex) : undefined,
  }
}

export async function getDiagnosisDictionaryApi(
  request: RequestJson,
): Promise<DiagnosisDictionary> {
  return request<DiagnosisDictionary>('/diagnosis-registry/dictionary')
}

export async function startGameApi(request: RequestJson): Promise<StartGameResponse> {
  const response = await request<
    | {
        state: 'waiting'
        nextCaseAt: string
      }
    | {
        state?: 'ready'
        sessionId: string
        dailyCaseId: string
        casePublicNumber?: number | null
        displayLabel?: string
        trackDisplayLabel?: string
        startedAt?: string
        completedAt?: string | null
        clueIndex?: number
        case: Omit<GameCase, 'clueIndex'>
      }
  >('/game/start', {
    method: 'POST',
  })

  if (response.state === 'waiting') {
    return {
      state: 'waiting',
      nextCaseAt: response.nextCaseAt ?? new Date().toISOString(),
    }
  }

  if (!response.sessionId || !response.case) {
    throw new Error('Invalid start game response')
  }

  return {
    state: 'ready',
    sessionId: response.sessionId,
    dailyCaseId: response.dailyCaseId,
    casePublicNumber: response.casePublicNumber ?? response.case.casePublicNumber ?? null,
    displayLabel: response.displayLabel ?? response.case.displayLabel,
    trackDisplayLabel: response.trackDisplayLabel ?? response.case.trackDisplayLabel,
    startedAt: response.startedAt,
    completedAt: response.completedAt ?? null,
    case: attachClueIndex(response.case, response.clueIndex ?? 0),
  }
}

export async function getTodayCasesApi(
  request: RequestJson,
): Promise<TodayCasesResponse> {
  return request<TodayCasesResponse>('/game/today')
}

export async function getLearnLibraryApi(
  request: RequestJson,
): Promise<LearnLibraryResponse> {
  return request<LearnLibraryResponse>('/game/learn')
}

export async function getLeaderboardApi(
  request: RequestJson,
  mode: LeaderboardMode,
): Promise<LeaderboardEntry[]> {
  const endpoint = mode === 'daily' ? '/game/leaderboard/today' : '/game/leaderboard/weekly'
  const payload = await request<
    LeaderboardEntry[] | { leaderboard?: LeaderboardEntry[]; entries?: LeaderboardEntry[] }
  >(`${endpoint}?limit=20`)

  if (Array.isArray(payload)) {
    return payload
  }

  if (Array.isArray(payload.leaderboard)) {
    return payload.leaderboard
  }

  return Array.isArray(payload.entries) ? payload.entries : []
}

export async function getCurrentUserLeaderboardPositionApi(
  request: RequestJson,
  mode: LeaderboardMode,
): Promise<UserLeaderboardPosition | null> {
  return request<UserLeaderboardPosition | null>(`/game/leaderboard/me?mode=${mode}`)
}

export async function getUserProgressApi(request: RequestJson): Promise<UserProgress> {
  const response = await request<{
    currentStreak: number
    bestStreak?: number
    longestStreak?: number
    level: number
    rank: string
    xpTotal: number
    xpCurrentLevel?: number
    xpToNextLevel?: number
  }>('/user/progress')

  return {
    currentStreak: response.currentStreak,
    longestStreak: response.longestStreak ?? response.bestStreak ?? 0,
    level: response.level,
    rank: response.rank,
    xpTotal: response.xpTotal,
    xpCurrentLevel: response.xpCurrentLevel ?? 0,
    xpToNextLevel: response.xpToNextLevel ?? 1,
  }
}
