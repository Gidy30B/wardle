import { useEffect } from "react";
import SurfaceCard from "../../../../../components/ui/SurfaceCard";
import { coerceStructuredExplanation } from "../../../gameExplanation";
import type { ClinicalClue, LearnLibraryCase } from "../../../game.types";
import type { DetailTab } from "../learn.types";
import { CLUE_TYPE_COPY } from "../learn.constants";
import {
  buildAttemptPips,
  formatArchiveCaseLabel,
  formatStudyTime,
  splitReasoning,
} from "../domain/learnDomain";
import { DifficultyBadge, TrackBadge, InlineNotice } from "../archive/shared";
import { ReviewSection } from "./shared";

export function MobileCaseDetail({
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

export function CaseDetail({
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

export function BreakdownTab({ explanation }: { explanation: ReturnType<typeof coerceStructuredExplanation> }) {
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

export function DifferentialsTab({ differentials }: { differentials: string[] }) {
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

export function CluesTab({ clues }: { clues: ClinicalClue[] }) {
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

export function TabSwitcher({
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

export function AttemptSummary({ item }: { item: LearnLibraryCase }) {
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

export function ResultPips({
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
