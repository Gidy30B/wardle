import { useEffect, useMemo, useState, type ReactNode } from 'react'
import WardleLogo from '../../../components/brand/WardleLogo'
import SurfaceCard from '../../../components/ui/SurfaceCard'
import {
  coerceStructuredExplanation,
  getExplanationDisplayText,
} from '../gameExplanation'
import type {
  GameExplanation,
  GameResult,
  PublishTrack,
  TodayCase,
  TodayCasesResponse,
} from '../game.types'
import type { RoundViewModel } from '../round.types'

type LearnTabPageProps = {
  explanation: GameExplanation | null
  latestResult: GameResult | null
  latestPlayedExplanation: GameExplanation | null
  latestPlayedResult: GameResult | null
  roundViewModel: RoundViewModel
  todayCases: TodayCasesResponse | null
  tracksLoading: boolean
  tracksError: string | null
}

type LearnCaseStatus = 'unlocked' | 'pending' | 'locked'

type LearnCaseItem = {
  dailyCaseId: string
  sequenceIndex: number
  track: PublishTrack
  title: string
  difficulty: string
  status: LearnCaseStatus
  explanation: GameExplanation | null
  result: GameResult | null
}

type TrackGroup = {
  track: PublishTrack
  label: string
  context: string
  cases: LearnCaseItem[]
}

const TRACK_COPY: Record<PublishTrack, { label: string; context: string }> = {
  DAILY: {
    label: 'Free Daily',
    context: 'The daily case becomes reviewable after you complete it.',
  },
  PREMIUM: {
    label: 'Specialty Tracks',
    context: 'Premium track notes unlock only from cases you have played.',
  },
  PRACTICE: {
    label: 'Practice',
    context: 'Practice cases build a private review queue as you play.',
  },
}

export default function LearnTabPage({
  explanation,
  latestResult,
  latestPlayedExplanation,
  latestPlayedResult,
  roundViewModel,
  todayCases,
  tracksLoading,
  tracksError,
}: LearnTabPageProps) {
  const [selectedTrack, setSelectedTrack] = useState<PublishTrack | null>(null)
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null)

  const playedCaseId =
    latestPlayedResult?.case?.id ?? latestResult?.case?.id ?? roundViewModel.caseId
  const playedExplanation = latestPlayedExplanation ?? explanation
  const playedResult = latestPlayedResult ?? latestResult

  const trackGroups = useMemo(
    () =>
      buildTrackGroups({
        todayCases: todayCases?.cases ?? [],
        playedCaseId,
        playedExplanation,
        playedResult,
      }),
    [playedCaseId, playedExplanation, playedResult, todayCases],
  )

  const activeTrack =
    trackGroups.find((group) => group.track === selectedTrack) ?? trackGroups[0] ?? null
  const activeCase =
    activeTrack?.cases.find((item) => item.dailyCaseId === selectedCaseId) ??
    activeTrack?.cases.find((item) => item.status === 'unlocked') ??
    activeTrack?.cases.find((item) => item.status === 'pending') ??
    null

  useEffect(() => {
    if (!activeTrack) {
      setSelectedCaseId(null)
      return
    }

    if (!selectedTrack || selectedTrack !== activeTrack.track) {
      setSelectedTrack(activeTrack.track)
    }

    const selectedStillExists = activeTrack.cases.some(
      (item) => item.dailyCaseId === selectedCaseId,
    )
    if (!selectedStillExists) {
      setSelectedCaseId(
        activeTrack.cases.find((item) => item.status === 'unlocked')?.dailyCaseId ??
          activeTrack.cases.find((item) => item.status === 'pending')?.dailyCaseId ??
          null,
      )
    }
  }, [activeTrack, selectedCaseId, selectedTrack])

  return (
    <main className="flex h-full min-h-0 w-full max-w-full flex-1 basis-0 flex-col overflow-x-hidden overflow-y-auto overscroll-contain px-1 pb-4 pt-1 sm:px-2">
      <div className="min-w-0 max-w-full space-y-4 overflow-x-hidden">
        <LearnHeader date={todayCases?.date ?? null} />

        <SurfaceCard
          eyebrow="Content Tracks"
          title="Learning library"
          className="min-w-0 max-w-full overflow-hidden"
        >
          {tracksError ? (
            <EmptyStateCopy copy="Failed to load content tracks." tone="error" />
          ) : tracksLoading ? (
            <EmptyStateCopy copy="Loading content tracks..." />
          ) : trackGroups.length > 0 ? (
            <TrackSelector
              groups={trackGroups}
              activeTrack={activeTrack?.track ?? null}
              onSelectTrack={(track) => {
                setSelectedTrack(track)
                setSelectedCaseId(null)
              }}
            />
          ) : (
            <EmptyStateCopy copy="No content tracks are available for this account right now." />
          )}
        </SurfaceCard>

        {activeTrack ? (
          <>
            <TrackSummary group={activeTrack} selectedItem={activeCase} />

            <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <LearnCaseList
                cases={activeTrack.cases}
                selectedCaseId={activeCase?.dailyCaseId ?? null}
                onSelectCase={setSelectedCaseId}
              />

              <SelectedExplanationDetail item={activeCase} />
            </div>
          </>
        ) : null}
      </div>
    </main>
  )
}

function LearnHeader({ date }: { date: string | null }) {
  return (
    <section className="relative overflow-hidden rounded-[26px] border border-white/[0.06] bg-[linear-gradient(145deg,rgba(26,60,94,0.9),rgba(30,30,44,0.98)_66%)] px-5 py-6 shadow-[0_22px_54px_rgba(0,0,0,0.22)]">
      <div className="pointer-events-none absolute -right-16 -top-16 size-44 rounded-full bg-[rgba(0,180,166,0.2)] blur-3xl" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-white/[0.06]" />
      <div className="relative min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <WardleLogo size="sm" subtitle="Learning Library" />
          {date ? (
            <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-white/72">
              {date}
            </span>
          ) : null}
        </div>
        <h1 className="mt-5 text-2xl font-black text-[var(--wardle-color-mint)]">Learn</h1>
        <p className="mt-2 max-w-3xl break-words text-sm leading-6 text-white/68">
          Review explanations from cases you&apos;ve played, then turn each case into
          focused diagnostic notes.
        </p>
      </div>
    </section>
  )
}

function TrackSelector({
  groups,
  activeTrack,
  onSelectTrack,
}: {
  groups: TrackGroup[]
  activeTrack: PublishTrack | null
  onSelectTrack: (track: PublishTrack) => void
}) {
  return (
    <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-3">
      {groups.map((group) => {
        const counts = getStatusCounts(group.cases)
        const isActive = activeTrack === group.track

        return (
          <button
            key={group.track}
            type="button"
            aria-pressed={isActive}
            onClick={() => onSelectTrack(group.track)}
            className={`min-w-0 max-w-full overflow-hidden rounded-[18px] border p-4 text-left transition ${
              isActive
                ? 'border-[rgba(0,180,166,0.45)] bg-[rgba(0,180,166,0.12)]'
                : 'border-white/10 bg-white/[0.05] hover:bg-white/[0.08]'
            }`}
          >
            <p className="font-brand-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--wardle-color-teal)]/80">
              {group.track}
            </p>
            <h2 className="mt-2 break-words text-base font-black text-[var(--wardle-color-mint)]">
              {group.label}
            </h2>
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-white/52">
              {group.context}
            </p>
            <p className="mt-3 text-xs font-semibold text-white/58">
              {counts.unlocked}/{group.cases.length} ready
              {counts.pending ? `, ${counts.pending} pending` : ''}
            </p>
          </button>
        )
      })}
    </div>
  )
}

function TrackSummary({
  group,
  selectedItem,
}: {
  group: TrackGroup
  selectedItem: LearnCaseItem | null
}) {
  const counts = getStatusCounts(group.cases)

  return (
    <section className="relative overflow-hidden rounded-[22px] border border-[rgba(0,180,166,0.14)] bg-[linear-gradient(145deg,rgba(26,60,94,0.28),rgba(30,30,44,0.82))] px-4 py-4">
      <div className="pointer-events-none absolute -right-10 -top-16 size-36 rounded-full bg-[rgba(0,180,166,0.12)] blur-3xl" />
      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="font-brand-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--wardle-color-teal)]/80">
            Current review context
          </p>
          <h2 className="mt-1 break-words text-lg font-black text-[var(--wardle-color-mint)]">
            {selectedItem ? getSelectedCaseHeading(selectedItem) : group.label}
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-white/62">
            {selectedItem
              ? getSelectedCaseContext(selectedItem)
              : group.context}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-bold">
          <StatusPill label={`${counts.unlocked} unlocked`} tone="unlocked" />
          {counts.pending ? <StatusPill label={`${counts.pending} pending`} tone="pending" /> : null}
          <StatusPill label={`${counts.locked} locked`} tone="locked" />
        </div>
      </div>
    </section>
  )
}

function LearnCaseList({
  cases,
  selectedCaseId,
  onSelectCase,
}: {
  cases: LearnCaseItem[]
  selectedCaseId: string | null
  onSelectCase: (dailyCaseId: string) => void
}) {
  return (
    <SurfaceCard
      eyebrow="Review Queue"
      title="Cases in this track"
      className="min-w-0 max-w-full overflow-hidden"
    >
      <div className="min-w-0 space-y-3">
        {cases.map((item) => (
          <LearnCaseCard
            key={item.dailyCaseId}
            item={item}
            selected={selectedCaseId === item.dailyCaseId}
            onSelect={() => onSelectCase(item.dailyCaseId)}
          />
        ))}
      </div>
    </SurfaceCard>
  )
}

function LearnCaseCard({
  item,
  selected,
  onSelect,
}: {
  item: LearnCaseItem
  selected: boolean
  onSelect: () => void
}) {
  const isUnlocked = item.status === 'unlocked'
  const isPending = item.status === 'pending'
  const displayTitle = isUnlocked ? item.title : isPending ? 'Preparing learning notes' : 'Locked case'
  const statusCopy = getCaseStatusCopy(item.status)

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`block w-full min-w-0 max-w-full overflow-hidden rounded-[16px] border px-4 py-3 text-left transition ${
        selected
          ? 'border-[rgba(0,180,166,0.42)] bg-[rgba(0,180,166,0.12)]'
          : isUnlocked
            ? 'border-[rgba(0,180,166,0.25)] bg-[rgba(0,180,166,0.08)]'
            : 'border-white/10 bg-white/[0.04]'
      }`}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="mb-1 font-brand-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-white/34">
            Case {item.sequenceIndex}
          </p>
          <p className="break-words text-sm font-bold text-[var(--wardle-color-mint)]">
            {displayTitle}
          </p>
          <p className="mt-1 break-words text-xs leading-5 text-white/45">
            {statusCopy}
          </p>
          {item.status === 'locked' ? <LockedCasePreview /> : null}
        </div>
        <StatusPill label={item.status} tone={item.status} />
      </div>
    </button>
  )
}

function SelectedExplanationDetail({ item }: { item: LearnCaseItem | null }) {
  if (!item) {
    return (
      <SurfaceCard
        eyebrow="Learning Notes"
        title="No case selected"
        className="min-w-0 max-w-full overflow-hidden"
      >
        <EmptyStateCopy copy="Choose a case from the track to review its learning status." />
      </SurfaceCard>
    )
  }

  if (item.status === 'pending') {
    return (
      <SurfaceCard
        eyebrow="Selected Case"
        title="Notes pending"
        className="min-w-0 max-w-full overflow-hidden"
      >
        <FocusedEmptyState
          title="Preparing learning notes"
          copy="This case has been played, but its explanation is not ready yet. Check back after the notes finish processing."
          tone="pending"
        />
      </SurfaceCard>
    )
  }

  if (item.status === 'locked' || !item.explanation) {
    return (
      <SurfaceCard
        eyebrow="Selected Case"
        title="Locked notes"
        className="min-w-0 max-w-full overflow-hidden"
      >
        <FocusedEmptyState
          title="Play to unlock"
          copy="Learning notes stay hidden until you play this case. Titles, diagnoses, clues, and explanations are intentionally protected."
          tone="locked"
        />
      </SurfaceCard>
    )
  }

  return (
    <SurfaceCard
      eyebrow="Focused Learning"
      title="Case review"
      className="min-w-0 max-w-full overflow-hidden"
    >
      <ExplanationContent explanation={item.explanation} result={item.result} caseTitle={item.title} />
    </SurfaceCard>
  )
}

function ExplanationContent({
  explanation,
  result,
  caseTitle,
}: {
  explanation: GameExplanation
  result: GameResult | null
  caseTitle: string
}) {
  const structured = coerceStructuredExplanation(explanation)
  const displayText = getExplanationDisplayText(explanation)

  return (
    <div className="min-w-0 max-w-full space-y-4 overflow-hidden">
      <div className="min-w-0 rounded-[20px] border border-[rgba(0,180,166,0.16)] bg-[rgba(0,180,166,0.08)] px-4 py-3">
        <p className="font-brand-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--wardle-color-teal)]/80">
          Selected case
        </p>
        <p className="mt-1 break-words text-base font-black text-[var(--wardle-color-mint)]">
          {caseTitle}
        </p>
        {result ? (
          <p className="mt-1 break-words text-xs text-white/45">
            {result.gameOverReason === 'correct' || result.label === 'correct'
              ? 'Completed correctly'
              : 'Completed'}{' '}
            - {result.attemptsCount ?? '--'} attempts - {result.score} points
          </p>
        ) : null}
      </div>

      {structured?.summary ? (
        <ExplanationSection title="Clinical takeaway" tone="teal">
          <p className="break-words rounded-[16px] border border-white/8 bg-white/[0.05] px-4 py-3 text-sm leading-6 text-white/74">
            {structured.summary}
          </p>
        </ExplanationSection>
      ) : null}

      {structured?.reasoning || displayText ? (
        <ExplanationSection title="Diagnostic reasoning" tone="teal">
          <p className="whitespace-pre-line break-words text-sm leading-7 text-white/74">
            {structured?.reasoning ?? displayText}
          </p>
        </ExplanationSection>
      ) : null}

      {structured?.keyFindings.length ? (
        <ExplanationList title="Key facts" items={structured.keyFindings} tone="teal" />
      ) : null}

      {structured?.differentials.length ? (
        <ExplanationList
          title="Differentials"
          items={structured.differentials}
          tone="amber"
        />
      ) : null}

      {structured?.clinicalPearl ? (
        <ExplanationSection title="Clinical pearl" tone="amber">
          <p className="break-words text-sm leading-7 text-white/74">
            {structured.clinicalPearl}
          </p>
        </ExplanationSection>
      ) : null}
    </div>
  )
}

function ExplanationSection({
  title,
  tone,
  children,
}: {
  title: string
  tone: 'teal' | 'amber'
  children: ReactNode
}) {
  return (
    <div className="min-w-0">
      <p
        className={`mb-2 font-brand-mono text-[10px] font-semibold uppercase tracking-[0.18em] ${
          tone === 'teal'
            ? 'text-[var(--wardle-color-teal)]/80'
            : 'text-[var(--wardle-color-amber)]/90'
        }`}
      >
        {title}
      </p>
      {children}
    </div>
  )
}

function ExplanationList({
  title,
  items,
  tone,
}: {
  title: string
  items: string[]
  tone: 'teal' | 'amber'
}) {
  return (
    <ExplanationSection title={title} tone={tone}>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item} className="flex min-w-0 gap-3 text-sm leading-6 text-white/72">
            <span
              className={`mt-2 h-2 w-2 shrink-0 rounded-full ${
                tone === 'teal'
                  ? 'bg-[var(--wardle-color-teal)]'
                  : 'bg-[var(--wardle-color-amber)]'
              }`}
            />
            <span className="min-w-0 break-words">{item}</span>
          </li>
        ))}
      </ul>
    </ExplanationSection>
  )
}

function buildTrackGroups({
  todayCases,
  playedCaseId,
  playedExplanation,
  playedResult,
}: {
  todayCases: TodayCase[]
  playedCaseId: string | null
  playedExplanation: GameExplanation | null
  playedResult: GameResult | null
}): TrackGroup[] {
  const byTrack = new Map<PublishTrack, TodayCase[]>()

  for (const todayCase of todayCases) {
    const entries = byTrack.get(todayCase.track) ?? []
    entries.push(todayCase)
    byTrack.set(todayCase.track, entries)
  }

  return Array.from(byTrack.entries())
    .sort(([left], [right]) => getTrackOrder(left) - getTrackOrder(right))
    .map(([track, cases]) => ({
      track,
      label: TRACK_COPY[track]?.label ?? formatTrackLabel(track),
      context:
        TRACK_COPY[track]?.context ??
        'Cases become reviewable after you complete them.',
      cases: [...cases]
        .sort((left, right) => left.sequenceIndex - right.sequenceIndex)
        .map((todayCase) =>
          buildLearnCaseItem({
            todayCase,
            playedCaseId,
            playedExplanation,
            playedResult,
          }),
        ),
    }))
}

function buildLearnCaseItem({
  todayCase,
  playedCaseId,
  playedExplanation,
  playedResult,
}: {
  todayCase: TodayCase
  playedCaseId: string | null
  playedExplanation: GameExplanation | null
  playedResult: GameResult | null
}): LearnCaseItem {
  const isPlayed = todayCase.case.id === playedCaseId
  const status: LearnCaseStatus = isPlayed
    ? playedExplanation
      ? 'unlocked'
      : 'pending'
    : 'locked'

  // TODO(api-gap): backend does not currently expose played explanations grouped by track.
  // The /game/today payload may include case content, but this page only uses the latest
  // played explanation so locked/unplayed explanations are never displayed.
  return {
    dailyCaseId: todayCase.dailyCaseId,
    sequenceIndex: todayCase.sequenceIndex,
    track: todayCase.track,
    title: todayCase.case.title,
    difficulty: todayCase.case.difficulty,
    status,
    explanation: status === 'unlocked' ? playedExplanation : null,
    result: isPlayed ? playedResult : null,
  }
}

function getStatusCounts(cases: LearnCaseItem[]) {
  return cases.reduce(
    (counts, item) => ({
      ...counts,
      [item.status]: counts[item.status] + 1,
    }),
    { unlocked: 0, pending: 0, locked: 0 } satisfies Record<LearnCaseStatus, number>,
  )
}

function getCaseStatusCopy(status: LearnCaseStatus) {
  switch (status) {
    case 'unlocked':
      return 'Ready for focused review'
    case 'pending':
      return 'Learning notes are being prepared'
    case 'locked':
      return 'Not played yet'
  }
}

function StatusPill({
  label,
  tone,
}: {
  label: string
  tone: LearnCaseStatus
}) {
  const toneClass =
    tone === 'unlocked'
      ? 'bg-[var(--wardle-color-teal)] text-white'
      : tone === 'pending'
        ? 'bg-[rgba(244,162,97,0.16)] text-[var(--wardle-color-amber)]'
        : 'bg-white/[0.07] text-white/45'

  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${toneClass}`}
    >
      {label}
    </span>
  )
}

function FocusedEmptyState({
  title,
  copy,
  tone,
}: {
  title: string
  copy: string
  tone: 'pending' | 'locked'
}) {
  return (
    <div
      className={`rounded-[20px] border px-4 py-5 ${
        tone === 'pending'
          ? 'border-[rgba(244,162,97,0.24)] bg-[rgba(244,162,97,0.08)]'
          : 'border-white/[0.08] bg-white/[0.04]'
      }`}
    >
      <p
        className={`font-brand-mono text-[10px] font-semibold uppercase tracking-[0.18em] ${
          tone === 'pending'
            ? 'text-[var(--wardle-color-amber)]/90'
            : 'text-white/42'
        }`}
      >
        {tone === 'pending' ? 'Pending' : 'Protected'}
      </p>
      <h3 className="mt-2 text-lg font-black text-[var(--wardle-color-mint)]">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-6 text-white/62">{copy}</p>
      {tone === 'locked' ? <LockedCasePreview /> : null}
    </div>
  )
}

function getSelectedCaseHeading(item: LearnCaseItem) {
  if (item.status === 'unlocked') {
    return item.title
  }

  if (item.status === 'pending') {
    return 'Preparing learning notes'
  }

  return 'Locked case selected'
}

function getSelectedCaseContext(item: LearnCaseItem) {
  if (item.status === 'unlocked') {
    return 'Move from the case outcome into diagnostic reasoning, differentials, key facts, and clinical pearl.'
  }

  if (item.status === 'pending') {
    return 'The case has been played, but the explanation is still being prepared.'
  }

  return 'This case has not been played yet, so its details remain hidden.'
}

function getTrackOrder(track: PublishTrack) {
  switch (track) {
    case 'DAILY':
      return 1
    case 'PREMIUM':
      return 2
    case 'PRACTICE':
      return 3
    default:
      return 99
  }
}

function formatTrackLabel(track: string) {
  return track
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function EmptyStateCopy({
  copy,
  tone = 'muted',
}: {
  copy: string
  tone?: 'muted' | 'error'
}) {
  return (
    <p
      className={`break-words text-sm leading-6 ${
        tone === 'error' ? 'text-rose-300/90' : 'text-white/58'
      }`}
    >
      {copy}
    </p>
  )
}

function LockedCasePreview() {
  return (
    <div aria-hidden="true" className="mt-3 space-y-2">
      <div className="h-2.5 w-4/5 rounded-full bg-white/[0.08]" />
      <div className="h-2.5 w-3/5 rounded-full bg-white/[0.06]" />
    </div>
  )
}
