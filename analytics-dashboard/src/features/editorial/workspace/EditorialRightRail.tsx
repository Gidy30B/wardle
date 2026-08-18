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
import {
  getDefaultWorkspaceSectionForTab,
  getWorkspaceSectionForEducationSection,
  type WorkspaceSectionTarget,
} from './workspaceSectionNavigation';

export function EditorialRightRail({
  workspace,
  activeTab,
  activeSectionId,
  onSectionNavigate,
}: {
  workspace: DiagnosisEditorialWorkspace;
  activeTab: WorkspaceTab;
  activeSectionId: string | null;
  onSectionNavigate: (target: WorkspaceSectionTarget) => void;
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
            activeSectionId={activeSectionId}
            suggestions={suggestions}
            onSectionNavigate={onSectionNavigate}
          />
        </div>
      </details>

      <aside className="hidden space-y-3 xl:sticky xl:top-5 xl:block xl:self-start">
        <RightRailContent
          workspace={workspace}
          activeTab={activeTab}
          activeSectionId={activeSectionId}
          suggestions={suggestions}
          onSectionNavigate={onSectionNavigate}
        />
      </aside>
    </>
  );
}

function RightRailContent({
  workspace,
  activeTab,
  activeSectionId,
  suggestions,
  onSectionNavigate,
}: {
  workspace: DiagnosisEditorialWorkspace;
  activeTab: WorkspaceTab;
  activeSectionId: string | null;
  suggestions: CopilotSuggestion[];
  onSectionNavigate: (target: WorkspaceSectionTarget) => void;
}) {
  return (
    <>
      <ContextualAttentionCard
        workspace={workspace}
        activeTab={activeTab}
        activeSectionId={activeSectionId}
        onSectionNavigate={onSectionNavigate}
      />
      <MaturityRing workspace={workspace} />
      <ReadinessCard workspace={workspace} />
      <PriorityDecisionCard
        workspace={workspace}
        activeTab={activeTab}
        activeSectionId={activeSectionId}
        onSectionNavigate={onSectionNavigate}
      />
      <RecentContextCard workspace={workspace} />
      <ActiveTabHintCard activeTab={activeTab} />
      <IntegrityBlockerCard
        workspace={workspace}
        activeSectionId={activeSectionId}
        onSectionNavigate={onSectionNavigate}
      />
      <RailDetails title="More actions" summary={`${suggestions.length} suggestion${suggestions.length === 1 ? '' : 's'}`}>
        <CopilotSuggestionsCard
        activeTab={activeTab}
        activeSectionId={activeSectionId}
        suggestions={suggestions}
        onSectionNavigate={onSectionNavigate}
      />
      </RailDetails>
    </>
  );
}

type RailCommand = {
  id: string;
  title: string;
  detail: string;
  tone: StatusBadgeTone;
  targetTab: WorkspaceTab;
  sectionId?: string;
  disabled?: boolean;
  todo?: string;
};

function ContextualAttentionCard({
  workspace,
  activeTab,
  activeSectionId,
  onSectionNavigate,
}: {
  workspace: DiagnosisEditorialWorkspace;
  activeTab: WorkspaceTab;
  activeSectionId: string | null;
  onSectionNavigate: (target: WorkspaceSectionTarget) => void;
}) {
  const commands = buildRailCommands(workspace, activeTab);

  return (
    <CompactPanel
      title={`${formatLabel(activeTab)} focus`}
      subtitle="What needs attention now, and where to fix it."
      action={
        <StatusBadge
          status={`${commands.length} item${commands.length === 1 ? '' : 's'}`}
          tone={commands.length ? 'warning' : 'success'}
        />
      }
    >
      {commands.length ? (
        <div className="space-y-2">
          {commands.map((command) => (
            <RailCommandButton
              key={command.id}
              command={command}
              activeTab={activeTab}
              activeSectionId={activeSectionId}
              onSectionNavigate={onSectionNavigate}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm leading-6 text-slate-400">
          No tab-specific attention items are currently reported.
        </p>
      )}
    </CompactPanel>
  );
}

function RailCommandButton({
  command,
  activeTab,
  activeSectionId,
  onSectionNavigate,
}: {
  command: RailCommand;
  activeTab: WorkspaceTab;
  activeSectionId: string | null;
  onSectionNavigate: (target: WorkspaceSectionTarget) => void;
}) {
  const canOpen = !command.disabled && (command.sectionId || command.targetTab !== activeTab);
  const isActive = Boolean(command.sectionId && command.sectionId === activeSectionId);
  const actionLabel = canOpen
    ? command.sectionId
      ? 'Open section'
      : 'Open tab'
    : command.todo ?? 'TODO: add section target';

  function openCommand() {
    if (!canOpen) return;

    if (command.sectionId) {
      onSectionNavigate({
        tab: command.targetTab,
        sectionId: command.sectionId,
      });
    }
  }

  return (
    <button
      type="button"
      disabled={!canOpen}
      aria-disabled={!canOpen}
      onClick={openCommand}
      aria-current={isActive ? 'location' : undefined}
      className={[
        'w-full rounded-lg border px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-[var(--color-navy-border)] disabled:hover:bg-white/5',
        isActive
          ? 'border-[var(--color-teal)]/60 bg-[var(--color-teal)]/14 shadow-[inset_3px_0_0_var(--color-teal)]'
          : 'border-[var(--color-navy-border)] bg-white/5 hover:border-[var(--color-teal)]/40 hover:bg-[var(--color-teal)]/10',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-5 text-slate-100">
          {command.title}
        </p>
        <StatusBadge status={formatLabel(command.targetTab)} tone={command.tone} />
      </div>
      <p className="mt-1 text-xs leading-5 text-slate-400">{command.detail}</p>
      <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-teal)] disabled:text-slate-500">
        {actionLabel}
        {canOpen ? <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /> : null}
      </span>
    </button>
  );
}

function buildRailCommands(
  workspace: DiagnosisEditorialWorkspace,
  activeTab: WorkspaceTab,
): RailCommand[] {
  switch (activeTab) {
    case 'overview':
      return buildOverviewCommands(workspace);
    case 'teaching-rules':
      return buildTeachingCommands(workspace);
    case 'education':
      return buildEducationCommands(workspace);
    case 'cases':
      return buildCaseCommands(workspace);
    case 'graph':
      return buildGraphCommands(workspace);
    case 'integrity':
      return buildIntegrityCommands(workspace);
    case 'editorial-brief':
      return buildObjectivesCommands(workspace);
    default:
      return [];
  }
}

function compactRailCommands(items: Array<RailCommand | null>) {
  return items.filter((item): item is RailCommand => item !== null);
}

function buildOverviewCommands(workspace: DiagnosisEditorialWorkspace): RailCommand[] {
  const commands: RailCommand[] = [];
  const firstGap = workspace.coverageGaps[0] ?? null;
  const blockerSignal = workspace.readinessBreakdown.find(
    (item) => item.severity === 'blocker',
  );
  const primaryAction =
    workspace.recommendedActions.find((action) => action.enabled) ??
    workspace.recommendedActions[0] ??
    null;

  if ((workspace.workspaceSummary.overallScore ?? 0) < 0.85) {
    commands.push({
      id: 'overview-maturity',
      title: 'Maturity is below publication target',
      detail: `${formatScore(workspace.workspaceSummary.overallScore)} overall score. Review diagnosis health first.`,
      tone: 'warning',
      targetTab: 'overview',
      sectionId: 'workspace-diagnosis-health',
    });
  }

  if (blockerSignal) {
    commands.push({
      id: `overview-readiness-${blockerSignal.actionId}`,
      title: formatLabel(blockerSignal.source),
      detail: blockerSignal.message,
      tone: 'danger',
      ...railTargetFor(blockerSignal.targetTab),
    });
  }

  if (firstGap) {
    commands.push({
      id: `overview-gap-${firstGap.title}`,
      title: firstGap.title,
      detail: firstGap.recommendedAction,
      tone: firstGap.severity === 'blocker' ? 'danger' : 'warning',
      ...railTargetFor(firstGap.targetTab),
    });
  }

  if (primaryAction) {
    commands.push({
      id: `overview-action-${primaryAction.id}`,
      title: primaryAction.label,
      detail: primaryAction.disabledReason ?? 'Highest-priority recommended action.',
      tone:
        primaryAction.severity === 'blocker'
          ? 'danger'
          : primaryAction.severity === 'warning'
            ? 'warning'
            : 'info',
      ...railTargetFor(primaryAction.targetTab),
      disabled: !primaryAction.enabled,
      todo: primaryAction.disabledReason ?? 'TODO: action target unavailable',
    });
  }

  return commands.slice(0, 4);
}

function buildTeachingCommands(workspace: DiagnosisEditorialWorkspace): RailCommand[] {
  const commands: RailCommand[] = [];
  const missingRules = workspace.teachingRules.summary.active === 0;
  const reviewCount = workspace.teachingRules.summary.needsReview;
  const weakRules = workspace.teachingRules.items.filter(
    (rule) =>
      !rule.expectedEvidence ||
      (rule.reasoningQualityWarnings?.length ?? 0) > 0,
  );
  const uncoveredRows = workspace.coverageMatrix.filter(
    (row) =>
      row.ruleStatus === 'ACTIVE' &&
      row.fullCoverageStatus !== 'covered',
  );
  const graphOnlyGaps = workspace.coverageGaps.filter(
    (gap) => gap.targetTab === 'teaching-rules' || gap.missingGraph,
  );

  if (missingRules) {
    commands.push({
      id: 'teaching-no-active-rules',
      title: 'No active teaching rules',
      detail: 'Generate or approve constrained distinctions before downstream content can stabilize.',
      tone: 'danger',
      targetTab: 'teaching-rules',
      sectionId: 'teaching-rules-stream',
    });
  }

  if (reviewCount) {
    commands.push({
      id: 'teaching-review-rules',
      title: `${reviewCount} rule${reviewCount === 1 ? '' : 's'} need review`,
      detail: 'Candidate distinctions need senior review before they can drive generation.',
      tone: 'warning',
      targetTab: 'teaching-rules',
      sectionId: 'teaching-rules-stream',
    });
  }

  if (weakRules.length) {
    commands.push({
      id: 'teaching-weak-discriminators',
      title: `${weakRules.length} weak discriminator${weakRules.length === 1 ? '' : 's'}`,
      detail: 'Rules are missing expected evidence or carry reasoning quality warnings.',
      tone: 'warning',
      targetTab: 'teaching-rules',
      sectionId: 'teaching-rules-stream',
    });
  }

  if (uncoveredRows.length || graphOnlyGaps.length) {
    commands.push({
      id: 'teaching-uncovered-coverage',
      title: `${Math.max(uncoveredRows.length, graphOnlyGaps.length)} uncovered teaching unit${Math.max(uncoveredRows.length, graphOnlyGaps.length) === 1 ? '' : 's'}`,
      detail: 'Open the coverage matrix to see missing education, case, or graph support.',
      tone: 'warning',
      targetTab: 'teaching-rules',
      sectionId: 'teaching-coverage-matrix',
    });
  }

  return commands.slice(0, 4);
}

function buildEducationCommands(workspace: DiagnosisEditorialWorkspace): RailCommand[] {
  const blockedSections = workspace.education.sectionHealth.filter(
    (section) => section.blockers.length > 0,
  );
  const warningSections = workspace.education.sectionHealth.filter(
    (section) => section.warnings.length > 0,
  );
  const acceptedRepairs = workspace.education.acceptedRepairs ?? [];
  const whyLayerWarnings = workspace.education.sectionHealth.filter((section) =>
    [...section.blockers, ...section.warnings].some((message) =>
      message.toLowerCase().includes('why'),
    ),
  );

  return compactRailCommands([
    blockedSections.length
      ? {
          id: 'education-blocked-sections',
          title: `${blockedSections.length} weak education section${blockedSections.length === 1 ? '' : 's'}`,
          detail: 'Section blockers are preventing publication readiness.',
          tone: 'danger' as StatusBadgeTone,
          ...railTargetFromSection(
            getWorkspaceSectionForEducationSection(blockedSections[0]?.section),
          ),
        }
      : null,
    warningSections.length
      ? {
          id: 'education-warning-sections',
          title: `${warningSections.length} section warning${warningSections.length === 1 ? '' : 's'}`,
          detail: 'Review warnings in clinical picture and education sections.',
          tone: 'warning' as StatusBadgeTone,
          ...railTargetFromSection(
            getWorkspaceSectionForEducationSection(warningSections[0]?.section),
          ),
        }
      : null,
    whyLayerWarnings.length
      ? {
          id: 'education-why-layer',
          title: 'Why-layer needs reinforcement',
          detail: `${whyLayerWarnings.length} section${whyLayerWarnings.length === 1 ? '' : 's'} mention why-layer gaps.`,
          tone: 'warning' as StatusBadgeTone,
          ...railTargetFromSection(
            getWorkspaceSectionForEducationSection(whyLayerWarnings[0]?.section),
          ),
        }
      : null,
    acceptedRepairs.length
      ? {
          id: 'education-accepted-repairs',
          title: `${acceptedRepairs.length} accepted repair${acceptedRepairs.length === 1 ? '' : 's'}`,
          detail: 'Accepted repairs should be checked against publication state.',
          tone: 'info' as StatusBadgeTone,
          targetTab: 'education' as WorkspaceTab,
          sectionId: 'education-repairs',
        }
      : null,
    workspace.education.status !== 'published'
      ? {
          id: 'education-publication-state',
          title: `Education is ${formatLabel(workspace.education.status)}`,
          detail: 'Publication state still needs editorial confirmation.',
          tone: 'warning' as StatusBadgeTone,
          targetTab: 'education' as WorkspaceTab,
          sectionId: 'education-publication-state',
        }
      : null,
  ]).slice(0, 4);
}

function buildCaseCommands(workspace: DiagnosisEditorialWorkspace): RailCommand[] {
  const difficulties = new Set(
    workspace.cases.items.map((item) => item.difficulty?.toLowerCase()),
  );
  const missingDifficultyBands = ['easy', 'medium', 'hard'].filter(
    (band) => !difficulties.has(band),
  );
  const lowQualityCases = workspace.cases.items.filter(
    (item) =>
      item.qualityProjection.blockers.length > 0 ||
      item.qualityProjection.warnings.length > 0,
  );
  const progression = workspace.cases.summary.progressionSignals;
  const leakRisk =
    (progression?.prematureLockInCases ?? 0) +
    (progression?.abruptGiveawayCases ?? 0);
  const validationIssues =
    workspace.cases.summary.blockerCount + workspace.cases.summary.warningCount;

  return compactRailCommands([
    missingDifficultyBands.length
      ? {
          id: 'cases-missing-difficulty',
          title: `Missing ${missingDifficultyBands.join(', ')} case coverage`,
          detail: 'Difficulty bands are not evenly represented in approved cases.',
          tone: 'warning' as StatusBadgeTone,
          targetTab: 'cases' as WorkspaceTab,
          sectionId: 'case-difficulty-spectrum',
        }
      : null,
    lowQualityCases.length
      ? {
          id: 'cases-low-quality',
          title: `${lowQualityCases.length} low-quality case${lowQualityCases.length === 1 ? '' : 's'}`,
          detail: 'Case quality projections need review before promotion.',
          tone: 'warning' as StatusBadgeTone,
          targetTab: 'cases' as WorkspaceTab,
          sectionId: 'case-quality-flags',
        }
      : null,
    leakRisk
      ? {
          id: 'cases-leak-risk',
          title: `${leakRisk} leak-risk signal${leakRisk === 1 ? '' : 's'}`,
          detail: 'Premature lock-in or abrupt giveaway cases may weaken learning.',
          tone: 'danger' as StatusBadgeTone,
          targetTab: 'cases' as WorkspaceTab,
          sectionId: 'case-validation-state',
        }
      : null,
    validationIssues
      ? {
          id: 'cases-validation-state',
          title: `${validationIssues} validation issue${validationIssues === 1 ? '' : 's'}`,
          detail: 'Review blocker and warning status in the cases tab.',
          tone: workspace.cases.summary.blockerCount ? 'danger' as StatusBadgeTone : 'warning' as StatusBadgeTone,
          targetTab: 'cases' as WorkspaceTab,
          sectionId: 'case-validation-state',
        }
      : null,
  ]).slice(0, 4);
}

function buildGraphCommands(workspace: DiagnosisEditorialWorkspace): RailCommand[] {
  const weakEvidence = workspace.evidenceGraph.summary.weakEvidenceCoverage;
  const unresolvedDifferentials =
    workspace.workspaceSummary.unresolvedDifferentialCount ??
    workspace.workspaceSummary.differentialResolutionSummary?.unresolved ??
    0;
  const duplicateRisks =
    workspace.evidenceCoverage?.redundancy.overusedEvidence.length ?? 0;
  const weakEdges = workspace.graph.teachingRelationships.filter(
    (relationship) =>
      relationship.status !== 'ACTIVE' ||
      (!relationship.supportingGraphFact &&
        !relationship.supportingTeachingRule &&
        !relationship.supportingDifferentialLinkId),
  );

  return compactRailCommands([
    workspace.graph.reviewableCandidateCount
      ? {
          id: 'graph-pending-candidates',
          title: `${workspace.graph.reviewableCandidateCount} pending candidate${workspace.graph.reviewableCandidateCount === 1 ? '' : 's'}`,
          detail: 'Review generated graph candidates before promoting facts.',
          tone: 'warning' as StatusBadgeTone,
          targetTab: 'graph' as WorkspaceTab,
          sectionId: 'graph-candidates',
        }
      : null,
    weakEvidence
      ? {
          id: 'graph-weak-evidence',
          title: `${weakEvidence} weak evidence edge${weakEvidence === 1 ? '' : 's'}`,
          detail: 'Evidence graph relationships need stronger support.',
          tone: 'warning' as StatusBadgeTone,
          targetTab: 'graph' as WorkspaceTab,
          sectionId: 'evidence-graph',
        }
      : null,
    weakEdges.length
      ? {
          id: 'graph-weak-edges',
          title: `${weakEdges.length} weak teaching edge${weakEdges.length === 1 ? '' : 's'}`,
          detail: 'Teaching relationships need graph, rule, or differential support.',
          tone: 'warning' as StatusBadgeTone,
          targetTab: 'graph' as WorkspaceTab,
          sectionId: 'teaching-relationship-details',
        }
      : null,
    unresolvedDifferentials
      ? {
          id: 'graph-unresolved-differentials',
          title: `${unresolvedDifferentials} unresolved differential${unresolvedDifferentials === 1 ? '' : 's'}`,
          detail: 'Mimic separation still has unresolved differential context.',
          tone: 'danger' as StatusBadgeTone,
          targetTab: 'graph' as WorkspaceTab,
          sectionId: 'mimic-separation-stream',
        }
      : null,
    duplicateRisks
      ? {
          id: 'graph-duplicate-concepts',
          title: `${duplicateRisks} duplicate concept risk${duplicateRisks === 1 ? '' : 's'}`,
          detail: 'Evidence redundancy suggests duplicate or overused concepts.',
          tone: 'warning' as StatusBadgeTone,
          targetTab: 'graph' as WorkspaceTab,
          sectionId: 'evidence-coverage',
        }
      : null,
  ]).slice(0, 4);
}

function buildIntegrityCommands(workspace: DiagnosisEditorialWorkspace): RailCommand[] {
  const unsupportedClaims = workspace.unsupportedClaimsBySection ?? [];
  const pendingAudits = (workspace.aiDraftAuditTrail ?? []).filter((audit) =>
    ['PENDING_REVIEW', 'REVIEW_REQUIRED', 'NEEDS_CHANGES'].includes(
      audit.reviewStatus,
    ),
  );
  const clueDrafts = workspace.materializedClueRevisionDrafts ?? [];
  const failedSections = workspace.education.sectionHealth.filter(
    (section) => section.blockers.length > 0 || section.warnings.length > 0,
  );
  const latestRevision = workspace.revisions.latest;

  return compactRailCommands([
    unsupportedClaims.length
      ? {
          id: 'integrity-unsupported-claims',
          title: `${unsupportedClaims.length} unsupported claim${unsupportedClaims.length === 1 ? '' : 's'}`,
          detail: 'Claims need evidence repair or editorial confirmation.',
          tone: 'danger' as StatusBadgeTone,
          targetTab: 'integrity' as WorkspaceTab,
          sectionId: 'integrity-unsupported-claims',
        }
      : null,
    pendingAudits.length
      ? {
          id: 'integrity-pending-audits',
          title: `${pendingAudits.length} pending audit${pendingAudits.length === 1 ? '' : 's'}`,
          detail: 'AI draft audit trail has unresolved review items.',
          tone: 'warning' as StatusBadgeTone,
          targetTab: 'integrity' as WorkspaceTab,
          sectionId: 'integrity-audit-trail',
        }
      : null,
    clueDrafts.length
      ? {
          id: 'integrity-clue-drafts',
          title: `${clueDrafts.length} clue revision draft${clueDrafts.length === 1 ? '' : 's'}`,
          detail: 'Materialized clue revision drafts need review.',
          tone: 'warning' as StatusBadgeTone,
          targetTab: 'integrity' as WorkspaceTab,
          sectionId: 'integrity-case-revision-drafts',
        }
      : null,
    failedSections.length
      ? {
          id: 'integrity-validation-failures',
          title: `${failedSections.length} validation section${failedSections.length === 1 ? '' : 's'}`,
          detail: 'Education health has blockers or warnings that affect integrity.',
          tone: 'danger' as StatusBadgeTone,
          targetTab: 'integrity' as WorkspaceTab,
          sectionId: 'integrity-validation-failures',
        }
      : null,
    latestRevision
      ? {
          id: 'integrity-latest-revision',
          title: `Latest revision v${latestRevision.version}`,
          detail: `${formatLabel(latestRevision.editorialStatus)} revision from ${latestRevision.createdAt.slice(0, 10)}.`,
          tone: 'info' as StatusBadgeTone,
          targetTab: 'integrity' as WorkspaceTab,
          sectionId: 'integrity-revision-history',
        }
      : null,
  ]).slice(0, 4);
}

function buildObjectivesCommands(workspace: DiagnosisEditorialWorkspace): RailCommand[] {
  const brief = workspace.editorialBrief;
  const onboarding = workspace.onboardingProgress;
  const recommendations = workspace.onboardingRecommendations ?? [];

  return compactRailCommands([
    !brief.activeForGeneration
      ? {
          id: 'objectives-brief-inactive',
          title: 'Brief is not active for generation',
          detail: brief.summary ?? 'Generation will not use this editorial brief yet.',
          tone: 'warning' as StatusBadgeTone,
          targetTab: 'editorial-brief' as WorkspaceTab,
          sectionId: 'brief-status',
        }
      : null,
    onboarding && onboarding.percent < 100
      ? {
          id: 'objectives-onboarding-progress',
          title: `Onboarding ${onboarding.percent}% complete`,
          detail: `${onboarding.completedComponents}/${onboarding.totalComponents} components complete.`,
          tone: 'warning' as StatusBadgeTone,
          targetTab: 'editorial-brief' as WorkspaceTab,
          disabled: true,
          todo: 'TODO: add onboarding anchor',
        }
      : null,
    recommendations.length
      ? {
          id: 'objectives-recommendations',
          title: `${recommendations.length} onboarding recommendation${recommendations.length === 1 ? '' : 's'}`,
          detail: recommendations[0]?.label ?? 'Review onboarding recommendations.',
          tone: 'info' as StatusBadgeTone,
          targetTab: 'editorial-brief' as WorkspaceTab,
          sectionId: 'brief-recommendations',
        }
      : null,
  ]).slice(0, 4);
}

function railTargetFor(value: string | null | undefined) {
  return railTargetFromSection(getDefaultWorkspaceSectionForTab(value));
}

function railTargetFromSection(target: WorkspaceSectionTarget) {
  return {
    targetTab: target.tab,
    sectionId: target.sectionId,
  };
}

function ReadinessCard({
  workspace,
}: {
  workspace: DiagnosisEditorialWorkspace;
}) {
  const readinessItems = workspace.readinessBreakdown.slice(0, 4);

  return (
    <CompactPanel
      title="Readiness"
      subtitle={`${workspace.readinessBreakdown.length} readiness signal${workspace.readinessBreakdown.length === 1 ? '' : 's'}`}
    >
      <div className="space-y-2">
        {readinessItems.map((item) => (
          <div
            key={`${item.source}-${item.actionId}-${item.message}`}
            className="rounded-lg border border-[var(--color-navy-border)] bg-white/5 px-3 py-2"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-slate-100">
                {formatLabel(item.source)}
              </p>
              <StatusBadge
                status={formatLabel(item.severity)}
                tone={
                  item.severity === 'blocker'
                      ? 'danger'
                      : item.severity === 'info'
                        ? 'info'
                      : 'warning'
                }
              />
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              {item.message}
            </p>
          </div>
        ))}
        {!readinessItems.length ? (
          <p className="text-sm leading-6 text-slate-400">
            No readiness breakdown has been returned for this diagnosis.
          </p>
        ) : null}
      </div>
    </CompactPanel>
  );
}

function RecentContextCard({
  workspace,
}: {
  workspace: DiagnosisEditorialWorkspace;
}) {
  const latestCase = workspace.cases.summary.latest;
  const latestRevision = workspace.revisions.latest;
  const recentFact = workspace.graph.factsSummary.recent[0] ?? null;

  return (
    <CompactPanel title="Recent context">
      <div className="space-y-2">
        <ContextLine
          label="Case"
          value={latestCase?.title ?? 'No recent case'}
          detail={latestCase?.updatedAt ? latestCase.updatedAt.slice(0, 10) : null}
        />
        <ContextLine
          label="Revision"
          value={latestRevision ? `Version ${latestRevision.version}` : 'No revision analysis'}
          detail={latestRevision?.createdAt ? latestRevision.createdAt.slice(0, 10) : null}
        />
        <ContextLine
          label="Graph"
          value={recentFact?.label ?? 'No recent graph fact'}
          detail={recentFact?.updatedAt ? recentFact.updatedAt.slice(0, 10) : null}
        />
      </div>
    </CompactPanel>
  );
}

function ContextLine({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string | null;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-navy-border)] bg-white/5 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold leading-5 text-slate-100">
        {value}
      </p>
      {detail ? <p className="mt-1 text-xs text-slate-500">{detail}</p> : null}
    </div>
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
  activeSectionId,
  onSectionNavigate,
}: {
  workspace: DiagnosisEditorialWorkspace;
  activeSectionId: string | null;
  onSectionNavigate: (target: WorkspaceSectionTarget) => void;
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
  const target = getDefaultWorkspaceSectionForTab('integrity');
  const isActive = activeSectionId === target.sectionId;

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
        onClick={() => onSectionNavigate(target)}
        aria-current={isActive ? 'location' : undefined}
        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-teal)]"
      >
        Open Integrity blockers
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
  activeSectionId,
  onSectionNavigate,
}: {
  workspace: DiagnosisEditorialWorkspace;
  activeTab: WorkspaceTab;
  activeSectionId: string | null;
  onSectionNavigate: (target: WorkspaceSectionTarget) => void;
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
            activeSectionId={activeSectionId}
            onSectionNavigate={onSectionNavigate}
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
                    activeSectionId={activeSectionId}
                    onSectionNavigate={onSectionNavigate}
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
  activeSectionId,
  onSectionNavigate,
  primary = false,
  compact = false,
}: {
  fix: NonNullable<
    NonNullable<DiagnosisEditorialWorkspace['editorialPrioritization']>['highestImpactFixes']
  >[number];
  activeSectionId: string | null;
  onSectionNavigate: (target: WorkspaceSectionTarget) => void;
  primary?: boolean;
  compact?: boolean;
}) {
  const target = getDefaultWorkspaceSectionForTab(fix.targetTab);
  const isActive = activeSectionId === target.sectionId;

  return (
    <button
      type="button"
      onClick={() => onSectionNavigate(target)}
      aria-current={isActive ? 'location' : undefined}
      className={[
        'w-full rounded-lg border px-3 py-2 text-left transition hover:border-[var(--color-teal)]/40 hover:bg-[var(--color-teal)]/10',
        isActive
          ? 'border-[var(--color-teal)]/60 bg-[var(--color-teal)]/14 shadow-[inset_3px_0_0_var(--color-teal)]'
          : primary
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
  activeSectionId,
  suggestions,
  onSectionNavigate,
}: {
  activeTab: WorkspaceTab;
  activeSectionId: string | null;
  suggestions: CopilotSuggestion[];
  onSectionNavigate: (target: WorkspaceSectionTarget) => void;
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
        {ordered.map((suggestion) => {
          const target = getDefaultWorkspaceSectionForTab(suggestion.targetTab);
          const isActive = activeSectionId === target.sectionId;
          return (
            <button
              key={suggestion.id}
              type="button"
              disabled={!suggestion.enabled}
              aria-disabled={!suggestion.enabled}
              aria-current={isActive ? 'location' : undefined}
              onClick={() => onSectionNavigate(target)}
              className={[
                'w-full rounded-lg border px-3 py-2 text-left transition hover:border-[var(--color-teal)]/40 hover:bg-[var(--color-teal)]/10 disabled:cursor-not-allowed disabled:opacity-60',
                isActive
                  ? 'border-[var(--color-teal)]/60 bg-[var(--color-teal)]/14 shadow-[inset_3px_0_0_var(--color-teal)]'
                  : 'border-[var(--color-navy-border)] bg-white/5',
              ].join(' ')}
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
          );
        })}
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
