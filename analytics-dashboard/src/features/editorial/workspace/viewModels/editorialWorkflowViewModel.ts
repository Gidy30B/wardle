import type {
  DiagnosisEditorialWorkspace,
  DiagnosisTeachingRule,
  WorkspaceClinicalCaseDraft,
  WorkspaceCoverageGap,
  WorkspaceCoverageMatrixRow,
} from '../../../../api/admin.types.ts';
import {
  buildCaseReasoningViewModel,
  type CaseReasoningCardViewModel,
  type CaseReasoningViewModel,
  type ClueProgressionCaseViewModel,
  type DiscriminatorCoverageRowViewModel,
  type ReasoningCoverageRowViewModel,
} from './caseReasoningViewModel.ts';
import {
  buildDiagnosticReasoningViewModel,
  type DiagnosticReasoningViewModel,
} from './diagnosticReasoningViewModel.ts';
import {
  buildContentCoverageViewModel,
  type ContentCoverageViewModel,
  type ContentCoverageRowViewModel,
  type ContentTeachingRiskViewModel,
  type EducationCoverageCardViewModel,
  type MnemonicCardViewModel,
  type RecallPromptCardViewModel,
  type ScoringSystemCardViewModel,
} from './contentCoverageViewModel.ts';
import {
  buildClinicalCaseDraftReviewPacket,
  type ClinicalCaseDraftReviewPacketViewModel,
} from './clinicalCaseDraftReviewPacketViewModel.ts';
import {
  buildKnowledgeGraphViewModel,
  type KnowledgeGraphViewModel,
  type KnowledgeReviewItem,
} from './knowledgeGraphViewModel.ts';
import type {
  WorkspaceBoardId,
  WorkspaceWorkflowId,
} from './workflowNavigationViewModel.ts';

export type WorkflowTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export type WorkflowBoardSummary = {
  id: WorkspaceBoardId;
  label: string;
  question: string;
  verdict: string;
  tone: WorkflowTone;
  itemCount: number;
};

export type WorkflowSectionViewModel = {
  id: WorkspaceWorkflowId;
  label: string;
  question: string;
  verdict: string;
  detail: string;
  tone: WorkflowTone;
  reviewItems: KnowledgeReviewItem[];
  boards: WorkflowBoardSummary[];
};

export type ReviewQueueItemViewModel = KnowledgeReviewItem & {
  groupId: ReviewQueueGroupId;
  editorialReason: string;
  metadata: string[];
};

export type ReviewQueueGroupId =
  | 'publicationBlockers'
  | 'diagnosticReasoning'
  | 'unsupportedClaims'
  | 'drafts'
  | 'reviewCandidates'
  | 'caseReasoning'
  | 'contentCoverage'
  | 'coverageGaps'
  | 'governance';

export type ReviewQueueGroupViewModel = {
  id: ReviewQueueGroupId;
  label: string;
  description: string;
  items: ReviewQueueItemViewModel[];
};

export type ReviewQueueWorkflowViewModel = WorkflowSectionViewModel & {
  items: ReviewQueueItemViewModel[];
  groups: ReviewQueueGroupViewModel[];
};

export type OverviewConcernViewModel = {
  id: string;
  severity: 'blocker' | 'warning' | 'info';
  title: string;
  detail: string;
};

export type OverviewStandingRowViewModel = {
  id:
    | 'teachingCoverage'
    | 'caseReasoning'
    | 'educationQuality'
    | 'evidenceReasoning'
    | 'publicationReadiness';
  label: string;
  status: string;
  detail: string;
  tone: WorkflowTone;
};

export type OverviewWorkflowViewModel = WorkflowSectionViewModel & {
  clinicalVerdict: string;
  concerns: OverviewConcernViewModel[];
  standing: OverviewStandingRowViewModel[];
};

export type PublishChecklistStatus = 'passing' | 'warning' | 'blocked';

export type PublishChecklistItemViewModel = {
  id: string;
  label: string;
  status: PublishChecklistStatus;
  detail: string;
  tone: WorkflowTone;
  source:
    | 'readiness'
    | 'workspace'
    | 'lifecycle'
    | 'coverage'
    | 'claims'
    | 'cases'
    | 'diagnosticReasoning'
    | 'education'
    | 'evidence';
};

export type PublishWorkflowViewModel = WorkflowSectionViewModel & {
  checklist: PublishChecklistItemViewModel[];
  blocked: PublishChecklistItemViewModel[];
  passing: PublishChecklistItemViewModel[];
};

export type CurriculumCoverageGoalViewModel = {
  id: string;
  title: string;
  category: string;
  importance: string;
  status: string;
  tone: WorkflowTone;
  educationCoverage: string;
  caseCoverage: string;
  graphCoverage: string;
  linkedCasesCount: number;
  evidenceSupportCount: number;
  missingCaseSupport: boolean;
  missingEducationSupport: boolean;
  recommendedAction: string;
};

export type CurriculumCoverageGapViewModel = {
  id: string;
  title: string;
  severity: 'blocker' | 'warning' | 'info';
  recommendedAction: string;
  missingEducation: boolean;
  missingCases: boolean;
  missingGraph: boolean;
};

export type CurriculumCoverageBoardViewModel = WorkflowBoardSummary & {
  goals: CurriculumCoverageGoalViewModel[];
  gaps: CurriculumCoverageGapViewModel[];
  missingCaseSupportCount: number;
  missingEducationSupportCount: number;
  discriminatorExpectationCount: number;
};

export type TeachingRuleCardViewModel = {
  id: string;
  title: string;
  category: string;
  importance: string;
  status: string;
  rationale: string | null;
  appliesToEducation: boolean;
  appliesToCaseGeneration: boolean;
  appliesToGraph: boolean;
  supportsDiagnosticDiscrimination: boolean;
  warnings: string[];
  tone: WorkflowTone;
};

export type TeachingRulesBoardViewModel = WorkflowBoardSummary & {
  activeRules: TeachingRuleCardViewModel[];
  candidateRules: TeachingRuleCardViewModel[];
  weakRules: TeachingRuleCardViewModel[];
};

export type TeachingWorkflowViewModel = WorkflowSectionViewModel & {
  curriculumCoverage: CurriculumCoverageBoardViewModel;
  teachingRules: TeachingRulesBoardViewModel;
};

export type DiagnosticReasoningBoardViewModel = WorkflowBoardSummary & {
  coreClaim: DiagnosticReasoningViewModel['coreDiagnosticClaim'];
  comparisons: DiagnosticReasoningViewModel['diagnosticComparisons'];
  discriminators: DiagnosticReasoningViewModel['discriminatorMap'];
  narratives: DiagnosticReasoningViewModel['reasoningNarratives'];
  teachingRisks: DiagnosticReasoningViewModel['teachingRisks'];
  pendingActions: ReviewQueueItemViewModel[];
};

export type EvidenceBoardViewModel = WorkflowBoardSummary & {
  activeRelationships: KnowledgeGraphViewModel['evidence']['active'];
  candidateRelationships: KnowledgeGraphViewModel['evidence']['candidates'];
  lowTrustRelationships: KnowledgeGraphViewModel['evidence']['lowTrust'];
  unsupportedClaims: KnowledgeGraphViewModel['evidence']['unsupportedClaims'];
  coverage: KnowledgeGraphViewModel['evidence']['coverage'];
};

export type DifferentialsBoardViewModel = WorkflowBoardSummary & {
  linkedMimics: KnowledgeGraphViewModel['differentials']['linkedMimics'];
  unresolvedMappings: KnowledgeGraphViewModel['differentials']['unresolvedMappings'];
  discriminatorGaps: KnowledgeGraphViewModel['differentials']['discriminatorGaps'];
  weakComparisons: DiagnosticReasoningViewModel['diagnosticComparisons'];
};

export type ReasoningPathsBoardViewModel = WorkflowBoardSummary & {
  activePaths: KnowledgeGraphViewModel['reasoning']['activePaths'];
  candidatePaths: KnowledgeGraphViewModel['reasoning']['paths'];
  weakPaths: KnowledgeGraphViewModel['reasoning']['weakPaths'];
  generationReadyPaths: KnowledgeGraphViewModel['reasoning']['generationReadyPaths'];
  narratives: DiagnosticReasoningViewModel['reasoningNarratives'];
};

export type ReasoningWorkflowViewModel = WorkflowSectionViewModel & {
  diagnosticReasoning: DiagnosticReasoningBoardViewModel;
  evidence: EvidenceBoardViewModel;
  differentials: DifferentialsBoardViewModel;
  reasoningPaths: ReasoningPathsBoardViewModel;
};

export type DiagnosticCasesBoardViewModel = WorkflowBoardSummary & {
  cases: CaseReasoningCardViewModel[];
  clueRevisionDrafts: KnowledgeGraphViewModel['cases']['clueRevisionDrafts'];
  clinicalCaseDraftPackets: ClinicalCaseDraftReviewPacketViewModel[];
};

export type ClueProgressionBoardViewModel = WorkflowBoardSummary & {
  cases: ClueProgressionCaseViewModel[];
};

export type CaseReasoningCoverageBoardViewModel = WorkflowBoardSummary & {
  rows: ReasoningCoverageRowViewModel[];
  gapCount: number;
};

export type DiscriminatorCoverageBoardViewModel = WorkflowBoardSummary & {
  rows: DiscriminatorCoverageRowViewModel[];
  gapCount: number;
};

export type CasesWorkflowViewModel = WorkflowSectionViewModel & {
  diagnosticCases: DiagnosticCasesBoardViewModel;
  clueProgression: ClueProgressionBoardViewModel;
  reasoningCoverage: CaseReasoningCoverageBoardViewModel;
  discriminatorCoverage: DiscriminatorCoverageBoardViewModel;
  teachingRisks: CaseReasoningViewModel['teachingRisks'];
  blockers: CaseReasoningViewModel['blockers'];
};

export type EducationBoardViewModel = WorkflowBoardSummary & {
  sections: EducationCoverageCardViewModel[];
  coverage: ContentCoverageRowViewModel[];
  teachingRisks: ContentTeachingRiskViewModel[];
};

export type ScoringSystemsBoardViewModel = WorkflowBoardSummary & {
  scoringSystems: ScoringSystemCardViewModel[];
};

export type MnemonicsBoardViewModel = WorkflowBoardSummary & {
  mnemonics: MnemonicCardViewModel[];
};

export type RecallPromptsBoardViewModel = WorkflowBoardSummary & {
  recallPrompts: RecallPromptCardViewModel[];
};

export type ContentWorkflowViewModel = WorkflowSectionViewModel & {
  education: EducationBoardViewModel;
  scoringSystems: ScoringSystemsBoardViewModel;
  mnemonics: MnemonicsBoardViewModel;
  recallPrompts: RecallPromptsBoardViewModel;
  teachingRisks: ContentCoverageViewModel['teachingRisks'];
  blockers: ContentCoverageViewModel['blockers'];
};

export type EditorialWorkflowViewModel = {
  diagnosis: {
    id: string;
    name: string;
  };
  knowledge: KnowledgeGraphViewModel;
  diagnosticReasoning: DiagnosticReasoningViewModel;
  reviewQueue: ReviewQueueWorkflowViewModel;
  overview: OverviewWorkflowViewModel;
  teaching: TeachingWorkflowViewModel;
  reasoning: ReasoningWorkflowViewModel;
  cases: CasesWorkflowViewModel;
  content: ContentWorkflowViewModel;
  publish: PublishWorkflowViewModel;
  workflows: Record<WorkspaceWorkflowId, WorkflowSectionViewModel>;
};

export function buildEditorialWorkflowViewModel(
  workspace: DiagnosisEditorialWorkspace,
): EditorialWorkflowViewModel {
  const knowledge = buildKnowledgeGraphViewModel(workspace);
  const diagnosticReasoning = buildDiagnosticReasoningViewModel(knowledge);
  const caseReasoning = buildCaseReasoningViewModel({
    workspace,
    knowledge,
    diagnosticReasoning,
  });
  const contentCoverage = buildContentCoverageViewModel({
    workspace,
    knowledge,
    diagnosticReasoning,
    caseReasoning,
  });
  const reviewQueueItems = buildReviewQueueItems(
    knowledge.reviewItems,
    diagnosticReasoning,
    caseReasoning.reviewItems,
    caseReasoning.cases,
    contentCoverage.reviewItems,
    workspace.clinicalCaseDrafts?.items ?? [],
  );
  const reviewQueueGroups = buildReviewQueueGroups(reviewQueueItems);
  const overviewConcerns = buildOverviewConcerns(knowledge, diagnosticReasoning);
  const overviewStanding = buildOverviewStandingRows(
    workspace,
    knowledge,
    diagnosticReasoning,
  );
  const publishChecklist = buildPublishChecklist(
    workspace,
    knowledge,
    diagnosticReasoning,
  );
  const curriculumCoverageBoard = buildCurriculumCoverageBoard(
    workspace,
    knowledge,
    diagnosticReasoning,
  );
  const teachingRulesBoard = buildTeachingRulesBoard(
    workspace,
    diagnosticReasoning,
  );
  const diagnosticReasoningBoard = buildDiagnosticReasoningBoard(
    diagnosticReasoning,
    reviewQueueItems,
  );
  const evidenceBoard = buildEvidenceBoard(knowledge);
  const differentialsBoard = buildDifferentialsBoard(
    knowledge,
    diagnosticReasoning,
  );
  const reasoningPathsBoard = buildReasoningPathsBoard(
    knowledge,
    diagnosticReasoning,
  );
  const diagnosticCasesBoard = buildDiagnosticCasesBoard(
    caseReasoning,
    knowledge,
    workspace.clinicalCaseDrafts?.items ?? [],
  );
  const clueProgressionBoard = buildClueProgressionBoard(caseReasoning);
  const caseReasoningCoverageBoard =
    buildCaseReasoningCoverageBoard(caseReasoning);
  const discriminatorCoverageBoard =
    buildDiscriminatorCoverageBoard(caseReasoning);
  const educationBoard = buildEducationBoard(contentCoverage, workspace);
  const scoringSystemsBoard = buildScoringSystemsBoard(contentCoverage);
  const mnemonicsBoard = buildMnemonicsBoard(contentCoverage);
  const recallPromptsBoard = buildRecallPromptsBoard(contentCoverage);

  const reviewQueue = buildWorkflowSection({
    id: 'reviewQueue',
    label: 'Editorial Review',
    question: 'Editorial review queue',
    verdict:
      reviewQueueItems.length > 0
        ? `${reviewQueueItems.length} editorial item(s) need attention.`
        : 'No editorial review items.',
    detail: `${blockerCount(reviewQueueItems)} blocker(s), ${warningCount(
      reviewQueueItems,
    )} warning(s).`,
    tone: blockerCount(reviewQueueItems) > 0
      ? 'danger'
      : reviewQueueItems.length > 0
        ? 'warning'
        : 'success',
    reviewItems: reviewQueueItems,
    boards: [],
    items: reviewQueueItems,
    groups: reviewQueueGroups,
  } satisfies ReviewQueueWorkflowViewModel);

  const overview = buildWorkflowSection({
    id: 'overview',
    label: 'Diagnosis Governance',
    question: 'Educational safety review',
    verdict: diagnosticReasoning.coreDiagnosticClaim.claim,
    detail: diagnosticReasoning.coreDiagnosticClaim.supportSummary,
    tone: toneFromSupport(diagnosticReasoning.coreDiagnosticClaim.supportLevel),
    reviewItems: reviewItemsForWorkflow(knowledge.reviewItems, 'overview'),
    boards: [
      boardSummary({
        id: 'diagnosisHealth',
        label: 'Diagnosis Governance',
        question: 'Educational safety review',
        verdict: diagnosticReasoning.coreDiagnosticClaim.supportSummary,
        tone: toneFromSupport(diagnosticReasoning.coreDiagnosticClaim.supportLevel),
        itemCount: knowledge.blockers.length,
      }),
    ],
    clinicalVerdict: buildClinicalVerdict(knowledge, diagnosticReasoning),
    concerns: overviewConcerns,
    standing: overviewStanding,
  } satisfies OverviewWorkflowViewModel);

  const teaching = buildWorkflowSection({
    id: 'teaching',
    label: 'Teaching Objectives',
    question: 'Teaching objective coverage',
    verdict: buildTeachingVerdict(curriculumCoverageBoard, teachingRulesBoard),
    detail: `${workspace.teachingRules.summary.active} active rule(s), ${workspace.teachingRules.summary.needsReview} needing review.`,
    tone: curriculumCoverageBoard.tone === 'danger' || teachingRulesBoard.tone === 'danger'
      ? 'danger'
      : curriculumCoverageBoard.tone === 'warning' || teachingRulesBoard.tone === 'warning'
        ? 'warning'
        : 'success',
    reviewItems: reviewItemsForWorkflow(knowledge.reviewItems, 'teaching'),
    boards: [curriculumCoverageBoard, teachingRulesBoard],
    curriculumCoverage: curriculumCoverageBoard,
    teachingRules: teachingRulesBoard,
  } satisfies TeachingWorkflowViewModel);

  const reasoning = buildWorkflowSection({
    id: 'reasoning',
    label: 'Diagnostic Reasoning',
    question: 'Differential diagnosis support',
    verdict:
      diagnosticReasoning.diagnosticComparisons.length > 0
        ? `${diagnosticReasoning.diagnosticComparisons.length} diagnostic comparison(s).`
        : 'No diagnostic comparisons yet.',
    detail: `${diagnosticReasoning.discriminatorMap.length} discriminator(s), ${diagnosticReasoning.publicationReasoningBlockers.length} reasoning blocker(s).`,
    tone: diagnosticReasoning.publicationReasoningBlockers.length > 0
      ? 'danger'
      : diagnosticReasoning.teachingRisks.length > 0
        ? 'warning'
        : 'success',
    reviewItems: reviewItemsForWorkflow(knowledge.reviewItems, 'reasoning'),
    boards: [
      diagnosticReasoningBoard,
      evidenceBoard,
      differentialsBoard,
      reasoningPathsBoard,
    ],
    diagnosticReasoning: diagnosticReasoningBoard,
    evidence: evidenceBoard,
    differentials: differentialsBoard,
    reasoningPaths: reasoningPathsBoard,
  } satisfies ReasoningWorkflowViewModel);

  const cases = buildWorkflowSection({
    id: 'cases',
    label: 'Clinical Case Coverage',
    question: 'Diagnostic reasoning coverage',
    verdict: buildCasesVerdict(caseReasoning),
    detail: `${caseReasoning.reasoningCoverage.filter((row) => !row.casesCovered).length} reasoning gap(s), ${caseReasoning.clueProgression.filter((item) => item.leakRisk || item.tone === 'warning').length} progression risk(s), ${caseReasoning.discriminatorCoverage.filter((row) => !row.casesCovered).length} discriminator gap(s).`,
    tone: caseReasoning.blockers.length
      ? 'danger'
      : caseReasoning.teachingRisks.length
        ? 'warning'
        : 'success',
    reviewItems: [
      ...reviewItemsForWorkflow(knowledge.reviewItems, 'cases'),
      ...caseReasoning.reviewItems,
    ],
    boards: [
      diagnosticCasesBoard,
      clueProgressionBoard,
      caseReasoningCoverageBoard,
      discriminatorCoverageBoard,
    ],
    diagnosticCases: diagnosticCasesBoard,
    clueProgression: clueProgressionBoard,
    reasoningCoverage: caseReasoningCoverageBoard,
    discriminatorCoverage: discriminatorCoverageBoard,
    teachingRisks: caseReasoning.teachingRisks,
    blockers: caseReasoning.blockers,
  } satisfies CasesWorkflowViewModel);

  const content = buildWorkflowSection({
    id: 'content',
    label: 'Learner Content',
    question: 'Learner-facing content review',
    verdict: buildContentVerdict(contentCoverage),
    detail: `${contentCoverage.education.length} education section(s), ${contentCoverage.scoringSystems.length} scoring system(s), ${contentCoverage.recallPrompts.length} recall prompt(s).`,
    tone: contentCoverage.blockers.length
      ? 'danger'
      : contentCoverage.teachingRisks.length > 0
        ? 'warning'
        : 'success',
    reviewItems: [
      ...reviewItemsForWorkflow(knowledge.reviewItems, 'content'),
      ...contentCoverage.reviewItems,
    ],
    boards: [
      educationBoard,
      scoringSystemsBoard,
      mnemonicsBoard,
      recallPromptsBoard,
    ],
    education: educationBoard,
    scoringSystems: scoringSystemsBoard,
    mnemonics: mnemonicsBoard,
    recallPrompts: recallPromptsBoard,
    teachingRisks: contentCoverage.teachingRisks,
    blockers: contentCoverage.blockers,
  } satisfies ContentWorkflowViewModel);

  const publish = buildWorkflowSection({
    id: 'publish',
    label: 'Publication Readiness',
    question: 'Publication readiness',
    verdict:
      knowledge.blockers.length > 0
        ? `${knowledge.blockers.length} blocker(s) before publish.`
        : 'No publication blockers in the workflow projection.',
    detail: `${workspace.readinessBreakdown.length} readiness item(s), ${diagnosticReasoning.publicationReasoningBlockers.length} reasoning blocker(s).`,
    tone: knowledge.blockers.length > 0 ? 'danger' : 'success',
    reviewItems: reviewItemsForWorkflow(knowledge.reviewItems, 'publish'),
    boards: [
      boardSummary({
        id: 'publicationReadiness',
        label: 'Publication Readiness',
        question: 'Publication readiness',
        verdict: `${knowledge.blockers.length} blocker(s).`,
        tone: knowledge.blockers.length ? 'danger' : 'success',
        itemCount: workspace.readinessBreakdown.length,
      }),
    ],
    checklist: publishChecklist,
    blocked: publishChecklist.filter((item) => item.status === 'blocked'),
    passing: publishChecklist.filter((item) => item.status === 'passing'),
  } satisfies PublishWorkflowViewModel);

  return {
    diagnosis: {
      id: workspace.diagnosis.id,
      name: workspace.diagnosis.displayLabel,
    },
    knowledge,
    diagnosticReasoning,
    reviewQueue,
    overview,
    teaching,
    reasoning,
    cases,
    content,
    publish,
    workflows: {
      reviewQueue,
      overview,
      teaching,
      reasoning,
      cases,
      content,
      publish,
    },
  };
}

function buildCurriculumCoverageBoard(
  workspace: DiagnosisEditorialWorkspace,
  knowledge: KnowledgeGraphViewModel,
  diagnosticReasoning: DiagnosticReasoningViewModel,
): CurriculumCoverageBoardViewModel {
  const goals = workspace.coverageMatrix.map((row) =>
    mapCoverageGoal(row, workspace.coverageGaps, workspace, knowledge),
  );
  const gaps = workspace.coverageGaps.map(mapCoverageGap);
  const hasBlocker = gaps.some((gap) => gap.severity === 'blocker');
  const hasWarning = gaps.length > 0 || goals.some((goal) => goal.tone === 'warning');
  const missingCaseSupportCount = goals.filter(
    (goal) => goal.missingCaseSupport,
  ).length;
  const missingEducationSupportCount = goals.filter(
    (goal) => goal.missingEducationSupport,
  ).length;

  return {
    id: 'curriculumCoverage',
    label: 'Curriculum Coverage',
    question: 'Teaching objective coverage',
    verdict: goals.length
      ? `${goals.length} teaching goal(s), ${gaps.length} gap(s).`
      : 'No curriculum coverage rows have been projected yet.',
    tone: hasBlocker ? 'danger' : hasWarning ? 'warning' : 'success',
    itemCount: goals.length,
    goals,
    gaps,
    missingCaseSupportCount,
    missingEducationSupportCount,
    discriminatorExpectationCount:
      diagnosticReasoning.discriminatorMap.length +
      diagnosticReasoning.diagnosticComparisons.filter(
        (comparison) => comparison.discriminators.length === 0,
      ).length,
  };
}

function mapCoverageGoal(
  row: WorkspaceCoverageMatrixRow,
  gaps: WorkspaceCoverageGap[],
  workspace: DiagnosisEditorialWorkspace,
  knowledge: KnowledgeGraphViewModel,
): CurriculumCoverageGoalViewModel {
  const rowGaps = gaps.filter(
    (gap) =>
      (row.teachingRuleId && gap.teachingRuleId === row.teachingRuleId) ||
      gap.title === row.title,
  );
  const linkedGoalCoverage = workspace.learningGoalCoverage?.find(
    (goal) =>
      goal.learningGoal === row.title ||
      goal.learningGoalId === row.teachingRuleId,
  );
  const linkedCaseCoverage = workspace.caseLearningGoalCoverage?.filter(
    (goal) =>
      goal.learningGoal === row.title ||
      goal.learningGoalId === row.teachingRuleId,
  ) ?? [];
  const missingCaseSupport =
    row.caseCoverage !== 'covered' ||
    rowGaps.some((gap) => gap.missingCases);
  const missingEducationSupport =
    row.educationCoverage !== 'covered' ||
    rowGaps.some((gap) => gap.missingEducation);
  const hasBlocker = rowGaps.some((gap) => gap.severity === 'blocker');
  const hasWarning =
    row.fullCoverageStatus !== 'covered' ||
    rowGaps.length > 0 ||
    missingCaseSupport ||
    missingEducationSupport;

  return {
    id: row.teachingRuleId ?? row.stableKey,
    title: row.title,
    category: String(row.category),
    importance: String(row.importance),
    status: row.fullCoverageStatus,
    tone: hasBlocker ? 'danger' : hasWarning ? 'warning' : 'success',
    educationCoverage: row.educationCoverage,
    caseCoverage: row.caseCoverage,
    graphCoverage: row.graphCoverage,
    linkedCasesCount:
      linkedGoalCoverage?.coveredByCaseIds.length ??
      linkedCaseCoverage.length,
    evidenceSupportCount:
      row.graphCoverage === 'covered'
        ? knowledge.evidence.active.length +
          knowledge.evidence.coverage.discriminatorEvidenceCount
        : 0,
    missingCaseSupport,
    missingEducationSupport,
    recommendedAction:
      rowGaps[0]?.recommendedAction ??
      row.recommendedAction ??
      'No action recommended.',
  };
}

function mapCoverageGap(
  gap: WorkspaceCoverageGap,
  index: number,
): CurriculumCoverageGapViewModel {
  return {
    id: gap.teachingRuleId ?? `coverage-gap:${index}`,
    title: gap.title,
    severity: gap.severity,
    recommendedAction: gap.recommendedAction,
    missingEducation: gap.missingEducation,
    missingCases: gap.missingCases,
    missingGraph: gap.missingGraph,
  };
}

function buildTeachingRulesBoard(
  workspace: DiagnosisEditorialWorkspace,
  diagnosticReasoning: DiagnosticReasoningViewModel,
): TeachingRulesBoardViewModel {
  const rules = workspace.teachingRules.items.map((rule) =>
    mapTeachingRuleCard(rule, diagnosticReasoning),
  );
  const activeRules = rules.filter((rule) => rule.status === 'ACTIVE');
  const candidateRules = rules.filter((rule) =>
    ['CANDIDATE', 'NEEDS_REVIEW'].includes(rule.status),
  );
  const weakRules = rules.filter(
    (rule) =>
      rule.tone === 'warning' ||
      rule.tone === 'danger' ||
      !rule.supportsDiagnosticDiscrimination,
  );
  const blockerCount = weakRules.filter((rule) => rule.tone === 'danger').length;
  const warningCount = weakRules.length + candidateRules.length;

  return {
    id: 'teachingRules',
    label: 'Teaching Rules',
    question: 'Teaching rule quality',
    verdict: rules.length
      ? `${activeRules.length} active, ${candidateRules.length} candidate/review rule(s).`
      : 'No teaching rules have been created yet.',
    tone: blockerCount ? 'danger' : warningCount ? 'warning' : 'success',
    itemCount: rules.length,
    activeRules,
    candidateRules,
    weakRules,
  };
}

function mapTeachingRuleCard(
  rule: DiagnosisTeachingRule,
  diagnosticReasoning: DiagnosticReasoningViewModel,
): TeachingRuleCardViewModel {
  const warnings = rule.reasoningQualityWarnings ?? [];
  const supportsDiagnosticDiscrimination =
    rule.appliesToGraph ||
    rule.category === 'differential_concept' ||
    rule.category === 'pitfall_concept' ||
    diagnosticReasoning.discriminatorMap.some((discriminator) =>
      discriminator.label.toLowerCase().includes(rule.title.toLowerCase()),
    );
  const needsReview = ['CANDIDATE', 'NEEDS_REVIEW', 'DEPRECATED'].includes(
    rule.status,
  );

  return {
    id: rule.id,
    title: rule.title,
    category: rule.category,
    importance: rule.importance,
    status: rule.status,
    rationale: rule.rationale,
    appliesToEducation: rule.appliesToEducation,
    appliesToCaseGeneration: rule.appliesToCaseGeneration,
    appliesToGraph: rule.appliesToGraph,
    supportsDiagnosticDiscrimination,
    warnings,
    tone:
      rule.status === 'DEPRECATED'
        ? 'danger'
        : warnings.length || needsReview || !supportsDiagnosticDiscrimination
          ? 'warning'
          : 'success',
  };
}

function buildDiagnosticReasoningBoard(
  diagnosticReasoning: DiagnosticReasoningViewModel,
  reviewQueueItems: ReviewQueueItemViewModel[],
): DiagnosticReasoningBoardViewModel {
  return {
    id: 'diagnosticReasoning',
    label: 'Diagnostic Reasoning',
    question: 'Differential diagnosis support',
    verdict: diagnosticReasoning.coreDiagnosticClaim.supportSummary,
    tone: toneFromSupport(diagnosticReasoning.coreDiagnosticClaim.supportLevel),
    itemCount: diagnosticReasoning.diagnosticComparisons.length,
    coreClaim: diagnosticReasoning.coreDiagnosticClaim,
    comparisons: diagnosticReasoning.diagnosticComparisons,
    discriminators: diagnosticReasoning.discriminatorMap,
    narratives: diagnosticReasoning.reasoningNarratives,
    teachingRisks: diagnosticReasoning.teachingRisks,
    pendingActions: reviewQueueItems.filter(
      (item) => item.groupId === 'diagnosticReasoning',
    ),
  };
}

function buildEvidenceBoard(
  knowledge: KnowledgeGraphViewModel,
): EvidenceBoardViewModel {
  const blockerCount = knowledge.evidence.unsupportedClaims.filter(
    (claim) => claim.blocksPublication,
  ).length;
  const warningCount =
    knowledge.evidence.candidates.length +
    knowledge.evidence.lowTrust.length +
    knowledge.evidence.unsupportedClaims.length;

  return {
    id: 'evidence',
    label: 'Evidence Support',
    question: 'Evidence support review',
    verdict: `${knowledge.evidence.active.length} active, ${knowledge.evidence.candidates.length} candidate evidence relationship(s).`,
    tone: blockerCount ? 'danger' : warningCount ? 'warning' : 'success',
    itemCount: knowledge.evidence.relationships.length,
    activeRelationships: knowledge.evidence.active,
    candidateRelationships: knowledge.evidence.candidates,
    lowTrustRelationships: knowledge.evidence.lowTrust,
    unsupportedClaims: knowledge.evidence.unsupportedClaims,
    coverage: knowledge.evidence.coverage,
  };
}

function buildDifferentialsBoard(
  knowledge: KnowledgeGraphViewModel,
  diagnosticReasoning: DiagnosticReasoningViewModel,
): DifferentialsBoardViewModel {
  const weakComparisons = diagnosticReasoning.diagnosticComparisons.filter(
    (comparison) =>
      comparison.confidence === 'weak' ||
      comparison.verdict !== 'target_beats_mimic',
  );
  const blockerCount = diagnosticReasoning.publicationReasoningBlockers.length;
  const warningCount =
    weakComparisons.length +
    knowledge.differentials.unresolvedMappings.length +
    knowledge.differentials.discriminatorGaps.length;

  return {
    id: 'differentials',
    label: 'Differentials',
    question: 'Mimic distinction coverage',
    verdict: `${diagnosticReasoning.diagnosticComparisons.length} A-vs-B comparison(s), ${weakComparisons.length} weak comparison(s).`,
    tone: blockerCount ? 'danger' : warningCount ? 'warning' : 'success',
    itemCount: knowledge.differentials.linkedMimics.length,
    linkedMimics: knowledge.differentials.linkedMimics,
    unresolvedMappings: knowledge.differentials.unresolvedMappings,
    discriminatorGaps: knowledge.differentials.discriminatorGaps,
    weakComparisons,
  };
}

function buildReasoningPathsBoard(
  knowledge: KnowledgeGraphViewModel,
  diagnosticReasoning: DiagnosticReasoningViewModel,
): ReasoningPathsBoardViewModel {
  const candidatePaths = knowledge.reasoning.paths.filter(
    (path) => path.status === 'CANDIDATE',
  );
  const blockerCount = knowledge.reasoning.ungroundedWarnings.filter(
    (warning) => warning.severity === 'blocker',
  ).length;
  const warningCount =
    knowledge.reasoning.weakPaths.length +
    diagnosticReasoning.reasoningNarratives.filter(
      (narrative) => narrative.readiness !== 'strong',
    ).length;

  return {
    id: 'reasoningPaths',
    label: 'Reasoning Paths',
    question: 'Reasoning path review',
    verdict: `${knowledge.reasoning.activePaths.length} active, ${knowledge.reasoning.weakPaths.length} weak path(s).`,
    tone: blockerCount ? 'danger' : warningCount ? 'warning' : 'success',
    itemCount: knowledge.reasoning.paths.length,
    activePaths: knowledge.reasoning.activePaths,
    candidatePaths,
    weakPaths: knowledge.reasoning.weakPaths,
    generationReadyPaths: knowledge.reasoning.generationReadyPaths,
    narratives: diagnosticReasoning.reasoningNarratives,
  };
}

function buildTeachingVerdict(
  curriculumCoverage: CurriculumCoverageBoardViewModel,
  teachingRules: TeachingRulesBoardViewModel,
): string {
  if (curriculumCoverage.tone === 'danger' || teachingRules.tone === 'danger') {
    return 'Teaching is blocked by coverage or rule logic gaps.';
  }

  if (
    curriculumCoverage.tone === 'warning' ||
    teachingRules.tone === 'warning'
  ) {
    return 'Teaching is reviewable, but coverage or rule support needs attention.';
  }

  return 'Teaching coverage and rule logic are ready for editorial review.';
}

function buildDiagnosticCasesBoard(
  caseReasoning: CaseReasoningViewModel,
  knowledge: KnowledgeGraphViewModel,
  clinicalCaseDrafts: WorkspaceClinicalCaseDraft[] = [],
): DiagnosticCasesBoardViewModel {
  const blockers = caseReasoning.cases.filter(
    (caseItem) => caseItem.quality === 'blocked',
  ).length;
  const warnings = caseReasoning.cases.filter(
    (caseItem) => caseItem.quality === 'watch',
  ).length;

  const draftPackets = clinicalCaseDrafts.map(buildClinicalCaseDraftReviewPacket);

  return {
    id: 'diagnosticCases',
    label: 'Diagnostic Cases',
    question: 'Diagnostic reasoning coverage',
    verdict: caseReasoning.cases.length
      ? `${caseReasoning.cases.length} case reasoning projection(s), ${draftPackets.length} draft packet(s), ${blockers} blocked.`
      : 'No diagnostic cases are projected yet.',
    tone: blockers ? 'danger' : warnings ? 'warning' : 'success',
    itemCount: caseReasoning.cases.length + draftPackets.length,
    cases: caseReasoning.cases,
    clinicalCaseDraftPackets: draftPackets,
    clueRevisionDrafts: knowledge.cases.clueRevisionDrafts.filter((draft) =>
      [
        'DRAFT',
        'REVIEW_REQUIRED',
        'PENDING_REVIEW',
        'NEEDS_CHANGES',
        'pending',
        'needs_review',
      ].includes(draft.status),
    ),
  };
}

function buildClueProgressionBoard(
  caseReasoning: CaseReasoningViewModel,
): ClueProgressionBoardViewModel {
  const blockers = caseReasoning.clueProgression.filter(
    (item) => item.leakRisk || item.tone === 'danger',
  ).length;
  const warnings = caseReasoning.clueProgression.filter(
    (item) => item.tone === 'warning',
  ).length;

  return {
    id: 'clueProgression',
    label: 'Clue Progression',
    question: 'Clue progression review',
    verdict: caseReasoning.clueProgression.length
      ? `${caseReasoning.clueProgression.length} clue progression timeline(s).`
      : 'No clue progression analysis is available yet.',
    tone: blockers ? 'danger' : warnings ? 'warning' : 'success',
    itemCount: caseReasoning.clueProgression.length,
    cases: caseReasoning.clueProgression,
  };
}

function buildCaseReasoningCoverageBoard(
  caseReasoning: CaseReasoningViewModel,
): CaseReasoningCoverageBoardViewModel {
  const gapCount = caseReasoning.reasoningCoverage.filter(
    (row) => !row.casesCovered || row.tone === 'danger',
  ).length;
  const warningCount = caseReasoning.reasoningCoverage.filter(
    (row) => row.tone === 'warning',
  ).length;

  return {
    id: 'reasoningCoverage',
    label: 'Reasoning Coverage',
    question: 'Case reasoning coverage',
    verdict: caseReasoning.reasoningCoverage.length
      ? `${caseReasoning.reasoningCoverage.length} diagnostic comparison coverage row(s).`
      : 'No diagnostic comparison coverage rows are projected yet.',
    tone: gapCount ? 'danger' : warningCount ? 'warning' : 'success',
    itemCount: caseReasoning.reasoningCoverage.length,
    rows: caseReasoning.reasoningCoverage,
    gapCount,
  };
}

function buildDiscriminatorCoverageBoard(
  caseReasoning: CaseReasoningViewModel,
): DiscriminatorCoverageBoardViewModel {
  const gapCount = caseReasoning.discriminatorCoverage.filter(
    (row) => !row.casesCovered || row.tone === 'danger',
  ).length;
  const warningCount = caseReasoning.discriminatorCoverage.filter(
    (row) => row.tone === 'warning',
  ).length;

  return {
    id: 'discriminatorCoverage',
    label: 'Discriminator Coverage',
    question: 'Discriminator teaching coverage',
    verdict: caseReasoning.discriminatorCoverage.length
      ? `${caseReasoning.discriminatorCoverage.length} discriminator coverage row(s).`
      : 'No discriminator coverage rows are projected yet.',
    tone: gapCount ? 'danger' : warningCount ? 'warning' : 'success',
    itemCount: caseReasoning.discriminatorCoverage.length,
    rows: caseReasoning.discriminatorCoverage,
    gapCount,
  };
}

function buildEducationBoard(
  contentCoverage: ContentCoverageViewModel,
  workspace: DiagnosisEditorialWorkspace,
): EducationBoardViewModel {
  const blockers = contentCoverage.education.filter(
    (section) => section.tone === 'danger',
  ).length;
  const warnings = contentCoverage.education.filter(
    (section) => section.tone === 'warning',
  ).length;

  return {
    id: 'education',
    label: 'Learner Content',
    question: 'Learner content quality',
    verdict: contentCoverage.education.length
      ? `${contentCoverage.education.length} education section projection(s); ${workspace.education.status} status.`
      : 'No education content has been projected yet.',
    tone: blockers ? 'danger' : warnings ? 'warning' : 'success',
    itemCount: contentCoverage.education.length,
    sections: contentCoverage.education,
    coverage: contentCoverage.coverage,
    teachingRisks: contentCoverage.teachingRisks.filter(
      (risk) => risk.targetBoard === 'education',
    ),
  };
}

function buildScoringSystemsBoard(
  contentCoverage: ContentCoverageViewModel,
): ScoringSystemsBoardViewModel {
  const gaps = contentCoverage.scoringSystems.filter(
    (system) => system.issues.length > 0,
  ).length;

  return {
    id: 'scoringSystems',
    label: 'Scoring Systems',
    question: 'Scoring system coverage',
    verdict: contentCoverage.scoringSystems.length
      ? `${contentCoverage.scoringSystems.length} scoring system projection(s), ${gaps} gap(s).`
      : 'No scoring systems are projected from the current education payload.',
    tone: gaps ? 'warning' : contentCoverage.scoringSystems.length ? 'success' : 'neutral',
    itemCount: contentCoverage.scoringSystems.length,
    scoringSystems: contentCoverage.scoringSystems,
  };
}

function buildMnemonicsBoard(
  contentCoverage: ContentCoverageViewModel,
): MnemonicsBoardViewModel {
  const gaps = contentCoverage.mnemonics.filter(
    (mnemonic) => mnemonic.issues.length > 0,
  ).length;

  return {
    id: 'mnemonics',
    label: 'Mnemonics',
    question: 'Memory aid coverage',
    verdict: contentCoverage.mnemonics.length
      ? `${contentCoverage.mnemonics.length} mnemonic projection(s), ${gaps} gap(s).`
      : 'No mnemonic-like pearls are projected from the current education payload.',
    tone: gaps ? 'warning' : contentCoverage.mnemonics.length ? 'success' : 'neutral',
    itemCount: contentCoverage.mnemonics.length,
    mnemonics: contentCoverage.mnemonics,
  };
}

function buildRecallPromptsBoard(
  contentCoverage: ContentCoverageViewModel,
): RecallPromptsBoardViewModel {
  const weakPrompts = contentCoverage.recallPrompts.filter(
    (prompt) => prompt.reasoningDepth === 'definition_only',
  ).length;

  return {
    id: 'recallPrompts',
    label: 'Recall Prompts',
    question: 'Recall prompt quality',
    verdict: contentCoverage.recallPrompts.length
      ? `${contentCoverage.recallPrompts.length} recall prompt projection(s), ${weakPrompts} definition-only.`
      : 'No recall prompts are projected from the current education payload.',
    tone: weakPrompts ? 'warning' : contentCoverage.recallPrompts.length ? 'success' : 'neutral',
    itemCount: contentCoverage.recallPrompts.length,
    recallPrompts: contentCoverage.recallPrompts,
  };
}

function buildContentVerdict(contentCoverage: ContentCoverageViewModel): string {
  const blockingClaims = contentCoverage.teachingRisks.filter(
    (risk) =>
      risk.title === 'Unsupported education claim' && risk.severity === 'blocker',
  ).length;
  const missingReasoningCoverage = contentCoverage.teachingRisks.filter(
    (risk) => risk.title === 'Missing reasoning coverage in education',
  ).length;
  const missingDiscriminatorCoverage = contentCoverage.teachingRisks.filter(
    (risk) => risk.title === 'Missing education support for discriminator',
  ).length;
  const scoringGaps = contentCoverage.teachingRisks.filter(
    (risk) => risk.targetBoard === 'scoringSystems',
  ).length;
  const recallIssues = contentCoverage.teachingRisks.filter(
    (risk) => risk.targetBoard === 'recallPrompts',
  ).length;

  if (blockingClaims > 0) {
    return `${blockingClaims} unsupported education claim(s) block safe content review.`;
  }

  if (missingReasoningCoverage > 0) {
    return `${missingReasoningCoverage} diagnostic reasoning coverage gap(s) in learner-facing content.`;
  }

  if (missingDiscriminatorCoverage > 0) {
    return `${missingDiscriminatorCoverage} discriminator(s) need education support.`;
  }

  if (scoringGaps > 0) {
    return `${scoringGaps} scoring-system teaching gap(s) need review.`;
  }

  if (recallIssues > 0) {
    return `${recallIssues} recall prompt(s) test memorization more than reasoning.`;
  }

  return 'Learner-facing content aligns with the current reasoning projection.';
}

function buildCasesVerdict(caseReasoning: CaseReasoningViewModel): string {
  const reasoningGaps = caseReasoning.reasoningCoverage.filter(
    (row) => !row.casesCovered,
  ).length;
  const clueRisks = caseReasoning.clueProgression.filter(
    (item) => item.leakRisk || item.tone === 'warning' || item.tone === 'danger',
  ).length;
  const discriminatorGaps = caseReasoning.discriminatorCoverage.filter(
    (row) => !row.casesCovered,
  ).length;

  if (reasoningGaps > 0) {
    return `${reasoningGaps} diagnostic comparison(s) lack case support.`;
  }

  if (clueRisks > 0) {
    return `${clueRisks} clue progression risk(s) need review before cases can teach safely.`;
  }

  if (discriminatorGaps > 0) {
    return `${discriminatorGaps} discriminator(s) are not yet taught in cases.`;
  }

  if (!caseReasoning.cases.length) {
    return 'No diagnostic cases are available yet.';
  }

  return 'Cases currently align with the projected diagnostic reasoning.';
}

function buildReviewQueueItems(
  reviewItems: KnowledgeReviewItem[],
  diagnosticReasoning: DiagnosticReasoningViewModel,
  caseReviewItems: KnowledgeReviewItem[] = [],
  caseGovernanceItems: CaseReasoningCardViewModel[] = [],
  contentReviewItems: KnowledgeReviewItem[] = [],
  clinicalCaseDrafts: WorkspaceClinicalCaseDraft[] = [],
): ReviewQueueItemViewModel[] {
  const reasoningReviewItems = diagnosticReasoning.teachingRisks.map((risk) => ({
    id: `diagnostic-risk:${risk.id}`,
    kind: 'reasoning_path' as const,
    severity: risk.severity,
    title: risk.title,
    detail: risk.detail,
    targetWorkflow: 'reasoning' as const,
    targetBoard: 'differentials' as const,
    sourceId: risk.reasoningPathId ?? risk.caseId ?? risk.comparisonId ?? null,
    groupId: 'diagnosticReasoning' as const,
    editorialReason: risk.detail,
    metadata: [
      risk.comparisonId ? `Comparison ${risk.comparisonId}` : null,
      risk.caseId ? `Case ${risk.caseId}` : null,
      risk.reasoningPathId ? `Path ${risk.reasoningPathId}` : null,
    ].filter((item): item is string => Boolean(item)),
  }));

  return sortReviewQueueItems([
    ...reviewItems.map((item) => ({
      ...item,
      groupId: groupForReviewItem(item),
      editorialReason: editorialReasonForReviewItem(item),
      metadata: metadataForReviewItem(item),
    })),
    ...caseReviewItems.map((item) => ({
      ...item,
      groupId: groupForReviewItem(item),
      editorialReason: editorialReasonForReviewItem(item),
      metadata: metadataForReviewItem(item),
    })),
    ...caseGovernanceItems.flatMap(mapCaseGovernanceQueueItem),
    ...contentReviewItems.map((item) => ({
      ...item,
      groupId: groupForReviewItem(item),
      editorialReason: editorialReasonForReviewItem(item),
      metadata: metadataForReviewItem(item),
    })),
    ...clinicalCaseDrafts.flatMap(mapClinicalCaseDraftQueueItem),
    ...reasoningReviewItems,
  ]);
}

function mapClinicalCaseDraftQueueItem(
  draft: WorkspaceClinicalCaseDraft,
): ReviewQueueItemViewModel[] {
  if (draft.reviewStatus !== 'PENDING_REVIEW' && !draft.applicationAllowed) {
    return [];
  }

  const apply = draft.reviewStatus === 'ACCEPTED' && draft.applicationAllowed;
  const item: ReviewQueueItemViewModel = {
    id: apply ? `clinical-case-draft-apply:${draft.id}` : `clinical-case-draft:${draft.id}`,
    kind: 'clinical_case_draft',
    severity: draft.validation.blockerCount > 0 ? 'blocker' : 'warning',
    title: apply
      ? 'Apply accepted Clinical Case Draft'
      : 'Review generated Clinical Case Draft',
    detail:
      draft.sourceIssueSummary ??
      draft.generatedCase.summary ??
      draft.generationPurposeLabel,
    targetWorkflow: 'cases',
    targetBoard: 'diagnosticCases',
    sourceId: draft.id,
    reviewStatus: draft.reviewStatus,
    raw: draft,
    groupId: 'drafts',
    editorialReason: apply
      ? 'Accepted draft is awaiting separate controlled application.'
      : 'Generated candidate case needs a human review decision before it can be applied.',
    metadata: [
      `Diagnosis: ${draft.diagnosisDisplayName}`,
      `Validation: ${draft.validation.status}`,
      `Draft: ${draft.id}`,
    ],
  };

  return [item];
}

function mapCaseGovernanceQueueItem(
  caseItem: CaseReasoningCardViewModel,
): ReviewQueueItemViewModel[] {
  const governance = caseItem.revisionGovernance;
  const revisionId = governance?.currentRevision?.id;
  if (!governance || !revisionId) return [];

  if (!governance.app006Approval.approved) {
    const hasActiveReview = Boolean(governance.review.activeReviewId);
    return [
      {
        id: hasActiveReview
          ? `case-revision-approval:${caseItem.id}:${revisionId}`
          : `case-revision-review:${caseItem.id}:${revisionId}`,
        kind: 'case_revision',
        severity: hasActiveReview ? 'warning' : 'blocker',
        title: hasActiveReview
          ? 'Approve exact CaseRevision'
          : 'Start CaseRevision review',
        detail: caseItem.title,
        targetWorkflow: 'cases',
        targetBoard: 'diagnosticCases',
        sourceId: caseItem.id,
        reviewStatus: hasActiveReview ? 'IN_REVIEW' : 'NEEDS_REVIEW',
        raw: {
          caseId: caseItem.id,
          revisionId,
          reviewId: governance.review.activeReviewId,
        },
        groupId: 'governance',
        editorialReason: hasActiveReview
          ? 'The current CaseRevision has an active review and needs APP-006 governed approval.'
          : 'The applied case has a current CaseRevision but no active revision review.',
        metadata: [
          `Case: ${caseItem.id}`,
          `Revision: ${revisionId}`,
          `Status: ${caseItem.status}`,
        ],
      },
    ];
  }

  const readiness = governance.publication.readiness;
  if (!governance.publication.authorized) {
    return [
      {
        id: `publication-authorization:${caseItem.id}:${revisionId}`,
        kind: 'publication_authorization',
        severity: readiness?.result === 'READY' ? 'warning' : 'blocker',
        title: 'Authorize exact revision publication',
        detail: readiness
          ? `${readiness.result}; ${readiness.blockers.length} blocker(s), ${readiness.warnings.length} warning(s).`
          : 'Publication readiness has not been projected for this revision.',
        targetWorkflow: 'publish',
        targetBoard: 'publicationReadiness',
        sourceId: caseItem.id,
        reviewStatus: readiness?.result ?? 'BLOCKED',
        raw: {
          caseId: caseItem.id,
          revisionId,
          expectedApprovalDecisionId: readiness?.approvalDecisionId ?? null,
          expectedMaterialContextHash: readiness?.materialContextHash ?? null,
          expectedValidationRunId: readiness?.validationRunId ?? null,
          expectedActivePublicationDecisionId:
            readiness?.activePublicationDecisionId ?? null,
          ready: readiness?.result === 'READY',
        },
        groupId: 'governance',
        editorialReason:
          readiness?.result === 'READY'
            ? 'APP-006 approval and validation are ready for APP-008A publication authorization.'
            : 'APP-008A publication authorization is blocked until readiness passes.',
        metadata: [
          `Case: ${caseItem.id}`,
          `Revision: ${revisionId}`,
          `APP-006: ${governance.app006Approval.decisionId ?? 'missing'}`,
        ],
      },
    ];
  }

  if (!governance.scheduling.scheduled) {
    return [
      {
        id: `publication-scheduler:${caseItem.id}:${revisionId}`,
        kind: 'publication_authorization',
        severity: 'info',
        title: 'Awaiting exact DailyCase binding',
        detail: 'APP-008A is authorized; scheduler has not bound a DailyCase yet.',
        targetWorkflow: 'publish',
        targetBoard: 'publicationReadiness',
        sourceId: caseItem.id,
        reviewStatus: 'AUTHORIZED_UNSCHEDULED',
        raw: {
          caseId: caseItem.id,
          revisionId,
          publicationDecisionId:
            governance.publication.activePublicationDecisionId,
        },
        groupId: 'governance',
        editorialReason:
          'The publication decision is authorized and waiting for APP-008B exact scheduled binding.',
        metadata: [
          `Case: ${caseItem.id}`,
          `Revision: ${revisionId}`,
          `Publication: ${
            governance.publication.activePublicationDecisionId ?? 'authorized'
          }`,
        ],
      },
    ];
  }

  return [];
}

function buildReviewQueueGroups(
  items: ReviewQueueItemViewModel[],
): ReviewQueueGroupViewModel[] {
  const definitions: Array<Omit<ReviewQueueGroupViewModel, 'items'>> = [
    {
      id: 'publicationBlockers',
      label: 'Publication blockers',
      description: 'Issues that directly block publication readiness.',
    },
    {
      id: 'diagnosticReasoning',
      label: 'Diagnostic reasoning deficiencies',
      description: 'Weak or unsafe A-vs-B teaching logic.',
    },
    {
      id: 'unsupportedClaims',
      label: 'Unsupported education claims',
      description: 'Claims that need evidence or repair.',
    },
    {
      id: 'drafts',
      label: 'Pending editorial drafts',
      description: 'Generated editorial work awaiting human decision.',
    },
    {
      id: 'reviewCandidates',
      label: 'Editorial review candidates',
      description: 'Candidate artifacts that need review.',
    },
    {
      id: 'caseReasoning',
      label: 'Case reasoning deficiencies',
      description: 'Case progression, discriminator, and reasoning coverage issues.',
    },
    {
      id: 'contentCoverage',
      label: 'Learner content deficiencies',
      description: 'Education, scoring, mnemonic, and recall prompt gaps.',
    },
    {
      id: 'coverageGaps',
      label: 'Coverage deficiencies',
      description: 'Missing curriculum, case, or graph support.',
    },
    {
      id: 'governance',
      label: 'Registry and governance',
      description: 'Registry or workspace governance issues.',
    },
  ];

  return definitions
    .map((definition) => ({
      ...definition,
      items: items.filter((item) => item.groupId === definition.id),
    }))
    .filter((group) => group.items.length > 0);
}

function buildClinicalVerdict(
  knowledge: KnowledgeGraphViewModel,
  diagnosticReasoning: DiagnosticReasoningViewModel,
): string {
  if (diagnosticReasoning.publicationReasoningBlockers.length > 0) {
    return 'Not safe to teach yet: diagnostic separation has blocker-level gaps.';
  }

  if (knowledge.blockers.length > 0) {
    return 'Not ready for publication: editorial blockers remain.';
  }

  if (diagnosticReasoning.teachingRisks.length > 0) {
    return 'Teachable with caution: reasoning risks need senior review.';
  }

  return 'Safe to review as a teachable diagnosis: no blocker-level concerns are projected.';
}

function buildOverviewConcerns(
  knowledge: KnowledgeGraphViewModel,
  diagnosticReasoning: DiagnosticReasoningViewModel,
): OverviewConcernViewModel[] {
  return [
    ...diagnosticReasoning.teachingRisks.map((risk) => ({
      id: `reasoning:${risk.id}`,
      severity: risk.severity,
      title: risk.title,
      detail: risk.detail,
    })),
    ...knowledge.blockers.map((blocker) => ({
      id: `knowledge:${blocker.id}`,
      severity: 'blocker' as const,
      title: blocker.title,
      detail: blocker.detail,
    })),
    ...knowledge.evidence.unsupportedClaims
      .filter((claim) => claim.blocksPublication)
      .map((claim) => ({
        id: `claim:${claim.id}`,
        severity: 'blocker' as const,
        title: 'Unsupported publication claim',
        detail: claim.claimText,
      })),
  ]
    .sort((left, right) => severityRank(left.severity) - severityRank(right.severity))
    .slice(0, 3);
}

function buildOverviewStandingRows(
  workspace: DiagnosisEditorialWorkspace,
  knowledge: KnowledgeGraphViewModel,
  diagnosticReasoning: DiagnosticReasoningViewModel,
): OverviewStandingRowViewModel[] {
  return [
    {
      id: 'teachingCoverage',
      label: 'Teaching coverage',
      status: workspace.coverageGaps.length ? 'Needs coverage work' : 'No gaps reported',
      detail: `${workspace.coverageGaps.length} gap(s), ${workspace.coverageMatrix.length} coverage row(s).`,
      tone: workspace.coverageGaps.some((gap) => gap.severity === 'blocker')
        ? 'danger'
        : workspace.coverageGaps.length
          ? 'warning'
          : 'success',
    },
    {
      id: 'caseReasoning',
      label: 'Case reasoning coverage',
      status: workspace.cases.summary.blockerCount ? 'Blocked' : 'Reviewable',
      detail: `${knowledge.cases.prematureLockInCases.length} premature lock-in risk(s), ${knowledge.cases.unresolvedMimicCases.length} unresolved mimic case(s).`,
      tone: workspace.cases.summary.blockerCount
        ? 'danger'
        : workspace.cases.summary.warningCount
          ? 'warning'
          : 'success',
    },
    {
      id: 'educationQuality',
      label: 'Learner content quality',
      status: workspace.education.status,
      detail: `${workspace.education.blockers.length} blocker(s), ${workspace.education.warnings.length} warning(s).`,
      tone: workspace.education.blockers.length
        ? 'danger'
        : workspace.education.warnings.length
          ? 'warning'
          : 'info',
    },
    {
      id: 'evidenceReasoning',
      label: 'Evidence and reasoning grounding',
      status: diagnosticReasoning.publicationReasoningBlockers.length
        ? 'Reasoning blocked'
        : 'Reasoning projected',
      detail: `${diagnosticReasoning.diagnosticComparisons.length} comparison(s), ${knowledge.evidence.lowTrust.length} low-trust evidence item(s).`,
      tone: diagnosticReasoning.publicationReasoningBlockers.length
        ? 'danger'
        : diagnosticReasoning.teachingRisks.length
          ? 'warning'
          : 'success',
    },
    {
      id: 'publicationReadiness',
      label: 'Publication readiness',
      status: knowledge.blockers.length ? 'Blocked' : 'No blockers projected',
      detail: `${knowledge.blockers.length} blocker(s), ${workspace.readinessBreakdown.length} readiness item(s).`,
      tone: knowledge.blockers.length ? 'danger' : 'success',
    },
  ];
}

function buildPublishChecklist(
  workspace: DiagnosisEditorialWorkspace,
  knowledge: KnowledgeGraphViewModel,
  diagnosticReasoning: DiagnosticReasoningViewModel,
): PublishChecklistItemViewModel[] {
  return [
    checklistItem({
      id: 'readiness',
      label: 'Readiness assessment',
      blocked: workspace.readinessBreakdown.some((item) => item.severity === 'blocker'),
      warning: workspace.readinessBreakdown.some((item) => item.severity === 'warning'),
      passDetail: 'Readiness breakdown has no blocker-level items.',
      issueDetail: `${workspace.readinessBreakdown.length} readiness item(s) require review.`,
      source: 'readiness',
    }),
    checklistItem({
      id: 'workspace',
      label: 'Editorial blockers',
      blocked: workspace.workspaceSummary.blockers.length > 0,
      warning: workspace.workspaceSummary.warnings.length > 0,
      passDetail: 'Workspace summary reports no blockers.',
      issueDetail: `${workspace.workspaceSummary.blockers.length} blocker(s), ${workspace.workspaceSummary.warnings.length} warning(s).`,
      source: 'workspace',
    }),
    checklistItem({
      id: 'lifecycle',
      label: 'Registry governance',
      blocked:
        workspace.lifecycle.ready === 'blocked' ||
        Boolean(workspace.lifecycleGovernance?.blockers.length),
      warning: workspace.lifecycle.ready !== 'complete',
      passDetail: 'Lifecycle is complete enough for publication review.',
      issueDetail: `Ready state is ${workspace.lifecycle.ready}.`,
      source: 'lifecycle',
    }),
    checklistItem({
      id: 'coverage',
      label: 'Coverage deficiencies',
      blocked: workspace.coverageGaps.some((gap) => gap.severity === 'blocker'),
      warning: workspace.coverageGaps.length > 0,
      passDetail: 'No blocker-level coverage gaps are reported.',
      issueDetail: `${workspace.coverageGaps.length} coverage gap(s).`,
      source: 'coverage',
    }),
    checklistItem({
      id: 'claims',
      label: 'Unsupported claims',
      blocked: knowledge.evidence.unsupportedClaims.some(
        (claim) => claim.blocksPublication,
      ),
      warning: knowledge.evidence.unsupportedClaims.length > 0,
      passDetail: 'No unsupported claims are blocking publication.',
      issueDetail: `${knowledge.evidence.unsupportedClaims.length} unsupported claim(s).`,
      source: 'claims',
    }),
    checklistItem({
      id: 'cases',
      label: 'Case reasoning deficiencies',
      blocked:
        workspace.cases.summary.blockerCount > 0 ||
        knowledge.cases.prematureLockInCases.length > 0,
      warning:
        workspace.cases.summary.warningCount > 0 ||
        knowledge.cases.unresolvedMimicCases.length > 0,
      passDetail: 'Case reasoning has no blocker-level projections.',
      issueDetail: `${workspace.cases.summary.blockerCount} case blocker(s), ${knowledge.cases.prematureLockInCases.length} premature lock-in risk(s).`,
      source: 'cases',
    }),
    checklistItem({
      id: 'diagnostic-reasoning',
      label: 'Diagnostic reasoning deficiencies',
      blocked: diagnosticReasoning.publicationReasoningBlockers.length > 0,
      warning: diagnosticReasoning.teachingRisks.length > 0,
      passDetail: 'Diagnostic reasoning has no blocker-level A-vs-B gaps.',
      issueDetail: `${diagnosticReasoning.publicationReasoningBlockers.length} reasoning blocker(s), ${diagnosticReasoning.teachingRisks.length} teaching risk(s).`,
      source: 'diagnosticReasoning',
    }),
    checklistItem({
      id: 'education',
      label: 'Learner content deficiencies',
      blocked: workspace.education.blockers.length > 0,
      warning: workspace.education.warnings.length > 0,
      passDetail: 'Education has no blocker-level issues.',
      issueDetail: `${workspace.education.blockers.length} blocker(s), ${workspace.education.warnings.length} warning(s).`,
      source: 'education',
    }),
    checklistItem({
      id: 'evidence',
      label: 'Evidence and reasoning support',
      blocked: knowledge.reasoning.ungroundedWarnings.some(
        (warning) => warning.severity === 'blocker',
      ),
      warning:
        knowledge.evidence.lowTrust.length > 0 ||
        knowledge.reasoning.weakPaths.length > 0,
      passDetail: 'Evidence and reasoning support are not reporting blockers.',
      issueDetail: `${knowledge.evidence.lowTrust.length} low-trust evidence item(s), ${knowledge.reasoning.weakPaths.length} weak path(s).`,
      source: 'evidence',
    }),
  ];
}

function checklistItem(params: {
  id: string;
  label: string;
  blocked: boolean;
  warning: boolean;
  passDetail: string;
  issueDetail: string;
  source: PublishChecklistItemViewModel['source'];
}): PublishChecklistItemViewModel {
  const status: PublishChecklistStatus = params.blocked
    ? 'blocked'
    : params.warning
      ? 'warning'
      : 'passing';

  return {
    id: params.id,
    label: params.label,
    status,
    detail: status === 'passing' ? params.passDetail : params.issueDetail,
    tone:
      status === 'blocked'
        ? 'danger'
        : status === 'warning'
          ? 'warning'
          : 'success',
    source: params.source,
  };
}

function groupForReviewItem(item: KnowledgeReviewItem): ReviewQueueGroupId {
  if (item.severity === 'blocker' && item.targetWorkflow === 'publish') {
    return 'publicationBlockers';
  }

  if (item.kind === 'unsupported_claim') return 'unsupportedClaims';
  if (
    item.kind === 'discriminator_draft' ||
    item.kind === 'clinical_case_draft' ||
    item.kind === 'clue_revision_draft'
  ) {
    return 'drafts';
  }
  if (
    item.kind === 'teaching_rule' ||
    item.kind === 'evidence_relationship' ||
    item.kind === 'teaching_relationship' ||
    item.kind === 'reasoning_path' ||
    item.kind === 'graph_candidate'
  ) {
    return 'reviewCandidates';
  }
  if (item.kind === 'case_quality') return 'caseReasoning';
  if (item.targetWorkflow === 'content') return 'contentCoverage';
  if (item.kind === 'coverage_gap') return 'coverageGaps';
  if (item.kind === 'readiness' || item.kind === 'workspace_blocker') {
    return item.targetWorkflow === 'publish'
      ? 'publicationBlockers'
      : 'governance';
  }
  return 'governance';
}

function editorialReasonForReviewItem(item: KnowledgeReviewItem): string {
  if (item.severity === 'blocker') {
    return `Blocker: ${item.detail}`;
  }
  if (item.severity === 'warning') {
    return `Needs review: ${item.detail}`;
  }
  return item.detail;
}

function metadataForReviewItem(item: KnowledgeReviewItem): string[] {
  return [
    `Workflow: ${item.targetWorkflow}`,
    item.targetBoard ? `Board: ${item.targetBoard}` : null,
    item.sourceId ? `Source: ${item.sourceId}` : null,
  ].filter((value): value is string => Boolean(value));
}

function sortReviewQueueItems(
  items: ReviewQueueItemViewModel[],
): ReviewQueueItemViewModel[] {
  const deduped = dedupeReviewQueueItems(items);
  const groupRank: Record<ReviewQueueGroupId, number> = {
    publicationBlockers: 0,
    diagnosticReasoning: 1,
    unsupportedClaims: 2,
    drafts: 3,
    reviewCandidates: 4,
    caseReasoning: 5,
    contentCoverage: 6,
    coverageGaps: 7,
    governance: 8,
  };

  return deduped.sort((left, right) => {
    const severityDelta =
      severityRank(left.severity) - severityRank(right.severity);
    if (severityDelta !== 0) return severityDelta;
    return groupRank[left.groupId] - groupRank[right.groupId];
  });
}

function dedupeReviewQueueItems(
  items: ReviewQueueItemViewModel[],
): ReviewQueueItemViewModel[] {
  const seen = new Map<string, ReviewQueueItemViewModel>();

  items.forEach((item) => {
    const key =
      item.kind === 'unsupported_claim' && item.sourceId
        ? `${item.kind}:${item.sourceId}`
        : [
            item.kind,
            item.targetWorkflow,
            item.targetBoard ?? 'none',
            item.sourceId ?? item.title,
          ].join(':');
    const existing = seen.get(key);

    if (!existing || severityRank(item.severity) < severityRank(existing.severity)) {
      seen.set(key, item);
    }
  });

  return [...seen.values()];
}

function severityRank(severity: 'blocker' | 'warning' | 'info'): number {
  if (severity === 'blocker') return 0;
  if (severity === 'warning') return 1;
  return 2;
}

function buildWorkflowSection<T extends WorkflowSectionViewModel>(
  section: T,
): T {
  return section;
}

function boardSummary(summary: WorkflowBoardSummary): WorkflowBoardSummary {
  return summary;
}

function reviewItemsForWorkflow(
  reviewItems: KnowledgeReviewItem[],
  workflowId: WorkspaceWorkflowId,
): KnowledgeReviewItem[] {
  return reviewItems.filter((item) => item.targetWorkflow === workflowId);
}

function warningCount(items: KnowledgeReviewItem[]): number {
  return items.filter((item) => item.severity === 'warning').length;
}

function blockerCount(items: KnowledgeReviewItem[]): number {
  return items.filter((item) => item.severity === 'blocker').length;
}

function toneFromSupport(
  supportLevel: DiagnosticReasoningViewModel['coreDiagnosticClaim']['supportLevel'],
): WorkflowTone {
  if (supportLevel === 'strong') return 'success';
  if (supportLevel === 'watch') return 'warning';
  return 'danger';
}
