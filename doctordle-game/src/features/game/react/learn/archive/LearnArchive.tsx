import type { ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";
import WardleLogo from "../../../../../components/brand/WardleLogo";
import SurfaceCard from "../../../../../components/ui/SurfaceCard";
import type { LearnLibraryCase } from "../../../game.types";
import type {
  LearnFilterOptions,
  LearnFilters,
  LearnPerformanceSummary,
} from "../learn.types";
import {
  ALL_FILTERS,
  DIFFICULTY_ACTIVE_STYLES,
  TRACK_LABEL,
} from "../learn.constants";
import { DifficultyBadge, TrackBadge } from "./shared";
import { MobileSpecialtyIcon } from "../../specialties/SpecialtyIcon";
import {
  buildAttemptPips,
  formatArchiveCaseLabel,
  formatAverageClues,
  formatPercent,
  formatStudyTime,
  getCaseDiagnosisLabel,
  getCaseSpecialty,
  getTotalActiveFilterCount,
  groupLearnCasesBySpecialty,
  normalizeFilterKey,
  roundToOneDecimal,
} from "../domain/learnDomain";

export function MobileLearnHeader() {
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

export function MobileStatsBar({
  summary,
  loading,
  error,
}: {
  summary: LearnPerformanceSummary;
  loading: boolean;
  error: string | null;
}) {
  const accuracyPct = summary.accuracyPct ?? 0;
  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (accuracyPct / 100) * circumference;

  const avgClues = summary.averageCluesUsed ?? 0;
  const clueColorClass =
    avgClues <= 2
      ? "text-[var(--wardle-color-teal)]"
      : avgClues <= 4
        ? "text-[var(--wardle-color-amber)]"
        : "text-rose-300";

  return (
    <section className="px-5 pt-5 pb-1">
      <div className="flex items-stretch gap-0">

        <div className="flex flex-1 items-center justify-center border-r border-white/[0.07] pr-4">
          <svg
            width="110"
            height="110"
            viewBox="0 0 100 100"
            aria-label={`Accuracy ${accuracyPct}%`}
          >
            <circle
              cx="50" cy="50" r="42"
              fill="none"
              stroke="rgba(255,255,255,0.07)"
              strokeWidth="6"
            />
            <circle
              cx="50" cy="50" r="42"
              fill="none"
              stroke="var(--wardle-color-teal)"
              strokeWidth="6"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              transform="rotate(-90 50 50)"
              style={{ transition: "stroke-dashoffset 0.6s ease" }}
            />
            <text
              x="50" y="46"
              textAnchor="middle"
              fontFamily="var(--font-brand-mono, 'Space Mono', monospace)"
              fontSize="18"
              fontWeight="400"
              fill="var(--wardle-color-teal)"
            >
              {formatPercent(summary.accuracyPct)}
            </text>
            <text
              x="50" y="59"
              textAnchor="middle"
              fontSize="8"
              fontWeight="500"
              fill="rgba(255,255,255,0.45)"
              letterSpacing="1"
            >
              accuracy
            </text>
          </svg>
        </div>

        <div className="flex flex-1 flex-col gap-[10px] pl-4 justify-center">
          <div>
            <p className="m-0 text-[11px] text-white/55">cases done</p>
            <p className="m-0 mt-0.5 font-brand-mono text-[22px] font-normal leading-none text-[var(--wardle-color-mint)]">
              {summary.casesDone}
            </p>
          </div>
          <div className="h-px bg-white/[0.07]" />
          <div>
            <p className="m-0 text-[11px] text-white/55">avg clues</p>
            <p className={`m-0 mt-0.5 font-brand-mono text-[22px] font-normal leading-none ${clueColorClass}`}>
              {formatAverageClues(summary.averageCluesUsed)}
              <span className="text-[12px] text-white/35">/6</span>
            </p>
          </div>
        </div>

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
  );
}

// ─── Mobile case archive ──────────────────────────────────────────────────────

export function MobileCaseArchive({
  cases,
  archiveSpecialties,
  completedCount,
  missedCount,
  dueReviewCount,
  onSelectSpecialty,
  onStartDueReviewQueue,
  loading,
  error,
  onRetry,
  onClearFilters,
}: {
  cases: LearnLibraryCase[];
  archiveSpecialties: LearnPerformanceSummary["specialties"];
  completedCount: number;
  missedCount: number;
  dueReviewCount: number;
  dueReviewCases: LearnLibraryCase[];
  onSelectSpecialty: (specialtyKey: string) => void;
  onStartDueReviewQueue: () => void;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onClearFilters: () => void;
}) {
  return (
    <section className="px-5 pt-4 pb-6 space-y-5">
      {completedCount > 0 && (
        <MobileDueRecallCard
          dueReviewCount={dueReviewCount}
          missedCount={missedCount}
          completedCount={completedCount}
          onStartDueReviewQueue={onStartDueReviewQueue}
        />
      )}

      <div>
        <div className="flex min-w-0 items-baseline justify-between gap-3 mb-2">
          <h2 className="text-[15px] font-black tracking-tight text-[var(--wardle-color-mint)]">
            Specialties
          </h2>
          <p className="font-brand-mono text-[11px] text-white/28 m-0">
            {archiveSpecialties.length} {archiveSpecialties.length === 1 ? "specialty" : "specialties"}
          </p>
        </div>

        {archiveSpecialties.length > 0 ? (
          <div className="flex flex-col">
            {archiveSpecialties.map((specialty, index) => (
              <MobileSpecialtyCard
                key={specialty.key}
                specialty={specialty}
                cases={cases.filter(
                  (item) => getCaseSpecialty(item).key === specialty.key,
                )}
                showDivider={index < archiveSpecialties.length - 1}
                onSelect={() => onSelectSpecialty(specialty.key)}
              />
            ))}
          </div>
        ) : (
          <ArchiveEmptyState
            completedCount={completedCount}
            loading={loading}
            error={error}
            onRetry={onRetry}
            onClearFilters={onClearFilters}
            mobile
          />
        )}
      </div>
    </section>
  );
}

export function MobileSpecialtyCard({
  specialty,
  cases,
  showDivider = false,
  onSelect,
}: {
  specialty: LearnPerformanceSummary["specialties"][number];
  cases: LearnLibraryCase[];
  showDivider?: boolean;
  onSelect: () => void;
}) {
  const solvedCount = cases.filter((item) => item.playerResult.solved).length;
  const missedCount = cases.length - solvedCount;
  const accuracy = specialty.accuracyPct;

  const accuracyColorClass =
    accuracy === null
      ? "text-white/38"
      : accuracy >= 75
        ? "text-[var(--wardle-color-teal)]"
        : accuracy >= 60
          ? "text-[var(--wardle-color-amber)]"
          : "text-rose-300";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`wardle-learn-fade flex w-full min-w-0 items-center gap-[10px] py-[9px] px-0.5 text-left transition active:scale-[0.99] hover:opacity-80 ${
        showDivider ? "border-b border-white/[0.07]" : ""
      }`}
    >
      <MobileSpecialtyIcon
        specialty={specialty.label || specialty.key}
        className="h-[34px] w-[34px] shrink-0 rounded-[10px]"
        iconClassName="h-[16px] w-[16px]"
      />

      <div className="min-w-0 flex-1">
        <p className="m-0 truncate text-[13px] font-bold text-[var(--wardle-color-mint)]">
          {specialty.label}
        </p>
        <p className="m-0 mt-0.5 text-[11px] text-white/34">
          {specialty.casesDone} case{specialty.casesDone === 1 ? "" : "s"}
          {missedCount > 0 ? ` · ${missedCount} missed` : ""}
          {accuracy !== null && (
            <>
              {" · "}
              <span className={`font-normal ${accuracyColorClass}`}>
                {accuracy}%
              </span>
            </>
          )}
        </p>
      </div>

      <span className="shrink-0 text-[15px] text-white/18">›</span>
    </button>
  );
}

export function MobileSpecialtyCasesScreen({
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
            <MobileSpecialtyIcon
              specialty={specialtyLabel || specialtyKey}
              className="h-12 w-12 rounded-[14px]"
              iconClassName="h-[22px] w-[22px]"
            />
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

export function MobileSpecialtyHeroStat({
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

export function MobileDueRecallCard({
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
  const title = hasDue
    ? `${dueReviewCount} due for recall`
    : "Recall queue clear";
  const subcopy = hasDue
    ? missedCount > 0
      ? `${missedCount} missed prioritized`
      : "Spaced repetition keeps memory sharp"
    : completedCount > 0
      ? "Reviewed cases will return when due"
      : "Complete cases to build this queue";

  return (
    <button
      type="button"
      onClick={hasDue ? onStartDueReviewQueue : undefined}
      disabled={!hasDue}
      className={`wardle-learn-slide-up flex w-full items-center justify-between gap-3 rounded-[18px] border px-4 py-3.5 text-left transition ${
        hasDue
          ? "border-[rgba(239,159,39,0.24)] bg-[rgba(239,159,39,0.1)] active:scale-[0.99]"
          : "border-white/[0.07] bg-white/[0.025]"
      }`}
    >
      <span className="min-w-0 flex-1">
        <span
          className={`block text-[15px] font-black ${
            hasDue ? "text-[var(--wardle-color-amber)]" : "text-white/42"
          }`}
        >
          {title}
        </span>
        {subcopy && (
          <span className="mt-0.5 block text-[12px] text-white/34">
            {subcopy}
          </span>
        )}
      </span>

      {hasDue && (
        <span className="shrink-0 rounded-full bg-[var(--wardle-color-amber)] px-4 py-2 text-[13px] font-black text-white shadow-[0_8px_22px_rgba(239,159,39,0.18)]">
          Start
        </span>
      )}
    </button>
  );
}

// ─── Mobile case card ─────────────────────────────────────────────────────────

export function MobileCaseCard({
  item,
  onSelect,
}: {
  item: LearnLibraryCase;
  onSelect: () => void;
}) {
  const solved = item.playerResult.solved;
  const diagnosis = getCaseDiagnosisLabel(item);
  const caseLabel = formatArchiveCaseLabel(item);
  const specialty = getCaseSpecialty(item);
  const timeLabel =
    item.playerResult.timeSecs !== null
      ? formatStudyTime(item.playerResult.timeSecs)
      : "—";

  return (
    <button
      type="button"
      onClick={onSelect}
      className="wardle-learn-fade flex w-full min-w-0 items-center gap-3 rounded-[14px] border border-white/[0.1] bg-white/[0.04] px-3.5 py-3 text-left transition active:scale-[0.99] hover:bg-white/[0.07]"
    >
      <MobileSpecialtyIcon
        specialty={specialty.label || specialty.key}
        className="h-[34px] w-[34px] rounded-[10px]"
        iconClassName="h-[15px] w-[15px]"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-bold text-[var(--wardle-color-mint)]">
          {diagnosis}
        </span>
        <span className="mt-0.5 block text-[11px] text-white/32">
          {caseLabel} · {solved ? `Time: ${timeLabel}` : "Not yet solved"}
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
          {timeLabel}
        </span>
      </span>
    </button>
  );
}

// ─── Desktop header ───────────────────────────────────────────────────────────

export function DesktopLearnHeader({ summary }: { summary: LearnPerformanceSummary }) {
  return (
    <section className="overflow-hidden rounded-[18px] border border-white/[0.06] bg-[var(--wardle-surface-card-compact)] px-4 py-3">
      <div className="flex min-w-0 flex-col gap-3 min-[820px]:flex-row min-[820px]:items-center min-[820px]:justify-between">
        <div className="min-w-0">
          <h1 className="text-lg font-black leading-tight tracking-tight text-[var(--wardle-color-mint)]">
            Learn
          </h1>
          <p className="mt-0.5 truncate text-[13px] leading-5 text-white/40">
            Review completed cases, clue trails, and specialty performance.
          </p>
        </div>
        <div className="grid shrink-0 grid-cols-3 overflow-hidden rounded-[14px] border border-white/[0.08] bg-white/[0.03]">
          <StatCard label="cases" value={String(summary.casesDone)} tone="neutral" />
          <StatCard label="accuracy" value={formatPercent(summary.accuracyPct)} tone="teal" />
          <StatCard label="avg clues" value={formatAverageClues(summary.averageCluesUsed)} sub="/6" tone="amber" />
        </div>
      </div>
    </section>
  );
}

export function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: "teal" | "amber" | "neutral";
}) {
  const valueClass =
    tone === "teal"
      ? "text-[var(--wardle-color-teal)]"
      : tone === "amber"
        ? "text-[var(--wardle-color-amber)]"
        : "text-[var(--wardle-color-mint)]";

  return (
    <div className="min-w-0 px-3 py-2 text-center [&+&]:border-l [&+&]:border-white/[0.08]">
      <p className={`font-brand-mono text-[18px] font-black leading-none ${valueClass}`}>
        {value}
        {sub && (
          <span className="ml-0.5 text-[11px] font-semibold text-white/36">{sub}</span>
        )}
      </p>
      <p className="mt-1 text-[10px] font-semibold lowercase tracking-[0.02em] text-white/34">
        {label}
      </p>
    </div>
  );
}

// ─── Desktop archive controls ─────────────────────────────────────────────────

export function ArchiveControls({
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

export function SpecialtyRail({
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

export function SpecialtyPill({
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

export function SecondaryFilters({
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
            label={value === "all" ? "All" : value === "solved" ? "Solved" : "Missed"}
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

export function FilterRow({
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

export function FilterToggle({
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
            ? { background: "rgba(0,180,166,0.14)", color: "var(--wardle-color-teal)" }
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

export function CaseLibraryList({
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
    <section className={`min-w-0 max-w-full overflow-hidden ${className ?? ""}`}>
      <div className="min-w-0 space-y-4">
        {groupLearnCasesBySpecialty(cases).map((group) => (
          <div key={group.specialty.key} className="space-y-2">
            <div className="flex items-baseline gap-2 px-0.5">
              <h3 className="font-brand-mono text-[10px] font-bold uppercase tracking-[0.16em] text-white/42">
                {group.specialty.label}
              </h3>
              <span className="font-brand-mono text-[11px] text-white/30">
                {group.cases.length}
              </span>
            </div>
            <div className="space-y-1">
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

export function CaseLibraryCard({
  item,
  selected,
  onSelect,
}: {
  item: LearnLibraryCase;
  selected: boolean;
  onSelect: () => void;
}) {
  const diagnosis = getCaseDiagnosisLabel(item);
  const specialty = getCaseSpecialty(item);
  const solved = item.playerResult.solved;
  const caseLabel = formatArchiveCaseLabel(item);
  const pips = buildAttemptPips(item.playerResult);
  const timeLabel =
    item.playerResult.timeSecs !== null
      ? formatStudyTime(item.playerResult.timeSecs)
      : null;
  const attemptMeta = [
    `${item.playerResult.attemptsUsed} clues`,
    timeLabel,
  ].filter((value): value is string => Boolean(value));

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative w-full min-w-0 rounded-[12px] border px-3 py-2.5 text-left transition-all duration-150 ${
        selected
          ? "border-[rgba(0,180,166,0.28)] bg-[rgba(0,180,166,0.11)] shadow-[0_10px_26px_rgba(0,180,166,0.06)]"
          : "border-white/[0.045] bg-white/[0.018] hover:border-white/[0.08] hover:bg-white/[0.035]"
      }`}
    >
      {selected && (
        <span
          aria-hidden="true"
          className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-[var(--wardle-color-teal)]"
        />
      )}

      <div className="min-w-0 space-y-2 pl-1">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p
              className={`truncate text-[13px] font-extrabold leading-5 transition-colors ${
                selected
                  ? "text-[var(--wardle-color-mint)]"
                  : "text-white/70 group-hover:text-white/82"
              }`}
            >
              {diagnosis}
            </p>
            <p className="mt-0.5 truncate text-[11px] font-medium text-white/34">
              {specialty.label} <span className="text-white/18">·</span>{" "}
              {caseLabel}
            </p>
          </div>
          <span
            className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
              solved ? "bg-[var(--wardle-color-teal)]/70" : "bg-rose-400/70"
            }`}
          />
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <TrackBadge track={item.track} />
          <DifficultyBadge difficulty={item.case.difficulty} />
        </div>

        <div className="flex min-w-0 items-center justify-between gap-3">
          <AttemptPips pips={pips} />
          <span className="shrink-0 truncate font-brand-mono text-[10px] font-bold uppercase tracking-[0.1em] text-white/34">
            {attemptMeta.join(" · ")}
          </span>
        </div>
      </div>
    </button>
  );
}

function AttemptPips({
  pips,
}: {
  pips: Array<"correct" | "used" | "missed" | "empty">;
}) {
  return (
    <span className="flex min-w-0 flex-1 gap-1" aria-hidden="true">
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
                  : "bg-white/[0.08]"
          }`}
        />
      ))}
    </span>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

export function ArchiveEmptyState({
  completedCount,
  loading,
  error,
  onRetry,
  onClearFilters,
  mobile = false,
}: {
  completedCount: number;
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
  onClearFilters?: () => void;
  mobile?: boolean;
}) {
  const title = error
    ? "Unable to load cases"
    : loading
      ? "Loading your completed cases..."
      : completedCount > 0
        ? "No matching cases"
        : "No completed cases yet";
  const copy = error
    ? "Something interrupted your learning archive. Try loading it again."
    : loading
      ? "Fetching your solved and missed cases from Wardle."
      : completedCount > 0
        ? "No matching cases. Clear filters to bring cases back into view."
        : "Complete a case to build your learning archive.";

  const retryButton = error && onRetry ? (
    <button
      type="button"
      onClick={onRetry}
      className="mt-4 rounded-full border border-[rgba(0,180,166,0.24)] bg-[rgba(0,180,166,0.1)] px-4 py-2 font-brand-mono text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--wardle-color-teal)] transition hover:bg-[rgba(0,180,166,0.16)]"
    >
      Retry
    </button>
  ) : null;

  const clearFiltersButton = !error && !loading && completedCount > 0 && onClearFilters ? (
    <button
      type="button"
      onClick={onClearFilters}
      className="mt-4 rounded-full border border-white/[0.1] bg-white/[0.04] px-4 py-2 font-brand-mono text-[11px] font-bold uppercase tracking-[0.14em] text-white/56 transition hover:bg-white/[0.08] hover:text-white/76"
    >
      Clear filters
    </button>
  ) : null;

  if (mobile) {
    return (
      <div className="rounded-[14px] border border-white/[0.07] bg-white/[0.025] px-4 py-5">
        <p className="text-sm font-bold text-[var(--wardle-color-mint)]">{title}</p>
        <p className="mt-2 text-sm leading-6 text-white/40">{copy}</p>
        {retryButton}
        {clearFiltersButton}
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
      {retryButton}
      {clearFiltersButton}
    </SurfaceCard>
  );
}
