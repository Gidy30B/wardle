export type GuessPayload = {
  sessionId: string
  guess: string
}

export type ClinicalClue = {
  id: string
  type: 'history' | 'symptom' | 'exam' | 'lab' | 'vital' | 'imaging'
  value: string
  order: number
}

export type GameCase = {
  id: string
  clues: ClinicalClue[]
  clueIndex: number
}

export type CaseExplanation = {
  summary: string
  keyPoints: string[]
  reasoning: Array<{
    clueId: string
    explanation: string
  }>
  differentials: Array<{
    diagnosis: string
    whyNot: string
  }>
}

export type StartGameResponse =
  | {
      state: 'ready'
      sessionId: string
      dailyCaseId: string
      case: GameCase
    }
  | {
      state: 'waiting'
      nextCaseAt: string
    }

export type GuessApiResponse = {
  result: 'correct' | 'close' | 'wrong'
  score: number
  isTerminalCorrect: boolean
  attemptsCount?: number
  clueIndex: number
  case?: GameCase
  gameOver?: boolean
  gameOverReason?: 'correct' | 'clues_exhausted' | null
  xpAwarded?: number
  streakAfter?: number
  explanation?: CaseExplanation | null
  feedback?: {
    signals?: {
      exact?: boolean
      synonym?: boolean
      fuzzy?: number
      embedding?: number
      ontology?: {
        score?: number
        reason?: string
      }
    }
    evaluatorVersion?: string
    retrievalMode?: string
  }
}

export type GameResult = {
  score: number
  attemptsCount?: number
  label: 'correct' | 'close' | 'wrong'
  isTerminalCorrect: boolean
  clueIndex: number
  gameOver: boolean
  gameOverReason?: 'correct' | 'clues_exhausted' | null
  xpAwarded?: number
  streakAfter?: number
  explanation?: CaseExplanation | null
  case?: GameCase
}

export type LeaderboardMode = 'daily' | 'weekly'

export type LeaderboardEntry = {
  rank: number
  userId: string
  score: number
  attemptsCount: number
  completedAt: string
}

export type UserLeaderboardPosition = LeaderboardEntry

export type UserProgress = {
  currentStreak: number
  longestStreak: number
  level: number
  rank: string
  xpTotal: number
  xpCurrentLevel: number
  xpToNextLevel: number
}
