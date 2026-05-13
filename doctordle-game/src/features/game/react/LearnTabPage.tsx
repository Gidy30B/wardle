import { useEffect, useMemo, useState, type ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
import WardleLogo from "../../../components/brand/WardleLogo";
import SurfaceCard from "../../../components/ui/SurfaceCard";
import { coerceStructuredExplanation } from "../gameExplanation";
import type {
  ClinicalClue,
  GameExplanation,
  GameResult,
  LearnLibraryCase,
  LearnLibraryResponse,
  PublishTrack,
} from "../game.types";
import type { RoundViewModel } from "../round.types";

type LearnTabPageProps = {
  explanation: GameExplanation | null;
  latestResult: GameResult | null;
  latestPlayedExplanation: GameExplanation | null;
  latestPlayedResult: GameResult | null;
  learnLibrary: LearnLibraryResponse | null;
  libraryLoading: boolean;
  libraryError: string | null;
  roundViewModel: RoundViewModel;
};

type DetailTab = "breakdown" | "differentials" | "clues";

type LearnPerformanceSummary = {
  accuracyPct: number | null;
  casesDone: number;
  averageCluesUsed: number | null;
  averageTimeSecs: number | null;
  specialties: Array<{
    key: string;
    label: string;
    casesDone: number;
    accuracyPct: number | null;
  }>;
};

type LearnFilters = {
  specialty: string;
  track: "all" | PublishTrack;
  result: "all" | "solved" | "missed";
  difficulty: string;
};

type LearnFilterOptions = {
  specialties: LearnPerformanceSummary["specialties"];
  tracks: PublishTrack[];
  difficulties: Array<{ key: string; label: string }>;
};

type LearnConfidence = "again" | "hard" | "good" | "easy";

type LearnReviewState = {
  confidence?: LearnConfidence;
  recallAttempts: number;
  recallCorrect: number;
  lastReviewedAt?: string;
  nextReviewAt?: string;
  lastAnswer?: string;
  lastSelectedDiagnosisId?: string;
  lastWasCorrect?: boolean;
};

type LearnReviewStateByCaseKey = Record<string, LearnReviewState>;

const LEARN_REVIEW_STORAGE_KEY = "wardle.learn.review.v1";

const ALL_FILTERS: LearnFilters = {
  specialty: "all",
  track: "all",
  result: "all",
  difficulty: "all",
};

const TRACK_COPY: Record<PublishTrack, { label: string; tone: string }> = {
  DAILY: {
    label: "Daily",
    tone: "border-[rgba(0,180,166,0.32)] bg-[rgba(0,180,166,0.14)] text-[var(--wardle-color-teal)]",
  },
  PREMIUM: {
    label: "Premium",
    tone: "border-[rgba(244,162,97,0.32)] bg-[rgba(244,162,97,0.14)] text-[var(--wardle-color-amber)]",
  },
  PRACTICE: {
    label: "Practice",
    tone: "border-white/[0.12] bg-white/[0.06] text-white/60",
  },
};

const DIFFICULTY_TONES: Record<string, string> = {
  easy: "border border-[rgba(0,180,166,0.25)] bg-[rgba(0,180,166,0.13)] text-[var(--wardle-color-teal)]",
  medium:
    "border border-[rgba(244,162,97,0.25)] bg-[rgba(244,162,97,0.13)] text-[var(--wardle-color-amber)]",
  hard: "border border-rose-400/[0.25] bg-rose-400/[0.13] text-rose-300",
};

const DIFFICULTY_ACTIVE_STYLES: Record<string, { bg: string; text: string }> = {
  easy: { bg: "rgba(0,180,166,0.18)", text: "var(--wardle-color-teal)" },
  medium: { bg: "rgba(244,162,97,0.18)", text: "var(--wardle-color-amber)" },
  hard: { bg: "rgba(248,113,113,0.14)", text: "rgb(252,165,165)" },
};

const CLUE_TYPE_COPY: Record<
  ClinicalClue["type"],
  { label: string; abbr: string; tone: string }
> = {
  history: {
    label: "History",
    abbr: "Hx",
    tone: "border-[rgba(0,180,166,0.3)] bg-[rgba(0,180,166,0.15)] text-[var(--wardle-color-teal)]",
  },
  symptom: {
    label: "Symptom",
    abbr: "Sx",
    tone: "border-[rgba(244,162,97,0.3)] bg-[rgba(244,162,97,0.15)] text-[var(--wardle-color-amber)]",
  },
  vital: {
    label: "Vitals",
    abbr: "Vt",
    tone: "border-violet-400/[0.3] bg-violet-400/[0.15] text-violet-300",
  },
  exam: {
    label: "Exam",
    abbr: "Ex",
    tone: "border-[rgba(0,180,166,0.3)] bg-[rgba(0,180,166,0.15)] text-[var(--wardle-color-teal)]",
  },
  lab: {
    label: "Lab",
    abbr: "Lb",
    tone: "border-rose-400/[0.3] bg-rose-400/[0.15] text-rose-300",
  },
  imaging: {
    label: "Imaging",
    abbr: "Im",
    tone: "border-emerald-400/[0.3] bg-emerald-400/[0.15] text-emerald-300",
  },
};

const CLUE_TYPE_TEXT_TONES: Record<ClinicalClue["type"], string> = {
  history: "text-[var(--wardle-color-teal)]",
  symptom: "text-[var(--wardle-color-amber)]",
  vital: "text-violet-300",
  exam: "text-[var(--wardle-color-teal)]",
  lab: "text-rose-300",
  imaging: "text-emerald-300",
};

const CONFIDENCE_REVIEW_DAYS: Record<LearnConfidence, number> = {
  again: 1,
  hard: 3,
  good: 10,
  easy: 30,
};

const CONFIDENCE_COPY: Record<
  LearnConfidence,
  {
    label: string;
    sublabel: string;
    tone: "rose" | "amber" | "teal" | "blue";
    marker: string;
  }
> = {
  again: {
    label: "Again",
    sublabel: "Forgot completely",
    tone: "rose",
    marker: "↺",
  },
  hard: { label: "Hard", sublabel: "Took effort", tone: "amber", marker: "!" },
  good: { label: "Good", sublabel: "Recalled ok", tone: "teal", marker: "✓" },
  easy: {
    label: "Easy",
    sublabel: "Instant recall",
    tone: "blue",
    marker: "★",
  },
};

const TRACK_LABEL: Record<string, string> = {
  DAILY: "Daily",
  PREMIUM: "Premium",
  PRACTICE: "Practice",
};

const MOBILE_SPECIALTY_ICONS: Record<string, { icon: string; tone: string }> = {
  cardiology: { icon: "❤️", tone: "bg-rose-400/[0.15] text-rose-300" },
  rheumatology: { icon: "🦴", tone: "bg-violet-400/[0.15] text-violet-300" },
  surgery: {
    icon: "🔪",
    tone: "bg-[rgba(0,180,166,0.15)] text-[var(--wardle-color-teal)]",
  },
  "general-surgery": {
    icon: "🔪",
    tone: "bg-[rgba(0,180,166,0.15)] text-[var(--wardle-color-teal)]",
  },
  respiratory: { icon: "🫁", tone: "bg-blue-400/[0.15] text-blue-300" },
  neurology: { icon: "🧠", tone: "bg-orange-400/[0.15] text-orange-300" },
  gastroenterology: {
    icon: "🫀",
    tone: "bg-emerald-400/[0.15] text-emerald-300",
  },
  gi: { icon: "🫀", tone: "bg-emerald-400/[0.15] text-emerald-300" },
  endocrinology: { icon: "⚗️", tone: "bg-amber-400/[0.15] text-amber-300" },
  haematology: { icon: "🩸", tone: "bg-red-400/[0.15] text-red-300" },
  hematology: { icon: "🩸", tone: "bg-red-400/[0.15] text-red-300" },
  oncology: { icon: "🔬", tone: "bg-fuchsia-400/[0.15] text-fuchsia-300" },
  infectious: { icon: "🦠", tone: "bg-lime-400/[0.15] text-lime-300" },
  "general-medicine": { icon: "🩺", tone: "bg-white/[0.08] text-white/70" },
};

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
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>("breakdown");
  const [filters, setFilters] = useState<LearnFilters>(ALL_FILTERS);
  const [showArchiveFilters, setShowArchiveFilters] = useState(false);
  const [studyQueueCaseIds, setStudyQueueCaseIds] = useState<string[] | null>(
    null,
  );
  const [studyQueueIndex, setStudyQueueIndex] = useState(0);
  const [reviewStateByCaseKey, setReviewStateByCaseKey] =
    useState<LearnReviewStateByCaseKey>(readLearnReviewState);
  const [selectedMobileSpecialty, setSelectedMobileSpecialty] = useState<
    string | null
  >(null);

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
  );

  const filterOptions = useMemo(
    () => buildLearnFilterOptions(completedCases),
    [completedCases],
  );
  const filteredCases = useMemo(
    () => filterLearnCases(completedCases, filters),
    [completedCases, filters],
  );
  const unfilteredSummary = useMemo(
    () => getLearnPerformanceSummary(learnLibrary, completedCases),
    [completedCases, learnLibrary],
  );
  const displayedSummary = useMemo(
    () =>
      hasActiveFilters(filters)
        ? deriveLearnPerformanceSummary(filteredCases)
        : unfilteredSummary,
    [filteredCases, filters, unfilteredSummary],
  );
  const missedCases = useMemo(
    () => getMissedCases(completedCases),
    [completedCases],
  );
  const dueReviewCases = useMemo(
    () => getDueReviewCases(completedCases, reviewStateByCaseKey),
    [completedCases, reviewStateByCaseKey],
  );
  const selectedMobileSpecialtyCases = useMemo(
    () =>
      selectedMobileSpecialty
        ? completedCases.filter(
            (item) => getCaseSpecialty(item).key === selectedMobileSpecialty,
          )
        : [],
    [completedCases, selectedMobileSpecialty],
  );
  const selectedMobileSpecialtySummary = selectedMobileSpecialty
    ? (displayedSummary.specialties.find(
        (specialty) => specialty.key === selectedMobileSpecialty,
      ) ?? null)
    : null;

  const selectedCase =
    completedCases.find((item) => item.dailyCaseId === selectedCaseId) ?? null;
  const activeCase = selectedCase ?? filteredCases[0] ?? null;
  const studyQueueCases = useMemo(() => {
    if (!studyQueueCaseIds) return [];
    const caseById = new Map(
      completedCases.map((item) => [item.dailyCaseId, item]),
    );
    return studyQueueCaseIds
      .map((id) => caseById.get(id))
      .filter((item): item is LearnLibraryCase => item !== undefined);
  }, [completedCases, studyQueueCaseIds]);

  useEffect(() => {
    if (!filteredCases.length) {
      setSelectedCaseId(null);
      setStudyQueueCaseIds(null);
      setStudyQueueIndex(0);
      return;
    }
    if (
      selectedCaseId &&
      !filteredCases.some((item) => item.dailyCaseId === selectedCaseId)
    ) {
      setSelectedCaseId(null);
      setActiveTab("breakdown");
    }
  }, [filteredCases, selectedCaseId]);

  useEffect(() => {
    writeLearnReviewState(reviewStateByCaseKey);
  }, [reviewStateByCaseKey]);

  useEffect(() => {
    if (!studyQueueCaseIds) return;
    if (!studyQueueCases.length) {
      setStudyQueueCaseIds(null);
      setStudyQueueIndex(0);
      return;
    }
    if (studyQueueIndex >= studyQueueCases.length) {
      setStudyQueueIndex(Math.max(0, studyQueueCases.length - 1));
    }
  }, [studyQueueCaseIds, studyQueueCases.length, studyQueueIndex]);

  const selectCase = (dailyCaseId: string) => {
    setStudyQueueCaseIds(null);
    setStudyQueueIndex(0);
    setSelectedCaseId(dailyCaseId);
    setSelectedMobileSpecialty(null);
    setActiveTab("breakdown");
  };

  const clearSelectedCase = () => {
    setSelectedCaseId(null);
    setActiveTab("breakdown");
    setStudyQueueCaseIds(null);
    setStudyQueueIndex(0);
  };

  const clearSelectedMobileSpecialty = () => {
    setSelectedMobileSpecialty(null);
    setSelectedCaseId(null);
    setActiveTab("breakdown");
  };

  const updateFilters = (nextFilters: LearnFilters) => {
    setFilters(nextFilters);
    setSelectedCaseId(null);
    setActiveTab("breakdown");
    setStudyQueueCaseIds(null);
    setStudyQueueIndex(0);
    setSelectedMobileSpecialty(null);
  };

  const startDueReviewQueue = () => {
    if (!dueReviewCases.length) return;
    const queueCaseIds = buildAdaptiveRecallQueue(
      dueReviewCases,
      reviewStateByCaseKey,
    ).map((item) => item.dailyCaseId);
    setStudyQueueCaseIds(queueCaseIds);
    setStudyQueueIndex(0);
    setSelectedCaseId(null);
    setActiveTab("breakdown");
  };

  const exitStudyQueue = () => {
    setStudyQueueCaseIds(null);
    setStudyQueueIndex(0);
  };

  const updateReviewState = (
    item: LearnLibraryCase,
    updater: (current: LearnReviewState) => LearnReviewState,
  ) => {
    const key = getLearnReviewCaseKey(item);
    setReviewStateByCaseKey((current) => ({
      ...current,
      [key]: updater(current[key] ?? createEmptyLearnReviewState()),
    }));
  };

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
        ) : selectedMobileSpecialty ? (
          <MobileSpecialtyCasesScreen
            specialtyLabel={
              selectedMobileSpecialtySummary?.label ??
              titleCase(selectedMobileSpecialty)
            }
            cases={selectedMobileSpecialtyCases}
            dueReviewCount={
              dueReviewCases.filter(
                (item) =>
                  getCaseSpecialty(item).key === selectedMobileSpecialty,
              ).length
            }
            onBack={clearSelectedMobileSpecialty}
            onSelectCase={selectCase}
            onStartDueReviewQueue={() => {
              const dueCases = dueReviewCases.filter(
                (item) =>
                  getCaseSpecialty(item).key === selectedMobileSpecialty,
              );
              if (!dueCases.length) return;
              const queueCaseIds = buildAdaptiveRecallQueue(
                dueCases,
                reviewStateByCaseKey,
              ).map((item) => item.dailyCaseId);
              setStudyQueueCaseIds(queueCaseIds);
              setStudyQueueIndex(0);
              setSelectedCaseId(null);
              setSelectedMobileSpecialty(null);
              setActiveTab("breakdown");
            }}
          />
        ) : !selectedCase ? (
          <>
            <MobileLearnHeader />
            <MobileStatsBar
              summary={displayedSummary}
              loading={libraryLoading}
              error={libraryError}
            />
            <MobileCaseArchive
              cases={completedCases}
              completedCount={completedCases.length}
              summary={displayedSummary}
              missedCount={missedCases.length}
              dueReviewCount={dueReviewCases.length}
              dueReviewCases={dueReviewCases}
              onSelectSpecialty={setSelectedMobileSpecialty}
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

          {libraryError ? (
            <InlineNotice tone="error" copy="Unable to load completed cases." />
          ) : null}
          {libraryLoading ? (
            <InlineNotice tone="muted" copy="Loading completed cases..." />
          ) : null}

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
            <ArchiveEmptyState
              completedCount={completedCases.length}
              loading={libraryLoading}
            />
          )}
        </div>
      </main>
    </>
  );
}

// ─── Mobile header ────────────────────────────────────────────────────────────

function MobileLearnHeader() {
  return (
    <div className="sticky top-0 z-20 flex min-w-0 items-center justify-between border-b border-white/[0.05] bg-[var(--wardle-color-charcoal)]/96 px-5 py-3 backdrop-blur">
      <WardleLogo size="sm" />
      <span className="font-brand-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--wardle-color-teal)]/50">
        Learn
      </span>
    </div>
  );
}

// ─── Mobile stats bar ─────────────────────────────────────────────────────────

function MobileStatsBar({
  summary,
  loading,
  error,
}: {
  summary: LearnPerformanceSummary;
  loading: boolean;
  error: string | null;
}) {
  const accuracy = summary.accuracyPct;
  const accuracyLabel =
    accuracy === null
      ? "—"
      : accuracy >= 80
        ? "Excellent"
        : accuracy >= 65
          ? "Good"
          : "Needs work";

  return (
    <section className="px-5 pt-4 pb-1">
      <div className="flex border-b border-white/[0.08] pb-4">
        <MobileKoiStat value={String(summary.casesDone)} label="Cases done" />
        <MobileKoiStat
          value={formatPercent(summary.accuracyPct)}
          label="Accuracy"
          tone="teal"
        />
        <MobileKoiStat
          value={formatAverageClues(summary.averageCluesUsed)}
          label="Avg clues"
          sub="/6"
          tone="amber"
        />
      </div>
      {accuracy !== null && (
        <div className="mt-3 flex items-center gap-2.5">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
            <div
              className="h-full rounded-full bg-[var(--wardle-color-teal)] transition-all duration-500"
              style={{ width: `${accuracy}%` }}
            />
          </div>
          <span className="font-brand-mono text-[11px] font-bold text-[var(--wardle-color-teal)]">
            {accuracy}%
          </span>
          <span className="text-[11px] text-white/30">{accuracyLabel}</span>
        </div>
      )}
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
  );
}

function MobileKoiStat({
  value,
  label,
  sub,
  tone = "neutral",
}: {
  value: string;
  label: string;
  sub?: string;
  tone?: "teal" | "amber" | "neutral";
}) {
  const colorClass =
    tone === "teal"
      ? "text-[var(--wardle-color-teal)]"
      : tone === "amber"
        ? "text-[var(--wardle-color-amber)]"
        : "text-[var(--wardle-color-mint)]";
  return (
    <div className="flex-1 px-1 text-center [&+&]:border-l [&+&]:border-white/[0.08]">
      <div
        className={`font-brand-mono text-[22px] font-black leading-none ${colorClass}`}
      >
        {value}
        {sub && (
          <span className="ml-0.5 text-[12px] font-semibold text-white/42">
            {sub}
          </span>
        )}
      </div>
      <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/28">
        {label}
      </div>
    </div>
  );
}

// ─── Mobile case archive ──────────────────────────────────────────────────────

function MobileCaseArchive({
  cases,
  completedCount,
  summary,
  missedCount,
  dueReviewCount,
  dueReviewCases,
  onSelectSpecialty,
  onStartDueReviewQueue,
  loading,
}: {
  cases: LearnLibraryCase[];
  completedCount: number;
  summary: LearnPerformanceSummary;
  missedCount: number;
  dueReviewCount: number;
  dueReviewCases: LearnLibraryCase[];
  onSelectSpecialty: (specialtyKey: string) => void;
  onStartDueReviewQueue: () => void;
  loading: boolean;
}) {
  return (
    <section className="space-y-5 px-4 pt-4">
      {completedCount > 0 && (
        <MobileDueRecallCard
          dueReviewCount={dueReviewCount}
          missedCount={missedCount}
          completedCount={completedCount}
          onStartDueReviewQueue={onStartDueReviewQueue}
        />
      )}

      <div className="flex min-w-0 items-end justify-between gap-3 pt-1">
        <div className="min-w-0">
          <h2 className="text-[15px] font-black tracking-tight text-[var(--wardle-color-mint)]">
            Specialties
          </h2>
          <p className="mt-0.5 font-brand-mono text-[10px] uppercase tracking-[0.14em] text-white/24">
            {completedCount} completed
          </p>
        </div>
        {missedCount > 0 && (
          <span className="shrink-0 rounded-full border border-rose-400/[0.18] bg-rose-400/[0.07] px-2.5 py-1 font-brand-mono text-[10px] font-bold text-rose-300">
            {missedCount} missed
          </span>
        )}
      </div>

      {summary.specialties.length > 0 ? (
        <div className="space-y-2.5">
          {summary.specialties.map((specialty) => (
            <MobileSpecialtyCard
              key={specialty.key}
              specialty={specialty}
              cases={cases.filter(
                (item) => getCaseSpecialty(item).key === specialty.key,
              )}
              dueCount={
                dueReviewCases.filter(
                  (item) => getCaseSpecialty(item).key === specialty.key,
                ).length
              }
              onSelect={() => onSelectSpecialty(specialty.key)}
            />
          ))}
        </div>
      ) : (
        <ArchiveEmptyState
          completedCount={completedCount}
          loading={loading}
          mobile
        />
      )}
    </section>
  );
}

function MobileSpecialtyCard({
  specialty,
  cases,
  dueCount,
  onSelect,
}: {
  specialty: LearnPerformanceSummary["specialties"][number];
  cases: LearnLibraryCase[];
  dueCount: number;
  onSelect: () => void;
}) {
  const solvedCount = cases.filter((item) => item.playerResult.solved).length;
  const missedCount = cases.length - solvedCount;
  const accuracy = specialty.accuracyPct;
  const accuracyTone =
    accuracy === null
      ? "text-white/38"
      : accuracy >= 75
        ? "text-[var(--wardle-color-teal)]"
        : accuracy >= 60
          ? "text-[var(--wardle-color-amber)]"
          : "text-rose-300";
  const progressColor =
    accuracy === null
      ? "bg-white/20"
      : accuracy >= 75
        ? "bg-[var(--wardle-color-teal)]"
        : accuracy >= 60
          ? "bg-[var(--wardle-color-amber)]"
          : "bg-rose-400";
  const progressWidth = accuracy === null ? 0 : accuracy;
  const icon = getMobileSpecialtyIcon(specialty.key);

  return (
    <button
      type="button"
      onClick={onSelect}
      className="wardle-learn-fade w-full overflow-hidden rounded-[16px] border border-white/[0.12] bg-white/[0.055] px-3.5 py-3 text-left transition active:scale-[0.99] hover:bg-white/[0.08]"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[11px] text-[17px] ${icon.tone}`}
        >
          {icon.icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-bold text-[var(--wardle-color-mint)]">
            {specialty.label}
          </span>
          <span className="mt-0.5 block text-[11px] text-white/32">
            {specialty.casesDone} case{specialty.casesDone === 1 ? "" : "s"}
            {dueCount > 0 ? ` · ${dueCount} due` : ""}
            {missedCount > 0 ? ` · ${missedCount} missed` : ""}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={`font-brand-mono text-[15px] font-black ${accuracyTone}`}
          >
            {accuracy !== null ? `${accuracy}%` : "—"}
          </span>
          {dueCount > 0 ? (
            <span className="rounded-full border border-rose-400/[0.22] bg-rose-400/[0.12] px-2 py-0.5 text-[10px] font-bold text-rose-300">
              {dueCount} due
            </span>
          ) : (
            <span className="rounded-full border border-[rgba(0,180,166,0.18)] bg-[rgba(0,180,166,0.08)] px-2 py-0.5 text-[10px] font-bold text-[var(--wardle-color-teal)]">
              All clear
            </span>
          )}
        </span>
      </div>
      <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-[#202436]">
        <div
          className={`h-full rounded-full ${progressColor} transition-all duration-500`}
          style={{ width: `${progressWidth}%` }}
        />
      </div>
    </button>
  );
}

function MobileSpecialtyCasesScreen({
  specialtyLabel,
  cases,
  dueReviewCount,
  onBack,
  onSelectCase,
  onStartDueReviewQueue,
}: {
  specialtyLabel: string;
  cases: LearnLibraryCase[];
  dueReviewCount: number;
  onBack: () => void;
  onSelectCase: (dailyCaseId: string) => void;
  onStartDueReviewQueue: () => void;
}) {
  const solvedCount = cases.filter((item) => item.playerResult.solved).length;
  const accuracy =
    cases.length > 0 ? Math.round((solvedCount / cases.length) * 100) : null;
  const avgClues =
    cases.length > 0
      ? roundToOneDecimal(
          cases.reduce((sum, item) => sum + item.playerResult.attemptsUsed, 0) /
            cases.length,
        )
      : null;
  const specialtyKey = cases[0]
    ? getCaseSpecialty(cases[0]).key
    : normalizeFilterKey(specialtyLabel);
  const icon = getMobileSpecialtyIcon(specialtyKey);

  return (
    <div className="min-w-0 pb-6">
      <div className="flex min-w-0 items-center gap-3 px-5 pt-4">
        <button
          type="button"
          onClick={onBack}
          className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] border border-white/[0.12] bg-white/[0.06] text-base text-white/70"
        >
          ←
        </button>
        <h1 className="truncate text-[16px] font-bold text-[var(--wardle-color-mint)]">
          {specialtyLabel}
        </h1>
      </div>

      <section className="space-y-4 px-5 pt-4">
        <div className="rounded-[16px] border border-white/[0.12] bg-white/[0.055] p-4">
          <div className="mb-3.5 flex items-center gap-3">
            <span
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] text-[22px] ${icon.tone}`}
            >
              {icon.icon}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[18px] font-black text-[var(--wardle-color-mint)]">
                {specialtyLabel}
              </span>
              <span className="mt-0.5 block text-[12px] text-white/32">
                {cases.length} cases · {dueReviewCount} due for recall
              </span>
            </span>
          </div>
          <div className="flex border-t border-white/[0.08] pt-3">
            <MobileSpecialtyHeroStat
              label="Accuracy"
              value={accuracy !== null ? `${accuracy}%` : "—"}
              tone={
                accuracy !== null && accuracy >= 75
                  ? "teal"
                  : accuracy !== null && accuracy >= 60
                    ? "amber"
                    : "rose"
              }
            />
            <MobileSpecialtyHeroStat
              label="Solved"
              value={String(solvedCount)}
            />
            <MobileSpecialtyHeroStat
              label="Avg clues"
              value={avgClues !== null ? String(avgClues) : "—"}
            />
          </div>
        </div>

        {dueReviewCount > 0 && (
          <button
            type="button"
            onClick={onStartDueReviewQueue}
            className="flex w-full items-center gap-3 rounded-[14px] border border-[rgba(239,159,39,0.22)] bg-[rgba(239,159,39,0.08)] px-4 py-3 text-left transition active:scale-[0.99]"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[rgba(239,159,39,0.13)] text-[17px]">
              ⏰
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-bold text-[var(--wardle-color-amber)]">
                {dueReviewCount} due for recall
              </span>
              <span className="mt-0.5 block text-[11px] text-white/34">
                Start this specialty queue
              </span>
            </span>
            <span className="rounded-[8px] bg-[var(--wardle-color-amber)] px-3 py-1.5 text-[12px] font-bold text-white">
              Start →
            </span>
          </button>
        )}

        <h2 className="pt-1 text-[11px] font-bold uppercase tracking-[0.1em] text-white/28">
          Cases
        </h2>
        <div className="space-y-2">
          {cases.map((item) => (
            <MobileCaseCard
              key={item.dailyCaseId}
              item={item}
              onSelect={() => onSelectCase(item.dailyCaseId)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function MobileSpecialtyHeroStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "teal" | "amber" | "rose" | "neutral";
}) {
  const toneClass =
    tone === "teal"
      ? "text-[var(--wardle-color-teal)]"
      : tone === "amber"
        ? "text-[var(--wardle-color-amber)]"
        : tone === "rose"
          ? "text-rose-300"
          : "text-[var(--wardle-color-mint)]";
  return (
    <div className="flex-1 text-center [&+&]:border-l [&+&]:border-white/[0.08]">
      <div className={`font-brand-mono text-[18px] font-black ${toneClass}`}>
        {value}
      </div>
      <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-white/28">
        {label}
      </div>
    </div>
  );
}

function MobileDueRecallCard({
  dueReviewCount,
  missedCount,
  completedCount,
  onStartDueReviewQueue,
}: {
  dueReviewCount: number;
  missedCount: number;
  completedCount: number;
  onStartDueReviewQueue: () => void;
}) {
  const hasDue = dueReviewCount > 0;
  const statusCopy = hasDue
    ? `${dueReviewCount} case${dueReviewCount === 1 ? "" : "s"} due for recall`
    : "Recall queue clear";
  const subcopy = hasDue
    ? "Spaced repetition keeps memory sharp"
    : completedCount > 0
      ? "Reviewed cases will return when due"
      : "Complete cases to build this queue";

  return (
    <button
      type="button"
      onClick={hasDue ? onStartDueReviewQueue : undefined}
      disabled={!hasDue}
      className={`wardle-learn-slide-up flex w-full items-center gap-3 rounded-[14px] border px-3.5 py-3 text-left transition ${
        hasDue
          ? "border-[rgba(239,159,39,0.22)] bg-[rgba(239,159,39,0.08)] active:scale-[0.99]"
          : "border-white/[0.07] bg-white/[0.025]"
      }`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] text-[17px] ${hasDue ? "bg-[rgba(239,159,39,0.13)]" : "bg-white/[0.04] opacity-50"}`}
      >
        ⏰
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block text-[13px] font-bold ${hasDue ? "text-[var(--wardle-color-amber)]" : "text-white/42"}`}
        >
          {statusCopy}
        </span>
        <span className="mt-0.5 block text-[11px] text-white/32">
          {missedCount > 0 && hasDue
            ? `${missedCount} missed prioritized · `
            : ""}
          {subcopy}
        </span>
      </span>
      {hasDue && (
        <span className="shrink-0 rounded-[8px] bg-[var(--wardle-color-amber)] px-3 py-2 text-[12px] font-bold text-white">
          Start →
        </span>
      )}
    </button>
  );
}

// ─── Mobile case card ─────────────────────────────────────────────────────────

function MobileCaseCard({
  item,
  onSelect,
}: {
  item: LearnLibraryCase;
  onSelect: () => void;
}) {
  const solved = item.playerResult.solved;
  const diagnosis = item.case.diagnosis || item.case.title;
  const caseLabel = formatArchiveCaseLabel(item);
  const specialty = getCaseSpecialty(item);
  const icon = getMobileSpecialtyIcon(specialty.key);

  return (
    <button
      type="button"
      onClick={onSelect}
      className="wardle-learn-fade flex w-full min-w-0 items-center gap-3 rounded-[14px] border border-white/[0.12] bg-white/[0.055] px-3.5 py-3 text-left transition active:scale-[0.99] hover:bg-white/[0.08]"
    >
      <span
        className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] text-[15px] ${icon.tone}`}
      >
        {icon.icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-bold text-[var(--wardle-color-mint)]">
          {diagnosis}
        </span>
        <span className="mt-0.5 block text-[11px] text-white/32">
          {caseLabel} ·{" "}
          {solved
            ? `Accuracy: ${item.playerResult.attemptsUsed}/6 clues`
            : "Not yet solved"}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        {solved ? (
          <span className="rounded-full border border-[rgba(0,180,166,0.2)] bg-[rgba(0,180,166,0.1)] px-2 py-0.5 text-[10px] font-bold text-[var(--wardle-color-teal)]">
            ✓ Solved
          </span>
        ) : (
          <span className="rounded-full border border-rose-400/[0.22] bg-rose-400/[0.12] px-2 py-0.5 text-[10px] font-bold text-rose-300">
            Unsolved
          </span>
        )}
        <span className="font-brand-mono text-[10px] text-white/28">
          {item.playerResult.attemptsUsed}/6 clues
        </span>
      </span>
    </button>
  );
}

// ─── Mobile case detail ───────────────────────────────────────────────────────

function MobileCaseDetail({
  item,
  activeTab,
  onChangeTab,
  onBack,
}: {
  item: LearnLibraryCase;
  activeTab: DetailTab;
  onChangeTab: (tab: DetailTab) => void;
  onBack: () => void;
}) {
  const explanation = coerceStructuredExplanation(item.case.explanation ?? {});
  const diagnosis = item.case.diagnosis || item.case.title;

  useEffect(() => {
    onChangeTab("breakdown");
  }, [item.dailyCaseId, onChangeTab]);

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
                {formatArchiveCaseLabel(item)}
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
                {diagnosis}
              </h2>
              <p className="mt-1 font-brand-mono text-[11px] text-white/30">
                {item.case.clues.length} clues ·{" "}
                {item.case.date || item.completedAt.slice(0, 10)}
              </p>
            </div>

            <AttemptSummary item={item} />
          </div>
        </div>

        {/* Tabs + content */}
        <TabSwitcher activeTab={activeTab} onChangeTab={onChangeTab} />

        <div>
          {activeTab === "breakdown" && (
            <BreakdownTab explanation={explanation} />
          )}
          {activeTab === "differentials" && (
            <DifferentialsTab
              differentials={explanation?.differentials ?? []}
            />
          )}
          {activeTab === "clues" && <CluesTab clues={item.case.clues} />}
        </div>
      </section>
    </div>
  );
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
  queue: LearnLibraryCase[];
  reviewStateByCaseKey: LearnReviewStateByCaseKey;
  studyQueueIndex: number;
  onChangeIndex: (index: number) => void;
  onExit: () => void;
  onUpdateReviewState: (
    item: LearnLibraryCase,
    updater: (current: LearnReviewState) => LearnReviewState,
  ) => void;
}) {
  const item = queue[studyQueueIndex] ?? queue[0];
  const canGoPrevious = studyQueueIndex > 0;
  const canGoNext = studyQueueIndex < queue.length - 1;

  if (!item) return null;

  return (
    <div className="fixed inset-0 z-[2147483647] isolate flex h-[100dvh] min-h-0 w-screen min-w-0 flex-col overflow-hidden bg-[var(--wardle-color-charcoal)] lg:hidden">
      <DiagnosisRecallSurface
        key={item.dailyCaseId}
        item={item}
        allCases={queue}
        queueIndex={studyQueueIndex}
        queueSize={queue.length}
        reviewStateByCaseKey={reviewStateByCaseKey}
        reviewState={
          reviewStateByCaseKey[getLearnReviewCaseKey(item)] ??
          createEmptyLearnReviewState()
        }
        onExit={onExit}
        onPrevious={
          canGoPrevious ? () => onChangeIndex(studyQueueIndex - 1) : undefined
        }
        onNext={
          canGoNext ? () => onChangeIndex(studyQueueIndex + 1) : undefined
        }
        onUpdateReviewState={(updater) => onUpdateReviewState(item, updater)}
      />
    </div>
  );
}

// ─── DiagnosisRecallSurface ────────────────────────────────────────────────

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
  item: LearnLibraryCase;
  allCases: LearnLibraryCase[];
  queueIndex: number;
  queueSize: number;
  reviewStateByCaseKey: LearnReviewStateByCaseKey;
  reviewState: LearnReviewState;
  onExit: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onUpdateReviewState: (
    updater: (current: LearnReviewState) => LearnReviewState,
  ) => void;
}) {
  const [recallPhase, setRecallPhase] = useState<
    "question" | "answer" | "complete"
  >("question");
  const [visibleClueCount, setVisibleClueCount] = useState(1);
  const [query, setQuery] = useState("");
  const [selectedOption, setSelectedOption] =
    useState<RecallAnswerOption | null>(null);
  const [committedAnswer, setCommittedAnswer] = useState("");
  const [committedAnswerId, setCommittedAnswerId] = useState<
    string | undefined
  >(undefined);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [hasRatedCurrentCard, setHasRatedCurrentCard] = useState(false);

  const answerOptions = useMemo(
    () => buildRecallAnswerOptions(allCases, item),
    [allCases, item],
  );
  const correctDiagnosisId = getRecallDiagnosisOptionId(item);
  const wasCorrect = committedAnswerId
    ? committedAnswerId === correctDiagnosisId
    : isRecallTextMatch(committedAnswer, item);

  const sortedClues = useMemo(
    () => sortClues(item.case.clues),
    [item.case.clues],
  );
  const remainingClues = Math.max(0, sortedClues.length - visibleClueCount);
  const matchingOptions = useMemo(
    () => filterRecallAnswerOptions(answerOptions, query).slice(0, 5),
    [answerOptions, query],
  );
  const committedLabel = selectedOption?.label ?? query.trim();

  const ratedCount = allCases.filter(
    (c) => reviewStateByCaseKey[getLearnReviewCaseKey(c)]?.confidence,
  ).length;
  const canAdvanceFromAnswer = recallPhase === "answer" && hasRatedCurrentCard;
  const isFinalCase = queueIndex >= queueSize - 1;

  const rateRecallConfidence = (confidence: LearnConfidence) => {
    const reviewedAt = new Date();
    const shouldCount = !hasRatedCurrentCard;
    setHasRatedCurrentCard(true);
    onUpdateReviewState((current) => ({
      ...current,
      confidence,
      recallAttempts: current.recallAttempts + (shouldCount ? 1 : 0),
      recallCorrect:
        current.recallCorrect + (shouldCount && wasCorrect ? 1 : 0),
      lastAnswer: committedAnswer,
      lastSelectedDiagnosisId: committedAnswerId,
      lastWasCorrect: wasCorrect,
      lastReviewedAt: reviewedAt.toISOString(),
      nextReviewAt: addDays(
        reviewedAt,
        CONFIDENCE_REVIEW_DAYS[confidence],
      ).toISOString(),
    }));
  };

  const handleCommitAnswer = () => {
    if (!committedLabel) return;
    setCommittedAnswer(committedLabel);
    setCommittedAnswerId(selectedOption?.id);
    setRecallPhase("answer");
  };

  const resetCard = () => {
    setRecallPhase("question");
    setVisibleClueCount(1);
    setQuery("");
    setSelectedOption(null);
    setCommittedAnswer("");
    setCommittedAnswerId(undefined);
    setHasRatedCurrentCard(false);
  };

  const handleRetry = () => resetCard();

  const goPrevious = () => {
    if (!onPrevious) return;
    resetCard();
    onPrevious();
  };

  const goNext = () => {
    if (!canAdvanceFromAnswer) return;
    if (onNext) {
      resetCard();
      onNext();
      return;
    }
    setRecallPhase("complete");
  };

  if (recallPhase === "complete") {
    return (
      <div className="relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-[#13141f] px-4">
        <RecallCompletionScreen
          queue={allCases}
          reviewStateByCaseKey={reviewStateByCaseKey}
          onDone={onExit}
        />
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-[var(--wardle-color-charcoal)]">
      <div className="shrink-0 border-b border-white/[0.07] bg-[#13141f] px-4 pb-3 pt-3">
        <div className="mb-2.5 flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowExitConfirm(true)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-white/[0.12] bg-white/[0.05] text-[15px] font-bold leading-none text-white/48 transition active:scale-[0.98] hover:bg-white/[0.08]"
            aria-label="Exit recall"
          >
            ×
          </button>
          <span className="min-w-0 flex-1 text-center font-brand-mono text-[10px] font-bold uppercase tracking-[0.14em] text-white/34">
            Adaptive recall
          </span>
          <span className="shrink-0 font-brand-mono text-[10px] text-white/34">
            {ratedCount}/{queueSize} rated
          </span>
        </div>

        <RecallProgressTrack
          queue={allCases}
          queueIndex={queueIndex}
          queueSize={queueSize}
          reviewStateByCaseKey={reviewStateByCaseKey}
        />
      </div>

      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-4">
        {recallPhase === "question" ? (
          <RecallQuestionContent
            item={item}
            sortedClues={sortedClues}
            visibleClueCount={visibleClueCount}
          />
        ) : (
          <RecallAnswerCard
            key={`${item.dailyCaseId}-answer`}
            item={item}
            committedAnswer={committedAnswer}
            wasCorrect={wasCorrect}
            reviewState={reviewState}
            onRateConfidence={rateRecallConfidence}
          />
        )}
      </div>

      {recallPhase === "question" ? (
        <RecallAnswerComposer
          query={query}
          selectedOption={selectedOption}
          matchingOptions={matchingOptions}
          remainingClues={remainingClues}
          canCommit={Boolean(committedLabel)}
          onChangeQuery={(value) => {
            setQuery(value);
            setSelectedOption(null);
          }}
          onSelectOption={(option) => {
            setSelectedOption(option);
            setQuery(option.label);
          }}
          onRevealNextClue={() =>
            setVisibleClueCount((count) =>
              Math.min(count + 1, sortedClues.length),
            )
          }
          onCommit={handleCommitAnswer}
        />
      ) : (
        <div className="shrink-0 border-t border-white/[0.07] bg-[rgba(18,18,28,0.98)] px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleRetry}
              className="rounded-[13px] border border-white/[0.07] bg-white/[0.03] px-3 py-3 text-sm font-bold text-white/44 transition active:scale-[0.98]"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={!canAdvanceFromAnswer}
              className={`rounded-[13px] border px-3 py-3 text-sm font-bold transition disabled:opacity-30 ${
                canAdvanceFromAnswer
                  ? "border-[rgba(0,180,166,0.26)] bg-[rgba(0,180,166,0.13)] text-[var(--wardle-color-teal)]"
                  : "border-white/[0.07] bg-white/[0.03] text-white/44"
              }`}
            >
              {isFinalCase ? "Finish" : "Next case"}
            </button>
          </div>
          {onPrevious && (
            <button
              type="button"
              onClick={goPrevious}
              className="mt-2 w-full text-center text-xs font-bold text-white/26 transition hover:text-white/48"
            >
              Previous case
            </button>
          )}
        </div>
      )}

      {showExitConfirm && (
        <div className="wardle-learn-fade absolute inset-0 z-50 flex items-center justify-center bg-black/60 px-6">
          <div className="wardle-learn-slide-up w-full rounded-[20px] border border-white/[0.07] bg-[#1e1e2e] px-5 py-5">
            <p className="text-[15px] font-black text-[var(--wardle-color-mint)]">
              Exit review queue?
            </p>
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
  );
}

function RecallCompletionScreen({
  queue,
  reviewStateByCaseKey,
  onDone,
}: {
  queue: LearnLibraryCase[];
  reviewStateByCaseKey: LearnReviewStateByCaseKey;
  onDone: () => void;
}) {
  const counts = queue.reduce(
    (acc, item) => {
      const confidence =
        reviewStateByCaseKey[getLearnReviewCaseKey(item)]?.confidence;
      if (confidence) acc[confidence] += 1;
      return acc;
    },
    { again: 0, hard: 0, good: 0, easy: 0 } as Record<
      LearnConfidence,
      number
    >,
  );

  const reviewedCount = counts.again + counts.hard + counts.good + counts.easy;

  return (
    <section className="wardle-learn-slide-up flex min-h-full flex-col items-center justify-center px-1 py-8 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full border border-[rgba(0,180,166,0.3)] bg-[rgba(0,180,166,0.12)] text-4xl font-black text-[var(--wardle-color-teal)] shadow-[0_0_42px_rgba(0,180,166,0.12)]">
        ✓
      </div>
      <h2 className="mt-5 text-2xl font-black tracking-[-0.02em] text-white/92">
        Session done!
      </h2>
      <p className="mt-2 max-w-[280px] text-[13px] leading-6 text-white/46">
        You've reviewed {reviewedCount || queue.length} case
        {(reviewedCount || queue.length) === 1 ? "" : "s"} due today. Next
        sessions are scheduled based on your ratings.
      </p>

      <div className="mt-6 grid w-full grid-cols-2 gap-2">
        <RecallCompletionStat label="Easy" value={counts.easy} tone="blue" />
        <RecallCompletionStat label="Good" value={counts.good} tone="teal" />
        <RecallCompletionStat label="Hard" value={counts.hard} tone="amber" />
        <RecallCompletionStat label="Again" value={counts.again} tone="rose" />
      </div>

      <button
        type="button"
        onClick={onDone}
        className="mt-6 w-full rounded-[14px] bg-[var(--wardle-color-teal)] px-4 py-4 text-[15px] font-black text-white transition active:scale-[0.98]"
      >
        Back to Learn
      </button>
    </section>
  );
}

function RecallCompletionStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "blue" | "teal" | "amber" | "rose";
}) {
  const toneClass =
    tone === "blue"
      ? "text-blue-300"
      : tone === "teal"
        ? "text-[var(--wardle-color-teal)]"
        : tone === "amber"
          ? "text-[var(--wardle-color-amber)]"
          : "text-rose-300";

  return (
    <div className="rounded-[14px] border border-white/[0.12] bg-[#252840] px-3 py-4">
      <div
        className={`font-brand-mono text-[22px] font-black leading-none ${toneClass}`}
      >
        {value}
      </div>
      <div className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-white/26">
        {label}
      </div>
    </div>
  );
}

function RecallProgressTrack({
  queue,
  queueIndex,
  queueSize,
  reviewStateByCaseKey,
}: {
  queue: LearnLibraryCase[];
  queueIndex: number;
  queueSize: number;
  reviewStateByCaseKey: LearnReviewStateByCaseKey;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1">
      <div className="flex min-w-0 flex-1 items-center gap-[3px]">
        {queue.map((queueItem, index) => {
          const state = reviewStateByCaseKey[getLearnReviewCaseKey(queueItem)];
          const confidence = state?.confidence;
          const current = index === queueIndex;
          const tone = getRecallProgressTone(confidence);
          return (
            <span
              key={queueItem.dailyCaseId || queueItem.sessionId || index}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                current
                  ? "h-1.5 bg-[var(--wardle-color-teal)] shadow-[0_0_14px_rgba(0,180,166,0.28)]"
                  : tone
              }`}
            />
          );
        })}
      </div>
      <span className="ml-1 shrink-0 font-brand-mono text-[10px] text-white/28">
        {queueIndex + 1}/{queueSize}
      </span>
    </div>
  );
}

function getRecallProgressTone(confidence: LearnConfidence | undefined) {
  if (confidence === "again") return "bg-rose-400/60";
  if (confidence === "hard") return "bg-[rgba(244,162,97,0.6)]";
  if (confidence === "good") return "bg-[rgba(0,180,166,0.5)]";
  if (confidence === "easy") return "bg-blue-400/60";
  return "bg-white/[0.08]";
}

function RecallQuestionContent({
  item,
  sortedClues,
  visibleClueCount,
}: {
  item: LearnLibraryCase;
  sortedClues: ClinicalClue[];
  visibleClueCount: number;
}) {
  const visibleClues = sortedClues.slice(0, visibleClueCount);
  const specialty = getCaseSpecialty(item);

  return (
    <section className="wardle-learn-slide-up min-w-0 pb-2">
      <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
        <span className="font-brand-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--wardle-color-teal)]">
          {specialty.label}
        </span>
        <span className="shrink-0 font-brand-mono text-[10px] text-white/28">
          {visibleClueCount} of {sortedClues.length} clues
        </span>
      </div>

      <div className="mb-3.5">
        <h2 className="mt-1.5 text-[20px] font-black leading-tight tracking-[-0.02em] text-white/92">
          What's the diagnosis?
        </h2>
      </div>

      <div className="space-y-[7px]">
        {visibleClues.map((clue, index) => (
          <RecallClueCard
            key={clue.id}
            clue={clue}
            index={index}
            active={index === visibleClues.length - 1}
          />
        ))}
        {sortedClues.slice(visibleClueCount).map((clue, lockedIndex) => {
          const typeCopy = CLUE_TYPE_COPY[clue.type];
          return (
            <div
              key={clue.id}
              className="flex min-w-0 gap-2.5 rounded-[13px] border border-white/[0.14] bg-white/[0.025] px-3 py-2.5 opacity-45"
            >
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] border border-white/[0.1] bg-transparent font-brand-mono text-[9px] font-black text-white/20">
                {typeCopy.abbr}
              </div>
              <p className="min-w-0 self-center text-[12px] italic text-white/30">
                Clue {visibleClueCount + lockedIndex + 1} — locked
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RecallAnswerComposer({
  query,
  selectedOption,
  matchingOptions,
  remainingClues,
  canCommit,
  onChangeQuery,
  onSelectOption,
  onRevealNextClue,
  onCommit,
}: {
  query: string;
  selectedOption: RecallAnswerOption | null;
  matchingOptions: RecallAnswerOption[];
  remainingClues: number;
  canCommit: boolean;
  onChangeQuery: (value: string) => void;
  onSelectOption: (option: RecallAnswerOption) => void;
  onRevealNextClue: () => void;
  onCommit: () => void;
}) {
  const showOptions = query.trim().length > 0 && matchingOptions.length > 0;

  return (
    <div className="shrink-0 border-t border-white/[0.07] bg-[rgba(18,18,28,0.98)] px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 shadow-[0_-18px_40px_rgba(0,0,0,0.25)]">
      {remainingClues > 0 && (
        <button
          type="button"
          onClick={onRevealNextClue}
          className="mb-3 w-full rounded-[12px] border border-white/[0.12] bg-white/[0.06] px-3 py-3 text-[13px] font-bold text-white/58 transition active:scale-[0.98] hover:bg-white/[0.08]"
        >
          Reveal next clue{" "}
          <span className="font-brand-mono text-[10px] text-white/30">
            {remainingClues} left
          </span>
        </button>
      )}


      {showOptions && (
        <div className="mb-2 max-h-[152px] space-y-1.5 overflow-y-auto rounded-[13px] border border-white/[0.07] bg-[#202436] p-1.5">
          {matchingOptions.map((option) => {
            const active = selectedOption?.id === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onSelectOption(option)}
                className={`flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2.5 text-left transition active:scale-[0.99] ${
                  active
                    ? "bg-[rgba(0,180,166,0.13)] text-[var(--wardle-color-mint)]"
                    : "bg-transparent text-white/56 hover:bg-white/[0.045]"
                }`}
              >
                <span className="min-w-0 truncate text-sm font-bold">
                  {option.label}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={query}
          onChange={(event) => onChangeQuery(event.target.value)}
          placeholder="Search diagnosis…"
          className="min-w-0 flex-1 rounded-[12px] border border-white/[0.12] bg-white/[0.08] px-3.5 py-3 text-sm text-[var(--wardle-color-mint)] outline-none placeholder:text-white/24 focus:border-[var(--wardle-color-teal)]"
        />
        <button
          type="button"
          onClick={onCommit}
          disabled={!canCommit}
          className="shrink-0 rounded-[12px] bg-[var(--wardle-color-teal)] px-4 text-[13px] font-black text-white transition disabled:opacity-35 active:scale-[0.98]"
        >
          Submit
        </button>
      </div>

    </div>
  );
}

function RecallClueCard({
  clue,
  index,
  active,
}: {
  clue: ClinicalClue;
  index: number;
  active: boolean;
}) {
  const typeCopy = CLUE_TYPE_COPY[clue.type];

  return (
    <div
      className={`flex min-w-0 gap-2.5 rounded-[13px] border px-3 py-2.5 transition-colors ${
        active
          ? "wardle-learn-slide-up border-[rgba(0,180,166,0.42)] bg-[rgba(0,180,166,0.08)]"
          : "border-white/[0.16] bg-white/[0.035]"
      }`}
    >
      <div
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] border font-brand-mono text-[9px] font-black ${typeCopy.tone}`}
      >
        {typeCopy.abbr}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={`font-brand-mono text-[9px] font-bold uppercase tracking-[0.12em] ${
            active ? "text-[var(--wardle-color-teal)]/60" : "text-white/26"
          }`}
        >
          {typeCopy.label} · Clue {index + 1}
        </p>
        <p
          className={`mt-1 break-words text-[13px] leading-[1.55] ${
            active ? "text-white/82" : "text-white/48"
          }`}
        >
          {clue.value}
        </p>
      </div>
    </div>
  );
}

// ─── RecallAnswerCard ─────────────────────────────────────────────────────────

function RecallAnswerCard({
  item,
  committedAnswer,
  wasCorrect,
  reviewState,
  onRateConfidence,
}: {
  item: LearnLibraryCase;
  committedAnswer: string;
  wasCorrect: boolean;
  reviewState: LearnReviewState;
  onRateConfidence: (confidence: LearnConfidence) => void;
}) {
  const explanation = coerceStructuredExplanation(item.case.explanation ?? {});
  const differentials = useMemo(
    () => getExplanationDifferentials(item.case.explanation),
    [item.case.explanation],
  );
  const sortedClues = useMemo(
    () => sortClues(item.case.clues),
    [item.case.clues],
  );
  const reasoningSteps = useMemo(
    () => splitReasoning(explanation?.reasoning ?? ""),
    [explanation?.reasoning],
  );

  const [showClues, setShowClues] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);
  const [showDifferentials, setShowDifferentials] = useState(false);
  return (
    <section className="wardle-learn-slide-up flex min-w-0 flex-col gap-4 pb-2">
      <div
        className={`rounded-[14px] border px-4 py-3 ${wasCorrect ? "border-[rgba(0,180,166,0.24)] bg-[rgba(0,180,166,0.08)]" : "border-rose-400/[0.24] bg-rose-400/[0.08]"}`}
      >
        <p
          className={`mb-1 text-[11px] font-black uppercase tracking-[0.12em] ${wasCorrect ? "text-[var(--wardle-color-teal)]" : "text-rose-300"}`}
        >
          {wasCorrect ? "✓ Correct" : "✗ Incorrect"}
        </p>
        <p className="text-sm text-white/58">
          Your answer:{" "}
          <span className="font-bold text-[var(--wardle-color-mint)]">
            {committedAnswer}
          </span>
        </p>
      </div>

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

      {explanation?.keyFindings.length ? (
        <ReviewSection title="Key Findings" tone="teal">
          <div className="space-y-1.5">
            {explanation.keyFindings.map((finding) => (
              <div
                key={finding}
                className="flex min-w-0 gap-2.5 rounded-[10px] border border-white/[0.05] bg-white/[0.03] px-3 py-2.5"
              >
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--wardle-color-teal)]/60" />
                <span className="min-w-0 break-words text-sm leading-6 text-white/64">
                  {finding}
                </span>
              </div>
            ))}
          </div>
        </ReviewSection>
      ) : null}

      <RecallDisclosure
        label={`Clue trail · ${sortedClues.length} clues`}
        open={showClues}
        onToggle={() => setShowClues((value) => !value)}
      >
        <div className="flex flex-wrap gap-1.5">
          {sortedClues.map((clue, index) => {
            const typeCopy = CLUE_TYPE_COPY[clue.type];
            const wasUsed = index < item.playerResult.attemptsUsed;
            return (
              <span
                key={clue.id}
                className={`inline-flex max-w-full items-center gap-1.5 rounded-[8px] border px-2 py-1 text-[11px] ${
                  wasUsed
                    ? "border-white/[0.09] bg-white/[0.045] text-white/60"
                    : "border-white/[0.04] bg-white/[0.02] text-white/20"
                }`}
              >
                <span
                  className={`font-brand-mono text-[9px] font-black ${
                    wasUsed ? CLUE_TYPE_TEXT_TONES[clue.type] : "text-white/22"
                  }`}
                >
                  {typeCopy.abbr}
                </span>
                <span className="truncate">{clue.value}</span>
              </span>
            );
          })}
        </div>
      </RecallDisclosure>

      {reasoningSteps.length ? (
        <RecallDisclosure
          label={`Reasoning chain · ${reasoningSteps.length} steps`}
          open={showReasoning}
          onToggle={() => setShowReasoning((value) => !value)}
        >
          <div className="overflow-hidden rounded-[12px] border border-white/[0.05] bg-white/[0.025]">
            {reasoningSteps.map((step, index) => (
              <div
                key={`${index}-${step}`}
                className={`flex min-w-0 gap-3 px-3 py-3 ${
                  index < reasoningSteps.length - 1
                    ? "border-b border-white/[0.05]"
                    : ""
                }`}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] bg-[rgba(0,180,166,0.13)] font-brand-mono text-[9px] font-black text-[var(--wardle-color-teal)]">
                  {index + 1}
                </span>
                <p className="min-w-0 break-words text-xs leading-5 text-white/56">
                  {step}
                </p>
              </div>
            ))}
          </div>
        </RecallDisclosure>
      ) : null}

      {differentials.length ? (
        <RecallDisclosure
          label={`Why not · ${differentials.length} ruled out`}
          open={showDifferentials}
          onToggle={() => setShowDifferentials((value) => !value)}
        >
          <div className="space-y-1.5">
            {differentials.map((differential, index) => {
              const title = getDifferentialTitle(differential);
              const reason = getDifferentialReason(differential);
              return (
                <div
                  key={`${title}-${index}`}
                  className="rounded-[12px] border border-white/[0.05] bg-white/[0.025] px-3 py-2.5"
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <p className="min-w-0 break-words text-sm font-bold text-[var(--wardle-color-mint)]">
                      {title}
                    </p>
                    <span className="shrink-0 rounded-full border border-rose-400/[0.2] bg-rose-400/[0.08] px-2 py-0.5 font-brand-mono text-[9px] font-bold uppercase tracking-[0.1em] text-rose-300">
                      Ruled out
                    </span>
                  </div>
                  {reason && (
                    <p className="mt-1.5 break-words text-xs leading-5 text-white/40">
                      {reason}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </RecallDisclosure>
      ) : null}

      <RecallConfidenceRater
        reviewState={reviewState}
        onRate={onRateConfidence}
      />
    </section>
  );
}

function RecallDisclosure({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between rounded-[11px] border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-left"
      >
        <span className="text-xs font-bold text-white/44">{label}</span>
        <span
          className={`text-xs text-white/28 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
        >
          ›
        </span>
      </button>
      {open && <div className="wardle-learn-fade mt-1.5">{children}</div>}
    </div>
  );
}

// ─── RecallConfidenceRater (REFACTORED) ──────────────────────────────────────

function RecallConfidenceRater({
  reviewState,
  onRate,
}: {
  reviewState: LearnReviewState;
  onRate: (confidence: LearnConfidence) => void;
}) {
  return (
    <div className="rounded-[16px] border border-white/[0.07] bg-white/[0.025] px-4 py-4">
      <p className="font-brand-mono text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">
        How well did you know this?
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {(Object.keys(CONFIDENCE_COPY) as LearnConfidence[]).map(
          (confidence) => (
            <RecallConfidenceButton
              key={confidence}
              confidence={confidence}
              active={reviewState.confidence === confidence}
              onClick={() => onRate(confidence)}
            />
          ),
        )}
      </div>
      {reviewState.nextReviewAt && (
        <p className="wardle-learn-fade mt-3 rounded-[9px] bg-white/[0.03] px-3 py-2 font-brand-mono text-[10px] text-white/36">
          Next review:{" "}
          <span className="text-[var(--wardle-color-mint)]">
            {reviewState.nextReviewAt.slice(0, 10)}
          </span>
        </p>
      )}
    </div>
  );
}

// ─── RecallConfidenceButton (REFACTORED) ─────────────────────────────────────

function RecallConfidenceButton({
  confidence,
  active,
  onClick,
}: {
  confidence: LearnConfidence;
  active: boolean;
  onClick: () => void;
}) {
  const copy = CONFIDENCE_COPY[confidence];

  const idleClass = "border-white/[0.07] bg-white/[0.03] text-white/40";
  const activeClass =
    copy.tone === "rose"
      ? "border-rose-400/[0.28] bg-rose-400/[0.10] text-rose-300"
      : copy.tone === "amber"
        ? "border-[rgba(244,162,97,0.28)] bg-[rgba(244,162,97,0.10)] text-[var(--wardle-color-amber)]"
        : copy.tone === "blue"
          ? "border-blue-400/[0.28] bg-blue-400/[0.10] text-blue-300"
          : "border-[rgba(0,180,166,0.28)] bg-[rgba(0,180,166,0.10)] text-[var(--wardle-color-teal)]";

  const iconActiveClass =
    copy.tone === "rose"
      ? "bg-rose-400/[0.15] text-rose-300"
      : copy.tone === "amber"
        ? "bg-[rgba(244,162,97,0.15)] text-[var(--wardle-color-amber)]"
        : copy.tone === "blue"
          ? "bg-blue-400/[0.15] text-blue-300"
          : "bg-[rgba(0,180,166,0.15)] text-[var(--wardle-color-teal)]";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-2 rounded-[13px] border px-2 py-3 text-center transition active:scale-[0.98] ${
        active ? activeClass : idleClass
      }`}
    >
      {/* Icon */}
      <span
        className={`flex h-7 w-7 items-center justify-center rounded-full font-brand-mono text-sm font-black transition ${
          active ? iconActiveClass : "bg-white/[0.05] text-white/24"
        }`}
      >
        {copy.marker}
      </span>
      {/* Label */}
      <span className="block text-[13px] font-black leading-none">
        {copy.label}
      </span>
      {/* Sublabel */}
      <span
        className={`block font-brand-mono text-[9px] leading-none transition ${active ? "opacity-70" : "opacity-30"}`}
      >
        {copy.sublabel}
      </span>
    </button>
  );
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
        Review completed cases, saved explanations, clue trails, and specialty
        performance.
      </p>
      <div className="mt-5 grid max-w-lg grid-cols-3 gap-2.5">
        <StatCard
          label="Accuracy"
          value={formatPercent(summary.accuracyPct)}
          tone="teal"
        />
        <StatCard
          label="Cases done"
          value={String(summary.casesDone)}
          tone="neutral"
        />
        <StatCard
          label="Avg clues"
          value={formatAverageClues(summary.averageCluesUsed)}
          tone="amber"
        />
      </div>
    </section>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "teal" | "amber" | "neutral";
}) {
  const valueClass =
    tone === "teal"
      ? "text-[var(--wardle-color-teal)]"
      : tone === "amber"
        ? "text-[var(--wardle-color-amber)]"
        : "text-white/70";
  const borderClass =
    tone === "teal"
      ? "border-[rgba(0,180,166,0.2)]"
      : tone === "amber"
        ? "border-[rgba(244,162,97,0.2)]"
        : "border-white/[0.07]";

  return (
    <div
      className={`min-w-0 rounded-[12px] border bg-white/[0.03] px-3 py-3 ${borderClass}`}
    >
      <p
        className={`font-brand-mono text-xl font-black leading-none ${valueClass}`}
      >
        {value}
      </p>
      <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">
        {label}
      </p>
    </div>
  );
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
  visibleCount: number;
  completedCount: number;
  filterOptions: LearnFilterOptions;
  filters: LearnFilters;
  showAdvancedFilters: boolean;
  onChangeFilters: (filters: LearnFilters) => void;
  onToggleAdvancedFilters: () => void;
}) {
  const activeCount = getTotalActiveFilterCount(filters);

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-baseline gap-2.5">
          <h2 className="shrink-0 text-[15px] font-bold tracking-tight text-[var(--wardle-color-mint)]">
            Case Archive
          </h2>
          {completedCount > 0 && (
            <span className="font-brand-mono text-[11px] tabular-nums text-white/24">
              {visibleCount !== completedCount
                ? `${visibleCount} / ${completedCount}`
                : completedCount}
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
                ? "bg-[rgba(0,180,166,0.12)] text-[var(--wardle-color-teal)]"
                : "text-white/32 hover:text-white/56"
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
        <SecondaryFilters
          filterOptions={filterOptions}
          filters={filters}
          onChangeFilters={onChangeFilters}
        />
      )}
    </div>
  );
}

function SpecialtyRail({
  filterOptions,
  activeSpecialty,
  completedCount,
  onSelect,
}: {
  filterOptions: LearnFilterOptions;
  activeSpecialty: string;
  completedCount: number;
  onSelect: (key: string) => void;
}) {
  return (
    <div className="relative min-w-0">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-[var(--wardle-color-charcoal)] to-transparent"
      />
      <div className="min-w-0 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex w-max gap-px pr-10">
          <SpecialtyPill
            label="All"
            count={completedCount}
            active={activeSpecialty === "all"}
            onClick={() => onSelect("all")}
          />
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
  );
}

function SpecialtyPill({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-bold transition-all duration-150 ${
        active
          ? "bg-white/[0.06] text-[var(--wardle-color-mint)]"
          : "text-white/32 hover:text-white/56"
      }`}
    >
      {active && (
        <span
          aria-hidden="true"
          className="absolute inset-x-3.5 -bottom-0 h-[2px] rounded-full bg-[var(--wardle-color-teal)]"
        />
      )}
      <span>{label}</span>
      <span
        className={`font-brand-mono text-[10px] tabular-nums ${active ? "text-[var(--wardle-color-teal)]" : "text-white/20"}`}
      >
        {count}
      </span>
    </button>
  );
}

function SecondaryFilters({
  filterOptions,
  filters,
  onChangeFilters,
}: {
  filterOptions: LearnFilterOptions;
  filters: LearnFilters;
  onChangeFilters: (f: LearnFilters) => void;
}) {
  const set = <K extends keyof LearnFilters>(k: K, v: LearnFilters[K]) =>
    onChangeFilters({ ...filters, [k]: v });

  const showTrack = filterOptions.tracks.length > 1;
  const showDifficulty = filterOptions.difficulties.length > 1;

  return (
    <div className="overflow-hidden rounded-[14px] border border-white/[0.06] bg-white/[0.02]">
      <FilterRow label="Result" isFirst>
        {(["all", "solved", "missed"] as const).map((value) => (
          <FilterToggle
            key={value}
            label={
              value === "all" ? "All" : value === "solved" ? "Solved" : "Missed"
            }
            active={filters.result === value}
            onClick={() => set("result", value)}
          />
        ))}
      </FilterRow>

      {showTrack && (
        <FilterRow label="Track">
          <FilterToggle
            label="All"
            active={filters.track === "all"}
            onClick={() => set("track", "all")}
          />
          {filterOptions.tracks.map((track) => (
            <FilterToggle
              key={track}
              label={TRACK_LABEL[track] ?? track}
              active={filters.track === track}
              onClick={() => set("track", track)}
            />
          ))}
        </FilterRow>
      )}

      {showDifficulty && (
        <FilterRow label="Difficulty">
          <FilterToggle
            label="All"
            active={filters.difficulty === "all"}
            onClick={() => set("difficulty", "all")}
          />
          {filterOptions.difficulties.map((d) => (
            <FilterToggle
              key={d.key}
              label={d.label}
              active={filters.difficulty === d.key}
              onClick={() => set("difficulty", d.key)}
              difficultyKey={d.key}
            />
          ))}
        </FilterRow>
      )}
    </div>
  );
}

function FilterRow({
  label,
  isFirst = false,
  children,
}: {
  label: string;
  isFirst?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`flex min-w-0 items-center gap-3 px-4 py-2.5 ${isFirst ? "" : "border-t border-white/[0.05]"}`}
    >
      <span className="w-[62px] shrink-0 font-brand-mono text-[10px] font-bold uppercase tracking-[0.14em] text-white/22">
        {label}
      </span>
      <div className="flex min-w-0 flex-wrap gap-1">{children}</div>
    </div>
  );
}

function FilterToggle({
  label,
  active,
  onClick,
  difficultyKey,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  difficultyKey?: string;
}) {
  const diffStyle =
    active && difficultyKey ? DIFFICULTY_ACTIVE_STYLES[difficultyKey] : null;

  return (
    <button
      type="button"
      onClick={onClick}
      style={
        diffStyle
          ? { background: diffStyle.bg, color: diffStyle.text }
          : active
            ? {
                background: "rgba(0,180,166,0.14)",
                color: "var(--wardle-color-teal)",
              }
            : undefined
      }
      className={`rounded-full px-3 py-1 font-brand-mono text-[11px] font-bold transition-all duration-150 ${
        active ? "" : "text-white/30 hover:text-white/54"
      }`}
    >
      {label}
    </button>
  );
}

// ─── Desktop case list ────────────────────────────────────────────────────────

function CaseLibraryList({
  className,
  cases,
  selectedCaseId,
  onSelectCase,
}: {
  className?: string;
  cases: LearnLibraryCase[];
  selectedCaseId: string | null;
  onSelectCase: (dailyCaseId: string) => void;
}) {
  return (
    <section
      className={`min-w-0 max-w-full overflow-hidden ${className ?? ""}`}
    >
      <div className="min-w-0 space-y-6">
        {groupLearnCasesBySpecialty(cases).map((group) => (
          <div key={group.specialty.key} className="space-y-2">
            <div className="flex items-baseline gap-2 px-0.5">
              <h3 className="text-sm font-bold text-white/70">
                {group.specialty.label}
              </h3>
              <span className="font-brand-mono text-[11px] text-white/30">
                {group.cases.length}
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {group.cases.map((item) => (
                <CaseLibraryCard
                  key={item.dailyCaseId}
                  item={item}
                  selected={selectedCaseId === item.dailyCaseId}
                  onSelect={() => onSelectCase(item.dailyCaseId)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CaseLibraryCard({
  item,
  selected,
  onSelect,
}: {
  item: LearnLibraryCase;
  selected: boolean;
  onSelect: () => void;
}) {
  const diagnosis = item.case.diagnosis || item.case.title;
  const specialty = getCaseSpecialty(item);
  const solved = item.playerResult.solved;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative flex w-full min-w-0 items-center gap-3 rounded-[11px] px-4 py-3 text-left transition-all duration-150 ${
        selected ? "bg-[rgba(0,180,166,0.08)]" : "hover:bg-white/[0.03]"
      }`}
    >
      {selected && (
        <span
          aria-hidden="true"
          className="absolute left-0 h-5 w-[2px] rounded-r-full bg-[var(--wardle-color-teal)]"
        />
      )}
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${solved ? "bg-[var(--wardle-color-teal)]/60" : "bg-rose-400/60"}`}
      />
      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-[13px] font-bold transition-colors ${
            selected ? "text-[var(--wardle-color-mint)]" : "text-white/64"
          }`}
        >
          {diagnosis}
        </p>
        <p className="mt-0.5 font-brand-mono text-[11px] text-white/28">
          {specialty.label}
        </p>
      </div>
      <span
        className={`shrink-0 text-xs transition-colors ${selected ? "text-[var(--wardle-color-teal)]/50" : "text-white/14"}`}
      >
        ›
      </span>
    </button>
  );
}

// ─── Desktop case detail ──────────────────────────────────────────────────────

function CaseDetail({
  className,
  item,
  activeTab,
  onChangeTab,
  onBack,
}: {
  className?: string;
  item: LearnLibraryCase | null;
  activeTab: DetailTab;
  onChangeTab: (tab: DetailTab) => void;
  onBack: () => void;
}) {
  if (!item) return null;

  const explanation = coerceStructuredExplanation(item.case.explanation ?? {});

  return (
    <SurfaceCard
      className={`min-w-0 max-w-full overflow-hidden ${className ?? ""}`}
    >
      <div className="min-w-0 space-y-4">
        <div className="flex min-w-0 items-center justify-between gap-3 lg:hidden">
          <button
            type="button"
            onClick={onBack}
            className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-bold text-[var(--wardle-color-teal)]"
          >
            ‹ All cases
          </button>
          <span className="font-brand-mono text-[10px] text-white/24">
            {item.completedAt.slice(0, 10)}
          </span>
        </div>

        <div className="overflow-hidden rounded-[16px] border border-white/[0.07] bg-white/[0.03]">
          <div className="px-4 py-4">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <TrackBadge track={item.track} />
                <DifficultyBadge difficulty={item.case.difficulty} />
              </div>
              <span className="font-brand-mono text-[10px] text-white/28">
                {formatArchiveCaseLabel(item)}
              </span>
            </div>
            <h2 className="mt-3 break-words text-xl font-black leading-snug tracking-tight text-[var(--wardle-color-mint)]">
              {item.case.diagnosis || item.case.title}
            </h2>
            <p className="mt-1 font-brand-mono text-[11px] text-white/30">
              {item.case.clues.length} clues ·{" "}
              {item.case.date || item.completedAt.slice(0, 10)}
            </p>
          </div>
        </div>

        <TabSwitcher activeTab={activeTab} onChangeTab={onChangeTab} />

        {activeTab === "breakdown" && (
          <BreakdownTab explanation={explanation} />
        )}
        {activeTab === "differentials" && (
          <DifferentialsTab differentials={explanation?.differentials ?? []} />
        )}
        {activeTab === "clues" && <CluesTab clues={item.case.clues} />}
      </div>
    </SurfaceCard>
  );
}

function BreakdownTab({ explanation }: { explanation: ReturnType<typeof coerceStructuredExplanation> }) {
  if (!explanation) {
    return (
      <InlineNotice tone="muted" copy="Explanation is still being prepared." />
    );
  }

  const reasoningSteps = splitReasoning(explanation.reasoning ?? "");

  return (
    <div className="min-w-0 space-y-4">
      {explanation.summary && (
        <div className="rounded-[14px] border border-[rgba(0,180,166,0.15)] bg-[rgba(0,180,166,0.06)] px-4 py-3">
          <p className="mb-2 font-brand-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--wardle-color-teal)]/60">
            Summary
          </p>
          <p className="break-words text-sm leading-6 text-white/64">
            {explanation.summary}
          </p>
        </div>
      )}

      {explanation.keyFindings.length ? (
        <ReviewSection title="Key Findings" tone="teal">
          <ul className="space-y-1.5">
            {explanation.keyFindings.map((finding) => (
              <li
                key={finding}
                className="flex min-w-0 gap-2.5 rounded-[11px] border border-white/[0.05] bg-white/[0.03] px-3 py-2.5"
              >
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--wardle-color-teal)]/50" />
                <span className="min-w-0 break-words text-sm leading-6 text-white/62">
                  {finding}
                </span>
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
                className={`flex min-w-0 gap-3 px-3 py-3 ${index < reasoningSteps.length - 1 ? "border-b border-white/[0.04]" : ""}`}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] bg-[rgba(0,180,166,0.12)] font-brand-mono text-[10px] font-black text-[var(--wardle-color-teal)]">
                  {index + 1}
                </span>
                <p className="min-w-0 break-words text-sm leading-6 text-white/62">
                  {step}
                </p>
              </div>
            ))}
          </div>
        </ReviewSection>
      ) : null}
    </div>
  );
}

function DifferentialsTab({ differentials }: { differentials: string[] }) {
  if (!differentials.length) {
    return (
      <InlineNotice
        tone="muted"
        copy="No differentials were stored for this case."
      />
    );
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
  );
}

function CluesTab({ clues }: { clues: ClinicalClue[] }) {
  const sorted = [...clues].sort((a, b) => a.order - b.order);

  return (
    <div className="min-w-0 space-y-1.5">
      {sorted.map((clue, index) => {
        const typeCopy = CLUE_TYPE_COPY[clue.type];
        return (
          <div
            key={clue.id}
            className="flex min-w-0 gap-3 rounded-[13px] border border-white/[0.05] bg-white/[0.025] px-4 py-3"
          >
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border text-[10px] font-black ${typeCopy.tone}`}
            >
              {typeCopy.abbr}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-brand-mono text-[10px] font-bold uppercase tracking-[0.14em] text-white/30">
                Clue {index + 1} · {typeCopy.label}
              </p>
              <p className="mt-1 break-words text-sm leading-6 text-white/64">
                {clue.value}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TabSwitcher({
  activeTab,
  onChangeTab,
}: {
  activeTab: DetailTab;
  onChangeTab: (tab: DetailTab) => void;
}) {
  const tabs: Array<{ id: DetailTab; label: string }> = [
    { id: "breakdown", label: "Breakdown" },
    { id: "differentials", label: "Differentials" },
    { id: "clues", label: "Clues" },
  ];

  return (
    <div className="grid grid-cols-3 gap-1 rounded-[20px] bg-white/[0.04] p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChangeTab(tab.id)}
          className={`rounded-[16px] px-2 py-2 text-xs font-bold transition-all duration-200 ${
            activeTab === tab.id
              ? "bg-[var(--wardle-color-teal)] text-white"
              : "text-white/38 hover:text-white/62"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ─── Shared components ────────────────────────────────────────────────────────

function ReviewSection({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "teal" | "amber";
  children: ReactNode;
}) {
  return (
    <section className="min-w-0">
      <p
        className={`mb-2 font-brand-mono text-[10px] font-bold uppercase tracking-[0.18em] ${
          tone === "teal"
            ? "text-[var(--wardle-color-teal)]/70"
            : "text-[var(--wardle-color-amber)]/75"
        }`}
      >
        {title}
      </p>
      {children}
    </section>
  );
}

function TrackBadge({ track }: { track: PublishTrack }) {
  const copy = TRACK_COPY[track] ?? TRACK_COPY.DAILY;
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-[3px] font-brand-mono text-[10px] font-bold uppercase tracking-[0.14em] ${copy.tone}`}
    >
      {copy.label}
    </span>
  );
}

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const normalized = difficulty.trim().toLowerCase();
  const tone =
    DIFFICULTY_TONES[normalized] ??
    "border border-white/[0.08] bg-white/[0.05] text-white/44";
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-[3px] font-brand-mono text-[10px] font-bold uppercase tracking-[0.14em] ${tone}`}
    >
      {normalized || "standard"}
    </span>
  );
}

function InlineNotice({
  tone,
  copy,
}: {
  tone: "muted" | "error";
  copy: string;
}) {
  return (
    <div
      className={`rounded-[13px] border px-4 py-3 text-sm leading-6 ${
        tone === "error"
          ? "border-rose-300/[0.16] bg-rose-400/[0.07] text-rose-300"
          : "border-white/[0.06] bg-white/[0.025] text-white/40"
      }`}
    >
      {copy}
    </div>
  );
}

function AttemptSummary({ item }: { item: LearnLibraryCase }) {
  const pips = buildAttemptPips(item.playerResult);

  return (
    <div className="mt-4 rounded-[12px] border border-white/[0.06] bg-white/[0.025] px-3 py-3">
      <p className="font-brand-mono text-[10px] font-bold uppercase tracking-[0.14em] text-white/28">
        Your Attempt
      </p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <ResultPips pips={pips} />
        <div className="shrink-0 text-right font-brand-mono text-[10px] uppercase tracking-[0.12em] text-white/36">
          <p>{item.playerResult.attemptsUsed} clues</p>
          {item.playerResult.timeSecs !== null && (
            <p>{formatStudyTime(item.playerResult.timeSecs)}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultPips({
  pips,
}: {
  pips: Array<"correct" | "used" | "missed" | "empty">;
}) {
  return (
    <div className="flex min-w-0 flex-1 gap-1">
      {pips.map((pip, index) => (
        <span
          key={`${pip}-${index}`}
          className={`h-1.5 min-w-0 flex-1 rounded-full ${
            pip === "correct"
              ? "bg-[var(--wardle-color-teal)]"
              : pip === "used"
                ? "bg-[rgba(0,180,166,0.3)]"
                : pip === "missed"
                  ? "bg-rose-400/60"
                  : "bg-white/[0.07]"
          }`}
        />
      ))}
    </div>
  );
}

function ArchiveEmptyState({
  completedCount,
  loading,
  mobile = false,
}: {
  completedCount: number;
  loading: boolean;
  mobile?: boolean;
}) {
  if (loading) return null;

  const title =
    completedCount > 0 ? "No matching cases" : "No explanations yet";
  const copy =
    completedCount > 0
      ? "Adjust your filters to bring cases back into view."
      : "Complete a case to add its explanation, clues, and differentials to this library.";

  if (mobile) {
    return (
      <div className="rounded-[14px] border border-white/[0.07] bg-white/[0.025] px-4 py-5">
        <p className="text-sm font-bold text-[var(--wardle-color-mint)]">
          {title}
        </p>
        <p className="mt-2 text-sm leading-6 text-white/40">{copy}</p>
      </div>
    );
  }

  return (
    <SurfaceCard
      eyebrow={completedCount > 0 ? "Filtered Cases" : "Completed Cases"}
      title={title}
      className="min-w-0 max-w-full overflow-hidden"
    >
      <p className="max-w-2xl text-sm leading-6 text-white/54">{copy}</p>
    </SurfaceCard>
  );
}

function getMobileSpecialtyIcon(key: string) {
  return (
    MOBILE_SPECIALTY_ICONS[key] ?? {
      icon: "🩺",
      tone: "bg-white/[0.08] text-white/70",
    }
  );
}

// ─── Pure utility functions ───────────────────────────────────────────────────

type LearnCaseSpecialtyGroup = {
  specialty: { key: string; label: string };
  cases: LearnLibraryCase[];
};

function groupLearnCasesBySpecialty(
  cases: LearnLibraryCase[],
): LearnCaseSpecialtyGroup[] {
  const groups = new Map<string, LearnCaseSpecialtyGroup>();

  cases.forEach((item) => {
    const specialty = getCaseSpecialty(item);
    if (!groups.has(specialty.key)) {
      groups.set(specialty.key, {
        specialty,
        cases: [],
      });
    }
    groups.get(specialty.key)!.cases.push(item);
  });

  return Array.from(groups.values()).sort((a, b) =>
    a.specialty.label.localeCompare(b.specialty.label),
  );
}

function formatArchiveCaseLabel(item: LearnLibraryCase): string {
  // Take first 6–8 chars for readability
  return (
    item.displayLabel ??
    item.case?.displayLabel ??
    (item.casePublicNumber ? `Case ${item.casePublicNumber}` : null) ??
    (item.case?.publicNumber ? `Case ${item.case.publicNumber}` : null) ??
    `Daily Case ${item.case?.date || item.completedAt.slice(0, 10)} #${item.sequenceIndex}`
  );
}

type RecallAnswerOption = {
  id: string;
  label: string;
  aliases: string[];
};

function buildRecallAnswerOptions(
  cases: LearnLibraryCase[],
  currentItem: LearnLibraryCase,
): RecallAnswerOption[] {
  const options = new Map<string, RecallAnswerOption>();
  const add = (item: LearnLibraryCase) => {
    const label = item.case.diagnosis || item.case.title;
    const id = getRecallDiagnosisOptionId(item);
    if (!label.trim() || options.has(id)) return;
    options.set(id, { id, label, aliases: buildRecallAliases(label) });
  };
  add(currentItem);
  cases.forEach(add);
  return Array.from(options.values()).sort((a, b) => {
    if (a.id === getRecallDiagnosisOptionId(currentItem)) return -1;
    if (b.id === getRecallDiagnosisOptionId(currentItem)) return 1;
    return a.label.localeCompare(b.label);
  });
}

function filterRecallAnswerOptions(
  options: RecallAnswerOption[],
  query: string,
) {
  const normalized = normalizeRegistrySearchTerm(query);
  if (!normalized) return options.slice(0, 5);
  return options.filter((option) =>
    option.aliases.some(
      (alias) => alias.includes(normalized) || normalized.includes(alias),
    ),
  );
}

function buildRecallAliases(label: string) {
  const normalized = normalizeRegistrySearchTerm(label);
  const pieces = normalized.split(" ").filter((part) => part.length >= 3);
  return Array.from(new Set([normalized, ...pieces]));
}

function getRecallDiagnosisOptionId(item: LearnLibraryCase) {
  return normalizeRegistrySearchTerm(item.case.diagnosis || item.case.title);
}

function isRecallTextMatch(answer: string, item: LearnLibraryCase) {
  const normalizedAnswer = normalizeRegistrySearchTerm(answer);
  const normalizedDiagnosis = getRecallDiagnosisOptionId(item);
  if (!normalizedAnswer || !normalizedDiagnosis) return false;
  return (
    normalizedDiagnosis.includes(normalizedAnswer) ||
    normalizedAnswer.includes(normalizedDiagnosis.split(" ")[0])
  );
}

function normalizeRegistrySearchTerm(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getExplanationDifferentials(explanation: unknown) {
  const record = asRecord(explanation);
  const differentials = record?.differentials;
  return Array.isArray(differentials) ? differentials : [];
}

function getDifferentialTitle(value: unknown): string {
  const directValue = getStringValue(value);
  if (directValue) return directValue;
  const record = asRecord(value);
  if (!record) return "Differential";
  return (
    getStringValue(record.dx) ??
    getStringValue(record.diagnosis) ??
    getStringValue(record.title) ??
    getStringValue(record.label) ??
    "Differential"
  );
}

function getDifferentialReason(value: unknown) {
  const record = asRecord(value);
  if (!record) return null;
  return (
    getStringValue(record.why) ??
    getStringValue(record.reason) ??
    getStringValue(record.rationale) ??
    null
  );
}

function splitReasoning(reasoning: string) {
  return reasoning
    .split(/\n{2,}|\n/)
    .map((step) => step.trim())
    .filter((step) => step.length > 0);
}

function sortClues(clues: ClinicalClue[]) {
  return [...clues].sort((a, b) => a.order - b.order);
}

function buildAttemptPips(result: LearnLibraryCase["playerResult"]) {
  return Array.from(
    { length: 6 },
    (_, index): "correct" | "used" | "missed" | "empty" => {
      if (index >= result.attemptsUsed) return "empty";
      if (result.solved && index === result.attemptsUsed - 1) return "correct";
      return result.solved ? "used" : "missed";
    },
  );
}

function getMissedCases(cases: LearnLibraryCase[]) {
  return cases.filter((item) => !item.playerResult.solved);
}

function getDueReviewCases(
  cases: LearnLibraryCase[],
  reviewStateByCaseKey: LearnReviewStateByCaseKey,
) {
  const now = Date.now();
  return cases.filter((item) => {
    const reviewState = reviewStateByCaseKey[getLearnReviewCaseKey(item)];

    // First-time users have no local review state yet. Treat every completed case
    // as due once so the recall card is useful instead of showing 0 forever.
    if (!reviewState?.lastReviewedAt && !reviewState?.confidence) return true;

    if (!reviewState?.nextReviewAt) return false;
    const nextReviewAt = Date.parse(reviewState.nextReviewAt);
    return Number.isFinite(nextReviewAt) && nextReviewAt <= now;
  });
}

function buildAdaptiveRecallQueue(
  cases: LearnLibraryCase[],
  reviewStateByCaseKey: LearnReviewStateByCaseKey,
) {
  return [...cases].sort((a, b) => {
    const diff =
      getAdaptiveRecallPriority(b, reviewStateByCaseKey) -
      getAdaptiveRecallPriority(a, reviewStateByCaseKey);
    return diff !== 0 ? diff : getCaseDateValue(a) - getCaseDateValue(b);
  });
}

function getAdaptiveRecallPriority(
  item: LearnLibraryCase,
  reviewStateByCaseKey: LearnReviewStateByCaseKey,
) {
  const reviewState = reviewStateByCaseKey[getLearnReviewCaseKey(item)];
  const due = isReviewDue(reviewState);
  const recallFailures = Math.max(
    0,
    (reviewState?.recallAttempts ?? 0) - (reviewState?.recallCorrect ?? 0),
  );

  let score = 0;
  if (!item.playerResult.solved) score += 700;
  if (due) score += 600;
  score += recallFailures * 90;
  if (reviewState?.confidence === "again") score += 520;
  if (reviewState?.confidence === "hard") score += 260;
  score += Math.min(6, item.playerResult.attemptsUsed) * 28;
  if (!reviewState?.lastReviewedAt) score += 120;
  if (reviewState?.confidence === "good") score -= 80;
  if (reviewState?.confidence === "easy") score -= 180;

  return score;
}

function isReviewDue(reviewState: LearnReviewState | undefined) {
  if (!reviewState?.nextReviewAt) return false;
  const nextReviewAt = Date.parse(reviewState.nextReviewAt);
  return Number.isFinite(nextReviewAt) && nextReviewAt <= Date.now();
}

function createEmptyLearnReviewState(): LearnReviewState {
  return { recallAttempts: 0, recallCorrect: 0 };
}

function readLearnReviewState(): LearnReviewStateByCaseKey {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(LEARN_REVIEW_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return {};
    return Object.entries(
      parsed as Record<string, unknown>,
    ).reduce<LearnReviewStateByCaseKey>((acc, [key, value]) => {
      const state = asRecord(value);
      if (!state) return acc;
      acc[key] = {
        confidence: normalizeLearnConfidence(state.confidence),
        recallAttempts: getFiniteNumber(state.recallAttempts) ?? 0,
        recallCorrect: getFiniteNumber(state.recallCorrect) ?? 0,
        lastReviewedAt: getStringValue(state.lastReviewedAt) ?? undefined,
        nextReviewAt: getStringValue(state.nextReviewAt) ?? undefined,
        lastAnswer: getStringValue(state.lastAnswer) ?? undefined,
        lastSelectedDiagnosisId:
          getStringValue(state.lastSelectedDiagnosisId) ?? undefined,
        lastWasCorrect:
          typeof state.lastWasCorrect === "boolean"
            ? state.lastWasCorrect
            : undefined,
      };
      return acc;
    }, {});
  } catch {
    return {};
  }
}

function writeLearnReviewState(
  reviewStateByCaseKey: LearnReviewStateByCaseKey,
) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      LEARN_REVIEW_STORAGE_KEY,
      JSON.stringify(reviewStateByCaseKey),
    );
  } catch {
    // best effort
  }
}

function isLearnConfidence(value: unknown): value is LearnConfidence {
  return (
    value === "again" ||
    value === "hard" ||
    value === "good" ||
    value === "easy"
  );
}

function normalizeLearnConfidence(value: unknown): LearnConfidence | undefined {
  if (isLearnConfidence(value)) return value;
  if (value === "partial") return "good";
  if (value === "solid") return "easy";
  return undefined;
}

function getLearnReviewCaseKey(item: LearnLibraryCase) {
  return item.sessionId || item.dailyCaseId;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getCaseDateValue(item: LearnLibraryCase) {
  const value = Date.parse(item.completedAt || item.case.date || "");
  return Number.isFinite(value) ? value : 0;
}

function formatStudyTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function getLearnPerformanceSummary(
  learnLibrary: LearnLibraryResponse | null,
  fallbackCases: LearnLibraryCase[],
): LearnPerformanceSummary {
  return (
    readBackendPerformanceSummary(learnLibrary) ??
    deriveLearnPerformanceSummary(fallbackCases)
  );
}

function readBackendPerformanceSummary(
  learnLibrary: LearnLibraryResponse | null,
): LearnPerformanceSummary | null {
  if (!learnLibrary || typeof learnLibrary !== "object") return null;
  const source = learnLibrary as LearnLibraryResponse & {
    performanceSummary?: unknown;
    performance?: unknown;
    metrics?: unknown;
  };
  const candidate =
    asRecord(source.performanceSummary) ??
    asRecord(source.performance) ??
    asRecord(source.metrics);
  if (!candidate) return null;
  const casesDone = getFiniteNumber(candidate.casesDone);
  if (casesDone === null) return null;
  const specialties = Array.isArray(candidate.specialties)
    ? candidate.specialties
        .map((item) => asRecord(item))
        .filter((item): item is Record<string, unknown> => item !== null)
        .map((item) => {
          const key =
            getStringValue(item.key) ??
            normalizeFilterKey(getStringValue(item.label) ?? "");
          const label = getStringValue(item.label) ?? titleCase(key);
          const specialtyCasesDone = getFiniteNumber(item.casesDone) ?? 0;
          return {
            key,
            label,
            casesDone: specialtyCasesDone,
            accuracyPct: normalizePercent(getFiniteNumber(item.accuracyPct)),
          };
        })
        .filter((item) => item.key.length > 0 && item.casesDone > 0)
    : [];
  return {
    accuracyPct: normalizePercent(getFiniteNumber(candidate.accuracyPct)),
    casesDone,
    averageCluesUsed: getFiniteNumber(candidate.averageCluesUsed),
    averageTimeSecs: getFiniteNumber(candidate.averageTimeSecs),
    specialties,
  };
}

function deriveLearnPerformanceSummary(
  cases: LearnLibraryCase[],
): LearnPerformanceSummary {
  const casesDone = cases.length;
  const solvedCount = cases.filter((item) => item.playerResult.solved).length;
  const clueTotal = cases.reduce(
    (sum, item) => sum + item.playerResult.attemptsUsed,
    0,
  );
  const timedCases = cases.filter(
    (item) => item.playerResult.timeSecs !== null,
  );
  const timeTotal = timedCases.reduce(
    (sum, item) => sum + (item.playerResult.timeSecs ?? 0),
    0,
  );
  return {
    accuracyPct:
      casesDone > 0 ? Math.round((solvedCount / casesDone) * 100) : null,
    casesDone,
    averageCluesUsed:
      casesDone > 0 ? roundToOneDecimal(clueTotal / casesDone) : null,
    averageTimeSecs:
      timedCases.length > 0 ? Math.round(timeTotal / timedCases.length) : null,
    specialties: deriveSpecialtySummaries(cases),
  };
}

function deriveSpecialtySummaries(cases: LearnLibraryCase[]) {
  const groups = new Map<
    string,
    { label: string; casesDone: number; solved: number }
  >();
  cases.forEach((item) => {
    const specialty = getCaseSpecialty(item);
    const existing = groups.get(specialty.key) ?? {
      label: specialty.label,
      casesDone: 0,
      solved: 0,
    };
    existing.casesDone += 1;
    existing.solved += item.playerResult.solved ? 1 : 0;
    groups.set(specialty.key, existing);
  });
  return Array.from(groups.entries())
    .map(([key, value]) => ({
      key,
      label: value.label,
      casesDone: value.casesDone,
      accuracyPct:
        value.casesDone > 0
          ? Math.round((value.solved / value.casesDone) * 100)
          : null,
    }))
    .sort(
      (a, b) => b.casesDone - a.casesDone || a.label.localeCompare(b.label),
    );
}

function buildLearnFilterOptions(
  cases: LearnLibraryCase[],
): LearnFilterOptions {
  const specialties = deriveSpecialtySummaries(cases);
  const tracks = Array.from(new Set(cases.map((item) => item.track))).sort();
  const difficultyMap = new Map<string, { key: string; label: string }>();
  cases.forEach((item) => {
    const key = getCaseDifficultyKey(item);
    if (!difficultyMap.has(key))
      difficultyMap.set(key, { key, label: titleCase(key) });
  });
  const difficulties = Array.from(difficultyMap.values()).sort((a, b) =>
    a.label.localeCompare(b.label),
  );
  return { specialties, tracks, difficulties };
}

function filterLearnCases(cases: LearnLibraryCase[], filters: LearnFilters) {
  return cases.filter((item) => {
    if (
      filters.specialty !== "all" &&
      getCaseSpecialty(item).key !== filters.specialty
    )
      return false;
    if (filters.track !== "all" && item.track !== filters.track) return false;
    if (filters.result === "solved" && !item.playerResult.solved) return false;
    if (filters.result === "missed" && item.playerResult.solved) return false;
    if (
      filters.difficulty !== "all" &&
      getCaseDifficultyKey(item) !== filters.difficulty
    )
      return false;
    return true;
  });
}

function hasActiveFilters(filters: LearnFilters) {
  return (
    filters.specialty !== "all" ||
    filters.track !== "all" ||
    filters.result !== "all" ||
    filters.difficulty !== "all"
  );
}

function getTotalActiveFilterCount(filters: LearnFilters) {
  return [
    filters.specialty !== "all",
    filters.track !== "all",
    filters.result !== "all",
    filters.difficulty !== "all",
  ].filter(Boolean).length;
}

function getCaseSpecialty(item: LearnLibraryCase) {
  const caseRecord = item.case as LearnLibraryCase["case"] &
    Record<string, unknown>;
  const itemRecord = item as LearnLibraryCase & Record<string, unknown>;
  const rawLabel =
    getStringValue(caseRecord.specialty) ??
    getStringValue(caseRecord.category) ??
    getStringValue(itemRecord.specialty) ??
    getStringValue(itemRecord.category) ??
    "General Medicine";
  const rawKey =
    getStringValue(caseRecord.specialtyKey) ??
    getStringValue(caseRecord.categoryKey) ??
    getStringValue(itemRecord.specialtyKey) ??
    getStringValue(itemRecord.categoryKey) ??
    rawLabel;
  return { key: normalizeFilterKey(rawKey), label: rawLabel };
}

function getCaseDifficultyKey(item: LearnLibraryCase) {
  return normalizeFilterKey(item.case.difficulty || "standard");
}

function formatPercent(value: number | null) {
  return value === null ? "—" : `${Math.round(value)}%`;
}

function formatAverageClues(value: number | null) {
  return value === null ? "—" : value.toFixed(value % 1 === 0 ? 0 : 1);
}

function normalizeFilterKey(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized || "standard";
}

function titleCase(value: string) {
  return value
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

function roundToOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

function normalizePercent(value: number | null) {
  if (value === null) return null;
  return Math.min(100, Math.max(0, value));
}

function getFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getStringValue(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function mergeLatestPlayedCase({
  libraryCases,
  latestPlayedExplanation,
  latestPlayedResult,
  explanation,
  latestResult,
  roundViewModel,
}: {
  libraryCases: LearnLibraryCase[];
  latestPlayedExplanation: GameExplanation | null;
  latestPlayedResult: GameResult | null;
  explanation: GameExplanation | null;
  latestResult: GameResult | null;
  roundViewModel: RoundViewModel;
}) {
  const latest = latestPlayedResult ?? latestResult;
  const latestExplanation =
    latestPlayedExplanation ?? explanation ?? latest?.explanation ?? null;
  const latestCase = latest?.case;

  if (!latest?.gameOver || !latestCase || !latestExplanation)
    return libraryCases;

  const alreadyPresent = libraryCases.some(
    (item) => item.case.id === latestCase.id,
  );
  if (alreadyPresent) return libraryCases;

  const attemptsUsed = latest.attemptsCount ?? latest.clueIndex + 1;
  const fallbackCase: LearnLibraryCase = {
    sessionId: "latest",
    dailyCaseId: latestCase.id,
    casePublicNumber: latestCase.casePublicNumber ?? null,
    displayLabel: latestCase.displayLabel ?? roundViewModel.caseDisplayLabel,
    trackDisplayLabel:
      latestCase.trackDisplayLabel ?? roundViewModel.caseTrackDisplayLabel,
    track: "DAILY",
    sequenceIndex: 1,
    completedAt: latest.completedAt ?? new Date().toISOString(),
    playerResult: {
      solved: latest.gameOverReason === "correct" || latest.isTerminalCorrect,
      attemptsUsed,
      timeSecs: roundViewModel.elapsedSeconds ?? null,
    },
    case: {
      id: latestCase.id,
      publicNumber: latestCase.casePublicNumber ?? null,
      displayLabel: latestCase.displayLabel ?? roundViewModel.caseDisplayLabel,
      trackDisplayLabel:
        latestCase.trackDisplayLabel ?? roundViewModel.caseTrackDisplayLabel,
      title: roundViewModel.caseId ?? "Completed case",
      diagnosis: "Completed case",
      date: "",
      difficulty: "",
      clues: latestCase.clues,
      explanation: latestExplanation,
    },
  };

  return [fallbackCase, ...libraryCases];
}
