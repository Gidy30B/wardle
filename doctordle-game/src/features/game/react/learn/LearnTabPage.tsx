import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { LearnLibraryCase } from "../../game.types";
import type {
  DetailTab,
  LearnFilterOptions,
  LearnFilters,
  LearnReviewState,
  LearnTabPageProps,
} from "./learn.types";
import { useLearnFilters } from "./hooks/useLearnFilters";
import { useLearnSummary } from "./hooks/useLearnSummary";
import { useRecallQueue } from "./hooks/useRecallQueue";
import { useReviewPersistence } from "./hooks/useReviewPersistence";
import { useSelectedLearnCase } from "./hooks/useSelectedLearnCase";
import {
  ArchiveEmptyState,
  MobileCaseArchive,
  MobileLearnHeader,
  MobileSpecialtyCasesScreen,
  MobileStatsBar,
  SpecialtyRail,
} from "./archive";
import { CaseDetail, MobileCaseDetail } from "./detail";
import { AdaptiveRecallQueueController } from "./recall/components";
import {
  buildAdaptiveRecallQueue,
  createEmptyLearnReviewState,
  filterLearnCases,
  getCaseSpecialty,
  getCaseDiagnosisLabel,
  getLearnReviewCaseKey,
  mergeLatestPlayedCase,
  titleCase,
} from "./domain/learnDomain";
import { ALL_FILTERS } from "./learn.constants";

const DESKTOP_DETAIL_TABS: Array<{ id: DetailTab; label: string }> = [
  { id: "case", label: "Breakdown" },
  { id: "compare", label: "Differentials" },
  { id: "diagnosis", label: "Key Facts" },
];

function normalizeDiagnosisKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getLearnCasePublicNumberLabel(item: LearnLibraryCase) {
  const publicNumber = item.casePublicNumber ?? item.case.publicNumber;
  return publicNumber ? `Case ${publicNumber}` : formatArchiveFallbackCaseLabel(item);
}

function formatArchiveFallbackCaseLabel(item: LearnLibraryCase) {
  return item.displayLabel ?? item.case.displayLabel ?? `Case ${item.sequenceIndex}`;
}

function getActualCaseDateValue(item: LearnLibraryCase) {
  const value = Date.parse(item.case.date || item.completedAt || "");
  return Number.isFinite(value) ? value : 0;
}

function sortByNewestCaseDate(cases: LearnLibraryCase[]) {
  return [...cases].sort(
    (left, right) => getActualCaseDateValue(right) - getActualCaseDateValue(left),
  );
}

function buildDiagnosisPickerItems(cases: LearnLibraryCase[]): DiagnosisPickerItem[] {
  const groups = new Map<string, { diagnosis: string; cases: LearnLibraryCase[] }>();

  cases.forEach((item) => {
    const diagnosis = getCaseDiagnosisLabel(item);
    const id = normalizeDiagnosisKey(diagnosis);
    if (!id) return;
    const group = groups.get(id) ?? { diagnosis, cases: [] };
    group.cases.push(item);
    groups.set(id, group);
  });

  return Array.from(groups.entries())
    .map(([id, group]) => {
      const sortedCases = sortByNewestCaseDate(group.cases);
      return {
        id,
        diagnosis: group.diagnosis,
        latestCase: sortedCases[0],
        cases: sortedCases,
      };
    })
    .filter((item): item is DiagnosisPickerItem => Boolean(item.latestCase))
    .sort((left, right) => left.diagnosis.localeCompare(right.diagnosis));
}

// ─── Empty State Components ────────────────────────────────────────────────────

/**
 * Shown on desktop when the library is loading.
 */
function DesktopLoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center justify-between gap-4 rounded-[18px] border border-white/[0.06] bg-white/[0.025] px-3 py-3">
        <div className="flex min-w-0 flex-1 gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-9 min-w-20 flex-1 rounded-full bg-white/5"
              style={{ opacity: 1 - i * 0.12 }}
            />
          ))}
        </div>
        <div className="h-11 w-72 rounded-[16px] bg-white/5" />
      </div>
      <div className="rounded-[24px] border border-white/10 bg-white/[0.025] p-6">
        <div className="h-9 w-1/2 rounded-md bg-white/5" />
        <div className="mt-3 h-4 w-full rounded bg-white/[0.04]" />
        <div className="mt-2 h-4 w-5/6 rounded bg-white/[0.04]" />
        <div className="mt-5 grid gap-3 min-[760px]:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-28 rounded-lg bg-white/5"
            style={{ opacity: 1 - i * 0.12 }}
          />
        ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Shown on desktop when an error prevents the library from loading.
 */
function DesktopErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-red-500/20 bg-red-500/5 px-6 py-16 text-center">
      {/* Icon */}
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10">
        <svg
          className="h-6 w-6 text-red-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
          />
        </svg>
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-red-300">
          Couldn't load your case library
        </p>
        <p className="text-xs text-white/30">
          Check your connection and try again.
        </p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-white/60 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white/80"
        >
          Retry
        </button>
      )}
    </div>
  );
}

/**
 * Shown on desktop when there are no completed cases at all yet.
 */
function DesktopNeverPlayedState() {
  return (
    <div className="flex flex-col items-center justify-center gap-5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-8 py-20 text-center">
      <div className="relative h-14 w-14">
        <div className="absolute inset-0 translate-x-1.5 translate-y-1.5 rotate-6 rounded-lg border border-white/10 bg-white/[0.04]" />
        <div className="absolute inset-0 -translate-x-1 translate-y-0.5 -rotate-3 rounded-lg border border-white/10 bg-white/[0.06]" />
        <div className="absolute inset-0 flex items-center justify-center rounded-lg border border-white/[0.12] bg-white/[0.08]">
          <svg
            className="h-6 w-6 text-white/30"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"
            />
          </svg>
        </div>
      </div>

      <div className="max-w-xs space-y-1.5">
        <p className="text-sm font-semibold tracking-wide text-white/60">
          No cases yet
        </p>
        <p className="text-xs leading-relaxed text-white/25">
          Complete your first case to start building your library. Cases you
          play will appear here for review and practice.
        </p>
      </div>
    </div>
  );
}

/**
 * Shown on desktop when cases exist but the active filters match nothing.
 */
function DesktopFilteredEmptyState({
  onClearFilters,
}: {
  onClearFilters: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-8 py-16 text-center">
      {/* Search + slash icon */}
      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.05]">
        <svg
          className="h-5 w-5 text-white/30"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m15.75 15.75-2.489-2.489m0 0a3.375 3.375 0 1 0-4.773-4.773 3.375 3.375 0 0 0 4.774 4.774ZM21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
          />
        </svg>
      </div>

      <div className="space-y-1 max-w-xs">
        <p className="text-sm font-medium text-white/50">
          No cases match these filters
        </p>
        <p className="text-xs text-white/25">
          Try adjusting or clearing the active filters to see your cases.
        </p>
      </div>

      <button
        onClick={onClearFilters}
        className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-medium text-white/50 transition-all hover:border-white/20 hover:bg-white/[0.08] hover:text-white/70"
      >
        Clear filters
      </button>
    </div>
  );
}

/**
 * Unified desktop archive empty state — selects the right variant automatically.
 */
function DesktopArchiveEmptyState({
  completedCount,
  loading,
  error,
  onRetry,
  onClearFilters,
}: {
  completedCount: number;
  loading: boolean;
  error: boolean;
  onRetry?: () => void;
  onClearFilters: () => void;
}) {
  if (loading) return <DesktopLoadingSkeleton />;
  if (error) return <DesktopErrorState onRetry={onRetry} />;
  if (completedCount === 0) return <DesktopNeverPlayedState />;
  return <DesktopFilteredEmptyState onClearFilters={onClearFilters} />;
}

type DiagnosisPickerItem = {
  id: string;
  diagnosis: string;
  latestCase: LearnLibraryCase;
  cases: LearnLibraryCase[];
};

function DiagnosisPickerDropdown({
  diagnoses,
  selectedDiagnosisId,
  onSelectDiagnosis,
}: {
  diagnoses: DiagnosisPickerItem[];
  selectedDiagnosisId: string | null;
  onSelectDiagnosis: (diagnosis: DiagnosisPickerItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedDiagnosis =
    diagnoses.find((diagnosis) => diagnosis.id === selectedDiagnosisId) ??
    diagnoses[0] ??
    null;

  return (
    <div className="relative min-w-0 shrink-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        disabled={!diagnoses.length}
        aria-expanded={open}
        className="flex min-h-[38px] w-[280px] max-w-[28vw] min-w-[220px] items-center justify-between gap-3 rounded-[12px] border border-white/[0.09] bg-white/[0.035] px-3.5 py-2 text-left transition hover:border-white/[0.14] hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-45"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold text-[var(--wardle-color-mint)]">
            {selectedDiagnosis?.diagnosis ?? "No diagnosis selected"}
          </span>
          <span className="mt-0.5 block font-brand-mono text-[10px] font-bold uppercase tracking-[0.12em] text-white/28">
            Diagnosis
          </span>
        </span>
        <span className="shrink-0 text-white/36">
          {open ? (
            <ChevronUp className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
          ) : (
            <ChevronDown className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
          )}
        </span>
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 max-h-[min(420px,calc(100dvh-150px))] w-[360px] overflow-y-auto rounded-[16px] border border-white/[0.09] bg-[var(--wardle-surface-sticky-solid)] p-2 shadow-2xl">
          <div className="space-y-1">
            {diagnoses.map((diagnosis) => {
              const selected = diagnosis.id === selectedDiagnosisId;
              const resultTone = diagnosis.latestCase.playerResult.solved
                ? "bg-[var(--wardle-color-teal)]/75"
                : "bg-rose-400/70";

              return (
                <button
                  key={diagnosis.id}
                  type="button"
                  onClick={() => {
                    onSelectDiagnosis(diagnosis);
                    setOpen(false);
                  }}
                  className={`flex w-full min-w-0 items-center gap-3 rounded-[13px] border px-3 py-2.5 text-left transition ${
                    selected
                      ? "border-[rgba(0,180,166,0.32)] bg-[rgba(0,180,166,0.12)]"
                      : "border-transparent hover:border-white/[0.08] hover:bg-white/[0.045]"
                  }`}
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${resultTone}`} />
                  <span
                    className={`min-w-0 flex-1 truncate text-[13px] font-bold ${
                      selected
                        ? "text-[var(--wardle-color-mint)]"
                        : "text-white/78"
                    }`}
                  >
                    {diagnosis.diagnosis}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DesktopLearnControlHeader({
  filterOptions,
  filters,
  archiveCaseCount,
  activeCase,
  diagnoses,
  selectedDiagnosisId,
  activeDiagnosisCases,
  activeTab,
  onChangeTab,
  onSelectSpecialty,
  onSelectDiagnosis,
  onSelectCase,
}: {
  filterOptions: LearnFilterOptions;
  filters: LearnFilters;
  archiveCaseCount: number;
  activeCase: LearnLibraryCase | null;
  diagnoses: DiagnosisPickerItem[];
  selectedDiagnosisId: string | null;
  activeDiagnosisCases: LearnLibraryCase[];
  activeTab: DetailTab;
  onChangeTab: (tab: DetailTab) => void;
  onSelectSpecialty: (specialty: string) => void;
  onSelectDiagnosis: (diagnosis: DiagnosisPickerItem) => void;
  onSelectCase: (dailyCaseId: string) => void;
}) {
  return (
    <header className="sticky top-0 z-40 -mx-1 border-b border-white/[0.06] bg-[var(--wardle-surface-sticky)] backdrop-blur-xl sm:-mx-2">
      <div className="flex min-w-0 items-center gap-3 px-5 py-3">
        <div className="mr-0.5 shrink-0 border-r border-white/[0.08] pr-4">
          <p className="text-sm font-black tracking-tight text-[var(--wardle-color-mint)]">
            Learn
          </p>
        </div>
        <div className="min-w-0 flex-1">
          <SpecialtyRail
            filterOptions={filterOptions}
            activeSpecialty={filters.specialty}
            completedCount={archiveCaseCount}
            onSelect={onSelectSpecialty}
          />
        </div>
        <DiagnosisPickerDropdown
          diagnoses={diagnoses}
          selectedDiagnosisId={selectedDiagnosisId}
          onSelectDiagnosis={onSelectDiagnosis}
        />
      </div>
      <div className="flex min-w-0 items-center justify-between gap-4 border-t border-white/[0.04] px-5 py-2.5">
        <DesktopLearnTabs activeTab={activeTab} onChangeTab={onChangeTab} />
        <DesktopDiagnosisCasePicker
          item={activeCase}
          diagnosisCases={activeDiagnosisCases}
          onSelectCase={onSelectCase}
        />
      </div>
    </header>
  );
}

function DesktopLearnTabs({
  activeTab,
  onChangeTab,
}: {
  activeTab: DetailTab;
  onChangeTab: (tab: DetailTab) => void;
}) {
  return (
    <div className="inline-grid grid-cols-3 gap-1 rounded-[14px] bg-white/[0.05] p-1">
      {DESKTOP_DETAIL_TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChangeTab(tab.id)}
          className={`rounded-[11px] px-3.5 py-2 text-xs font-bold transition ${
            activeTab === tab.id
              ? "bg-[var(--wardle-color-teal)] text-[var(--wardle-color-charcoal)]"
              : "text-white/40 hover:text-white/65"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function DesktopDiagnosisCasePicker({
  item,
  diagnosisCases,
  onSelectCase,
}: {
  item: LearnLibraryCase | null;
  diagnosisCases: LearnLibraryCase[];
  onSelectCase: (dailyCaseId: string) => void;
}) {
  const [open, setOpen] = useState(false);

  if (!item) return null;

  const currentIndex = Math.max(
    0,
    diagnosisCases.findIndex((caseItem) => caseItem.dailyCaseId === item.dailyCaseId),
  );
  const caseLabel = getLearnCasePublicNumberLabel(item);
  const resultTone = item.playerResult.solved
    ? "bg-[var(--wardle-color-teal)]/75"
    : "bg-rose-400/70";

  if (diagnosisCases.length < 2) {
    return (
      <div className="flex min-w-0 shrink-0 items-center gap-2 text-right">
        <span className={`h-2 w-2 shrink-0 rounded-full ${resultTone}`} />
        <span className="font-brand-mono text-[10px] font-bold uppercase tracking-[0.12em] text-white/34">
          {caseLabel}
        </span>
      </div>
    );
  }

  return (
    <div className="relative min-w-0 shrink-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex min-w-0 items-center gap-2 rounded-full border border-[var(--wardle-color-teal)]/24 bg-[var(--wardle-color-teal)]/10 px-3 py-1.5 text-left font-brand-mono text-[10px] font-black uppercase tracking-[0.12em] text-[var(--wardle-color-teal)] transition hover:border-[var(--wardle-color-teal)]/36 hover:bg-[var(--wardle-color-teal)]/14"
      >
        <span className={`h-2 w-2 shrink-0 rounded-full ${resultTone}`} />
        <span className="min-w-0 truncate">
          {caseLabel} - {currentIndex + 1} of {diagnosisCases.length} cases
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 transition ${open ? "rotate-180" : ""}`}
          strokeWidth={2.25}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 max-h-[min(360px,calc(100dvh-160px))] w-[280px] overflow-y-auto rounded-[16px] border border-white/[0.09] bg-[var(--wardle-surface-sticky-solid)] p-2 shadow-2xl">
          <p className="px-2 pb-2 pt-1 font-brand-mono text-[9px] font-black uppercase tracking-[0.16em] text-white/32">
            {diagnosisCases.length} cases of {getCaseDiagnosisLabel(item)}
          </p>
          <div className="space-y-1">
            {diagnosisCases.map((caseItem) => {
              const selected = caseItem.dailyCaseId === item.dailyCaseId;
              const caseResultTone = caseItem.playerResult.solved
                ? "bg-[var(--wardle-color-teal)]/75"
                : "bg-rose-400/70";

              return (
                <button
                  key={caseItem.dailyCaseId}
                  type="button"
                  onClick={() => {
                    onSelectCase(caseItem.dailyCaseId);
                    setOpen(false);
                  }}
                  className={`flex w-full min-w-0 items-center gap-3 rounded-[12px] border px-3 py-2 text-left transition ${
                    selected
                      ? "border-[rgba(0,180,166,0.32)] bg-[rgba(0,180,166,0.12)]"
                      : "border-transparent hover:border-white/[0.08] hover:bg-white/[0.045]"
                  }`}
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${caseResultTone}`} />
                  <span
                    className={`min-w-0 flex-1 truncate text-[12px] font-bold ${
                      selected
                        ? "text-[var(--wardle-color-mint)]"
                        : "text-white/72"
                    }`}
                  >
                    {getLearnCasePublicNumberLabel(caseItem)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MobileNeverPlayedState() {
  return (
    <div className="wardle-learn-slide-up mx-4 mt-3 overflow-hidden rounded-[22px] border border-white/[0.08] bg-white/[0.025] shadow-[0_18px_46px_rgba(0,0,0,0.22)]">
      <div className="p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex rounded-full border border-[var(--wardle-color-teal)]/20 bg-[var(--wardle-color-teal)]/10 px-3 py-1 font-brand-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--wardle-color-teal)]">
              Learning archive
            </div>
            <h3 className="text-[20px] font-black leading-tight tracking-[-0.03em] text-[var(--wardle-color-light)]">
              Your case library is waiting
            </h3>
          </div>

          <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl border border-[var(--wardle-color-amber)]/24 bg-[var(--wardle-color-amber)]/10 text-[var(--wardle-color-amber)]">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-7 w-7"
              aria-hidden="true"
            >
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z" />
              <path d="M8 7h8" />
              <path d="M8 11h6" />
            </svg>
          </div>
        </div>

        <p className="text-[13px] leading-[1.7] text-white/56">
          Complete your first case to unlock explanations, specialty shelves,
          quick stats, and recall prompts.
        </p>

        <div className="mt-5 space-y-2.5">
          {[
            ["01", "Finish a case", "Solved and missed cases are saved here."],
            ["02", "Review the reasoning", "Revisit explanations and key findings."],
            ["03", "Build recall", "Use review prompts to reinforce weak spots."],
          ].map(([n, title, body]) => (
            <div
              key={title}
              className="flex gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.035] p-3.5"
            >
              <div className="font-brand-mono text-[11px] font-bold text-[var(--wardle-color-teal)]/72">
                {n}
              </div>
              <div>
                <div className="text-[13px] font-bold text-white/88">
                  {title}
                </div>
                <div className="mt-1 text-[12px] leading-[1.45] text-white/42">
                  {body}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
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
  onRetryLibrary,
  openIntent,
  onOpenIntentConsumed,
  roundViewModel,
}: LearnTabPageProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>("case");
  const [studyQueueCaseIds, setStudyQueueCaseIds] = useState<string[] | null>(
    null,
  );
  const [studyQueueIndex, setStudyQueueIndex] = useState(0);
  const [reviewStateByCaseKey, setReviewStateByCaseKey] =
    useReviewPersistence();
  const [selectedMobileSpecialty, setSelectedMobileSpecialty] = useState<
    string | null
  >(null);
  const consumedOpenIntentIdRef = useRef<string | null>(null);

  const resetLearnSelection = () => {
    setSelectedCaseId(null);
    setActiveTab("case");
    setStudyQueueCaseIds(null);
    setStudyQueueIndex(0);
    setSelectedMobileSpecialty(null);
  };

  const { filters, updateFilters } = useLearnFilters(resetLearnSelection);

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

  const filteredCases = useMemo(
    () => filterLearnCases(completedCases, filters),
    [completedCases, filters],
  );

  useEffect(() => {
    if (!openIntent?.openLatestPlayedCase) return;
    if (consumedOpenIntentIdRef.current === openIntent.intentId) return;

    const latest = latestPlayedResult ?? latestResult;
    const targetCaseId = openIntent.caseId ?? latest?.case?.id ?? null;
    const targetDailyCaseId = openIntent.dailyCaseId ?? null;
    const targetCase = completedCases.find(
      (item) =>
        (targetCaseId && item.case.id === targetCaseId) ||
        (targetDailyCaseId && item.dailyCaseId === targetDailyCaseId),
    );

    if (!targetCase) return;

    consumedOpenIntentIdRef.current = openIntent.intentId;
    updateFilters(ALL_FILTERS);
    setStudyQueueCaseIds(null);
    setStudyQueueIndex(0);
    setSelectedMobileSpecialty(null);
    setSelectedCaseId(targetCase.case.id);
    setActiveTab("case");
    onOpenIntentConsumed?.(openIntent.intentId);
  }, [
    completedCases,
    latestPlayedResult,
    latestResult,
    onOpenIntentConsumed,
    openIntent,
    updateFilters,
  ]);

  const { archiveSpecialties, displayedSummary, filterOptions } =
    useLearnSummary({
      completedCases,
      filteredCases,
      filters,
      learnLibrary,
    });
  const archiveCaseCount = completedCases.length;
  const statsCaseCount = displayedSummary.casesDone;
  const hasAnyCompletedCases = archiveCaseCount > 0 || statsCaseCount > 0;
  const hasArchiveCases = archiveCaseCount > 0;

  const { dueReviewCases, missedCases, studyQueueCases } = useRecallQueue({
    completedCases,
    reviewStateByCaseKey,
    setStudyQueueCaseIds,
    setStudyQueueIndex,
    studyQueueCaseIds,
    studyQueueIndex,
  });

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
    ? (archiveSpecialties.find(
        (specialty) => specialty.key === selectedMobileSpecialty,
      ) ?? null)
    : null;

  const { activeCase, selectedCase } = useSelectedLearnCase({
    completedCases,
    filteredCases,
    selectedCaseId,
    setActiveTab,
    setSelectedCaseId,
    setStudyQueueCaseIds,
    setStudyQueueIndex,
  });

  const diagnosisPickerItems = useMemo(
    () => buildDiagnosisPickerItems(filteredCases),
    [filteredCases],
  );
  const activeDiagnosisId = activeCase
    ? normalizeDiagnosisKey(getCaseDiagnosisLabel(activeCase))
    : null;
  const activeDiagnosisCases = useMemo(() => {
    if (!activeDiagnosisId) return [];
    return (
      diagnosisPickerItems.find((diagnosis) => diagnosis.id === activeDiagnosisId)
        ?.cases ?? []
    );
  }, [activeDiagnosisId, diagnosisPickerItems]);

  const selectCase = (dailyCaseId: string) => {
    setStudyQueueCaseIds(null);
    setStudyQueueIndex(0);
    setSelectedCaseId(dailyCaseId);
    setSelectedMobileSpecialty(null);
    setActiveTab("case");
  };

  const clearSelectedCase = () => {
    setSelectedCaseId(null);
    setActiveTab("case");
    setStudyQueueCaseIds(null);
    setStudyQueueIndex(0);
  };

  const clearSelectedMobileSpecialty = () => {
    setSelectedMobileSpecialty(null);
    setSelectedCaseId(null);
    setActiveTab("case");
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
    setActiveTab("case");
  };

  const selectDiagnosis = (diagnosis: DiagnosisPickerItem) => {
    selectCase(diagnosis.latestCase.dailyCaseId);
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
              setActiveTab("case");
            }}
          />
        ) : !selectedCase ? (
          <>
            <MobileLearnHeader />
            {hasAnyCompletedCases ? (
              <>
                <MobileStatsBar
                  summary={displayedSummary}
                  loading={libraryLoading}
                  error={libraryError}
                />
                <MobileCaseArchive
                  cases={completedCases}
                  archiveSpecialties={archiveSpecialties}
                  completedCount={archiveCaseCount}
                  missedCount={missedCases.length}
                  dueReviewCount={dueReviewCases.length}
                  dueReviewCases={dueReviewCases}
                  onSelectSpecialty={setSelectedMobileSpecialty}
                  onStartDueReviewQueue={startDueReviewQueue}
                  loading={libraryLoading}
                  error={libraryError}
                  onRetry={onRetryLibrary}
                  onClearFilters={() => updateFilters(ALL_FILTERS)}
                />
              </>
            ) : (
              <>
                {!libraryLoading && !libraryError ? (
                  <MobileNeverPlayedState />
                ) : (
                  <div className="px-4 pt-4">
                    <ArchiveEmptyState
                      completedCount={0}
                      loading={libraryLoading}
                      error={libraryError}
                      onRetry={onRetryLibrary}
                      onClearFilters={() => updateFilters(ALL_FILTERS)}
                      mobile
                    />
                  </div>
                )}
              </>
            )}
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
      <main className="hidden h-full min-h-0 w-full max-w-full flex-1 basis-0 flex-col overflow-x-hidden overflow-y-auto overscroll-contain lg:flex">
        <div className="min-w-0 max-w-full overflow-x-hidden">
          {hasArchiveCases && !libraryLoading && !libraryError ? (
            <div className="min-w-0">
              <DesktopLearnControlHeader
                filterOptions={filterOptions}
                filters={filters}
                archiveCaseCount={archiveCaseCount}
                activeCase={activeCase}
                diagnoses={diagnosisPickerItems}
                selectedDiagnosisId={activeDiagnosisId}
                activeDiagnosisCases={activeDiagnosisCases}
                activeTab={activeTab}
                onChangeTab={setActiveTab}
                onSelectSpecialty={(specialty) =>
                  updateFilters({ ...filters, specialty })
                }
                onSelectDiagnosis={selectDiagnosis}
                onSelectCase={selectCase}
              />
              {filteredCases.length > 0 ? (
                <div className="mx-[22px] mb-5 mt-[18px]">
                  <CaseDetail
                    className="!rounded-[22px] !border-white/[0.06] !bg-[var(--wardle-surface-card-compact)] !p-0 !shadow-none"
                    item={activeCase}
                    activeTab={activeTab}
                    onChangeTab={setActiveTab}
                    onBack={clearSelectedCase}
                    showDesktopTabs={false}
                  />
                </div>
              ) : (
                <div className="mx-[22px] mt-[18px]">
                  <DesktopArchiveEmptyState
                    completedCount={archiveCaseCount}
                    loading={false}
                    error={false}
                    onRetry={onRetryLibrary}
                    onClearFilters={() => updateFilters(ALL_FILTERS)}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="p-4">
              <DesktopArchiveEmptyState
                completedCount={hasAnyCompletedCases ? archiveCaseCount : 0}
                loading={libraryLoading}
                error={Boolean(libraryError)}
                onRetry={onRetryLibrary}
                onClearFilters={() => updateFilters(ALL_FILTERS)}
              />
            </div>
          )}
        </div>
      </main>
    </>
  );
}
