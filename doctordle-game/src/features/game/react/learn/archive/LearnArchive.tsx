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
  MOBILE_SPECIALTY_ICONS,
  TRACK_LABEL,
} from "../learn.constants";
import {
  formatArchiveCaseLabel,
  formatAverageClues,
  formatPercent,
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

export function MobileKoiStat({
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

export function MobileCaseArchive({
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

export function MobileSpecialtyCard({
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

export function MobileCaseCard({
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

export function DesktopLearnHeader({ summary }: { summary: LearnPerformanceSummary }) {
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

export function StatCard({
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

export function CaseLibraryCard({
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

export function ArchiveEmptyState({
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

export function getMobileSpecialtyIcon(key: string) {
  return (
    MOBILE_SPECIALTY_ICONS[key] ?? {
      icon: "🩺",
      tone: "bg-white/[0.08] text-white/70",
    }
  );
}
