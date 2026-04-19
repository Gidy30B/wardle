import type { RequestJson } from '../../lib/api'
import type {
  ClinicalClue,
  GameCase,
  LeaderboardEntry,
  LeaderboardMode,
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
    gameOver: response.gameOver ?? response.result === 'correct',
    gameOverReason: response.gameOverReason ?? null,
    xpAwarded: response.xpAwarded,
    streakAfter: response.streakAfter,
    explanation: response.explanation ?? null,
    case: response.case ? attachClueIndex(response.case, response.clueIndex) : undefined,
  }
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
    case: attachClueIndex(response.case, response.clueIndex ?? 0),
  }
}

export async function getLeaderboardApi(
  request: RequestJson,
  mode: LeaderboardMode,
): Promise<LeaderboardEntry[]> {
  const endpoint = mode === 'daily' ? '/game/leaderboard/today' : '/game/leaderboard/weekly'
  return request<LeaderboardEntry[]>(`${endpoint}?limit=20`)
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
