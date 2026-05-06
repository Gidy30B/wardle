import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { SlidersHorizontal } from 'lucide-react'
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

type LearnPerformanceSummary = {
  accuracyPct: number | null
  casesDone: number
  averageCluesUsed: number | null
  averageTimeSecs: number | null
  specialties: Array<{
    key: string
    label: string
    casesDone: number
    accuracyPct: number | null
  }>
}

type LearnFilters = {
  specialty: string
  track: 'all' | PublishTrack
  result: 'all' | 'solved' | 'missed'
  difficulty: string
}

type LearnFilterOptions = {
  specialties: LearnPerformanceSummary['specialties']
  tracks: PublishTrack[]
  difficulties: Array<{ key: string; label: string }>
}

type LearnConfidence = 'hard' | 'partial' | 'solid'

type LearnReviewState = {
  confidence?: LearnConfidence
  recallAttempts: number
  recallCorrect: number
  lastReviewedAt?: string
  nextReviewAt?: string
  lastAnswer?: string
}

type LearnReviewStateByCaseKey = Record<string, LearnReviewState>

const LEARN_REVIEW_STORAGE_KEY = 'wardle.learn.review.v1'

const ALL_FILTERS: LearnFilters = {
  specialty: 'all',
  track: 'all',
  result: 'all',
  difficulty: 'all',
}

const TRACK_COPY: Record<PublishTrack, { label: string; tone: string }> = {
  DAILY: {
    label: 'Daily',
    tone: 'border-[rgba(0,180,166,0.32)] bg-[rgba(0,180,166,0.14)] text-[var(--wardle-color-teal)]',
  },
  PREMIUM: {
    label: 'Premium',
    tone: 'border-[rgba(244,162,97,0.32)] bg-[rgba(244,162,97,0.14)] text-[var(--wardle-color-amber)]',
  },
  PRACTICE: {
    label: 'Practice',
    tone: 'border-white/[0.12] bg-white/[0.06] text-white/60',
  },
}

const DIFFICULTY_TONES: Record<string, string> = {
  easy: 'border border-[rgba(0,180,166,0.25)] bg-[rgba(0,180,166,0.13)] text-[var(--wardle-color-teal)]',
  medium: 'border border-[rgba(244,162,97,0.25)] bg-[rgba(244,162,97,0.13)] text-[var(--wardle-color-amber)]',
  hard: 'border border-rose-400/[0.25] bg-rose-400/[0.13] text-rose-300',
}

const DIFFICULTY_ACTIVE_STYLES: Record<string, { bg: string; text: string }> = {
  easy: { bg: 'rgba(0,180,166,0.18)', text: 'var(--wardle-color-teal)' },
  medium: { bg: 'rgba(244,162,97,0.18)', text: 'var(--wardle-color-amber)' },
  hard: { bg: 'rgba(248,113,113,0.14)', text: 'rgb(252,165,165)' },
}

const CLUE_TYPE_COPY: Record<ClinicalClue['type'], { label: string; abbr: string; tone: string }> = {
  history: {
    label: 'History',
    abbr: 'Hx',
    tone: 'border-[rgba(0,180,166,0.3)] bg-[rgba(0,180,166,0.15)] text-[var(--wardle-color-teal)]',
  },
  symptom: {
    label: 'Symptom',
    abbr: 'Sx',
    tone: 'border-[rgba(244,162,97,0.3)] bg-[rgba(244,162,97,0.15)] text-[var(--wardle-color-amber)]',
  },
  vital: {
    label: 'Vitals',
    abbr: 'Vt',
    tone: 'border-violet-400/[0.3] bg-violet-400/[0.15] text-violet-300',
  },
  exam: {
    label: 'Exam',
    abbr: 'Ex',
    tone: 'border-[rgba(0,180,166,0.3)] bg-[rgba(0,180,166,0.15)] text-[var(--wardle-color-teal)]',
  },
  lab: {
    label: 'Lab',
    abbr: 'Lb',
    tone: 'border-rose-400/[0.3] bg-rose-400/[0.15] text-rose-300',
  },
  imaging: {
    label: 'Imaging',
    abbr: 'Im',
    tone: 'border-emerald-400/[0.3] bg-emerald-400/[0.15] text-emerald-300',
  },
}

const CLUE_TYPE_TEXT_TONES: Record<ClinicalClue['type'], string> = {
  history: 'text-[var(--wardle-color-teal)]',
  symptom: 'text-[var(--wardle-color-amber)]',
  vital: 'text-violet-300',
  exam: 'text-[var(--wardle-color-teal)]',
  lab: 'text-rose-300',
  imaging: 'text-emerald-300',
}

const CONFIDENCE_REVIEW_DAYS: Record<LearnConfidence, number> = {
  hard: 2,
  partial: 7,
  solid: 30,
}

const CONFIDENCE_COPY: Record<
  LearnConfidence,
  { label: string; sublabel: string; tone: 'rose' | 'amber' | 'teal'; marker: string }
> = {
  hard: { label: 'Hard', sublabel: 'Review in 2 days', tone: 'rose', marker: 'R' },
  partial: { label: 'Partial', sublabel: 'Review in 7 days', tone: 'amber', marker: 'P' },
  solid: { label: 'Solid', sublabel: 'Review in 30 days', tone: 'teal', marker: 'S' },
}

const SPECIALTY_DOT_COLORS = [
  '#f4a261',
  '#a78bfa',
  '#34d399',
  '#60a5fa',
  '#f472b6',
  '#fb923c',
  '#4ade80',
]

const TRACK_LABEL: Record<string, string> = {
  DAILY: 'Daily',
  PREMIUM: 'Premium',
  PRACTICE: 'Practice',
}

// ─── Root page ────────────────────────────────────────────────────────────────

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
  const [filters, setFilters] = useState<LearnFilters>(ALL_FILTERS)
  const [showArchiveFilters, setShowArchiveFilters] = useState(false)
  const [studyQueueCaseIds, setStudyQueueCaseIds] = useState<string[] | null>(null)
  const [studyQueueIndex, setStudyQueueIndex] = useState(0)
  const [reviewStateByCaseKey, setReviewStateByCaseKey] = useState<LearnReviewStateByCaseKey>(
    readLearnReviewState,
  )

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
    [explanation, latestPlayedExplanation, latestPlayedResult, latestResult, learnLibrary, roundViewModel],
  )

  const filterOptions = useMemo(() => buildLearnFilterOptions(completedCases), [completedCases])
  const filteredCases = useMemo(() => filterLearnCases(completedCases, filters), [completedCases, filters])
  const unfilteredSummary = useMemo(
    () => getLearnPerformanceSummary(learnLibrary, completedCases),
    [completedCases, learnLibrary],
  )
  const displayedSummary = useMemo(
    () => hasActiveFilters(filters) ? deriveLearnPerformanceSummary(filteredCases) : unfilteredSummary,
    [filteredCases, filters, unfilteredSummary],
  )
  const missedCases = useMemo(() => getMissedCases(completedCases), [completedCases])
  const dueReviewCases = useMemo(
    () => getDueReviewCases(completedCases, reviewStateByCaseKey),
    [completedCases, reviewStateByCaseKey],
  )

  const selectedCase = filteredCases.find((item) => item.dailyCaseId === selectedCaseId) ?? null
  const activeCase = selectedCase ?? filteredCases[0] ?? null
  const studyQueueCases = useMemo(() => {
    if (!studyQueueCaseIds) return []
    const caseById = new Map(completedCases.map((item) => [item.dailyCaseId, item]))
    return studyQueueCaseIds
      .map((id) => caseById.get(id))
      .filter((item): item is LearnLibraryCase => item !== undefined)
  }, [completedCases, studyQueueCaseIds])

  useEffect(() => {
    if (!filteredCases.length) {
      setSelectedCaseId(null)
      setStudyQueueCaseIds(null)
      setStudyQueueIndex(0)
      return
    }
    if (selectedCaseId && !filteredCases.some((item) => item.dailyCaseId === selectedCaseId)) {
      setSelectedCaseId(null)
      setActiveTab('breakdown')
    }
  }, [filteredCases, selectedCaseId])

  useEffect(() => {
    writeLearnReviewState(reviewStateByCaseKey)
  }, [reviewStateByCaseKey])

  useEffect(() => {
    if (!studyQueueCaseIds) return
    if (!studyQueueCases.length) {
      setStudyQueueCaseIds(null)
      setStudyQueueIndex(0)
      return
    }
    if (studyQueueIndex >= studyQueueCases.length) {
      setStudyQueueIndex(Math.max(0, studyQueueCases.length - 1))
    }
  }, [studyQueueCaseIds, studyQueueCases.length, studyQueueIndex])

  const selectCase = (dailyCaseId: string) => {
    setStudyQueueCaseIds(null)
    setStudyQueueIndex(0)
    setSelectedCaseId(dailyCaseId)
    setActiveTab('breakdown')
  }

  const startStudyQueue = () => {
    if (!filteredCases.length) return
    const queueCaseIds = buildAdaptiveRecallQueue(filteredCases, reviewStateByCaseKey).map((item) => item.dailyCaseId)
    setStudyQueueCaseIds(queueCaseIds)
    setStudyQueueIndex(0)
    setSelectedCaseId(null)
    setActiveTab('breakdown')
  }

  const clearSelectedCase = () => {
    setSelectedCaseId(null)
    setActiveTab('breakdown')
    setStudyQueueCaseIds(null)
    setStudyQueueIndex(0)
  }

  const updateFilters = (nextFilters: LearnFilters) => {
    setFilters(nextFilters)
    setSelectedCaseId(null)
    setActiveTab('breakdown')
    setStudyQueueCaseIds(null)
    setStudyQueueIndex(0)
  }

  const startDueReviewQueue = () => {
    if (!dueReviewCases.length) return
    const queueCaseIds = buildAdaptiveRecallQueue(dueReviewCases, reviewStateByCaseKey).map((item) => item.dailyCaseId)
    setStudyQueueCaseIds(queueCaseIds)
    setStudyQueueIndex(0)
    setSelectedCaseId(null)
    setActiveTab('breakdown')
  }

  const exitStudyQueue = () => {
    setStudyQueueCaseIds(null)
    setStudyQueueIndex(0)
  }

  const updateReviewState = (
    item: LearnLibraryCase,
    updater: (current: LearnReviewState) => LearnReviewState,
  ) => {
    const key = getLearnReviewCaseKey(item)
    setReviewStateByCaseKey((current) => ({
      ...current,
      [key]: updater(current[key] ?? createEmptyLearnReviewState()),
    }))
  }

  return (
    <>
      {/* ── Mobile ── */}
      <main className="flex h-full min-h-0 w-full max-w-full flex-1 basis-0 flex-col overflow-x-hidden overflow-y-auto overscroll-contain bg-[var(--wardle-color-charcoal)] pb-8 lg:hidden">
        {studyQueueCaseIds && studyQueueCases.length > 0 ? (
          <AdaptiveRecallQueueController
            queue={studyQueueCases}
            reviewStateByCaseKey={reviewStateByCaseKey}
            studyQueueIndex={studyQueueIndex}
            onChangeIndex={setStudyQueueIndex}
            onExit={exitStudyQueue}
            onUpdateReviewState={updateReviewState}
          />
        ) : !selectedCase ? (
          <>
            <MobileLearnHeader />
            <MobileStatsBar summary={displayedSummary} loading={libraryLoading} error={libraryError} />
            <MobileCaseArchive
              cases={filteredCases}
              completedCount={completedCases.length}
              filterOptions={filterOptions}
              filters={filters}
              missedCount={missedCases.length}
              dueReviewCount={dueReviewCases.length}
              showAdvancedFilters={showArchiveFilters}
              onChangeFilters={updateFilters}
              onToggleAdvancedFilters={() => setShowArchiveFilters((v) => !v)}
              onSelectCase={selectCase}
              onStartStudyQueue={startStudyQueue}
              onStartDueReviewQueue={startDueReviewQueue}
              loading={libraryLoading}
            />
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

      {/* ── Desktop ── */}
      <main className="hidden h-full min-h-0 w-full max-w-full flex-1 basis-0 flex-col overflow-x-hidden overflow-y-auto overscroll-contain px-1 pb-6 pt-1 sm:px-2 lg:flex">
        <div className="min-w-0 max-w-full space-y-5 overflow-x-hidden">
          <DesktopLearnHeader summary={displayedSummary} />

          {libraryError ? <InlineNotice tone="error" copy="Unable to load completed cases." /> : null}
          {libraryLoading ? <InlineNotice tone="muted" copy="Loading completed cases..." /> : null}

          <ArchiveControls
            visibleCount={filteredCases.length}
            completedCount={completedCases.length}
            filterOptions={filterOptions}
            filters={filters}
            showAdvancedFilters={showArchiveFilters}
            onChangeFilters={updateFilters}
            onToggleAdvancedFilters={() => setShowArchiveFilters((v) => !v)}
          />

          {filteredCases.length > 0 ? (
            <div className="grid min-w-0 grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] gap-4">
              <CaseLibraryList
                cases={filteredCases}
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
          ) : (
            <ArchiveEmptyState completedCount={completedCases.length} loading={libraryLoading} />
          )}
        </div>
      </main>
    </>
  )
}

// ─── Mobile header ────────────────────────────────────────────────────────────

function MobileLearnHeader() {
  return (
    <div className="sticky top-0 z-20 flex min-w-0 items-center justify-between border-b border-white/[0.05] bg-[var(--wardle-color-charcoal)] px-5 py-3">
      <WardleLogo size="sm" />
      <span className="font-brand-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--wardle-color-teal)]/50">
        Learn
      </span>
    </div>
  )
}

// ─── Mobile stats bar ─────────────────────────────────────────────────────────

function MobileStatsBar({
  summary,
  loading,
  error,
}: {
  summary: LearnPerformanceSummary
  loading: boolean
  error: string | null
}) {
  return (
    <section className="px-4 pt-4 pb-1">
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="Accuracy" value={formatPercent(summary.accuracyPct)} tone="teal" />
        <StatCard label="Cases" value={String(summary.casesDone)} tone="neutral" />
        <StatCard label="Avg clues" value={formatAverageClues(summary.averageCluesUsed)} tone="amber" />
      </div>
      {loading && (
        <p className="mt-3 rounded-[12px] border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-xs text-white/36">
          Loading case archive…
        </p>
      )}
      {error && (
        <p className="mt-3 rounded-[12px] border border-rose-400/[0.18] bg-rose-400/[0.07] px-4 py-2.5 text-xs text-rose-300">
          Unable to load completed cases.
        </p>
      )}
    </section>
  )
}

// ─── Mobile case archive ──────────────────────────────────────────────────────

function MobileCaseArchive({
  cases,
  completedCount,
  filterOptions,
  filters,
  missedCount,
  dueReviewCount,
  showAdvancedFilters,
  onChangeFilters,
  onToggleAdvancedFilters,
  onSelectCase,
  onStartStudyQueue,
  onStartDueReviewQueue,
  loading,
}: {
  cases: LearnLibraryCase[]
  completedCount: number
  filterOptions: LearnFilterOptions
  filters: LearnFilters
  missedCount: number
  dueReviewCount: number
  showAdvancedFilters: boolean
  onChangeFilters: (filters: LearnFilters) => void
  onToggleAdvancedFilters: () => void
  onSelectCase: (dailyCaseId: string) => void
  onStartStudyQueue: () => void
  onStartDueReviewQueue: () => void
  loading: boolean
}) {
  const activeFilterCount = getTotalActiveFilterCount(filters)
  const archiveCountLabel =
    completedCount > 0
      ? cases.length === completedCount
        ? String(completedCount)
        : `${cases.length}/${completedCount}`
      : '0'

  return (
    <section className="space-y-3 px-4 pt-4">
      {/* Review nudge */}
      {missedCount > 0 ? (
        <button
          type="button"
          onClick={() => onChangeFilters({ ...filters, result: 'missed' })}
          className="wardle-learn-slide-up flex w-full items-center gap-3 rounded-[14px] border border-rose-400/[0.2] bg-rose-400/[0.06] px-4 py-3 text-left transition active:scale-[0.99]"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-rose-400/[0.28] bg-rose-400/[0.12] font-brand-mono text-[10px] font-black text-rose-300">
            {missedCount}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-bold text-rose-300">
              {missedCount} case{missedCount === 1 ? '' : 's'} to review
            </span>
            <span className="mt-0.5 block text-[11px] text-white/36">Filter missed cases</span>
          </span>
          <span className="shrink-0 text-xs text-white/22">›</span>
        </button>
      ) : dueReviewCount > 0 ? (
        <button
          type="button"
          onClick={onStartDueReviewQueue}
          className="wardle-learn-slide-up flex w-full items-center gap-3 rounded-[14px] border border-[rgba(0,180,166,0.2)] bg-[rgba(0,180,166,0.06)] px-4 py-3 text-left transition active:scale-[0.99]"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[rgba(0,180,166,0.26)] bg-[rgba(0,180,166,0.1)] font-brand-mono text-[10px] font-black text-[var(--wardle-color-teal)]">
            {dueReviewCount}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-bold text-[var(--wardle-color-mint)]">
              {dueReviewCount} case{dueReviewCount === 1 ? '' : 's'} due today
            </span>
            <span className="mt-0.5 block text-[11px] text-white/36">Start review queue</span>
          </span>
          <span className="shrink-0 text-xs text-white/22">›</span>
        </button>
      ) : null}

      {/* Archive header */}
      <div className="flex min-w-0 items-center justify-between gap-3 pt-1">
        <div className="flex min-w-0 items-baseline gap-2">
          <h2 className="shrink-0 text-sm font-bold tracking-tight text-[var(--wardle-color-mint)]">
            Case Archive
          </h2>
          <span className="font-brand-mono text-[11px] tabular-nums text-white/24">
            {archiveCountLabel}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {cases.length > 0 && (
            <button
              type="button"
              onClick={onStartStudyQueue}
              className="rounded-full border border-[rgba(0,180,166,0.26)] bg-[rgba(0,180,166,0.12)] px-3 py-1.5 text-[11px] font-bold text-[var(--wardle-color-teal)] transition active:scale-[0.98]"
            >
              Test myself
            </button>
          )}
          <button
            type="button"
            onClick={onToggleAdvancedFilters}
            aria-expanded={showAdvancedFilters}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold transition active:scale-[0.98] ${
              showAdvancedFilters || activeFilterCount > 0
                ? 'border-[rgba(0,180,166,0.28)] bg-[rgba(0,180,166,0.14)] text-[var(--wardle-color-teal)]'
                : 'border-white/[0.08] bg-white/[0.04] text-white/42'
            }`}
          >
            <SlidersHorizontal className="h-3 w-3" strokeWidth={2.2} />
            <span>Filter{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ''}</span>
          </button>
        </div>
      </div>

      {/* Active pills */}
      <ActiveFilterPills filters={filters} filterOptions={filterOptions} onChangeFilters={onChangeFilters} />

      {/* Filter panel */}
      {showAdvancedFilters && (
        <MobileFilterPanel
          filterOptions={filterOptions}
          filters={filters}
          onChangeFilters={onChangeFilters}
          onClose={onToggleAdvancedFilters}
        />
      )}

      {/* Case list */}
      {cases.length > 0 ? (
        <div className="space-y-2">
          {cases.map((item) => (
            <MobileCaseCard key={item.dailyCaseId} item={item} onSelect={() => onSelectCase(item.dailyCaseId)} />
          ))}
        </div>
      ) : (
        <ArchiveEmptyState completedCount={completedCount} loading={loading} mobile />
      )}
    </section>
  )
}

// ─── Mobile case card ─────────────────────────────────────────────────────────

function MobileCaseCard({ item, onSelect }: { item: LearnLibraryCase; onSelect: () => void }) {
  const diagnosis = item.case.diagnosis || item.case.title
  const solved = item.playerResult.solved
  const difficultyLabel = item.case.difficulty?.trim().toLowerCase() || 'standard'

  return (
    <button
      type="button"
      onClick={onSelect}
      className="wardle-learn-fade flex w-full min-w-0 items-center gap-3 rounded-[13px] border border-white/[0.07] bg-white/[0.03] px-4 py-3 text-left transition active:scale-[0.99] hover:bg-white/[0.05]"
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
          solved ? 'bg-[var(--wardle-color-teal)]' : 'bg-rose-400'
        }`}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-bold text-[var(--wardle-color-mint)]">
          {diagnosis}
        </span>
        <span className="mt-0.5 block text-[11px] text-white/36">
          {difficultyLabel} &middot; {item.playerResult.attemptsUsed} of {item.case.clues.length} clues
        </span>
      </span>
      <span className="shrink-0 text-xs text-white/20">›</span>
    </button>
  )
}

// ─── Mobile filter panel ──────────────────────────────────────────────────────

function MobileFilterPanel({
  filterOptions,
  filters,
  onChangeFilters,
  onClose,
}: {
  filterOptions: LearnFilterOptions
  filters: LearnFilters
  onChangeFilters: (filters: LearnFilters) => void
  onClose: () => void
}) {
  const set = <K extends keyof LearnFilters>(key: K, value: LearnFilters[K]) =>
    onChangeFilters({ ...filters, [key]: value })

  const showTrack = filterOptions.tracks.length > 1
  const showDifficulty = filterOptions.difficulties.length > 1

  return (
    <div className="wardle-learn-slide-up overflow-hidden rounded-[16px] border border-white/[0.07] bg-[#17172280]">
      <div className="space-y-5 px-4 py-4">

        {/* Result — segmented control */}
        <div>
          <FilterSectionLabel>Result</FilterSectionLabel>
          <div className="flex gap-0.5 rounded-[10px] bg-white/[0.05] p-[3px]">
            {(
              [
                { value: 'all', label: 'All' },
                { value: 'solved', label: 'Solved' },
                { value: 'missed', label: 'Missed' },
              ] as const
            ).map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => set('result', value)}
                className={`flex-1 rounded-[8px] py-[7px] text-xs font-bold transition-all duration-150 ${
                  filters.result === value
                    ? value === 'missed'
                      ? 'bg-rose-400/[0.15] text-rose-300'
                      : 'bg-[rgba(0,180,166,0.18)] text-[var(--wardle-color-teal)]'
                    : 'text-white/36 hover:text-white/58'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Specialty */}
        {filterOptions.specialties.length > 0 && (
          <div>
            <FilterSectionLabel>Specialty</FilterSectionLabel>
            <div className="flex flex-wrap gap-1.5">
              <SpecialtyChip
                label="All"
                active={filters.specialty === 'all'}
                onClick={() => set('specialty', 'all')}
              />
              {filterOptions.specialties.map((specialty, index) => (
                <SpecialtyChip
                  key={specialty.key}
                  label={specialty.label}
                  active={filters.specialty === specialty.key}
                  dotColor={SPECIALTY_DOT_COLORS[index % SPECIALTY_DOT_COLORS.length]}
                  onClick={() => set('specialty', specialty.key)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Difficulty */}
        {showDifficulty && (
          <div>
            <FilterSectionLabel>Difficulty</FilterSectionLabel>
            <div className="flex gap-1.5">
              <DifficultyChip
                label="All"
                active={filters.difficulty === 'all'}
                onClick={() => set('difficulty', 'all')}
              />
              {filterOptions.difficulties.map((d) => (
                <DifficultyChip
                  key={d.key}
                  label={d.label}
                  active={filters.difficulty === d.key}
                  difficultyKey={d.key}
                  onClick={() => set('difficulty', d.key)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Track */}
        {showTrack && (
          <div>
            <FilterSectionLabel>Track</FilterSectionLabel>
            <div className="flex flex-wrap gap-1.5">
              <SpecialtyChip
                label="All"
                active={filters.track === 'all'}
                onClick={() => set('track', 'all')}
              />
              {filterOptions.tracks.map((track) => (
                <SpecialtyChip
                  key={track}
                  label={TRACK_LABEL[track] ?? track}
                  active={filters.track === track}
                  onClick={() => set('track', track)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-3">
        <button
          type="button"
          onClick={() => onChangeFilters(ALL_FILTERS)}
          className="text-xs font-bold text-white/28 transition hover:text-white/52"
        >
          Clear all
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-[rgba(0,180,166,0.26)] bg-[rgba(0,180,166,0.14)] px-4 py-2 text-xs font-bold text-[var(--wardle-color-teal)] transition active:scale-[0.98]"
        >
          Show results
        </button>
      </div>
    </div>
  )
}

function FilterSectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 font-brand-mono text-[10px] font-bold uppercase tracking-[0.14em] text-white/28">
      {children}
    </p>
  )
}

function SpecialtyChip({
  label,
  active,
  dotColor,
  onClick,
}: {
  label: string
  active: boolean
  dotColor?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-[5px] text-xs font-bold transition-all duration-150 ${
        active
          ? 'border-[rgba(0,180,166,0.3)] bg-[rgba(0,180,166,0.13)] text-[var(--wardle-color-teal)]'
          : 'border-white/[0.08] bg-transparent text-white/36 hover:border-white/[0.16] hover:text-white/58'
      }`}
    >
      {dotColor && (
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: active ? 'currentColor' : dotColor }}
        />
      )}
      {label}
    </button>
  )
}

function DifficultyChip({
  label,
  active,
  difficultyKey,
  onClick,
}: {
  label: string
  active: boolean
  difficultyKey?: string
  onClick: () => void
}) {
  const activeStyle = active && difficultyKey ? DIFFICULTY_ACTIVE_STYLES[difficultyKey] : null

  return (
    <button
      type="button"
      onClick={onClick}
      style={
        activeStyle
          ? { background: activeStyle.bg, color: activeStyle.text }
          : active
            ? { background: 'rgba(0,180,166,0.15)', color: 'var(--wardle-color-teal)' }
            : undefined
      }
      className={`flex-1 rounded-[8px] border py-[7px] text-xs font-bold transition-all duration-150 ${
        active ? 'border-current/20' : 'border-white/[0.08] bg-white/[0.04] text-white/36 hover:text-white/58'
      }`}
    >
      {label}
    </button>
  )
}

// ─── Active filter pills ──────────────────────────────────────────────────────

function ActiveFilterPills({
  filters,
  filterOptions,
  onChangeFilters,
}: {
  filters: LearnFilters
  filterOptions: LearnFilterOptions
  onChangeFilters: (filters: LearnFilters) => void
}) {
  const specialtyLabel =
    filters.specialty !== 'all'
      ? (filterOptions.specialties.find((s) => s.key === filters.specialty)?.label ?? filters.specialty)
      : null

  const pills: Array<{ label: string; onRemove: () => void }> = []

  if (filters.result !== 'all') {
    pills.push({
      label: filters.result === 'solved' ? 'Solved' : 'Missed',
      onRemove: () => onChangeFilters({ ...filters, result: 'all' }),
    })
  }
  if (specialtyLabel) {
    pills.push({
      label: specialtyLabel,
      onRemove: () => onChangeFilters({ ...filters, specialty: 'all' }),
    })
  }
  if (filters.difficulty !== 'all') {
    pills.push({
      label: filters.difficulty,
      onRemove: () => onChangeFilters({ ...filters, difficulty: 'all' }),
    })
  }
  if (filters.track !== 'all') {
    pills.push({
      label: TRACK_LABEL[filters.track] ?? filters.track,
      onRemove: () => onChangeFilters({ ...filters, track: 'all' }),
    })
  }

  if (!pills.length) return null

  return (
    <div className="flex flex-wrap gap-1.5">
      {pills.map((pill) => (
        <span
          key={pill.label}
          className="flex items-center gap-1 rounded-full border border-[rgba(0,180,166,0.2)] bg-[rgba(0,180,166,0.08)] py-[3px] pl-2.5 pr-1.5 text-[11px] font-bold text-[var(--wardle-color-teal)]"
        >
          {pill.label}
          <button
            type="button"
            onClick={pill.onRemove}
            className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-[var(--wardle-color-teal)]/44 transition hover:text-[var(--wardle-color-teal)]"
          >
            ×
          </button>
        </span>
      ))}
    </div>
  )
}

// ─── Mobile case detail ───────────────────────────────────────────────────────

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

  useEffect(() => {
    onChangeTab('breakdown')
  }, [item.dailyCaseId, onChangeTab])

  return (
    <div className="min-w-0 pb-6">
      {/* Sticky nav */}
      <div className="sticky top-0 z-20 flex min-w-0 items-center justify-between gap-3 border-b border-white/[0.05] bg-[var(--wardle-color-charcoal)] px-5 py-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-bold text-[var(--wardle-color-teal)]"
        >
          <span className="text-base leading-none">‹</span>
          Library
        </button>
        <span className="font-brand-mono text-[10px] text-white/28">
          {item.completedAt.slice(0, 10)}
        </span>
      </div>

      <section className="mx-3 mt-4 space-y-4">
        {/* Case hero */}
        <div className="overflow-hidden rounded-[20px] border border-white/[0.07] bg-white/[0.025]">
          <div className="px-4 pb-4 pt-4">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="flex min-w-0 flex-wrap gap-1.5">
                <TrackBadge track={item.track} />
                <DifficultyBadge difficulty={item.case.difficulty} />
              </div>
              <span className="font-brand-mono text-[10px] text-[var(--wardle-color-teal)]/50">
                #{item.sequenceIndex}
              </span>
            </div>

            {!item.playerResult.solved && (
              <div className="mt-3 flex items-center gap-2 rounded-[10px] border border-rose-400/[0.18] bg-rose-400/[0.06] px-3 py-2">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" />
                <span className="font-brand-mono text-[10px] font-bold uppercase tracking-[0.14em] text-rose-300">
                  Needs review
                </span>
              </div>
            )}

            <div className="mt-4">
              <p className="font-brand-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--wardle-color-teal)]/60">
                Diagnosis
              </p>
              <h2 className="mt-1.5 break-words text-[22px] font-black leading-tight tracking-tight text-[var(--wardle-color-mint)]">
                {item.case.diagnosis || item.case.title}
              </h2>
              <p className="mt-1 font-brand-mono text-[11px] text-white/30">
                {item.case.clues.length} clues · {item.case.date || item.completedAt.slice(0, 10)}
              </p>
            </div>

            <AttemptSummary item={item} />
          </div>
        </div>

        {/* Tabs + content */}
        <TabSwitcher activeTab={activeTab} onChangeTab={onChangeTab} />

        <div>
          {activeTab === 'breakdown' && <BreakdownTab explanation={explanation} />}
          {activeTab === 'differentials' && (
            <DifferentialsTab differentials={explanation?.differentials ?? []} />
          )}
          {activeTab === 'clues' && <CluesTab clues={item.case.clues} />}
        </div>
      </section>
    </div>
  )
}

// ─── Adaptive recall ──────────────────────────────────────────────────────────

function AdaptiveRecallQueueController({
  queue,
  reviewStateByCaseKey,
  studyQueueIndex,
  onChangeIndex,
  onExit,
  onUpdateReviewState,
}: {
  queue: LearnLibraryCase[]
  reviewStateByCaseKey: LearnReviewStateByCaseKey
  studyQueueIndex: number
  onChangeIndex: (index: number) => void
  onExit: () => void
  onUpdateReviewState: (
    item: LearnLibraryCase,
    updater: (current: LearnReviewState) => LearnReviewState,
  ) => void
}) {
  const item = queue[studyQueueIndex] ?? queue[0]
  const canGoPrevious = studyQueueIndex > 0
  const canGoNext = studyQueueIndex < queue.length - 1

  if (!item) return null

  return (
    <div className="fixed inset-0 z-50 flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-[var(--wardle-color-charcoal)] lg:hidden">
      <DiagnosisRecallSurface
        key={item.dailyCaseId}
        item={item}
        allCases={queue}
        queueIndex={studyQueueIndex}
        queueSize={queue.length}
        reviewStateByCaseKey={reviewStateByCaseKey}
        reviewState={reviewStateByCaseKey[getLearnReviewCaseKey(item)] ?? createEmptyLearnReviewState()}
        onExit={onExit}
        onPrevious={canGoPrevious ? () => onChangeIndex(studyQueueIndex - 1) : undefined}
        onNext={canGoNext ? () => onChangeIndex(studyQueueIndex + 1) : undefined}
        onUpdateReviewState={(updater) => onUpdateReviewState(item, updater)}
      />
    </div>
  )
}

function DiagnosisRecallSurface({
  item,
  allCases,
  queueIndex,
  queueSize,
  reviewStateByCaseKey,
  reviewState,
  onExit,
  onPrevious,
  onNext,
  onUpdateReviewState,
}: {
  item: LearnLibraryCase
  allCases: LearnLibraryCase[]
  queueIndex: number
  queueSize: number
  reviewStateByCaseKey: LearnReviewStateByCaseKey
  reviewState: LearnReviewState
  onExit: () => void
  onPrevious?: () => void
  onNext?: () => void
  onUpdateReviewState: (updater: (current: LearnReviewState) => LearnReviewState) => void
}) {
  const [recallPhase, setRecallPhase] = useState<'question' | 'answer'>('question')
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [hasRatedCurrentCard, setHasRatedCurrentCard] = useState(false)
  const ratedCount = allCases.filter(
    (c) => reviewStateByCaseKey[getLearnReviewCaseKey(c)]?.confidence,
  ).length
  const canAdvanceFromAnswer = recallPhase === 'answer' && hasRatedCurrentCard
  const isFinalCase = queueIndex >= queueSize - 1

  const rateRecallConfidence = (confidence: LearnConfidence) => {
    const reviewedAt = new Date()
    const shouldCount = !hasRatedCurrentCard
    setHasRatedCurrentCard(true)
    onUpdateReviewState((current) => ({
      ...current,
      confidence,
      recallAttempts: current.recallAttempts + (shouldCount ? 1 : 0),
      recallCorrect: current.recallCorrect + (shouldCount && confidence !== 'hard' ? 1 : 0),
      lastReviewedAt: reviewedAt.toISOString(),
      nextReviewAt: addDays(reviewedAt, CONFIDENCE_REVIEW_DAYS[confidence]).toISOString(),
    }))
  }

  const goPrevious = () => {
    if (!onPrevious) return
    setRecallPhase('question')
    setHasRatedCurrentCard(false)
    onPrevious()
  }

  const goNext = () => {
    if (!canAdvanceFromAnswer) return
    if (onNext) {
      setRecallPhase('question')
      setHasRatedCurrentCard(false)
      onNext()
      return
    }
    setShowExitConfirm(true)
  }

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-[var(--wardle-color-charcoal)]">
      {/* Header */}
      <div className="shrink-0 border-b border-white/[0.06] px-5 pb-3 pt-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setShowExitConfirm(true)}
            className="text-sm font-bold text-[var(--wardle-color-teal)]"
          >
            ‹ Exit
          </button>
          <span className="font-brand-mono text-[9px] font-bold uppercase tracking-[0.2em] text-white/28">
            Adaptive recall
          </span>
          <span className="font-brand-mono text-[10px] text-white/28">
            {ratedCount}/{queueSize} rated
          </span>
        </div>
        <RecallQueueProgress
          queue={allCases}
          currentIndex={queueIndex}
          reviewStateByCaseKey={reviewStateByCaseKey}
        />
      </div>

      {/* Scrollable content */}
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-5">
        {recallPhase === 'question' ? (
          <RecallQuestionCard
            key={`${item.dailyCaseId}-question`}
            item={item}
            onReveal={() => setRecallPhase('answer')}
          />
        ) : (
          <RecallAnswerCard
            key={`${item.dailyCaseId}-answer`}
            item={item}
            reviewState={reviewState}
            onRateConfidence={rateRecallConfidence}
          />
        )}
      </div>

      {/* Bottom nav */}
      <div className="shrink-0 border-t border-white/[0.07] bg-[rgba(18,18,28,0.98)] px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3">
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={goPrevious}
            disabled={!onPrevious}
            className="rounded-[13px] border border-white/[0.07] bg-white/[0.03] px-3 py-3 text-sm font-bold text-white/44 transition disabled:opacity-30"
          >
            Prev
          </button>
          {recallPhase === 'question' ? (
            <button
              type="button"
              onClick={() => setRecallPhase('answer')}
              className="rounded-[13px] border border-[rgba(0,180,166,0.26)] bg-[rgba(0,180,166,0.13)] px-3 py-3 text-sm font-bold text-[var(--wardle-color-teal)] transition"
            >
              Reveal
            </button>
          ) : (
            <button
              type="button"
              onClick={() => { setRecallPhase('question'); setHasRatedCurrentCard(false) }}
              className="rounded-[13px] border border-white/[0.07] bg-white/[0.03] px-3 py-3 text-sm font-bold text-white/44 transition"
            >
              Retry
            </button>
          )}
          <button
            type="button"
            onClick={goNext}
            disabled={!canAdvanceFromAnswer}
            className={`rounded-[13px] border px-3 py-3 text-sm font-bold transition disabled:opacity-30 ${
              isFinalCase && canAdvanceFromAnswer
                ? 'border-[rgba(0,180,166,0.26)] bg-[rgba(0,180,166,0.13)] text-[var(--wardle-color-teal)]'
                : 'border-white/[0.07] bg-white/[0.03] text-white/44'
            }`}
          >
            {isFinalCase && canAdvanceFromAnswer ? 'Done' : 'Next'}
          </button>
        </div>
      </div>

      {/* Exit confirm overlay */}
      {showExitConfirm && (
        <div className="wardle-learn-fade absolute inset-0 z-50 flex items-center justify-center bg-black/60 px-6">
          <div className="wardle-learn-slide-up w-full rounded-[20px] border border-white/[0.07] bg-[#1e1e2e] px-5 py-5">
            <p className="text-[15px] font-black text-[var(--wardle-color-mint)]">Exit review queue?</p>
            <p className="mt-2 text-sm leading-6 text-white/44">
              You've rated {ratedCount} of {queueSize} cases. Progress is saved.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShowExitConfirm(false)}
                className="rounded-[13px] border border-white/[0.07] bg-white/[0.04] px-3 py-3 text-sm font-bold text-white/50"
              >
                Keep going
              </button>
              <button
                type="button"
                onClick={onExit}
                className="rounded-[13px] border border-[rgba(0,180,166,0.26)] bg-[rgba(0,180,166,0.13)] px-3 py-3 text-sm font-bold text-[var(--wardle-color-teal)]"
              >
                Exit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function RecallQueueProgress({
  queue,
  currentIndex,
  reviewStateByCaseKey,
}: {
  queue: LearnLibraryCase[]
  currentIndex: number
  reviewStateByCaseKey: LearnReviewStateByCaseKey
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-0.5">
        {queue.map((item, index) => {
          const confidence = reviewStateByCaseKey[getLearnReviewCaseKey(item)]?.confidence
          const isCurrent = index === currentIndex
          const bg =
            isCurrent
              ? 'bg-[var(--wardle-color-teal)]'
              : confidence === 'hard'
                ? 'bg-rose-400/70'
                : confidence === 'partial'
                  ? 'bg-[var(--wardle-color-amber)]/70'
                  : confidence === 'solid'
                    ? 'bg-[rgba(0,180,166,0.5)]'
                    : 'bg-white/[0.07]'

          return (
            <span
              key={item.dailyCaseId}
              className={`min-w-0 flex-1 rounded-full transition-all duration-200 ${bg} ${
                isCurrent ? 'h-1.5' : 'h-1'
              }`}
            />
          )
        })}
      </div>
      <span className="shrink-0 font-brand-mono text-[10px] text-white/24">
        {currentIndex + 1}/{queue.length}
      </span>
    </div>
  )
}

function RecallQuestionCard({ item, onReveal }: { item: LearnLibraryCase; onReveal: () => void }) {
  const sortedClues = useMemo(() => sortClues(item.case.clues), [item.case.clues])
  const [visibleClueCount, setVisibleClueCount] = useState(1)
  const remaining = Math.max(0, sortedClues.length - visibleClueCount)
  const visibleClues = sortedClues.slice(0, visibleClueCount)

  return (
    <section className="wardle-learn-slide-up flex min-w-0 flex-col gap-4">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap gap-1.5">
          <TrackBadge track={item.track} />
          <DifficultyBadge difficulty={item.case.difficulty} />
        </div>
        <span className="shrink-0 font-brand-mono text-[10px] text-[var(--wardle-color-teal)]/60">
          {visibleClueCount}/{sortedClues.length} clues
        </span>
      </div>

      <div>
        <p className="font-brand-mono text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">
          Recall
        </p>
        <h1 className="mt-1.5 text-xl font-black leading-snug text-[var(--wardle-color-mint)]">
          What is the diagnosis?
        </h1>
      </div>

      <div className="space-y-2">
        {visibleClues.map((clue, index) => (
          <RecallClueCard
            key={clue.id}
            clue={clue}
            index={index}
            active={index === visibleClues.length - 1}
          />
        ))}
      </div>

      <div className="flex gap-2">
        {remaining > 0 && (
          <button
            type="button"
            onClick={() => setVisibleClueCount((c) => Math.min(c + 1, sortedClues.length))}
            className="flex-1 rounded-[13px] border border-white/[0.07] bg-white/[0.03] px-3 py-3 text-sm font-bold text-white/48 transition active:scale-[0.98]"
          >
            Next clue ({remaining} left)
          </button>
        )}
        <button
          type="button"
          onClick={onReveal}
          className={`${remaining > 0 ? 'flex-1' : 'w-full'} rounded-[13px] border border-[rgba(0,180,166,0.26)] bg-[rgba(0,180,166,0.13)] px-3 py-3 text-sm font-bold text-[var(--wardle-color-teal)] transition active:scale-[0.98]`}
        >
          Reveal diagnosis
        </button>
      </div>
    </section>
  )
}

function RecallClueCard({
  clue,
  index,
  active,
}: {
  clue: ClinicalClue
  index: number
  active: boolean
}) {
  const typeCopy = CLUE_TYPE_COPY[clue.type]

  return (
    <div
      className={`flex min-w-0 gap-3 rounded-[12px] border px-3 py-3 transition-colors ${
        active
          ? 'wardle-learn-slide-up border-[rgba(0,180,166,0.16)] bg-[rgba(0,180,166,0.05)]'
          : 'border-white/[0.05] bg-white/[0.025]'
      }`}
    >
      <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] border text-[9px] font-black ${typeCopy.tone}`}>
        {typeCopy.abbr}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`font-brand-mono text-[9px] font-bold uppercase tracking-[0.14em] ${active ? 'text-[var(--wardle-color-teal)]/60' : 'text-white/26'}`}>
          Clue {index + 1} · {typeCopy.label}
        </p>
        <p className={`mt-1 break-words text-sm leading-6 ${active ? 'text-white/80' : 'text-white/48'}`}>
          {clue.value}
        </p>
      </div>
    </div>
  )
}

function RecallAnswerCard({
  item,
  reviewState,
  onRateConfidence,
}: {
  item: LearnLibraryCase
  reviewState: LearnReviewState
  onRateConfidence: (confidence: LearnConfidence) => void
}) {
  const explanation = coerceStructuredExplanation(item.case.explanation ?? {})
  const differentials = useMemo(() => getExplanationDifferentials(item.case.explanation), [item.case.explanation])
  const sortedClues = useMemo(() => sortClues(item.case.clues), [item.case.clues])
  const reasoningSteps = useMemo(() => splitReasoning(explanation?.reasoning ?? ''), [explanation?.reasoning])
  const [showReasoning, setShowReasoning] = useState(false)
  const [showDifferentials, setShowDifferentials] = useState(false)

  return (
    <section className="wardle-learn-slide-up flex min-w-0 flex-col gap-4">
      {/* Diagnosis reveal */}
      <div className="rounded-[18px] border border-[rgba(0,180,166,0.18)] bg-[rgba(0,180,166,0.06)] px-4 py-4">
        <p className="font-brand-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--wardle-color-teal)]/60">
          Diagnosis
        </p>
        <h2 className="mt-2 break-words text-2xl font-black leading-tight tracking-tight text-[var(--wardle-color-mint)]">
          {item.case.diagnosis || item.case.title}
        </h2>
        {explanation?.summary && (
          <p className="mt-3 border-t border-white/[0.06] pt-3 text-sm leading-6 text-white/56">
            {explanation.summary}
          </p>
        )}
      </div>

      {/* Clues used */}
      <div>
        <p className="mb-2 font-brand-mono text-[10px] font-bold uppercase tracking-[0.18em] text-white/28">
          Clues used
        </p>
        <div className="flex flex-wrap gap-1.5">
          {sortedClues.map((clue, index) => {
            const typeCopy = CLUE_TYPE_COPY[clue.type]
            const wasUsed = index < item.playerResult.attemptsUsed
            return (
              <span
                key={clue.id}
                className={`inline-flex max-w-full items-center gap-1.5 rounded-[8px] border px-2 py-1 text-[11px] ${
                  wasUsed
                    ? 'border-white/[0.09] bg-white/[0.045] text-white/60'
                    : 'border-white/[0.04] bg-white/[0.02] text-white/20'
                }`}
              >
                <span className={`font-brand-mono text-[9px] font-black ${wasUsed ? CLUE_TYPE_TEXT_TONES[clue.type] : 'text-white/22'}`}>
                  {typeCopy.abbr}
                </span>
                <span className="truncate">{clue.value}</span>
              </span>
            )
          })}
        </div>
        <p className="mt-2 text-xs text-white/34">
          Used{' '}
          <span className="font-bold text-white/70">{item.playerResult.attemptsUsed}</span> of{' '}
          {sortedClues.length} clues ·{' '}
          <span className={item.playerResult.solved ? 'font-bold text-[var(--wardle-color-teal)]' : 'font-bold text-rose-300'}>
            {item.playerResult.solved ? 'Solved' : 'Missed'}
          </span>
        </p>
      </div>

      {/* Key findings */}
      {explanation?.keyFindings.length ? (
        <ReviewSection title="Key Findings" tone="teal">
          <div className="space-y-1.5">
            {explanation.keyFindings.map((finding) => (
              <div key={finding} className="flex min-w-0 gap-2.5 rounded-[10px] border border-white/[0.05] bg-white/[0.03] px-3 py-2.5">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--wardle-color-teal)]/60" />
                <span className="min-w-0 break-words text-sm leading-6 text-white/64">{finding}</span>
              </div>
            ))}
          </div>
        </ReviewSection>
      ) : null}

      {/* Reasoning */}
      {reasoningSteps.length ? (
        <RecallDisclosure
          label={`Reasoning chain · ${reasoningSteps.length} steps`}
          open={showReasoning}
          onToggle={() => setShowReasoning((v) => !v)}
        >
          <div className="overflow-hidden rounded-[12px] border border-white/[0.05] bg-white/[0.025]">
            {reasoningSteps.map((step, index) => (
              <div
                key={`${index}-${step}`}
                className={`flex min-w-0 gap-3 px-3 py-3 ${index < reasoningSteps.length - 1 ? 'border-b border-white/[0.05]' : ''}`}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] bg-[rgba(0,180,166,0.13)] font-brand-mono text-[9px] font-black text-[var(--wardle-color-teal)]">
                  {index + 1}
                </span>
                <p className="min-w-0 break-words text-xs leading-5 text-white/56">{step}</p>
              </div>
            ))}
          </div>
        </RecallDisclosure>
      ) : null}

      {/* Differentials */}
      {differentials.length ? (
        <RecallDisclosure
          label={`Why not · ${differentials.length} ruled out`}
          open={showDifferentials}
          onToggle={() => setShowDifferentials((v) => !v)}
        >
          <div className="space-y-1.5">
            {differentials.map((differential, index) => {
              const title = getDifferentialTitle(differential)
              const reason = getDifferentialReason(differential)
              return (
                <div key={`${title}-${index}`} className="rounded-[12px] border border-white/[0.05] bg-white/[0.025] px-3 py-2.5">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <p className="min-w-0 break-words text-sm font-bold text-[var(--wardle-color-mint)]">{title}</p>
                    <span className="shrink-0 rounded-full border border-rose-400/[0.2] bg-rose-400/[0.08] px-2 py-0.5 font-brand-mono text-[9px] font-bold uppercase tracking-[0.1em] text-rose-300">
                      Ruled out
                    </span>
                  </div>
                  {reason && <p className="mt-1.5 break-words text-xs leading-5 text-white/40">{reason}</p>}
                </div>
              )
            })}
          </div>
        </RecallDisclosure>
      ) : null}

      <RecallConfidenceRater reviewState={reviewState} onRate={onRateConfidence} />
    </section>
  )
}

function RecallDisclosure({
  label,
  open,
  onToggle,
  children,
}: {
  label: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between rounded-[11px] border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-left"
      >
        <span className="text-xs font-bold text-white/44">{label}</span>
        <span className={`text-xs text-white/28 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}>›</span>
      </button>
      {open && <div className="wardle-learn-fade mt-1.5">{children}</div>}
    </div>
  )
}

function RecallConfidenceRater({
  reviewState,
  onRate,
}: {
  reviewState: LearnReviewState
  onRate: (confidence: LearnConfidence) => void
}) {
  return (
    <div className="rounded-[16px] border border-white/[0.07] bg-white/[0.025] px-4 py-4">
      <p className="font-brand-mono text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">
        How well did you know this?
      </p>
      <div className="mt-3 space-y-2">
        {(Object.keys(CONFIDENCE_COPY) as LearnConfidence[]).map((confidence) => (
          <RecallConfidenceButton
            key={confidence}
            confidence={confidence}
            active={reviewState.confidence === confidence}
            onClick={() => onRate(confidence)}
          />
        ))}
      </div>
      {reviewState.nextReviewAt && (
        <p className="wardle-learn-fade mt-3 rounded-[9px] bg-white/[0.03] px-3 py-2 font-brand-mono text-[10px] text-white/36">
          Next review:{' '}
          <span className="text-[var(--wardle-color-mint)]">{reviewState.nextReviewAt.slice(0, 10)}</span>
        </p>
      )}
    </div>
  )
}

function RecallConfidenceButton({
  confidence,
  active,
  onClick,
}: {
  confidence: LearnConfidence
  active: boolean
  onClick: () => void
}) {
  const copy = CONFIDENCE_COPY[confidence]
  const activeClass =
    copy.tone === 'rose'
      ? 'border-rose-400/[0.24] bg-rose-400/[0.07] text-rose-300'
      : copy.tone === 'amber'
        ? 'border-[rgba(244,162,97,0.24)] bg-[rgba(244,162,97,0.07)] text-[var(--wardle-color-amber)]'
        : 'border-[rgba(0,180,166,0.24)] bg-[rgba(0,180,166,0.07)] text-[var(--wardle-color-teal)]'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-[12px] border px-3 py-2.5 text-left transition active:scale-[0.99] ${
        active ? activeClass : 'border-white/[0.06] bg-white/[0.025] text-white/48'
      }`}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.05] font-brand-mono text-[10px] font-black">
          {copy.marker}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-bold">{copy.label}</span>
          <span className="mt-0.5 block font-brand-mono text-[10px] text-white/32">{copy.sublabel}</span>
        </span>
      </span>
      <span
        className={`h-[18px] w-[18px] shrink-0 rounded-full border-2 ${
          active ? 'border-current shadow-[inset_0_0_0_4px_rgba(0,0,0,0.5)]' : 'border-white/[0.1]'
        }`}
      />
    </button>
  )
}

// ─── Desktop header ───────────────────────────────────────────────────────────

function DesktopLearnHeader({ summary }: { summary: LearnPerformanceSummary }) {
  return (
    <section className="overflow-hidden rounded-[22px] border border-white/[0.06] bg-[rgba(18,18,28,0.8)] px-6 py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <WardleLogo size="sm" subtitle="Explanation Library" />
        <span className="rounded-full border border-white/[0.07] bg-white/[0.04] px-3 py-1.5 font-brand-mono text-[11px] text-white/40">
          {summary.casesDone} completed
        </span>
      </div>
      <h1 className="mt-5 text-2xl font-black tracking-tight text-[var(--wardle-color-mint)] md:text-3xl">
        Learn
      </h1>
      <p className="mt-1.5 max-w-2xl text-sm leading-6 text-white/40">
        Review completed cases, saved explanations, clue trails, and specialty performance.
      </p>
      <div className="mt-5 grid max-w-lg grid-cols-3 gap-2.5">
        <StatCard label="Accuracy" value={formatPercent(summary.accuracyPct)} tone="teal" />
        <StatCard label="Cases done" value={String(summary.casesDone)} tone="neutral" />
        <StatCard label="Avg clues" value={formatAverageClues(summary.averageCluesUsed)} tone="amber" />
      </div>
    </section>
  )
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'teal' | 'amber' | 'neutral'
}) {
  const valueClass =
    tone === 'teal'
      ? 'text-[var(--wardle-color-teal)]'
      : tone === 'amber'
        ? 'text-[var(--wardle-color-amber)]'
        : 'text-white/70'
  const borderClass =
    tone === 'teal'
      ? 'border-[rgba(0,180,166,0.2)]'
      : tone === 'amber'
        ? 'border-[rgba(244,162,97,0.2)]'
        : 'border-white/[0.07]'

  return (
    <div className={`min-w-0 rounded-[12px] border bg-white/[0.03] px-3 py-3 ${borderClass}`}>
      <p className={`font-brand-mono text-xl font-black leading-none ${valueClass}`}>{value}</p>
      <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">
        {label}
      </p>
    </div>
  )
}

// ─── Desktop archive controls ─────────────────────────────────────────────────

function ArchiveControls({
  visibleCount,
  completedCount,
  filterOptions,
  filters,
  showAdvancedFilters,
  onChangeFilters,
  onToggleAdvancedFilters,
}: {
  visibleCount: number
  completedCount: number
  filterOptions: LearnFilterOptions
  filters: LearnFilters
  showAdvancedFilters: boolean
  onChangeFilters: (filters: LearnFilters) => void
  onToggleAdvancedFilters: () => void
}) {
  const activeCount = getTotalActiveFilterCount(filters)

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-baseline gap-2.5">
          <h2 className="shrink-0 text-[15px] font-bold tracking-tight text-[var(--wardle-color-mint)]">
            Case Archive
          </h2>
          {completedCount > 0 && (
            <span className="font-brand-mono text-[11px] tabular-nums text-white/24">
              {visibleCount !== completedCount ? `${visibleCount} / ${completedCount}` : completedCount}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => onChangeFilters(ALL_FILTERS)}
              className="font-brand-mono text-[10px] font-bold uppercase tracking-[0.14em] text-white/26 transition hover:text-white/50"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={onToggleAdvancedFilters}
            aria-expanded={showAdvancedFilters}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-all duration-200 ${
              showAdvancedFilters || activeCount > 0
                ? 'bg-[rgba(0,180,166,0.12)] text-[var(--wardle-color-teal)]'
                : 'text-white/32 hover:text-white/56'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={2} />
            <span className="font-brand-mono text-[11px] font-bold uppercase tracking-[0.14em]">
              Filter
            </span>
            {activeCount > 0 && (
              <span className="flex h-[17px] w-[17px] items-center justify-center rounded-full bg-[var(--wardle-color-teal)] font-brand-mono text-[9px] font-black text-white">
                {activeCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Specialty rail */}
      <SpecialtyRail
        filterOptions={filterOptions}
        activeSpecialty={filters.specialty}
        completedCount={completedCount}
        onSelect={(specialty) => onChangeFilters({ ...filters, specialty })}
      />

      {showAdvancedFilters && (
        <SecondaryFilters filterOptions={filterOptions} filters={filters} onChangeFilters={onChangeFilters} />
      )}
    </div>
  )
}

function SpecialtyRail({
  filterOptions,
  activeSpecialty,
  completedCount,
  onSelect,
}: {
  filterOptions: LearnFilterOptions
  activeSpecialty: string
  completedCount: number
  onSelect: (key: string) => void
}) {
  return (
    <div className="relative min-w-0">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-[var(--wardle-color-charcoal)] to-transparent"
      />
      <div className="min-w-0 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex w-max gap-px pr-10">
          <SpecialtyPill label="All" count={completedCount} active={activeSpecialty === 'all'} onClick={() => onSelect('all')} />
          {filterOptions.specialties.map((specialty) => (
            <SpecialtyPill
              key={specialty.key}
              label={specialty.label}
              count={specialty.casesDone}
              active={activeSpecialty === specialty.key}
              onClick={() => onSelect(specialty.key)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function SpecialtyPill({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-bold transition-all duration-150 ${
        active ? 'bg-white/[0.06] text-[var(--wardle-color-mint)]' : 'text-white/32 hover:text-white/56'
      }`}
    >
      {active && (
        <span
          aria-hidden="true"
          className="absolute inset-x-3.5 -bottom-0 h-[2px] rounded-full bg-[var(--wardle-color-teal)]"
        />
      )}
      <span>{label}</span>
      <span className={`font-brand-mono text-[10px] tabular-nums ${active ? 'text-[var(--wardle-color-teal)]' : 'text-white/20'}`}>
        {count}
      </span>
    </button>
  )
}

function SecondaryFilters({
  filterOptions,
  filters,
  onChangeFilters,
}: {
  filterOptions: LearnFilterOptions
  filters: LearnFilters
  onChangeFilters: (f: LearnFilters) => void
}) {
  const set = <K extends keyof LearnFilters>(k: K, v: LearnFilters[K]) =>
    onChangeFilters({ ...filters, [k]: v })

  const showTrack = filterOptions.tracks.length > 1
  const showDifficulty = filterOptions.difficulties.length > 1

  return (
    <div className="overflow-hidden rounded-[14px] border border-white/[0.06] bg-white/[0.02]">
      <FilterRow label="Result" isFirst>
        {(['all', 'solved', 'missed'] as const).map((value) => (
          <FilterToggle
            key={value}
            label={value === 'all' ? 'All' : value === 'solved' ? 'Solved' : 'Missed'}
            active={filters.result === value}
            onClick={() => set('result', value)}
          />
        ))}
      </FilterRow>

      {showTrack && (
        <FilterRow label="Track">
          <FilterToggle label="All" active={filters.track === 'all'} onClick={() => set('track', 'all')} />
          {filterOptions.tracks.map((track) => (
            <FilterToggle
              key={track}
              label={TRACK_LABEL[track] ?? track}
              active={filters.track === track}
              onClick={() => set('track', track)}
            />
          ))}
        </FilterRow>
      )}

      {showDifficulty && (
        <FilterRow label="Difficulty">
          <FilterToggle label="All" active={filters.difficulty === 'all'} onClick={() => set('difficulty', 'all')} />
          {filterOptions.difficulties.map((d) => (
            <FilterToggle
              key={d.key}
              label={d.label}
              active={filters.difficulty === d.key}
              onClick={() => set('difficulty', d.key)}
              difficultyKey={d.key}
            />
          ))}
        </FilterRow>
      )}
    </div>
  )
}

function FilterRow({
  label,
  isFirst = false,
  children,
}: {
  label: string
  isFirst?: boolean
  children: ReactNode
}) {
  return (
    <div className={`flex min-w-0 items-center gap-3 px-4 py-2.5 ${isFirst ? '' : 'border-t border-white/[0.05]'}`}>
      <span className="w-[62px] shrink-0 font-brand-mono text-[10px] font-bold uppercase tracking-[0.14em] text-white/22">
        {label}
      </span>
      <div className="flex min-w-0 flex-wrap gap-1">{children}</div>
    </div>
  )
}

function FilterToggle({
  label,
  active,
  onClick,
  difficultyKey,
}: {
  label: string
  active: boolean
  onClick: () => void
  difficultyKey?: string
}) {
  const diffStyle = active && difficultyKey ? DIFFICULTY_ACTIVE_STYLES[difficultyKey] : null

  return (
    <button
      type="button"
      onClick={onClick}
      style={
        diffStyle
          ? { background: diffStyle.bg, color: diffStyle.text }
          : active
            ? { background: 'rgba(0,180,166,0.14)', color: 'var(--wardle-color-teal)' }
            : undefined
      }
      className={`rounded-full px-3 py-1 font-brand-mono text-[11px] font-bold transition-all duration-150 ${
        active ? '' : 'text-white/30 hover:text-white/54'
      }`}
    >
      {label}
    </button>
  )
}

// ─── Desktop case list ────────────────────────────────────────────────────────

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
  return (
    <section className={`min-w-0 max-w-full overflow-hidden ${className ?? ''}`}>
      <div className="min-w-0 space-y-0.5">
        {cases.map((item) => (
          <CaseLibraryCard
            key={item.dailyCaseId}
            item={item}
            selected={selectedCaseId === item.dailyCaseId}
            onSelect={() => onSelectCase(item.dailyCaseId)}
          />
        ))}
      </div>
    </section>
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
  const diagnosis = item.case.diagnosis || item.case.title
  const specialty = getCaseSpecialty(item)
  const solved = item.playerResult.solved

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative flex w-full min-w-0 items-center gap-3 rounded-[11px] px-4 py-3 text-left transition-all duration-150 ${
        selected ? 'bg-[rgba(0,180,166,0.08)]' : 'hover:bg-white/[0.03]'
      }`}
    >
      {selected && (
        <span
          aria-hidden="true"
          className="absolute left-0 h-5 w-[2px] rounded-r-full bg-[var(--wardle-color-teal)]"
        />
      )}
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${solved ? 'bg-[var(--wardle-color-teal)]/60' : 'bg-rose-400/60'}`} />
      <div className="min-w-0 flex-1">
        <p className={`truncate text-[13px] font-bold transition-colors ${
          selected ? 'text-[var(--wardle-color-mint)]' : 'text-white/64'
        }`}>
          {diagnosis}
        </p>
        <p className="mt-0.5 font-brand-mono text-[11px] text-white/28">{specialty.label}</p>
      </div>
      <span className={`shrink-0 text-xs transition-colors ${selected ? 'text-[var(--wardle-color-teal)]/50' : 'text-white/14'}`}>›</span>
    </button>
  )
}

// ─── Desktop case detail ──────────────────────────────────────────────────────

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
  if (!item) return null

  const explanation = coerceStructuredExplanation(item.case.explanation ?? {})

  return (
    <SurfaceCard className={`min-w-0 max-w-full overflow-hidden ${className ?? ''}`}>
      <div className="min-w-0 space-y-4">
        <div className="flex min-w-0 items-center justify-between gap-3 lg:hidden">
          <button
            type="button"
            onClick={onBack}
            className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-[var(--wardle-color-teal)]"
          >
            ‹ All cases
          </button>
          <span className="font-brand-mono text-[10px] text-white/24">{item.completedAt.slice(0, 10)}</span>
        </div>

        <div className="overflow-hidden rounded-[16px] border border-white/[0.07] bg-white/[0.03]">
          <div className="px-4 py-4">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <TrackBadge track={item.track} />
                <DifficultyBadge difficulty={item.case.difficulty} />
              </div>
              <span className="font-brand-mono text-[10px] text-white/28">#{item.sequenceIndex}</span>
            </div>
            <h2 className="mt-3 break-words text-xl font-black leading-snug tracking-tight text-[var(--wardle-color-mint)]">
              {item.case.diagnosis || item.case.title}
            </h2>
            <p className="mt-1 font-brand-mono text-[11px] text-white/30">
              {item.case.clues.length} clues · {item.case.date || item.completedAt.slice(0, 10)}
            </p>
          </div>
        </div>

        <TabSwitcher activeTab={activeTab} onChangeTab={onChangeTab} />

        {activeTab === 'breakdown' && <BreakdownTab explanation={explanation} />}
        {activeTab === 'differentials' && <DifferentialsTab differentials={explanation?.differentials ?? []} />}
        {activeTab === 'clues' && <CluesTab clues={item.case.clues} />}
      </div>
    </SurfaceCard>
  )
}

// ─── Tab switcher ─────────────────────────────────────────────────────────────

function TabSwitcher({ activeTab, onChangeTab }: { activeTab: DetailTab; onChangeTab: (tab: DetailTab) => void }) {
  const tabs: Array<{ id: DetailTab; label: string }> = [
    { id: 'breakdown', label: 'Breakdown' },
    { id: 'differentials', label: 'Differentials' },
    { id: 'clues', label: 'Clues' },
  ]

  return (
    <div className="grid grid-cols-3 gap-1 rounded-[20px] bg-white/[0.04] p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChangeTab(tab.id)}
          className={`rounded-[16px] px-2 py-2 text-xs font-bold transition-all duration-200 ${
            activeTab === tab.id
              ? 'bg-[var(--wardle-color-teal)] text-white'
              : 'text-white/38 hover:text-white/62'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

// ─── Content tabs ─────────────────────────────────────────────────────────────

function BreakdownTab({ explanation }: { explanation: ReturnType<typeof coerceStructuredExplanation> }) {
  if (!explanation) {
    return <InlineNotice tone="muted" copy="Explanation is still being prepared." />
  }

  const reasoningSteps = splitReasoning(explanation.reasoning ?? '')

  return (
    <div className="min-w-0 space-y-4">
      {explanation.summary && (
        <div className="rounded-[14px] border border-[rgba(0,180,166,0.15)] bg-[rgba(0,180,166,0.06)] px-4 py-3">
          <p className="mb-2 font-brand-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--wardle-color-teal)]/60">
            Summary
          </p>
          <p className="break-words text-sm leading-6 text-white/64">{explanation.summary}</p>
        </div>
      )}

      {explanation.keyFindings.length ? (
        <ReviewSection title="Key Findings" tone="teal">
          <ul className="space-y-1.5">
            {explanation.keyFindings.map((finding) => (
              <li key={finding} className="flex min-w-0 gap-2.5 rounded-[11px] border border-white/[0.05] bg-white/[0.03] px-3 py-2.5">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--wardle-color-teal)]/50" />
                <span className="min-w-0 break-words text-sm leading-6 text-white/62">{finding}</span>
              </li>
            ))}
          </ul>
        </ReviewSection>
      ) : null}

      {explanation.reasoning ? (
        <ReviewSection title="Reasoning Chain" tone="amber">
          <div className="overflow-hidden rounded-[14px] border border-white/[0.05] bg-white/[0.02]">
            {reasoningSteps.map((step, index) => (
              <div
                key={`${index}-${step}`}
                className={`flex min-w-0 gap-3 px-3 py-3 ${index < reasoningSteps.length - 1 ? 'border-b border-white/[0.04]' : ''}`}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] bg-[rgba(0,180,166,0.12)] font-brand-mono text-[10px] font-black text-[var(--wardle-color-teal)]">
                  {index + 1}
                </span>
                <p className="min-w-0 break-words text-sm leading-6 text-white/62">{step}</p>
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
    <div className="min-w-0 space-y-2">
      <p className="font-brand-mono text-[10px] font-bold uppercase tracking-[0.18em] text-white/28">
        Why not these?
      </p>
      {differentials.map((differential) => (
        <div
          key={differential}
          className="rounded-[14px] border border-white/[0.06] bg-white/[0.025] px-4 py-3"
        >
          <div className="flex min-w-0 items-start justify-between gap-3">
            <p className="min-w-0 break-words text-sm font-bold text-[var(--wardle-color-mint)]">
              {differential}
            </p>
            <span className="shrink-0 rounded-full border border-rose-400/[0.18] bg-rose-400/[0.08] px-2.5 py-1 font-brand-mono text-[10px] font-bold uppercase tracking-[0.12em] text-rose-300">
              Ruled out
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

function CluesTab({ clues }: { clues: ClinicalClue[] }) {
  const sorted = [...clues].sort((a, b) => a.order - b.order)

  return (
    <div className="min-w-0 space-y-1.5">
      {sorted.map((clue, index) => {
        const typeCopy = CLUE_TYPE_COPY[clue.type]
        return (
          <div
            key={clue.id}
            className="flex min-w-0 gap-3 rounded-[13px] border border-white/[0.05] bg-white/[0.025] px-4 py-3"
          >
            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border text-[10px] font-black ${typeCopy.tone}`}>
              {typeCopy.abbr}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-brand-mono text-[10px] font-bold uppercase tracking-[0.14em] text-white/30">
                Clue {index + 1} · {typeCopy.label}
              </p>
              <p className="mt-1 break-words text-sm leading-6 text-white/64">{clue.value}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Shared components ────────────────────────────────────────────────────────

function ReviewSection({ title, tone, children }: { title: string; tone: 'teal' | 'amber'; children: ReactNode }) {
  return (
    <section className="min-w-0">
      <p className={`mb-2 font-brand-mono text-[10px] font-bold uppercase tracking-[0.18em] ${
        tone === 'teal' ? 'text-[var(--wardle-color-teal)]/70' : 'text-[var(--wardle-color-amber)]/75'
      }`}>
        {title}
      </p>
      {children}
    </section>
  )
}

function TrackBadge({ track }: { track: PublishTrack }) {
  const copy = TRACK_COPY[track] ?? TRACK_COPY.DAILY
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-[3px] font-brand-mono text-[10px] font-bold uppercase tracking-[0.14em] ${copy.tone}`}>
      {copy.label}
    </span>
  )
}

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const normalized = difficulty.trim().toLowerCase()
  const tone = DIFFICULTY_TONES[normalized] ?? 'border border-white/[0.08] bg-white/[0.05] text-white/44'
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-[3px] font-brand-mono text-[10px] font-bold uppercase tracking-[0.14em] ${tone}`}>
      {normalized || 'standard'}
    </span>
  )
}

function InlineNotice({ tone, copy }: { tone: 'muted' | 'error'; copy: string }) {
  return (
    <div className={`rounded-[13px] border px-4 py-3 text-sm leading-6 ${
      tone === 'error'
        ? 'border-rose-300/[0.16] bg-rose-400/[0.07] text-rose-300'
        : 'border-white/[0.06] bg-white/[0.025] text-white/40'
    }`}>
      {copy}
    </div>
  )
}

function AttemptSummary({ item }: { item: LearnLibraryCase }) {
  const pips = buildAttemptPips(item.playerResult)

  return (
    <div className="mt-4 rounded-[12px] border border-white/[0.06] bg-white/[0.025] px-3 py-3">
      <p className="font-brand-mono text-[10px] font-bold uppercase tracking-[0.14em] text-white/28">
        Your Attempt
      </p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <ResultPips pips={pips} />
        <div className="shrink-0 text-right font-brand-mono text-[10px] uppercase tracking-[0.12em] text-white/36">
          <p>{item.playerResult.attemptsUsed} clues</p>
          {item.playerResult.timeSecs !== null && <p>{formatStudyTime(item.playerResult.timeSecs)}</p>}
        </div>
      </div>
    </div>
  )
}

function ResultPips({ pips }: { pips: Array<'correct' | 'used' | 'missed' | 'empty'> }) {
  return (
    <div className="flex min-w-0 flex-1 gap-1">
      {pips.map((pip, index) => (
        <span
          key={`${pip}-${index}`}
          className={`h-1.5 min-w-0 flex-1 rounded-full ${
            pip === 'correct'
              ? 'bg-[var(--wardle-color-teal)]'
              : pip === 'used'
                ? 'bg-[rgba(0,180,166,0.3)]'
                : pip === 'missed'
                  ? 'bg-rose-400/60'
                  : 'bg-white/[0.07]'
          }`}
        />
      ))}
    </div>
  )
}

function ArchiveEmptyState({
  completedCount,
  loading,
  mobile = false,
}: {
  completedCount: number
  loading: boolean
  mobile?: boolean
}) {
  if (loading) return null

  const title = completedCount > 0 ? 'No matching cases' : 'No explanations yet'
  const copy =
    completedCount > 0
      ? 'Adjust your filters to bring cases back into view.'
      : 'Complete a case to add its explanation, clues, and differentials to this library.'

  if (mobile) {
    return (
      <div className="rounded-[14px] border border-white/[0.07] bg-white/[0.025] px-4 py-5">
        <p className="text-sm font-bold text-[var(--wardle-color-mint)]">{title}</p>
        <p className="mt-2 text-sm leading-6 text-white/40">{copy}</p>
      </div>
    )
  }

  return (
    <SurfaceCard eyebrow={completedCount > 0 ? 'Filtered Cases' : 'Completed Cases'} title={title} className="min-w-0 max-w-full overflow-hidden">
      <p className="max-w-2xl text-sm leading-6 text-white/54">{copy}</p>
    </SurfaceCard>
  )
}

// ─── Pure utility functions ───────────────────────────────────────────────────

function getExplanationDifferentials(explanation: unknown) {
  const record = asRecord(explanation)
  const differentials = record?.differentials
  return Array.isArray(differentials) ? differentials : []
}

function getDifferentialTitle(value: unknown): string {
  const directValue = getStringValue(value)
  if (directValue) return directValue
  const record = asRecord(value)
  if (!record) return 'Differential'
  return (
    getStringValue(record.dx) ??
    getStringValue(record.diagnosis) ??
    getStringValue(record.title) ??
    getStringValue(record.label) ??
    'Differential'
  )
}

function getDifferentialReason(value: unknown) {
  const record = asRecord(value)
  if (!record) return null
  return (
    getStringValue(record.why) ??
    getStringValue(record.reason) ??
    getStringValue(record.rationale) ??
    null
  )
}

function splitReasoning(reasoning: string) {
  return reasoning
    .split(/\n{2,}|\n/)
    .map((step) => step.trim())
    .filter((step) => step.length > 0)
}

function sortClues(clues: ClinicalClue[]) {
  return [...clues].sort((a, b) => a.order - b.order)
}

function buildAttemptPips(result: LearnLibraryCase['playerResult']) {
  return Array.from({ length: 6 }, (_, index): 'correct' | 'used' | 'missed' | 'empty' => {
    if (index >= result.attemptsUsed) return 'empty'
    if (result.solved && index === result.attemptsUsed - 1) return 'correct'
    return result.solved ? 'used' : 'missed'
  })
}

function getMissedCases(cases: LearnLibraryCase[]) {
  return cases.filter((item) => !item.playerResult.solved)
}

function getDueReviewCases(cases: LearnLibraryCase[], reviewStateByCaseKey: LearnReviewStateByCaseKey) {
  const now = Date.now()
  return cases.filter((item) => {
    const reviewState = reviewStateByCaseKey[getLearnReviewCaseKey(item)]
    if (!reviewState?.nextReviewAt) return false
    const nextReviewAt = Date.parse(reviewState.nextReviewAt)
    return Number.isFinite(nextReviewAt) && nextReviewAt <= now
  })
}

function buildAdaptiveRecallQueue(cases: LearnLibraryCase[], reviewStateByCaseKey: LearnReviewStateByCaseKey) {
  return [...cases].sort((a, b) => {
    const diff = getAdaptiveRecallPriority(b, reviewStateByCaseKey) - getAdaptiveRecallPriority(a, reviewStateByCaseKey)
    return diff !== 0 ? diff : getCaseDateValue(a) - getCaseDateValue(b)
  })
}

function getAdaptiveRecallPriority(item: LearnLibraryCase, reviewStateByCaseKey: LearnReviewStateByCaseKey) {
  const reviewState = reviewStateByCaseKey[getLearnReviewCaseKey(item)]
  const due = isReviewDue(reviewState)
  const recallFailures = Math.max(0, (reviewState?.recallAttempts ?? 0) - (reviewState?.recallCorrect ?? 0))

  let score = 0
  if (!item.playerResult.solved) score += 700
  if (due) score += 600
  score += recallFailures * 90
  if (reviewState?.confidence === 'hard') score += 420
  score += Math.min(6, item.playerResult.attemptsUsed) * 28
  if (!reviewState?.lastReviewedAt) score += 120
  if (reviewState?.confidence === 'partial') score += 40
  if (reviewState?.confidence === 'solid') score -= 160

  return score
}

function isReviewDue(reviewState: LearnReviewState | undefined) {
  if (!reviewState?.nextReviewAt) return false
  const nextReviewAt = Date.parse(reviewState.nextReviewAt)
  return Number.isFinite(nextReviewAt) && nextReviewAt <= Date.now()
}

function createEmptyLearnReviewState(): LearnReviewState {
  return { recallAttempts: 0, recallCorrect: 0 }
}

function readLearnReviewState(): LearnReviewStateByCaseKey {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(LEARN_REVIEW_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return Object.entries(parsed as Record<string, unknown>).reduce<LearnReviewStateByCaseKey>(
      (acc, [key, value]) => {
        const state = asRecord(value)
        if (!state) return acc
        acc[key] = {
          confidence: isLearnConfidence(state.confidence) ? state.confidence : undefined,
          recallAttempts: getFiniteNumber(state.recallAttempts) ?? 0,
          recallCorrect: getFiniteNumber(state.recallCorrect) ?? 0,
          lastReviewedAt: getStringValue(state.lastReviewedAt) ?? undefined,
          nextReviewAt: getStringValue(state.nextReviewAt) ?? undefined,
          lastAnswer: getStringValue(state.lastAnswer) ?? undefined,
        }
        return acc
      },
      {},
    )
  } catch {
    return {}
  }
}

function writeLearnReviewState(reviewStateByCaseKey: LearnReviewStateByCaseKey) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LEARN_REVIEW_STORAGE_KEY, JSON.stringify(reviewStateByCaseKey))
  } catch {
    // best effort
  }
}

function isLearnConfidence(value: unknown): value is LearnConfidence {
  return value === 'hard' || value === 'partial' || value === 'solid'
}

function getLearnReviewCaseKey(item: LearnLibraryCase) {
  return item.sessionId || item.dailyCaseId
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function getCaseDateValue(item: LearnLibraryCase) {
  const value = Date.parse(item.completedAt || item.case.date || '')
  return Number.isFinite(value) ? value : 0
}

function formatStudyTime(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${String(secs).padStart(2, '0')}`
}

function getLearnPerformanceSummary(learnLibrary: LearnLibraryResponse | null, fallbackCases: LearnLibraryCase[]): LearnPerformanceSummary {
  return readBackendPerformanceSummary(learnLibrary) ?? deriveLearnPerformanceSummary(fallbackCases)
}

function readBackendPerformanceSummary(learnLibrary: LearnLibraryResponse | null): LearnPerformanceSummary | null {
  if (!learnLibrary || typeof learnLibrary !== 'object') return null
  const source = learnLibrary as LearnLibraryResponse & { performanceSummary?: unknown; performance?: unknown; metrics?: unknown }
  const candidate = asRecord(source.performanceSummary) ?? asRecord(source.performance) ?? asRecord(source.metrics)
  if (!candidate) return null
  const casesDone = getFiniteNumber(candidate.casesDone)
  if (casesDone === null) return null
  const specialties = Array.isArray(candidate.specialties)
    ? candidate.specialties
        .map((item) => asRecord(item))
        .filter((item): item is Record<string, unknown> => item !== null)
        .map((item) => {
          const key = getStringValue(item.key) ?? normalizeFilterKey(getStringValue(item.label) ?? '')
          const label = getStringValue(item.label) ?? titleCase(key)
          const specialtyCasesDone = getFiniteNumber(item.casesDone) ?? 0
          return { key, label, casesDone: specialtyCasesDone, accuracyPct: normalizePercent(getFiniteNumber(item.accuracyPct)) }
        })
        .filter((item) => item.key.length > 0 && item.casesDone > 0)
    : []
  return {
    accuracyPct: normalizePercent(getFiniteNumber(candidate.accuracyPct)),
    casesDone,
    averageCluesUsed: getFiniteNumber(candidate.averageCluesUsed),
    averageTimeSecs: getFiniteNumber(candidate.averageTimeSecs),
    specialties,
  }
}

function deriveLearnPerformanceSummary(cases: LearnLibraryCase[]): LearnPerformanceSummary {
  const casesDone = cases.length
  const solvedCount = cases.filter((item) => item.playerResult.solved).length
  const clueTotal = cases.reduce((sum, item) => sum + item.playerResult.attemptsUsed, 0)
  const timedCases = cases.filter((item) => item.playerResult.timeSecs !== null)
  const timeTotal = timedCases.reduce((sum, item) => sum + (item.playerResult.timeSecs ?? 0), 0)
  return {
    accuracyPct: casesDone > 0 ? Math.round((solvedCount / casesDone) * 100) : null,
    casesDone,
    averageCluesUsed: casesDone > 0 ? roundToOneDecimal(clueTotal / casesDone) : null,
    averageTimeSecs: timedCases.length > 0 ? Math.round(timeTotal / timedCases.length) : null,
    specialties: deriveSpecialtySummaries(cases),
  }
}

function deriveSpecialtySummaries(cases: LearnLibraryCase[]) {
  const groups = new Map<string, { label: string; casesDone: number; solved: number }>()
  cases.forEach((item) => {
    const specialty = getCaseSpecialty(item)
    const existing = groups.get(specialty.key) ?? { label: specialty.label, casesDone: 0, solved: 0 }
    existing.casesDone += 1
    existing.solved += item.playerResult.solved ? 1 : 0
    groups.set(specialty.key, existing)
  })
  return Array.from(groups.entries())
    .map(([key, value]) => ({
      key,
      label: value.label,
      casesDone: value.casesDone,
      accuracyPct: value.casesDone > 0 ? Math.round((value.solved / value.casesDone) * 100) : null,
    }))
    .sort((a, b) => b.casesDone - a.casesDone || a.label.localeCompare(b.label))
}

function buildLearnFilterOptions(cases: LearnLibraryCase[]): LearnFilterOptions {
  const specialties = deriveSpecialtySummaries(cases)
  const tracks = Array.from(new Set(cases.map((item) => item.track))).sort()
  const difficultyMap = new Map<string, { key: string; label: string }>()
  cases.forEach((item) => {
    const key = getCaseDifficultyKey(item)
    if (!difficultyMap.has(key)) difficultyMap.set(key, { key, label: titleCase(key) })
  })
  const difficulties = Array.from(difficultyMap.values()).sort((a, b) => a.label.localeCompare(b.label))
  return { specialties, tracks, difficulties }
}

function filterLearnCases(cases: LearnLibraryCase[], filters: LearnFilters) {
  return cases.filter((item) => {
    if (filters.specialty !== 'all' && getCaseSpecialty(item).key !== filters.specialty) return false
    if (filters.track !== 'all' && item.track !== filters.track) return false
    if (filters.result === 'solved' && !item.playerResult.solved) return false
    if (filters.result === 'missed' && item.playerResult.solved) return false
    if (filters.difficulty !== 'all' && getCaseDifficultyKey(item) !== filters.difficulty) return false
    return true
  })
}

function hasActiveFilters(filters: LearnFilters) {
  return filters.specialty !== 'all' || filters.track !== 'all' || filters.result !== 'all' || filters.difficulty !== 'all'
}

function getTotalActiveFilterCount(filters: LearnFilters) {
  return [
    filters.specialty !== 'all',
    filters.track !== 'all',
    filters.result !== 'all',
    filters.difficulty !== 'all',
  ].filter(Boolean).length
}

function getCaseSpecialty(item: LearnLibraryCase) {
  const caseRecord = item.case as LearnLibraryCase['case'] & Record<string, unknown>
  const itemRecord = item as LearnLibraryCase & Record<string, unknown>
  const rawLabel =
    getStringValue(caseRecord.specialty) ??
    getStringValue(caseRecord.category) ??
    getStringValue(itemRecord.specialty) ??
    getStringValue(itemRecord.category) ??
    'General Medicine'
  const rawKey =
    getStringValue(caseRecord.specialtyKey) ??
    getStringValue(caseRecord.categoryKey) ??
    getStringValue(itemRecord.specialtyKey) ??
    getStringValue(itemRecord.categoryKey) ??
    rawLabel
  return { key: normalizeFilterKey(rawKey), label: rawLabel }
}

function getCaseDifficultyKey(item: LearnLibraryCase) {
  return normalizeFilterKey(item.case.difficulty || 'standard')
}

function formatPercent(value: number | null) {
  return value === null ? '—' : `${Math.round(value)}%`
}

function formatAverageClues(value: number | null) {
  return value === null ? '—' : value.toFixed(value % 1 === 0 ? 0 : 1)
}

function normalizeFilterKey(value: string) {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return normalized || 'standard'
}

function titleCase(value: string) {
  return value.replace(/[-_]+/g, ' ').trim().replace(/\b\w/g, (l) => l.toUpperCase())
}

function roundToOneDecimal(value: number) {
  return Math.round(value * 10) / 10
}

function normalizePercent(value: number | null) {
  if (value === null) return null
  return Math.min(100, Math.max(0, value))
}

function getFiniteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function getStringValue(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
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

  if (!latest?.gameOver || !latestCase || !latestExplanation) return libraryCases

  const alreadyPresent = libraryCases.some((item) => item.case.id === latestCase.id)
  if (alreadyPresent) return libraryCases

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