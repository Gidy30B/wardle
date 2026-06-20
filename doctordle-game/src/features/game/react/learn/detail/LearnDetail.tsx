import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import SurfaceCard from "../../../../../components/ui/SurfaceCard";
import { coerceStructuredExplanation } from "../../../gameExplanation";
import type {
  ClinicalClue,
  DiagnosisEducation,
  LearnLibraryCase,
  TypedEducationPearl,
} from "../../../game.types";
import { useDiagnosisEducation } from "../../../useDiagnosisEducation";
import type { DetailTab } from "../learn.types";
import {
  buildAttemptPips,
  formatStudyTime,
  getCaseDiagnosisLabel,
  getCaseSpecialty,
  splitReasoning,
} from "../domain/learnDomain";
import {
  buildTeachingObjects,
  type ClassicSign,
  type DifferentialCard as TeachingDifferentialCard,
  type InvestigationCard as TeachingInvestigationCard,
  type ManagementCard as TeachingManagementCard,
  type MnemonicCard as TeachingMnemonicCard,
  type ScoringSystemCard as TeachingScoringSystemCard,
} from "./domain/teachingObjects";
import { InlineNotice } from "../archive/shared";
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
  status: "ruled out" | "competing early" | "less likely";
  hasStructuredReasoning: boolean;
  casePoint?: string;
  ruleOuts?: Array<{
    clueOrder: number;
    evidence: string;
    reason: string;
  }>;
  finalReasonLessLikely?: string;
  whyConfused?: string;
  generalPoint?: string;
  keySeparator?: string;
  classicTrap?: string;
};

type InsightDetail = {
  kind:
    | "flow"
    | "separates"
    | "trap"
    | "interpret"
    | "mechanism"
    | "safer"
    | "urgency";
  text: string;
};

type NormalizedEducationCard = {
  eyebrow?: string;
  title?: string;
  body: string;
  details: InsightDetail[];
};

const DETAIL_TABS: Array<{ id: DetailTab; label: string }> = [
  { id: "case", label: "Breakdown" },
  { id: "compare", label: "Differentials" },
  { id: "diagnosis", label: "Key Facts" },
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeDisplayText(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isSameDisplayText(
  left: string | null | undefined,
  right: string | null | undefined,
) {
  const normalizedLeft = normalizeDisplayText(left);
  const normalizedRight = normalizeDisplayText(right);

  return Boolean(normalizedLeft && normalizedLeft === normalizedRight);
}

function firstDistinctString(
  candidates: Array<string | null | undefined>,
  distinctFrom: Array<string | null | undefined>,
) {
  return (
    candidates.find(
      (candidate) =>
        candidate &&
        !distinctFrom.some((existing) => isSameDisplayText(candidate, existing)),
    ) ?? null
  );
}

function compactInsightDetails(
  details: Array<InsightDetail | null>,
  visibleText: Array<string | null | undefined>,
) {
  const seen = new Set<string>();

  return details.filter((detail): detail is InsightDetail => {
    if (!detail?.text) return false;

    if (visibleText.some((text) => isSameDisplayText(detail.text, text))) {
      return false;
    }

    const normalized = `${detail.kind}:${normalizeDisplayText(detail.text)}`;
    if (seen.has(normalized)) return false;

    seen.add(normalized);
    return true;
  });
}

function isTypedPearl(value: unknown): value is TypedEducationPearl {
  return (
    isRecord(value) &&
    typeof value.type === "string" &&
    typeof value.content === "string" &&
    value.content.trim().length > 0
  );
}

function pearlTypeLabel(type: string) {
  return type
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
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
  differentialAnalysis,
  educationDifferentials,
}: {
  caseDifferentials: string[];
  differentialAnalysis: NonNullable<StructuredExplanation>["differentialAnalysis"];
  educationDifferentials: TeachingDifferentialCard[];
}): CompareItem[] {
  const items: CompareItem[] = [];
  const indexByName = new Map<string, number>();
  const analysisByName = new Map(
    differentialAnalysis.map((analysis) => [
      normalizeDiagnosisName(analysis.diagnosis),
      analysis,
    ]),
  );

  caseDifferentials.forEach((name) => {
    const normalized = normalizeDiagnosisName(name);
    if (!normalized || indexByName.has(normalized)) return;
    const analysis = analysisByName.get(normalized);
    indexByName.set(normalized, items.length);
    items.push({
      name,
      status: analysis?.ruledOutByClues.length ? "ruled out" : "less likely",
      hasStructuredReasoning: analysis !== undefined,
      casePoint: analysis?.whyPlausibleEarly,
      ruleOuts: analysis?.ruledOutByClues,
      finalReasonLessLikely: analysis?.finalReasonLessLikely,
    });
  });

  differentialAnalysis.forEach((analysis) => {
    const normalized = normalizeDiagnosisName(analysis.diagnosis);
    if (!normalized || indexByName.has(normalized)) return;
    indexByName.set(normalized, items.length);
    items.push({
      name: analysis.diagnosis,
      status: analysis.ruledOutByClues.length ? "ruled out" : "less likely",
      hasStructuredReasoning: true,
      casePoint: analysis.whyPlausibleEarly,
      ruleOuts: analysis.ruledOutByClues,
      finalReasonLessLikely: analysis.finalReasonLessLikely,
    });
  });

  educationDifferentials.forEach((entry) => {
    const normalized = normalizeDiagnosisName(entry.diagnosis);
    if (!normalized) return;

    const existingIndex = indexByName.get(normalized);
    if (existingIndex !== undefined) {
      items[existingIndex] = {
        ...items[existingIndex],
        whyConfused: entry.whyConfused ?? items[existingIndex].whyConfused,
        generalPoint: entry.keySeparator ?? items[existingIndex].generalPoint,
        keySeparator: entry.keySeparator ?? items[existingIndex].keySeparator,
        classicTrap: entry.classicTrap ?? items[existingIndex].classicTrap,
      };
      return;
    }

    indexByName.set(normalized, items.length);
    items.push({
      name: entry.diagnosis,
      status: entry.whyConfused ? "competing early" : "less likely",
      hasStructuredReasoning: false,
      whyConfused: entry.whyConfused,
      generalPoint: entry.keySeparator,
      keySeparator: entry.keySeparator,
      classicTrap: entry.classicTrap,
    });
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
  showDesktopTabs = true,
}: {
  className?: string;
  item: LearnLibraryCase | null;
  activeTab: DetailTab;
  onChangeTab: (tab: DetailTab) => void;
  onBack: () => void;
  showDesktopTabs?: boolean;
}) {
  const diagnosisRegistryId = item ? getDiagnosisRegistryId(item) : null;
  const educationState = useDiagnosisEducation(diagnosisRegistryId);

  if (!item) return null;

  const explanation = coerceStructuredExplanation(item.case.explanation ?? {});
  const diagnosis = getCaseDiagnosisLabel(item);

  return (
    <SurfaceCard
      className={`min-w-0 max-w-full overflow-visible ${className ?? ""}`}
    >
      <div className={`min-w-0 ${showDesktopTabs ? "space-y-5" : ""}`}>
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

        {showDesktopTabs ? (
          <div className="sticky top-[82px] z-30 -mx-4 -mt-4 rounded-t-[24px] rounded-b-[18px] border border-white/[0.08] bg-[var(--wardle-surface-sticky-solid)] px-4 py-3 shadow-[0_16px_36px_rgba(0,0,0,0.24)] md:-mx-5 md:-mt-5 md:px-5 lg:-mx-6 lg:-mt-6 lg:px-6">
            <div className="flex min-w-0 flex-col gap-2 min-[760px]:flex-row min-[760px]:items-center min-[760px]:justify-between">
              <div className="min-w-0 flex-1">
                <LearnDetailTabSwitcher
                  activeTab={activeTab}
                  onChangeTab={onChangeTab}
                />
              </div>
              <DesktopAttemptBadge item={item} />
            </div>
          </div>
        ) : null}

        {showDesktopTabs ? (
          <LearningHeader
            diagnosis={diagnosis}
            explanation={explanation}
            showEyebrow={false}
          />
        ) : (
          <div className="border-b border-white/[0.05] bg-white/[0.015] px-6 py-5 lg:px-[30px] lg:pb-[18px] lg:pt-6">
            <LearningHeader
              diagnosis={diagnosis}
              explanation={explanation}
              showEyebrow={false}
            />
          </div>
        )}

        <div
          className={`min-w-0 ${
            showDesktopTabs ? "" : "px-6 pb-9 pt-6 lg:px-[30px] lg:pb-9"
          }`}
        >
          <LearnDetailTabContent
            activeTab={activeTab}
            item={item}
            explanation={explanation}
            educationState={educationState}
          />
        </div>
      </div>
    </SurfaceCard>
  );
}

function LearningHeader({
  diagnosis,
  explanation,
  showEyebrow = true,
}: {
  diagnosis: string;
  explanation: StructuredExplanation;
  showEyebrow?: boolean;
}) {
  return (
    <header className="min-w-0 space-y-2">
      {showEyebrow ? (
        <p className="font-brand-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--wardle-color-teal)]/55">
          Diagnosis
        </p>
      ) : null}
      <h1 className="break-words text-[22px] font-black leading-[1.15] tracking-tight text-[var(--wardle-color-mint)] lg:text-3xl">
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
}: {
  activeTab: DetailTab;
  onChangeTab: (tab: DetailTab) => void;
  mobile?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-[18px] bg-white/[0.05] p-1">
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
      <BreakdownTab
        clues={item.case.clues}
        explanation={explanation}
        educationState={educationState}
        mobile={mobile}
      />
    );
  }

  if (activeTab === "diagnosis") {
    return (
      <DiagnosisTab
        educationState={educationState}
        mobile={mobile}
      />
    );
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

export function BreakdownTab({
  clues,
  explanation,
  educationState,
  mobile = false,
}: {
  clues: ClinicalClue[];
  explanation: StructuredExplanation;
  educationState: EducationState;
  mobile?: boolean;
}) {
  const teachingObjects = useMemo(
    () =>
      educationState.education
        ? buildTeachingObjects(educationState.education)
        : null,
    [educationState.education],
  );
  const patternFacts = teachingObjects?.highYieldFacts
    .filter((fact) => fact.sourceSection === "summary" || fact.sourceSection === "clinicalPattern")
    .slice(0, 3);

  return (
    <div className="min-w-0 space-y-5">
      <ResponsiveSection
        number="01"
        title="Diagnostic Reasoning"
        tone="amber"
        mobile={mobile}
      >
        <ReasoningFlowCard clues={clues} explanation={explanation} />
      </ResponsiveSection>

      {patternFacts?.length ? (
        <ResponsiveSection
          number="02"
          title="Clinical Pattern"
          tone="teal"
          mobile={mobile}
        >
          <CompactCardGrid>
            {patternFacts.map((fact) => (
              <EducationCompactCard
                key={fact.id}
                eyebrow={fact.label}
                title={fact.sourceSection === "summary" ? "Remember" : undefined}
                body={fact.value}
                tone="teal"
              />
            ))}
          </CompactCardGrid>
        </ResponsiveSection>
      ) : null}

      <ResponsiveSection
        number={patternFacts?.length ? "03" : "02"}
        title="What Pointed To This"
        tone="amber"
        mobile={mobile}
      >
        <KeyEvidence explanation={explanation} />
      </ResponsiveSection>

    </div>
  );
}

function ReasoningFlowCard({
  clues,
  explanation,
}: {
  clues: ClinicalClue[];
  explanation: StructuredExplanation;
}) {
  const reasoningSteps = explanation?.reasoning
    ? splitReasoning(explanation.reasoning).slice(0, 4)
    : [];
  const keyFindings = explanation?.keyFindings ?? [];
  const sortedClues = [...clues].sort((a, b) => a.order - b.order);
  const visibleRows = (keyFindings.length ? keyFindings : sortedClues.map((clue) => clue.value))
    .slice(0, 4)
    .map((finding, index) => ({
      clue: sortedClues[index]?.value ?? `Finding ${index + 1}`,
      meaning: reasoningSteps[index] ?? finding,
    }));

  if (!visibleRows.length && !reasoningSteps.length) {
    return (
      <InlineNotice tone="muted" copy="Diagnostic reasoning is still being prepared." />
    );
  }

  return (
    <article className="overflow-hidden rounded-[16px] border border-amber-300/[0.14] bg-amber-400/[0.045]">
      <div className="border-b border-white/[0.05] px-4 py-3">
        <p className="font-brand-mono text-[9px] font-black uppercase tracking-[0.16em] text-amber-200/65">
          Reasoning
        </p>
        <p className="mt-1 text-sm leading-6 text-white/64">
          The strongest clues form a pattern rather than a single giveaway.
        </p>
      </div>
      <div className="divide-y divide-white/[0.05]">
        {visibleRows.map((row, index) => (
          <div
            key={`${index}-${row.clue}-${row.meaning}`}
            className="grid gap-2 px-4 py-3 min-[560px]:grid-cols-[0.75fr_minmax(0,1fr)]"
          >
            <div className="min-w-0">
              <p className="font-brand-mono text-[8px] font-black uppercase tracking-[0.14em] text-white/28">
                Clue
              </p>
              <p className="mt-1 break-words text-[13px] leading-5 text-white/58">
                {row.clue}
              </p>
            </div>
            <div className="min-w-0">
              <p className="font-brand-mono text-[8px] font-black uppercase tracking-[0.14em] text-amber-200/55">
                Meaning
              </p>
              <p className="mt-1 break-words text-[13px] font-semibold leading-5 text-white/72">
                {row.meaning}
              </p>
            </div>
          </div>
        ))}
      </div>
      {reasoningSteps.length > visibleRows.length ? (
        <details className="border-t border-white/[0.05] px-4 py-3">
          <summary className="cursor-pointer list-none font-brand-mono text-[9px] font-bold uppercase tracking-[0.14em] text-white/34">
            More reasoning
          </summary>
          <div className="mt-2 space-y-2">
            {reasoningSteps.slice(visibleRows.length).map((step) => (
              <p key={step} className="break-words text-sm leading-6 text-white/52">
                {step}
              </p>
            ))}
          </div>
        </details>
      ) : null}
    </article>
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

function CompactCardGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-2 min-[560px]:grid-cols-2">{children}</div>;
}

function EducationCompactCard({
  eyebrow,
  title,
  body,
  tone,
}: {
  eyebrow: string;
  title?: string;
  body: string;
  tone: "teal" | "amber" | "muted";
}) {
  const toneClass =
    tone === "amber"
      ? "border-amber-300/[0.16] bg-amber-400/[0.055]"
      : tone === "teal"
        ? "border-[var(--wardle-color-teal)]/14 bg-[var(--wardle-color-teal)]/[0.038]"
        : "border-white/[0.06] bg-white/[0.025]";
  const eyebrowClass =
    tone === "amber"
      ? "text-amber-200/70"
      : tone === "teal"
        ? "text-[var(--wardle-color-teal)]/62"
        : "text-white/32";

  return (
    <article className={`min-w-0 rounded-[15px] border px-4 py-3 ${toneClass}`}>
      <p className={`font-brand-mono text-[9px] font-black uppercase tracking-[0.16em] ${eyebrowClass}`}>
        {eyebrow}
      </p>
      {title ? (
        <h3 className="mt-1 break-words text-sm font-extrabold leading-snug text-[var(--wardle-color-mint)]">
          {title}
        </h3>
      ) : null}
      {!isSameDisplayText(title, body) ? (
        <p className="mt-1 break-words text-sm leading-6 text-white/62">
          {body}
        </p>
      ) : null}
    </article>
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
  const teachingObjects = useMemo(
    () => (education ? buildTeachingObjects(education) : null),
    [education],
  );
  const classicPatternCards = useMemo(
    () =>
      normalizeEducationCards(education?.recognitionPattern, {
        fallbackEyebrow: "pattern",
      })
        .filter((card) => card.eyebrow?.toLowerCase() !== "mnemonic")
        .slice(0, 3),
    [education?.recognitionPattern],
  );
  const recallPrompts = normalizeRecallPracticePrompts(
    education?.recallPrompts,
  ).slice(0, 5);
  const recallPractice = (
    <RecallPracticeSection
      prompts={recallPrompts}
      mobile={mobile}
    />
  );

  if (loading) {
    return (
      <div className="min-w-0 space-y-5">
        <InlineNotice tone="muted" copy="Loading diagnosis teaching..." />
        {recallPractice}
      </div>
    );
  }

  if (!enabled || error || !education || !teachingObjects) {
    return (
      <div className="min-w-0 space-y-5">
        <InlineNotice
          tone="muted"
          copy="Reviewed diagnosis teaching is not available yet."
        />
        {recallPractice}
      </div>
    );
  }

  const pitfallCards = normalizeEducationCards(education.pitfalls, {
    fallbackEyebrow: "pitfall",
  }).slice(0, 3);
  const { definition, takeaway } = getEducationSummary(education);
  const hasAnyKeyFacts =
    definition ||
    takeaway ||
    classicPatternCards.length ||
    teachingObjects.classicSigns.length ||
    teachingObjects.investigations.length ||
    teachingObjects.management.length ||
    pitfallCards.length ||
    teachingObjects.mnemonics.length ||
    teachingObjects.scoringSystems.length ||
    teachingObjects.references.length;

  if (!hasAnyKeyFacts) {
    return (
      <div className="min-w-0 space-y-5">
        <InlineNotice
          tone="muted"
          copy="Reviewed key facts are not available yet."
        />
        {recallPractice}
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-5">
      <DefinitionSection education={education} mobile={mobile} />
      {classicPatternCards.length ? (
        <ClassicPatternSection cards={classicPatternCards} mobile={mobile} />
      ) : null}
      {teachingObjects.classicSigns.length ? (
        <ExamPearlsSection
          classicSigns={teachingObjects.classicSigns.slice(0, 4)}
          mobile={mobile}
        />
      ) : null}
      {teachingObjects.investigations.length ? (
        <WorkupAnchorsSection
          investigations={teachingObjects.investigations.slice(0, 4)}
          mobile={mobile}
        />
      ) : null}
      {teachingObjects.management.length ? (
        <ManagementSnapshotSection
          management={teachingObjects.management.slice(0, 4)}
          mobile={mobile}
        />
      ) : null}
      {pitfallCards.length ? (
        <DontMissSection cards={pitfallCards} mobile={mobile} />
      ) : null}
      {teachingObjects.mnemonics.length ? (
        <MnemonicsSection
          mnemonics={teachingObjects.mnemonics.slice(0, 3)}
          mobile={mobile}
        />
      ) : null}
      {teachingObjects.scoringSystems.length ? (
        <ScoresSection
          scoringSystems={teachingObjects.scoringSystems.slice(0, 3)}
          mobile={mobile}
        />
      ) : null}
      <ReferencesSection references={teachingObjects.references} mobile={mobile} />
      {recallPractice}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// RECALL PRACTICE — flashcard-style self-review
//
// One prompt in focus at a time, with a tappable dot-progress row and a
// self-grade step (Got it / Missed it) after revealing the answer. This
// replaces the old flat list of always-expandable Q/A rows: that version
// read like a printed quiz sheet, this one behaves like an actual recall
// drill and gives a sense of progress through the set.
//
// No review-state plumbing here — this section only renders the prompts
// (or an empty-state notice). Grades are local UI state, not persisted;
// see note at the end of this block if that needs to change.
// ─────────────────────────────────────────────────────────────────────────

type RecallPracticePrompt = {
  id: string;
  prompt: string;
  answer: string | null;
};

type CardGrade = "got-it" | "missed" | null;

function RecallPracticeSection({
  prompts,
  mobile,
}: {
  prompts: RecallPracticePrompt[];
  mobile: boolean;
}) {
  const hasPrompts = prompts.length > 0;

  return (
    <ResponsiveSection
      number="10"
      title="Recall Practice"
      tone="teal"
      mobile={mobile}
    >
      <article className="min-w-0 rounded-[15px] border border-[var(--wardle-color-teal)]/14 bg-[var(--wardle-color-teal)]/[0.038] px-4 py-3.5">
        {hasPrompts ? (
          <FlashcardDeck prompts={prompts} />
        ) : (
          <div className="rounded-[13px] border border-white/[0.06] bg-white/[0.025] px-3 py-3">
            <p className="break-words text-sm leading-6 text-white/48">
              No recall questions have been added for this diagnosis yet.
            </p>
          </div>
        )}
      </article>
    </ResponsiveSection>
  );
}

function FlashcardDeck({ prompts }: { prompts: RecallPracticePrompt[] }) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [grades, setGrades] = useState<Record<string, CardGrade>>({});

  const total = prompts.length;
  const current = prompts[index];
  const isLast = index === total - 1;
  const doneCount = Object.values(grades).filter(Boolean).length;
  const allGraded = doneCount === total;

  function goTo(nextIndex: number) {
    setIndex(Math.max(0, Math.min(total - 1, nextIndex)));
    setRevealed(false);
  }

  function grade(value: CardGrade) {
    if (!current) return;
    setGrades((prev) => ({ ...prev, [current.id]: value }));
    if (!isLast) {
      window.setTimeout(() => goTo(index + 1), 150);
    }
  }

  function restart() {
    setGrades({});
    goTo(0);
  }

  if (!current) return null;

  return (
    <div className="min-w-0">
      <p className="mb-3 break-words text-sm leading-6 text-white/58">
        Quick questions to test the key teaching points.
      </p>

      <DeckProgress
        total={total}
        index={index}
        grades={grades}
        promptIds={prompts.map((p) => p.id)}
        onJump={goTo}
      />

      <article
        key={current.id}
        className="mt-3 rounded-[13px] border border-[rgba(0,180,166,0.13)] bg-[#121827]/72 px-4 py-4"
      >
        <p className="font-brand-mono text-[9px] font-black uppercase tracking-[0.14em] text-[var(--wardle-color-teal)]/65">
          Question {index + 1} of {total}
        </p>
        <p className="mt-2 break-words text-[15px] font-semibold leading-6 text-white/82">
          {current.prompt}
        </p>

        {revealed && current.answer ? (
          <div className="mt-3 rounded-[10px] border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
            <p className="font-brand-mono text-[9px] font-black uppercase tracking-[0.12em] text-white/34">
              Answer
            </p>
            <p className="mt-1 break-words text-[13px] leading-5 text-white/62">
              {current.answer}
            </p>
          </div>
        ) : null}

        <div className="mt-3.5">
          {!revealed ? (
            <button
              type="button"
              onClick={() => setRevealed(true)}
              disabled={!current.answer}
              className="flex w-full items-center justify-center rounded-[11px] border border-[rgba(0,180,166,0.24)] bg-[rgba(0,180,166,0.1)] px-4 py-2.5 text-sm font-black text-[var(--wardle-color-teal)] transition active:scale-[0.98] disabled:opacity-40"
            >
              {current.answer ? "Reveal answer" : "No answer recorded"}
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => grade("missed")}
                className="flex items-center justify-center rounded-[11px] border border-rose-400/[0.22] bg-rose-400/[0.07] px-3 py-2.5 text-sm font-black text-rose-300/85 transition active:scale-[0.98]"
              >
                Missed it
              </button>
              <button
                type="button"
                onClick={() => grade("got-it")}
                className="flex items-center justify-center rounded-[11px] border border-[rgba(0,180,166,0.28)] bg-[rgba(0,180,166,0.12)] px-3 py-2.5 text-sm font-black text-[var(--wardle-color-teal)] transition active:scale-[0.98]"
              >
                Got it
              </button>
            </div>
          )}
        </div>
      </article>

      <div className="mt-2.5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => goTo(index - 1)}
          disabled={index === 0}
          className="font-brand-mono text-[10px] font-bold uppercase tracking-[0.12em] text-white/32 transition hover:text-white/55 disabled:opacity-30 disabled:hover:text-white/32"
        >
          ‹ Previous
        </button>

        {allGraded ? (
          <DeckSummary grades={grades} onRestart={restart} />
        ) : (
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            disabled={isLast}
            className="font-brand-mono text-[10px] font-bold uppercase tracking-[0.12em] text-white/32 transition hover:text-white/55 disabled:opacity-30 disabled:hover:text-white/32"
          >
            Skip ›
          </button>
        )}
      </div>
    </div>
  );
}

function DeckProgress({
  total,
  index,
  grades,
  promptIds,
  onJump,
}: {
  total: number;
  index: number;
  grades: Record<string, CardGrade>;
  promptIds: string[];
  onJump: (index: number) => void;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      {promptIds.map((id, i) => {
        const grade = grades[id];
        const isActive = i === index;
        const dotClass = isActive
          ? "bg-[var(--wardle-color-teal)] scale-125"
          : grade === "got-it"
            ? "bg-[var(--wardle-color-teal)]/55"
            : grade === "missed"
              ? "bg-rose-400/55"
              : "bg-white/[0.12]";

        return (
          <button
            key={id}
            type="button"
            onClick={() => onJump(i)}
            aria-label={`Go to question ${i + 1} of ${total}`}
            aria-current={isActive}
            className="flex h-5 flex-1 items-center justify-center"
          >
            <span
              className={`h-1.5 w-full rounded-full transition-all duration-150 ${dotClass}`}
            />
          </button>
        );
      })}
    </div>
  );
}

function DeckSummary({
  grades,
  onRestart,
}: {
  grades: Record<string, CardGrade>;
  onRestart: () => void;
}) {
  const values = Object.values(grades);
  const gotItCount = values.filter((g) => g === "got-it").length;

  return (
    <div className="flex items-center gap-2.5">
      <span className="font-brand-mono text-[10px] font-bold uppercase tracking-[0.12em] text-white/40">
        {gotItCount}/{values.length} solid
      </span>
      <button
        type="button"
        onClick={onRestart}
        className="font-brand-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--wardle-color-teal)]/75 transition hover:text-[var(--wardle-color-teal)]"
      >
        Restart ↺
      </button>
    </div>
  );
}

function normalizeRecallPracticePrompts(value: unknown): RecallPracticePrompt[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index) => {
      const prompt =
        typeof item === "string"
          ? item.trim()
          : getRecallPracticePromptString(item, "prompt") ??
            getRecallPracticePromptString(item, "question") ??
            getRecallPracticePromptString(item, "text") ??
            "";

      if (!prompt) return null;

      const answer =
        typeof item === "string"
          ? null
          : getRecallPracticePromptString(item, "answer") ??
            getRecallPracticePromptString(item, "explanation");

      return {
        id: getRecallPracticePromptString(item, "id") ?? `${index}-${prompt}`,
        prompt,
        answer,
      };
    })
    .filter((item): item is RecallPracticePrompt => item !== null);
}

function getRecallPracticePromptString(value: unknown, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const field = (value as Record<string, unknown>)[key];
  if (typeof field !== "string") return null;
  const trimmed = field.trim();
  return trimmed || null;
}

function DefinitionSection({
  education,
  mobile,
}: {
  education: DiagnosisEducation;
  mobile: boolean;
}) {
  const { definition, takeaway } = getEducationSummary(education);

  if (!definition && !takeaway) {
    return null;
  }

  return (
    <ResponsiveSection
      number="01"
      title="Definition"
      tone="teal"
      mobile={mobile}
    >
      <LearningInfoCard
        card={{
          title: education.title,
          body: definition ?? takeaway ?? education.title,
          details: takeaway && takeaway !== definition
            ? [insightDetail("mechanism", takeaway)].filter(
                (detail): detail is InsightDetail => Boolean(detail),
              )
            : [],
        }}
        tone="teal"
        eyebrow="overview"
      />
    </ResponsiveSection>
  );
}

function ClassicPatternSection({
  cards,
  mobile,
}: {
  cards: NormalizedEducationCard[];
  mobile: boolean;
}) {
  return (
    <ResponsiveSection
      number="02"
      title="Classic Pattern"
      tone="teal"
      mobile={mobile}
    >
      <EducationCardGrid
        cards={cards}
        emptyCopy="No reviewed clinical pattern yet."
        renderCard={(card) => (
          <LearningInfoCard card={card} tone="teal" eyebrow="pattern" compact />
        )}
      />
    </ResponsiveSection>
  );
}

function ExamPearlsSection({
  classicSigns,
  mobile,
}: {
  classicSigns: ClassicSign[];
  mobile: boolean;
}) {
  return (
    <ResponsiveSection
      number="03"
      title="Key Signs"
      tone="teal"
      mobile={mobile}
    >
      <EducationCardGrid
        cards={classicSigns.map(classicSignToCard)}
        emptyCopy="No reviewed exam pearls yet."
        renderCard={(card) => <ExamPearlCard card={card} compact />}
      />
    </ResponsiveSection>
  );
}

function WorkupAnchorsSection({
  investigations,
  mobile,
}: {
  investigations: TeachingInvestigationCard[];
  mobile: boolean;
}) {
  return (
    <ResponsiveSection
      number="04"
      title="Investigations"
      tone="teal"
      mobile={mobile}
    >
      <EducationCardGrid
        cards={investigations.map(investigationToCard)}
        emptyCopy="No reviewed work-up anchors yet."
        renderCard={(card) => <InvestigationAnchorCard card={card} />}
      />
    </ResponsiveSection>
  );
}

function DontMissSection({
  cards,
  mobile,
}: {
  cards: NormalizedEducationCard[];
  mobile: boolean;
}) {
  return (
    <ResponsiveSection
      number="06"
      title="Pitfalls"
      tone="amber"
      mobile={mobile}
    >
      <EducationCardGrid
        cards={cards}
        emptyCopy="No reviewed pitfalls yet."
        renderCard={(card) => <PitfallCard card={card} />}
      />
    </ResponsiveSection>
  );
}

function ManagementSnapshotSection({
  management,
  mobile,
}: {
  management: TeachingManagementCard[];
  mobile: boolean;
}) {
  return (
    <ResponsiveSection
      number="05"
      title="Management"
      tone="teal"
      mobile={mobile}
    >
      <EducationCardGrid
        cards={management.map(managementToCard)}
        emptyCopy="No reviewed management snapshot yet."
        renderCard={(card) => <ManagementStepCard card={card} />}
      />
    </ResponsiveSection>
  );
}

function MnemonicsSection({
  mnemonics,
  mobile,
}: {
  mnemonics: TeachingMnemonicCard[];
  mobile: boolean;
}) {
  return (
    <ResponsiveSection
      number="07"
      title="Mnemonics"
      tone="amber"
      mobile={mobile}
    >
      <div className="grid gap-2 min-[560px]:grid-cols-2">
        {mnemonics.map((mnemonic) => (
          <MnemonicLearningCard key={mnemonic.id} mnemonic={mnemonic} />
        ))}
      </div>
    </ResponsiveSection>
  );
}

function ScoresSection({
  scoringSystems,
  mobile,
}: {
  scoringSystems: TeachingScoringSystemCard[];
  mobile: boolean;
}) {
  return (
    <ResponsiveSection
      number="08"
      title="Scores"
      tone="amber"
      mobile={mobile}
    >
      <EducationCardGrid
        cards={scoringSystems.map(scoringSystemToCard)}
        emptyCopy="No scoring systems recorded."
        renderCard={(card) => <ScoreCard card={card} />}
      />
    </ResponsiveSection>
  );
}

function ReferencesSection({
  references,
  mobile,
}: {
  references: string[];
  mobile: boolean;
}) {
  if (!references.length) return null;

  return (
    <ResponsiveSection
      number="09"
      title="References"
      tone="teal"
      mobile={mobile}
    >
      <div className="rounded-[15px] border border-white/[0.06] bg-white/[0.025] px-4 py-3">
        <ul className="space-y-2">
          {references.map((reference) => (
            <li
              key={reference}
              className="break-words text-sm leading-6 text-white/58"
            >
              {reference}
            </li>
          ))}
        </ul>
      </div>
    </ResponsiveSection>
  );
}

function classicSignToCard(sign: ClassicSign): NormalizedEducationCard {
  const title = sign.title;
  const body =
    firstDistinctString(
      [
        sign.description,
        sign.significance,
        sign.whyItMatters,
        sign.diagnosticImpact,
        sign.finding,
      ],
      [title],
    ) ??
    sign.finding ??
    title;

  return {
    eyebrow: sign.sourceSection === "keySigns" ? "sign" : "exam",
    title,
    body,
    details: compactInsightDetails(
      [
        insightDetail("mechanism", sign.whyItMatters),
        insightDetail("separates", sign.discriminator),
        insightDetail("trap", sign.trapAvoided),
        insightDetail("urgency", sign.action),
      ],
      [title, body],
    ),
  };
}

function investigationToCard(
  investigation: TeachingInvestigationCard,
): NormalizedEducationCard {
  const title = investigation.test;
  const body =
    firstDistinctString(
      [investigation.significance, investigation.interpretation],
      [title],
    ) ??
    investigation.significance ??
    title;

  return {
    eyebrow: "work-up",
    title,
    body,
    details: compactInsightDetails(
      [
        insightDetail("interpret", investigation.interpretation),
        insightDetail("separates", investigation.discriminator),
        insightDetail("trap", investigation.trap),
      ],
      [title, body],
    ),
  };
}

function managementToCard(
  management: TeachingManagementCard,
): NormalizedEducationCard {
  const title = management.step;
  const body =
    firstDistinctString(
      [management.content, management.rationale, management.urgency],
      [title],
    ) ?? title;

  return {
    eyebrow: "management",
    title,
    body,
    details: compactInsightDetails(
      [
        insightDetail("mechanism", management.rationale),
        insightDetail("urgency", management.urgency),
        insightDetail("trap", management.trap),
      ],
      [title, body],
    ),
  };
}

function scoringSystemToCard(
  scoringSystem: TeachingScoringSystemCard,
): NormalizedEducationCard {
  const title = scoringSystem.name;
  const components = scoringSystem.components?.join(", ");
  const body =
    firstDistinctString([scoringSystem.use, components], [title]) ?? title;

  return {
    eyebrow: "score",
    title,
    body,
    details: compactInsightDetails(
      [
        insightDetail("interpret", components),
        insightDetail("trap", scoringSystem.caution),
      ],
      [title, body],
    ),
  };
}

function EducationCardGrid({
  cards,
  emptyCopy,
  renderCard,
}: {
  cards: NormalizedEducationCard[];
  emptyCopy: string;
  renderCard: (card: NormalizedEducationCard) => ReactNode;
}) {
  if (!cards.length) {
    return <InlineNotice tone="muted" copy={emptyCopy} />;
  }

  return (
    <div className="grid gap-2 min-[560px]:grid-cols-2">
      {cards.map((card, index) => (
        <div key={`${card.eyebrow ?? ""}-${card.title ?? ""}-${card.body}-${index}`}>
          {renderCard(card)}
        </div>
      ))}
    </div>
  );
}

function ExamPearlCard({
  card,
  compact = false,
}: {
  card: NormalizedEducationCard;
  compact?: boolean;
}) {
  return (
    <LearningInfoCard
      card={card}
      tone="teal"
      eyebrow={card.eyebrow ?? "exam"}
      compact={compact}
    />
  );
}

function InvestigationAnchorCard({ card }: { card: NormalizedEducationCard }) {
  return (
    <LearningInfoCard
      card={card}
      tone="teal"
      eyebrow={card.eyebrow ?? "work-up"}
    />
  );
}

function ManagementStepCard({ card }: { card: NormalizedEducationCard }) {
  return (
    <LearningInfoCard
      card={card}
      tone="muted"
      eyebrow={card.eyebrow ?? "management"}
    />
  );
}

function PitfallCard({ card }: { card: NormalizedEducationCard }) {
  return (
    <LearningInfoCard
      card={card}
      tone="amber"
      eyebrow={card.eyebrow ?? "don't miss"}
    />
  );
}

function ScoreCard({ card }: { card: NormalizedEducationCard }) {
  return (
    <LearningInfoCard
      card={card}
      tone="amber"
      eyebrow={card.eyebrow ?? "score"}
    />
  );
}

function MnemonicLearningCard({
  mnemonic,
}: {
  mnemonic: TeachingMnemonicCard;
}) {
  return (
    <article className="min-w-0 rounded-[15px] border border-amber-300/[0.16] bg-amber-400/[0.055] px-4 py-3.5">
      <p className="font-brand-mono text-[9px] font-black uppercase tracking-[0.16em] text-amber-200/70">
        Mnemonic
      </p>
      <h3 className="mt-1 break-words text-[15px] font-extrabold leading-snug text-[var(--wardle-color-mint)]">
        {mnemonic.name}
      </h3>
      {mnemonic.useCase ? (
        <p className="mt-1.5 break-words text-sm leading-6 text-white/58">
          {mnemonic.useCase}
        </p>
      ) : null}
      <div className="mt-3 space-y-1.5">
        {mnemonic.expansion.map((entry, index) => (
          <div
            key={`${entry.letter ?? index}-${entry.meaning}`}
            className="grid min-w-0 grid-cols-[24px_minmax(0,1fr)] gap-2 text-sm leading-6"
          >
            <span className="font-brand-mono text-[12px] font-black text-amber-200/82">
              {entry.letter ?? "•"}
            </span>
            <p className="break-words text-white/64">
              {entry.meaning}
              {entry.note ? (
                <span className="text-white/38"> - {entry.note}</span>
              ) : null}
            </p>
          </div>
        ))}
      </div>
    </article>
  );
}

function LearningInfoCard({
  card,
  tone,
  eyebrow,
  compact = false,
}: {
  card: NormalizedEducationCard;
  tone: "teal" | "amber" | "muted";
  eyebrow: string;
  compact?: boolean;
}) {
  const toneClass =
    tone === "amber"
      ? "border-amber-300/[0.16] bg-amber-400/[0.055]"
      : tone === "teal"
        ? "border-[var(--wardle-color-teal)]/14 bg-[var(--wardle-color-teal)]/[0.038]"
        : "border-white/[0.06] bg-white/[0.025]";
  const eyebrowClass =
    tone === "amber"
      ? "text-amber-200/70"
      : tone === "teal"
        ? "text-[var(--wardle-color-teal)]/62"
        : "text-white/32";

  return (
    <article className={`min-w-0 rounded-[15px] border px-4 ${compact ? "py-3" : "py-3.5"} ${toneClass}`}>
      <p
        className={`font-brand-mono text-[9px] font-black uppercase tracking-[0.16em] ${eyebrowClass}`}
      >
        {eyebrow}
      </p>
      {card.title ? (
        <h3 className="mt-1 break-words text-[15px] font-extrabold leading-snug text-[var(--wardle-color-mint)]">
          {card.title}
        </h3>
      ) : null}
      {!isSameDisplayText(card.title, card.body) ? (
        <p
          className={`break-words text-sm leading-6 text-white/62 ${
            card.title ? "mt-1.5" : "mt-1"
          }`}
        >
          {card.body}
        </p>
      ) : null}
      <InsightDetailStack details={card.details} warning={tone === "amber"} />
    </article>
  );
}

function normalizeEducationCards(
  items: Array<unknown> | null | undefined,
  options: {
    fallbackEyebrow: string;
    typedPearlTypes?: Array<TypedEducationPearl["type"]>;
  },
): NormalizedEducationCard[] {
  if (!items?.length) return [];

  const cards: NormalizedEducationCard[] = [];
  for (const item of items) {
    if (
      options.typedPearlTypes &&
      (!isTypedPearl(item) || !options.typedPearlTypes.includes(item.type))
    ) {
      continue;
    }

    const rendered = renderEducationInsight(item);
    if (!rendered) continue;

    cards.push({
      eyebrow: getEducationCardEyebrow(item, options.fallbackEyebrow),
      title: rendered.title,
      body: rendered.body,
      details: rendered.details,
    });
  }

  return cards;
}

function getEducationCardEyebrow(item: unknown, fallback: string) {
  if (isTypedPearl(item)) {
    return pearlTypeLabel(item.type);
  }

  if (!isRecord(item)) {
    return fallback;
  }

  const type = getString(item.type);
  return type ? pearlTypeLabel(type) : fallback;
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
  const teachingObjects = useMemo(
    () => (education ? buildTeachingObjects(education) : null),
    [education],
  );
  const items = buildCompareItems({
    caseDifferentials: explanation?.differentials ?? [],
    differentialAnalysis: explanation?.differentialAnalysis ?? [],
    educationDifferentials: teachingObjects?.differentials ?? [],
  });

  return (
    <div className="min-w-0 space-y-6">
      <ResponsiveSection
        number="01"
        title="Differential Reasoning"
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
    <div className="grid gap-2 min-[560px]:grid-cols-2">
      {items.map((item) => (
        <CompareDifferentialCard
          key={normalizeDiagnosisName(item.name)}
          item={item}
        />
      ))}
    </div>
  );
}

function CompareDifferentialCard({ item }: { item: CompareItem }) {
  const [expanded, setExpanded] = useState(false);
  const separator =
    item.keySeparator ?? item.generalPoint ?? item.finalReasonLessLikely;
  const showFallback =
    !item.hasStructuredReasoning &&
    !separator &&
    !item.casePoint &&
    !item.whyConfused &&
    !item.classicTrap;
  const detailCount = [
    item.casePoint,
    item.finalReasonLessLikely,
    item.whyConfused,
    item.classicTrap,
    ...(item.ruleOuts ?? []),
  ].filter(Boolean).length;

  return (
    <article className="overflow-hidden rounded-[16px] border border-white/[0.06] bg-white/[0.03]">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="block w-full px-4 pb-3 pt-3.5 text-left"
        aria-expanded={expanded}
      >
        <div className="flex min-w-0 items-start justify-between gap-3">
          <p className="min-w-0 break-words text-[15px] font-bold leading-snug text-[var(--wardle-color-mint)]">
            {item.name}
          </p>
          <span
            className={`shrink-0 rounded-full border px-2.5 py-1 font-brand-mono text-[9px] font-bold uppercase tracking-[0.12em] ${getCompareStatusClass(
              item.status,
            )}`}
          >
            {item.status}
          </span>
        </div>

        {separator ? (
          <div className="mt-2 rounded-[12px] border border-[rgba(29,158,117,0.13)] bg-[rgba(29,158,117,0.04)] px-3 py-2">
            <p className="font-brand-mono text-[8px] font-black uppercase tracking-[0.14em] text-[rgba(29,158,117,0.62)]">
              Key separator
            </p>
            <p className="mt-1 break-words text-[13px] font-medium leading-5 text-white/68">
              {separator}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm leading-5 text-white/42">
            Stored as a differential for this case.
          </p>
        )}

        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="font-brand-mono text-[9px] font-bold uppercase tracking-[0.14em] text-white/28">
            {detailCount
              ? `${detailCount} reasoning detail${detailCount === 1 ? "" : "s"}`
              : "No extra reasoning"}
          </span>
          <span className="text-xs font-bold text-[var(--wardle-color-teal)]/78">
            {expanded ? "Collapse" : "Expand"}
          </span>
        </div>
      </button>

      {expanded ? (
        <div className="border-t border-white/[0.05] px-4 pb-3 pt-3">
          {item.casePoint ? (
            <div className="mb-2.5 grid grid-cols-[72px_minmax(0,1fr)] items-baseline gap-2">
              <p className="pt-px font-brand-mono text-[9px] font-bold uppercase tracking-[0.14em] text-white/26">
                Early
              </p>
              <p className="break-words text-[13px] leading-5 text-white/50">
                {item.casePoint}
              </p>
            </div>
          ) : null}

          {item.ruleOuts?.length ? (
            <div className="mb-2.5 overflow-hidden rounded-[12px] border border-[rgba(29,158,117,0.18)] bg-[rgba(29,158,117,0.07)]">
              <p className="border-b border-[rgba(29,158,117,0.1)] px-3 py-1.5 font-brand-mono text-[9px] font-bold uppercase tracking-[0.15em] text-[rgba(29,158,117,0.6)]">
                Eliminated by clues
              </p>
              <div className="py-1">
                {item.ruleOuts.map((ruleOut, index) => (
                  <div
                    key={`${ruleOut.clueOrder}-${index}-${ruleOut.evidence}`}
                    className="relative flex gap-2.5 px-3 py-2"
                  >
                    {index < (item.ruleOuts?.length ?? 0) - 1 ? (
                      <span className="absolute bottom-[-4px] left-[21px] top-7 w-px bg-[rgba(29,158,117,0.15)]" />
                    ) : null}
                    <span className="relative z-[1] mt-px flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-[rgba(29,158,117,0.28)] bg-[rgba(29,158,117,0.12)] font-brand-mono text-[8px] font-black text-[rgba(29,158,117,0.7)]">
                      {ruleOut.clueOrder}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="mb-0.5 font-brand-mono text-[8px] font-bold uppercase tracking-[0.14em] text-[rgba(29,158,117,0.6)]">
                        Clue {ruleOut.clueOrder}
                      </p>
                      <p className="break-words text-[13px] font-semibold leading-5 text-white/72">
                        {ruleOut.reason}
                      </p>
                      <p className="mt-0.5 break-words text-xs leading-5 text-white/40">
                        {ruleOut.evidence}
                      </p>
                    </div>
                  </div>
                ))}
                </div>
            </div>
          ) : null}

          {item.finalReasonLessLikely &&
          item.finalReasonLessLikely !== separator ? (
            <ComparisonLine label="less likely" tone="muted">
              {item.finalReasonLessLikely}
            </ComparisonLine>
          ) : null}

          {item.whyConfused || item.classicTrap ? (
            <div className="mt-2 flex flex-wrap gap-2 border-t border-white/[0.04] pt-2">
              {item.whyConfused ? (
                <ComparisonLine label="overlap" tone="muted">
                  {item.whyConfused}
                </ComparisonLine>
              ) : null}
              {item.classicTrap ? (
                <ComparisonLine label="caution" tone="amber">
                  {item.classicTrap}
                </ComparisonLine>
              ) : null}
            </div>
          ) : null}

          {showFallback ? (
            <p className="text-sm leading-6 text-white/44">
              Stored as a ruled-out alternative for this case.
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function getCompareStatusClass(status: CompareItem["status"]) {
  if (status === "ruled out") {
    return "border-rose-400/[0.2] bg-rose-400/[0.07] text-rose-300/90";
  }

  if (status === "competing early") {
    return "border-sky-300/[0.18] bg-sky-300/[0.06] text-sky-200/80";
  }

  return "border-white/[0.1] bg-white/[0.04] text-white/38";
}

function ComparisonLine({
  label,
  tone,
  children,
}: {
  label: string;
  tone: "amber" | "muted";
  children: ReactNode;
}) {
  const labelClass =
    tone === "amber" ? "text-[var(--wardle-color-amber)]/72" : "text-white/32";

  return (
    <div className="flex min-w-0 flex-1 basis-full items-baseline gap-1.5 text-xs text-white/40">
      <p className={`font-brand-mono text-[9px] font-bold uppercase tracking-[0.14em] ${labelClass}`}>
        {label}
      </p>
      <p className="min-w-0 break-words text-xs leading-5 text-white/40">
        {children}
      </p>
    </div>
  );
}

function renderEducationInsight(item: unknown): {
  title?: string;
  body: string;
  details: InsightDetail[];
} | null {
  if (typeof item === "string") {
    const body = item.trim();
    return body ? { body, details: [] } : null;
  }

  if (!isRecord(item)) return null;

  if (isTypedPearl(item)) {
    const details = [
      insightDetail("separates", item.discriminator),
      insightDetail("urgency", item.managementImplication),
      insightDetail("urgency", item.escalationImplication),
      insightDetail("trap", item.trapAvoided),
      insightDetail("mechanism", item.whyItMatters),
    ].filter((detail): detail is InsightDetail => Boolean(detail));

    return {
      title: item.title ?? pearlTypeLabel(item.type),
      body: item.content,
      details,
    };
  }

  const title =
    getString(item.pattern) ??
    getString(item.finding) ??
    getString(item.test) ??
    getString(item.pitfall) ??
    getString(item.step);
  const body =
    getString(item.whyItMatters) ??
    getString(item.significance) ??
    getString(item.rationale) ??
    getString(item.consequence) ??
    getString(item.diagnosticImpact) ??
    getString(item.interpretation);

  if (!title && !body) return null;

  const details = [
    insightDetail("flow", item.progression),
    insightDetail("separates", item.discriminator),
    insightDetail("trap", item.commonTrap ?? item.classicTrap),
    insightDetail("interpret", item.interpretation),
    insightDetail("mechanism", item.whyItHappens),
    insightDetail("safer", item.saferHeuristic),
    insightDetail("urgency", item.urgency),
  ].filter((detail): detail is InsightDetail => Boolean(detail));

  return {
    title: title ?? undefined,
    body: body ?? title ?? "",
    details,
  };
}

function insightDetail(kind: InsightDetail["kind"], value: unknown) {
  const text = getString(value);
  return text ? { kind, text } : null;
}

function InsightDetailStack({
  details,
  warning,
}: {
  details: InsightDetail[];
  warning: boolean;
}) {
  if (!details.length) return null;

  return (
    <details className="group mt-2">
      <summary className="cursor-pointer list-none font-brand-mono text-[9px] font-bold uppercase tracking-[0.14em] text-white/30 transition group-open:text-white/42">
        More context
      </summary>
      <div className="mt-1.5 space-y-1.5">
        {details.map((detail) => (
          <InsightDetailRow
            key={`${detail.kind}-${detail.text}`}
            detail={detail}
            warning={warning}
          />
        ))}
      </div>
    </details>
  );
}

function InsightDetailRow({
  detail,
  warning,
}: {
  detail: InsightDetail;
  warning: boolean;
}) {
  return (
    <p
      className={`break-words border-l pl-2.5 text-[12px] leading-5 ${
        warning
          ? "border-amber-300/20 text-amber-50/46"
          : "border-[var(--wardle-color-teal)]/18 text-white/42"
      }`}
    >
      {detail.text}
    </p>
  );
}

function DesktopAttemptBadge({ item }: { item: LearnLibraryCase }) {
  const specialty = getCaseSpecialty(item);
  const timeLabel =
    item.playerResult.timeSecs !== null
      ? formatStudyTime(item.playerResult.timeSecs)
      : null;
  const solved = item.playerResult.solved;
  const attemptText = [
    `${item.playerResult.attemptsUsed} clues`,
    timeLabel,
    solved ? "Solved" : "Unsolved",
  ].filter((value): value is string => Boolean(value));

  return (
    <div className="flex min-w-0 shrink-0 items-center justify-end gap-2">
      <p className="hidden min-w-0 max-w-[220px] truncate text-right font-brand-mono text-[10px] font-bold uppercase tracking-[0.12em] text-white/28 min-[920px]:block">
        {specialty.label} · {item.case.date || item.completedAt.slice(0, 10)}
      </p>
      <span
        className={`shrink-0 rounded-full border px-3 py-1.5 font-brand-mono text-[10px] font-black uppercase tracking-[0.12em] ${
          solved
            ? "border-[rgba(0,180,166,0.24)] bg-[rgba(0,180,166,0.1)] text-[var(--wardle-color-teal)]"
            : "border-rose-400/[0.22] bg-rose-400/[0.08] text-rose-300/86"
        }`}
      >
        {attemptText.join(" · ")}
      </span>
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
