import type { CaseExplanation, GameExplanation } from './game.types'

export type NormalizedStructuredExplanation = {
  summary: string | null
  keyFindings: string[]
  reasoning: string | null
  differentials: string[]
  clinicalPearl: string | null
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

  if (
    !summary &&
    keyFindings.length === 0 &&
    !reasoning &&
    differentials.length === 0 &&
    !clinicalPearl
  ) {
    return null
  }

  return {
    summary,
    keyFindings,
    reasoning,
    differentials,
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
