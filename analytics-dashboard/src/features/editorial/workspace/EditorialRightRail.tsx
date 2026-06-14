import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  Lightbulb,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, type ReactNode } from 'react';

import type {
  AiDraftDecisionAction,
  DiagnosisEditorialWorkspace,
  WorkspaceAvailableAction,
  WorkspaceCoverageGap,
} from '../../../api/admin';
import StatusBadge from '../../../components/ui/StatusBadge';
import type { StatusBadgeTone } from '../../../components/ui/statusBadgeMeta';
import { AuditTrailPanel } from './AuditTrailPanel';
import { CoverageGapsCard } from './CoveragePanels';
import { CompactPanel, Pill } from './EditorialPrimitives';
import {
  buildCopilotSuggestions,
  formatLabel,
  formatPercentUnit,
  formatScore,
  scoreTone,
} from './workspaceTransforms';
import type { CopilotSuggestion, WorkspaceTab } from './workspaceTypes';

export function EditorialRightRail({
  workspace,
  activeTab,
  onGapSelect,
  onTabChange,
  onAiDraftDecision,
}: {
  workspace: DiagnosisEditorialWorkspace;
  activeTab: WorkspaceTab;
  onGapSelect: (gap: WorkspaceCoverageGap) => void;
  onTabChange: (tab: WorkspaceTab) => void;
  onAiDraftDecision: (
    auditId: string,
    action: AiDraftDecisionAction,
    note?: string,
  ) => void;
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
  const pendingDiscriminatorDrafts = (
    workspace.discriminatorDraftReviews ?? []
  ).filter(
    (draft) =>
      draft.reviewStatus === 'PENDING_REVIEW' ||
      draft.reviewStatus === 'REVIEW_REQUIRED' ||
      draft.reviewStatus === 'NEEDS_CHANGES',
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
            pendingAudits={pendingAudits}
            pendingDiscriminatorDrafts={pendingDiscriminatorDrafts}
            onGapSelect={onGapSelect}
            onTabChange={onTabChange}
            onAiDraftDecision={onAiDraftDecision}
          />
        </div>
      </details>

      <aside className="hidden space-y-3 xl:sticky xl:top-5 xl:block xl:self-start">
        <RightRailContent
          workspace={workspace}
          activeTab={activeTab}
          suggestions={suggestions}
          pendingAudits={pendingAudits}
          pendingDiscriminatorDrafts={pendingDiscriminatorDrafts}
          onGapSelect={onGapSelect}
          onTabChange={onTabChange}
          onAiDraftDecision={onAiDraftDecision}
        />
      </aside>
    </>
  );
}

function RightRailContent({
  workspace,
  activeTab,
  suggestions,
  pendingAudits,
  pendingDiscriminatorDrafts,
  onGapSelect,
  onTabChange,
  onAiDraftDecision,
}: {
  workspace: DiagnosisEditorialWorkspace;
  activeTab: WorkspaceTab;
  suggestions: CopilotSuggestion[];
  pendingAudits: NonNullable<DiagnosisEditorialWorkspace['aiDraftAuditTrail']>;
  pendingDiscriminatorDrafts: NonNullable<
    DiagnosisEditorialWorkspace['discriminatorDraftReviews']
  >;
  onGapSelect: (gap: WorkspaceCoverageGap) => void;
  onTabChange: (tab: WorkspaceTab) => void;
  onAiDraftDecision: (
    auditId: string,
    action: AiDraftDecisionAction,
    note?: string,
  ) => void;
}) {
  return (
    <>
      <MaturityRing workspace={workspace} />
      <PriorityDecisionCard
        workspace={workspace}
        activeTab={activeTab}
        onTabChange={onTabChange}
      />
      <RailDetails title="Copilot diagnostics" summary="Signals behind the rail priority">
        <CopilotSnapshotCard workspace={workspace} />
      </RailDetails>
      <CopilotSuggestionsCard
        activeTab={activeTab}
        suggestions={suggestions}
        onTabChange={onTabChange}
      />
      {pendingDiscriminatorDrafts.length ? (
        <DiscriminatorDraftRailCard
          drafts={pendingDiscriminatorDrafts}
          onTabChange={onTabChange}
        />
      ) : null}
      {pendingAudits.length ? (
        <AuditTrailPanel
          audits={workspace.aiDraftAuditTrail ?? []}
          onDecision={onAiDraftDecision}
        />
      ) : (
        <RailDetails
          title="Draft audit trail"
          summary={
            workspace.aiDraftAuditTrail?.length
              ? `${workspace.aiDraftAuditTrail.length} resolved or historical items`
              : 'No draft reviews waiting'
          }
        >
          <AuditTrailPanel
            audits={workspace.aiDraftAuditTrail ?? []}
            onDecision={onAiDraftDecision}
          />
        </RailDetails>
      )}
      <RailDetails title="Maturity inputs" summary="Score drivers and lifecycle blockers">
        <MaturityInputsCard workspace={workspace} />
      </RailDetails>
      {workspace.coverageGaps.length ? (
        <RailDetails
          title="Coverage gaps"
          summary={`${workspace.coverageGaps.length} traceable gap${
            workspace.coverageGaps.length === 1 ? '' : 's'
          }`}
        >
          <CoverageGapsCard gaps={workspace.coverageGaps} onGapSelect={onGapSelect} />
        </RailDetails>
      ) : null}
      {workspace.availableActions.length ? (
        <RailDetails
          title="Available actions"
          summary={`${workspace.availableActions.length} advertised action${
            workspace.availableActions.length === 1 ? '' : 's'
          }`}
        >
          <AvailableActionsCard actions={workspace.availableActions} />
        </RailDetails>
      ) : null}
    </>
  );
}

function DiscriminatorDraftRailCard({
  drafts,
  onTabChange,
}: {
  drafts: NonNullable<DiagnosisEditorialWorkspace['discriminatorDraftReviews']>;
  onTabChange: (tab: WorkspaceTab) => void;
}) {
  const primary = drafts[0];
  const payload = primary.discriminatorDraftReview;
  return (
    <CompactPanel
      title="Discriminator repairs"
      subtitle={`${drafts.length} generated repair draft${drafts.length === 1 ? '' : 's'} waiting`}
      action={<StatusBadge status={String(drafts.length)} tone="warning" />}
    >
      <p className="text-sm font-semibold text-slate-100">
        {payload.mimicName}
      </p>
      <p className="mt-1 text-xs leading-5 text-slate-400">
        {formatLabel(payload.generationIntent)} using {payload.discriminator}
      </p>
      <button
        type="button"
        className="editorial-action mt-3 w-full justify-center"
        onClick={() => onTabChange('cases')}
      >
        Review in Cases
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

function MaturityInputsCard({
  workspace,
}: {
  workspace: DiagnosisEditorialWorkspace;
}) {
  const breakdown = workspace.maturityBreakdown;
  const resolvedDifferentials =
    workspace.workspaceSummary.differentialCoverage?.resolvedLinks ??
    (workspace.linkedDifferentials ?? []).length;
  const totalDifferentials =
    workspace.workspaceSummary.differentialCoverage?.totalDifferentials ?? null;
  const lifecycleBlockers =
    workspace.lifecycleGovernance?.blockers.length ??
    workspace.readinessBreakdown.filter((item) => item.severity === 'blocker')
      .length;

  return (
    <CompactPanel title="Maturity inputs">
      <div className="grid gap-2">
        <MaturityInputRow
          label="Objectives"
          value={
            breakdown
              ? formatPercentUnit(breakdown.objectives)
              : workspace.editorialBrief.version
                ? 'Present'
                : 'Missing'
          }
          tone={
            breakdown
              ? scoreTone(breakdown.objectives)
              : workspace.editorialBrief.version
                ? 'success'
                : 'danger'
          }
        />
        <MaturityInputRow
          label="Clinical picture"
          value={
            breakdown
              ? formatPercentUnit(breakdown.teaching)
              : formatScore(workspace.education.qualityScore)
          }
          tone={scoreTone(
            breakdown?.teaching ?? workspace.education.qualityScore,
          )}
        />
        <MaturityInputRow
          label="Evidence support"
          value={
            breakdown
              ? formatPercentUnit(breakdown.evidence)
              : workspace.evidenceCoverage
                ? `${workspace.evidenceCoverage.coverageScore}%`
                : `${workspace.evidenceGraph.summary.active} active`
          }
          tone={scoreTone(
            breakdown?.evidence ?? workspace.evidenceCoverage?.coverageScore,
          )}
        />
        <MaturityInputRow
          label="Differentials"
          value={
            breakdown
              ? formatPercentUnit(breakdown.differentialCoverage)
              : totalDifferentials === null
                ? `${resolvedDifferentials} linked`
                : `${resolvedDifferentials}/${totalDifferentials}`
          }
          tone={scoreTone(
            breakdown?.differentialCoverage ?? (resolvedDifferentials ? 1 : 0),
          )}
        />
        <MaturityInputRow
          label="Cases"
          value={
            breakdown
              ? formatPercentUnit(breakdown.caseCoverage)
              : `${workspace.cases.summary.usable}/${workspace.cases.summary.total}`
          }
          tone={scoreTone(
            breakdown?.caseCoverage ?? (workspace.cases.summary.usable ? 1 : 0),
          )}
        />
        <MaturityInputRow
          label="Escalation"
          value={
            breakdown
              ? formatPercentUnit(breakdown.escalationCoverage)
              : workspace.escalationCoverage?.coversEscalation
                ? 'Covered'
                : 'Missing'
          }
          tone={scoreTone(
            breakdown?.escalationCoverage ??
              (workspace.escalationCoverage?.coversEscalation ? 1 : 0),
          )}
        />
        <MaturityInputRow
          label="Lifecycle blockers"
          value={String(lifecycleBlockers)}
          tone={lifecycleBlockers ? 'danger' : 'success'}
        />
      </div>
      {workspace.maturityExplanation?.length ? (
        <details className="mt-3 rounded-lg border border-[var(--color-navy-border)] bg-white/4 p-3">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            Explain maturity inputs
          </summary>
          <ul className="mt-3 space-y-1 text-xs leading-5 text-slate-500">
            {workspace.maturityExplanation.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </details>
      ) : (
        <p className="mt-3 text-xs leading-5 text-slate-500">
          Score is provided by the workspace API; these rows expose the real inputs
          available to the frontend.
        </p>
      )}
    </CompactPanel>
  );
}

function MaturityInputRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: StatusBadgeTone;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-navy-border)] bg-white/5 px-3 py-2">
      <span className="text-sm text-slate-300">{label}</span>
      <StatusBadge status={value} tone={tone} />
    </div>
  );
}

function CopilotSnapshotCard({
  workspace,
}: {
  workspace: DiagnosisEditorialWorkspace;
}) {
  const coveredRows = workspace.coverageMatrix.filter(
    (row) => row.fullCoverageStatus === 'covered',
  ).length;
  const blockerCount =
    workspace.workspaceSummary.blockers.length +
    workspace.coverageGaps.filter((gap) => gap.severity === 'blocker').length;
  const warningCount =
    workspace.workspaceSummary.warnings.length +
    workspace.coverageGaps.filter((gap) => gap.severity !== 'blocker').length;

  return (
    <section className="editorial-panel overflow-hidden rounded-lg shadow-sm">
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
          <Lightbulb
            className="h-4 w-4 text-[var(--color-teal)]"
            aria-hidden="true"
          />
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
            Editorial copilot
          </p>
          </div>
          <StatusBadge
            status={formatScore(workspace.workspaceSummary.overallScore)}
            tone={scoreTone(workspace.workspaceSummary.overallScore)}
          />
        </div>
        <p className="mt-1 text-sm text-slate-400">
          {coveredRows}/{workspace.coverageMatrix.length} teaching rules covered.
        </p>
      </div>
      <div className="space-y-3 border-t border-[var(--color-navy-border)] p-3">
        <div className="grid gap-2 sm:grid-cols-3">
          <RailMetric label="Evidence" value={workspace.graph.factCount} />
          <RailMetric
            label="Discriminators"
            value={workspace.evidenceGraph.summary.discriminatorEvidence}
          />
          <RailMetric label="Cases" value={workspace.cases.summary.usable} />
        </div>
        <div className="grid gap-2">
          <RailSignal
            icon={blockerCount ? ShieldAlert : CheckCircle2}
            label="Blockers"
            value={blockerCount}
            tone={blockerCount ? 'danger' : 'success'}
          />
          <RailSignal
            icon={warningCount ? AlertTriangle : CircleDashed}
            label="Weak signals"
            value={warningCount}
            tone={warningCount ? 'warning' : 'neutral'}
          />
        </div>
      </div>
    </section>
  );
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
  const uniqueSuggestions = dedupeSuggestions(suggestions);
  const primary = uniqueSuggestions[0] ?? null;
  const remaining = uniqueSuggestions.slice(1);

  return (
    <CompactPanel
      title="Next editorial moves"
      subtitle={`Biased toward ${formatLabel(activeTab)} while preserving blockers first.`}
    >
      {primary ? (
        <div className="space-y-3">
          <SuggestionButton
            suggestion={primary}
            onTabChange={onTabChange}
            primary
          />
          {remaining.length ? (
            <details className="rounded-lg border border-[var(--color-navy-border)] bg-white/4 p-3">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                {remaining.length} more suggested moves
              </summary>
              <div className="mt-3 space-y-2">
                {remaining.map((suggestion) => (
                  <SuggestionButton
                    key={suggestion.id}
                    suggestion={suggestion}
                    onTabChange={onTabChange}
                  />
                ))}
              </div>
            </details>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-slate-500">
          No data-backed editorial moves are currently reported.
        </p>
      )}
    </CompactPanel>
  );
}

function SuggestionButton({
  suggestion,
  onTabChange,
  primary = false,
}: {
  suggestion: CopilotSuggestion;
  onTabChange: (tab: WorkspaceTab) => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={!suggestion.enabled}
      onClick={() => onTabChange(suggestion.targetTab)}
      className={[
        'w-full rounded-lg border px-3 py-2 text-left transition enabled:hover:border-[var(--color-teal)]/40 enabled:hover:bg-[var(--color-teal)]/10 disabled:cursor-not-allowed disabled:opacity-60',
        primary
          ? 'border-[var(--color-teal)]/30 bg-[var(--color-teal)]/10'
          : 'border-[var(--color-navy-border)] bg-white/5',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-semibold text-slate-100">
          {suggestion.title}
        </span>
        <StatusBadge
          status={formatLabel(suggestion.source)}
          tone={suggestion.tone}
          className="shrink-0"
        />
      </div>
      <p className="mt-1 text-xs leading-5 text-slate-400">
        {suggestion.detail}
      </p>
      <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-teal)]">
        Open {formatLabel(suggestion.targetTab)}
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    </button>
  );
}

function RailMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[var(--color-navy-border)] bg-white/5 px-2 py-2 text-center">
      <p className="text-lg font-semibold text-white">{value}</p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </p>
    </div>
  );
}

function RailSignal({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone: StatusBadgeTone;
}) {
  const toneClass =
    tone === 'danger'
      ? 'text-[var(--color-rose)]'
      : tone === 'warning'
        ? 'text-[var(--color-amber)]'
        : tone === 'success'
          ? 'text-[var(--color-green)]'
          : 'text-slate-400';

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-navy-border)] bg-white/5 px-3 py-2">
      <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-200">
        <Icon className={`h-4 w-4 ${toneClass}`} aria-hidden="true" />
        {label}
      </span>
      <StatusBadge status={String(value)} tone={tone} />
    </div>
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

function dedupeSuggestions(suggestions: CopilotSuggestion[]) {
  const seen = new Set<string>();
  return suggestions.filter((suggestion) => {
    const key = `${suggestion.title}:${suggestion.detail}:${suggestion.targetTab}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
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

function AvailableActionsCard({ actions }: { actions: WorkspaceAvailableAction[] }) {
  return (
    <CompactPanel title="Available actions">
      {actions.length ? (
        <div className="space-y-2">
          {actions.map((action) => (
            <div
              key={action.id}
              className="rounded-lg border border-[var(--color-navy-border)] bg-white/5 px-3 py-2 text-sm"
            >
              <p className="font-semibold text-slate-100">{action.label}</p>
              <p className="mt-1 text-xs text-slate-400">
                {action.enabled
                  ? formatLabel(action.targetTab)
                  : action.disabledReason}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">No actions advertised.</p>
      )}
    </CompactPanel>
  );
}
