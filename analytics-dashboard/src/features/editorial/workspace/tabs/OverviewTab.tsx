import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import type {
  DiagnosisEditorialWorkspace,
  DiagnosisRegistryLifecycleAction,
  DiagnosisRegistryLifecycleEvaluation,
  DiagnosisRegistryLifecycleReport,
  WorkspaceCoverageGap,
  WorkspaceRecommendedAction,
} from '../../../../api/admin';
import StatusBadge from '../../../../components/ui/StatusBadge';
import type { StatusBadgeTone } from '../../../../components/ui/statusBadgeMeta';
import {
  EditorialNarrativeThread,
  LearnerFailureProjection,
  NarrativeCheckpoint,
  NarrativeStream,
  ReasoningTransition,
} from '../EditorialNarrativePrimitives';
import {
  CompactPanel,
  EditorialStream,
  EditorialRow,
  IssueSummaryStrip,
  MessageList,
  MetricGrid,
  SectionActionGroup,
  StreamDisclosure,
  StatusStrip,
} from '../EditorialPrimitives';
import {
  CoverageGapsCard,
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
  onGapSelect,
  onTabChange,
  canRunSeniorActions,
  seniorDisabledReason,
  pendingAction,
  onLifecycleAction,
  onNormalizeLifecycleFlags,
}: {
  workspace: DiagnosisEditorialWorkspace;
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
  const story = buildOverviewStory(workspace, onTabChange, onGapSelect);
  const primaryAction = story.primaryAction;

  return (
    <div className="space-y-4">
      <EditorialStream
        eyebrow="Overview"
        title="Publication readiness narrative"
        subtitle="Read from blockers to highest-impact fixes, then open diagnostics only when the local decision needs it."
      >
        <EditorialNarrativeThread
          eyebrow="Publication readiness"
          title={story.title}
          subtitle={story.subtitle}
          tone={story.tone}
          state={<StatusBadge status={formatLabel(workspace.workspaceSummary.status)} tone={story.tone} />}
          action={
            primaryAction ? (
              <button
                type="button"
                disabled={!primaryAction.enabled}
                onClick={() => onTabChange(primaryAction.targetTab)}
                className="editorial-action editorial-action-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {primaryAction.label}
              </button>
            ) : null
          }
        >
          <NarrativeStream>
            <NarrativeCheckpoint
              tone={story.tone}
              marker={<StoryMarker>Current state</StoryMarker>}
              title={story.currentState}
            >
              <StatusStrip
                items={[
                  {
                    label: 'Maturity',
                    value: formatScore(workspace.workspaceSummary.overallScore),
                    detail: 'Publication readiness score',
                    tone: scoreTone(workspace.workspaceSummary.overallScore),
                  },
                  {
                    label: 'Lifecycle',
                    value: formatLabel(workspace.lifecycle.ready),
                    detail: 'Ready-state flag',
                    tone:
                      workspace.lifecycle.ready === 'complete'
                        ? 'success'
                        : workspace.lifecycle.ready === 'blocked'
                          ? 'danger'
                          : 'warning',
                  },
                  {
                    label: 'Cases',
                    value: `${workspace.cases.summary.usable}/${workspace.cases.summary.total}`,
                    detail: 'Usable playable cases',
                    tone: workspace.cases.summary.usable ? 'success' : 'warning',
                  },
                  {
                    label: 'Graph',
                    value: formatLabel(workspace.graph.readiness),
                    detail: 'Differential map readiness',
                    tone:
                      workspace.graph.readiness === 'ready'
                        ? 'success'
                        : 'warning',
                  },
                ]}
              />
            </NarrativeCheckpoint>

            <ReasoningTransition tone={story.blocker.tone}>
              Publication depends on clearing the most important blocker first.
            </ReasoningTransition>

            <NarrativeCheckpoint
              tone={story.blocker.tone}
              marker={<StoryMarker>Primary blocker</StoryMarker>}
              title={story.blocker.title}
              state={<StatusBadge status={story.blocker.badge} tone={story.blocker.tone} />}
            >
              <p className="text-xs leading-5 text-slate-400">{story.blocker.detail}</p>
              {blockers.length || warnings.length ? (
                <IssueSummaryStrip blockers={blockers} warnings={warnings} />
              ) : null}
            </NarrativeCheckpoint>

            <ReasoningTransition tone={story.learnerRisk.tone}>
              The blocker matters because it changes what the learner can safely recognize.
            </ReasoningTransition>

            <NarrativeCheckpoint
              tone={story.learnerRisk.tone}
              marker={<StoryMarker>Learner risk</StoryMarker>}
              title={story.learnerRisk.title}
              state={<StatusBadge status={story.learnerRisk.badge} tone={story.learnerRisk.tone} />}
            >
              {story.learnerRisk.detail ? (
                <LearnerFailureProjection tone={story.learnerRisk.tone}>
                  {story.learnerRisk.detail}
                </LearnerFailureProjection>
              ) : null}
            </NarrativeCheckpoint>

            <ReasoningTransition tone={story.gap.tone}>
              The next gap tells us where editorial effort has the highest clinical leverage.
            </ReasoningTransition>

            <NarrativeCheckpoint
              tone={story.gap.tone}
              marker={<StoryMarker>First gap</StoryMarker>}
              title={story.gap.title}
              state={<StatusBadge status={story.gap.badge} tone={story.gap.tone} />}
            >
              <p className="text-xs leading-5 text-slate-400">{story.gap.detail}</p>
              {story.gap.action ? (
                <button
                  type="button"
                  onClick={story.gap.action}
                  className="editorial-action px-2.5 py-1.5 text-xs"
                >
                  Open source
                </button>
              ) : null}
            </NarrativeCheckpoint>

            <ReasoningTransition tone={story.fix.tone}>
              Choose one next move, then use the diagnostics only to explain the decision.
            </ReasoningTransition>

            <NarrativeCheckpoint
              tone={story.fix.tone}
              marker={<StoryMarker>Highest-impact fix</StoryMarker>}
              title={story.fix.title}
              state={<StatusBadge status={story.fix.badge} tone={story.fix.tone} />}
            >
              <p className="text-xs leading-5 text-slate-400">{story.fix.detail}</p>
              {primaryAction ? (
                <button
                  type="button"
                  disabled={!primaryAction.enabled}
                  onClick={() => onTabChange(primaryAction.targetTab)}
                  className="editorial-action editorial-action-primary px-2.5 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {primaryAction.label}
                </button>
              ) : null}
            </NarrativeCheckpoint>

            <NarrativeCheckpoint
              tone={story.path.tone}
              marker={<StoryMarker>Readiness path</StoryMarker>}
              title={story.path.title}
            >
              <MessageList
                title="Next readiness signals"
                tone={story.path.tone === 'danger' ? 'blocker' : 'warning'}
                messages={story.path.items}
              />
            </NarrativeCheckpoint>
          </NarrativeStream>
        </EditorialNarrativeThread>

        <StreamDisclosure
          title="Secondary actions"
          summary={`${workspace.recommendedActions.length} recommended action${workspace.recommendedActions.length === 1 ? '' : 's'}`}
        >
          <div className="space-y-4">
            <RecommendedActionsCard
              actions={workspace.recommendedActions}
              onTabChange={onTabChange}
            />
            <CoverageGapsCard
              gaps={workspace.coverageGaps}
              onGapSelect={onGapSelect}
            />
          </div>
        </StreamDisclosure>

        <StreamDisclosure
          title="Readiness diagnostics"
          summary={`${workspace.readinessBreakdown.length} readiness signals, ${workspace.coverageGaps.length} traceable gaps`}
        >
          <div className="space-y-4">
            <ExplainabilityPanel
              workspace={workspace}
              onTabChange={onTabChange}
              onGapSelect={onGapSelect}
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
              <MaturityExplanationCard workspace={workspace} />
            </div>
          </div>
        </StreamDisclosure>
      </EditorialStream>
    </div>
  );
}

type OverviewStory = {
  title: string;
  subtitle: string;
  tone: StatusBadgeTone;
  currentState: string;
  primaryAction: {
    label: string;
    targetTab: WorkspaceTab;
    enabled: boolean;
  } | null;
  blocker: {
    title: string;
    detail: string;
    badge: string;
    tone: StatusBadgeTone;
  };
  learnerRisk: {
    title: string;
    detail: string | null;
    badge: string;
    tone: StatusBadgeTone;
  };
  gap: {
    title: string;
    detail: string;
    badge: string;
    tone: StatusBadgeTone;
    action?: () => void;
  };
  fix: {
    title: string;
    detail: string;
    badge: string;
    tone: StatusBadgeTone;
  };
  path: {
    title: string;
    items: string[];
    tone: StatusBadgeTone;
  };
};

function StoryMarker({ children }: { children: string }) {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
      {children}
    </span>
  );
}

function buildOverviewStory(
  workspace: DiagnosisEditorialWorkspace,
  onTabChange: (tab: WorkspaceTab) => void,
  onGapSelect: (gap: WorkspaceCoverageGap) => void,
): OverviewStory {
  const blockers = workspace.workspaceSummary.blockers;
  const warnings = workspace.workspaceSummary.warnings;
  const lifecycleBlocker = workspace.lifecycleGovernance?.blockers[0] ?? null;
  const lifecycleWarning = workspace.lifecycleGovernance?.warnings[0] ?? null;
  const blockerGap =
    workspace.coverageGaps.find((gap) => gap.severity === 'blocker') ?? null;
  const blockingClaim =
    (workspace.unsupportedClaimsBySection ?? []).find(
      (claim) => claim.blocksPublication,
    ) ?? null;
  const firstClaim = blockingClaim ?? (workspace.unsupportedClaimsBySection ?? [])[0];
  const differentialCoverage = workspace.workspaceSummary.differentialCoverage;
  const unresolvedDifferentials =
    differentialCoverage && differentialCoverage.totalDifferentials > 0
      ? Math.max(
          0,
          differentialCoverage.totalDifferentials -
            differentialCoverage.resolvedLinks,
        )
      : workspace.workspaceSummary.unresolvedDifferentialCount ?? 0;
  const primaryFix =
    workspace.editorialPrioritization?.highestImpactFixes[0] ?? null;
  const recommendedAction =
    workspace.recommendedActions.find((action) => action.enabled) ??
    workspace.recommendedActions[0] ??
    null;
  const primaryAction = primaryFix
    ? {
        label: primaryFix.label,
        targetTab: normalizeOverviewTargetTab(primaryFix.targetTab),
        enabled: true,
      }
    : recommendedAction
      ? {
          label: recommendedAction.label,
          targetTab: normalizeOverviewTargetTab(recommendedAction.targetTab),
          enabled: recommendedAction.enabled,
        }
      : null;
  const tone: StatusBadgeTone = blockers.length
    ? 'danger'
    : warnings.length ||
        workspace.coverageGaps.length ||
        (workspace.unsupportedClaimsBySection ?? []).length
      ? 'warning'
      : scoreTone(workspace.workspaceSummary.overallScore);

  const blocker = blockers[0]
    ? {
        title: blockers[0],
        detail: 'This workspace blocker must be cleared before publication readiness can advance.',
        badge: 'Blocked',
        tone: 'danger' as StatusBadgeTone,
      }
    : lifecycleBlocker
      ? {
          title: lifecycleBlocker,
          detail:
            'Lifecycle governance is preventing activation, playability, or generation promotion.',
          badge: 'Lifecycle blocker',
          tone: 'danger' as StatusBadgeTone,
        }
      : blockerGap
        ? {
            title: blockerGap.title,
            detail: blockerGap.recommendedAction,
            badge: 'Coverage blocker',
            tone: 'danger' as StatusBadgeTone,
          }
        : warnings[0] ?? lifecycleWarning
          ? {
              title: warnings[0] ?? lifecycleWarning ?? 'Warning',
              detail:
                'No hard publication blocker is reported, but this warning should be resolved or accepted explicitly.',
              badge: 'Needs review',
              tone: 'warning' as StatusBadgeTone,
            }
          : {
              title: 'No publication blockers are currently reported.',
              detail:
                'The workspace read model is not reporting a blocker or warning on the primary publication path.',
              badge: 'Clear',
              tone: 'success' as StatusBadgeTone,
            };

  const learnerRisk = workspace.editorialPrioritization?.learnerRisk ?? null;
  const learnerRiskTone = riskTierTone(learnerRisk?.tier);
  const learnerRiskReasons =
    workspace.editorialPrioritization?.triageReasons ??
    workspace.editorialPrioritization?.editorialPriority.reasons ??
    [];

  const firstGap = workspace.coverageGaps[0] ?? null;
  const gap = firstClaim
    ? {
        title: `Unsupported ${formatLabel(firstClaim.sectionType)} claim needs integrity review.`,
        detail: firstClaim.claimText,
        badge: firstClaim.blocksPublication ? 'Claim blocker' : 'Unsupported claim',
        tone: firstClaim.blocksPublication
          ? ('danger' as StatusBadgeTone)
          : ('warning' as StatusBadgeTone),
        action: () => onTabChange('integrity'),
      }
    : firstGap
      ? {
          title: firstGap.title,
          detail: firstGap.recommendedAction,
          badge: formatLabel(coverageGapSource(firstGap)),
          tone:
            firstGap.severity === 'blocker'
              ? ('danger' as StatusBadgeTone)
              : ('warning' as StatusBadgeTone),
          action: () => onGapSelect(firstGap),
        }
      : workspace.cases.summary.usable === 0
        ? {
            title: 'No usable case is available for learner practice.',
            detail:
              'Create or review a playable case before treating this diagnosis as learner-ready.',
            badge: 'Case gap',
            tone: 'warning' as StatusBadgeTone,
            action: () => onTabChange('cases'),
          }
        : unresolvedDifferentials > 0
          ? {
              title: `${unresolvedDifferentials} differential link${unresolvedDifferentials === 1 ? '' : 's'} remain unresolved.`,
              detail:
                'Resolve discriminator and mimic mapping so learners can safely distinguish this diagnosis.',
              badge: 'Discriminator gap',
              tone: 'warning' as StatusBadgeTone,
              action: () => onTabChange('graph'),
            }
          : {
              title: 'No claim, case, or discriminator gap is currently first in line.',
              detail:
                'The highest-priority gaps are clear; use secondary diagnostics for residual maintenance work.',
              badge: 'No first gap',
              tone: 'success' as StatusBadgeTone,
            };

  const fix = primaryFix
    ? {
        title: primaryFix.label,
        detail: primaryFix.reason,
        badge: formatLabel(primaryFix.severity),
        tone: severityTone(primaryFix.severity),
      }
    : recommendedAction
      ? {
          title: recommendedAction.label,
          detail:
            recommendedAction.disabledReason ??
            `Open ${formatLabel(recommendedAction.targetTab)} to continue.`,
          badge: formatLabel(recommendedAction.severity ?? 'info'),
          tone: severityTone(recommendedAction.severity),
        }
      : {
          title: 'No next action is currently recommended.',
          detail:
            'The workspace has no explicit recommended action; continue with routine editorial review.',
          badge: 'No action',
          tone: 'success' as StatusBadgeTone,
        };

  const pathItems = [
    ...workspace.readinessBreakdown
      .slice()
      .sort(
        (left, right) => severityRank(left.severity) - severityRank(right.severity),
      )
      .slice(0, 4)
      .map((item) => item.message),
    ...(workspace.maturityExplanation ?? []).slice(0, 3),
  ].filter(Boolean);

  return {
    title:
      tone === 'danger'
        ? 'Publication is blocked'
        : tone === 'warning'
          ? 'Publication needs editorial review'
          : 'Publication path is clear',
    subtitle:
      workspace.editorialPrioritization?.recommendedNextAction ??
      primaryAction?.label ??
      'Review the readiness path and confirm no residual editorial risk remains.',
    tone,
    currentState: `${workspace.diagnosis.displayLabel} is ${formatLabel(
      workspace.workspaceSummary.status,
    )} with ${blockers.length} blocker${blockers.length === 1 ? '' : 's'}, ${
      warnings.length
    } warning${warnings.length === 1 ? '' : 's'}, and ${
      workspace.coverageGaps.length
    } traceable gap${workspace.coverageGaps.length === 1 ? '' : 's'}.`,
    primaryAction,
    blocker,
    learnerRisk: {
      title: learnerRisk
        ? `Learner risk is ${formatLabel(learnerRisk.tier)} (${learnerRisk.score}).`
        : 'Learner risk has not been scored for this diagnosis.',
      detail: learnerRiskReasons[0] ?? null,
      badge: learnerRisk ? formatLabel(learnerRisk.tier) : 'Unscored',
      tone: learnerRiskTone,
    },
    gap,
    fix,
    path: {
      title: pathItems.length
        ? 'Clear these readiness signals in order, then re-check lifecycle state.'
        : 'No readiness signals are currently blocking the path.',
      items: pathItems.length ? pathItems : ['No readiness signals currently reported.'],
      tone: pathItems.length ? tone : 'success',
    },
  };
}

function normalizeOverviewTargetTab(tab: string | null | undefined): WorkspaceTab {
  if (
    tab === 'overview' ||
    tab === 'teaching-rules' ||
    tab === 'editorial-brief' ||
    tab === 'education' ||
    tab === 'cases' ||
    tab === 'graph' ||
    tab === 'integrity'
  ) {
    return tab;
  }
  return 'overview';
}

function severityTone(severity?: string | null): StatusBadgeTone {
  if (severity === 'blocker') return 'danger';
  if (severity === 'warning') return 'warning';
  return 'info';
}

function riskTierTone(tier?: string | null): StatusBadgeTone {
  if (tier === 'critical' || tier === 'high') return 'danger';
  if (tier === 'medium') return 'warning';
  if (tier === 'low') return 'success';
  return 'info';
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

function MaturityExplanationCard({
  workspace,
}: {
  workspace: DiagnosisEditorialWorkspace;
}) {
  const explanation = workspace.maturityExplanation ?? [];
  const weighting = workspace.maturityWeighting;

  return (
    <CompactPanel title="Maturity explanation">
      {explanation.length ? (
        <MessageList
          title="Explanation"
          tone="warning"
          messages={explanation.slice(0, 6)}
        />
      ) : (
        <p className="text-sm text-slate-500">
          No maturity explanation has been reported yet.
        </p>
      )}
      {weighting ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(weighting).map(([key, value]) => (
            <StatusBadge
              key={key}
              status={`${formatLabel(key)} ${value}`}
              tone="neutral"
            />
          ))}
        </div>
      ) : null}
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
