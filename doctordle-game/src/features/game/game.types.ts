import type { DiagnosisSuggestionMatchKind } from './diagnosisRegistry.types'

export type GuessPayload = {
  sessionId: string
  diagnosisRegistryId: string
  guess?: string
}

export type DiagnosisSelection = {
  diagnosisRegistryId: string
  displayLabel: string
}

export type DiagnosisSuggestion = DiagnosisSelection & {
  matchKind: DiagnosisSuggestionMatchKind
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
  summary?: string | null
  keyFindings?: string[] | null
  reasoning?: string | null
  differentials?: string[] | null
  clinicalPearl?: string | null
}

export type GameExplanation = CaseExplanation

export type StartGameResponse =
  | {
      state: 'ready'
      sessionId: string
      dailyCaseId: string
      startedAt?: string
      completedAt?: string | null
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
  startedAt?: string
  completedAt?: string | null
  case?: GameCase
  gameOver?: boolean
  gameOverReason?: 'correct' | 'clues_exhausted' | null
  xpAwarded?: number
  streakAfter?: number
  explanation?: GameExplanation | null
  feedback?: {
    signals?: {
      exact?: boolean
      synonym?: boolean
      fuzzy?: number
      embedding?: number
      diagnosisResolutionMethod?: 'SELECTED_ID' | 'UNRESOLVED'
      diagnosisResolutionReason?:
        | 'NO_SELECTED_ID'
        | 'INVALID_SELECTED_ID'
        | 'UNUSABLE_SELECTED_ID'
        | 'EXPECTED_DIAGNOSIS_MISSING'
        | 'EXPECTED_DIAGNOSIS_UNUSABLE'
      submittedDiagnosisRegistryId?: string
      resolvedDiagnosisRegistryId?: string
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
  startedAt?: string
  completedAt?: string | null
  gameOver: boolean
  gameOverReason?: 'correct' | 'clues_exhausted' | null
  xpAwarded?: number
  streakAfter?: number
  explanation?: GameExplanation | null
  case?: GameCase
}

export type LeaderboardMode = 'daily' | 'weekly'

export type PublishTrack = 'DAILY' | 'PREMIUM' | 'PRACTICE'

export type TodayCase = {
  dailyCaseId: string
  track: PublishTrack
  sequenceIndex: number
  case: {
    id: string
    title: string
    date: string
    difficulty: string
    diagnosisId: string
    clues?: unknown
    explanation?: unknown
  }
}

export type TodayCasesResponse = {
  date: string
  cases: TodayCase[]
}

export type LeaderboardEntry = {
  rank: number
  userId: string
  displayName?: string
  organizationName?: string
  streak?: number
  score: number
  attemptsCount: number
  timeToComplete?: number | null
  totalTimeToComplete?: number | null
  casesCompleted?: number
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
