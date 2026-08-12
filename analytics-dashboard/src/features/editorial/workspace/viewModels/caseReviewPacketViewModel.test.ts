/// <reference types="node" />

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  DiagnosisEditorialWorkspace,
  EditorialCaseDetail,
} from "../../../../api/admin.types.ts";
import type { EditorialWorkflowViewModel } from "./editorialWorkflowViewModel.ts";
import { buildCaseReviewPacketViewModel } from "./caseReviewPacketViewModel.ts";

describe("buildCaseReviewPacketViewModel", () => {
  it("makes a mature reviewed case approvable from one packet", () => {
    const packet = buildCaseReviewPacketViewModel({
      caseDetail: matureCase(),
      workspace: workspace(),
      workflow: workflow(),
    });

    assert.equal(packet.identity.caseId, "case-1");
    assert.equal(packet.state.revisionNumber, 3);
    assert.equal(packet.clinicalContent.clueCoherence.verdict, "coherent");
    assert.equal(packet.reasoning.verdict, "defensible");
    assert.equal(packet.differentials.unassessed.length, 0);
    assert.equal(packet.explanation.evidenceVerdict, "supported");
    assert.equal(packet.education.completeness, "complete");
    assert.equal(packet.governance.blockers.length, 0);
    assert.equal(packet.decision.canApproveNow, true);
    assert.equal(packet.decision.verdict, "approve");
    assert.equal(packet.decision.nextAction.id, "case.approve");
  });

  it("refuses approval when a sparse case lacks review-critical data", () => {
    const sparse = {
      ...matureCase(),
      editorialStatus: "DRAFT",
      currentRevisionId: null,
      currentRevision: null,
      clues: null,
      explanation: null,
      validationRuns: [],
    } as EditorialCaseDetail;
    const sparseWorkspace = workspace({
      education: {
        ...workspace().education,
        status: "missing",
      },
      caseLearningGoalCoverage: [],
    });

    const packet = buildCaseReviewPacketViewModel({
      caseDetail: sparse,
      workspace: sparseWorkspace,
    });

    assert.equal(packet.decision.canApproveNow, false);
    assert.equal(packet.decision.verdict, "insufficient_data");
    assert.ok(packet.governance.dataGaps.length >= 4);
    assert.ok(
      packet.governance.blockers.some(
        (item) => item.title === "Explanation is missing",
      ),
    );
    assert.ok(
      packet.governance.blockers.some(
        (item) => item.title === "Learner education is missing",
      ),
    );
  });

  it("blocks a reasoning-poor case with early leakage and unsafe mimic separation", () => {
    const poorWorkflow = workflow({
      caseQuality: "blocked",
      leakRisk: true,
      unresolvedMimics: ["Migraine"],
      comparisonVerdict: "unsafe_to_teach",
      comparisonConfidence: "weak",
    });

    const packet = buildCaseReviewPacketViewModel({
      caseDetail: matureCase(),
      workspace: workspace(),
      workflow: poorWorkflow,
    });

    assert.equal(packet.clinicalContent.clueCoherence.verdict, "unsafe");
    assert.equal(packet.reasoning.verdict, "unsafe");
    assert.equal(packet.decision.canApproveNow, false);
    assert.equal(packet.decision.verdict, "changes_required");
    assert.ok(
      packet.governance.blockers.some(
        (item) => item.title === "Diagnosis is revealed too early",
      ),
    );
    assert.equal(packet.decision.nextAction.id, "case.requestChanges");
  });

  it("surfaces AI contribution and requires human review before approval", () => {
    const aiWorkspace = workspace({
      aiDraftAuditTrail: [
        {
          id: "audit-1",
          caseId: "case-1",
          actionType: "GENERATE_CLUE_REVISION",
          sourceIssue: { reason: "weak clue" },
          generatedOutput: { revisedClue: "Generated revision" },
          editorDecision: null,
          affectedArtifactType: "CASE_CLUE",
          affectedArtifactId: "case-1:clue-1",
          reviewStatus: "PENDING_REVIEW",
          createdByUserId: null,
          createdAt: "2026-07-01T00:00:00.000Z",
        },
      ],
    });

    const packet = buildCaseReviewPacketViewModel({
      caseDetail: matureCase(),
      workspace: aiWorkspace,
      workflow: workflow(),
    });

    assert.equal(packet.aiContribution.hasAiGeneratedContent, true);
    assert.equal(packet.aiContribution.pendingHumanReview, true);
    assert.equal(packet.aiContribution.audits.length, 1);
    assert.equal(packet.decision.canApproveNow, false);
    assert.equal(packet.decision.verdict, "changes_required");
    assert.equal(packet.decision.nextAction.id, "case.reviewAiDrafts");
  });
});

function matureCase(): EditorialCaseDetail {
  return {
    id: "case-1",
    title: "Thunderclap headache case",
    date: "2099-01-01T12:00:00.000Z",
    difficulty: "intermediate",
    history: "A patient develops a sudden severe headache.",
    symptoms: ["Sudden severe headache"],
    labs: null,
    clues: [
      { order: 0, type: "history", value: "Sudden severe headache." },
      { order: 1, type: "imaging", value: "CT shows subarachnoid blood." },
    ],
    explanation: {
      diagnosis: "Subarachnoid Hemorrhage",
      summary: "Thunderclap onset and CT findings establish the diagnosis.",
      reasoning: [
        "The onset is maximal immediately.",
        "CT confirms hemorrhage.",
      ],
      keyFindings: ["Thunderclap headache", "Subarachnoid blood on CT"],
    },
    differentials: ["Migraine"],
    linkedDifferentials: [],
    diagnosisId: "legacy-dx-1",
    diagnosisRegistryId: "dx-1",
    proposedDiagnosisText: "Subarachnoid Hemorrhage",
    diagnosisMappingStatus: "MATCHED",
    diagnosisMappingMethod: "EDITOR_SELECTED",
    diagnosisMappingConfidence: 1,
    diagnosisEditorialNote: null,
    diagnosisRegistrySummary: {
      id: "dx-1",
      displayLabel: "Subarachnoid Hemorrhage",
      canonicalName: "subarachnoid hemorrhage",
      canonicalNormalized: "subarachnoid hemorrhage",
      status: "ACTIVE",
      active: true,
      isPlayable: true,
      isGeneratable: true,
      category: "Cerebrovascular Disease",
      specialty: "Neurology",
    },
    diagnosisPublishReadiness: { ready: true },
    editorialStatus: "REVIEW",
    approvedAt: null,
    approvedByUserId: null,
    currentRevisionId: "revision-3",
    diagnosis: null,
    currentRevision: {
      id: "revision-3",
      revisionNumber: 3,
      source: "MANUAL",
      createdAt: "2026-07-01T00:00:00.000Z",
    },
    validationRuns: [
      {
        id: "validation-1",
        revisionId: "revision-3",
        source: "MANUAL",
        outcome: "PASSED",
        validatorVersion: "test-v1",
        summary: {},
        findings: { issues: [] },
        startedAt: "2026-07-01T00:00:00.000Z",
        completedAt: "2026-07-01T00:01:00.000Z",
      },
    ],
    reviews: [],
    qualityProjection: qualityProjection(),
  } as EditorialCaseDetail;
}

function workspace(
  overrides: Partial<DiagnosisEditorialWorkspace> = {},
): DiagnosisEditorialWorkspace {
  const base = {
    diagnosis: {
      id: "dx-1",
      displayLabel: "Subarachnoid Hemorrhage",
    },
    education: {
      id: "education-1",
      status: "published",
      version: 2,
      qualityScore: 0.92,
      sectionHealth: [],
      blockers: [],
      warnings: [],
      updatedAt: "2026-07-01T00:00:00.000Z",
    },
    cases: {
      items: [
        {
          id: "case-1",
          updatedAt: "2026-07-01T00:00:00.000Z",
          qualityProjection: qualityProjection(),
          clueRevisionDrafts: [],
        },
      ],
    },
    caseLearningGoalCoverage: [
      {
        caseId: "case-1",
        caseTitle: "Thunderclap headache case",
        learningGoalId: "goal-1",
        learningGoal: "Separate SAH from migraine",
        coverageStrength: 0.9,
        coveredDiscriminators: ["Thunderclap onset"],
        missingDiscriminators: [],
        coveredMimics: ["Migraine"],
        missingMimics: [],
        evidenceSource: "editorial",
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
    ],
    aiDraftAuditTrail: [],
    materializedClueRevisionDrafts: [],
  } as unknown as DiagnosisEditorialWorkspace;

  return { ...base, ...overrides } as DiagnosisEditorialWorkspace;
}

function workflow(
  options: {
    caseQuality?: "clean" | "watch" | "blocked";
    leakRisk?: boolean;
    unresolvedMimics?: string[];
    comparisonVerdict?:
      | "target_beats_mimic"
      | "not_enough_evidence"
      | "unsafe_to_teach";
    comparisonConfidence?: "strong" | "watch" | "weak";
  } = {},
): EditorialWorkflowViewModel {
  const caseQuality = options.caseQuality ?? "clean";
  const caseCard = {
    id: "case-1",
    title: "Thunderclap headache case",
    status: "REVIEW",
    difficulty: "intermediate",
    quality: caseQuality,
    tone: caseQuality === "blocked" ? "danger" : "success",
    reasoningObjective: "Separate SAH from migraine",
    linkedLearningGoals: ["Separate SAH from migraine"],
    linkedDiscriminators: ["Thunderclap onset"],
    linkedComparisonIds: ["comparison-1"],
    reasoningConfidence: caseQuality === "blocked" ? "weak" : "strong",
    teachingRisks:
      caseQuality === "blocked"
        ? [
            {
              id: "risk-1",
              severity: "blocker",
              title: "Unsafe diagnostic reasoning",
              detail:
                "The case does not safely separate the target from its mimic.",
              caseId: "case-1",
              comparisonId: "comparison-1",
              targetBoard: "diagnosticCases",
            },
          ]
        : [],
    blockerCount: caseQuality === "blocked" ? 1 : 0,
    warningCount: 0,
  };
  const progression = {
    id: "progression-1",
    caseId: "case-1",
    caseTitle: "Thunderclap headache case",
    quality: caseQuality,
    tone: caseQuality === "blocked" ? "danger" : "success",
    leakRisk: options.leakRisk ?? false,
    unresolvedMimics: options.unresolvedMimics ?? [],
    discriminatorTiming: "Introduced after initial ambiguity",
    reviewStatus: "annotated",
    draftCount: 0,
    annotationCount: 1,
    steps: [
      {
        id: "step-0",
        clueIndex: 0,
        clue: "Sudden severe headache.",
        interpretation: "Raises SAH and migraine.",
        risk: "strong",
        rulesOutMimics: [],
        remainingMimics: ["Migraine"],
        discriminatorSignals: [],
        editorialConcern: null,
      },
      {
        id: "step-1",
        clueIndex: 1,
        clue: "CT shows subarachnoid blood.",
        interpretation: "Confirms SAH.",
        risk: "strong",
        rulesOutMimics: ["Migraine"],
        remainingMimics: [],
        discriminatorSignals: ["Subarachnoid blood"],
        editorialConcern: null,
      },
    ],
  };
  const comparison = {
    id: "comparison-1",
    targetDiagnosisId: "dx-1",
    targetDiagnosisName: "Subarachnoid Hemorrhage",
    mimicDiagnosisId: "mimic-1",
    mimicName: "Migraine",
    verdict: options.comparisonVerdict ?? "target_beats_mimic",
    confidence: options.comparisonConfidence ?? "strong",
    whyTargetWins: "Thunderclap onset and CT blood support SAH.",
    sharedConfusion: "Both can cause severe headache.",
    discriminators: [],
    supportingEvidenceRelationshipIds: ["evidence-1"],
    supportingTeachingRelationshipIds: [],
    supportingReasoningPathIds: ["path-1"],
    risks: [],
    source: "teaching_relationship",
  };

  return {
    cases: {
      diagnosticCases: { cases: [caseCard], clueRevisionDrafts: [] },
      clueProgression: { cases: [progression] },
    },
    diagnosticReasoning: { diagnosticComparisons: [comparison] },
    knowledge: {
      cases: {
        caseReasoning: [
          {
            id: "case-1",
            mimicEliminations: [
              {
                mimicName: "Migraine",
                finalStatus: "eliminated",
                discriminatorUsed: "Thunderclap onset",
                eliminationStrength: "strong",
                educationalValue: "high",
                prematureCollapseRisk: false,
                remainingConfusionRisk: false,
              },
            ],
          },
        ],
      },
      evidence: {
        relationships: [
          {
            id: "evidence-1",
            label: "Thunderclap onset supports SAH",
            status: "ACTIVE",
            strength: 0.9,
            trust: "high",
            isActive: true,
            isLowTrust: false,
            reasoningSummary: "Guideline-supported discriminator.",
          },
        ],
        unsupportedClaims: [],
      },
    },
    reviewQueue: { items: [] },
  } as unknown as EditorialWorkflowViewModel;
}

function qualityProjection() {
  const dimension = {
    status: "good" as const,
    score: 0.9,
    warnings: [],
    blockers: [],
    summary: "No concerns.",
  };
  return {
    dimensions: {
      clinicalValidity: dimension,
      differentialPlausibility: dimension,
      teachingAlignment: dimension,
      revealTiming: dimension,
      mimicPersistence: dimension,
      playability: dimension,
      difficultyFit: dimension,
    },
    warnings: [],
    blockers: [],
    sourceSummary: {
      hasValidationRun: true,
      hasValidationFindings: true,
      hasGenerationQuality: false,
      hasTeachingAlignment: true,
    },
  };
}
