import type { RequestJson } from '../../lib/api'
import type {
  ClinicalClue,
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
  const response = await request<{
    sessionId: string
    clueIndex?: number
    case: Omit<StartGameResponse['case'], 'clueIndex'>
  }>('/game/start', {
    method: 'POST',
  })

  return {
    sessionId: response.sessionId,
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
