export type GuessPayload = {
  sessionId: string
  guess: string
}

export type GameCase = {
  id: string
  symptoms: string[]
  history: string
  difficulty?: string
  date?: string
}

export type CaseExplanation = {
  diagnosis: string
  difficulty: string
  summary: string
  reasoning: string[]
  deepDive?: string
  pitfalls?: string[]
}

export type StartGameResponse = {
  sessionId: string
  clueIndex?: number
  case: GameCase
}

export type GuessApiResponse = {
  result: 'correct' | 'close' | 'wrong'
  score: number
  attemptsCount?: number
  clueIndex?: number
  case?: GameCase
  gameOver?: boolean
  gameOverReason?: 'correct' | 'clues_exhausted' | null
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
  gameOver: boolean
  gameOverReason?: 'correct' | 'clues_exhausted' | null
  explanation?: CaseExplanation | null
  case?: GameCase
}

export type RequestState = 'idle' | 'loading' | 'submitting' | 'blocked'

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

export type GameSessionState = {
  sessionId: string | null
  caseData: StartGameResponse['case'] | null
}
