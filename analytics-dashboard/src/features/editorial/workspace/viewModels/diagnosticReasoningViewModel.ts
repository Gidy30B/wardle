import type {
  KnowledgeCaseReasoning,
  KnowledgeDifferential,
  KnowledgeGraphViewModel,
  KnowledgeMimicSeparation,
  KnowledgeReasoningPath,
  KnowledgeReviewItem,
} from './knowledgeGraphViewModel.ts';

export type DiagnosticReasoningTone = 'strong' | 'watch' | 'weak';

export type DiagnosticTeachingClaim = {
  diagnosisId: string;
  diagnosisName: string;
  claim: string;
  supportLevel: DiagnosticReasoningTone;
  supportSummary: string;
  blockerCount: number;
  warningCount: number;
};

export type DiagnosticComparison = {
  id: string;
  targetDiagnosisId: string;
  targetDiagnosisName: string;
  mimicDiagnosisId: string | null;
  mimicName: string;
  verdict: 'target_beats_mimic' | 'not_enough_evidence' | 'unsafe_to_teach';
  confidence: DiagnosticReasoningTone;
  whyTargetWins: string;
  sharedConfusion: string | null;
  discriminators: DiagnosticDiscriminator[];
  supportingEvidenceRelationshipIds: string[];
  supportingTeachingRelationshipIds: string[];
  supportingReasoningPathIds: string[];
  risks: DiagnosticTeachingRisk[];
  source: 'teaching_relationship' | 'linked_differential';
};

export type DiagnosticDiscriminator = {
  id: string;
  comparisonId: string;
  mimicName: string;
  label: string;
  strength: DiagnosticReasoningTone;
  evidenceRelationshipIds: string[];
  teachingRelationshipId: string | null;
  reasoningPathIds: string[];
};

export type DiagnosticClueInterpretation = {
  id: string;
  caseId: string;
  caseTitle: string;
  clueIndex: number;
  clue: string;
  interpretation: string;
  supportsTarget: boolean;
  rulesOutMimics: string[];
  remainingMimics: string[];
  discriminatorSignals: string[];
  risk: DiagnosticReasoningTone;
};

export type DiagnosticReasoningNarrative = {
  id: string;
  title: string;
  reasoningGoal: string;
  summary: string;
  requiredTeachingPoints: string[];
  comparisonIds: string[];
  readiness: DiagnosticReasoningTone;
  blockerReasons: string[];
};

export type DiagnosticCaseReasoningCheck = {
  id: string;
  caseId: string;
  caseTitle: string;
  verdict: 'clean' | 'watch' | 'blocked';
  reasons: string[];
  comparisonIds: string[];
  prematureLockIn: boolean;
  unresolvedMimics: string[];
};

export type DiagnosticTeachingRisk = {
  id: string;
  severity: 'warning' | 'blocker';
  title: string;
  detail: string;
  comparisonId?: string;
  caseId?: string;
  reasoningPathId?: string;
  reviewItemId?: string;
};

export type DiagnosticReasoningBlocker = DiagnosticTeachingRisk & {
  severity: 'blocker';
};

export type DiagnosticReasoningViewModel = {
  diagnosis: {
    id: string;
    name: string;
  };
  coreDiagnosticClaim: DiagnosticTeachingClaim;
  diagnosticComparisons: DiagnosticComparison[];
  discriminatorMap: DiagnosticDiscriminator[];
  clueInterpretation: DiagnosticClueInterpretation[];
  reasoningNarratives: DiagnosticReasoningNarrative[];
  caseReasoningChecks: DiagnosticCaseReasoningCheck[];
  teachingRisks: DiagnosticTeachingRisk[];
  publicationReasoningBlockers: DiagnosticReasoningBlocker[];
};

export function buildDiagnosticReasoningViewModel(
  knowledge: KnowledgeGraphViewModel,
): DiagnosticReasoningViewModel {
  const diagnosticComparisons = buildDiagnosticComparisons(knowledge);
  const discriminatorMap = diagnosticComparisons.flatMap(
    (comparison) => comparison.discriminators,
  );
  const clueInterpretation = knowledge.cases.caseReasoning.flatMap((caseItem) =>
    buildClueInterpretations(caseItem),
  );
  const reasoningNarratives = knowledge.reasoning.paths.map((path) =>
    buildReasoningNarrative(path, diagnosticComparisons),
  );
  const caseReasoningChecks = knowledge.cases.caseReasoning.map((caseItem) =>
    buildCaseReasoningCheck(caseItem, diagnosticComparisons),
  );
  const teachingRisks = [
    ...diagnosticComparisons.flatMap((comparison) => comparison.risks),
    ...buildCaseTeachingRisks(caseReasoningChecks),
    ...buildReasoningPathTeachingRisks(knowledge.reasoning.ungroundedWarnings),
    ...buildReviewItemTeachingRisks(knowledge.reviewItems),
  ];

  return {
    diagnosis: {
      id: knowledge.diagnosis.id,
      name: knowledge.diagnosis.name,
    },
    coreDiagnosticClaim: buildCoreDiagnosticClaim(
      knowledge,
      diagnosticComparisons,
      teachingRisks,
    ),
    diagnosticComparisons,
    discriminatorMap,
    clueInterpretation,
    reasoningNarratives,
    caseReasoningChecks,
    teachingRisks,
    publicationReasoningBlockers: teachingRisks.filter(
      isPublicationReasoningBlocker,
    ),
  };
}

function buildDiagnosticComparisons(
  knowledge: KnowledgeGraphViewModel,
): DiagnosticComparison[] {
  const relationshipComparisons = knowledge.differentials.mimicSeparation.map(
    (relationship) => comparisonFromMimicSeparation(knowledge, relationship),
  );

  const relationshipMimicIds = new Set(
    knowledge.differentials.mimicSeparation.map(
      (relationship) => relationship.targetDiagnosisId,
    ),
  );

  const missingMimicComparisons = knowledge.differentials.linkedMimics
    .filter((mimic) => !relationshipMimicIds.has(mimic.diagnosisRegistryId))
    .map((mimic) => comparisonFromLinkedMimic(knowledge, mimic));

  return [...relationshipComparisons, ...missingMimicComparisons];
}

function comparisonFromMimicSeparation(
  knowledge: KnowledgeGraphViewModel,
  relationship: KnowledgeMimicSeparation,
): DiagnosticComparison {
  const comparisonId = `comparison:${relationship.targetDiagnosisId}`;
  const evidence = knowledge.evidence.relationships.filter(
    (item) =>
      item.targetDiagnosisName === relationship.targetDiagnosisName ||
      item.raw.supportingTeachingRelationshipId === relationship.id ||
      item.supportsDiscrimination,
  );
  const paths = knowledge.reasoning.paths.filter((path) =>
    path.supportingTeachingRelationshipIds.includes(relationship.id),
  );
  const discriminators = buildDiscriminatorsForComparison({
    comparisonId,
    mimicName: relationship.targetDiagnosisName,
    discriminatorSummary: relationship.discriminatorSummary,
    relationshipId: relationship.id,
    relationshipStrength: relationship.strength,
    evidenceRelationshipIds: evidence.map((item) => item.id),
    reasoningPathIds: paths.map((path) => path.id),
  });
  const risks = buildComparisonRisks({
    comparisonId,
    mimicName: relationship.targetDiagnosisName,
    active: relationship.status === 'ACTIVE',
    hasDiscriminator: discriminators.length > 0,
    readinessReasons: relationship.readinessReasons,
  });

  return {
    id: comparisonId,
    targetDiagnosisId: knowledge.diagnosis.id,
    targetDiagnosisName: knowledge.diagnosis.name,
    mimicDiagnosisId: relationship.targetDiagnosisId,
    mimicName: relationship.targetDiagnosisName,
    verdict: comparisonVerdict(relationship.status === 'ACTIVE', risks),
    confidence: comparisonConfidence(relationship.strength, risks),
    whyTargetWins:
      relationship.discriminatorSummary ??
      `Differentiate ${knowledge.diagnosis.name} from ${relationship.targetDiagnosisName} using the active discriminator relationship.`,
    sharedConfusion: relationship.commonConfusionReason,
    discriminators,
    supportingEvidenceRelationshipIds: evidence.map((item) => item.id),
    supportingTeachingRelationshipIds: [relationship.id],
    supportingReasoningPathIds: paths.map((path) => path.id),
    risks,
    source: 'teaching_relationship',
  };
}

function comparisonFromLinkedMimic(
  knowledge: KnowledgeGraphViewModel,
  mimic: KnowledgeDifferential,
): DiagnosticComparison {
  const comparisonId = `comparison:${mimic.diagnosisRegistryId}`;
  const risks: DiagnosticTeachingRisk[] = [
    {
      id: `risk:${comparisonId}:missing-discriminator`,
      severity: 'warning',
      title: `Missing discriminator for ${mimic.displayLabel}`,
      detail: `${mimic.displayLabel} is linked as a mimic but does not yet have an active A-vs-B discriminator.`,
      comparisonId,
    },
  ];

  return {
    id: comparisonId,
    targetDiagnosisId: knowledge.diagnosis.id,
    targetDiagnosisName: knowledge.diagnosis.name,
    mimicDiagnosisId: mimic.diagnosisRegistryId,
    mimicName: mimic.displayLabel,
    verdict: 'not_enough_evidence',
    confidence: 'weak',
    whyTargetWins: `The workspace has not yet explained why ${knowledge.diagnosis.name} beats ${mimic.displayLabel}.`,
    sharedConfusion: mimic.sourceText,
    discriminators: [],
    supportingEvidenceRelationshipIds: [],
    supportingTeachingRelationshipIds: [],
    supportingReasoningPathIds: [],
    risks,
    source: 'linked_differential',
  };
}

function buildDiscriminatorsForComparison(params: {
  comparisonId: string;
  mimicName: string;
  discriminatorSummary: string | null;
  relationshipId: string;
  relationshipStrength: number;
  evidenceRelationshipIds: string[];
  reasoningPathIds: string[];
}): DiagnosticDiscriminator[] {
  const label = params.discriminatorSummary;
  if (!label) return [];

  return [
    {
      id: `discriminator:${params.relationshipId}`,
      comparisonId: params.comparisonId,
      mimicName: params.mimicName,
      label,
      strength: strengthTone(params.relationshipStrength),
      evidenceRelationshipIds: params.evidenceRelationshipIds,
      teachingRelationshipId: params.relationshipId,
      reasoningPathIds: params.reasoningPathIds,
    },
  ];
}

function buildComparisonRisks(params: {
  comparisonId: string;
  mimicName: string;
  active: boolean;
  hasDiscriminator: boolean;
  readinessReasons: string[];
}): DiagnosticTeachingRisk[] {
  const risks: DiagnosticTeachingRisk[] = [];

  if (!params.active) {
    risks.push({
      id: `risk:${params.comparisonId}:inactive`,
      severity: 'warning',
      title: `Inactive comparison for ${params.mimicName}`,
      detail: `${params.mimicName} has a differential relationship that is not active yet.`,
      comparisonId: params.comparisonId,
    });
  }

  if (!params.hasDiscriminator) {
    risks.push({
      id: `risk:${params.comparisonId}:missing-discriminator`,
      severity: 'blocker',
      title: `No discriminator for ${params.mimicName}`,
      detail: `The workspace does not explain why the target diagnosis beats ${params.mimicName}.`,
      comparisonId: params.comparisonId,
    });
  }

  return [
    ...risks,
    ...params.readinessReasons.map((reason, index) => ({
      id: `risk:${params.comparisonId}:readiness:${index}`,
      severity: 'warning' as const,
      title: `Weak comparison support for ${params.mimicName}`,
      detail: reason,
      comparisonId: params.comparisonId,
    })),
  ];
}

function comparisonVerdict(
  active: boolean,
  risks: DiagnosticTeachingRisk[],
): DiagnosticComparison['verdict'] {
  if (risks.some((risk) => risk.severity === 'blocker')) {
    return 'unsafe_to_teach';
  }

  return active ? 'target_beats_mimic' : 'not_enough_evidence';
}

function comparisonConfidence(
  strength: number,
  risks: DiagnosticTeachingRisk[],
): DiagnosticReasoningTone {
  if (risks.some((risk) => risk.severity === 'blocker')) return 'weak';
  return strengthTone(strength);
}

function buildClueInterpretations(
  caseItem: KnowledgeCaseReasoning,
): DiagnosticClueInterpretation[] {
  return caseItem.clueInterpretations.map((clue) => ({
    id: `clue-interpretation:${caseItem.id}:${clue.clueIndex}`,
    caseId: caseItem.id,
    caseTitle: caseItem.title,
    clueIndex: clue.clueIndex,
    clue: clue.clue,
    interpretation: buildClueInterpretationText(clue),
    supportsTarget: clue.leadingDifferentials.includes(caseItem.title)
      ? false
      : clue.progressionQuality !== 'weak',
    rulesOutMimics: clue.collapsedMimics,
    remainingMimics: clue.remainingMimics,
    discriminatorSignals: clue.discriminatorSignals,
    risk:
      clue.learnerConfusionRisk === 'high' || clue.progressionQuality === 'weak'
        ? 'weak'
        : clue.learnerConfusionRisk === 'medium' ||
            clue.progressionQuality === 'watch'
          ? 'watch'
          : 'strong',
  }));
}

function buildClueInterpretationText(
  clue: KnowledgeCaseReasoning['clueInterpretations'][number],
): string {
  const collapsed = clue.collapsedMimics.length
    ? `rules out ${clue.collapsedMimics.join(', ')}`
    : 'does not yet rule out a mimic';
  const remaining = clue.remainingMimics.length
    ? `; remaining mimics: ${clue.remainingMimics.join(', ')}`
    : '';

  return `Clue ${clue.clueIndex + 1} ${collapsed}${remaining}.`;
}

function buildReasoningNarrative(
  path: KnowledgeReasoningPath,
  comparisons: DiagnosticComparison[],
): DiagnosticReasoningNarrative {
  const comparisonIds = comparisons
    .filter((comparison) =>
      comparison.supportingReasoningPathIds.includes(path.id),
    )
    .map((comparison) => comparison.id);

  return {
    id: `reasoning-narrative:${path.id}`,
    title: path.title,
    reasoningGoal: path.reasoningGoal,
    summary:
      path.requiredTeachingPoints[0] ??
      path.readinessReasons[0] ??
      `${path.title} supports ${path.reasoningGoal.toLowerCase()} reasoning.`,
    requiredTeachingPoints: path.requiredTeachingPoints,
    comparisonIds,
    readiness: path.isWeak ? 'weak' : path.isGenerationReady ? 'strong' : 'watch',
    blockerReasons:
      path.readinessTier === 'weak'
        ? [...path.readinessReasons, ...path.qualityWarnings]
        : [],
  };
}

function buildCaseReasoningCheck(
  caseItem: KnowledgeCaseReasoning,
  comparisons: DiagnosticComparison[],
): DiagnosticCaseReasoningCheck {
  const unresolvedMimics = [
    ...caseItem.remainingMimics,
    ...caseItem.mimicEliminations
      .filter(
        (elimination) =>
          elimination.finalStatus === 'persistent' ||
          elimination.finalStatus === 'unresolved' ||
          elimination.remainingConfusionRisk,
      )
      .map((elimination) => elimination.mimicName),
  ];
  const reasons = [
    ...(caseItem.prematureLockIn
      ? ['Case may reveal the target diagnosis too early.']
      : []),
    ...(unresolvedMimics.length
      ? [`Unresolved mimics: ${unique(unresolvedMimics).join(', ')}.`]
      : []),
    ...(caseItem.blockerCount > 0
      ? [`Case has ${caseItem.blockerCount} quality blocker(s).`]
      : []),
  ];

  return {
    id: `case-reasoning:${caseItem.id}`,
    caseId: caseItem.id,
    caseTitle: caseItem.title,
    verdict:
      caseItem.prematureLockIn || caseItem.blockerCount > 0
        ? 'blocked'
        : reasons.length > 0 || caseItem.warningCount > 0
          ? 'watch'
          : 'clean',
    reasons,
    comparisonIds: comparisons
      .filter((comparison) => unresolvedMimics.includes(comparison.mimicName))
      .map((comparison) => comparison.id),
    prematureLockIn: caseItem.prematureLockIn,
    unresolvedMimics: unique(unresolvedMimics),
  };
}

function buildCaseTeachingRisks(
  checks: DiagnosticCaseReasoningCheck[],
): DiagnosticTeachingRisk[] {
  return checks
    .filter((check) => check.verdict !== 'clean')
    .map((check) => ({
      id: `risk:${check.id}`,
      severity: check.verdict === 'blocked' ? 'blocker' : 'warning',
      title: `Case reasoning issue: ${check.caseTitle}`,
      detail: check.reasons[0] ?? 'Case reasoning needs review.',
      caseId: check.caseId,
      comparisonId: check.comparisonIds[0],
    }));
}

function buildReasoningPathTeachingRisks(
  warnings: KnowledgeGraphViewModel['reasoning']['ungroundedWarnings'],
): DiagnosticTeachingRisk[] {
  return warnings.map((warning) => ({
    id: `risk:${warning.id}`,
    severity: warning.severity === 'blocker' ? 'blocker' : 'warning',
    title: warning.title,
    detail: warning.reason,
    reasoningPathId: warning.reasoningPathId,
  }));
}

function buildReviewItemTeachingRisks(
  reviewItems: KnowledgeReviewItem[],
): DiagnosticTeachingRisk[] {
  return reviewItems
    .filter(
      (item) =>
        item.targetWorkflow === 'reasoning' &&
        (item.severity === 'blocker' || item.kind === 'unsupported_claim'),
    )
    .map((item) => ({
      id: `risk:review-item:${item.id}`,
      severity: item.severity === 'blocker' ? 'blocker' : 'warning',
      title: item.title,
      detail: item.detail,
      reviewItemId: item.id,
    }));
}

function buildCoreDiagnosticClaim(
  knowledge: KnowledgeGraphViewModel,
  comparisons: DiagnosticComparison[],
  risks: DiagnosticTeachingRisk[],
): DiagnosticTeachingClaim {
  const blockerCount = risks.filter((risk) => risk.severity === 'blocker').length;
  const warningCount = risks.filter((risk) => risk.severity === 'warning').length;
  const strongComparisons = comparisons.filter(
    (comparison) => comparison.verdict === 'target_beats_mimic',
  ).length;

  return {
    diagnosisId: knowledge.diagnosis.id,
    diagnosisName: knowledge.diagnosis.name,
    claim:
      comparisons[0]?.whyTargetWins ??
      `${knowledge.diagnosis.name} needs explicit diagnostic comparisons before it can teach why it is the best answer.`,
    supportLevel:
      blockerCount > 0 ? 'weak' : warningCount > 0 ? 'watch' : 'strong',
    supportSummary: `${strongComparisons} of ${comparisons.length} diagnostic comparison(s) explain why ${knowledge.diagnosis.name} wins.`,
    blockerCount,
    warningCount,
  };
}

function isPublicationReasoningBlocker(
  risk: DiagnosticTeachingRisk,
): risk is DiagnosticReasoningBlocker {
  return risk.severity === 'blocker';
}

function strengthTone(value: number): DiagnosticReasoningTone {
  if (value >= 0.75) return 'strong';
  if (value >= 0.45) return 'watch';
  return 'weak';
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
