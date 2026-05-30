import type { CaseExplanation, GameExplanation } from './game.types'

export type NormalizedStructuredExplanation = {
  summary: string | null
  keyFindings: string[]
  reasoning: string | null
  differentials: string[]
  differentialAnalysis: NormalizedDifferentialAnalysis[]
  clinicalPearl: string | null
}

export type NormalizedDifferentialAnalysis = {
  diagnosis: string
  whyPlausibleEarly: string
  ruledOutByClues: Array<{
    clueOrder: number
    evidence: string
    reason: string
  }>
  finalReasonLessLikely: string
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

function getTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function getNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function normalizeDifferentialAnalysis(value: unknown): NormalizedDifferentialAnalysis[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => {
      const record = asRecord(item)
      if (!record) return null

      const diagnosis = getTrimmedString(record.diagnosis)
      const whyPlausibleEarly = getTrimmedString(record.whyPlausibleEarly)
      const finalReasonLessLikely = getTrimmedString(record.finalReasonLessLikely)
      if (!diagnosis || !whyPlausibleEarly || !finalReasonLessLikely) {
        return null
      }

      const ruledOutByClues = Array.isArray(record.ruledOutByClues)
        ? record.ruledOutByClues
            .map((ruleOut) => {
              const ruleOutRecord = asRecord(ruleOut)
              if (!ruleOutRecord) return null
              const clueOrder = getNumber(ruleOutRecord.clueOrder)
              const evidence = getTrimmedString(ruleOutRecord.evidence)
              const reason = getTrimmedString(ruleOutRecord.reason)
              if (clueOrder === null || !evidence || !reason) return null
              return { clueOrder, evidence, reason }
            })
            .filter(
              (
                ruleOut,
              ): ruleOut is NormalizedDifferentialAnalysis['ruledOutByClues'][number] =>
                ruleOut !== null,
            )
        : []

      return {
        diagnosis,
        whyPlausibleEarly,
        ruledOutByClues,
        finalReasonLessLikely,
      }
    })
    .filter((item): item is NormalizedDifferentialAnalysis => item !== null)
}

export function normalizeStructuredExplanation(
  value: unknown,
): NormalizedStructuredExplanation | null {
  const candidate = asRecord(value)
  if (!candidate) {
    return null
  }

  const summary = getTrimmedString(candidate.summary)
  const keyFindings = Array.isArray(candidate.keyFindings)
    ? candidate.keyFindings
        .map((item) => getTrimmedString(item))
        .filter((item): item is string => item !== null)
    : []
  const reasoning = getTrimmedString(candidate.reasoning)
  const clinicalPearl = getTrimmedString(candidate.clinicalPearl)
  const differentials = Array.isArray(candidate.differentials)
    ? candidate.differentials
        .map((item) => getTrimmedString(item))
        .filter((item): item is string => item !== null)
    : []
  const differentialAnalysis = normalizeDifferentialAnalysis(candidate.differentialAnalysis)

  if (
    !summary &&
    keyFindings.length === 0 &&
    !reasoning &&
    differentials.length === 0 &&
    differentialAnalysis.length === 0 &&
    !clinicalPearl
  ) {
    return null
  }

  return {
    summary,
    keyFindings,
    reasoning,
    differentials,
    differentialAnalysis,
    clinicalPearl,
  }
}

export function getExplanationDisplayText(
  explanation: GameExplanation | null | undefined,
): string | null {
  const structuredExplanation = normalizeStructuredExplanation(explanation)
  if (!structuredExplanation) {
    return null
  }

  const sections: string[] = []
  if (structuredExplanation.summary) {
    sections.push(structuredExplanation.summary)
  }
  if (structuredExplanation.keyFindings.length > 0) {
    sections.push(structuredExplanation.keyFindings.map((point) => `- ${point}`).join('\n'))
  }

  if (sections.length === 0 && structuredExplanation.reasoning) {
    sections.push(structuredExplanation.reasoning)
  }

  if (sections.length === 0 && structuredExplanation.differentials.length > 0) {
    sections.push(`Differentials: ${structuredExplanation.differentials.join(', ')}`)
  }

  if (sections.length === 0 && structuredExplanation.clinicalPearl) {
    sections.push(structuredExplanation.clinicalPearl)
  }

  if (sections.length === 0) {
    return null
  }

  return sections.join('\n\n')
}

export function hasDisplayableExplanation(
  explanation: GameExplanation | null | undefined,
): boolean {
  return getExplanationDisplayText(explanation) !== null
}

export function truncateExplanationDisplayText(
  explanation: GameExplanation | null | undefined,
  maxLength = 360,
): string | null {
  const text = getExplanationDisplayText(explanation)
  if (!text) {
    return null
  }

  return text.length > maxLength ? `${text.slice(0, maxLength - 3).trimEnd()}...` : text
}

export function coerceStructuredExplanation(
  explanation: CaseExplanation | GameExplanation,
): NormalizedStructuredExplanation | null {
  return normalizeStructuredExplanation(explanation)
}
