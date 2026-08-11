import { useRef, useState } from 'react'
import Button from '../../../components/ui/Button'
import DesignedShareCard from '../../share/DesignedShareCard'
import { buildShareCardDataFromRound } from '../../share/shareCardData'
import { shareScoreCard } from '../../share/share.service'
import type { ShareImageResult } from '../../share/shareImage'
import type { RoundViewModel } from '../round.types'
import type { AppIconSet } from '../../../theme/icons'

type ShareUiState =
  | 'idle'
  | 'preparing'
  | 'sharing'
  | 'shared'
  | 'text-shared'
  | 'copied'
  | 'downloaded'
  | 'error'

type ReactResultModalProps = {
  iconSet: AppIconSet
  isOpen: boolean
  roundViewModel: RoundViewModel
  currentStreak: number | null
  organizationName: string | null
  onClose: () => void
  onReviewLearning: () => void
  onContinue: () => void
  archiveCatchUp?: {
    nextLabel: string | null
    caughtUp: boolean
    onNextArchiveCase: () => void
    onBackToArchive: () => void
    onExitArchive: () => void
  }
}

export default function ReactResultModal({
  iconSet,
  isOpen,
  roundViewModel,
  currentStreak,
  organizationName,
  onClose,
  onReviewLearning,
  onContinue,
  archiveCatchUp,
}: ReactResultModalProps) {
  const shareCardRef = useRef<HTMLDivElement | null>(null)
  const [shareState, setShareState] = useState<ShareUiState>('idle')

  if (!isOpen) {
    return null
  }

  const shareCardData = buildShareCardDataFromRound(roundViewModel, {
    streak: currentStreak,
    school: organizationName,
  })

  const handleShare = async () => {
    if (!shareCardData || shareState === 'preparing' || shareState === 'sharing') {
      return
    }

    setShareState('preparing')

    try {
      const result: ShareImageResult = await shareScoreCard(
        shareCardData,
        shareCardRef.current,
      )
      setShareState(result === 'idle' ? 'error' : result)
    } catch {
      setShareState('error')
    }
  }

  const shareButtonDisabled =
    !shareCardData || shareState === 'preparing' || shareState === 'sharing'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(2,6,12,0.78)] p-3 backdrop-blur-sm sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Close result summary"
        className="absolute inset-0"
        onClick={onClose}
      />
      <div className="relative max-h-[calc(100dvh-1.5rem)] w-full max-w-[520px] overflow-y-auto rounded-[28px] border border-white/10 bg-[linear-gradient(145deg,rgba(26,60,94,0.72),rgba(30,30,44,0.96))] p-4 shadow-[0_32px_90px_rgba(0,0,0,0.44)] sm:p-5">
        {shareCardData ? (
          <DesignedShareCard ref={shareCardRef} data={shareCardData} showActions={false} />
        ) : (
          <div className="rounded-[24px] border border-white/10 bg-white/[0.05] px-5 py-6 text-center">
            <p className="text-sm text-white/68">Result is ready.</p>
          </div>
        )}

        {archiveCatchUp?.caughtUp ? (
          <div className="mt-4 rounded-[14px] border border-[rgba(0,180,166,0.18)] bg-[rgba(0,180,166,0.07)] px-4 py-3">
            <p className="text-sm font-black text-[var(--wardle-color-teal)]">
              You're caught up
            </p>
            <p className="mt-1 text-xs leading-5 text-white/42">
              You've played every available Archive case.
            </p>
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {archiveCatchUp?.nextLabel ? (
            <Button type="button" onClick={archiveCatchUp.onNextArchiveCase}>
              {iconSet.play} Next archive case
            </Button>
          ) : archiveCatchUp?.caughtUp ? (
            <Button type="button" onClick={archiveCatchUp.onBackToArchive}>
              Back to Archive
            </Button>
          ) : (
            <Button type="button" variant="secondary" onClick={onContinue}>
              {iconSet.play} Continue
            </Button>
          )}
          <Button type="button" onClick={handleShare} disabled={shareButtonDisabled}>
            {shareState === 'shared'
              ? `${iconSet.rank} Shared`
              : shareState === 'text-shared'
                ? `${iconSet.rank} Shared as text`
              : shareState === 'copied'
                ? `${iconSet.rank} Image copied`
                : shareState === 'downloaded'
                  ? `${iconSet.rank} Image downloaded`
                  : shareState === 'preparing'
                    ? `${iconSet.rank} Preparing image...`
                    : shareState === 'sharing'
                      ? `${iconSet.rank} Opening share sheet...`
                      : shareState === 'error'
                        ? `${iconSet.rank} Share failed`
                : `${iconSet.rank} Share`}
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onReviewLearning}
            disabled={!roundViewModel.canOpenExplanation}
          >
            {iconSet.learn} Learning Notes
          </Button>
        </div>
        {archiveCatchUp?.nextLabel ? (
          <button
            type="button"
            onClick={archiveCatchUp.onExitArchive}
            className="mt-3 w-full rounded-[13px] border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm font-black text-white/52 transition hover:bg-white/[0.06] hover:text-white/72"
          >
            Leave Archive catch-up
          </button>
        ) : null}
      </div>
    </div>
  )
}
