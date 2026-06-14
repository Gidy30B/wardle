import {
  ArrowRight,
  ChevronDown,
} from 'lucide-react';
import { useMemo, type ReactNode } from 'react';

import type { DiagnosisEditorialWorkspace } from '../../../api/admin';
import StatusBadge from '../../../components/ui/StatusBadge';
import type { StatusBadgeTone } from '../../../components/ui/statusBadgeMeta';
import { CompactPanel, Pill } from './EditorialPrimitives';
import {
  buildCopilotSuggestions,
  formatLabel,
  formatScore,
} from './workspaceTransforms';
import type { CopilotSuggestion, WorkspaceTab } from './workspaceTypes';

export function EditorialRightRail({
  workspace,
  activeTab,
  onTabChange,
}: {
  workspace: DiagnosisEditorialWorkspace;
  activeTab: WorkspaceTab;
  onTabChange: (tab: WorkspaceTab) => void;
}) {
  const suggestions = useMemo(
    () => buildCopilotSuggestions(workspace, activeTab),
    [activeTab, workspace],
  );
  const pendingAudits = (workspace.aiDraftAuditTrail ?? []).filter(
    (audit) =>
      audit.reviewStatus === 'PENDING_REVIEW' ||
      audit.reviewStatus === 'REVIEW_REQUIRED',
  );
  const primaryFix =
    workspace.editorialPrioritization?.highestImpactFixes?.[0]?.label ??
    suggestions[0]?.title ??
    'No urgent copilot action';

  return (
    <>
      <details className="group editorial-panel rounded-lg xl:hidden">
        <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-4 py-3">
          <span className="min-w-0">
            <span className="editorial-eyebrow">Copilot summary</span>
            <span className="mt-1 block text-sm font-semibold text-slate-100">
              {primaryFix}
            </span>
            <span className="mt-1 block text-xs leading-5 text-slate-500">
              {formatScore(workspace.workspaceSummary.overallScore)} maturity
              score · {pendingAudits.length} pending review
              {pendingAudits.length === 1 ? '' : 's'}
            </span>
          </span>
          <ChevronDown
            className="mt-1 h-4 w-4 shrink-0 text-slate-500 transition group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <div className="space-y-3 border-t border-[var(--color-navy-border)] p-3">
          <RightRailContent
            workspace={workspace}
            activeTab={activeTab}
            suggestions={suggestions}
            onTabChange={onTabChange}
          />
        </div>
      </details>

      <aside className="hidden space-y-3 xl:sticky xl:top-5 xl:block xl:self-start">
        <RightRailContent
          workspace={workspace}
          activeTab={activeTab}
          suggestions={suggestions}
          onTabChange={onTabChange}
        />
      </aside>
    </>
  );
}

function RightRailContent({
  workspace,
  activeTab,
  suggestions,
  onTabChange,
}: {
  workspace: DiagnosisEditorialWorkspace;
  activeTab: WorkspaceTab;
  suggestions: CopilotSuggestion[];
  onTabChange: (tab: WorkspaceTab) => void;
}) {
  return (
    <>
      <MaturityRing workspace={workspace} />
      <PriorityDecisionCard
        workspace={workspace}
        activeTab={activeTab}
        onTabChange={onTabChange}
      />
      <ActiveTabHintCard activeTab={activeTab} />
      <IntegrityBlockerCard workspace={workspace} onTabChange={onTabChange} />
      <RailDetails title="More actions" summary={`${suggestions.length} suggestion${suggestions.length === 1 ? '' : 's'}`}>
        <CopilotSuggestionsCard
        activeTab={activeTab}
        suggestions={suggestions}
        onTabChange={onTabChange}
      />
      </RailDetails>
    </>
  );
}

function ActiveTabHintCard({ activeTab }: { activeTab: WorkspaceTab }) {
  const hints: Record<WorkspaceTab, string> = {
    overview: 'Use Overview to choose the single next publication-readiness move.',
    'editorial-brief': 'Objectives owns the teaching intent and required learning outcomes.',
    education: 'Clinical Picture is the compact clinician-facing recognition view.',
    'teaching-rules': 'Teaching & Learning owns discriminator rows and teaching distinctions.',
    graph: 'Differential Map owns mimic separation and graph review context.',
    cases: 'Cases owns learning-goal, clue, and discriminator practice coverage.',
    integrity: 'Integrity owns claims, audits, quality, revisions, and senior review blockers.',
  };
  return (
    <CompactPanel title="Active tab">
      <p className="text-sm leading-6 text-slate-300">{hints[activeTab]}</p>
    </CompactPanel>
  );
}

function IntegrityBlockerCard({
  workspace,
  onTabChange,
}: {
  workspace: DiagnosisEditorialWorkspace;
  onTabChange: (tab: WorkspaceTab) => void;
}) {
  const unsupportedClaims = workspace.unsupportedClaimsBySection ?? [];
  const pendingAudits = (workspace.aiDraftAuditTrail ?? []).filter((audit) =>
    ['PENDING_REVIEW', 'REVIEW_REQUIRED', 'NEEDS_CHANGES'].includes(
      audit.reviewStatus,
    ),
  );
  const clueDrafts = workspace.materializedClueRevisionDrafts ?? [];
  const blockedSections = workspace.education.sectionHealth.filter(
    (section) => section.blockers.length > 0 || section.warnings.length > 0,
  );
  const blockerCount =
    unsupportedClaims.filter((claim) => claim.blocksPublication).length +
    pendingAudits.length +
    clueDrafts.filter((draft) =>
      ['PENDING_REVIEW', 'NEEDS_CHANGES', 'BLOCKED_CASE_NOT_EDITABLE'].includes(
        draft.status,
      ),
    ).length +
    blockedSections.length;

  return (
    <CompactPanel title="Integrity blockers">
      <div className="flex flex-wrap gap-2">
        <StatusBadge
          status={`${blockerCount} blocker${blockerCount === 1 ? '' : 's'}`}
          tone={blockerCount ? 'warning' : 'success'}
        />
        <StatusBadge
          status={`${unsupportedClaims.length} claim${unsupportedClaims.length === 1 ? '' : 's'}`}
          tone={unsupportedClaims.length ? 'warning' : 'success'}
        />
      </div>
      <button
        type="button"
        onClick={() => onTabChange('integrity')}
        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-teal)]"
      >
        Open Integrity
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </CompactPanel>
  );
}

function MaturityRing({ workspace }: { workspace: DiagnosisEditorialWorkspace }) {
  const score = toPercent(workspace.workspaceSummary.overallScore);
  const blockers =
    workspace.workspaceSummary.blockers.length +
    workspace.coverageGaps.filter((gap) => gap.severity === 'blocker').length;
  const evidencePct = toPercent(
    workspace.maturityBreakdown?.evidence ??
      (workspace.evidenceCoverage?.coverageScore ?? null),
  );
  const discriminatorPct = toPercent(
    workspace.maturityBreakdown?.differentialCoverage ??
      (workspace.evidenceGraph.summary.discriminatorEvidence
        ? Math.min(1, workspace.evidenceGraph.summary.discriminatorEvidence / 6)
        : 0),
  );
  const casePct = toPercent(
    workspace.maturityBreakdown?.caseCoverage ??
      (workspace.cases.summary.total
        ? workspace.cases.summary.usable / workspace.cases.summary.total
        : 0),
  );
  const circumference = 2 * Math.PI * 27;
  const offset = circumference * (1 - score / 100);

  return (
    <section className="editorial-panel overflow-hidden rounded-lg">
      <div className="border-b border-[var(--color-navy-border)] p-4">
        <p className="rail-label text-[10px] font-medium uppercase tracking-[0.07em] text-[var(--color-slate)]">
          Diagnosis maturity
        </p>
        <div className="relative mx-auto mb-2.5 mt-3 h-[68px] w-[68px]">
          <svg viewBox="0 0 68 68" className="h-full w-full -rotate-90">
            <circle
              cx="34"
              cy="34"
              r="27"
              fill="none"
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="5"
            />
            <circle
              cx="34"
              cy="34"
              r="27"
              fill="none"
              stroke="var(--color-teal)"
              strokeWidth="5"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
            />
          </svg>
          <span className="font-editorial-num absolute inset-0 flex items-center justify-center text-[20px] text-[var(--color-teal)]">
            {score}
          </span>
        </div>
        <div className="flex flex-wrap justify-center gap-1.5">
          <Pill tone={blockers ? 'amber' : 'green'}>
            {blockers ? 'Not ready' : 'Ready'}
          </Pill>
          <Pill tone={blockers ? 'rose' : 'slate'}>
            {blockers} blocker{blockers === 1 ? '' : 's'}
          </Pill>
        </div>
        <div className="mt-3 space-y-2">
          <CovBar label="Evidence coverage" pct={evidencePct} color="var(--color-teal)" />
          <CovBar
            label="Discriminator coverage"
            pct={discriminatorPct}
            color="var(--color-amber)"
          />
          <CovBar label="Case coverage" pct={casePct} color="var(--color-rose)" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-px bg-[var(--color-navy-border)]">
        <GlanceCell label="Rules" value={workspace.teachingRules.summary.active} />
        <GlanceCell label="Evidence" value={workspace.graph.factCount} />
        <GlanceCell label="Cases" value={workspace.cases.summary.usable} />
        <GlanceCell label="Claims" value={workspace.unsupportedClaimsBySection?.length ?? 0} />
        <GlanceCell label="Gaps" value={workspace.coverageGaps.length} />
        <GlanceCell label="Drafts" value={workspace.aiDraftAuditTrail?.length ?? 0} />
      </div>
    </section>
  );
}

function CovBar({
  label,
  pct,
  color,
}: {
  label: string;
  pct: number;
  color: string;
}) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-[10px] text-[var(--color-slate)]">
        <span>{label}</span>
        <span style={{ color }}>{pct}%</span>
      </div>
      <div className="h-1 overflow-hidden rounded-sm border border-[var(--color-navy-border)] bg-[var(--color-navy)]">
        <div
          className="h-full rounded-sm"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

function GlanceCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-[var(--color-navy-mid)] px-2 py-2 text-center">
      <p className="font-editorial-num text-[18px] text-[var(--color-white-text)]">
        {value}
      </p>
      <p className="mt-1 text-[9px] uppercase tracking-[0.08em] text-[var(--color-slate)]">
        {label}
      </p>
    </div>
  );
}

function toPercent(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0;
  }
  return Math.round(Math.max(0, Math.min(1, value)) * 100);
}

function PriorityDecisionCard({
  workspace,
  activeTab,
  onTabChange,
}: {
  workspace: DiagnosisEditorialWorkspace;
  activeTab: WorkspaceTab;
  onTabChange: (tab: WorkspaceTab) => void;
}) {
  const priority = workspace.editorialPrioritization;
  const fixes = priority?.highestImpactFixes ?? [];
  const queues = priority?.workflowQueues ?? priority?.queues ?? [];
  const visibleFixes = prioritizeForTab(fixes, activeTab);
  const primaryFix = visibleFixes[0] ?? null;
  const remainingFixes = visibleFixes.slice(1);

  if (!priority) {
    return null;
  }

  return (
    <CompactPanel
      title="Highest impact fixes"
      subtitle={`Decision focus for ${formatLabel(activeTab)}.`}
      action={
        <StatusBadge
          status={`${priority.editorialPriority.score} ${formatLabel(
            priority.editorialPriority.tier,
          )}`}
          tone={riskTone(priority.editorialPriority.tier)}
        />
      }
    >
      <div className="grid gap-2 sm:grid-cols-3">
        <RiskRow label="Publication" risk={priority.publicationRisk} />
        <RiskRow label="Learner confusion" risk={priority.learnerRisk} />
        <RiskRow label="Reasoning" risk={priority.reasoningRisk} />
      </div>
      {primaryFix ? (
        <div className="mt-3 space-y-2">
          <ImpactFixButton
            fix={primaryFix}
            onTabChange={onTabChange}
            primary
          />
          {remainingFixes.length ? (
            <details className="rounded-lg border border-[var(--color-navy-border)] bg-white/4 p-3">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                {remainingFixes.length} more impact fix
                {remainingFixes.length === 1 ? '' : 'es'}
              </summary>
              <div className="mt-3 space-y-2">
                {remainingFixes.map((fix) => (
                  <ImpactFixButton
                    key={fix.id}
                    fix={fix}
                    onTabChange={onTabChange}
                    compact
                  />
                ))}
              </div>
            </details>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500">
          No high-impact editorial fixes are currently reported.
        </p>
      )}
      {queues.length ? (
        <details className="mt-3 rounded-lg border border-[var(--color-navy-border)] bg-white/4 p-3">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            Queue membership
          </summary>
          <div className="mt-3 flex flex-wrap gap-2">
            {queues.map((queue) => (
              <StatusBadge
                key={queue.id}
                status={`${queue.label} (${queue.count})`}
                tone={queue.severity === 'blocker' ? 'danger' : 'warning'}
              />
            ))}
          </div>
        </details>
      ) : null}
    </CompactPanel>
  );
}

function ImpactFixButton({
  fix,
  onTabChange,
  primary = false,
  compact = false,
}: {
  fix: NonNullable<
    NonNullable<DiagnosisEditorialWorkspace['editorialPrioritization']>['highestImpactFixes']
  >[number];
  onTabChange: (tab: WorkspaceTab) => void;
  primary?: boolean;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onTabChange(fix.targetTab as WorkspaceTab)}
      className={[
        'w-full rounded-lg border px-3 py-2 text-left transition hover:border-[var(--color-teal)]/40 hover:bg-[var(--color-teal)]/10',
        primary
          ? 'border-[var(--color-teal)]/30 bg-[var(--color-teal)]/10'
          : 'border-[var(--color-navy-border)] bg-white/5',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={`font-semibold text-slate-100 ${
            compact ? 'text-xs' : 'text-sm'
          }`}
        >
          {fix.label}
        </span>
        <StatusBadge
          status={formatLabel(fix.severity)}
          tone={fix.severity === 'blocker' ? 'danger' : 'warning'}
        />
      </div>
      <p className="mt-1 text-xs leading-5 text-slate-400">{fix.reason}</p>
    </button>
  );
}

function RiskRow({
  label,
  risk,
}: {
  label: string;
  risk: { score: number; tier: string };
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-navy-border)] bg-white/5 px-3 py-2">
      <span className="text-sm text-slate-300">{label}</span>
      <StatusBadge
        status={`${risk.score} ${formatLabel(risk.tier)}`}
        tone={riskTone(risk.tier)}
      />
    </div>
  );
}

function riskTone(tier: string): StatusBadgeTone {
  if (tier === 'critical' || tier === 'high') return 'danger';
  if (tier === 'medium') return 'warning';
  return 'success';
}

function CopilotSuggestionsCard({
  activeTab,
  suggestions,
  onTabChange,
}: {
  activeTab: WorkspaceTab;
  suggestions: CopilotSuggestion[];
  onTabChange: (tab: WorkspaceTab) => void;
}) {
  const ordered = prioritizeForTab(suggestions, activeTab).slice(0, 5);

  if (!ordered.length) {
    return (
      <CompactPanel title="Suggested moves">
        <p className="text-sm text-slate-500">No suggested moves right now.</p>
      </CompactPanel>
    );
  }

  return (
    <CompactPanel title="Suggested moves">
      <div className="space-y-2">
        {ordered.map((suggestion) => (
          <button
            key={suggestion.id}
            type="button"
            disabled={!suggestion.enabled}
            onClick={() => onTabChange(suggestion.targetTab)}
            className="w-full rounded-lg border border-[var(--color-navy-border)] bg-white/5 px-3 py-2 text-left transition hover:border-[var(--color-teal)]/40 hover:bg-[var(--color-teal)]/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-semibold text-slate-100">
                {suggestion.title}
              </span>
              <StatusBadge status={formatLabel(suggestion.source)} tone={suggestion.tone} />
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              {suggestion.detail}
            </p>
          </button>
        ))}
      </div>
    </CompactPanel>
  );
}

function RailDetails({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: ReactNode;
}) {
  return (
    <details className="group editorial-panel overflow-hidden rounded-lg">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
        <span>
          <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
            {title}
          </span>
          <span className="mt-1 block text-xs leading-5 text-slate-500">
            {summary}
          </span>
        </span>
        <ChevronDown
          className="h-4 w-4 shrink-0 text-slate-500 transition group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="border-t border-[var(--color-navy-border)] p-3">
        {children}
      </div>
    </details>
  );
}

function prioritizeForTab<T extends { targetTab: string }>(
  items: T[],
  activeTab: WorkspaceTab,
) {
  return [...items].sort((left, right) => {
    const leftActive = left.targetTab === activeTab ? 0 : 1;
    const rightActive = right.targetTab === activeTab ? 0 : 1;
    return leftActive - rightActive;
  });
}
