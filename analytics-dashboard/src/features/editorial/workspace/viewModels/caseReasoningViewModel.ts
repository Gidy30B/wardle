import type {
  CaseClueDiscriminatorAnnotation,
  CaseClueRevisionDraft,
  CaseLearningGoalCoverageRow,
  DiagnosisEditorialWorkspace,
  LearningGoalCoverageRow,
  WorkspaceCaseRevisionGovernance,
} from '../../../../api/admin.types.ts';
import type {
  DiagnosticComparison,
  DiagnosticDiscriminator,
  DiagnosticReasoningViewModel,
  DiagnosticTeachingRisk,
} from './diagnosticReasoningViewModel.ts';
import type {
  KnowledgeCaseReasoning,
  KnowledgeGraphViewModel,
  KnowledgeReviewItem,
} from './knowledgeGraphViewModel.ts';

export type CaseReasoningTone =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral';

export type CaseReasoningSeverity = 'blocker' | 'warning' | 'info';

export type CaseTeachingRiskViewModel = {
  id: string;
  severity: CaseReasoningSeverity;
  title: string;
  detail: string;
  caseId: string | null;
  comparisonId: string | null;
  targetBoard:
    | 'diagnosticCases'
    | 'clueProgression'
    | 'reasoningCoverage'
    | 'discriminatorCoverage';
};

export type CaseReasoningCardViewModel = {
  id: string;
  title: string;
  status: string;
  difficulty: string;
  quality: 'clean' | 'watch' | 'blocked';
  tone: CaseReasoningTone;
  reasoningObjective: string;
  linkedLearningGoals: string[];
  linkedDiscriminators: string[];
  linkedComparisonIds: string[];
  revisionGovernance?: WorkspaceCaseRevisionGovernance | null;
  reasoningConfidence: 'strong' | 'watch' | 'weak';
  teachingRisks: CaseTeachingRiskViewModel[];
  blockerCount: number;
  warningCount: number;
};

export type ClueProgressionStepViewModel = {
  id: string;
  clueIndex: number;
  clue: string;
  interpretation: string;
  risk: 'strong' | 'watch' | 'weak';
  rulesOutMimics: string[];
  remainingMimics: string[];
  discriminatorSignals: string[];
  editorialConcern: string | null;
};

export type ClueProgressionCaseViewModel = {
  id: string;
  caseId: string;
  caseTitle: string;
  quality: string;
  tone: CaseReasoningTone;
  leakRisk: boolean;
  unresolvedMimics: string[];
  discriminatorTiming: string;
  reviewStatus: string;
  draftCount: number;
  annotationCount: number;
  steps: ClueProgressionStepViewModel[];
};

export type ReasoningCoverageRowViewModel = {
  id: string;
  comparisonId: string;
  label: string;
  evidenceCovered: boolean;
  educationCovered: boolean;
  casesCovered: boolean;
  caseTitles: string[];
  tone: CaseReasoningTone;
  gapReason: string | null;
};

export type DiscriminatorCoverageRowViewModel = {
  id: string;
  discriminatorId: string;
  label: string;
  mimicName: string;
  evidenceCovered: boolean;
  educationCovered: boolean;
  casesCovered: boolean;
  caseTitles: string[];
  unsupportedClaimCount: number;
  tone: CaseReasoningTone;
  gapReason: string | null;
};

export type CaseReasoningViewModel = {
  cases: CaseReasoningCardViewModel[];
  clueProgression: ClueProgressionCaseViewModel[];
  reasoningCoverage: ReasoningCoverageRowViewModel[];
  discriminatorCoverage: DiscriminatorCoverageRowViewModel[];
  teachingRisks: CaseTeachingRiskViewModel[];
  blockers: CaseTeachingRiskViewModel[];
  reviewItems: KnowledgeReviewItem[];
};

export function buildCaseReasoningViewModel(params: {
  workspace: DiagnosisEditorialWorkspace;
  knowledge: KnowledgeGraphViewModel;
  diagnosticReasoning: DiagnosticReasoningViewModel;
}): CaseReasoningViewModel {
  const { workspace, knowledge, diagnosticReasoning } = params;
  const teachingRisks = buildCaseTeachingRisks({
    workspace,
    knowledge,
    diagnosticReasoning,
  });
  const reasoningCoverage = buildReasoningCoverage({
    workspace,
    knowledge,
    diagnosticReasoning,
  });
  const discriminatorCoverage = buildDiscriminatorCoverage({
    workspace,
    knowledge,
    diagnosticReasoning,
  });
  const cases = buildDiagnosticCases({
    workspace,
    knowledge,
    diagnosticReasoning,
    teachingRisks,
  });
  const clueProgression = buildClueProgression({
    workspace,
    knowledge,
    diagnosticReasoning,
  });

  return {
    cases,
    clueProgression,
    reasoningCoverage,
    discriminatorCoverage,
    teachingRisks,
    blockers: teachingRisks.filter((risk) => risk.severity === 'blocker'),
    reviewItems: buildCaseReviewItems({
      teachingRisks,
      reasoningCoverage,
      discriminatorCoverage,
    }),
  };
}

function buildDiagnosticCases(params: {
  workspace: DiagnosisEditorialWorkspace;
  knowledge: KnowledgeGraphViewModel;
  diagnosticReasoning: DiagnosticReasoningViewModel;
  teachingRisks: CaseTeachingRiskViewModel[];
}): CaseReasoningCardViewModel[] {
  const { workspace, knowledge, diagnosticReasoning, teachingRisks } = params;

  return knowledge.cases.caseReasoning.map((caseItem) => {
    const check = diagnosticReasoning.caseReasoningChecks.find(
      (item) => item.caseId === caseItem.id,
    );
    const learningGoals = learningGoalRowsForCase(
      workspace.caseLearningGoalCoverage ?? [],
      caseItem.id,
    );
    const linkedDiscriminators = discriminatorsForCase(
      caseItem,
      diagnosticReasoning.discriminatorMap,
    );
    const caseRisks = teachingRisks.filter((risk) => risk.caseId === caseItem.id);
    const linkedComparisonIds = check?.comparisonIds ?? [];

    return {
      id: caseItem.id,
      title: caseItem.title,
      status: caseItem.editorialStatus ?? 'unknown',
      difficulty: caseItem.difficulty,
      quality: check?.verdict ?? qualityFromCase(caseItem),
      tone: toneFromCaseVerdict(check?.verdict ?? qualityFromCase(caseItem)),
      reasoningObjective:
        learningGoals[0]?.learningGoal ??
        comparisonObjective(linkedComparisonIds, diagnosticReasoning) ??
        'No explicit reasoning objective is linked yet.',
      linkedLearningGoals: learningGoals.map((goal) => goal.learningGoal),
      linkedDiscriminators,
      linkedComparisonIds,
      revisionGovernance: caseItem.raw.revisionGovernance ?? null,
      reasoningConfidence: confidenceFromCaseVerdict(
        check?.verdict ?? qualityFromCase(caseItem),
      ),
      teachingRisks: caseRisks,
      blockerCount: caseItem.blockerCount + caseRisks.filter((risk) => risk.severity === 'blocker').length,
      warningCount: caseItem.warningCount + caseRisks.filter((risk) => risk.severity === 'warning').length,
    };
  });
}

function buildClueProgression(params: {
  workspace: DiagnosisEditorialWorkspace;
  knowledge: KnowledgeGraphViewModel;
  diagnosticReasoning: DiagnosticReasoningViewModel;
}): ClueProgressionCaseViewModel[] {
  const { workspace, knowledge, diagnosticReasoning } = params;

  return knowledge.cases.caseReasoning.map((caseItem) => {
    const check = diagnosticReasoning.caseReasoningChecks.find(
      (item) => item.caseId === caseItem.id,
    );
    const drafts = revisionDraftsForCase(workspace, caseItem.id);
    const steps = diagnosticReasoning.clueInterpretation
      .filter((clue) => clue.caseId === caseItem.id)
      .map((clue) => ({
        id: clue.id,
        clueIndex: clue.clueIndex,
        clue: clue.clue,
        interpretation: clue.interpretation,
        risk: clue.risk,
        rulesOutMimics: clue.rulesOutMimics,
        remainingMimics: clue.remainingMimics,
        discriminatorSignals: clue.discriminatorSignals,
        editorialConcern:
          caseItem.clueInterpretations.find(
            (item) => item.clueIndex === clue.clueIndex,
          )?.editorialConcern ?? null,
      }));

    return {
      id: `clue-progression:${caseItem.id}`,
      caseId: caseItem.id,
      caseTitle: caseItem.title,
      quality: check?.verdict ?? qualityFromCase(caseItem),
      tone: toneFromCaseVerdict(check?.verdict ?? qualityFromCase(caseItem)),
      leakRisk: caseItem.prematureLockIn,
      unresolvedMimics: check?.unresolvedMimics ?? caseItem.remainingMimics,
      discriminatorTiming: discriminatorTimingForCase(caseItem),
      reviewStatus: drafts.some((draft) => isPendingDraftStatus(draft.status))
        ? 'drafts_pending'
        : caseItem.discriminatorAnnotations.length > 0
          ? 'annotated'
          : 'unreviewed',
      draftCount: drafts.length,
      annotationCount: caseItem.discriminatorAnnotations.length,
      steps,
    };
  });
}

function buildReasoningCoverage(params: {
  workspace: DiagnosisEditorialWorkspace;
  knowledge: KnowledgeGraphViewModel;
  diagnosticReasoning: DiagnosticReasoningViewModel;
}): ReasoningCoverageRowViewModel[] {
  const { workspace, knowledge, diagnosticReasoning } = params;

  return diagnosticReasoning.diagnosticComparisons.map((comparison) => {
    const caseTitles = caseTitlesForComparison(knowledge, comparison);
    const evidenceCovered = comparison.supportingEvidenceRelationshipIds.length > 0;
    const educationCovered = workspace.education.status !== 'missing';
    const casesCovered = caseTitles.length > 0;
    const isSelfComparison = comparison.targetDiagnosisName === comparison.mimicName;

    return {
      id: `reasoning-coverage:${comparison.id}`,
      comparisonId: comparison.id,
      label: isSelfComparison
        ? `${comparison.targetDiagnosisName} (self-comparison)`
        : `${comparison.targetDiagnosisName} vs ${comparison.mimicName}`,
      evidenceCovered,
      educationCovered,
      casesCovered,
      caseTitles,
      tone: !casesCovered ? 'danger' : comparison.confidence === 'weak' ? 'warning' : 'success',
      gapReason: !casesCovered
        ? isSelfComparison
          ? 'Coverage mapping appears self-referential. Review this diagnostic comparison.'
          : `Missing case coverage — no case demonstrates why ${comparison.targetDiagnosisName} beats ${comparison.mimicName}.`
        : comparison.confidence === 'weak'
          ? 'Comparison exists but diagnostic confidence is weak.'
          : null,
    };
  });
}

function buildDiscriminatorCoverage(params: {
  workspace: DiagnosisEditorialWorkspace;
  knowledge: KnowledgeGraphViewModel;
  diagnosticReasoning: DiagnosticReasoningViewModel;
}): DiscriminatorCoverageRowViewModel[] {
  const { workspace, knowledge, diagnosticReasoning } = params;

  return diagnosticReasoning.discriminatorMap.map((discriminator) => {
    const caseTitles = caseTitlesForDiscriminator(knowledge, discriminator);
    const unsupportedClaimCount = knowledge.evidence.unsupportedClaims.filter(
      (claim) =>
        textIncludes(claim.claimText, discriminator.label) ||
        textIncludes(claim.claimText, discriminator.mimicName),
    ).length;
    const evidenceCovered = discriminator.evidenceRelationshipIds.length > 0;
    const educationCovered = workspace.education.status !== 'missing' && unsupportedClaimCount === 0;
    const casesCovered = caseTitles.length > 0;

    return {
      id: `discriminator-coverage:${discriminator.id}`,
      discriminatorId: discriminator.id,
      label: discriminator.label,
      mimicName: discriminator.mimicName,
      evidenceCovered,
      educationCovered,
      casesCovered,
      caseTitles,
      unsupportedClaimCount,
      tone: !casesCovered
        ? 'danger'
        : unsupportedClaimCount > 0 || !evidenceCovered
          ? 'warning'
          : 'success',
      gapReason: !casesCovered
        ? `No case clue currently teaches this discriminator against ${discriminator.mimicName}.`
        : unsupportedClaimCount > 0
          ? 'A related education claim still needs evidence support.'
          : !evidenceCovered
            ? 'Discriminator has no supporting evidence relationship.'
            : null,
    };
  });
}

function buildCaseTeachingRisks(params: {
  workspace: DiagnosisEditorialWorkspace;
  knowledge: KnowledgeGraphViewModel;
  diagnosticReasoning: DiagnosticReasoningViewModel;
}): CaseTeachingRiskViewModel[] {
  const { workspace, knowledge, diagnosticReasoning } = params;
  const risks: CaseTeachingRiskViewModel[] = [
    ...diagnosticReasoning.teachingRisks
      .filter((risk) => risk.caseId)
      .map(mapDiagnosticCaseRisk),
    ...knowledge.cases.caseReasoning.flatMap(mapKnowledgeCaseRisks),
    ...learningGoalGaps(workspace.learningGoalCoverage ?? []),
    ...caseLearningGoalGaps(workspace.caseLearningGoalCoverage ?? []),
  ];

  return dedupeRisks(risks);
}

function mapDiagnosticCaseRisk(
  risk: DiagnosticTeachingRisk,
): CaseTeachingRiskViewModel {
  return {
    id: `diagnostic:${risk.id}`,
    severity: risk.severity,
    title: risk.title,
    detail: risk.detail,
    caseId: risk.caseId ?? null,
    comparisonId: risk.comparisonId ?? null,
    targetBoard: risk.detail.toLowerCase().includes('early')
      ? 'clueProgression'
      : 'diagnosticCases',
  };
}

function mapKnowledgeCaseRisks(
  caseItem: KnowledgeCaseReasoning,
): CaseTeachingRiskViewModel[] {
  const risks: CaseTeachingRiskViewModel[] = [];

  if (caseItem.prematureLockIn) {
    risks.push({
      id: `case:${caseItem.id}:premature-lock-in`,
      severity: 'blocker',
      title: 'Case leaks diagnosis too early',
      detail: `${caseItem.title} may reveal the target diagnosis before discriminators are taught.`,
      caseId: caseItem.id,
      comparisonId: null,
      targetBoard: 'clueProgression',
    });
  }

  if (caseItem.unresolvedAmbiguity || caseItem.remainingMimics.length > 0) {
    risks.push({
      id: `case:${caseItem.id}:unresolved-mimics`,
      severity: 'warning',
      title: 'Case leaves mimics unresolved',
      detail: `${caseItem.title} leaves ${caseItem.remainingMimics.length} mimic(s) unresolved.`,
      caseId: caseItem.id,
      comparisonId: null,
      targetBoard: 'diagnosticCases',
    });
  }

  caseItem.clueInterpretations
    .filter((clue) => clue.progressionQuality === 'weak')
    .forEach((clue) => {
      risks.push({
        id: `case:${caseItem.id}:weak-progression:${clue.clueIndex}`,
        severity: 'warning',
        title: 'Weak clue progression',
        detail:
          clue.editorialConcern ??
          `Clue ${clue.clueIndex + 1} has weak diagnostic progression.`,
        caseId: caseItem.id,
        comparisonId: null,
        targetBoard: 'clueProgression',
      });
    });

  return risks;
}

function learningGoalGaps(
  rows: LearningGoalCoverageRow[],
): CaseTeachingRiskViewModel[] {
  return rows
    .filter((row) => row.coveragePct < 1 || row.coveredByCaseIds.length === 0)
    .map((row) => ({
      id: `learning-goal:${row.learningGoalId}:case-gap`,
      severity: row.generationPriority === 'high' ? 'blocker' : 'warning',
      title: 'Learning goal lacks case coverage',
      detail: `${row.learningGoal} has ${row.coveredByCaseIds.length} supporting case(s).`,
      caseId: null,
      comparisonId: null,
      targetBoard: 'reasoningCoverage',
    }));
}

function caseLearningGoalGaps(
  rows: CaseLearningGoalCoverageRow[],
): CaseTeachingRiskViewModel[] {
  return rows
    .filter(
      (row) =>
        row.coverageStrength < 0.5 ||
        row.missingDiscriminators.length > 0 ||
        row.missingMimics.length > 0,
    )
    .map((row) => ({
      id: `case-learning-goal:${row.caseId}:${row.learningGoalId}`,
      severity: row.coverageStrength < 0.35 ? 'blocker' : 'warning',
      title: 'Case reasoning coverage is weak',
      detail: `${row.caseTitle} weakly covers ${row.learningGoal}.`,
      caseId: row.caseId,
      comparisonId: null,
      targetBoard: 'reasoningCoverage',
    }));
}

function buildCaseReviewItems(params: {
  teachingRisks: CaseTeachingRiskViewModel[];
  reasoningCoverage: ReasoningCoverageRowViewModel[];
  discriminatorCoverage: DiscriminatorCoverageRowViewModel[];
}): KnowledgeReviewItem[] {
  const riskItems = params.teachingRisks.map((risk) =>
    reviewItem({
      id: `case-risk:${risk.id}`,
      severity: risk.severity,
      title: risk.title,
      detail: risk.detail,
      targetBoard: risk.targetBoard,
      sourceId: risk.caseId ?? risk.comparisonId,
    }),
  );
  const reasoningItems = params.reasoningCoverage
    .filter((row) => !row.casesCovered)
    .map((row) =>
      reviewItem({
        id: `case-reasoning-coverage:${row.comparisonId}`,
        severity: 'warning',
        title: 'Reasoning path lacks case support',
        detail: row.gapReason ?? `${row.label} needs case support.`,
        targetBoard: 'reasoningCoverage',
        sourceId: row.comparisonId,
      }),
    );
  const discriminatorItems = params.discriminatorCoverage
    .filter((row) => !row.casesCovered)
    .map((row) =>
      reviewItem({
        id: `case-discriminator-coverage:${row.discriminatorId}`,
        severity: 'warning',
        title: 'Missing case for discriminator',
        detail: row.gapReason ?? `${row.label} needs case support.`,
        targetBoard: 'discriminatorCoverage',
        sourceId: row.discriminatorId,
      }),
    );

  return [...riskItems, ...reasoningItems, ...discriminatorItems];
}

function reviewItem(params: {
  id: string;
  severity: CaseReasoningSeverity;
  title: string;
  detail: string;
  targetBoard: KnowledgeReviewItem['targetBoard'];
  sourceId?: string | null;
}): KnowledgeReviewItem {
  return {
    id: params.id,
    kind: 'case_quality',
    severity: params.severity,
    title: params.title,
    detail: params.detail,
    targetWorkflow: 'cases',
    targetBoard: params.targetBoard,
    sourceId: params.sourceId ?? null,
  };
}

function learningGoalRowsForCase(
  rows: CaseLearningGoalCoverageRow[],
  caseId: string,
): CaseLearningGoalCoverageRow[] {
  return rows.filter((row) => row.caseId === caseId);
}

function revisionDraftsForCase(
  workspace: DiagnosisEditorialWorkspace,
  caseId: string,
): CaseClueRevisionDraft[] {
  const materialized = workspace.materializedClueRevisionDrafts ?? [];
  const nested =
    workspace.cases.items.find((item) => item.id === caseId)?.clueRevisionDrafts ??
    [];

  return [...materialized, ...nested].filter((draft) => draft.caseId === caseId);
}

function discriminatorsForCase(
  caseItem: KnowledgeCaseReasoning,
  discriminators: DiagnosticDiscriminator[],
): string[] {
  const annotationDiscriminators = caseItem.discriminatorAnnotations.map(
    (annotation) => annotation.discriminator,
  );
  const eliminationDiscriminators = caseItem.mimicEliminations
    .map((elimination) => elimination.discriminatorUsed)
    .filter((value): value is string => Boolean(value));
  const signalDiscriminators = caseItem.discriminatorSignals;
  const reasoningDiscriminators = discriminators
    .filter((discriminator) =>
      caseItem.mimicEliminations.some(
        (elimination) => elimination.mimicName === discriminator.mimicName,
      ),
    )
    .map((discriminator) => discriminator.label);

  return unique([
    ...annotationDiscriminators,
    ...eliminationDiscriminators,
    ...signalDiscriminators,
    ...reasoningDiscriminators,
  ]);
}

function caseTitlesForComparison(
  knowledge: KnowledgeGraphViewModel,
  comparison: DiagnosticComparison,
): string[] {
  return knowledge.cases.caseReasoning
    .filter((caseItem) =>
      caseItem.mimicEliminations.some(
        (elimination) =>
          elimination.mimicName === comparison.mimicName &&
          elimination.finalStatus === 'eliminated' &&
          !elimination.prematureCollapseRisk,
      ),
    )
    .map((caseItem) => caseItem.title);
}

function caseTitlesForDiscriminator(
  knowledge: KnowledgeGraphViewModel,
  discriminator: DiagnosticDiscriminator,
): string[] {
  return knowledge.cases.caseReasoning
    .filter((caseItem) => caseHasDiscriminator(caseItem, discriminator))
    .map((caseItem) => caseItem.title);
}

function caseHasDiscriminator(
  caseItem: KnowledgeCaseReasoning,
  discriminator: DiagnosticDiscriminator,
): boolean {
  return (
    caseItem.discriminatorAnnotations.some((annotation) =>
      annotationMatchesDiscriminator(annotation, discriminator),
    ) ||
    caseItem.mimicEliminations.some(
      (elimination) =>
        elimination.mimicName === discriminator.mimicName &&
        textIncludes(elimination.discriminatorUsed, discriminator.label),
    ) ||
    caseItem.discriminatorSignals.some((signal) =>
      textIncludes(signal, discriminator.label),
    )
  );
}

function annotationMatchesDiscriminator(
  annotation: CaseClueDiscriminatorAnnotation,
  discriminator: DiagnosticDiscriminator,
): boolean {
  return (
    annotation.eliminatedDiagnosisName === discriminator.mimicName ||
    textIncludes(annotation.discriminator, discriminator.label) ||
    textIncludes(discriminator.label, annotation.discriminator)
  );
}

function comparisonObjective(
  comparisonIds: string[],
  diagnosticReasoning: DiagnosticReasoningViewModel,
): string | null {
  const comparison = diagnosticReasoning.diagnosticComparisons.find((item) =>
    comparisonIds.includes(item.id),
  );
  if (!comparison) return null;

  return `Teach why ${comparison.targetDiagnosisName} beats ${comparison.mimicName}.`;
}

function discriminatorTimingForCase(caseItem: KnowledgeCaseReasoning): string {
  const firstDiscriminator = caseItem.clueInterpretations.find(
    (clue) => clue.discriminatorSignals.length > 0,
  );

  if (!caseItem.hasClueProgression) return 'no_progression';
  if (!firstDiscriminator) return 'not_introduced';
  if (firstDiscriminator.clueIndex <= 1) return 'early';
  return 'staged';
}

function qualityFromCase(
  caseItem: KnowledgeCaseReasoning,
): CaseReasoningCardViewModel['quality'] {
  if (caseItem.prematureLockIn || caseItem.blockerCount > 0) return 'blocked';
  if (
    caseItem.unresolvedAmbiguity ||
    caseItem.warningCount > 0 ||
    caseItem.remainingMimics.length > 0
  ) {
    return 'watch';
  }
  return 'clean';
}

function confidenceFromCaseVerdict(
  verdict: CaseReasoningCardViewModel['quality'],
): CaseReasoningCardViewModel['reasoningConfidence'] {
  if (verdict === 'clean') return 'strong';
  if (verdict === 'watch') return 'watch';
  return 'weak';
}

function toneFromCaseVerdict(
  verdict: CaseReasoningCardViewModel['quality'],
): CaseReasoningTone {
  if (verdict === 'clean') return 'success';
  if (verdict === 'watch') return 'warning';
  return 'danger';
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

function textIncludes(
  value: string | null | undefined,
  search: string | null | undefined,
): boolean {
  if (!value || !search) return false;
  return value.toLowerCase().includes(search.toLowerCase());
}

function dedupeRisks(
  risks: CaseTeachingRiskViewModel[],
): CaseTeachingRiskViewModel[] {
  const seen = new Set<string>();
  return risks.filter((risk) => {
    if (seen.has(risk.id)) return false;
    seen.add(risk.id);
    return true;
  });
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
