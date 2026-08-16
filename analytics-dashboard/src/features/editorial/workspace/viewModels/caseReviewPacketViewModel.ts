import type {
  AiDraftRevisionAudit,
  CaseClueRevisionDraft,
  DiagnosisEditorialWorkspace,
  EditorialCaseDetail,
} from "../../../../api/admin.types.ts";
import {
  parseCaseClues,
  parseGenerationQuality,
  parseValidationFindingIssues,
} from "../../../cases/case.transforms.ts";
import {
  getLatestReview,
  getLatestValidationRun,
} from "../../../cases/cases.helpers.ts";
import type {
  ClueProgressionCaseViewModel,
  CaseReasoningCardViewModel,
} from "./caseReasoningViewModel.ts";
import type {
  DiagnosticComparison,
  DiagnosticReasoningViewModel,
} from "./diagnosticReasoningViewModel.ts";
import type {
  EditorialWorkflowViewModel,
  ReviewQueueItemViewModel,
} from "./editorialWorkflowViewModel.ts";
import type {
  KnowledgeEvidenceRelationship,
  KnowledgeUnsupportedClaim,
} from "./knowledgeGraphViewModel.ts";

export type CaseReviewPacketTone = "success" | "warning" | "danger" | "neutral";

export type CaseReviewPacketIssue = {
  id: string;
  severity: "blocker" | "warning" | "info";
  domain:
    | "case"
    | "clues"
    | "reasoning"
    | "differentials"
    | "explanation"
    | "education"
    | "evidence"
    | "ai"
    | "publication";
  title: string;
  detail: string;
  sourceId: string | null;
};

export type CaseReviewPacketAction = {
  id:
    | "case.startReview"
    | "case.approve"
    | "case.requestChanges"
    | "case.reject"
    | "case.rerunValidation"
    | "case.reviewAiDrafts"
    | "case.resolveEvidence"
    | "case.markReadyToPublish"
    | "case.none";
  label: string;
  reason: string;
  enabled: boolean;
  existingSurface: "case-detail" | "workspace" | "proposed-packet";
};

/**
 * A case-scoped approval read model. It deliberately composes the full case-detail
 * endpoint with diagnosis workspace projections; neither source is sufficient alone.
 */
export type CaseReviewPacketViewModel = {
  identity: {
    caseId: string;
    title: string;
    diagnosisId: string | null;
    diagnosisName: string;
    difficulty: string;
  };
  state: {
    editorialStatus: string;
    currentRevisionId: string | null;
    revisionNumber: number | null;
    revisionSource: string | null;
    updatedAt: string | null;
    latestValidationOutcome: string | null;
    latestReviewDecision: string | null;
    approvedAt: string | null;
  };
  clinicalContent: {
    history: string;
    symptoms: string[];
    clues: Array<{
      order: number;
      type: string;
      text: string;
      interpretation: string | null;
      progressionQuality: "strong" | "watch" | "weak" | "unknown";
      remainingMimics: string[];
      rulesOutMimics: string[];
      discriminatorSignals: string[];
      concern: string | null;
    }>;
    clueCoherence: {
      verdict: "coherent" | "review" | "unsafe" | "unassessed";
      prematureLeak: boolean;
      unresolvedMimics: string[];
      discriminatorTiming: string | null;
    };
  };
  reasoning: {
    verdict: "defensible" | "review" | "unsafe" | "unassessed";
    objective: string | null;
    confidence: string | null;
    linkedLearningGoals: string[];
    linkedDiscriminators: string[];
    comparisons: Array<{
      id: string;
      mimicName: string;
      verdict: string;
      confidence: string;
      whyTargetWins: string;
      evidenceRelationshipIds: string[];
      reasoningPathIds: string[];
    }>;
  };
  differentials: {
    listed: string[];
    assessed: Array<{
      mimicName: string;
      status: string;
      discriminator: string | null;
      eliminationStrength: string;
      remainingConfusionRisk: boolean;
    }>;
    unassessed: string[];
  };
  explanation: {
    present: boolean;
    diagnosis: string | null;
    summary: string | null;
    reasoningSteps: string[];
    keyFindings: string[];
    generationQualityPresent: boolean;
    unsupportedClaims: Array<{
      id: string;
      claim: string;
      severity: string;
      evidenceIds: string[];
      attribution: "case" | "diagnosis_unattributed";
    }>;
    evidenceRelationships: Array<{
      id: string;
      label: string;
      status: string;
      trust: string;
      strength: number;
      reasoningSummary: string | null;
    }>;
    evidenceVerdict: "supported" | "review" | "unsafe" | "unassessed";
  };
  education: {
    diagnosisLevelStatus: string;
    version: number | null;
    qualityScore: number | null;
    linkedLearningGoals: Array<{
      id: string;
      label: string;
      coverageStrength: number;
      missingDiscriminators: string[];
      missingMimics: string[];
    }>;
    completeness: "complete" | "partial" | "missing" | "unassessed";
    attribution: "diagnosis_level_only";
  };
  aiContribution: {
    hasAiGeneratedContent: boolean;
    generationMetadataPresent: boolean;
    pendingHumanReview: boolean;
    audits: Array<{
      id: string;
      artifactType: string;
      actionType: string;
      reviewStatus: string;
      createdAt: string;
      reviewerUserId: string | null;
      decisionAt: string | null;
    }>;
  };
  governance: {
    blockers: CaseReviewPacketIssue[];
    warnings: CaseReviewPacketIssue[];
    reviewQueueItems: ReviewQueueItemViewModel[];
    dataGaps: string[];
    diagnosisPublishReady: boolean;
    casePublishEligible: boolean;
  };
  decision: {
    canApproveNow: boolean;
    verdict:
      | "approve"
      | "approve_with_caution"
      | "changes_required"
      | "insufficient_data"
      | "already_approved";
    rationale: string;
    nextAction: CaseReviewPacketAction;
    availableActions: CaseReviewPacketAction[];
  };
};

export function buildCaseReviewPacketViewModel(params: {
  caseDetail: EditorialCaseDetail;
  workspace: DiagnosisEditorialWorkspace;
  workflow?: EditorialWorkflowViewModel;
}): CaseReviewPacketViewModel {
  const { caseDetail, workspace } = params;
  const workflow = params.workflow;
  const caseCard = workflow?.cases.diagnosticCases.cases.find(
    (item) => item.id === caseDetail.id,
  );
  const progression = workflow?.cases.clueProgression.cases.find(
    (item) => item.caseId === caseDetail.id,
  );
  const knowledgeCase = workflow?.knowledge.cases.caseReasoning.find(
    (item) => item.id === caseDetail.id,
  );
  const comparisons = comparisonsForCase(
    caseCard,
    workflow?.diagnosticReasoning,
  );
  const evidenceIds = new Set(
    comparisons.flatMap((item) => item.supportingEvidenceRelationshipIds),
  );
  const evidence = (workflow?.knowledge.evidence.relationships ?? []).filter(
    (item) => evidenceIds.has(item.id),
  );
  const caseClues = parseCaseClues(caseDetail.clues);
  const latestValidation = getLatestValidationRun(caseDetail.validationRuns);
  const latestReview = getLatestReview(caseDetail.reviews);
  const validationIssues = parseValidationFindingIssues(
    latestValidation?.findings,
  );
  const quality =
    caseDetail.qualityProjection ??
    workspace.cases.items.find((item) => item.id === caseDetail.id)
      ?.qualityProjection;
  const aiAudits = (workspace.aiDraftAuditTrail ?? []).filter(
    (audit) => audit.caseId === caseDetail.id,
  );
  const clueDrafts = caseClueDrafts(workspace, caseDetail.id);
  const reviewQueueItems = (workflow?.reviewQueue.items ?? []).filter(
    (item) => item.sourceId === caseDetail.id,
  );
  const diagnosisClaims = workflow?.knowledge.evidence.unsupportedClaims ?? [];
  const explanation = readExplanation(caseDetail.explanation);
  const generationQuality = parseGenerationQuality(caseDetail.explanation);
  const goalRows = (workspace.caseLearningGoalCoverage ?? []).filter(
    (row) => row.caseId === caseDetail.id,
  );

  const issues = collectIssues({
    caseDetail,
    caseCard,
    progression,
    quality,
    validationIssues,
    evidence,
    diagnosisClaims,
    aiAudits,
    clueDrafts,
    explanationPresent: explanation.present,
    educationStatus: workspace.education.status,
  });
  const blockers = issues.filter((item) => item.severity === "blocker");
  const warnings = issues.filter((item) => item.severity === "warning");
  const dataGaps = packetDataGaps({
    caseDetail,
    progression,
    caseCard,
    workflowPresent: Boolean(workflow),
    evidence,
    comparisonCount: comparisons.length,
  });
  const decision = buildDecision({
    status: caseDetail.editorialStatus,
    blockers,
    warnings,
    dataGaps,
    aiReviewPending: aiAudits.some(isPendingAiAudit),
    latestValidationOutcome: latestValidation?.outcome ?? null,
    diagnosisPublishReady: caseDetail.diagnosisPublishReadiness.ready,
  });

  return {
    identity: {
      caseId: caseDetail.id,
      title: caseDetail.title,
      diagnosisId: caseDetail.diagnosisRegistryId,
      diagnosisName:
        caseDetail.diagnosisRegistrySummary?.displayLabel ??
        caseDetail.proposedDiagnosisText ??
        workspace.diagnosis.displayLabel,
      difficulty: caseDetail.difficulty,
    },
    state: {
      editorialStatus: caseDetail.editorialStatus ?? "UNKNOWN",
      currentRevisionId: caseDetail.currentRevisionId,
      revisionNumber: caseDetail.currentRevision?.revisionNumber ?? null,
      revisionSource: caseDetail.currentRevision?.source ?? null,
      updatedAt:
        workspace.cases.items.find((item) => item.id === caseDetail.id)
          ?.updatedAt ?? null,
      latestValidationOutcome: latestValidation?.outcome ?? null,
      latestReviewDecision: latestReview?.decision ?? null,
      approvedAt: caseDetail.approvedAt,
    },
    clinicalContent: {
      history: caseDetail.history,
      symptoms: caseDetail.symptoms,
      clues: caseClues.map((clue) => {
        const step = progression?.steps.find(
          (item) => item.clueIndex === clue.order,
        );
        return {
          order: clue.order,
          type: clue.type,
          text: clue.value,
          interpretation: step?.interpretation ?? null,
          progressionQuality: step?.risk ?? "unknown",
          remainingMimics: step?.remainingMimics ?? [],
          rulesOutMimics: step?.rulesOutMimics ?? [],
          discriminatorSignals: step?.discriminatorSignals ?? [],
          concern: step?.editorialConcern ?? null,
        };
      }),
      clueCoherence: {
        verdict: clueVerdict(progression, caseClues.length),
        prematureLeak: progression?.leakRisk ?? false,
        unresolvedMimics: progression?.unresolvedMimics ?? [],
        discriminatorTiming: progression?.discriminatorTiming ?? null,
      },
    },
    reasoning: {
      verdict: reasoningVerdict(caseCard, comparisons),
      objective: caseCard?.reasoningObjective ?? null,
      confidence: caseCard?.reasoningConfidence ?? null,
      linkedLearningGoals: caseCard?.linkedLearningGoals ?? [],
      linkedDiscriminators: caseCard?.linkedDiscriminators ?? [],
      comparisons: comparisons.map(mapComparison),
    },
    differentials: {
      listed: caseDetail.differentials,
      assessed: (knowledgeCase?.mimicEliminations ?? []).map((item) => ({
        mimicName: item.mimicName,
        status: item.finalStatus,
        discriminator: item.discriminatorUsed,
        eliminationStrength: item.eliminationStrength,
        remainingConfusionRisk: item.remainingConfusionRisk,
      })),
      unassessed: caseDetail.differentials.filter(
        (name) =>
          !knowledgeCase?.mimicEliminations.some(
            (item) => normalize(item.mimicName) === normalize(name),
          ),
      ),
    },
    explanation: {
      ...explanation,
      generationQualityPresent: Boolean(generationQuality),
      unsupportedClaims: diagnosisClaims.map(mapUnsupportedClaim),
      evidenceRelationships: evidence.map(mapEvidence),
      evidenceVerdict: evidenceVerdict(evidence, diagnosisClaims),
    },
    education: {
      diagnosisLevelStatus: workspace.education.status,
      version: workspace.education.version,
      qualityScore: workspace.education.qualityScore,
      linkedLearningGoals: goalRows.map((row) => ({
        id: row.learningGoalId,
        label: row.learningGoal,
        coverageStrength: row.coverageStrength,
        missingDiscriminators: row.missingDiscriminators,
        missingMimics: row.missingMimics,
      })),
      completeness:
        workspace.education.status === "missing"
          ? "missing"
          : goalRows.length === 0
            ? "unassessed"
            : goalRows.some(
                  (row) =>
                    row.coverageStrength < 0.5 ||
                    row.missingDiscriminators.length > 0 ||
                    row.missingMimics.length > 0,
                )
              ? "partial"
              : "complete",
      attribution: "diagnosis_level_only",
    },
    aiContribution: {
      hasAiGeneratedContent: Boolean(generationQuality) || aiAudits.length > 0,
      generationMetadataPresent: Boolean(generationQuality),
      pendingHumanReview: aiAudits.some(isPendingAiAudit),
      audits: aiAudits.map(mapAiAudit),
    },
    governance: {
      blockers,
      warnings,
      reviewQueueItems,
      dataGaps,
      diagnosisPublishReady: caseDetail.diagnosisPublishReadiness.ready,
      casePublishEligible:
        blockers.length === 0 &&
        dataGaps.length === 0 &&
        caseDetail.diagnosisPublishReadiness.ready,
    },
    decision,
  };
}

function comparisonsForCase(
  caseCard: CaseReasoningCardViewModel | undefined,
  reasoning: DiagnosticReasoningViewModel | undefined,
): DiagnosticComparison[] {
  if (!caseCard || !reasoning) return [];
  const ids = new Set(caseCard.linkedComparisonIds);
  return reasoning.diagnosticComparisons.filter((item) => ids.has(item.id));
}

function mapComparison(item: DiagnosticComparison) {
  return {
    id: item.id,
    mimicName: item.mimicName,
    verdict: item.verdict,
    confidence: item.confidence,
    whyTargetWins: item.whyTargetWins,
    evidenceRelationshipIds: item.supportingEvidenceRelationshipIds,
    reasoningPathIds: item.supportingReasoningPathIds,
  };
}

function readExplanation(
  value: unknown,
): Pick<
  CaseReviewPacketViewModel["explanation"],
  "present" | "diagnosis" | "summary" | "reasoningSteps" | "keyFindings"
> {
  const record = asRecord(value);
  return {
    present: Boolean(value),
    diagnosis: stringValue(record?.diagnosis),
    summary: stringValue(record?.summary),
    reasoningSteps: stringArray(record?.reasoning),
    keyFindings: stringArray(record?.keyFindings),
  };
}

function collectIssues(params: {
  caseDetail: EditorialCaseDetail;
  caseCard?: CaseReasoningCardViewModel;
  progression?: ClueProgressionCaseViewModel;
  quality: EditorialCaseDetail["qualityProjection"];
  validationIssues: ReturnType<typeof parseValidationFindingIssues>;
  evidence: KnowledgeEvidenceRelationship[];
  diagnosisClaims: KnowledgeUnsupportedClaim[];
  aiAudits: AiDraftRevisionAudit[];
  clueDrafts: CaseClueRevisionDraft[];
  explanationPresent: boolean;
  educationStatus: string;
}): CaseReviewPacketIssue[] {
  const issues: CaseReviewPacketIssue[] = [];
  const add = (
    severity: CaseReviewPacketIssue["severity"],
    domain: CaseReviewPacketIssue["domain"],
    title: string,
    detail: string,
    sourceId: string | null = null,
  ) =>
    issues.push({
      id: `${domain}:${issues.length}`,
      severity,
      domain,
      title,
      detail,
      sourceId,
    });

  params.quality?.blockers.forEach((detail) =>
    add(
      "blocker",
      "case",
      "Case quality blocker",
      detail,
      params.caseDetail.id,
    ),
  );
  params.quality?.warnings.forEach((detail) =>
    add(
      "warning",
      "case",
      "Case quality warning",
      detail,
      params.caseDetail.id,
    ),
  );
  params.caseCard?.teachingRisks.forEach((risk) =>
    add(risk.severity, "reasoning", risk.title, risk.detail, risk.id),
  );
  params.validationIssues.forEach((issue) =>
    add(
      issue.severity === "error" ? "blocker" : issue.severity,
      "case",
      `Validation: ${issue.code}`,
      issue.message,
      issue.validator,
    ),
  );
  if (params.progression?.leakRisk) {
    add(
      "blocker",
      "clues",
      "Diagnosis is revealed too early",
      "Clue progression projects premature diagnostic lock-in.",
      params.caseDetail.id,
    );
  }
  if (params.progression?.unresolvedMimics.length) {
    add(
      "warning",
      "differentials",
      "Mimics remain unresolved",
      params.progression.unresolvedMimics.join(", "),
      params.caseDetail.id,
    );
  }
  if (!params.explanationPresent) {
    add(
      "blocker",
      "explanation",
      "Explanation is missing",
      "A case cannot be approved without a learner-facing explanation.",
      params.caseDetail.id,
    );
  }
  if (params.evidence.some((item) => item.isLowTrust)) {
    add(
      "warning",
      "evidence",
      "Low-trust evidence supports reasoning",
      "At least one linked relationship requires stronger evidence.",
      null,
    );
  }
  params.diagnosisClaims
    .filter((claim) => claim.blocksPublication)
    .forEach((claim) =>
      add(
        "warning",
        "evidence",
        "Diagnosis-level unsupported claim requires attribution",
        claim.claimText,
        claim.id,
      ),
    );
  if (params.educationStatus === "missing") {
    add(
      "blocker",
      "education",
      "Learner education is missing",
      "The linked diagnosis has no learner-facing education.",
      null,
    );
  }
  if (params.aiAudits.some(isPendingAiAudit)) {
    add(
      "blocker",
      "ai",
      "AI-generated changes await human review",
      "Resolve all case-scoped AI drafts before approval.",
      params.caseDetail.id,
    );
  }
  if (params.clueDrafts.some((draft) => isPendingStatus(draft.status))) {
    add(
      "blocker",
      "clues",
      "Clue revisions are still pending",
      "Approve, reject, or supersede pending clue revisions before case approval.",
      params.caseDetail.id,
    );
  }
  return dedupeIssues(issues);
}

function packetDataGaps(params: {
  caseDetail: EditorialCaseDetail;
  progression?: ClueProgressionCaseViewModel;
  caseCard?: CaseReasoningCardViewModel;
  workflowPresent: boolean;
  evidence: KnowledgeEvidenceRelationship[];
  comparisonCount: number;
}): string[] {
  const gaps: string[] = [];
  if (
    !params.caseDetail.currentRevisionId ||
    !params.caseDetail.currentRevision
  )
    gaps.push("Current case revision is unavailable.");
  if (parseCaseClues(params.caseDetail.clues).length === 0)
    gaps.push("Structured case clues are unavailable.");
  if (!params.workflowPresent)
    gaps.push("Diagnosis workspace projections are unavailable.");
  if (!params.progression)
    gaps.push("Clue progression has not been projected for this case.");
  if (!params.caseCard)
    gaps.push("Case reasoning coverage has not been projected.");
  if (params.comparisonCount === 0)
    gaps.push("No diagnostic comparison is linked to this case.");
  if (params.comparisonCount > 0 && params.evidence.length === 0)
    gaps.push(
      "Linked diagnostic comparisons have no mapped evidence relationship.",
    );
  return gaps;
}

function buildDecision(params: {
  status: string | null;
  blockers: CaseReviewPacketIssue[];
  warnings: CaseReviewPacketIssue[];
  dataGaps: string[];
  aiReviewPending: boolean;
  latestValidationOutcome: string | null;
  diagnosisPublishReady: boolean;
}): CaseReviewPacketViewModel["decision"] {
  const actions: CaseReviewPacketAction[] = [];
  if (
    !params.latestValidationOutcome ||
    params.latestValidationOutcome !== "PASSED"
  )
    actions.push(
      action(
        "case.rerunValidation",
        "Run case validation",
        "Approval requires a current passing validation.",
        true,
        "case-detail",
      ),
    );
  if (params.aiReviewPending)
    actions.push(
      action(
        "case.reviewAiDrafts",
        "Review AI-generated changes",
        "Human review is pending for case-scoped AI output.",
        true,
        "workspace",
      ),
    );
  if (params.blockers.some((item) => item.domain === "evidence"))
    actions.push(
      action(
        "case.resolveEvidence",
        "Resolve evidence blockers",
        "Clinical claims must be supported before approval.",
        true,
        "workspace",
      ),
    );
  if (params.blockers.length || params.dataGaps.length) {
    actions.push(
      action(
        "case.requestChanges",
        "Request changes",
        "The packet contains blockers or missing review data.",
        true,
        "case-detail",
      ),
    );
    actions.push(
      action(
        "case.reject",
        "Reject case",
        "Reject when the case is clinically or educationally unsuitable.",
        true,
        "case-detail",
      ),
    );
  } else if (params.status === "VALIDATED") {
    actions.push(
      action(
        "case.startReview",
        "Start editorial review",
        "Move the validated case into formal review.",
        true,
        "case-detail",
      ),
    );
  } else if (params.status === "REVIEW" || params.status === "NEEDS_EDIT") {
    actions.push(
      action(
        "case.approve",
        "Approve case",
        "All packet requirements are satisfied.",
        true,
        "case-detail",
      ),
    );
  } else if (params.status === "APPROVED" && params.diagnosisPublishReady) {
    actions.push(
      action(
        "case.markReadyToPublish",
        "Mark ready to publish",
        "The approved case and linked diagnosis are publication-eligible.",
        true,
        "workspace",
      ),
    );
  }

  const alreadyApproved =
    params.status === "APPROVED" ||
    params.status === "READY_TO_PUBLISH" ||
    params.status === "PUBLISHED";
  const canApproveNow =
    !alreadyApproved &&
    params.blockers.length === 0 &&
    params.dataGaps.length === 0 &&
    params.latestValidationOutcome === "PASSED" &&
    (params.status === "REVIEW" || params.status === "NEEDS_EDIT");
  const verdict = alreadyApproved
    ? "already_approved"
    : params.dataGaps.length
      ? "insufficient_data"
      : params.blockers.length
        ? "changes_required"
        : params.warnings.length
          ? "approve_with_caution"
          : "approve";
  const nextAction =
    actions[0] ??
    action(
      "case.none",
      "No action required",
      "The case is already in its terminal state.",
      false,
      "proposed-packet",
    );

  return {
    canApproveNow,
    verdict,
    rationale:
      params.blockers.length > 0
        ? `${params.blockers.length} blocker(s) must be resolved before approval.`
        : params.dataGaps.length > 0
          ? `${params.dataGaps.length} required review data gap(s) remain.`
          : params.warnings.length > 0
            ? `No blockers remain; ${params.warnings.length} warning(s) require editorial judgement.`
            : alreadyApproved
              ? "The case has already passed editorial approval."
              : "Validation, clinical reasoning, evidence, education, and AI review checks are clear.",
    nextAction,
    availableActions: actions,
  };
}

function action(
  id: CaseReviewPacketAction["id"],
  label: string,
  reason: string,
  enabled: boolean,
  existingSurface: CaseReviewPacketAction["existingSurface"],
): CaseReviewPacketAction {
  return { id, label, reason, enabled, existingSurface };
}

function clueVerdict(
  progression: ClueProgressionCaseViewModel | undefined,
  clueCount: number,
): CaseReviewPacketViewModel["clinicalContent"]["clueCoherence"]["verdict"] {
  if (!progression || clueCount === 0) return "unassessed";
  if (progression.leakRisk) return "unsafe";
  if (
    progression.unresolvedMimics.length ||
    progression.steps.some((step) => step.risk === "weak")
  )
    return "review";
  return "coherent";
}

function reasoningVerdict(
  card: CaseReasoningCardViewModel | undefined,
  comparisons: DiagnosticComparison[],
): CaseReviewPacketViewModel["reasoning"]["verdict"] {
  if (!card || comparisons.length === 0) return "unassessed";
  if (
    card.quality === "blocked" ||
    comparisons.some((item) => item.verdict === "unsafe_to_teach")
  )
    return "unsafe";
  if (
    card.quality === "watch" ||
    comparisons.some((item) => item.confidence === "weak")
  )
    return "review";
  return "defensible";
}

function evidenceVerdict(
  evidence: KnowledgeEvidenceRelationship[],
  claims: KnowledgeUnsupportedClaim[],
): CaseReviewPacketViewModel["explanation"]["evidenceVerdict"] {
  if (!evidence.length) return "unassessed";
  if (
    claims.some(
      (item) =>
        item.blocksPublication &&
        item.evidenceIds.some((id) =>
          evidence.some((relationship) => relationship.id === id),
        ),
    )
  )
    return "unsafe";
  if (evidence.some((item) => item.isLowTrust || !item.isActive))
    return "review";
  return "supported";
}

function mapEvidence(item: KnowledgeEvidenceRelationship) {
  return {
    id: item.id,
    label: item.label,
    status: item.status,
    trust: item.trust,
    strength: item.strength,
    reasoningSummary: item.reasoningSummary,
  };
}

function mapUnsupportedClaim(item: KnowledgeUnsupportedClaim) {
  return {
    id: item.id,
    claim: item.claimText,
    severity: item.severity,
    evidenceIds: item.evidenceIds,
    attribution: "diagnosis_unattributed" as const,
  };
}

function mapAiAudit(audit: AiDraftRevisionAudit) {
  return {
    id: audit.id,
    artifactType: audit.affectedArtifactType,
    actionType: audit.actionType,
    reviewStatus: audit.reviewStatus,
    createdAt: audit.createdAt,
    reviewerUserId: audit.reviewerUserId ?? null,
    decisionAt: audit.decisionAt ?? null,
  };
}

function caseClueDrafts(
  workspace: DiagnosisEditorialWorkspace,
  caseId: string,
) {
  const nested =
    workspace.cases.items.find((item) => item.id === caseId)
      ?.clueRevisionDrafts ?? [];
  return [
    ...(workspace.materializedClueRevisionDrafts ?? []),
    ...nested,
  ].filter((item) => item.caseId === caseId);
}

function isPendingAiAudit(audit: AiDraftRevisionAudit) {
  return isPendingStatus(audit.reviewStatus);
}

function isPendingStatus(status: string) {
  return [
    "DRAFT",
    "REVIEW_REQUIRED",
    "PENDING_REVIEW",
    "NEEDS_CHANGES",
  ].includes(status);
}

function dedupeIssues(issues: CaseReviewPacketIssue[]) {
  const seen = new Set<string>();
  return issues.filter((item) => {
    const key = `${item.severity}:${item.domain}:${item.title}:${item.detail}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : null;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
