import { useEffect } from "react";
import type { ReactNode } from "react";
import SurfaceCard from "../../../../../components/ui/SurfaceCard";
import { coerceStructuredExplanation } from "../../../gameExplanation";
import type {
  ClinicalClue,
  DiagnosisEducation,
  LearnLibraryCase,
} from "../../../game.types";
import { useDiagnosisEducation } from "../../../useDiagnosisEducation";
import type { DetailTab } from "../learn.types";
import { CLUE_TYPE_COPY } from "../learn.constants";
import {
  buildAttemptPips,
  formatArchiveCaseLabel,
  formatStudyTime,
  getCaseDiagnosisLabel,
  splitReasoning,
} from "../domain/learnDomain";
import { DifficultyBadge, InlineNotice, TrackBadge } from "../archive/shared";
import { ReviewSection } from "./shared";

type StructuredExplanation = ReturnType<typeof coerceStructuredExplanation>;

type EducationState = {
  education: DiagnosisEducation | null;
  enabled: boolean;
  loading: boolean;
  error: string | null;
};

type CompareItem = {
  name: string;
  casePoint?: string;
  generalPoint?: string;
};

const DETAIL_TABS: Array<{ id: DetailTab; label: string }> = [
  { id: "case", label: "Case" },
  { id: "diagnosis", label: "Diagnosis" },
  { id: "compare", label: "Compare" },
];

function getDiagnosisRegistryId(item: LearnLibraryCase): string | null {
  return item.case.diagnosisRegistryId ?? null;
}

function normalizeDiagnosisName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getEducationSummary(education: DiagnosisEducation | null) {
  if (!education?.summary) {
    return { definition: null, takeaway: null };
  }

  if (typeof education.summary === "string") {
    return { definition: education.summary, takeaway: null };
  }

  return {
    definition: education.summary.definition ?? null,
    takeaway: education.summary.highYieldTakeaway ?? null,
  };
}

function buildCompareItems({
  caseDifferentials,
  education,
}: {
  caseDifferentials: string[];
  education: DiagnosisEducation | null;
}): CompareItem[] {
  const items: CompareItem[] = [];
  const indexByName = new Map<string, number>();

  caseDifferentials.forEach((name) => {
    const normalized = normalizeDiagnosisName(name);
    if (!normalized || indexByName.has(normalized)) return;
    indexByName.set(normalized, items.length);
    items.push({ name, casePoint: "Considered in this case, but the clue pattern favored the final diagnosis." });
  });

  education?.differentialDistinguishers?.forEach((entry) => {
    const name = typeof entry === "string" ? entry : entry.diagnosis;
    const generalPoint =
      typeof entry === "string" ? undefined : entry.distinguishingPoint;
    if (!name) return;

    const normalized = normalizeDiagnosisName(name);
    if (!normalized) return;

    const existingIndex = indexByName.get(normalized);
    if (existingIndex !== undefined) {
      items[existingIndex] = {
        ...items[existingIndex],
        generalPoint: generalPoint ?? items[existingIndex].generalPoint,
      };
      return;
    }

    indexByName.set(normalized, items.length);
    items.push({ name, generalPoint });
  });

  return items;
}

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
  const diagnosis = getCaseDiagnosisLabel(item);
  const diagnosisRegistryId = getDiagnosisRegistryId(item);
  const educationState = useDiagnosisEducation(diagnosisRegistryId);

  useEffect(() => {
    onChangeTab("case");
  }, [item.dailyCaseId, onChangeTab]);

  return (
    <div className="min-w-0 pb-10">
      <div className="sticky top-0 z-20 border-b border-white/[0.05] bg-[var(--wardle-color-charcoal)]">
        <div className="flex min-w-0 items-center px-5 py-3">
          <button
            type="button"
            onClick={onBack}
            className="flex shrink-0 items-center gap-1.5 text-sm font-bold text-[var(--wardle-color-teal)]"
          >
            <span className="text-base leading-none">‹</span>
            Library
          </button>
        </div>
        <div className="px-4 pb-3">
          <LearningHeader diagnosis={diagnosis} explanation={explanation} />
          <div className="mt-3">
            <LearnDetailTabSwitcher
              activeTab={activeTab}
              onChangeTab={onChangeTab}
              mobile
            />
          </div>
        </div>
      </div>

      <div className="mx-4 mt-5">
        <LearnDetailTabContent
          activeTab={activeTab}
          item={item}
          explanation={explanation}
          educationState={educationState}
          mobile
        />
      </div>
    </div>
  );
}

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
  const diagnosisRegistryId = item ? getDiagnosisRegistryId(item) : null;
  const educationState = useDiagnosisEducation(diagnosisRegistryId);

  if (!item) return null;

  const explanation = coerceStructuredExplanation(item.case.explanation ?? {});
  const diagnosis = getCaseDiagnosisLabel(item);

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

        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(190px,0.42fr)_minmax(0,1fr)]">
          <aside className="min-w-0 space-y-3 rounded-[16px] border border-white/[0.07] bg-white/[0.025] p-4">
            <LearningHeader diagnosis={diagnosis} explanation={explanation} />
            <LearnDetailTabSwitcher
              activeTab={activeTab}
              onChangeTab={onChangeTab}
              vertical
            />
            <DesktopCaseMeta item={item} />
            <AttemptSummary item={item} />
          </aside>

          <div className="min-w-0">
            <LearnDetailTabContent
              activeTab={activeTab}
              item={item}
              explanation={explanation}
              educationState={educationState}
            />
          </div>
        </div>
      </div>
    </SurfaceCard>
  );
}

function LearningHeader({
  diagnosis,
  explanation,
}: {
  diagnosis: string;
  explanation: StructuredExplanation;
}) {
  return (
    <header className="min-w-0 space-y-2">
      <p className="font-brand-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--wardle-color-teal)]/55">
        Diagnosis
      </p>
      <h1 className="break-words text-[22px] font-black leading-[1.15] tracking-tight text-[var(--wardle-color-mint)] lg:text-2xl">
        {diagnosis}
      </h1>
      {explanation?.summary ? (
        <p className="break-words text-[13px] leading-[1.65] text-white/54">
          {explanation.summary}
        </p>
      ) : null}
    </header>
  );
}

function LearnDetailTabSwitcher({
  activeTab,
  onChangeTab,
  mobile = false,
  vertical = false,
}: {
  activeTab: DetailTab;
  onChangeTab: (tab: DetailTab) => void;
  mobile?: boolean;
  vertical?: boolean;
}) {
  const wrapperClass = vertical
    ? "space-y-1 rounded-[16px] bg-white/[0.04] p-1"
    : "grid grid-cols-3 gap-1 rounded-[18px] bg-white/[0.05] p-1";

  return (
    <div className={wrapperClass}>
      {DETAIL_TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChangeTab(tab.id)}
          className={`w-full rounded-[14px] px-2 py-2 font-bold transition-all duration-200 ${
            mobile ? "text-[11px]" : "text-xs"
          } ${
            activeTab === tab.id
              ? "bg-[var(--wardle-color-teal)] text-[var(--wardle-color-charcoal)] shadow-sm"
              : "text-white/40 hover:text-white/65"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function LearnDetailTabContent({
  activeTab,
  item,
  explanation,
  educationState,
  mobile = false,
}: {
  activeTab: DetailTab;
  item: LearnLibraryCase;
  explanation: StructuredExplanation;
  educationState: EducationState;
  mobile?: boolean;
}) {
  if (activeTab === "case") {
    return (
      <CaseTab
        clues={item.case.clues}
        explanation={explanation}
        mobile={mobile}
      />
    );
  }

  if (activeTab === "diagnosis") {
    return <DiagnosisTab educationState={educationState} mobile={mobile} />;
  }

  return (
    <CompareTab
      explanation={explanation}
      education={educationState.education}
      loading={educationState.loading}
      mobile={mobile}
    />
  );
}

function MobileSection({
  number,
  title,
  accentColor,
  children,
}: {
  number: string;
  title: string;
  accentColor: "teal" | "amber";
  children: ReactNode;
}) {
  const accent =
    accentColor === "teal"
      ? "text-[var(--wardle-color-teal)]"
      : "text-[var(--wardle-color-amber)]";

  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-2.5">
        <span
          className={`font-brand-mono text-[9px] font-black tracking-[0.2em] ${accent} opacity-55`}
        >
          {number}
        </span>
        <h2 className="font-brand-mono text-[10px] font-bold uppercase tracking-[0.18em] text-white/50">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function ResponsiveSection({
  number,
  title,
  tone,
  mobile,
  children,
}: {
  number: string;
  title: string;
  tone: "teal" | "amber";
  mobile: boolean;
  children: ReactNode;
}) {
  if (mobile) {
    return (
      <MobileSection number={number} title={title} accentColor={tone}>
        {children}
      </MobileSection>
    );
  }

  return (
    <ReviewSection title={title} tone={tone}>
      {children}
    </ReviewSection>
  );
}

export function CaseTab({
  clues,
  explanation,
  mobile = false,
}: {
  clues: ClinicalClue[];
  explanation: StructuredExplanation;
  mobile?: boolean;
}) {
  return (
    <div className="min-w-0 space-y-6">
      <ResponsiveSection
        number="01"
        title="Evidence Trail"
        tone="amber"
        mobile={mobile}
      >
        <EvidenceTrail clues={clues} />
      </ResponsiveSection>

      <ResponsiveSection
        number="02"
        title="Reasoning Path"
        tone="amber"
        mobile={mobile}
      >
        <ReasoningPath explanation={explanation} />
      </ResponsiveSection>

      <ResponsiveSection
        number="03"
        title="What Pointed To This"
        tone="amber"
        mobile={mobile}
      >
        <KeyEvidence explanation={explanation} />
      </ResponsiveSection>
    </div>
  );
}

function EvidenceTrail({ clues }: { clues: ClinicalClue[] }) {
  const sorted = [...clues].sort((a, b) => a.order - b.order);

  if (!sorted.length) {
    return <InlineNotice tone="muted" copy="No clue trail was stored." />;
  }

  return (
    <div className="space-y-2">
      {sorted.map((clue, index) => {
        const typeCopy = CLUE_TYPE_COPY[clue.type];
        const isFinal = index === sorted.length - 1;
        const strength = index / Math.max(sorted.length - 1, 1);
        const bg =
          strength > 0.65
            ? "bg-amber-400/[0.055] border-amber-400/[0.16]"
            : strength > 0.35
              ? "bg-white/[0.035] border-white/[0.07]"
              : "bg-white/[0.022] border-white/[0.05]";

        return (
          <div
            key={clue.id}
            className={`flex min-w-0 gap-3 rounded-[13px] border px-4 py-3 ${bg}`}
          >
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border text-[10px] font-black ${typeCopy.tone}`}
            >
              {typeCopy.abbr}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <p className="font-brand-mono text-[10px] font-bold uppercase tracking-[0.14em] text-white/32">
                  Clue {index + 1} · {typeCopy.label}
                </p>
                {isFinal ? (
                  <span className="rounded-full border border-amber-300/[0.2] bg-amber-400/[0.09] px-2 py-0.5 font-brand-mono text-[9px] font-bold uppercase tracking-[0.12em] text-amber-200/80">
                    Sealed it
                  </span>
                ) : null}
              </div>
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

function ReasoningPath({
  explanation,
}: {
  explanation: StructuredExplanation;
}) {
  if (!explanation?.reasoning) {
    return (
      <InlineNotice tone="muted" copy="Reasoning is still being prepared." />
    );
  }

  const steps = splitReasoning(explanation.reasoning);

  return (
    <div className="overflow-hidden rounded-[14px] border border-amber-400/[0.12] bg-amber-400/[0.035]">
      {steps.map((step, index) => (
        <div
          key={`${index}-${step}`}
          className={`flex min-w-0 gap-3 px-4 py-3 ${
            index < steps.length - 1 ? "border-b border-white/[0.05]" : ""
          }`}
        >
          <span className="mt-[1px] flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] bg-amber-400/[0.12] font-brand-mono text-[10px] font-black text-amber-200/80">
            {index + 1}
          </span>
          <p className="min-w-0 break-words text-sm leading-6 text-white/64">
            {step}
          </p>
        </div>
      ))}
    </div>
  );
}

function KeyEvidence({ explanation }: { explanation: StructuredExplanation }) {
  if (!explanation?.keyFindings?.length) {
    return <InlineNotice tone="muted" copy="No key findings recorded." />;
  }

  return (
    <ul className="flex flex-wrap gap-2">
      {explanation.keyFindings.map((finding) => (
        <li
          key={finding}
          className="min-w-0 max-w-full rounded-[13px] border border-amber-400/[0.14] bg-amber-400/[0.045] px-3 py-2 text-sm leading-6 text-white/64"
        >
          {finding}
        </li>
      ))}
    </ul>
  );
}

export function DiagnosisTab({
  educationState,
  mobile = false,
}: {
  educationState: EducationState;
  mobile?: boolean;
}) {
  const { education, loading, error, enabled } = educationState;

  if (loading) {
    return <InlineNotice tone="muted" copy="Loading diagnosis teaching..." />;
  }

  if (!enabled || error || !education) {
    return (
      <InlineNotice
        tone="muted"
        copy="Reviewed diagnosis teaching is not available yet."
      />
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      <IllnessScriptSection education={education} mobile={mobile} />
      <ExamPearlsSection education={education} mobile={mobile} />
      <WorkupAnchorsSection education={education} mobile={mobile} />
      <DontMissSection education={education} mobile={mobile} />
      <ManagementSnapshotSection education={education} mobile={mobile} />
    </div>
  );
}

function IllnessScriptSection({
  education,
  mobile,
}: {
  education: DiagnosisEducation;
  mobile: boolean;
}) {
  const { definition, takeaway } = getEducationSummary(education);

  return (
    <ResponsiveSection
      number="01"
      title="Illness Script"
      tone="teal"
      mobile={mobile}
    >
      <div className="space-y-3">
        {(definition || takeaway) && (
          <div className="rounded-[13px] border border-[rgba(0,180,166,0.12)] bg-[rgba(0,180,166,0.045)] px-4 py-3">
            {definition ? (
              <p className="break-words text-sm leading-6 text-white/64">
                {definition}
              </p>
            ) : null}
            {takeaway ? (
              <p className="mt-2 break-words font-brand-mono text-[11px] leading-5 text-[var(--wardle-color-teal)]/74">
                {takeaway}
              </p>
            ) : null}
          </div>
        )}
        <EducationBulletList items={education.recognitionPattern} />
      </div>
    </ResponsiveSection>
  );
}

function ExamPearlsSection({
  education,
  mobile,
}: {
  education: DiagnosisEducation;
  mobile: boolean;
}) {
  return (
    <ResponsiveSection
      number="02"
      title="Exam Pearls"
      tone="teal"
      mobile={mobile}
    >
      <div className="space-y-2">
        <EducationPearlList pearls={education.examPearls} />
        <EducationBulletList items={education.keySigns} />
      </div>
    </ResponsiveSection>
  );
}

function WorkupAnchorsSection({
  education,
  mobile,
}: {
  education: DiagnosisEducation;
  mobile: boolean;
}) {
  return (
    <ResponsiveSection
      number="03"
      title="Work-Up Anchors"
      tone="teal"
      mobile={mobile}
    >
      <EducationBulletList items={education.investigations} />
    </ResponsiveSection>
  );
}

function DontMissSection({
  education,
  mobile,
}: {
  education: DiagnosisEducation;
  mobile: boolean;
}) {
  return (
    <ResponsiveSection
      number="04"
      title="Don't Miss"
      tone="amber"
      mobile={mobile}
    >
      <EducationBulletList items={education.pitfalls} warning />
    </ResponsiveSection>
  );
}

function ManagementSnapshotSection({
  education,
  mobile,
}: {
  education: DiagnosisEducation;
  mobile: boolean;
}) {
  return (
    <ResponsiveSection
      number="05"
      title="Management Snapshot"
      tone="teal"
      mobile={mobile}
    >
      <EducationBulletList items={education.managementOverview} secondary />
    </ResponsiveSection>
  );
}

export function CompareTab({
  explanation,
  education,
  loading,
  mobile = false,
}: {
  explanation: StructuredExplanation;
  education: DiagnosisEducation | null;
  loading: boolean;
  mobile?: boolean;
}) {
  const items = buildCompareItems({
    caseDifferentials: explanation?.differentials ?? [],
    education,
  });

  return (
    <div className="min-w-0 space-y-6">
      <ResponsiveSection
        number="01"
        title="Why Not The Alternatives?"
        tone="amber"
        mobile={mobile}
      >
        {loading && !items.length ? (
          <InlineNotice tone="muted" copy="Loading reviewed distinguishers..." />
        ) : (
          <CompareDifferentialsList items={items} />
        )}
      </ResponsiveSection>
    </div>
  );
}

function CompareDifferentialsList({ items }: { items: CompareItem[] }) {
  if (!items.length) {
    return (
      <InlineNotice
        tone="muted"
        copy="No differentials or reviewed distinguishers were recorded."
      />
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div
          key={normalizeDiagnosisName(item.name)}
          className="rounded-[14px] border border-white/[0.06] bg-white/[0.025] px-4 py-3"
        >
          <div className="flex min-w-0 items-start justify-between gap-3">
            <p className="min-w-0 break-words text-sm font-bold text-[var(--wardle-color-mint)]">
              {item.name}
            </p>
            <span className="shrink-0 rounded-full border border-rose-400/[0.18] bg-rose-400/[0.08] px-2.5 py-1 font-brand-mono text-[10px] font-bold uppercase tracking-[0.12em] text-rose-300">
              Ruled out
            </span>
          </div>

          {item.casePoint || item.generalPoint ? (
            <div className="mt-3 space-y-2">
              {item.casePoint ? (
                <ComparisonPoint label="In this case" tone="amber">
                  {item.casePoint}
                </ComparisonPoint>
              ) : null}
              {item.generalPoint ? (
                <ComparisonPoint label="In general" tone="teal">
                  {item.generalPoint}
                </ComparisonPoint>
              ) : null}
            </div>
          ) : (
            <p className="mt-2 text-sm leading-6 text-white/44">
              Stored as a ruled-out alternative for this case.
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function ComparisonPoint({
  label,
  tone,
  children,
}: {
  label: string;
  tone: "teal" | "amber";
  children: ReactNode;
}) {
  const labelClass =
    tone === "teal"
      ? "text-[var(--wardle-color-teal)]/70"
      : "text-[var(--wardle-color-amber)]/75";

  return (
    <div>
      <p
        className={`font-brand-mono text-[9px] font-bold uppercase tracking-[0.14em] ${labelClass}`}
      >
        {label}
      </p>
      <p className="mt-1 break-words text-sm leading-6 text-white/58">
        {children}
      </p>
    </div>
  );
}

function EducationBulletList({
  items,
  warning = false,
  secondary = false,
}: {
  items?: string[] | null;
  warning?: boolean;
  secondary?: boolean;
}) {
  if (!items?.length) {
    return <InlineNotice tone="muted" copy="No reviewed notes yet." />;
  }

  const cardClass = warning
    ? "border-amber-300/[0.14] bg-amber-400/[0.045]"
    : secondary
      ? "border-white/[0.05] bg-white/[0.018]"
      : "border-[rgba(0,180,166,0.1)] bg-[rgba(0,180,166,0.03)]";
  const dotClass = warning
    ? "bg-rose-300/65"
    : "bg-[var(--wardle-color-teal)]/55";

  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li
          key={item}
          className={`flex min-w-0 gap-3 rounded-[13px] border px-4 py-3 ${cardClass}`}
        >
          <span
            className={`mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`}
          />
          <span className="min-w-0 break-words text-sm leading-6 text-white/64">
            {item}
          </span>
        </li>
      ))}
    </ul>
  );
}

function EducationPearlList({
  pearls,
}: {
  pearls?: DiagnosisEducation["examPearls"];
}) {
  if (!pearls?.length) {
    return <InlineNotice tone="muted" copy="No reviewed exam pearls yet." />;
  }

  return (
    <div className="space-y-1.5">
      {pearls.map((pearl) => {
        const label = typeof pearl === "string" ? pearl : pearl.label;
        const explanation =
          typeof pearl === "string" ? undefined : pearl.explanation;

        if (!label && !explanation) return null;

        return (
          <div
            key={`${label ?? ""}-${explanation ?? ""}`}
            className="rounded-[13px] border border-[rgba(0,180,166,0.12)] bg-[rgba(0,180,166,0.04)] px-4 py-3"
          >
            {label ? (
              <p className="break-words text-sm font-bold text-[var(--wardle-color-teal)]/86">
                {label}
              </p>
            ) : null}
            {explanation ? (
              <p className="mt-1 break-words text-sm leading-6 text-white/58">
                {explanation}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function DesktopCaseMeta({ item }: { item: LearnLibraryCase }) {
  return (
    <div className="rounded-[12px] border border-white/[0.06] bg-white/[0.02] px-3 py-3">
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <TrackBadge track={item.track} />
        <DifficultyBadge difficulty={item.case.difficulty} />
      </div>
      <p className="mt-2 font-brand-mono text-[10px] text-white/30">
        {formatArchiveCaseLabel(item)}
      </p>
      <p className="mt-1 font-brand-mono text-[10px] text-white/24">
        {item.case.date || item.completedAt.slice(0, 10)}
      </p>
    </div>
  );
}

export function AttemptSummary({ item }: { item: LearnLibraryCase }) {
  const pips = buildAttemptPips(item.playerResult);

  return (
    <div className="rounded-[12px] border border-white/[0.06] bg-white/[0.025] px-3 py-3">
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
