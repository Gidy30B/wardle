import { useState } from 'react'
import FeedbackPanel from '../../components/FeedbackPanel'
import type { GameResult } from './game.types'
import { buildShareText, getShareUrl } from '../share/share.service'

type FeedbackSectionProps = {
  result: GameResult | null
  hasActiveSession: boolean
  currentStreak: number
  xpEarned: number
  attemptLabels: Array<{ guess: string; label: 'correct' | 'close' | 'wrong' }>
}

export default function FeedbackSection({
  result,
  hasActiveSession,
  currentStreak,
  xpEarned,
  attemptLabels,
}: FeedbackSectionProps) {
  const [shareMessage, setShareMessage] = useState<string | null>(null)
  const shareAttemptLabels = attemptLabels.map((attempt) => attempt.label)
  const canUseNativeShare = typeof window !== 'undefined' && window.isSecureContext && typeof navigator.share === 'function'

  const canShare = Boolean(result?.gameOver)

  const getSharePayload = () => {
    if (!result) {
      return null
    }

    const text = buildShareText({
      attempts: result.attemptsCount ?? attemptLabels.length,
      score: result.score,
      streak: currentStreak,
      result: result.label === 'correct' ? 'correct' : 'failed',
      attemptLabels: shareAttemptLabels,
    })

    return {
      text,
      url: getShareUrl(),
      title: 'Wardle — Daily Diagnosis',
    }
  }

  const handleShare = async () => {
    const payload = getSharePayload()
    if (!payload) {
      return
    }

    const sharePayload = {
      title: payload.title,
      text: payload.text,
      url: payload.url,
    }

    try {
      if (canUseNativeShare && (!navigator.canShare || navigator.canShare(sharePayload))) {
        await navigator.share(sharePayload)
        setShareMessage('Shared! 🚀')
        return
      }

      await navigator.clipboard.writeText(payload.text)
      setShareMessage('Copied! Share it 🔥')
    } catch {
      setShareMessage(canUseNativeShare ? 'Share cancelled.' : 'Copy failed.')
    }
  }

  return (
    <section className="min-h-[120px]">
      <FeedbackPanel
        result={result}
        hasActiveSession={hasActiveSession}
        currentStreak={currentStreak}
        xpEarned={xpEarned}
        attemptLabels={attemptLabels}
      />
      {canShare ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={handleShare}
            className="w-full rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white"
          >
            {canUseNativeShare ? 'Share result' : 'Copy result'}
          </button>

          {shareMessage ? <p className="mt-2 text-center text-xs text-white/70">{shareMessage}</p> : null}
        </div>
      ) : null}
    </section>
  )
}
