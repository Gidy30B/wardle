import type { RequestJson } from '../../lib/api'
import type {
  LeaderboardEntry,
  LeaderboardMode,
  UserLeaderboardPosition,
  GameResult,
  GuessApiResponse,
  GuessPayload,
  StartGameResponse,
  UserProgress,
} from './game.types'

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
    gameOver: response.gameOver ?? response.result === 'correct',
    gameOverReason: response.gameOverReason ?? null,
    explanation: response.explanation ?? null,
    case: response.case,
  }
}

export async function startGameApi(request: RequestJson): Promise<StartGameResponse> {
  return request<StartGameResponse>('/game/start', {
    method: 'POST',
  })
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
  }>('/user/progress')

  return {
    currentStreak: response.currentStreak,
    longestStreak: response.longestStreak ?? response.bestStreak ?? 0,
    level: response.level,
    rank: response.rank,
    xpTotal: response.xpTotal,
  }
}
