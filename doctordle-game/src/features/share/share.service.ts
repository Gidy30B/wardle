import type { ShareAttemptLabel, ShareCardResult } from './shareCard.types'
import type { ShareCardData } from './shareCard.types'
import { shareCardImage, type ShareImageResult } from './shareImage'
import {
  buildShareGrid,
  buildShareText as buildDesignedShareText,
  getShareUrl,
  shareScoreText,
} from './shareText'

export { buildShareGrid, getShareUrl }

export async function shareScoreCard(
  data: ShareCardData,
  cardElement?: HTMLElement | null,
): Promise<ShareImageResult> {
  if (cardElement) {
    return shareCardImage(cardElement, data)
  }

  return shareScoreText(data)
}

export function buildShareText(data: {
  attempts: number
  score: number
  streak: number
  result: ShareCardResult
  attemptLabels: ShareAttemptLabel[]
}) {
  return buildDesignedShareText({
    caseId: null,
    result: data.result,
    attemptsUsed: data.attempts,
    cluesUsed: data.attempts,
    totalClues: Math.max(6, data.attemptLabels.length),
    score: data.score,
    streak: data.streak,
    xpTotal: null,
    school: null,
    attemptLabels: data.attemptLabels,
  })
}
