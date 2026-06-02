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

export type CaseDiagnosisReadModel = {
  id: string | null
  displayLabel: string
  canonicalName: string | null
  specialty: string
  category: string | null
  bodySystem: string | null
}

export type GameCase = {
  id: string
  casePublicNumber?: number | null
  displayLabel?: string
  trackDisplayLabel?: string
  diagnosis?: CaseDiagnosisReadModel | null
  clues: ClinicalClue[]
  clueIndex: number
}

export type CaseExplanation = {
  summary?: string | null
  keyFindings?: string[] | null
  reasoning?: string | null
  differentials?: string[] | null
  differentialAnalysis?: Array<{
    diagnosis: string
    whyPlausibleEarly: string
    ruledOutByClues: Array<{
      clueOrder: number
      evidence: string
      reason: string
    }>
    finalReasonLessLikely: string
  }> | null
  clinicalPearl?: string | null
}

export type GameExplanation = CaseExplanation

export type StartGameResponse =
  | {
      state: 'ready'
      sessionId: string
      dailyCaseId: string
      casePublicNumber?: number | null
      displayLabel?: string
      trackDisplayLabel?: string
      dailyCaseDisplayLabel?: string
      dailyCaseTrackDisplayLabel?: string
      startedAt?: string
      completedAt?: string | null
      case: GameCase
    }
  | {
      state: 'completed'
      sessionId: string
      dailyCaseId: string
      casePublicNumber?: number | null
      displayLabel?: string
      trackDisplayLabel?: string
      dailyCaseDisplayLabel?: string
      dailyCaseTrackDisplayLabel?: string
      startedAt: string
      completedAt: string
      clueIndex: number
      attemptsCount: number
      attempts: Array<{
        guess: string
        result: 'correct' | 'close' | 'wrong'
        score: number
        clueIndexAtAttempt?: number | null
      }>
      score: number
      gameOver: true
      gameOverReason: 'correct' | 'clues_exhausted'
      explanation?: GameExplanation | null
      nextCaseAt: string
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
  casePublicNumber?: number | null
  displayLabel?: string
  trackDisplayLabel?: string
  track: PublishTrack
  sequenceIndex: number
  case: {
    id: string
    publicNumber?: number | null
    diagnosisRegistryId?: string | null
    educationAvailable?: boolean
    displayLabel?: string
    trackDisplayLabel?: string
    title: string
    date: string
    difficulty: string
    diagnosisId: string
    diagnosis?: CaseDiagnosisReadModel
    clues?: unknown
    explanation?: unknown
  }
}

export type TodayCasesResponse = {
  date: string
  cases: TodayCase[]
}

export type LearnPlayerResult = {
  solved: boolean
  attemptsUsed: number
  timeSecs: number | null
}

export type LearnLibraryCase = {
  sessionId: string
  dailyCaseId: string
  casePublicNumber?: number | null
  displayLabel?: string
  trackDisplayLabel?: string
  track: PublishTrack
  sequenceIndex: number
  completedAt: string
  playerResult: LearnPlayerResult
  case: {
    id: string
    publicNumber?: number | null
    diagnosisRegistryId?: string | null
    educationAvailable?: boolean
    displayLabel?: string
    trackDisplayLabel?: string
    title: string
    diagnosis: string | CaseDiagnosisReadModel
    specialty?: string | null
    category?: string | null
    bodySystem?: string | null
    date: string
    difficulty: string
    clues: ClinicalClue[]
    explanation: GameExplanation | null
  }
}

export type LearnLibraryResponse = {
  generatedAt: string
  cases: LearnLibraryCase[]
  performanceSummary?: {
    accuracyPct: number | null
    casesDone: number
    averageCluesUsed: number | null
    averageTimeSecs: number | null
    specialties: Array<{
      key: string
      label: string
      casesDone: number
      accuracyPct: number | null
    }>
  }
}

export type DiagnosisEducationRecallPrompt = {
  id?: string
  type?: 'CLOZE' | 'SHORT_ANSWER' | 'DISTINGUISH' | 'PEARL_RECALL' | 'WHY_IT_MATTERS'
  prompt?: string
  answer?: string
  explanation?: string
  linkedConcept?: string
  sourceSection?: string
  difficulty?: 'BASIC' | 'INTERMEDIATE' | 'ADVANCED'
}

export type PearlType =
  | 'PATTERN_RECOGNITION'
  | 'HIGH_YIELD_DISCRIMINATOR'
  | 'PITFALL'
  | 'ESCALATION_RED_FLAG'
  | 'MANAGEMENT'
  | 'MNEMONIC'
  | 'EXAM'
  | 'INVESTIGATION'

export type PearlCritique = {
  genericityScore?: number
  discriminatorStrength?: number
  operationalReasoningScore?: number
  memorabilityScore?: number
  managementImpactScore?: number
  warnings: string[]
}

export type TypedEducationPearl = {
  id: string
  type: PearlType
  title?: string
  content: string
  whyItMatters?: string
  discriminator?: string
  managementImplication?: string
  escalationImplication?: string
  trapAvoided?: string
  critique?: PearlCritique
}

export type DiagnosisEducationDifferential = {
  diagnosis?: string
  whyConfused?: string
  distinguishingPoint?: string
  keySeparator?: string
  classicTrap?: string
}

export type DiagnosisEducationPearl = {
  id?: string
  type?: PearlType
  title?: string
  content?: string
  label?: string
  explanation?: string
  whyItMatters?: string
  discriminator?: string
  managementImplication?: string
  escalationImplication?: string
  trapAvoided?: string
  critique?: PearlCritique
}

export type DiagnosisEducationClinicalPattern = {
  pattern?: string
  whyItMatters?: string
  progression?: string
  commonTrap?: string
}

export type DiagnosisEducationFinding = {
  finding?: string
  whyItMatters?: string
  diagnosticImpact?: string
  discriminator?: string
}

export type DiagnosisEducationInvestigation = {
  test?: string
  significance?: string
  interpretation?: string
  discriminator?: string
}

export type DiagnosisEducationPitfall = {
  pitfall?: string
  whyItHappens?: string
  consequence?: string
  saferHeuristic?: string
}

export type DiagnosisEducationManagement = {
  step?: string
  rationale?: string
  urgency?: string
}

export type DiagnosisEducationMnemonic = {
  id?: string
  name?: string
  useCase?: string
  expansion?: Array<{
    letter?: string
    meaning?: string
    note?: string | null
  }>
}

export type DiagnosisEducationScoringSystem = {
  id?: string
  name?: string
  use?: string
  mnemonic?: DiagnosisEducationMnemonic | null
  components?: string[]
  caution?: string
}

export type DiagnosisEducation = {
  diagnosisRegistryId: string
  title: string
  diagnosis?: CaseDiagnosisReadModel | null
  summary?: {
    definition?: string
    highYieldTakeaway?: string
  } | string | null
  recognitionPattern?: Array<string | DiagnosisEducationClinicalPattern | TypedEducationPearl> | null
  keySymptoms?: Array<string | DiagnosisEducationFinding> | null
  keySigns?: Array<string | DiagnosisEducationFinding> | null
  examPearls?: Array<string | DiagnosisEducationPearl | TypedEducationPearl> | null
  scoringSystems?: Array<string | DiagnosisEducationScoringSystem> | null
  mnemonics?: DiagnosisEducationMnemonic[] | null
  investigations?: Array<string | DiagnosisEducationInvestigation | TypedEducationPearl> | null
  differentialDistinguishers?: Array<string | DiagnosisEducationDifferential | TypedEducationPearl> | null
  pitfalls?: Array<string | DiagnosisEducationPitfall | TypedEducationPearl> | null
  managementOverview?: Array<string | DiagnosisEducationManagement | TypedEducationPearl> | null
  complications?: string[] | null
  recallPrompts?: DiagnosisEducationRecallPrompt[] | null
  references?: string[] | null
  reviewedAt?: string | null
  version: number
}

export type LeaderboardEntry = {
  rank: number
  userId: string
  username?: string
  displayName?: string
  avatarUrl?: string | null
  isAnonymous?: boolean
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
