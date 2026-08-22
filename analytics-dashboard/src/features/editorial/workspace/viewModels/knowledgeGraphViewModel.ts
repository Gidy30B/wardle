import type {
  CaseClueDiscriminatorAnnotation,
  CaseClueRevisionDraft,
  DiagnosisEditorialWorkspace,
  DiagnosisEvidenceRelationship,
  DiagnosisGraphCandidate,
  DiagnosisTeachingRule,
  DiagnosisTeachingRelationship,
  DiscriminatorDraftReview,
  EvidenceCoverageDiagnosis,
  ReasoningPath,
  StructuredDifferentialLink,
  UnsupportedClaimBySection,
  WorkspaceReadinessItem,
  WorkspaceReadinessSeverity,
} from '../../../../api/admin.types.ts';

export type KnowledgeSignalSeverity = WorkspaceReadinessSeverity;

export type KnowledgeReviewItemKind =
  | 'readiness'
  | 'workspace_blocker'
  | 'workspace_warning'
  | 'coverage_gap'
  | 'unsupported_claim'
  | 'graph_candidate'
  | 'teaching_relationship'
  | 'teaching_rule'
  | 'evidence_relationship'
  | 'reasoning_path'
  | 'discriminator_draft'
  | 'clinical_case_draft'
  | 'clue_revision_draft'
  | 'case_quality';

export type KnowledgeReviewItem = {
  id: string;
  kind: KnowledgeReviewItemKind;
  severity: KnowledgeSignalSeverity;
  title: string;
  detail: string;
  targetWorkflow:
    | 'reviewQueue'
    | 'overview'
    | 'teaching'
    | 'reasoning'
    | 'cases'
    | 'content'
    | 'publish';
  targetBoard?:
    | 'diagnosisHealth'
    | 'curriculumCoverage'
    | 'teachingRules'
    | 'diagnosticReasoning'
    | 'evidence'
    | 'differentials'
    | 'reasoningPaths'
    | 'diagnosticCases'
    | 'clueProgression'
    | 'reasoningCoverage'
    | 'discriminatorCoverage'
    | 'education'
    | 'scoringSystems'
    | 'mnemonics'
    | 'recallPrompts'
    | 'publicationReadiness';
  sourceId: string | null;
  reviewStatus?: string | null;
  repairable?: boolean;
  raw?: unknown;
};

export type KnowledgeBlocker = KnowledgeReviewItem & {
  severity: 'blocker';
};

export type KnowledgeEvidenceRelationship = {
  id: string;
  label: string;
  relationshipType: string;
  status: string;
  strength: number;
  discriminatorWeight: number;
  trust: 'high' | 'medium' | 'low';
  isActive: boolean;
  isCandidate: boolean;
  isRejected: boolean;
  isLowTrust: boolean;
  supportsDiscrimination: boolean;
  reasoningSummary: string | null;
  targetDiagnosisName: string | null;
  readinessReasons: string[];
  raw: DiagnosisEvidenceRelationship;
};

export type KnowledgeUnsupportedClaim = {
  id: string;
  sectionId: string;
  sectionType: string;
  claimText: string;
  severity: KnowledgeSignalSeverity;
  blocksPublication: boolean;
  evidenceIds: string[];
  repairableAutomatically: boolean;
  raw: UnsupportedClaimBySection;
};

export type KnowledgeEvidenceCoverage = {
  score: number | null;
  tier: string | null;
  weaknesses: string[];
  discriminatorEvidenceCount: number;
  missingEvidenceLabels: string[];
  raw: EvidenceCoverageDiagnosis | null;
};

export type KnowledgeDifferential = {
  id: string;
  diagnosisRegistryId: string;
  displayLabel: string;
  role: string;
  confidence: number | null;
  sourceText: string;
  raw: StructuredDifferentialLink;
};

export type KnowledgeMimicSeparation = {
  id: string;
  targetDiagnosisId: string;
  targetDiagnosisName: string;
  relationshipType: string;
  status: string;
  strength: number;
  discriminatorSummary: string | null;
  commonConfusionReason: string | null;
  learnerPitfall: string | null;
  readinessReasons: string[];
  raw: DiagnosisTeachingRelationship;
};

export type KnowledgeDifferentialIssue = {
  id: string;
  severity: KnowledgeSignalSeverity;
  mimicName: string;
  reason: string;
  source: 'linked_differential' | 'teaching_relationship' | 'coverage_gap';
  raw?: unknown;
};

export type KnowledgeReasoningPath = {
  id: string;
  title: string;
  status: string;
  reasoningGoal: string;
  generationPurpose: string;
  readinessScore: number;
  readinessTier: string;
  readinessReasons: string[];
  qualityWarnings: string[];
  isActive: boolean;
  isWeak: boolean;
  isGenerationReady: boolean;
  primaryDifferentialIds: string[];
  supportingTeachingRelationshipIds: string[];
  supportingEvidenceRelationshipIds: string[];
  requiredTeachingPoints: string[];
  raw: ReasoningPath;
};

export type KnowledgeReasoningIssue = {
  id: string;
  severity: KnowledgeSignalSeverity;
  title: string;
  reason: string;
  reasoningPathId: string;
  raw: ReasoningPath;
};

export type KnowledgeCaseReasoning = {
  id: string;
  title: string;
  editorialStatus: string | null;
  difficulty: string;
  hasClueProgression: boolean;
  prematureLockIn: boolean;
  unresolvedAmbiguity: boolean;
  ambiguityScore: number | null;
  confidenceEstimate: number | null;
  leadingDifferentials: string[];
  remainingMimics: string[];
  discriminatorSignals: string[];
  blockerCount: number;
  warningCount: number;
  clueInterpretations: KnowledgeClueInterpretationSignal[];
  mimicEliminations: KnowledgeCaseMimicElimination[];
  discriminatorAnnotations: CaseClueDiscriminatorAnnotation[];
  raw: DiagnosisEditorialWorkspace['cases']['items'][number];
};

export type KnowledgeClueInterpretationSignal = {
  clueIndex: number;
  clue: string;
  clueType: string;
  leadingDifferentials: string[];
  remainingMimics: string[];
  collapsedMimics: string[];
  discriminatorSignals: string[];
  ambiguityScore: number;
  learnerConfusionRisk: string;
  progressionQuality: string;
  editorialConcern: string | null;
};

export type KnowledgeCaseMimicElimination = {
  mimicName: string;
  finalStatus: string;
  discriminatorUsed: string | null;
  eliminationStrength: string;
  educationalValue: string;
  prematureCollapseRisk: boolean;
  remainingConfusionRisk: boolean;
};

export type KnowledgeDiscriminatorDraft = {
  id: string;
  status: string;
  mimicName: string;
  discriminator: string;
  caseId: string | null;
  sourceClueOrder: number | null;
  raw: DiscriminatorDraftReview;
};

export type KnowledgeClueRevisionDraft = {
  id: string;
  status: string;
  caseId: string;
  clueOrder: number | null;
  rationale: string | null;
  expectedEffect: string | null;
  canApply: boolean;
  raw: CaseClueRevisionDraft;
};

export type KnowledgeGraphViewModel = {
  diagnosis: {
    id: string;
    name: string;
    canonicalName: string;
  };
  evidence: {
    relationships: KnowledgeEvidenceRelationship[];
    active: KnowledgeEvidenceRelationship[];
    candidates: KnowledgeEvidenceRelationship[];
    rejected: KnowledgeEvidenceRelationship[];
    lowTrust: KnowledgeEvidenceRelationship[];
    unsupportedClaims: KnowledgeUnsupportedClaim[];
    coverage: KnowledgeEvidenceCoverage;
  };
  differentials: {
    linkedMimics: KnowledgeDifferential[];
    unresolvedMappings: KnowledgeDifferentialIssue[];
    mimicSeparation: KnowledgeMimicSeparation[];
    discriminatorGaps: KnowledgeDifferentialIssue[];
  };
  reasoning: {
    paths: KnowledgeReasoningPath[];
    activePaths: KnowledgeReasoningPath[];
    weakPaths: KnowledgeReasoningPath[];
    generationReadyPaths: KnowledgeReasoningPath[];
    ungroundedWarnings: KnowledgeReasoningIssue[];
  };
  cases: {
    caseReasoning: KnowledgeCaseReasoning[];
    prematureLockInCases: KnowledgeCaseReasoning[];
    unresolvedMimicCases: KnowledgeCaseReasoning[];
    discriminatorDrafts: KnowledgeDiscriminatorDraft[];
    clueRevisionDrafts: KnowledgeClueRevisionDraft[];
  };
  blockers: KnowledgeBlocker[];
  reviewItems: KnowledgeReviewItem[];
};

export function buildKnowledgeGraphViewModel(
  workspace: DiagnosisEditorialWorkspace,
): KnowledgeGraphViewModel {
  const evidenceRelationships = workspace.evidenceGraph.relationships.map(
    mapEvidenceRelationship,
  );
  const unsupportedClaims = (workspace.unsupportedClaimsBySection ?? []).map(
    mapUnsupportedClaim,
  );
  const linkedMimics = (workspace.linkedDifferentials ?? []).map(
    mapLinkedDifferential,
  );
  const mimicSeparation = workspace.graph.teachingRelationships
    .filter(isDifferentialRelationship)
    .map(mapMimicSeparation);
  const reasoningPaths = workspace.reasoningPaths.map(mapReasoningPath);
  const caseReasoning = workspace.cases.items.map(mapCaseReasoning);
  const discriminatorDrafts = (workspace.discriminatorDraftReviews ?? []).map(
    mapDiscriminatorDraft,
  );
  const clueRevisionDrafts = (
    workspace.materializedClueRevisionDrafts ?? []
  ).map(mapClueRevisionDraft);

  const reviewItems = buildReviewItems({
    workspace,
    unsupportedClaims,
    evidenceRelationships,
    reasoningPaths,
    caseReasoning,
    discriminatorDrafts,
    clueRevisionDrafts,
  });

  return {
    diagnosis: {
      id: workspace.diagnosis.id,
      name: workspace.diagnosis.displayLabel,
      canonicalName: workspace.diagnosis.canonicalName,
    },
    evidence: {
      relationships: evidenceRelationships,
      active: evidenceRelationships.filter((item) => item.isActive),
      candidates: evidenceRelationships.filter((item) => item.isCandidate),
      rejected: evidenceRelationships.filter((item) => item.isRejected),
      lowTrust: evidenceRelationships.filter((item) => item.isLowTrust),
      unsupportedClaims,
      coverage: mapEvidenceCoverage(workspace.evidenceCoverage),
    },
    differentials: {
      linkedMimics,
      unresolvedMappings: buildUnresolvedDifferentialIssues(workspace),
      mimicSeparation,
      discriminatorGaps: buildDiscriminatorGaps(linkedMimics, mimicSeparation),
    },
    reasoning: {
      paths: reasoningPaths,
      activePaths: reasoningPaths.filter((path) => path.isActive),
      weakPaths: reasoningPaths.filter((path) => path.isWeak),
      generationReadyPaths: reasoningPaths.filter(
        (path) => path.isGenerationReady,
      ),
      ungroundedWarnings: buildReasoningWarnings(reasoningPaths),
    },
    cases: {
      caseReasoning,
      prematureLockInCases: caseReasoning.filter(
        (item) => item.prematureLockIn,
      ),
      unresolvedMimicCases: caseReasoning.filter(
        (item) =>
          item.unresolvedAmbiguity ||
          item.remainingMimics.length > 0 ||
          item.mimicEliminations.some(
            (elimination) =>
              elimination.finalStatus === 'persistent' ||
              elimination.finalStatus === 'unresolved' ||
              elimination.remainingConfusionRisk,
          ),
      ),
      discriminatorDrafts,
      clueRevisionDrafts,
    },
    blockers: reviewItems.filter(isBlocker),
    reviewItems: sortReviewItems(reviewItems),
  };
}

function mapEvidenceRelationship(
  relationship: DiagnosisEvidenceRelationship,
): KnowledgeEvidenceRelationship {
  const readinessReasons = relationship.readiness?.reasons ?? [];
  const isLowTrust =
    relationship.strength < 0.5 ||
    relationship.discriminatorWeight < 0.4 ||
    relationship.readiness?.ready === false;

  return {
    id: relationship.id,
    label: relationship.evidenceNode.displayLabel,
    relationshipType: relationship.relationshipType,
    status: relationship.status,
    strength: relationship.strength,
    discriminatorWeight: relationship.discriminatorWeight,
    trust: relationship.strength >= 0.75 && !isLowTrust
      ? 'high'
      : isLowTrust
        ? 'low'
        : 'medium',
    isActive: relationship.status === 'ACTIVE',
    isCandidate: relationship.status === 'CANDIDATE',
    isRejected:
      relationship.status === 'REJECTED' ||
      relationship.status === 'DEPRECATED',
    isLowTrust,
    supportsDiscrimination:
      relationship.relationshipType === 'DISCRIMINATES' ||
      relationship.relationshipType === 'RULES_OUT' ||
      relationship.discriminatorWeight >= 0.6,
    reasoningSummary: relationship.reasoningSummary,
    targetDiagnosisName:
      relationship.supportingTeachingRelationship?.targetDiagnosisRegistry
        ?.displayLabel ?? null,
    readinessReasons,
    raw: relationship,
  };
}

function mapUnsupportedClaim(
  claim: UnsupportedClaimBySection,
): KnowledgeUnsupportedClaim {
  return {
    id: claim.claimId,
    sectionId: claim.sectionId,
    sectionType: claim.sectionType,
    claimText: claim.claimText,
    severity: claim.severity,
    blocksPublication: claim.blocksPublication,
    evidenceIds: claim.evidenceIds,
    repairableAutomatically: claim.repairableAutomatically,
    raw: claim,
  };
}

function mapEvidenceCoverage(
  coverage: EvidenceCoverageDiagnosis | null,
): KnowledgeEvidenceCoverage {
  return {
    score: coverage?.coverageScore ?? null,
    tier: coverage?.generationReadinessTier ?? null,
    weaknesses: coverage?.coverageWeaknesses ?? [],
    discriminatorEvidenceCount:
      coverage?.coverageBreakdown.discriminatorEvidenceCount ?? 0,
    missingEvidenceLabels:
      coverage?.missingEvidence.map((item) => item.label) ?? [],
    raw: coverage,
  };
}

function mapLinkedDifferential(
  link: StructuredDifferentialLink,
): KnowledgeDifferential {
  return {
    id: link.id ?? link.diagnosisRegistryId,
    diagnosisRegistryId: link.diagnosisRegistryId,
    displayLabel: link.displayLabel,
    role: link.role,
    confidence: link.confidence,
    sourceText: link.sourceText,
    raw: link,
  };
}

function isDifferentialRelationship(
  relationship: DiagnosisTeachingRelationship,
): boolean {
  return (
    relationship.relationshipType === 'DIFFERENTIAL_DISCRIMINATOR' ||
    relationship.relationshipType === 'MIMIC_CONFUSION' ||
    relationship.teachingPurpose === 'TEACH_DISCRIMINATOR' ||
    relationship.teachingPurpose === 'PREVENT_COMMON_ERROR'
  );
}

function mapMimicSeparation(
  relationship: DiagnosisTeachingRelationship,
): KnowledgeMimicSeparation {
  return {
    id: relationship.id,
    targetDiagnosisId: relationship.targetDiagnosisRegistryId,
    targetDiagnosisName: relationship.targetDiagnosisRegistry.displayLabel,
    relationshipType: relationship.relationshipType,
    status: relationship.status,
    strength: relationship.strength,
    discriminatorSummary: relationship.discriminatorSummary,
    commonConfusionReason: relationship.commonConfusionReason,
    learnerPitfall: relationship.learnerPitfall,
    readinessReasons: relationship.readiness?.reasons ?? [],
    raw: relationship,
  };
}

function buildUnresolvedDifferentialIssues(
  workspace: DiagnosisEditorialWorkspace,
): KnowledgeDifferentialIssue[] {
  return workspace.coverageGaps
    .filter(
      (gap) =>
        gap.missingGraph &&
        (gap.targetTab === 'graph' ||
          gap.title.toLowerCase().includes('differential') ||
          gap.title.toLowerCase().includes('mimic')),
    )
    .map((gap, index) => ({
      id: `coverage-gap:${gap.teachingRuleId ?? index}`,
      severity: gap.severity,
      mimicName: gap.title,
      reason: gap.recommendedAction,
      source: 'coverage_gap',
      raw: gap,
    }));
}

function buildDiscriminatorGaps(
  linkedMimics: KnowledgeDifferential[],
  mimicSeparation: KnowledgeMimicSeparation[],
): KnowledgeDifferentialIssue[] {
  const separatedIds = new Set(
    mimicSeparation
      .filter((item) => item.status === 'ACTIVE')
      .map((item) => item.targetDiagnosisId),
  );

  return linkedMimics
    .filter((mimic) => !separatedIds.has(mimic.diagnosisRegistryId))
    .map((mimic) => ({
      id: `missing-discriminator:${mimic.diagnosisRegistryId}`,
      severity: 'warning',
      mimicName: mimic.displayLabel,
      reason: `${mimic.displayLabel} is linked as a mimic but does not have an active discriminator relationship.`,
      source: 'linked_differential',
      raw: mimic.raw,
    }));
}

function mapReasoningPath(path: ReasoningPath): KnowledgeReasoningPath {
  const isWeak =
    path.readinessTier === 'weak' ||
    path.readinessScore < 0.5 ||
    path.reasoningQualityWarnings.length > 0;

  return {
    id: path.id,
    title: path.title,
    status: path.status,
    reasoningGoal: path.reasoningGoal,
    generationPurpose: path.generationPurpose,
    readinessScore: path.readinessScore,
    readinessTier: path.readinessTier,
    readinessReasons: path.readinessReasons,
    qualityWarnings: path.reasoningQualityWarnings,
    isActive: path.status === 'ACTIVE',
    isWeak,
    isGenerationReady:
      path.status === 'ACTIVE' &&
      path.readinessTier === 'ready' &&
      path.readinessScore >= 0.75,
    primaryDifferentialIds: path.primaryDifferentialIds,
    supportingTeachingRelationshipIds: path.supportingTeachingRelationshipIds,
    supportingEvidenceRelationshipIds: path.supportingEvidenceRelationshipIds,
    requiredTeachingPoints: path.requiredTeachingPoints,
    raw: path,
  };
}

function buildReasoningWarnings(
  paths: KnowledgeReasoningPath[],
): KnowledgeReasoningIssue[] {
  return paths.flatMap((path) => {
    const reasons = [
      ...path.readinessReasons.filter(() => path.isWeak),
      ...path.qualityWarnings,
    ];

    return reasons.map((reason, index) => ({
      id: `reasoning-warning:${path.id}:${index}`,
      severity: path.readinessTier === 'weak' ? 'blocker' : 'warning',
      title: path.title,
      reason,
      reasoningPathId: path.id,
      raw: path.raw,
    }));
  });
}

function mapCaseReasoning(
  item: DiagnosisEditorialWorkspace['cases']['items'][number],
): KnowledgeCaseReasoning {
  const progression = item.clueProgression;
  const qualityProjection = item.qualityProjection as {
    blockers?: unknown[];
    warnings?: unknown[];
  };

  return {
    id: item.id,
    title: item.title,
    editorialStatus: item.editorialStatus,
    difficulty: item.difficulty,
    hasClueProgression: Boolean(progression),
    prematureLockIn: progression?.prematureLeakFlag ?? false,
    unresolvedAmbiguity: progression?.unresolvedAmbiguityFlag ?? false,
    ambiguityScore: progression?.ambiguityScore ?? null,
    confidenceEstimate: progression?.confidenceEstimate ?? null,
    leadingDifferentials: progression?.leadingDifferentials ?? [],
    remainingMimics: progression?.remainingMimics ?? [],
    discriminatorSignals: progression?.discriminatorSignals ?? [],
    blockerCount: qualityProjection.blockers?.length ?? 0,
    warningCount: qualityProjection.warnings?.length ?? 0,
    clueInterpretations:
      progression?.diagnosticStates.map((state) => ({
        clueIndex: state.clueIndex,
        clue: state.clue,
        clueType: state.clueType,
        leadingDifferentials: state.leadingDifferentials,
        remainingMimics: state.remainingMimics,
        collapsedMimics: state.collapsedMimics,
        discriminatorSignals: state.discriminatorSignals,
        ambiguityScore: state.ambiguityScore,
        learnerConfusionRisk: state.learnerConfusionRisk,
        progressionQuality: state.progressionQuality,
        editorialConcern: state.editorialConcern,
      })) ?? [],
    mimicEliminations:
      progression?.differentialElimination.map((elimination) => ({
        mimicName: elimination.mimicName,
        finalStatus: elimination.finalStatus,
        discriminatorUsed: elimination.discriminatorUsed ?? null,
        eliminationStrength: elimination.eliminationStrength,
        educationalValue: elimination.educationalValue,
        prematureCollapseRisk: elimination.prematureCollapseRisk,
        remainingConfusionRisk: elimination.remainingConfusionRisk,
      })) ?? [],
    discriminatorAnnotations: item.clueDiscriminatorAnnotations ?? [],
    raw: item,
  };
}

function mapDiscriminatorDraft(
  draft: DiscriminatorDraftReview,
): KnowledgeDiscriminatorDraft {
  return {
    id: draft.auditId,
    status: draft.reviewStatus,
    mimicName: draft.mimicName,
    discriminator: draft.discriminator,
    caseId: draft.caseId ?? null,
    sourceClueOrder: draft.sourceClueOrder ?? null,
    raw: draft,
  };
}

function mapClueRevisionDraft(
  draft: CaseClueRevisionDraft,
): KnowledgeClueRevisionDraft {
  return {
    id: draft.id,
    status: draft.status,
    caseId: draft.caseId,
    clueOrder: draft.clueOrder,
    rationale: draft.rationale,
    expectedEffect: draft.expectedEffect,
    canApply: draft.canApply ?? false,
    raw: draft,
  };
}

function buildReviewItems(params: {
  workspace: DiagnosisEditorialWorkspace;
  unsupportedClaims: KnowledgeUnsupportedClaim[];
  evidenceRelationships: KnowledgeEvidenceRelationship[];
  reasoningPaths: KnowledgeReasoningPath[];
  caseReasoning: KnowledgeCaseReasoning[];
  discriminatorDrafts: KnowledgeDiscriminatorDraft[];
  clueRevisionDrafts: KnowledgeClueRevisionDraft[];
}): KnowledgeReviewItem[] {
  const {
    workspace,
    unsupportedClaims,
    evidenceRelationships,
    reasoningPaths,
    caseReasoning,
    discriminatorDrafts,
    clueRevisionDrafts,
  } = params;

  return [
    ...workspace.readinessBreakdown.map(mapReadinessItem),
    ...workspace.workspaceSummary.blockers.map((message, index) =>
      textReviewItem({
        id: `workspace-blocker:${index}`,
        kind: 'workspace_blocker',
        severity: 'blocker',
        title: 'Workspace blocker',
        detail: message,
        targetWorkflow: 'publish',
        targetBoard: 'publicationReadiness',
      }),
    ),
    ...workspace.workspaceSummary.warnings.map((message, index) =>
      textReviewItem({
        id: `workspace-warning:${index}`,
        kind: 'workspace_warning',
        severity: 'warning',
        title: 'Workspace warning',
        detail: message,
        targetWorkflow: 'reviewQueue',
      }),
    ),
    ...workspace.coverageGaps.map((gap, index) =>
      textReviewItem({
        id: `coverage-gap:${gap.teachingRuleId ?? index}`,
        kind: 'coverage_gap',
        severity: gap.severity,
        title: gap.title,
        detail: gap.recommendedAction,
        targetWorkflow: 'teaching',
        targetBoard: 'curriculumCoverage',
        sourceId: gap.teachingRuleId,
        raw: gap,
      }),
    ),
    ...workspace.teachingRules.items
      .filter((rule) =>
        rule.status === 'CANDIDATE' || rule.status === 'NEEDS_REVIEW',
      )
      .map(mapTeachingRuleReviewItem),
    ...unsupportedClaims.map((claim) =>
      textReviewItem({
        id: `unsupported-claim:${claim.id}`,
        kind: 'unsupported_claim',
        severity: claim.blocksPublication ? 'blocker' : claim.severity,
        title: `Unsupported ${claim.sectionType} claim`,
        detail: claim.claimText,
        targetWorkflow: claim.blocksPublication ? 'publish' : 'content',
        targetBoard: claim.blocksPublication
          ? 'publicationReadiness'
          : 'education',
        sourceId: claim.id,
        repairable: claim.repairableAutomatically,
        raw: claim.raw,
      }),
    ),
    ...workspace.graph.candidates
      .filter((candidate) => candidate.status === 'CANDIDATE')
      .map(mapGraphCandidateReviewItem),
    ...workspace.graph.teachingRelationships
      .filter(
        (relationship) =>
          relationship.status === 'CANDIDATE' ||
          relationship.status === 'NEEDS_REVIEW',
      )
      .map(mapTeachingRelationshipReviewItem),
    ...evidenceRelationships
      .filter((relationship) => relationship.isCandidate || relationship.isLowTrust)
      .map(mapEvidenceRelationshipReviewItem),
    ...reasoningPaths
      .filter((path) => path.status === 'CANDIDATE' || path.isWeak)
      .map(mapReasoningPathReviewItem),
    ...caseReasoning
      .filter(
        (item) =>
          item.blockerCount > 0 ||
          item.warningCount > 0 ||
          item.prematureLockIn ||
          item.unresolvedAmbiguity,
      )
      .map(mapCaseReasoningReviewItem),
    ...discriminatorDrafts
      .filter((draft) => isPendingDraftStatus(draft.status))
      .map((draft) =>
        textReviewItem({
          id: `discriminator-draft:${draft.id}`,
          kind: 'discriminator_draft',
          severity: 'warning',
          title: `Review discriminator for ${draft.mimicName}`,
          detail: draft.discriminator,
          targetWorkflow: 'cases',
          targetBoard: 'diagnosticCases',
          sourceId: draft.id,
          reviewStatus: draft.status,
          raw: draft.raw,
        }),
      ),
    ...clueRevisionDrafts
      .filter((draft) => isPendingDraftStatus(draft.status))
      .map((draft) =>
        textReviewItem({
          id: `clue-revision-draft:${draft.id}`,
          kind: 'clue_revision_draft',
          severity: draft.canApply ? 'warning' : 'info',
          title: 'Review clue revision draft',
          detail: draft.expectedEffect ?? draft.rationale ?? 'Draft needs review.',
          targetWorkflow: 'cases',
          targetBoard: 'diagnosticCases',
          sourceId: draft.id,
          reviewStatus: draft.status,
          raw: draft.raw,
        }),
      ),
  ];
}

function mapTeachingRuleReviewItem(
  rule: DiagnosisTeachingRule,
): KnowledgeReviewItem {
  return textReviewItem({
    id: `teaching-rule:${rule.id}`,
    kind: 'teaching_rule',
    severity: rule.importance === 'critical' ? 'warning' : 'info',
    title: rule.title,
    detail: rule.rationale ?? 'Teaching rule needs editorial review.',
    targetWorkflow: 'teaching',
    targetBoard: 'teachingRules',
    sourceId: rule.id,
    reviewStatus: rule.status,
    raw: rule,
  });
}

function mapReadinessItem(item: WorkspaceReadinessItem): KnowledgeReviewItem {
  const target = mapLegacyTargetTab(item.targetTab);

  return {
    id: `readiness:${item.actionId}`,
    kind: 'readiness',
    severity: item.severity,
    title: item.source,
    detail: item.message,
    targetWorkflow: target.targetWorkflow,
    targetBoard: target.targetBoard,
    sourceId: item.actionId,
    raw: item,
  };
}

function mapGraphCandidateReviewItem(
  candidate: DiagnosisGraphCandidate,
): KnowledgeReviewItem {
  return textReviewItem({
    id: `graph-candidate:${candidate.id}`,
    kind: 'graph_candidate',
    severity: candidate.type === 'MIMIC' ? 'warning' : 'info',
    title: `Review ${candidate.type.toLowerCase()} candidate`,
    detail: candidate.rawText,
    targetWorkflow: candidate.type === 'MIMIC' ? 'reasoning' : 'reviewQueue',
    targetBoard: candidate.type === 'MIMIC' ? 'differentials' : undefined,
    sourceId: candidate.id,
    raw: candidate,
  });
}

function mapTeachingRelationshipReviewItem(
  relationship: DiagnosisTeachingRelationship,
): KnowledgeReviewItem {
  return textReviewItem({
    id: `teaching-relationship:${relationship.id}`,
    kind: 'teaching_relationship',
    severity: relationship.readiness?.ready === false ? 'blocker' : 'warning',
    title: `Review ${relationship.relationshipType.toLowerCase()} relationship`,
    detail:
      relationship.discriminatorSummary ??
      relationship.commonConfusionReason ??
      `${relationship.sourceDiagnosisRegistry.displayLabel} -> ${relationship.targetDiagnosisRegistry.displayLabel}`,
    targetWorkflow: 'reasoning',
    targetBoard: 'differentials',
    sourceId: relationship.id,
    reviewStatus: relationship.status,
    raw: relationship,
  });
}

function mapEvidenceRelationshipReviewItem(
  relationship: KnowledgeEvidenceRelationship,
): KnowledgeReviewItem {
  return textReviewItem({
    id: `evidence-relationship:${relationship.id}`,
    kind: 'evidence_relationship',
    severity: relationship.isLowTrust ? 'warning' : 'info',
    title: `Review evidence: ${relationship.label}`,
    detail:
      relationship.readinessReasons[0] ??
      relationship.reasoningSummary ??
      `${relationship.relationshipType} evidence requires review.`,
    targetWorkflow: 'reasoning',
    targetBoard: 'evidence',
    sourceId: relationship.id,
    raw: relationship.raw,
  });
}

function mapReasoningPathReviewItem(
  path: KnowledgeReasoningPath,
): KnowledgeReviewItem {
  return textReviewItem({
    id: `reasoning-path:${path.id}`,
    kind: 'reasoning_path',
    severity: path.readinessTier === 'weak' ? 'blocker' : 'warning',
    title: path.title,
    detail:
      path.readinessReasons[0] ??
      path.qualityWarnings[0] ??
      'Reasoning path needs review.',
    targetWorkflow: 'reasoning',
    targetBoard: 'reasoningPaths',
    sourceId: path.id,
    reviewStatus: path.status,
    raw: path.raw,
  });
}

function mapCaseReasoningReviewItem(
  item: KnowledgeCaseReasoning,
): KnowledgeReviewItem {
  const detail = item.prematureLockIn
    ? 'Case may reveal the target diagnosis too early.'
    : item.unresolvedAmbiguity
      ? 'Case leaves important mimics unresolved.'
      : `${item.blockerCount} blockers and ${item.warningCount} warnings.`;

  return textReviewItem({
    id: `case-quality:${item.id}`,
    kind: 'case_quality',
    severity: item.blockerCount > 0 || item.prematureLockIn ? 'blocker' : 'warning',
    title: item.title,
    detail,
    targetWorkflow: 'cases',
    targetBoard: 'diagnosticCases',
    sourceId: item.id,
    raw: item.raw,
  });
}

function textReviewItem(params: {
  id: string;
  kind: KnowledgeReviewItemKind;
  severity: KnowledgeSignalSeverity;
  title: string;
  detail: string;
  targetWorkflow: KnowledgeReviewItem['targetWorkflow'];
  targetBoard?: KnowledgeReviewItem['targetBoard'];
  sourceId?: string | null;
  reviewStatus?: string | null;
  repairable?: boolean;
  raw?: unknown;
}): KnowledgeReviewItem {
  return {
    id: params.id,
    kind: params.kind,
    severity: params.severity,
    title: params.title,
    detail: params.detail,
    targetWorkflow: params.targetWorkflow,
    targetBoard: params.targetBoard,
    sourceId: params.sourceId ?? null,
    reviewStatus: params.reviewStatus,
    repairable: params.repairable,
    raw: params.raw,
  };
}

function mapLegacyTargetTab(
  targetTab: WorkspaceReadinessItem['targetTab'],
): Pick<KnowledgeReviewItem, 'targetWorkflow' | 'targetBoard'> {
  switch (targetTab) {
    case 'overview':
      return { targetWorkflow: 'overview', targetBoard: 'diagnosisHealth' };
    case 'teaching-rules':
      return { targetWorkflow: 'teaching', targetBoard: 'teachingRules' };
    case 'editorial-brief':
      return {
        targetWorkflow: 'teaching',
        targetBoard: 'curriculumCoverage',
      };
    case 'education':
      return { targetWorkflow: 'content', targetBoard: 'education' };
    case 'cases':
      return { targetWorkflow: 'cases', targetBoard: 'diagnosticCases' };
    case 'graph':
      return { targetWorkflow: 'reasoning', targetBoard: 'differentials' };
    default:
      return { targetWorkflow: 'reviewQueue' };
  }
}

function isPendingDraftStatus(status: string): boolean {
  return [
    'DRAFT',
    'REVIEW_REQUIRED',
    'PENDING_REVIEW',
    'pending',
    'needs_review',
  ].includes(status);
}

function isBlocker(item: KnowledgeReviewItem): item is KnowledgeBlocker {
  return item.severity === 'blocker';
}

function sortReviewItems(items: KnowledgeReviewItem[]): KnowledgeReviewItem[] {
  const severityRank: Record<KnowledgeSignalSeverity, number> = {
    blocker: 0,
    warning: 1,
    info: 2,
  };

  return [...items].sort(
    (a, b) => severityRank[a.severity] - severityRank[b.severity],
  );
}
