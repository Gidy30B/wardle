import { useEffect, useMemo, useState, type ReactNode } from 'react'
import WardleLogo from '../../../components/brand/WardleLogo'
import SurfaceCard from '../../../components/ui/SurfaceCard'
import { coerceStructuredExplanation } from '../gameExplanation'
import type {
  ClinicalClue,
  GameExplanation,
  GameResult,
  LearnLibraryCase,
  LearnLibraryResponse,
  PublishTrack,
} from '../game.types'
import type { RoundViewModel } from '../round.types'

type LearnTabPageProps = {
  explanation: GameExplanation | null
  latestResult: GameResult | null
  latestPlayedExplanation: GameExplanation | null
  latestPlayedResult: GameResult | null
  learnLibrary: LearnLibraryResponse | null
  libraryLoading: boolean
  libraryError: string | null
  roundViewModel: RoundViewModel
}

type DetailTab = 'breakdown' | 'differentials' | 'clues'

const TRACK_COPY: Record<PublishTrack, { label: string; tone: string }> = {
  DAILY: {
    label: 'Daily',
    tone: 'border-[rgba(0,180,166,0.28)] bg-[rgba(0,180,166,0.12)] text-[var(--wardle-color-teal)]',
  },
  PREMIUM: {
    label: 'Premium',
    tone: 'border-[rgba(244,162,97,0.28)] bg-[rgba(244,162,97,0.12)] text-[var(--wardle-color-amber)]',
  },
  PRACTICE: {
    label: 'Practice',
    tone: 'border-white/12 bg-white/[0.06] text-white/68',
  },
}

const DIFFICULTY_TONES: Record<string, string> = {
  easy: 'bg-[rgba(0,180,166,0.12)] text-[var(--wardle-color-teal)]',
  medium: 'bg-[rgba(244,162,97,0.12)] text-[var(--wardle-color-amber)]',
  hard: 'bg-rose-400/12 text-rose-300',
}

const CLUE_TYPE_COPY: Record<ClinicalClue['type'], { label: string; abbr: string; tone: string }> = {
  history: {
    label: 'History',
    abbr: 'Hx',
    tone: 'bg-[rgba(0,180,166,0.14)] text-[var(--wardle-color-teal)]',
  },
  symptom: {
    label: 'Symptom',
    abbr: 'Sx',
    tone: 'bg-[rgba(244,162,97,0.14)] text-[var(--wardle-color-amber)]',
  },
  vital: {
    label: 'Vitals',
    abbr: 'Vt',
    tone: 'bg-violet-400/14 text-violet-300',
  },
  exam: {
    label: 'Exam',
    abbr: 'Ex',
    tone: 'bg-[rgba(0,180,166,0.14)] text-[var(--wardle-color-teal)]',
  },
  lab: {
    label: 'Lab',
    abbr: 'Lb',
    tone: 'bg-rose-400/14 text-rose-300',
  },
  imaging: {
    label: 'Imaging',
    abbr: 'Im',
    tone: 'bg-emerald-400/14 text-emerald-300',
  },
}

export default function LearnTabPage({
  explanation,
  latestResult,
  latestPlayedExplanation,
  latestPlayedResult,
  learnLibrary,
  libraryLoading,
  libraryError,
  roundViewModel,
}: LearnTabPageProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<DetailTab>('breakdown')

  const completedCases = useMemo(
    () =>
      mergeLatestPlayedCase({
        libraryCases: learnLibrary?.cases ?? [],
        explanation,
        latestResult,
        latestPlayedExplanation,
        latestPlayedResult,
        roundViewModel,
      }),
    [
      explanation,
      latestPlayedExplanation,
      latestPlayedResult,
      latestResult,
      learnLibrary,
      roundViewModel,
    ],
  )

  const selectedCase =
    completedCases.find((item) => item.dailyCaseId === selectedCaseId) ?? null
  const activeCase = selectedCase ?? completedCases[0] ?? null

  const solvedCount = completedCases.filter((item) => item.playerResult.solved).length
  const missedCount = completedCases.length - solvedCount
  const trackCount = new Set(completedCases.map((item) => item.track)).size

  useEffect(() => {
    if (!completedCases.length) {
      setSelectedCaseId(null)
      return
    }

    if (selectedCaseId && !completedCases.some((item) => item.dailyCaseId === selectedCaseId)) {
      setSelectedCaseId(null)
      setActiveTab('breakdown')
    }
  }, [completedCases, selectedCaseId])

  const selectCase = (dailyCaseId: string) => {
    setSelectedCaseId(dailyCaseId)
    setActiveTab('breakdown')
  }

  const clearSelectedCase = () => {
    setSelectedCaseId(null)
    setActiveTab('breakdown')
  }

  return (
    <>
      <main className="flex h-full min-h-0 w-full max-w-full flex-1 basis-0 flex-col overflow-x-hidden overflow-y-auto overscroll-contain pb-4 lg:hidden">
        {!selectedCase ? (
          <>
            <MobileLearnHeader />
            <MobileSummaryStrip
              cases={completedCases}
              solvedCount={solvedCount}
              loading={libraryLoading}
              error={libraryError}
            />
            {completedCases.length > 0 ? (
              <MobileCaseList cases={completedCases} onSelectCase={selectCase} />
            ) : !libraryLoading ? (
              <MobileEmptyState />
            ) : null}
          </>
        ) : (
          <MobileCaseDetail
            item={selectedCase}
            activeTab={activeTab}
            onChangeTab={setActiveTab}
            onBack={clearSelectedCase}
          />
        )}
      </main>

      <main className="hidden h-full min-h-0 w-full max-w-full flex-1 basis-0 flex-col overflow-x-hidden overflow-y-auto overscroll-contain px-1 pb-4 pt-1 sm:px-2 lg:flex">
        <div className="min-w-0 max-w-full space-y-4 overflow-x-hidden">
          <LearnHeader
            completedCount={completedCases.length}
            solvedCount={solvedCount}
            missedCount={missedCount}
            trackCount={trackCount}
          />

          {libraryError ? <InlineNotice tone="error" copy="Unable to load completed cases." /> : null}
          {libraryLoading ? <InlineNotice tone="muted" copy="Loading completed cases..." /> : null}

          {completedCases.length > 0 ? (
            <div className="grid min-w-0 grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] gap-4">
              <CaseLibraryList
                cases={completedCases}
                selectedCaseId={activeCase?.dailyCaseId ?? null}
                onSelectCase={selectCase}
              />
              <CaseDetail
                item={activeCase}
                activeTab={activeTab}
                onChangeTab={setActiveTab}
                onBack={clearSelectedCase}
              />
            </div>
          ) : !libraryLoading ? (
            <SurfaceCard
              eyebrow="Completed Cases"
              title="No explanations yet"
              className="min-w-0 max-w-full overflow-hidden"
            >
              <p className="max-w-2xl text-sm leading-6 text-white/62">
                Complete a case to add its explanation, clues, and differentials to this
                library.
              </p>
            </SurfaceCard>
          ) : null}
        </div>
      </main>
    </>
  )
}

function MobileLearnHeader() {
  return (
    <div className="sticky top-0 z-20 flex min-w-0 items-center justify-between border-b border-white/[0.05] bg-[var(--wardle-color-charcoal)] px-5 py-3">
      <WardleLogo size="sm" />
      <span className="font-brand-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-white/34">
        Learn
      </span>
    </div>
  )
}

function MobileSummaryStrip({
  cases,
  solvedCount,
  loading,
  error,
}: {
  cases: LearnLibraryCase[]
  solvedCount: number
  loading: boolean
  error: string | null
}) {
  return (
    <section className="mx-4 mt-4 rounded-[16px] border border-[rgba(0,180,166,0.18)] bg-[rgba(26,60,94,0.35)] px-4 py-3">
      <div className="flex min-w-0 items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-bold text-[var(--wardle-color-mint)]">Completed cases</p>
          <p className="mt-1 text-xs text-white/46">
            {loading
              ? 'Loading archive'
              : error
                ? 'Archive unavailable'
                : `${solvedCount} of ${cases.length} solved`}
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          {cases.slice(0, 8).map((item) => (
            <span
              key={item.dailyCaseId}
              className={`h-2.5 w-2.5 rounded-full border ${
                item.playerResult.solved
                  ? 'border-[var(--wardle-color-teal)] bg-[var(--wardle-color-teal)]'
                  : 'border-rose-300 bg-rose-400/55'
              }`}
            />
          ))}
        </div>
      </div>
      {error ? (
        <p className="mt-3 rounded-[12px] border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-xs leading-5 text-rose-200">
          Unable to load completed cases.
        </p>
      ) : null}
    </section>
  )
}

function MobileCaseList({
  cases,
  onSelectCase,
}: {
  cases: LearnLibraryCase[]
  onSelectCase: (dailyCaseId: string) => void
}) {
  return (
    <section className="px-4 pt-4">
      <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-white/42">
        Case archive
      </p>
      <div className="space-y-3">
        {cases.map((item) => (
          <MobileCaseCard
            key={item.dailyCaseId}
            item={item}
            onSelect={() => onSelectCase(item.dailyCaseId)}
          />
        ))}
      </div>
    </section>
  )
}

function MobileCaseCard({
  item,
  onSelect,
}: {
  item: LearnLibraryCase
  onSelect: () => void
}) {
  const explanation = coerceStructuredExplanation(item.case.explanation ?? {})
  const diagnosis = item.case.diagnosis || item.case.title
  const resultDots = buildResultDots(item.playerResult)

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`block w-full overflow-hidden rounded-[16px] border text-left transition ${
        item.playerResult.solved
          ? 'border-[rgba(0,180,166,0.2)] bg-[rgba(26,60,94,0.25)]'
          : 'border-rose-300/15 bg-[rgba(26,60,94,0.2)]'
      }`}
    >
      <div className="px-4 py-3">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="flex min-w-0 flex-wrap gap-2">
            <TrackBadge track={item.track} />
            <DifficultyBadge difficulty={item.case.difficulty} />
          </div>
          <ResultBadge solved={item.playerResult.solved} />
        </div>
        <p className="mt-3 break-words text-base font-black text-[var(--wardle-color-mint)]">
          {diagnosis}
        </p>
        <p className="mt-1 text-xs text-white/46">
          {item.case.clues.length} clues
          {explanation?.differentials.length ? ` - ${explanation.differentials.length} differentials` : ''}
        </p>
      </div>
      <div className="flex min-w-0 items-center justify-between gap-3 border-t border-white/[0.05] px-4 py-3">
        <ResultDots dots={resultDots} />
        <div className="flex shrink-0 items-center gap-3 text-xs text-white/48">
          <span>{item.playerResult.attemptsUsed}/6 clues</span>
          {item.playerResult.timeSecs !== null ? (
            <span className="font-brand-mono">{formatTime(item.playerResult.timeSecs)}</span>
          ) : null}
          <span aria-hidden="true" className="text-base leading-none text-white/32">&gt;</span>
        </div>
      </div>
    </button>
  )
}

function MobileCaseDetail({
  item,
  activeTab,
  onChangeTab,
  onBack,
}: {
  item: LearnLibraryCase
  activeTab: DetailTab
  onChangeTab: (tab: DetailTab) => void
  onBack: () => void
}) {
  const explanation = coerceStructuredExplanation(item.case.explanation ?? {})

  return (
    <div className="min-w-0 pb-4">
      <div className="sticky top-0 z-20 flex min-w-0 items-center justify-between gap-3 border-b border-white/[0.05] bg-[var(--wardle-color-charcoal)] px-5 py-3">
        <button
          type="button"
          onClick={onBack}
          className="border-0 bg-transparent p-0 text-sm font-bold text-[var(--wardle-color-teal)]"
        >
          All cases
        </button>
        <span className="font-brand-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-white/34">
          {item.completedAt.slice(0, 10)}
        </span>
      </div>

      <section className="mx-4 mt-4 overflow-hidden rounded-[16px] border border-[rgba(0,180,166,0.18)] bg-[rgba(26,60,94,0.35)]">
        <div className="px-4 py-4">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="flex min-w-0 flex-wrap gap-2">
              <TrackBadge track={item.track} />
              <DifficultyBadge difficulty={item.case.difficulty} />
            </div>
            <span className="font-brand-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--wardle-color-teal)]/70">
              #{item.sequenceIndex}
            </span>
          </div>
          <h2 className="mt-3 break-words text-xl font-black text-[var(--wardle-color-mint)]">
            {item.case.diagnosis || item.case.title}
          </h2>
          <p className="mt-1 text-xs text-white/46">{item.case.clues.length} clues</p>
        </div>
        <div className="flex min-w-0 items-center gap-3 border-t border-white/[0.06] px-4 py-3">
          <ResultDots dots={buildResultDots(item.playerResult)} />
          <p className="shrink-0 text-xs text-white/50">
            {item.playerResult.solved
              ? `${item.playerResult.attemptsUsed}/6`
              : 'Missed'}
            {item.playerResult.timeSecs !== null ? ` - ${formatTime(item.playerResult.timeSecs)}` : ''}
          </p>
        </div>
      </section>

      <div className="px-4 pt-4">
        <TabSwitcher activeTab={activeTab} onChangeTab={onChangeTab} />
      </div>

      <div className="px-4 pt-4">
        {activeTab === 'breakdown' ? <BreakdownTab explanation={explanation} /> : null}
        {activeTab === 'differentials' ? (
          <DifferentialsTab differentials={explanation?.differentials ?? []} />
        ) : null}
        {activeTab === 'clues' ? <CluesTab clues={item.case.clues} /> : null}
      </div>
    </div>
  )
}

function MobileEmptyState() {
  return (
    <section className="mx-4 mt-4 rounded-[16px] border border-white/10 bg-white/[0.04] px-4 py-5">
      <p className="text-base font-black text-[var(--wardle-color-mint)]">No explanations yet</p>
      <p className="mt-2 text-sm leading-6 text-white/58">
        Complete a case to add it to your clinical reasoning archive.
      </p>
    </section>
  )
}

function LearnHeader({
  completedCount,
  solvedCount,
  missedCount,
  trackCount,
}: {
  completedCount: number
  solvedCount: number
  missedCount: number
  trackCount: number
}) {
  return (
    <section className="relative overflow-hidden rounded-[24px] border border-white/[0.06] bg-[linear-gradient(145deg,rgba(26,60,94,0.78),rgba(30,30,44,0.98)_70%)] px-5 py-5 shadow-[0_22px_54px_rgba(0,0,0,0.22)]">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-white/[0.06]" />
      <div className="relative min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <WardleLogo size="sm" subtitle="Explanation Library" />
          <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-white/70">
            {completedCount} completed
          </span>
        </div>
        <h1 className="mt-5 text-2xl font-black text-[var(--wardle-color-mint)]">
          Case archive
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/58">
          Completed cases, saved explanations, clue trails, and ruled-out diagnoses.
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2 sm:max-w-xl">
          <MiniStat label="Solved" value={String(solvedCount)} tone="teal" />
          <MiniStat label="Missed" value={String(missedCount)} tone="rose" />
          <MiniStat label="Tracks" value={String(trackCount)} tone="amber" />
        </div>
      </div>
    </section>
  )
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'teal' | 'amber' | 'rose'
}) {
  const toneClass =
    tone === 'teal'
      ? 'text-[var(--wardle-color-teal)]'
      : tone === 'amber'
        ? 'text-[var(--wardle-color-amber)]'
        : 'text-rose-300'

  return (
    <div className="rounded-[14px] border border-white/10 bg-white/[0.05] px-3 py-2">
      <p className={`text-lg font-black ${toneClass}`}>{value}</p>
      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/42">
        {label}
      </p>
    </div>
  )
}

function CaseLibraryList({
  className,
  cases,
  selectedCaseId,
  onSelectCase,
}: {
  className?: string
  cases: LearnLibraryCase[]
  selectedCaseId: string | null
  onSelectCase: (dailyCaseId: string) => void
}) {
  const solvedCount = cases.filter((item) => item.playerResult.solved).length

  return (
    <SurfaceCard
      eyebrow="Completed Cases"
      title="Clinical archive"
      className={`min-w-0 max-w-full overflow-hidden ${className ?? ''}`}
    >
      <div className="mb-4 rounded-[16px] border border-[rgba(0,180,166,0.16)] bg-[rgba(26,60,94,0.24)] px-4 py-3">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-[var(--wardle-color-mint)]">
              {solvedCount} of {cases.length} solved
            </p>
            <p className="mt-1 text-xs text-white/46">Explanation details, clue trails, and differentials.</p>
          </div>
          <div className="flex shrink-0 gap-1.5">
            {cases.slice(0, 8).map((item) => (
              <span
                key={item.dailyCaseId}
                className={`h-2.5 w-2.5 rounded-full border ${
                  item.playerResult.solved
                    ? 'border-[var(--wardle-color-teal)] bg-[var(--wardle-color-teal)]'
                    : 'border-rose-300 bg-rose-400/55'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="min-w-0 space-y-3">
        {cases.map((item) => (
          <CaseLibraryCard
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

function CaseLibraryCard({
  item,
  selected,
  onSelect,
}: {
  item: LearnLibraryCase
  selected: boolean
  onSelect: () => void
}) {
  const resultDots = buildResultDots(item.playerResult)
  const diagnosis = item.case.diagnosis || item.case.title
  const explanation = coerceStructuredExplanation(item.case.explanation ?? {})
  const differentialCount = explanation?.differentials.length ?? 0

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`block w-full min-w-0 overflow-hidden rounded-[18px] border text-left transition ${
        selected
          ? 'border-[rgba(0,180,166,0.42)] bg-[rgba(0,180,166,0.12)]'
          : item.playerResult.solved
            ? 'border-[rgba(0,180,166,0.2)] bg-[rgba(26,60,94,0.22)] hover:bg-[rgba(26,60,94,0.32)]'
            : 'border-rose-300/14 bg-[rgba(26,60,94,0.18)] hover:bg-[rgba(26,60,94,0.28)]'
      }`}
    >
      <div className="px-4 py-3">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="flex min-w-0 flex-wrap gap-2">
            <TrackBadge track={item.track} />
            <DifficultyBadge difficulty={item.case.difficulty} />
          </div>
          <span className="shrink-0 font-brand-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-white/32">
            #{item.sequenceIndex}
          </span>
        </div>
        <p className="mt-3 break-words text-base font-black text-[var(--wardle-color-mint)]">
          {diagnosis}
        </p>
        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
          <ResultBadge solved={item.playerResult.solved} />
          <span className="text-xs text-white/42">{item.case.clues.length} clues</span>
          {differentialCount > 0 ? (
            <span className="text-xs text-white/42">{differentialCount} differentials</span>
          ) : null}
        </div>
      </div>
      <div className="flex min-w-0 items-center justify-between gap-3 border-t border-white/[0.05] px-4 py-3">
        <ResultDots dots={resultDots} />
        <div className="flex shrink-0 items-center gap-3 text-xs text-white/48">
          <span>{item.playerResult.attemptsUsed}/6 clues</span>
          {item.playerResult.timeSecs !== null ? (
            <span className="font-brand-mono">{formatTime(item.playerResult.timeSecs)}</span>
          ) : null}
          <span aria-hidden="true" className="text-base leading-none text-white/32">&gt;</span>
        </div>
      </div>
    </button>
  )
}

function CaseDetail({
  className,
  item,
  activeTab,
  onChangeTab,
  onBack,
}: {
  className?: string
  item: LearnLibraryCase | null
  activeTab: DetailTab
  onChangeTab: (tab: DetailTab) => void
  onBack: () => void
}) {
  if (!item) {
    return null
  }

  const explanation = coerceStructuredExplanation(item.case.explanation ?? {})

  return (
    <SurfaceCard
      className={`min-w-0 max-w-full overflow-hidden ${className ?? ''}`}
    >
      <div className="min-w-0 space-y-4">
        <div className="flex min-w-0 items-center justify-between gap-3 lg:hidden">
          <button
            type="button"
            onClick={onBack}
            className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-bold text-[var(--wardle-color-teal)]"
          >
            All cases
          </button>
          <span className="font-brand-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-white/34">
            {item.completedAt.slice(0, 10)}
          </span>
        </div>

        <div className="overflow-hidden rounded-[18px] border border-[rgba(0,180,166,0.18)] bg-[rgba(26,60,94,0.28)]">
          <div className="px-4 py-4">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <TrackBadge track={item.track} />
                <DifficultyBadge difficulty={item.case.difficulty} />
              </div>
              <span className="font-brand-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--wardle-color-teal)]/70">
                #{item.sequenceIndex}
              </span>
            </div>
            <h2 className="mt-3 break-words text-xl font-black text-[var(--wardle-color-mint)]">
              {item.case.diagnosis || item.case.title}
            </h2>
            <p className="mt-1 text-xs text-white/42">
              {item.case.clues.length} clues - {item.case.date || item.completedAt.slice(0, 10)}
            </p>
          </div>
          <div className="flex min-w-0 items-center gap-3 border-t border-white/[0.06] px-4 py-3">
            <ResultDots dots={buildResultDots(item.playerResult)} />
            <p className="text-xs text-white/50">
              {item.playerResult.solved
                ? `Solved in ${item.playerResult.attemptsUsed} clue${item.playerResult.attemptsUsed === 1 ? '' : 's'}`
                : 'Completed without solving'}
              {item.playerResult.timeSecs !== null
                ? ` - ${formatTime(item.playerResult.timeSecs)}`
                : ''}
            </p>
          </div>
        </div>

        <TabSwitcher activeTab={activeTab} onChangeTab={onChangeTab} />

        {activeTab === 'breakdown' ? (
          <BreakdownTab explanation={explanation} />
        ) : null}
        {activeTab === 'differentials' ? (
          <DifferentialsTab differentials={explanation?.differentials ?? []} />
        ) : null}
        {activeTab === 'clues' ? <CluesTab clues={item.case.clues} /> : null}
      </div>
    </SurfaceCard>
  )
}

function TabSwitcher({
  activeTab,
  onChangeTab,
}: {
  activeTab: DetailTab
  onChangeTab: (tab: DetailTab) => void
}) {
  const tabs: Array<{ id: DetailTab; label: string }> = [
    { id: 'breakdown', label: 'Breakdown' },
    { id: 'differentials', label: 'Differentials' },
    { id: 'clues', label: 'Clues' },
  ]

  return (
    <div className="grid grid-cols-3 gap-1 rounded-full bg-[rgba(26,60,94,0.5)] p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChangeTab(tab.id)}
          className={`rounded-full px-2 py-2 text-xs font-bold transition ${
            activeTab === tab.id
              ? 'bg-[var(--wardle-color-teal)] text-white'
              : 'text-white/50 hover:text-white/78'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

function BreakdownTab({
  explanation,
}: {
  explanation: ReturnType<typeof coerceStructuredExplanation>
}) {
  if (!explanation) {
    return <InlineNotice tone="muted" copy="Explanation is still being prepared." />
  }

  return (
    <div className="min-w-0 space-y-4">
      {explanation.summary ? (
        <ReviewSection title="Summary" tone="teal">
          <p className="break-words text-sm leading-6 text-white/74">
            {explanation.summary}
          </p>
        </ReviewSection>
      ) : null}

      {explanation.keyFindings.length ? (
        <ReviewSection title="Key Findings" tone="teal">
          <ul className="space-y-2">
            {explanation.keyFindings.map((finding) => (
              <li key={finding} className="flex min-w-0 gap-3 rounded-[14px] border border-white/[0.06] bg-white/[0.04] px-3 py-2 text-sm leading-6 text-white/72">
                <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--wardle-color-teal)]" />
                <span className="min-w-0 break-words">{finding}</span>
              </li>
            ))}
          </ul>
        </ReviewSection>
      ) : null}

      {explanation.reasoning ? (
        <ReviewSection title="Reasoning Chain" tone="amber">
          <div className="overflow-hidden rounded-[16px] border border-white/[0.06] bg-white/[0.04]">
            {splitReasoning(explanation.reasoning).map((step, index, steps) => (
              <div
                key={`${index}-${step}`}
                className={`flex min-w-0 gap-3 px-3 py-3 ${
                  index < steps.length - 1 ? 'border-b border-white/[0.05]' : ''
                }`}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] bg-[rgba(0,180,166,0.14)] text-[10px] font-black text-[var(--wardle-color-teal)]">
                  {index + 1}
                </span>
                <p className="min-w-0 break-words text-sm leading-6 text-white/72">
                  {step}
                </p>
              </div>
            ))}
          </div>
        </ReviewSection>
      ) : null}
    </div>
  )
}

function DifferentialsTab({ differentials }: { differentials: string[] }) {
  if (!differentials.length) {
    return <InlineNotice tone="muted" copy="No differentials were stored for this case." />
  }

  return (
    <div className="min-w-0 space-y-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/42">
        Why not these?
      </p>
      {differentials.map((differential) => (
        <div
          key={differential}
          className="rounded-[16px] border border-white/[0.06] bg-[rgba(26,60,94,0.22)] px-4 py-3"
        >
          <div className="flex min-w-0 items-start justify-between gap-3">
            <p className="min-w-0 break-words text-sm font-bold text-[var(--wardle-color-mint)]">
              {differential}
            </p>
            <span className="shrink-0 rounded-full bg-rose-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-rose-300">
              Ruled out
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

function CluesTab({ clues }: { clues: ClinicalClue[] }) {
  const sortedClues = [...clues].sort((left, right) => left.order - right.order)

  return (
    <div className="min-w-0 space-y-2">
      {sortedClues.map((clue, index) => {
        const typeCopy = CLUE_TYPE_COPY[clue.type]

        return (
          <div
            key={clue.id}
            className="flex min-w-0 gap-3 rounded-[16px] border border-white/[0.06] bg-white/[0.04] px-4 py-3"
          >
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] text-[10px] font-black ${typeCopy.tone}`}>
              {typeCopy.abbr}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/42">
                Clue {index + 1} - {typeCopy.label}
              </p>
              <p className="mt-1 break-words text-sm leading-6 text-white/72">
                {clue.value}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ReviewSection({
  title,
  tone,
  children,
}: {
  title: string
  tone: 'teal' | 'amber'
  children: ReactNode
}) {
  return (
    <section className="min-w-0">
      <p
        className={`mb-2 text-[10px] font-bold uppercase tracking-[0.16em] ${
          tone === 'teal'
            ? 'text-[var(--wardle-color-teal)]/85'
            : 'text-[var(--wardle-color-amber)]/90'
        }`}
      >
        {title}
      </p>
      {children}
    </section>
  )
}

function TrackBadge({ track }: { track: PublishTrack }) {
  const copy = TRACK_COPY[track] ?? TRACK_COPY.DAILY

  return (
    <span className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${copy.tone}`}>
      {copy.label}
    </span>
  )
}

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const normalized = difficulty.trim().toLowerCase()
  const tone = DIFFICULTY_TONES[normalized] ?? 'bg-white/[0.07] text-white/58'

  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${tone}`}>
      {normalized || 'standard'}
    </span>
  )
}

function ResultBadge({ solved }: { solved: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${
        solved
          ? 'bg-[rgba(0,180,166,0.14)] text-[var(--wardle-color-teal)]'
          : 'bg-rose-400/12 text-rose-300'
      }`}
    >
      {solved ? 'Solved' : 'Missed'}
    </span>
  )
}

function ResultDots({ dots }: { dots: Array<'used' | 'correct' | 'wrong' | 'empty'> }) {
  return (
    <div className="flex min-w-0 flex-1 gap-1">
      {dots.map((dot, index) => (
        <span
          key={`${dot}-${index}`}
          className={`h-1.5 min-w-0 flex-1 rounded-full ${
            dot === 'correct'
              ? 'bg-[var(--wardle-color-teal)]'
              : dot === 'used'
                ? 'bg-[rgba(0,180,166,0.36)]'
                : dot === 'wrong'
                  ? 'bg-rose-400'
                  : 'bg-white/[0.08]'
          }`}
        />
      ))}
    </div>
  )
}

function InlineNotice({
  tone,
  copy,
}: {
  tone: 'muted' | 'error'
  copy: string
}) {
  return (
    <div
      className={`rounded-[18px] border px-4 py-3 text-sm leading-6 ${
        tone === 'error'
          ? 'border-rose-300/20 bg-rose-400/10 text-rose-200'
          : 'border-white/10 bg-white/[0.04] text-white/58'
      }`}
    >
      {copy}
    </div>
  )
}

function buildResultDots(result: LearnLibraryCase['playerResult']) {
  return Array.from({ length: 6 }, (_, index): 'used' | 'correct' | 'wrong' | 'empty' => {
    if (index >= result.attemptsUsed) {
      return 'empty'
    }

    if (result.solved && index === result.attemptsUsed - 1) {
      return 'correct'
    }

    return result.solved ? 'used' : 'wrong'
  })
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes}:${String(remainder).padStart(2, '0')}`
}

function splitReasoning(reasoning: string) {
  return reasoning
    .split(/\n{2,}|\n/)
    .map((step) => step.trim())
    .filter((step) => step.length > 0)
}

function mergeLatestPlayedCase({
  libraryCases,
  latestPlayedExplanation,
  latestPlayedResult,
  explanation,
  latestResult,
  roundViewModel,
}: {
  libraryCases: LearnLibraryCase[]
  latestPlayedExplanation: GameExplanation | null
  latestPlayedResult: GameResult | null
  explanation: GameExplanation | null
  latestResult: GameResult | null
  roundViewModel: RoundViewModel
}) {
  const latest = latestPlayedResult ?? latestResult
  const latestExplanation = latestPlayedExplanation ?? explanation ?? latest?.explanation ?? null
  const latestCase = latest?.case

  if (!latest?.gameOver || !latestCase || !latestExplanation) {
    return libraryCases
  }

  const alreadyPresent = libraryCases.some((item) => item.case.id === latestCase.id)
  if (alreadyPresent) {
    return libraryCases
  }

  const attemptsUsed = latest.attemptsCount ?? latest.clueIndex + 1
  const fallbackCase: LearnLibraryCase = {
    sessionId: 'latest',
    dailyCaseId: latestCase.id,
    track: 'DAILY',
    sequenceIndex: 1,
    completedAt: latest.completedAt ?? new Date().toISOString(),
    playerResult: {
      solved: latest.gameOverReason === 'correct' || latest.isTerminalCorrect,
      attemptsUsed,
      timeSecs: roundViewModel.elapsedSeconds ?? null,
    },
    case: {
      id: latestCase.id,
      title: roundViewModel.caseId ?? 'Completed case',
      diagnosis: 'Completed case',
      date: '',
      difficulty: '',
      clues: latestCase.clues,
      explanation: latestExplanation,
    },
  }

  return [fallbackCase, ...libraryCases]
}
