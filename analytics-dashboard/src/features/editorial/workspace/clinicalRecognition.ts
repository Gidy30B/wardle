import type {
  CaseDifferentialElimination,
  CaseClueProgressionState,
  CaseEscalationCoverageRow,
  DiagnosisEditorialWorkspace,
  DiagnosisTeachingRelationship,
} from '../../../api/admin';
import {
  buildMimicSurvivalSummary,
  matchesMimicTarget,
  mimicSurvivalState,
  type MimicSurvivalState,
  type MimicSurvivalSummary,
} from './mimicSurvival.ts';

export type RecognitionAnchor = {
  displayLabel: string;
  canonicalName: string;
  aliases: string[];
  specialty: string | null;
  bodySystem: string | null;
  difficultyBand: string | null;
  learnerRiskTier: string | null;
  learnerRiskScore: number | null;
  escalationType: string | null;
  coversEscalation: boolean;
  hasUsableCase: boolean;
};

export function buildRecognitionAnchor(
  workspace: DiagnosisEditorialWorkspace,
): RecognitionAnchor {
  const { diagnosis } = workspace;
  const learnerRisk = workspace.editorialPrioritization?.learnerRisk ?? null;
  const escalation = workspace.escalationCoverage ?? null;

  return {
    displayLabel: diagnosis.displayLabel,
    canonicalName: diagnosis.canonicalName,
    aliases: diagnosis.aliases,
    specialty: diagnosis.specialty,
    bodySystem: diagnosis.bodySystem,
    difficultyBand: diagnosis.difficultyBand,
    learnerRiskTier: learnerRisk?.tier ?? null,
    learnerRiskScore: learnerRisk?.score ?? null,
    escalationType: escalation?.escalationType ?? null,
    coversEscalation: escalation?.coversEscalation ?? false,
    hasUsableCase: workspace.cases.summary.usable > 0,
  };
}

export type ExemplarProgression = {
  caseId: string;
  caseTitle: string;
  states: CaseClueProgressionState[];
  confidenceEstimate: number | null;
  ambiguityScore: number;
  prematureLeakFlag: boolean;
  unresolvedAmbiguityFlag: boolean;
  totalAnalyzedCases: number;
  abruptGiveawayCases: number;
};

export function buildExemplarProgression(
  workspace: DiagnosisEditorialWorkspace,
): ExemplarProgression | null {
  const analyzed = workspace.cases.items.filter(
    (item) => (item.clueProgression?.diagnosticStates.length ?? 0) > 0,
  );
  if (!analyzed.length) {
    return null;
  }

  const exemplar = analyzed.reduce((best, item) =>
    (item.clueProgression?.diagnosticStates.length ?? 0) >
    (best.clueProgression?.diagnosticStates.length ?? 0)
      ? item
      : best,
  );
  const progression = exemplar.clueProgression!;

  return {
    caseId: exemplar.id,
    caseTitle: exemplar.title,
    states: progression.diagnosticStates,
    confidenceEstimate: progression.confidenceEstimate,
    ambiguityScore: progression.ambiguityScore,
    prematureLeakFlag: progression.prematureLeakFlag,
    unresolvedAmbiguityFlag: progression.unresolvedAmbiguityFlag,
    totalAnalyzedCases: analyzed.length,
    abruptGiveawayCases:
      workspace.cases.summary.progressionSignals?.abruptGiveawayCases ?? 0,
  };
}

export type ConfusionCandidate = {
  id: string;
  label: string;
  targetDiagnosisId: string | null;
  relationshipType: DiagnosisTeachingRelationship['relationshipType'];
  confusionReason: string | null;
  learnerPitfall: string | null;
  discriminatorSummary: string | null;
  survival: MimicSurvivalSummary;
  survivalState: MimicSurvivalState;
  topElimination: CaseDifferentialElimination | null;
};

const survivalStateRank: Record<MimicSurvivalState, number> = {
  unresolved: 0,
  weak_elimination: 1,
  case_needed: 2,
  separated: 3,
};

export function buildConfusionCandidates(
  workspace: DiagnosisEditorialWorkspace,
  limit = 4,
): ConfusionCandidate[] {
  const relationships = workspace.graph.teachingRelationships.filter(
    (relationship) =>
      relationship.status === 'ACTIVE' &&
      (relationship.relationshipType === 'MIMIC_CONFUSION' ||
        relationship.relationshipType === 'SHARED_PRESENTATION'),
  );
  const caseNeeded = workspace.cases.summary.usable === 0;
  const eliminations = workspace.cases.items.flatMap(
    (caseItem) => caseItem.clueProgression?.differentialElimination ?? [],
  );

  const candidates = relationships.map((relationship) => {
    const label = relationship.targetDiagnosisRegistry.displayLabel;
    const targetId = relationship.targetDiagnosisRegistryId;
    const survival = buildMimicSurvivalSummary(workspace, label, targetId);
    const survivalState = mimicSurvivalState(survival, caseNeeded);
    const matching = eliminations.filter((item) =>
      matchesMimicTarget(item, label, targetId),
    );
    const topElimination =
      matching.find((item) => item.discriminatorUsed) ?? matching[0] ?? null;

    return {
      id: relationship.id,
      label,
      targetDiagnosisId: targetId,
      relationshipType: relationship.relationshipType,
      confusionReason: relationship.commonConfusionReason,
      learnerPitfall: relationship.learnerPitfall,
      discriminatorSummary: relationship.discriminatorSummary,
      survival,
      survivalState,
      topElimination,
    };
  });

  return candidates
    .sort(
      (left, right) =>
        survivalStateRank[left.survivalState] -
        survivalStateRank[right.survivalState],
    )
    .slice(0, limit);
}

export type DiscriminatorTeachingItem = {
  id: string;
  label: string;
  mimicLabel: string;
  strength: 'weak' | 'moderate' | 'strong' | string;
  source: 'relationship' | 'case_elimination';
  annotationSource: 'editorial' | 'heuristic' | string | null;
  educationalValue: 'low' | 'medium' | 'high' | string | null;
  evidence: string | null;
};

export type DiscriminatorTeachingSummary = {
  items: DiscriminatorTeachingItem[];
  explicitCount: number;
  heuristicOnlyCount: number;
  missingAnnotationCount: number;
};

function relationshipStrengthLabel(strength: number): 'weak' | 'moderate' | 'strong' {
  if (strength >= 0.7) return 'strong';
  if (strength >= 0.4) return 'moderate';
  return 'weak';
}

const discriminatorStrengthRank: Record<string, number> = {
  strong: 2,
  moderate: 1,
  weak: 0,
};

export function buildDiscriminatorTeachingSummary(
  workspace: DiagnosisEditorialWorkspace,
): DiscriminatorTeachingSummary {
  const items: DiscriminatorTeachingItem[] = [];

  for (const relationship of workspace.graph.teachingRelationships) {
    if (relationship.status !== 'ACTIVE' || !relationship.discriminatorSummary) {
      continue;
    }
    items.push({
      id: `relationship-${relationship.id}`,
      label: relationship.discriminatorSummary,
      mimicLabel: relationship.targetDiagnosisRegistry.displayLabel,
      strength: relationshipStrengthLabel(relationship.strength),
      source: 'relationship',
      annotationSource: 'editorial',
      educationalValue: null,
      evidence: relationship.supportingGraphFact?.label ?? null,
    });
  }

  for (const caseItem of workspace.cases.items) {
    for (const elimination of caseItem.clueProgression?.differentialElimination ?? []) {
      if (!elimination.discriminatorUsed) {
        continue;
      }
      items.push({
        id: `case-${caseItem.id}-${elimination.mimicName}-${elimination.discriminatorUsed}`,
        label: elimination.discriminatorUsed,
        mimicLabel: elimination.mimicName,
        strength: elimination.eliminationStrength,
        source: 'case_elimination',
        annotationSource: elimination.annotationSource ?? null,
        educationalValue: elimination.educationalValue,
        evidence: elimination.notes ?? null,
      });
    }
  }

  items.sort(
    (left, right) =>
      (discriminatorStrengthRank[right.strength] ?? -1) -
      (discriminatorStrengthRank[left.strength] ?? -1),
  );

  const explicitCount = items.filter(
    (item) => item.annotationSource === 'editorial',
  ).length;
  const heuristicOnlyCount = items.filter(
    (item) => item.source === 'case_elimination' && item.annotationSource !== 'editorial',
  ).length;
  const missingAnnotationCount =
    workspace.cases.summary.progressionSignals?.missingEditorialAnnotationCount ?? 0;

  return { items, explicitCount, heuristicOnlyCount, missingAnnotationCount };
}

export type EscalationNarrative = {
  coversEscalation: boolean;
  escalationType: string | null;
  missingEscalationTeaching: boolean;
  weakEscalationEvidence: boolean;
  noPlayableEscalationCase: boolean;
  caseRows: CaseEscalationCoverageRow[];
  escalationRelationships: DiagnosisTeachingRelationship[];
  escalationScore: number | null;
};

export function buildEscalationNarrative(
  workspace: DiagnosisEditorialWorkspace,
): EscalationNarrative {
  const coverage = workspace.escalationCoverage ?? null;
  const escalationRelationships = workspace.graph.teachingRelationships.filter(
    (relationship) =>
      relationship.status === 'ACTIVE' &&
      relationship.relationshipType === 'ESCALATION_CONTRAST',
  );

  return {
    coversEscalation: coverage?.coversEscalation ?? false,
    escalationType: coverage?.escalationType ?? null,
    missingEscalationTeaching: coverage?.missingEscalationTeaching ?? true,
    weakEscalationEvidence: coverage?.weakEscalationEvidence ?? false,
    noPlayableEscalationCase: coverage?.noPlayableEscalationCase ?? true,
    caseRows: workspace.caseEscalationCoverage ?? [],
    escalationRelationships,
    escalationScore: workspace.maturityBreakdown?.escalationCoverage ?? null,
  };
}

export type RecognitionGovernanceSummary = {
  unsupportedClaimCount: number;
  blockingClaimCount: number;
  acceptedRepairCount: number;
  pendingDiscriminatorDraftCount: number;
  weakSectionCount: number;
  weakestSectionLabel: string | null;
};

export function buildRecognitionGovernanceSummary(
  workspace: DiagnosisEditorialWorkspace,
): RecognitionGovernanceSummary {
  const claims = workspace.unsupportedClaimsBySection ?? [];
  const weakSections = workspace.education.sectionHealth.filter(
    (section) =>
      section.regenerationRecommended ||
      section.blockers.length > 0 ||
      section.warnings.length > 0,
  );
  const pendingDrafts = (workspace.discriminatorDraftReviews ?? []).filter(
    (draft) =>
      draft.reviewStatus === 'PENDING_REVIEW' ||
      draft.reviewStatus === 'REVIEW_REQUIRED' ||
      draft.reviewStatus === 'NEEDS_CHANGES',
  );
  const weakest = [...weakSections].sort(
    (left, right) => (left.score ?? 0) - (right.score ?? 0),
  )[0];

  return {
    unsupportedClaimCount: claims.length,
    blockingClaimCount: claims.filter((claim) => claim.blocksPublication).length,
    acceptedRepairCount: (workspace.education.acceptedRepairs ?? []).length,
    pendingDiscriminatorDraftCount: pendingDrafts.length,
    weakSectionCount: weakSections.length,
    weakestSectionLabel: weakest ? weakest.section : null,
  };
}
