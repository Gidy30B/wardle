import { forwardRef, useCallback, useMemo, useRef, useState } from 'react'
import WardleLogo from '../../components/brand/WardleLogo'
import Button from '../../components/ui/Button'
import type { ShareCardData } from './shareCard.types'
import { shareScoreCard } from './share.service'
import type { ShareImageResult } from './shareImage'
import { buildDesignerShareBlocks, buildShareText } from './shareText'

type DesignedShareCardProps = {
  data: ShareCardData
  onClose?: () => void
  showActions?: boolean
  className?: string
}

const DesignedShareCard = forwardRef<HTMLDivElement, DesignedShareCardProps>(function DesignedShareCard(
{
  data,
  onClose,
  showActions = true,
  className,
}: DesignedShareCardProps,
forwardedRef,
) {
  const cardRef = useRef<HTMLDivElement | null>(null)
  const [actionState, setActionState] = useState<ShareImageResult>('idle')
  const shareText = useMemo(() => buildShareText(data), [data])
  const blocks = useMemo(() => buildDesignerShareBlocks(data), [data])
  const resultTitle =
    data.result === 'correct'
      ? data.cluesUsed <= 2
        ? 'Brilliant Diagnosis!'
        : data.cluesUsed <= 4
          ? 'Solid Clinical Thinking'
          : 'Squeaked Through!'
      : "Missed Today's Case"

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareText)
      setActionState('copied')
    } catch {
      setActionState('idle')
    }
  }

  const setCardRefs = useCallback(
    (node: HTMLDivElement | null) => {
      cardRef.current = node

      if (typeof forwardedRef === 'function') {
        forwardedRef(node)
        return
      }

      if (forwardedRef) {
        forwardedRef.current = node
      }
    },
    [forwardedRef],
  )

  const handleShare = async () => {
    setActionState(await shareScoreCard(data, cardRef.current))
  }

  return (
    <section className={['min-w-0 max-w-full', className ?? ''].filter(Boolean).join(' ')}>
      <div
        ref={setCardRefs}
        className="overflow-hidden rounded-[26px] border border-[rgba(0,180,166,0.18)] bg-[linear-gradient(145deg,var(--wardle-color-navy),#0d2440)] shadow-[0_24px_64px_rgba(0,0,0,0.34)]"
      >
        <div className="flex items-center justify-between gap-3 border-b border-[rgba(0,180,166,0.14)] bg-[linear-gradient(90deg,rgba(0,180,166,0.13),rgba(26,60,94,0.78))] px-5 py-4">
          <WardleLogo size="sm" />
          <div className="font-brand-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--wardle-color-teal)]">
            {data.caseId ? `Case ${data.caseId}` : 'Daily Case'}
          </div>
        </div>

        <div className="px-5 py-6 text-center">
          <div className="text-5xl" aria-hidden="true">
            {data.result === 'correct' ? '🎯' : '🧠'}
          </div>
          <h2 className="mt-3 text-xl font-black text-[var(--wardle-color-mint)]">
            {resultTitle}
          </h2>
          <p className="mt-1 text-sm text-white/60">
            {data.result === 'correct'
              ? `Diagnosed in ${data.cluesUsed} clue${data.cluesUsed === 1 ? '' : 's'}`
              : 'The case is ready for review in Learning Notes'}
          </p>

          <div className="mt-5 flex flex-wrap justify-center gap-2 text-3xl leading-none">
            {blocks.map((block, index) => (
              <span key={`${block}-${index}`}>{block}</span>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3">
            <ShareStat
              label="Clues Used"
              value={`${data.cluesUsed}/${data.totalClues}`}
              tone="teal"
            />
            <ShareStat label="Score" value={String(data.score)} tone="mint" />
            <ShareStat
              label="Day Streak"
              value={data.streak != null ? `🔥${data.streak}` : '--'}
              tone="amber"
            />
          </div>

          {data.school ? (
            <div className="mt-5 inline-flex max-w-full items-center gap-2 rounded-full border border-[rgba(0,180,166,0.2)] bg-[rgba(0,180,166,0.1)] px-4 py-2 text-sm font-semibold text-[var(--wardle-color-teal)]">
              <span aria-hidden="true">🎓</span>
              <span className="min-w-0 truncate">{data.school}</span>
            </div>
          ) : null}

          <div className="mt-5 border-t border-white/[0.06] pt-4">
            <p className="text-xs italic text-white/45">Diagnose. Learn. Win.</p>
            <p className="mt-1 font-brand-mono text-xs font-semibold uppercase tracking-[0.18em] text-[var(--wardle-color-teal)]">
              wardle.app
            </p>
          </div>
        </div>
      </div>

      {showActions ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Button type="button" onClick={handleShare}>
            {actionState === 'shared'
              ? 'Shared image'
              : actionState === 'copied'
                ? 'Image copied'
                : actionState === 'downloaded'
                  ? 'Image downloaded'
                  : 'Share image'}
          </Button>
          <Button type="button" variant="secondary" onClick={handleCopy}>
            {actionState === 'copied' ? 'Copied to clipboard' : 'Copy score text'}
          </Button>
        </div>
      ) : null}

      {onClose ? (
        <div className="mt-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      ) : null}
    </section>
  )
})

export default DesignedShareCard

function ShareStat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'teal' | 'mint' | 'amber'
}) {
  const colorClass =
    tone === 'teal'
      ? 'text-[var(--wardle-color-teal)]'
      : tone === 'amber'
        ? 'text-[var(--wardle-color-amber)]'
        : 'text-[var(--wardle-color-mint)]'

  return (
    <div className="min-w-0 rounded-[14px] border border-white/[0.07] bg-white/[0.04] px-2 py-3">
      <div className={`truncate text-lg font-black ${colorClass}`}>{value}</div>
      <div className="mt-1 truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-white/42">
        {label}
      </div>
    </div>
  )
}
