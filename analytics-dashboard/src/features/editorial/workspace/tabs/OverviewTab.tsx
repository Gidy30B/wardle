import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import type {
  DiagnosisEditorialWorkspace,
  DiagnosisRegistryLifecycleAction,
  DiagnosisRegistryLifecycleEvaluation,
  DiagnosisRegistryLifecycleReport,
  WorkspaceCoverageGap,
  WorkspaceCoverageMatrixRow,
  WorkspaceRecommendedAction,
} from '../../../../api/admin';
import StatusBadge from '../../../../components/ui/StatusBadge';
import type { StatusBadgeTone } from '../../../../components/ui/statusBadgeMeta';
import {
  CompactPanel,
  EditorialStream,
  EditorialRow,
  IssueSummaryStrip,
  MessageList,
  MetricGrid,
  PrototypeSectionHeader,
  SectionActionGroup,
  StreamDisclosure,
  StatusStrip,
} from '../EditorialPrimitives';
import {
  CoverageGapsCard,
  CoverageMatrixCard,
  CoverageScoreCard,
  ReadinessBreakdownCard,
} from '../CoveragePanels';
import {
  coverageGapSource,
  formatLabel,
  formatScore,
  formatSummaryValue,
  scoreTone,
  severityRank,
} from '../workspaceTransforms';
import type { WorkspaceTab } from '../workspaceTypes';
export function OverviewTab({
  workspace,
  selectedRow,
  onRowSelect,
  onGapSelect,
  onTabChange,
  canRunSeniorActions,
  seniorDisabledReason,
  pendingAction,
  onLifecycleAction,
  onNormalizeLifecycleFlags,
}: {
  workspace: DiagnosisEditorialWorkspace;
  selectedRow: WorkspaceCoverageMatrixRow | null;
  onRowSelect: (row: WorkspaceCoverageMatrixRow) => void;
  onGapSelect: (gap: WorkspaceCoverageGap) => void;
  onTabChange: (tab: WorkspaceTab) => void;
  canRunSeniorActions: boolean;
  seniorDisabledReason: string;
  pendingAction: string | null;
  onLifecycleAction: (action: DiagnosisRegistryLifecycleAction) => void;
  onNormalizeLifecycleFlags: () => void;
}) {
  const blockers = workspace.workspaceSummary.blockers;
  const warnings = workspace.workspaceSummary.warnings;
  const hasIssues = blockers.length > 0 || warnings.length > 0;

  return (
    <div className="space-y-4">
      <EditorialStream
        eyebrow="Overview"
        title="Publication readiness narrative"
        subtitle="Read from blockers to highest-impact fixes, then open diagnostics only when the local decision needs it."
      >
        {hasIssues ? (
          <div>
            <PrototypeSectionHeader
              eyebrow="Readiness blockers"
              title="Resolve editorial blockers before maturity review"
              subtitle="Highest-impact blockers and warnings from the workspace read model."
            />
            <div className="mt-3">
              <IssueSummaryStrip blockers={blockers} warnings={warnings} />
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-[var(--color-green)]/25 bg-[var(--color-green)]/10 px-3 py-2 text-sm font-semibold text-[var(--color-green)]">
            No publication blockers are currently reported.
          </div>
        )}

        <RecommendedActionsCard
          actions={workspace.recommendedActions}
          onTabChange={onTabChange}
        />

        <StreamDisclosure
          title="Maturity and coverage diagnostics"
          summary={`${workspace.coverageGaps.length} coverage gaps, ${workspace.readinessBreakdown.length} readiness signals`}
        >
          <div className="space-y-4">
            <StatusStrip
              items={[
                {
                  label: 'Coverage',
                  value: formatScore(workspace.workspaceSummary.overallScore),
                  detail: `${workspace.coverageMatrix.filter((r) => r.fullCoverageStatus === 'covered').length}/${workspace.coverageMatrix.length} teaching rules covered`,
                  tone: scoreTone(workspace.workspaceSummary.overallScore),
                },
                {
                  label: 'Usable cases',
                  value: `${workspace.cases.summary.usable}/${workspace.cases.summary.total}`,
                  detail: 'Case inventory',
                  tone: workspace.cases.summary.usable ? 'success' : 'warning',
                },
                {
                  label: 'Clinical picture',
                  value: formatLabel(workspace.education.status),
                  detail: `Quality ${formatScore(workspace.workspaceSummary.educationScore)}`,
                  tone: scoreTone(workspace.workspaceSummary.educationScore),
                },
                {
                  label: 'Open actions',
                  value: workspace.recommendedActions.length,
                  detail: 'Recommended next moves',
                  tone: workspace.recommendedActions.length ? 'warning' : 'success',
                },
              ]}
            />
            <CoverageGapsCard
              gaps={workspace.coverageGaps}
              onGapSelect={onGapSelect}
            />
            <ExplainabilityPanel
              workspace={workspace}
              onTabChange={onTabChange}
              onGapSelect={onGapSelect}
            />
            <CoverageMatrixCard
              rows={workspace.coverageMatrix}
              selectedRow={selectedRow}
              onRowSelect={onRowSelect}
            />
          </div>
        </StreamDisclosure>

        <StreamDisclosure
          title="Embedded governance"
          summary="Lifecycle, onboarding, readiness, and score details"
        >
          <div className="space-y-4">
            <OnboardingCard workspace={workspace} onTabChange={onTabChange} />
            <ReadinessBreakdownCard
              items={workspace.readinessBreakdown}
              onTabChange={onTabChange}
            />
            <LifecycleGovernanceCard
              lifecycle={workspace.lifecycleGovernance}
              canRunSeniorActions={canRunSeniorActions}
              seniorDisabledReason={seniorDisabledReason}
              pendingAction={pendingAction}
              onAction={onLifecycleAction}
              onNormalizeLifecycleFlags={onNormalizeLifecycleFlags}
            />
            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <WorkspaceSummaryCard workspace={workspace} />
              <CoverageScoreCard workspace={workspace} />
            </div>
          </div>
        </StreamDisclosure>
      </EditorialStream>
    </div>
  );
}

function OnboardingCard({
  workspace,
  onTabChange,
}: {
  workspace: DiagnosisEditorialWorkspace;
  onTabChange: (tab: WorkspaceTab) => void;
}) {
  const onboarding = workspace.onboarding;
  if (!onboarding) {
    return null;
  }

  return (
    <CompactPanel title="Registry onboarding">
      <div className="grid gap-3 lg:grid-cols-[240px_1fr]">
        <div className="rounded-lg border border-[var(--color-navy-border)] bg-white/5 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Progress
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-100">
            {onboarding.progress.percent}%
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-[var(--color-green)]"
              style={{ width: `${onboarding.progress.percent}%` }}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <StatusBadge status={formatLabel(onboarding.onboardingStatus)} />
            <StatusBadge status={formatLabel(onboarding.readiness)} tone="info" />
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Missing components
            </p>
            {onboarding.missingComponents.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {onboarding.missingComponents.map((component) => (
                  <StatusBadge
                    key={component}
                    status={formatLabel(component)}
                    tone="warning"
                  />
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-400">
                Core editorial assets are present.
              </p>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Recommended actions
            </p>
            {onboarding.recommendedActions.length ? (
              <SectionActionGroup>
                {onboarding.recommendedActions.slice(0, 6).map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => onTabChange(action.targetTab)}
                    className="editorial-action"
                    title={action.reason}
                  >
                    {action.label}
                  </button>
                ))}
              </SectionActionGroup>
            ) : (
              <p className="mt-2 text-sm text-slate-400">
                No onboarding recommendations remain.
              </p>
            )}
          </div>
        </div>
      </div>
    </CompactPanel>
  );
}

function LifecycleGovernanceCard({
  lifecycle,
  canRunSeniorActions,
  seniorDisabledReason,
  pendingAction,
  onAction,
  onNormalizeLifecycleFlags,
}: {
  lifecycle?: DiagnosisRegistryLifecycleReport | null;
  canRunSeniorActions: boolean;
  seniorDisabledReason: string;
  pendingAction: string | null;
  onAction: (action: DiagnosisRegistryLifecycleAction) => void;
  onNormalizeLifecycleFlags: () => void;
}) {
  if (!lifecycle) {
    return null;
  }

  const actionButtons: Array<{
    action: DiagnosisRegistryLifecycleAction;
    label: string;
    enabled: boolean;
  }> = [
    {
      action: lifecycle.lifecycle.active ? 'deactivate' : 'activate',
      label: lifecycle.lifecycle.active ? 'Deactivate' : 'Activate',
      enabled:
        lifecycle.lifecycle.active || lifecycle.readiness.activation.allowed,
    },
    {
      action: lifecycle.lifecycle.isPlayable ? 'unmark_playable' : 'mark_playable',
      label: lifecycle.lifecycle.isPlayable ? 'Unmark playable' : 'Mark playable',
      enabled:
        lifecycle.lifecycle.isPlayable || lifecycle.readiness.playability.allowed,
    },
    {
      action: lifecycle.lifecycle.isGeneratable
        ? 'unmark_generatable'
        : 'mark_generatable',
      label: lifecycle.lifecycle.isGeneratable
        ? 'Unmark generatable'
        : 'Mark generatable',
      enabled:
        lifecycle.lifecycle.isGeneratable ||
        lifecycle.readiness.generatability.allowed,
    },
  ];

  return (
    <CompactPanel title="Lifecycle governance">
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <LifecycleMetric
            label="Active"
            value={lifecycle.lifecycle.active ? 'Yes' : 'No'}
            tone={lifecycle.lifecycle.active ? 'success' : 'warning'}
          />
          <LifecycleMetric
            label="Playable"
            value={lifecycle.lifecycle.isPlayable ? 'Yes' : 'No'}
            tone={lifecycle.lifecycle.isPlayable ? 'success' : 'warning'}
          />
          <LifecycleMetric
            label="Generatable"
            value={lifecycle.lifecycle.isGeneratable ? 'Yes' : 'No'}
            tone={lifecycle.lifecycle.isGeneratable ? 'success' : 'warning'}
          />
          <LifecycleMetric
            label="Onboarding"
            value={formatLabel(lifecycle.lifecycle.onboardingStatus ?? 'NEW')}
            tone="info"
          />
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <ReadinessMeter
            title="Activation readiness"
            evaluation={lifecycle.readiness.activation}
            fix="Clear activation blockers, then use Activate."
          />
          <ReadinessMeter
            title="Playability readiness"
            evaluation={lifecycle.readiness.playability}
            fix="Resolve playability blockers, then mark playable."
          />
          <ReadinessMeter
            title="Generatability readiness"
            evaluation={lifecycle.readiness.generatability}
            fix="Resolve generation prerequisites, then mark generatable."
          />
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <LifecycleList
            title="Blockers"
            items={lifecycle.blockers}
            emptyText="No lifecycle blockers."
            tone="danger"
          />
          <LifecycleList
            title="Warnings"
            items={lifecycle.warnings}
            emptyText="No lifecycle warnings."
            tone="warning"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <StatusBadge
            status={`Canonical duplicates: ${lifecycle.duplicateRisk.registryCanonicalMatches}`}
            tone={lifecycle.duplicateRisk.registryCanonicalMatches ? 'danger' : 'success'}
          />
          <StatusBadge
            status={`Alias duplicates: ${lifecycle.duplicateRisk.registryAliasMatches}`}
            tone={lifecycle.duplicateRisk.registryAliasMatches ? 'danger' : 'success'}
          />
          <StatusBadge
            status={`Candidate conflicts: ${lifecycle.duplicateRisk.pendingCandidateConflicts}`}
            tone={lifecycle.duplicateRisk.pendingCandidateConflicts ? 'warning' : 'success'}
          />
          {hasDuplicateRisk(lifecycle) ? (
            <Link
              to={`/editorial/registry-merge?source=${lifecycle.diagnosisRegistryId}`}
              className="rounded-md border border-[var(--color-amber)]/30 bg-[var(--color-amber)]/10 px-3 py-1.5 text-sm font-semibold text-[var(--color-amber)] transition hover:bg-[var(--color-amber)]/15"
            >
              Potential duplicate
            </Link>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {actionButtons.map((button) => {
            const disabled =
              pendingAction !== null ||
              !canRunSeniorActions ||
              !button.enabled;
            const title = !canRunSeniorActions
              ? seniorDisabledReason
              : !button.enabled
                ? 'Resolve lifecycle blockers first'
                : undefined;
            return (
              <button
                key={button.action}
                type="button"
                disabled={disabled}
                title={title}
                onClick={() => onAction(button.action)}
                className="editorial-action disabled:cursor-not-allowed disabled:opacity-50"
              >
                {button.label}
              </button>
            );
          })}
          <button
            type="button"
            disabled={pendingAction !== null || !canRunSeniorActions}
            title={!canRunSeniorActions ? seniorDisabledReason : undefined}
            onClick={onNormalizeLifecycleFlags}
            className="rounded-md border border-[var(--color-amber)]/30 bg-[var(--color-amber)]/10 px-3 py-1.5 text-sm font-semibold text-[var(--color-amber)] transition hover:bg-[var(--color-amber)]/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Normalize lifecycle flags
          </button>
        </div>
      </div>
    </CompactPanel>
  );
}

function LifecycleMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: StatusBadgeTone;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-navy-border)] bg-white/5 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <div className="mt-2">
        <StatusBadge status={value} tone={tone} />
      </div>
    </div>
  );
}

function hasDuplicateRisk(lifecycle: DiagnosisRegistryLifecycleReport) {
  return (
    lifecycle.duplicateRisk.registryCanonicalMatches > 0 ||
    lifecycle.duplicateRisk.registryAliasMatches > 0 ||
    lifecycle.duplicateRisk.pendingCandidateConflicts > 0
  );
}

function ReadinessMeter({
  title,
  evaluation,
  fix,
}: {
  title: string;
  evaluation: DiagnosisRegistryLifecycleEvaluation;
  fix?: string;
}) {
  const tone: StatusBadgeTone = evaluation.allowed ? 'success' : 'warning';
  return (
    <div className="rounded-lg border border-[var(--color-navy-border)] bg-white/5 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-100">{title}</p>
        <StatusBadge
          status={`${evaluation.readinessScore}%`}
          tone={tone}
        />
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
        <div
          className={[
            'h-full rounded-full',
            evaluation.allowed ? 'bg-[var(--color-green)]' : 'bg-[var(--color-amber)]',
          ].join(' ')}
          style={{ width: `${evaluation.readinessScore}%` }}
        />
      </div>
      {evaluation.blockers.length || evaluation.warnings.length ? (
        <div className="mt-3 space-y-1 text-xs text-slate-400">
          {[...evaluation.blockers, ...evaluation.warnings].slice(0, 3).map((item) => (
            <p key={item}>{item}</p>
          ))}
          {fix ? <p className="font-semibold text-slate-300">{fix}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function ExplainabilityPanel({
  workspace,
  onTabChange,
  onGapSelect,
}: {
  workspace: DiagnosisEditorialWorkspace;
  onTabChange: (tab: WorkspaceTab) => void;
  onGapSelect: (gap: WorkspaceCoverageGap) => void;
}) {
  const weakSections = workspace.education.sectionHealth.filter(
    (section) =>
      section.regenerationRecommended ||
      section.blockers.length > 0 ||
      section.warnings.length > 0,
  );
  const readinessItems = [...workspace.readinessBreakdown].sort(
    (left, right) => severityRank(left.severity) - severityRank(right.severity),
  );
  const lifecycleFailures = [
    ...(workspace.lifecycleGovernance?.blockers ?? []),
    ...(workspace.lifecycleGovernance?.warnings ?? []),
  ];
  const hasItems =
    workspace.workspaceSummary.blockers.length ||
    workspace.workspaceSummary.warnings.length ||
    weakSections.length ||
    workspace.coverageGaps.length ||
    readinessItems.length ||
    lifecycleFailures.length;

  return (
    <CompactPanel title="Why this is not ready">
      {hasItems ? (
        <div className="space-y-3">
          {workspace.workspaceSummary.blockers.slice(0, 3).map((message, index) => (
            <ExplainabilityItem
              key={`blocker-${index}`}
              title="Workspace blocker"
              causedBy={message}
              action="Review the source tab and clear the blocking issue before lifecycle promotion."
              tone="danger"
              onOpen={() => onTabChange('overview')}
            />
          ))}
          {workspace.workspaceSummary.warnings.slice(0, 3).map((message, index) => (
            <ExplainabilityItem
              key={`warning-${index}`}
              title="Workspace warning"
              causedBy={message}
              action="Inspect the warning and decide whether to revise or accept the residual risk."
              tone="warning"
              onOpen={() => onTabChange('overview')}
            />
          ))}
          {weakSections.slice(0, 4).map((section) => (
            <ExplainabilityItem
              key={`section-${section.section}`}
              title={`Weak ${formatLabel(section.section)} section`}
              causedBy={
                section.reason ??
                section.blockers[0] ??
                section.warnings[0] ??
                `Score ${formatScore(section.score)} with regeneration recommended.`
              }
              action="Regenerate the weak section as a draft, then review before accepting."
              tone={section.blockers.length ? 'danger' : 'warning'}
              onOpen={() => onTabChange('education')}
            />
          ))}
          {workspace.coverageGaps.slice(0, 5).map((gap, index) => (
            <ExplainabilityItem
              key={`gap-${gap.teachingRuleId ?? gap.title}-${index}`}
              title={gap.title}
              causedBy={`Missing ${coverageGapSource(gap)} coverage.`}
              action={gap.recommendedAction}
              tone={gap.severity === 'blocker' ? 'danger' : 'warning'}
              onOpen={() => onGapSelect(gap)}
            />
          ))}
          {readinessItems.slice(0, 4).map((item, index) => (
            <ExplainabilityItem
              key={`ready-${item.actionId}-${index}`}
              title={formatLabel(item.source)}
              causedBy={item.message}
              action={`Open ${formatLabel(item.targetTab)} and complete the indicated editorial work.`}
              tone={item.severity === 'blocker' ? 'danger' : 'warning'}
              onOpen={() => onTabChange(item.targetTab)}
            />
          ))}
          {lifecycleFailures.slice(0, 3).map((failure, index) => (
            <ExplainabilityItem
              key={`lifecycle-${index}`}
              title="Lifecycle failure"
              causedBy={failure}
              action="Clear the lifecycle readiness item before changing active/playable/generatable state."
              tone={workspace.lifecycleGovernance?.blockers.includes(failure) ? 'danger' : 'warning'}
              onOpen={() => onTabChange('overview')}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">
          No blockers, warnings, weak sections, coverage gaps, or lifecycle failures
          are currently reported by the workspace read model.
        </p>
      )}
    </CompactPanel>
  );
}

function ExplainabilityItem({
  title,
  causedBy,
  action,
  tone,
  onOpen,
}: {
  title: string;
  causedBy: string;
  action: string;
  tone: StatusBadgeTone;
  onOpen: () => void;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-navy-border)] bg-white/5 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-100">{title}</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            <span className="font-semibold text-slate-300">Caused by: </span>
            {causedBy}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            <span className="font-semibold text-slate-300">Fix: </span>
            {action}
          </p>
        </div>
        <StatusBadge status={tone === 'danger' ? 'Blocked' : 'Needs review'} tone={tone} />
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-teal)]"
      >
        Open source
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

function LifecycleList({
  title,
  items,
  emptyText,
  tone,
}: {
  title: string;
  items: string[];
  emptyText: string;
  tone: StatusBadgeTone;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {title}
      </p>
      {items.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {items.slice(0, 8).map((item) => (
            <StatusBadge key={item} status={item} tone={tone} />
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-400">{emptyText}</p>
      )}
    </div>
  );
}

function WorkspaceSummaryCard({
  workspace,
}: {
  workspace: DiagnosisEditorialWorkspace;
}) {
  const summary = workspace.workspaceSummary;
  return (
    <CompactPanel title="Workspace summary">
      <MetricGrid
        items={[
          { label: 'Status', value: formatLabel(summary.status) },
          { label: 'Overall score', value: formatScore(summary.overallScore) },
          { label: 'Education score', value: formatScore(summary.educationScore) },
          { label: 'Graph readiness', value: formatSummaryValue(summary.graphReadiness) },
          {
            label: 'Differential links',
            value: summary.differentialCoverage
              ? `${summary.differentialCoverage.resolvedLinks}/${summary.differentialCoverage.totalDifferentials}`
              : '0/0',
          },
        ]}
      />
      {summary.blockers.length || summary.warnings.length ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <MessageList title="Blockers" tone="blocker" messages={summary.blockers} />
          <MessageList title="Warnings" tone="warning" messages={summary.warnings} />
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500">No workspace blockers loaded.</p>
      )}
    </CompactPanel>
  );
}

function RecommendedActionsCard({
  actions,
  onTabChange,
}: {
  actions: WorkspaceRecommendedAction[];
  onTabChange: (tab: WorkspaceTab) => void;
}) {
  return (
    <CompactPanel title="Recommended actions">
      {actions.length ? (
        <div className="space-y-2">
          {actions.map((action) => (
            <EditorialRow
              key={action.id}
              title={action.label}
              subtitle={
                action.disabledReason ??
                `Open ${formatLabel(action.targetTab)} to continue.`
              }
              tone={
                action.severity === 'blocker'
                  ? 'danger'
                  : action.severity === 'warning'
                    ? 'warning'
                    : 'info'
              }
              meta={
                <StatusBadge
                  status={formatLabel(action.source ?? action.targetTab)}
                  tone="neutral"
                />
              }
              action={
                <button
                  type="button"
                  disabled={!action.enabled}
                  onClick={() => onTabChange(action.targetTab)}
                  className="editorial-action disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Open
                </button>
              }
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">No recommended actions yet.</p>
      )}
    </CompactPanel>
  );
}
