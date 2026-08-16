import type {
  DiagnosisEditorialWorkspace,
  DiagnosisTeachingRelationship,
  DiagnosisTeachingRule,
  WorkspaceCoverageMatrixRow,
  WorkspaceReadinessSeverity,
} from '../../../../api/admin';
import type { StatusBadgeTone } from '../../../../components/ui/statusBadgeMeta';
import {
  coverageCompositeStatus,
  formatLabel,
  scoreTone,
} from '../workspaceTransforms.ts';
import {
  getDefaultWorkspaceSectionForTab,
  getWorkspaceSectionForEducationSection,
  type WorkspaceSectionTarget,
} from '../workspaceSectionNavigation.ts';

export type EditorialWorkspaceViewModel = {
  diagnosisHealth: DiagnosisHealthViewModel;
  coverageMatrix: CoverageMatrixViewModel;
  nextBestActions: NextBestActionViewModel[];
  teachingRulesBoard: TeachingRulesBoardViewModel;
  educationBoard: EducationBoardViewModel;
  caseInventoryBoard: CaseInventoryBoardViewModel;
  graphBoard: GraphBoardViewModel;
  integrityBoard: IntegrityBoardViewModel;
};

export type HealthTileViewModel = {
  id: string;
  label: string;
  value: string | number;
  detail: string;
  tone: StatusBadgeTone;
};

export type DiagnosisHealthViewModel = {
  status: string;
  statusTone: StatusBadgeTone;
  blockers: string[];
  warnings: string[];
  tiles: HealthTileViewModel[];
  readinessCount: {
    blockers: number;
    warnings: number;
    informational: number;
  };
};

export type CoverageMatrixRowViewModel = {
  id: string;
  title: string;
  category: string;
  bucket: CoverageBucket;
  status: 'covered' | 'warning' | 'missing';
  tone: StatusBadgeTone;
  recommendedAction: string;
  educationCoverage: string;
  caseCoverage: string;
  graphCoverage: string;
};

export type CoverageBucket =
  | 'symptoms'
  | 'riskFactors'
  | 'investigations'
  | 'differentials'
  | 'management'
  | 'graphEvidence';

export type CoverageMatrixViewModel = {
  rows: CoverageMatrixRowViewModel[];
  byBucket: Record<CoverageBucket, CoverageMatrixRowViewModel[]>;
  summary: Record<'covered' | 'warning' | 'missing', number>;
};

export type NextBestActionViewModel = {
  id: string;
  title: string;
  severity: WorkspaceReadinessSeverity | 'info';
  tone: StatusBadgeTone;
  reason: string;
  target: WorkspaceSectionTarget;
  enabled: boolean;
  disabledReason: string | null;
};

export type TeachingRuleCardViewModel = {
  id: string;
  title: string;
  state: string;
  tone: StatusBadgeTone;
  confidence: 'high' | 'medium' | 'low';
  evidenceCount: number;
  linkedCases: number;
  graphEdges: number;
  reason: string;
  source: string;
  target?: WorkspaceSectionTarget;
  raw: DiagnosisTeachingRule;
};

export type TeachingRulesBoardViewModel = {
  activeRules: TeachingRuleCardViewModel[];
  weakRules: TeachingRuleCardViewModel[];
  candidateRules: TeachingRuleCardViewModel[];
  totals: {
    active: number;
    weak: number;
    candidate: number;
    graphLinked: number;
    caseLinked: number;
  };
};

export type EducationSectionViewModel = {
  id: string;
  name: string;
  status: string;
  tone: StatusBadgeTone;
  quality: string;
  blockers: string[];
  warnings: string[];
  updatedAt: string | null;
  publishedState: string;
  target: WorkspaceSectionTarget;
};

export type EducationBoardViewModel = {
  status: string;
  qualityScore: number | null;
  updatedAt: string | null;
  sections: EducationSectionViewModel[];
};

export type CaseCardViewModel = {
  id: string;
  title: string;
  difficulty: string;
  editorialStatus: string;
  tone: StatusBadgeTone;
  qualityState: string;
  blockers: string[];
  warnings: string[];
  clueProgression: boolean;
  leakRisk: number;
  updatedAt: string | null;
};

export type CaseInventoryBoardViewModel = {
  difficultyChips: Array<{ label: string; count: number; tone: StatusBadgeTone }>;
  missingDifficultyBands: string[];
  caseCards: CaseCardViewModel[];
  qualityQueue: CaseCardViewModel[];
  summary: {
    total: number;
    usable: number;
    blockers: number;
    warnings: number;
    leakRisk: number;
  };
};

export type GraphRelationshipGroup = {
  id: string;
  label: string;
  tone: StatusBadgeTone;
  relationships: DiagnosisTeachingRelationship[];
};

export type GraphBoardViewModel = {
  centralDiagnosis: string;
  relationships: GraphRelationshipGroup[];
  pendingCandidates: number;
  weakEdges: DiagnosisTeachingRelationship[];
  duplicateConcepts: Array<{ label: string; reason: string }>;
};

export type IntegrityTimelineItem = {
  id: string;
  title: string;
  detail: string;
  status: string;
  tone: StatusBadgeTone;
};

export type IntegrityBoardViewModel = {
  blockers: string[];
  validationFailures: IntegrityTimelineItem[];
  unsupportedClaims: NonNullable<DiagnosisEditorialWorkspace['unsupportedClaimsBySection']>;
  acceptedRepairs: NonNullable<DiagnosisEditorialWorkspace['education']['acceptedRepairs']>;
  audits: NonNullable<DiagnosisEditorialWorkspace['aiDraftAuditTrail']>;
  clueDrafts: NonNullable<DiagnosisEditorialWorkspace['materializedClueRevisionDrafts']>;
  revisionTimeline: IntegrityTimelineItem[];
  blockerCount: number;
};

const COVERAGE_BUCKETS: CoverageBucket[] = [
  'symptoms',
  'riskFactors',
  'investigations',
  'differentials',
  'management',
  'graphEvidence',
];

export function buildEditorialWorkspaceViewModel(
  workspace: DiagnosisEditorialWorkspace,
): EditorialWorkspaceViewModel {
  const coverageMatrix = buildCoverageMatrix(workspace.coverageMatrix);
  const caseInventoryBoard = buildCaseInventoryBoard(workspace);
  const graphBoard = buildGraphBoard(workspace);
  const integrityBoard = buildIntegrityBoard(workspace);

  return {
    diagnosisHealth: buildDiagnosisHealth(workspace, caseInventoryBoard),
    coverageMatrix,
    nextBestActions: buildNextBestActions(workspace),
    teachingRulesBoard: buildTeachingRulesBoard(workspace),
    educationBoard: buildEducationBoard(workspace),
    caseInventoryBoard,
    graphBoard,
    integrityBoard,
  };
}

function buildDiagnosisHealth(
  workspace: DiagnosisEditorialWorkspace,
  caseBoard: CaseInventoryBoardViewModel,
): DiagnosisHealthViewModel {
  const readinessCount = workspace.readinessBreakdown.reduce(
    (acc, item) => {
      if (item.severity === 'blocker') acc.blockers += 1;
      else if (item.severity === 'warning') acc.warnings += 1;
      else acc.informational += 1;
      return acc;
    },
    { blockers: 0, warnings: 0, informational: 0 },
  );

  return {
    status: formatLabel(workspace.workspaceSummary.status),
    statusTone: scoreTone(workspace.workspaceSummary.overallScore),
    blockers: workspace.workspaceSummary.blockers,
    warnings: workspace.workspaceSummary.warnings,
    readinessCount,
    tiles: [
      {
        id: 'metadata',
        label: 'Metadata',
        value: formatLabel(workspace.lifecycle.curriculum),
        detail: [
          workspace.diagnosis.specialty
            ? formatLabel(workspace.diagnosis.specialty)
            : 'No specialty',
          workspace.diagnosis.bodySystem
            ? formatLabel(workspace.diagnosis.bodySystem)
            : 'No body system',
        ].join(' - '),
        tone: lifecycleTone(workspace.lifecycle.curriculum),
      },
      {
        id: 'aliases',
        label: 'Aliases',
        value: workspace.diagnosis.aliases.length,
        detail: workspace.diagnosis.aliases.length
          ? 'Search and matching aliases present'
          : 'No aliases mapped',
        tone: workspace.diagnosis.aliases.length ? 'success' : 'warning',
      },
      {
        id: 'education',
        label: 'Education',
        value: formatLabel(workspace.education.status),
        detail: `${workspace.education.blockers.length} blockers - ${workspace.education.warnings.length} warnings`,
        tone: workspace.education.blockers.length
          ? 'danger'
          : workspace.education.warnings.length
            ? 'warning'
            : workspace.education.id
              ? 'success'
              : 'warning',
      },
      {
        id: 'basic-case',
        label: 'Basic case',
        value: difficultyStatus(caseBoard, 'Easy'),
        detail: 'Introductory recognition coverage',
        tone: caseBoard.missingDifficultyBands.includes('Easy')
          ? 'warning'
          : 'success',
      },
      {
        id: 'intermediate-case',
        label: 'Intermediate case',
        value: difficultyStatus(caseBoard, 'Medium'),
        detail: 'Typical presentation coverage',
        tone: caseBoard.missingDifficultyBands.includes('Medium')
          ? 'warning'
          : 'success',
      },
      {
        id: 'advanced-case',
        label: 'Advanced case',
        value: difficultyStatus(caseBoard, 'Hard'),
        detail: 'Mimic or escalation coverage',
        tone: caseBoard.missingDifficultyBands.includes('Hard')
          ? 'warning'
          : 'success',
      },
      {
        id: 'graph',
        label: 'Graph',
        value: formatLabel(workspace.graph.readiness),
        detail: `${workspace.graph.factCount} facts - ${workspace.graph.reviewableCandidateCount} reviewable candidates`,
        tone:
          workspace.graph.readiness === 'ready' ||
          workspace.graph.readiness === 'fact_ready'
            ? 'success'
            : 'warning',
      },
      {
        id: 'readiness',
        label: 'Readiness',
        value: readinessCount.blockers + readinessCount.warnings,
        detail: `${readinessCount.blockers} blockers - ${readinessCount.warnings} warnings`,
        tone: readinessCount.blockers
          ? 'danger'
          : readinessCount.warnings
            ? 'warning'
            : 'success',
      },
    ],
  };
}

function buildCoverageMatrix(
  rows: WorkspaceCoverageMatrixRow[],
): CoverageMatrixViewModel {
  const mappedRows = rows.map((row) => {
    const composite = coverageCompositeStatus(row);
    const status: CoverageMatrixRowViewModel['status'] =
      row.fullCoverageStatus === 'covered'
        ? 'covered'
        : row.educationCoverage === 'missing' ||
            row.caseCoverage === 'missing' ||
            row.graphCoverage === 'missing'
          ? 'missing'
          : 'warning';

    return {
      id: row.stableKey,
      title: row.title,
      category: formatLabel(row.category),
      bucket: coverageBucketForRow(row),
      status,
      tone: composite.tone,
      recommendedAction: row.recommendedAction,
      educationCoverage: row.educationCoverage,
      caseCoverage: row.caseCoverage,
      graphCoverage: row.graphCoverage,
    };
  });
  const byBucket = COVERAGE_BUCKETS.reduce(
    (acc, bucket) => ({ ...acc, [bucket]: [] }),
    {} as Record<CoverageBucket, CoverageMatrixRowViewModel[]>,
  );
  const summary = { covered: 0, warning: 0, missing: 0 };

  for (const row of mappedRows) {
    byBucket[row.bucket].push(row);
    summary[row.status] += 1;
  }

  return { rows: mappedRows, byBucket, summary };
}

function buildNextBestActions(
  workspace: DiagnosisEditorialWorkspace,
): NextBestActionViewModel[] {
  const recommended = workspace.recommendedActions.map((action) => {
    const target = getDefaultWorkspaceSectionForTab(action.targetTab);
    return {
      id: action.id,
      title: action.label,
      severity: action.severity ?? 'info',
      tone: severityTone(action.severity),
      reason:
        action.disabledReason ??
        action.source ??
        action.targetEndpoint ??
        'Recommended by workspace readiness analysis.',
      target,
      enabled: action.enabled,
      disabledReason: action.disabledReason,
    };
  });

  if (recommended.length) return recommended;

  return workspace.coverageGaps.slice(0, 3).map((gap, index) => ({
    id: `coverage-gap-${index}`,
    title: gap.title,
    severity: gap.severity,
    tone: severityTone(gap.severity),
    reason: gap.recommendedAction,
    target: getDefaultWorkspaceSectionForTab(gap.targetTab),
    enabled: true,
    disabledReason: null,
  }));
}

function buildTeachingRulesBoard(
  workspace: DiagnosisEditorialWorkspace,
): TeachingRulesBoardViewModel {
  const coverageByRule = new Map(
    workspace.coverageMatrix
      .filter((row) => row.teachingRuleId)
      .map((row) => [row.teachingRuleId as string, row]),
  );
  const relationshipCountByRule = workspace.graph.teachingRelationships.reduce(
    (acc, relationship) => {
      if (relationship.supportingTeachingRuleId) {
        acc.set(
          relationship.supportingTeachingRuleId,
          (acc.get(relationship.supportingTeachingRuleId) ?? 0) + 1,
        );
      }
      return acc;
    },
    new Map<string, number>(),
  );
  const cards = workspace.teachingRules.items.map((rule) =>
    teachingRuleCard(rule, coverageByRule, relationshipCountByRule),
  );

  return {
    activeRules: cards.filter((rule) => rule.raw.status === 'ACTIVE'),
    weakRules: cards.filter(
      (rule) =>
        rule.raw.status === 'ACTIVE' &&
        (rule.confidence !== 'high' ||
          Boolean(rule.raw.reasoningQualityWarnings?.length)),
    ),
    candidateRules: cards.filter((rule) => rule.raw.status !== 'ACTIVE'),
    totals: {
      active: workspace.teachingRules.summary.active,
      weak: cards.filter(
        (rule) =>
          rule.confidence !== 'high' ||
          Boolean(rule.raw.reasoningQualityWarnings?.length),
      ).length,
      candidate:
        workspace.teachingRules.summary.candidates +
        workspace.teachingRules.summary.needsReview,
      graphLinked: cards.filter((rule) => rule.raw.appliesToGraph).length,
      caseLinked: cards.filter((rule) => rule.raw.appliesToCaseGeneration).length,
    },
  };
}

function buildEducationBoard(
  workspace: DiagnosisEditorialWorkspace,
): EducationBoardViewModel {
  return {
    status: formatLabel(workspace.education.status),
    qualityScore: workspace.education.qualityScore,
    updatedAt: workspace.education.updatedAt,
    sections: workspace.education.sectionHealth.map((section) => {
      const tone = section.blockers.length
        ? 'danger'
        : section.warnings.length
          ? 'warning'
          : section.score === null
            ? 'neutral'
            : section.score >= 0.75
              ? 'success'
              : 'warning';

      return {
        id: section.section,
        name: formatLabel(section.section),
        status: section.blockers.length
          ? 'Blocked'
          : section.warnings.length
            ? 'Needs review'
            : 'Reviewable',
        tone,
        quality:
          section.score === null ? 'Unscored' : `${Math.round(section.score * 100)}%`,
        blockers: section.blockers,
        warnings: section.warnings,
        updatedAt: workspace.education.updatedAt,
        publishedState: formatLabel(workspace.education.status),
        target: getWorkspaceSectionForEducationSection(section.section),
      };
    }),
  };
}

function buildCaseInventoryBoard(
  workspace: DiagnosisEditorialWorkspace,
): CaseInventoryBoardViewModel {
  const caseCards = workspace.cases.items.map((item) => {
    const leakRisk =
      (item.clueProgression?.prematureLeakFlag ? 1 : 0) +
      (item.clueProgression?.unresolvedAmbiguityFlag ? 1 : 0);
    const blockers = item.qualityProjection.blockers;
    const warnings = item.qualityProjection.warnings;
    const tone: StatusBadgeTone = blockers.length
      ? 'danger'
      : warnings.length || leakRisk
        ? 'warning'
        : 'success';

    return {
      id: item.id,
      title: item.title,
      difficulty: formatLabel(item.difficulty || 'unknown'),
      editorialStatus: item.editorialStatus
        ? formatLabel(item.editorialStatus)
        : 'Unreviewed',
      tone,
      qualityState: blockers.length
        ? 'Blocked'
        : warnings.length
          ? 'Warning'
          : 'Clear',
      blockers,
      warnings,
      clueProgression: Boolean(item.clueProgression),
      leakRisk,
      updatedAt: item.updatedAt,
    };
  });
  const expectedBands = ['Easy', 'Medium', 'Hard'];
  const difficultyChips = expectedBands.map((band) => {
    const count = caseCards.filter((item) => item.difficulty === band).length;
    return {
      label: band,
      count,
      tone: count ? ('success' as StatusBadgeTone) : ('warning' as StatusBadgeTone),
    };
  });
  const leakRisk =
    (workspace.cases.summary.progressionSignals?.prematureLockInCases ?? 0) +
    (workspace.cases.summary.progressionSignals?.abruptGiveawayCases ?? 0);

  return {
    difficultyChips,
    missingDifficultyBands: difficultyChips
      .filter((chip) => chip.count === 0)
      .map((chip) => chip.label),
    caseCards,
    qualityQueue: caseCards.filter(
      (item) =>
        item.blockers.length ||
        item.warnings.length ||
        item.leakRisk ||
        !item.clueProgression,
    ),
    summary: {
      total: workspace.cases.summary.total,
      usable: workspace.cases.summary.usable,
      blockers: workspace.cases.summary.blockerCount,
      warnings: workspace.cases.summary.warningCount,
      leakRisk,
    },
  };
}

function buildGraphBoard(workspace: DiagnosisEditorialWorkspace): GraphBoardViewModel {
  const relationships = workspace.graph.teachingRelationships;
  const weakEdges = relationships.filter(
    (relationship) =>
      relationship.status !== 'ACTIVE' ||
      (!relationship.supportingGraphFact &&
        !relationship.supportingTeachingRule &&
        !relationship.supportingDifferentialLinkId),
  );

  return {
    centralDiagnosis: workspace.diagnosis.displayLabel,
    relationships: [
      relationshipGroup(
        'supports',
        'Supports',
        'success',
        relationships.filter(
          (relationship) =>
            relationship.supportingGraphFactId ||
            relationship.supportingTeachingRuleId ||
            relationship.supportingGraphFact ||
            relationship.supportingTeachingRule ||
            relationship.supportingDifferentialLinkId,
        ),
      ),
      relationshipGroup(
        'mimics',
        'Mimics',
        'warning',
        relationships.filter(
          (relationship) => relationship.relationshipType === 'MIMIC_CONFUSION',
        ),
      ),
      relationshipGroup(
        'rules-out',
        'Rules out',
        'info',
        relationships.filter(
          (relationship) =>
            relationship.relationshipType === 'DIFFERENTIAL_DISCRIMINATOR',
        ),
      ),
      relationshipGroup(
        'causes-triggers',
        'Causes / triggers',
        'danger',
        relationships.filter(
          (relationship) =>
            relationship.relationshipType === 'ESCALATION_CONTRAST',
        ),
      ),
      relationshipGroup(
        'complications',
        'Complications / escalation',
        'danger',
        relationships.filter(
          (relationship) =>
            relationship.relationshipType === 'COMPLICATION_RELATIONSHIP',
        ),
      ),
      relationshipGroup(
        'investigations-management',
        'Investigations / management',
        'neutral',
        relationships.filter(
          (relationship) =>
            relationship.relationshipType === 'INVESTIGATION_CONTRAST' ||
            relationship.relationshipType === 'MANAGEMENT_CONTRAST',
        ),
      ),
    ],
    pendingCandidates: workspace.graph.candidates.filter(
      (candidate) => candidate.status === 'CANDIDATE',
    ).length,
    weakEdges,
    duplicateConcepts:
      workspace.evidenceCoverage?.redundancy.overusedEvidence.map((item) => ({
        label: item.evidenceKey,
        reason: item.reason,
      })) ?? [],
  };
}

function buildIntegrityBoard(
  workspace: DiagnosisEditorialWorkspace,
): IntegrityBoardViewModel {
  const unsupportedClaims = workspace.unsupportedClaimsBySection ?? [];
  const acceptedRepairs = workspace.education.acceptedRepairs ?? [];
  const audits = workspace.aiDraftAuditTrail ?? [];
  const clueDrafts = workspace.materializedClueRevisionDrafts ?? [];
  const validationFailures = workspace.education.sectionHealth
    .filter((section) => section.blockers.length || section.warnings.length)
    .map((section) => ({
      id: `section-${section.section}`,
      title: formatLabel(section.section),
      detail: section.blockers[0] ?? section.warnings[0] ?? 'Needs review.',
      status: section.blockers.length ? 'Blocked' : 'Warning',
      tone: section.blockers.length
        ? ('danger' as StatusBadgeTone)
        : ('warning' as StatusBadgeTone),
    }));
  const blockingClaims = unsupportedClaims.filter((claim) => claim.blocksPublication);
  const pendingAudits = audits.filter((audit) =>
    ['PENDING_REVIEW', 'REVIEW_REQUIRED', 'NEEDS_CHANGES'].includes(
      audit.reviewStatus,
    ),
  );
  const pendingClueDrafts = clueDrafts.filter((draft) =>
    ['PENDING_REVIEW', 'NEEDS_CHANGES', 'BLOCKED_CASE_NOT_EDITABLE'].includes(
      draft.status,
    ),
  );

  return {
    blockers: [
      ...validationFailures
        .filter((failure) => failure.tone === 'danger')
        .map((failure) => failure.detail),
      ...blockingClaims.map((claim) => claim.claimText),
    ],
    validationFailures,
    unsupportedClaims,
    acceptedRepairs,
    audits,
    clueDrafts,
    revisionTimeline: workspace.revisions.items.slice(0, 5).map((revision) => ({
      id: `revision-${revision.version}`,
      title: `Revision ${revision.version}`,
      detail: revision.createdAt,
      status: formatLabel(revision.editorialStatus),
      tone: revision.quality.blockerCount
        ? 'danger'
        : revision.quality.warningCount
          ? 'warning'
          : 'success',
    })),
    blockerCount:
      validationFailures.filter((failure) => failure.tone === 'danger').length +
      blockingClaims.length +
      pendingAudits.length +
      pendingClueDrafts.length,
  };
}

function teachingRuleCard(
  rule: DiagnosisTeachingRule,
  coverageByRule: Map<string, WorkspaceCoverageMatrixRow>,
  relationshipCountByRule: Map<string, number>,
): TeachingRuleCardViewModel {
  const coverage = coverageByRule.get(rule.id);
  const evidenceCount = [
    rule.expectedEvidence,
    coverage?.educationCoverage === 'covered' ? coverage : null,
  ].filter(Boolean).length;
  const graphEdges = relationshipCountByRule.get(rule.id) ?? 0;
  const linkedCases = coverage?.caseCoverage === 'covered' ? 1 : 0;
  const confidence =
    evidenceCount && graphEdges && linkedCases
      ? 'high'
      : evidenceCount || graphEdges || linkedCases
        ? 'medium'
        : 'low';
  const tone =
    rule.status !== 'ACTIVE'
      ? 'warning'
      : confidence === 'high'
        ? 'success'
        : 'warning';

  return {
    id: rule.id,
    title: rule.title,
    state: formatLabel(rule.status),
    tone,
    confidence,
    evidenceCount,
    linkedCases,
    graphEdges,
    reason:
      rule.reasoningQualityWarnings?.[0] ??
      rule.rationale ??
      'No rationale recorded.',
    source: formatLabel(rule.source),
    target: coverage
      ? { tab: 'teaching-rules', sectionId: 'teaching-coverage-matrix' }
      : undefined,
    raw: rule,
  };
}

function coverageBucketForRow(row: WorkspaceCoverageMatrixRow): CoverageBucket {
  const text = `${row.category} ${row.title} ${row.recommendedAction}`.toLowerCase();
  if (text.includes('risk')) return 'riskFactors';
  if (text.includes('investig') || text.includes('test') || text.includes('lab')) {
    return 'investigations';
  }
  if (text.includes('differential') || text.includes('mimic')) return 'differentials';
  if (text.includes('management') || text.includes('treat')) return 'management';
  if (row.graphCoverage !== 'covered') return 'graphEvidence';
  return 'symptoms';
}

function relationshipGroup(
  id: string,
  label: string,
  tone: StatusBadgeTone,
  relationships: DiagnosisTeachingRelationship[],
): GraphRelationshipGroup {
  return { id, label, tone, relationships };
}

function difficultyStatus(board: CaseInventoryBoardViewModel, band: string) {
  const count = board.difficultyChips.find((chip) => chip.label === band)?.count ?? 0;
  return count ? `${count} present` : 'Missing';
}

function lifecycleTone(value: string): StatusBadgeTone {
  if (value === 'complete') return 'success';
  if (value === 'blocked') return 'danger';
  if (value === 'not_started') return 'neutral';
  return 'warning';
}

function severityTone(
  value: WorkspaceReadinessSeverity | null | undefined,
): StatusBadgeTone {
  if (value === 'blocker') return 'danger';
  if (value === 'warning') return 'warning';
  return 'info';
}

