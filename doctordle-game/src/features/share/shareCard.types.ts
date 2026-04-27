export type ShareAttemptLabel = 'correct' | 'close' | 'wrong'

export type ShareCardResult = 'correct' | 'failed'

export type ShareCardData = {
  caseId: string | null
  result: ShareCardResult
  attemptsUsed: number
  cluesUsed: number
  totalClues: number
  score: number
  streak: number | null
  xpTotal: number | null
  school: string | null
  attemptLabels: ShareAttemptLabel[]
}
