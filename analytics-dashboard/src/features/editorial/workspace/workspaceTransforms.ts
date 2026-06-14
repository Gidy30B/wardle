import type {
  DiagnosisEditorialWorkspace,
  DiagnosisEducationRevisionAnalysis,
  DiagnosisEvidenceRelationship,
  DiagnosisTeachingRulesResponse,
  ReasoningPath,
  TeachingUnitCoverageMap,
  WorkspaceCoverageGap,
  WorkspaceCoverageMatrixRow,
  WorkspaceReadinessItem,
} from '../../../api/admin';
import type { StatusBadgeTone } from '../../../components/ui/statusBadgeMeta';
import type { CopilotSuggestion, WorkspaceTab } from './workspaceTypes';

export function toTeachingRulesResponse(
  workspace: DiagnosisEditorialWorkspace | null,
): DiagnosisTeachingRulesResponse | null {
  if (!workspace) {
    return null;
  }

  return {
    diagnosisRegistryId: workspace.diagnosis.id,
    diagnosisName: workspace.diagnosis.displayLabel,
    rules: workspace.teachingRules.items,
  };
}

export function toTeachingUnitCoverageMap(
  workspace: DiagnosisEditorialWorkspace | null,
): TeachingUnitCoverageMap | null {
  if (!workspace) {
    return null;
  }

  return {
    diagnosisRegistryId: workspace.diagnosis.id,
    diagnosisName: workspace.diagnosis.displayLabel,
    teachingUnits: workspace.coverageMatrix.map((row) => ({
      id: row.stableKey,
      title: row.title,
      source: 'unified_workspace',
      status: row.fullCoverageStatus,
      educationCoverage: row.educationCoverage,
      caseCoverage: {
        count: row.caseCoverage === 'covered' ? 1 : 0,
        status: row.caseCoverage,
      },
      graphCoverage: row.graphCoverage,
      relatedSections: [],
      relatedCaseIds: [],
      relatedGraphFactIds: [],
      warnings: [],
      recommendedAction: row.recommendedAction,
    })),
  };
}

export function sortRevisionsNewestFirst(
  revisionList: DiagnosisEducationRevisionAnalysis[],
) {
  return [...revisionList].sort((left, right) => {
    if (right.version !== left.version) {
      return right.version - left.version;
    }
    return (
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    );
  });
}

export function severityRank(severity: WorkspaceReadinessItem['severity']) {
  if (severity === 'blocker') return 0;
  if (severity === 'warning') return 1;
  return 2;
}

export function coverageCompositeStatus(row: WorkspaceCoverageMatrixRow): {
  label: string;
  tone: StatusBadgeTone;
} {
  if (row.fullCoverageStatus === 'covered') {
    return { label: 'Complete', tone: 'success' };
  }
  if (row.fullCoverageStatus === 'unknown') {
    return { label: 'Not started', tone: 'neutral' };
  }
  if (row.educationCoverage === 'missing') {
    return { label: 'Missing education', tone: 'danger' };
  }
  if (row.graphCoverage === 'missing') {
    return { label: 'Missing graph', tone: 'warning' };
  }
  if (row.caseCoverage === 'missing') {
    return { label: 'Missing assessment', tone: 'warning' };
  }
  return { label: 'Partial', tone: 'warning' };
}

export function findCoverageRowForGap(
  workspace: DiagnosisEditorialWorkspace | null,
  gap: WorkspaceCoverageGap,
) {
  return (
    workspace?.coverageMatrix.find(
      (row) =>
        row.teachingRuleId === gap.teachingRuleId || row.title === gap.title,
    ) ?? null
  );
}

export function getCoverageRowKey(row: WorkspaceCoverageMatrixRow) {
  return row.teachingRuleId ?? row.stableKey;
}

export function caseTone(
  caseItem: DiagnosisEditorialWorkspace['cases']['items'][number],
): StatusBadgeTone {
  if (caseItem.qualityProjection.blockers.length) return 'danger';
  if (caseItem.qualityProjection.warnings.length) return 'warning';
  if (
    caseItem.editorialStatus === 'APPROVED' ||
    caseItem.editorialStatus === 'READY_TO_PUBLISH' ||
    caseItem.editorialStatus === 'PUBLISHED'
  ) {
    return 'success';
  }
  return 'neutral';
}

export function aggregateCaseDimensions(workspace: DiagnosisEditorialWorkspace) {
  const empty = { good: 0, warnings: 0, blockers: 0 };
  const aggregate = {
    teachingAlignment: { ...empty },
    mimicPersistence: { ...empty },
  };

  for (const caseItem of workspace.cases.items) {
    for (const key of ['teachingAlignment', 'mimicPersistence'] as const) {
      const dimension = caseItem.qualityProjection.dimensions[key];
      if (dimension.blockers.length || dimension.status === 'blocker') {
        aggregate[key].blockers += 1;
      } else if (dimension.warnings.length || dimension.status === 'warning') {
        aggregate[key].warnings += 1;
      } else if (dimension.status === 'good') {
        aggregate[key].good += 1;
      }
    }
  }

  return aggregate;
}

export function groupCaseLearningGoalCoverage(
  rows: NonNullable<DiagnosisEditorialWorkspace['caseLearningGoalCoverage']>,
) {
  const groups = new Map<
    string,
    {
      learningGoalId: string;
      learningGoal: string;
      caseTitles: string[];
      missingDiscriminators: string[];
      missingMimics: string[];
      coverageStrength: number;
      row?: NonNullable<
        DiagnosisEditorialWorkspace['caseLearningGoalCoverage']
      >[number];
    }
  >();

  for (const row of rows) {
    const current =
      groups.get(row.learningGoalId) ?? {
        learningGoalId: row.learningGoalId,
        learningGoal: row.learningGoal,
        caseTitles: [],
        missingDiscriminators: [],
        missingMimics: [],
        coverageStrength: 0,
        row,
      };
    current.caseTitles = uniqueText([...current.caseTitles, row.caseTitle]);
    current.missingDiscriminators = uniqueText([
      ...current.missingDiscriminators,
      ...row.missingDiscriminators,
    ]);
    current.missingMimics = uniqueText([
      ...current.missingMimics,
      ...row.missingMimics,
    ]);
    current.coverageStrength = Math.max(
      current.coverageStrength,
      row.coverageStrength,
    );
    if (
      !current.row ||
      row.coverageStrength > current.row.coverageStrength
    ) {
      current.row = row;
    }
    groups.set(row.learningGoalId, current);
  }

  return [...groups.values()];
}

export function groupReasoningPaths(paths: ReasoningPath[]) {
  const grouped = new Map<string, ReasoningPath[]>();
  for (const path of paths) {
    grouped.set(path.generationPurpose, [
      ...(grouped.get(path.generationPurpose) ?? []),
      path,
    ]);
  }
  return [...grouped.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  );
}

export function groupEvidenceRelationships(
  relationships: DiagnosisEvidenceRelationship[],
) {
  const grouped = new Map<string, DiagnosisEvidenceRelationship[]>();
  for (const relationship of relationships) {
    const type = relationship.evidenceNode.evidenceType;
    grouped.set(type, [...(grouped.get(type) ?? []), relationship]);
  }
  return [...grouped.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  );
}

function uniqueText(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

export function buildCopilotSuggestions(
  workspace: DiagnosisEditorialWorkspace,
  activeTab?: WorkspaceTab,
): CopilotSuggestion[] {
  const suggestions: CopilotSuggestion[] = [];

  function add(suggestion: CopilotSuggestion) {
    if (suggestions.some((item) => item.id === suggestion.id)) {
      return;
    }
    suggestions.push(suggestion);
  }

  workspace.workspaceSummary.blockers.slice(0, 3).forEach((message, index) => {
    add({
      id: `workspace-blocker-${index}`,
      title: 'Resolve workspace blocker',
      detail: message,
      targetTab: 'overview',
      source: 'blocker',
      tone: 'danger',
      enabled: true,
    });
  });

  if (!workspace.editorialBrief.version) {
    add({
      id: 'missing-editorial-brief',
      title: 'Define objectives',
      detail:
        'Create or generate the editorial brief before relying on education, case, or graph generation.',
      targetTab: 'editorial-brief',
      source: 'objectives',
      tone: 'danger',
      enabled: true,
    });
  } else if (!workspace.editorialBrief.activeForGeneration) {
    add({
      id: 'inactive-editorial-brief',
      title: 'Activate objectives for generation',
      detail:
        'The brief exists but is not active for generation; review and activate it when ready.',
      targetTab: 'editorial-brief',
      source: 'objectives',
      tone: 'warning',
      enabled: true,
    });
  }

  if (workspace.teachingRules.summary.active === 0) {
    add({
      id: 'no-active-teaching-rules',
      title: 'Approve teaching rules',
      detail:
        'No active teaching rules are available to constrain education, cases, or graph support.',
      targetTab: 'teaching-rules',
      source: 'teaching',
      tone: 'danger',
      enabled: true,
    });
  } else if (workspace.teachingRules.summary.needsReview > 0) {
    add({
      id: 'teaching-rules-need-review',
      title: 'Review teaching rule candidates',
      detail: `${workspace.teachingRules.summary.needsReview} teaching rules need review before they can drive generation.`,
      targetTab: 'teaching-rules',
      source: 'teaching',
      tone: 'warning',
      enabled: true,
    });
  }

  workspace.education.sectionHealth
    .filter(
      (section) =>
        section.regenerationRecommended ||
        section.blockers.length > 0 ||
        section.warnings.length > 0,
    )
    .slice(0, 3)
    .forEach((section) => {
      add({
        id: `weak-section-${section.section}`,
        title: `Review ${formatLabel(section.section)}`,
        detail:
          section.reason ??
          section.blockers[0] ??
          section.warnings[0] ??
          'Section quality analysis marked this education section for integrity review.',
      targetTab: 'integrity',
      source: 'integrity',
        tone: section.blockers.length ? 'danger' : 'warning',
        enabled: true,
      });
    });

  workspace.coverageGaps.slice(0, 5).forEach((gap, index) => {
    add({
      id: `coverage-gap-${gap.teachingRuleId ?? gap.title}-${index}`,
      title: gap.title,
      detail: gap.recommendedAction,
      targetTab: gap.targetTab,
      source: coverageGapSource(gap),
      tone: gap.severity === 'blocker' ? 'danger' : 'warning',
      enabled: true,
    });
  });

  if (workspace.cases.summary.total === 0) {
    add({
      id: 'no-cases',
      title: 'Generate first assessment case',
      detail:
        'No case inventory is attached to this diagnosis; use a case gap or mimic to generate a targeted draft.',
      targetTab: 'cases',
      source: 'cases',
      tone: 'danger',
      enabled: true,
    });
  } else if (workspace.cases.summary.blockerCount > 0) {
    add({
      id: 'case-blockers',
      title: 'Fix case quality blockers',
      detail: `${workspace.cases.summary.blockerCount} case blocker signals are present in the workspace inventory.`,
      targetTab: 'cases',
      source: 'cases',
      tone: 'danger',
      enabled: true,
    });
  } else if (workspace.cases.summary.usable === 0) {
    add({
      id: 'no-usable-cases',
      title: 'Promote or revise a usable case',
      detail:
        'Cases exist, but none are currently usable for scheduled play or coverage support.',
      targetTab: 'cases',
      source: 'cases',
      tone: 'warning',
      enabled: true,
    });
  }

  if (workspace.evidenceCoverage) {
    workspace.evidenceCoverage.missingEvidence.slice(0, 3).forEach((item) => {
      add({
        id: `missing-evidence-${item.type}`,
        title: `Add ${item.label}`,
        detail:
          'Evidence coverage reports this discriminator or support type as missing.',
        targetTab: 'graph',
        source: 'evidence',
        tone: 'warning',
        enabled: true,
      });
    });

    if (workspace.evidenceCoverage.generationHooks.suggestedDraftValidationReview) {
      add({
        id: 'draft-validation-review',
        title: 'Review low-trust generated drafts',
        detail:
          'Evidence coverage reports low-trust, blocked, or hallucination-risk drafts.',
        targetTab: 'graph',
        source: 'evidence',
        tone: 'danger',
        enabled: true,
      });
    }

    workspace.evidenceCoverage.generationReadinessReasons
      .slice(0, 2)
      .forEach((reason, index) => {
        add({
          id: `generation-readiness-${index}`,
          title: 'Improve generation readiness',
          detail: reason,
          targetTab: 'graph',
          source: 'evidence',
          tone: 'warning',
          enabled: true,
        });
      });
  } else if (workspace.evidenceGraph.summary.active === 0) {
    add({
      id: 'no-evidence-coverage',
      title: 'Create evidence support',
      detail:
        'No evidence coverage score is available and the evidence graph has no active relationships.',
      targetTab: 'graph',
      source: 'evidence',
      tone: 'warning',
      enabled: true,
    });
  }

  const differentialCoverage = workspace.workspaceSummary.differentialCoverage;
  if (differentialCoverage && differentialCoverage.unresolvedMappings > 0) {
    add({
      id: 'unresolved-differentials',
      title: 'Resolve differential mappings',
      detail: `${differentialCoverage.unresolvedMappings} differential mappings remain unresolved or ambiguous.`,
      targetTab: 'graph',
      source: 'differentials',
      tone: 'warning',
      enabled: true,
    });
  } else if ((workspace.linkedDifferentials ?? []).length === 0) {
    add({
      id: 'no-linked-differentials',
      title: 'Map required differentials',
      detail:
        'No linked differentials are attached, so mimic/discriminator coverage cannot be audited well.',
      targetTab: 'graph',
      source: 'differentials',
      tone: 'warning',
      enabled: true,
    });
  }

  if (workspace.lifecycleGovernance?.blockers.length) {
    add({
      id: 'lifecycle-blockers',
      title: 'Clear lifecycle blockers',
      detail: workspace.lifecycleGovernance.blockers[0],
      targetTab: 'overview',
      source: 'lifecycle',
      tone: 'danger',
      enabled: true,
    });
  }

  (workspace.unsupportedClaimsBySection ?? []).slice(0, 3).forEach((claim) => {
    add({
      id: `unsupported-claim-${claim.sectionId}-${claim.claimId}`,
      title: 'Repair unsupported claim',
      detail: `${formatLabel(claim.sectionType)}: ${claim.claimText}`,
      targetTab: claim.sectionType === 'case' ? 'cases' : 'integrity',
      source: 'claim support',
      tone: claim.blocksPublication ? 'danger' : 'warning',
      enabled: claim.repairableAutomatically,
    });
  });

  (workspace.learningGoalCoverage ?? [])
    .filter((goal) => goal.coveredByCaseIds.length === 0)
    .slice(0, 3)
    .forEach((goal) => {
      add({
        id: `uncovered-learning-goal-${goal.learningGoalId}`,
        title: 'Cover learning goal with a case',
        detail: goal.learningGoal,
        targetTab: 'cases',
        source: 'learning goal',
        tone: 'warning',
        enabled: true,
      });
    });

  if (workspace.escalationCoverage && !workspace.escalationCoverage.coversEscalation) {
    add({
      id: 'missing-escalation-coverage',
      title: 'Strengthen escalation coverage',
      detail: [
        workspace.escalationCoverage.missingEscalationTeaching
          ? 'missing teaching distinction'
          : null,
        workspace.escalationCoverage.weakEscalationEvidence
          ? 'weak escalation evidence'
          : null,
        workspace.escalationCoverage.noPlayableEscalationCase
          ? 'no playable escalation case'
          : null,
      ]
        .filter(Boolean)
        .join(', '),
      targetTab: 'graph',
      source: 'escalation',
      tone: 'warning',
      enabled: true,
    });
  }

  workspace.readinessBreakdown.slice(0, 4).forEach((item) => {
    add({
      id: `readiness-${item.actionId}-${item.message}`,
      title: item.source ? formatLabel(item.source) : 'Readiness issue',
      detail: item.message,
      targetTab: item.targetTab,
      source: item.severity,
      tone: item.severity === 'blocker' ? 'danger' : 'warning',
      enabled: true,
    });
  });

  workspace.recommendedActions.slice(0, 4).forEach((action) => {
    add({
      id: `api-action-${action.id}`,
      title: action.label,
      detail:
        action.disabledReason ??
        `Open ${formatLabel(action.targetTab)} to continue.`,
      targetTab: action.targetTab,
      source: action.source ?? 'api',
      tone:
        action.severity === 'blocker'
          ? 'danger'
          : action.severity === 'warning'
            ? 'warning'
            : 'info',
      enabled: action.enabled,
    });
  });

  return suggestions.sort(
    (left, right) =>
      suggestionRank(left, activeTab) - suggestionRank(right, activeTab),
  );
}

export function coverageGapSource(gap: WorkspaceCoverageGap) {
  const missing = [
    gap.missingEducation ? 'education' : null,
    gap.missingCases ? 'cases' : null,
    gap.missingGraph ? 'graph' : null,
  ].filter(Boolean);
  return missing.length ? missing.join(' + ') : 'coverage';
}

function suggestionRank(suggestion: CopilotSuggestion, activeTab?: WorkspaceTab) {
  const tabBias = activeTab && suggestion.targetTab === activeTab ? -0.35 : 0;
  if (suggestion.tone === 'danger') return 0 + tabBias;
  if (suggestion.tone === 'warning') return 1 + tabBias;
  if (suggestion.tone === 'info') return 2 + tabBias;
  return 3 + tabBias;
}

export function scoreTone(score: number | null | undefined): StatusBadgeTone {
  if (typeof score !== 'number') return 'neutral';
  if (score >= 0.8) return 'success';
  if (score >= 0.55) return 'warning';
  return 'danger';
}

export function formatPercentUnit(value: number | null | undefined) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 'N/A';
  }
  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

export function formatSummaryValue(value: string | number | null | undefined) {
  return typeof value === 'number' ? formatScore(value) : value ?? 'Unknown';
}

export function formatScore(value: number | null | undefined) {
  return typeof value === 'number' ? `${Math.round(value * 100)}%` : 'Unknown';
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function formatLabel(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
