import type { ReactNode } from 'react'
import WardleLogo from '../../../components/brand/WardleLogo'
import Button from '../../../components/ui/Button'
import DesignedShareCard from '../../share/DesignedShareCard'
import { buildShareCardDataFromRound } from '../../share/shareCardData'
import ReactClueCard from './ReactClueCard'
import ReactGameProgress from './ReactGameProgress'
import ReactGuessInput from './ReactGuessInput'
import NotificationBell from '../../notifications/NotificationBell'
import type { RoundViewModel } from '../round.types'
import type { AppIconSet } from '../../../theme/icons'


type ProgressState =
  | 'correct'
  | 'danger'
  | 'warning'
  | 'active'
  | 'revealed'
  | 'locked'

type ReactGamePlaySurfaceProps = {
  iconSet: AppIconSet
  roundViewModel: RoundViewModel
  currentStreak: number | null
  organizationName: string | null
  onChangeGuess: (value: string) => void
  onSelectSuggestion: (index: number) => void
  onMoveSuggestionHighlight: (direction: -1 | 1) => void
  onSelectHighlightedSuggestion: () => boolean
  onSubmit: () => void
  onReload?: () => void
}

export default function ReactGamePlaySurface({
  iconSet,
  roundViewModel,
  currentStreak,
  organizationName,
  onChangeGuess,
  onSelectSuggestion,
  onMoveSuggestionHighlight,
  onSelectHighlightedSuggestion,
  onSubmit,
  onReload,
}: ReactGamePlaySurfaceProps) {
  const visualSlotCount = Math.max(6, roundViewModel.totalClues || 0)
  const resultCluesUsed =
    roundViewModel.resultCluesUsed ?? roundViewModel.revealedClueCount
  const activeClueIndex =
    roundViewModel.mode === 'FINAL_FEEDBACK'
      ? Math.max(0, resultCluesUsed - 1)
      : Math.max(0, roundViewModel.revealedClueCount - 1)
  const attemptsRemaining = Math.max(0, visualSlotCount - roundViewModel.attemptsCount)
  const streakValue = currentStreak
  const caseCode = roundViewModel.caseTrackDisplayLabel.toUpperCase()
  const isInteractive =
    roundViewModel.mode === 'PLAYING' || roundViewModel.mode === 'SUBMITTING'
  const shareCardData =
    roundViewModel.mode === 'FINAL_FEEDBACK'
      ? buildShareCardDataFromRound(roundViewModel, {
          streak: currentStreak,
          school: organizationName,
        })
      : null

  const progressStates = Array.from({ length: visualSlotCount }, (_, index) => {
    const attempt = roundViewModel.attemptHistory[index]
    if (attempt) {
      if (attempt.label === 'correct') {
        return 'correct'
      }

      if (attempt.label === 'close') {
        return 'warning'
      }

      return index >= visualSlotCount - 2 ? 'danger' : 'warning'
    }

    if (index === activeClueIndex && roundViewModel.revealedClueCount > 0) {
      return 'active'
    }

    if (index < roundViewModel.revealedClueCount) {
      return 'revealed'
    }

    return 'locked'
  }) as ProgressState[]

  const guessInputTone =
    roundViewModel.mode === 'SUBMITTING'
      ? 'success'
      : roundViewModel.feedbackLabel === 'wrong'
        ? 'danger'
        : roundViewModel.feedbackLabel === 'close' ||
            roundViewModel.diagnosisStatusTone === 'warning'
          ? 'warning'
          : roundViewModel.diagnosisStatusTone === 'selected'
            ? 'success'
            : 'neutral'

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--wardle-color-charcoal)] text-white">
      <style>
        {`
          @keyframes wardle-clue-slide-up {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: translateY(0); }
          }

          @keyframes wardle-progress-bloom {
            from { transform: scaleX(0.82); opacity: 0.45; }
            to { transform: scaleX(1); opacity: 1; }
          }
        `}
      </style>

      <header className="sticky top-0 z-20 bg-[var(--wardle-color-charcoal)] px-5 pt-3">
        <div>
          <div className="flex items-start justify-between gap-4">
            <WardleLogo size="sm" />
            <div className="flex flex-wrap items-center justify-end gap-3">
              {streakValue != null ? <Pill tone="amber">{iconSet.streak}<span>{streakValue}</span></Pill> : null}
              {roundViewModel.elapsedTimeText ? (
                <Pill tone="navy">{roundViewModel.elapsedTimeText}</Pill>
              ) : null}
              <div className="shrink-0">
                <NotificationBell compact />
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="font-brand-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--wardle-color-teal)]/85">
                {caseCode}
              </p>
              <h1 className="mt-0.5 text-[17px] font-black text-[var(--wardle-color-mint)] sm:text-[17px]">
                What&apos;s the diagnosis?
              </h1>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/42">Attempts</p>
              <p className="mt-0.5 text-xl font-black text-[var(--wardle-color-mint)]">
                {roundViewModel.attemptsCount}
                <span className="ml-1 text-[13px] font-normal text-white/40">/6</span>
              </p>
            </div>
          </div>

          <div className="mt-2.5">
            <ReactGameProgress states={progressStates} />
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-4 pb-6 sm:px-5">
          {roundViewModel.mode === 'LOADING' ? (
            <StateCard
              title="Loading today's case"
              body="We're pulling the active clinical scenario and preparing your first clue."
            />
          ) : null}

          {roundViewModel.mode === 'WAITING' ? (
            <StateCard
              title="Next case not unlocked yet"
              body={
                roundViewModel.waitingCountdownText
                  ? `Next case in ${roundViewModel.waitingCountdownText}.`
                  : 'A new case will be available soon.'
              }
            />
          ) : null}

          {roundViewModel.mode === 'BLOCKED' ? (
            <StateCard
              title="Case unavailable"
              body={roundViewModel.unavailableReason ?? 'No case is available right now.'}
              action={
                onReload ? (
                  <Button type="button" onClick={onReload}>
                    Reload session
                  </Button>
                ) : undefined
              }
            />
          ) : null}

          <section className="space-y-3">
            {Array.from({ length: visualSlotCount }, (_, index) => {
              const clue = roundViewModel.visibleClues[index]

              if (!clue) {
                return (
                  <ReactClueCard
                    key={`locked-${index}`}
                    index={index}
                    state="locked"
                  />
                )
              }

              if (roundViewModel.mode === 'FINAL_FEEDBACK') {
                const state =
                  index === activeClueIndex
                    ? 'active'
                    : index < resultCluesUsed
                      ? 'revealed'
                      : 'review'

                return (
                  <ReactClueCard
                    key={clue.id}
                    clue={clue}
                    index={index}
                    state={state}
                  />
                )
              }

              return (
                <ReactClueCard
                  key={clue.id}
                  clue={clue}
                  index={index}
                  state={index === activeClueIndex ? 'active' : 'revealed'}
                />
              )
            })}
          </section>

          {roundViewModel.attemptHistory.length > 0 ? (
            <section className="pt-1">
              <p className="mb-2 font-brand-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-white/42">
                Your guesses
              </p>
              <div className="space-y-2">
                {roundViewModel.attemptHistory.map((attempt, index) => {
                  const isCorrect = attempt.label === 'correct'
                  const attemptTone =
                    attempt.label === 'correct'
                      ? 'border-[rgba(0,180,166,0.28)] bg-[rgba(0,180,166,0.12)] text-[var(--wardle-color-teal)]'
                      : attempt.label === 'close'
                        ? 'border-[rgba(244,162,97,0.24)] bg-[rgba(244,162,97,0.1)] text-[var(--wardle-color-amber)]'
                        : 'border-[rgba(224,92,92,0.2)] bg-[rgba(224,92,92,0.1)] text-white/70'

                  return (
                    <div
                      key={`${attempt.guess}-${index}`}
                      className={`flex items-center justify-between gap-3 rounded-[14px] border px-4 py-3 ${attemptTone}`}
                    >
                      <span className="min-w-0 truncate text-sm font-semibold">
                        {attempt.guess || 'Submitted diagnosis'}
                      </span>
                      <span className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/90">
                        {isCorrect ? 'Correct' : attempt.label === 'close' ? 'Close' : 'Incorrect'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </section>
          ) : null}

          {shareCardData ? (
            <section className="pt-1">
              <DesignedShareCard data={shareCardData} />
            </section>
          ) : null}
        </div>
      </div>

      {isInteractive ? (
        <ReactGuessInput
          value={roundViewModel.guess}
          suggestions={roundViewModel.suggestions}
          highlightedSuggestionIndex={roundViewModel.highlightedSuggestionIndex}
          canEdit={roundViewModel.canEditGuess}
          canSubmit={roundViewModel.canSubmit}
          submitDisabled={roundViewModel.submitDisabled}
          isSubmitting={roundViewModel.mode === 'SUBMITTING'}
          tone={guessInputTone}
          statusLabel={roundViewModel.diagnosisStatusLabel ?? roundViewModel.suggestionsStatusLabel}
          attemptsRemaining={attemptsRemaining}
          onChange={onChangeGuess}
          onSubmit={onSubmit}
          onSelectSuggestion={onSelectSuggestion}
          onMoveSuggestionHighlight={onMoveSuggestionHighlight}
          onSelectHighlightedSuggestion={onSelectHighlightedSuggestion}
        />
      ) : null}
    </div>
  )
}

function Pill({
  children,
  tone,
}: {
  children: ReactNode
  tone: 'amber' | 'navy'
}) {
  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${
        tone === 'amber'
          ? 'border border-[rgba(244,162,97,0.3)] bg-[rgba(244,162,97,0.15)] text-[13px] font-bold text-[var(--wardle-color-amber)]'
          : 'bg-[rgba(26,60,94,0.5)] font-brand-mono text-xs text-[var(--wardle-color-gray)]'
      }`}
    >
      {children}
    </div>
  )
}

function StateCard({
  title,
  body,
  action,
}: {
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <section className="rounded-[22px] border border-white/10 bg-[linear-gradient(145deg,rgba(26,60,94,0.28),rgba(30,30,44,0.92))] px-5 py-5">
      <p className="font-brand-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--wardle-color-teal)]/80">
        Status
      </p>
      <h2 className="mt-2 text-xl font-black text-[var(--wardle-color-mint)]">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-white/68">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </section>
  )
}
