import { useState } from 'react'
import FeedbackPanel from '../../components/FeedbackPanel'
import type { GameResult } from './game.types'
import { buildShareText, getShareUrl } from '../share/share.service'

async function copyTextWithFallback(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return 'copied'
    } catch {
      // Continue to legacy/manual fallbacks below.
    }
  }

  const textArea = document.createElement('textarea')
  textArea.value = text
  textArea.setAttribute('readonly', '')
  textArea.style.position = 'fixed'
  textArea.style.opacity = '0'
  textArea.style.left = '-9999px'
  document.body.appendChild(textArea)
  textArea.focus()
  textArea.select()

  let copied = false
  try {
    copied = document.execCommand('copy')
  } finally {
    document.body.removeChild(textArea)
  }

  if (copied) {
    return 'copied'
  }

  window.prompt('Copy and share your Wardle result:', text)
  return 'manual'
}

type FeedbackSectionProps = {
  result: GameResult | null
  currentStreak: number
  xpEarned: number
  attemptLabels: Array<{ guess: string; label: 'correct' | 'close' | 'wrong' }>
}

export default function FeedbackSection({ result, currentStreak, xpEarned, attemptLabels }: FeedbackSectionProps) {
  const [shareMessage, setShareMessage] = useState<string | null>(null)
  const [showShareOptions, setShowShareOptions] = useState(false)
  const shareAttemptLabels = attemptLabels.map((attempt) => attempt.label)

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

  const handleShareWhatsApp = () => {
    const payload = getSharePayload()
    if (!payload) {
      return
    }

    const encoded = encodeURIComponent(payload.text)
    window.open(`https://wa.me/?text=${encoded}`, '_blank', 'noopener,noreferrer')
    setShareMessage('Opened WhatsApp 🚀')
  }

  const handleShareX = () => {
    const payload = getSharePayload()
    if (!payload) {
      return
    }

    const tweet = encodeURIComponent(payload.text)
    const shareUrl = encodeURIComponent(payload.url)
    window.open(`https://twitter.com/intent/tweet?text=${tweet}&url=${shareUrl}`, '_blank', 'noopener,noreferrer')
    setShareMessage('Opened X share 🚀')
  }

  const handleCopy = async () => {
    const payload = getSharePayload()
    if (!payload) {
      return
    }

    const copyResult = await copyTextWithFallback(payload.text)
    if (copyResult === 'copied') {
      setShareMessage('Copied! Share it 🔥')
      return
    }

    setShareMessage('Manual copy opened. Share it 🔥')
  }

  return (
    <section className="min-h-[120px]">
      <FeedbackPanel
        result={result}
        currentStreak={currentStreak}
        xpEarned={xpEarned}
        attemptLabels={attemptLabels}
      />
      {canShare ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowShareOptions((previous) => !previous)}
            className="w-full rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white"
          >
            Share result
          </button>

          {showShareOptions ? (
            <div className="mt-2 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={handleShareWhatsApp}
                className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs font-medium text-white/70"
              >
                WhatsApp
              </button>
              <button
                type="button"
                onClick={handleShareX}
                className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs font-medium text-white/70"
              >
                X
              </button>
              <button
                type="button"
                onClick={handleCopy}
                className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs font-medium text-white/70"
              >
                Copy
              </button>
            </div>
          ) : null}

          {shareMessage ? <p className="mt-2 text-center text-xs text-white/70">{shareMessage}</p> : null}
        </div>
      ) : null}
    </section>
  )
}
