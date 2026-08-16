# Editorial Workflow Implementation Plan

Status: planning only. Do not implement from this document without a follow-up implementation task.

This document supersedes the earlier board-first planning direction. The workspace remains inside the existing route:

`/editorial/diagnoses/:diagnosisRegistryId`

The workspace should be organized around editorial workflows, with conceptual boards nested inside those workflows. It should not become a separate app, and it should not treat the conceptual boards as nine equal top-level tabs.

## Core architectural correction: add a true Knowledge Layer

The frontend must not allow Evidence, Differentials, Reasoning Paths, Cases, and Publish to independently interpret graph data.

All graph, evidence, differential, teaching relationship, reasoning path, clue progression, and validation signals should first pass through a single knowledge projection layer:

```txt
workspace/viewModels/
  knowledgeGraphViewModel.ts
```

This Knowledge Layer is the shared semantic source for every workflow. Individual workflows may render different slices of it, but they should not each re-derive clinical graph meaning from raw backend payloads.

### Why this matters

Without a central Knowledge Layer:

- Evidence may treat a candidate relationship as weak support while Reasoning treats it as usable.
- Differentials may interpret mimic separation differently from Cases.
- Publish may count blockers differently from Review Queue.
- The UI can drift into several competing "truths" about the same diagnosis.

With a Knowledge Layer:

- The same relationship status, trust level, mimic-separation state, reasoning readiness, and blocker severity is reused everywhere.
- Workflows become presentation and decision surfaces, not independent inference engines.
- Future backend payload changes are isolated in one mapper.

## Final architectural correction: add a Diagnostic Reasoning Layer

The Knowledge Layer is necessary, but it is not sufficient by itself.

Wardle's true teaching asset is not the technical graph structure:

- evidence relationships
- differential links
- reasoning paths

Wardle's true teaching asset is:

> Why diagnosis A beats diagnosis B.

That educational reasoning must be modeled explicitly above the Knowledge Layer:

```txt
workspace/viewModels/
  diagnosticReasoningViewModel.ts
```

The Diagnostic Reasoning Layer translates normalized knowledge signals into learner-facing and editor-facing reasoning units. Evidence, Differentials, and Reasoning Paths should not present themselves as three separate technical artifacts. They should be composed into diagnostic comparisons, discriminator logic, clue interpretation, and teachable reasoning sequences.

### Layering rule

The frontend reasoning stack should be:

```txt
Backend /full payload
  -> knowledgeGraphViewModel.ts
      -> diagnosticReasoningViewModel.ts
          -> editorialWorkflowViewModel.ts
              -> workflow and board UI
```

Ownership:

- `knowledgeGraphViewModel.ts` answers: "What does the graph know, and how trustworthy is it?"
- `diagnosticReasoningViewModel.ts` answers: "What diagnostic reasoning does this support?"
- `editorialWorkflowViewModel.ts` answers: "What should an editor do next in this workflow?"

Evidence, Differentials, Reasoning Paths, Cases, Content, Review Queue, and Publish should consume diagnostic reasoning outputs when they need educational reasoning. They should not directly assemble "why A beats B" from raw evidence relationships or path records.

### Why this matters

Without a Diagnostic Reasoning Layer:

- Evidence can become a list of relationship rows.
- Differentials can become a list of linked mimics.
- Reasoning Paths can become generation infrastructure.
- Cases can show clue progression without explaining the diagnostic contest.
- Publish can verify graph completeness without verifying whether the diagnosis is actually teachable.

With a Diagnostic Reasoning Layer:

- Editors can review the central teaching claim: why the target diagnosis wins.
- Mimics are evaluated by discriminators, not just linkage status.
- Case clues are judged by how they shift probability between diagnoses.
- Reasoning paths are judged by whether they support teachable clinical reasoning.
- Publication readiness can block on weak diagnostic separation, not only missing technical artifacts.

## 1. Top-level workflow structure

The top-level workspace destinations are editorial workflows:

```txt
Review Queue
  - all pending editorial decisions and blockers

Overview
  - Diagnosis Health

Teaching
  - Curriculum Coverage
  - Teaching Rules

Reasoning
  - Evidence
  - Differentials
  - Reasoning Paths

Cases
  - Diagnostic Cases

Content
  - Education
  - Scoring Systems
  - Mnemonics
  - Recall Prompts

Publish
  - Publication Readiness
```

Each workflow answers one editorial question:

| Workflow | Primary editorial question |
|---|---|
| Review Queue | What is waiting on me? |
| Overview | Can this diagnosis teach safely? |
| Teaching | Does it teach the right things, and is the teaching logic sound? |
| Reasoning | Is the clinical reasoning grounded and discriminating? |
| Cases | Do cases reason correctly? |
| Content | Is learner-facing content accurate, usable, and memorable? |
| Publish | What blocks publication? |

## 2. Existing architecture to preserve

### Route

- Keep `analytics-dashboard/src/features/editorial/EditorialDiagnosisWorkspacePage.tsx`.
- Keep route `/editorial/diagnoses/:diagnosisRegistryId`.
- Keep primary backend read endpoint `GET /admin/diagnosis-workspace/:diagnosisRegistryId/full`.

### Current full workspace payload

The `/full` endpoint is already sufficient for the first workflow-based redesign. It returns the major data needed by the workflows:

- `diagnosis`
- `onboarding`, `onboardingStatus`, `onboardingProgress`, `onboardingRecommendations`
- `lifecycle`, `lifecycleGovernance`
- `workspaceSummary`
- `readinessBreakdown`
- `coverageMatrix`, `coverageGaps`
- `teachingRules`
- `editorialBrief`
- `education`
- `revisions`
- `cases`
- `graph`
- `evidenceGraph`
- `evidenceCoverage`
- `reasoningPaths`
- `linkedDifferentials`
- `unsupportedClaimsBySection`
- `learningGoalCoverage`
- `caseLearningGoalCoverage`
- `caseEscalationCoverage`
- `escalationCoverage`
- `maturityBreakdown`, `maturityWeighting`, `maturityExplanation`
- `editorialPrioritization`
- `aiDraftAuditTrail`
- `discriminatorDraftReviews`
- `materializedClueRevisionDrafts`
- `editorialLearning`

Do not add backend endpoints unless a workflow cannot be powered by `/full` or an existing secondary endpoint.

## 3. Knowledge Layer design

Create:

```txt
workspace/viewModels/knowledgeGraphViewModel.ts
```

This mapper should convert the relevant backend payload into a normalized knowledge model used by every workflow.

Suggested output shape:

```ts
type KnowledgeGraphViewModel = {
  diagnosis: {
    id: string;
    name: string;
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
```

The exact type names can change during implementation, but the ownership rule should not:

> Raw graph and reasoning payloads are interpreted once in `knowledgeGraphViewModel.ts`; workflows render that interpretation.

### Inputs

The Knowledge Layer should consume:

- `workspace.evidenceGraph`
- `workspace.evidenceCoverage`
- `workspace.graph`
- `workspace.linkedDifferentials`
- `workspace.reasoningPaths`
- `workspace.cases`
- `workspace.unsupportedClaimsBySection`
- `workspace.discriminatorDraftReviews`
- `workspace.materializedClueRevisionDrafts`
- `workspace.coverageMatrix`
- `workspace.coverageGaps`
- `workspace.readinessBreakdown`
- `workspace.lifecycleGovernance`
- `workspace.editorialPrioritization`

### Outputs reused by workflows

| Workflow | Knowledge Layer slices |
|---|---|
| Review Queue | `reviewItems`, `blockers`, pending candidates/drafts/claims |
| Overview | aggregate safety, blocker, evidence, case, education signals |
| Teaching | coverage support, rule support, missing teaching evidence |
| Reasoning | evidence, differentials, reasoning paths, discriminator gaps |
| Cases | case reasoning, clue progression, mimic persistence, drafts |
| Content | unsupported claims, accepted repairs, evidence support by section |
| Publish | blockers, lifecycle issues, unsupported claims, case/evidence readiness |

## 4. Diagnostic Reasoning Layer design

Create:

```txt
workspace/viewModels/diagnosticReasoningViewModel.ts
```

This mapper should consume `KnowledgeGraphViewModel` and produce educational reasoning structures. It should not read raw graph payloads except through the Knowledge Layer.

Suggested output shape:

```ts
type DiagnosticReasoningViewModel = {
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
```

The exact type names can change during implementation. The ownership rule should not:

> `diagnosticReasoningViewModel.ts` owns the educational interpretation of why the target diagnosis beats its mimics.

### Core concepts

The layer should model these concepts directly:

| Concept | Meaning |
|---|---|
| Core diagnostic claim | The short reason this diagnosis is the best answer. |
| Diagnostic comparison | Why target diagnosis A beats mimic diagnosis B. |
| Discriminator | A clue, finding, or mechanism that separates target from mimic. |
| Clue interpretation | How a clue changes the reasoning state, including what it rules in or out. |
| Reasoning narrative | A teachable sequence from presentation to diagnosis. |
| Case reasoning check | Whether a case demonstrates the intended comparison without premature lock-in. |
| Teaching risk | A risk that the learner may infer the wrong diagnosis, mechanism, or discriminator. |
| Publication reasoning blocker | A blocker that makes the diagnosis unsafe or weak to teach even if graph objects exist. |

### Inputs

The Diagnostic Reasoning Layer should consume:

- `knowledge.diagnosis`
- `knowledge.evidence`
- `knowledge.differentials`
- `knowledge.reasoning`
- `knowledge.cases`
- `knowledge.blockers`
- `knowledge.reviewItems`

It may also consume non-graph workspace fields through the workflow mapper when needed for presentation, but it should not independently parse raw evidence graph, differential, reasoning path, or case clue payloads.

### Outputs reused by workflows

| Workflow | Diagnostic Reasoning slices |
|---|---|
| Review Queue | reasoning blockers, weak comparisons, unsafe discriminator issues |
| Overview | core diagnostic claim, teachability verdict, top reasoning risks |
| Teaching | expected discriminators, teaching risks, missing reasoning objectives |
| Reasoning | comparisons, discriminator map, reasoning narratives |
| Cases | clue interpretation, case reasoning checks, premature lock-in risks |
| Content | education support for diagnostic comparisons, recall prompt reasoning coverage |
| Publish | publication reasoning blockers and unresolved A-vs-B teaching gaps |

### Non-goals

- Do not duplicate Knowledge Layer normalization.
- Do not become a new backend schema.
- Do not replace evidence, differential, or reasoning path review actions.
- Do not create generated prose only; the layer should expose structured reasoning units that UI components can render, test, and review.

## 5. Workflow view-model strategy

Create:

```txt
workspace/viewModels/editorialWorkflowViewModel.ts
```

This mapper should depend on both:

- `knowledgeGraphViewModel.ts`
- `diagnosticReasoningViewModel.ts`

Target output:

```ts
{
  reviewQueue,
  overview: {
    diagnosisHealth
  },
  teaching: {
    curriculumCoverage,
    teachingRules
  },
  reasoning: {
    evidence,
    differentials,
    reasoningPaths
  },
  cases: {
    diagnosticCases
  },
  content: {
    education,
    scoringSystems,
    mnemonics,
    recallPrompts
  },
  publish: {
    publicationReadiness
  }
}
```

Rules:

- `editorialWorkflowViewModel.ts` may combine raw workspace fields with the Knowledge Layer and Diagnostic Reasoning Layer.
- It should not reinterpret graph semantics already owned by `knowledgeGraphViewModel.ts`.
- It should not build "why diagnosis A beats diagnosis B" reasoning already owned by `diagnosticReasoningViewModel.ts`.
- Workflow and board components should render these view models, not raw `DiagnosisEditorialWorkspace`.
- Raw records may be attached only where action handlers need IDs.

Suggested workflow IDs:

```ts
type WorkspaceWorkflowId =
  | 'reviewQueue'
  | 'overview'
  | 'teaching'
  | 'reasoning'
  | 'cases'
  | 'content'
  | 'publish';
```

Suggested conceptual board IDs:

```ts
type WorkspaceBoardId =
  | 'diagnosisHealth'
  | 'curriculumCoverage'
  | 'teachingRules'
  | 'evidence'
  | 'differentials'
  | 'reasoningPaths'
  | 'diagnosticCases'
  | 'education'
  | 'scoringSystems'
  | 'mnemonics'
  | 'recallPrompts'
  | 'publicationReadiness';
```

## 6. Workflow capability map

### Review Queue

Purpose: all pending editorial decisions and blockers.

Powered by:

- Knowledge Layer `reviewItems`
- Knowledge Layer `blockers`
- Diagnostic Reasoning Layer reasoning blockers and weak A-vs-B comparisons
- `readinessBreakdown`
- `editorialPrioritization`
- `aiDraftAuditTrail`
- `discriminatorDraftReviews`
- `materializedClueRevisionDrafts`
- `unsupportedClaimsBySection`
- lifecycle governance issues

Missing backend data:

- No single backend-ranked queue. Build client-side from `/full` for v1.

Backend work required:

- None for v1.

### Overview

Nested board:

- Diagnosis Health

Powered by:

- Knowledge Layer aggregate safety signals
- Diagnostic Reasoning Layer core diagnostic claim
- Diagnostic Reasoning Layer top teaching risks
- `diagnosis`
- `workspaceSummary`
- `lifecycle`
- `maturityBreakdown`
- `cases.summary`
- `education`
- `graph`

Backend work required:

- None for v1.

### Teaching

Nested boards:

- Curriculum Coverage
- Teaching Rules

Powered by:

- `coverageMatrix`
- `coverageGaps`
- `teachingRules`
- `editorialBrief`
- `learningGoalCoverage`
- `caseLearningGoalCoverage`
- Knowledge Layer support/gap signals
- Diagnostic Reasoning Layer expected discriminators and missing reasoning objectives

Backend work required:

- None for v1.
- Later: explicit `teachingRuleSupport` projection if inferred support becomes too weak.

### Reasoning

Nested boards:

- Evidence
- Differentials
- Reasoning Paths

Powered by:

- Diagnostic Reasoning Layer diagnostic comparisons
- Diagnostic Reasoning Layer discriminator map
- Diagnostic Reasoning Layer reasoning narratives
- Diagnostic Reasoning Layer teaching risks
- Knowledge Layer `evidence`, `differentials`, and `reasoning` as supporting normalized facts
- `reasoningPaths`, `evidenceGraph`, `evidenceCoverage`, and `linkedDifferentials` only as existing action/detail records after interpretation
- existing secondary endpoints for details/generation context

Backend work required:

- None for v1.

Important constraint:

- Do not center Reasoning on legacy `/admin/diagnosis-graph/candidates/*` routes. Candidates are review items; the reasoning model should come from evidence relationships, teaching relationships, differential links, reasoning paths, clue progression, and validation.
- Do not present Evidence, Differentials, and Reasoning Paths as unrelated technical panels. The Reasoning workflow must make the diagnostic comparison explicit: why the target diagnosis beats each relevant mimic.

### Cases

Nested board:

- Diagnostic Cases

Powered by:

- Knowledge Layer `cases`
- Diagnostic Reasoning Layer clue interpretation
- Diagnostic Reasoning Layer case reasoning checks
- Diagnostic Reasoning Layer premature lock-in and unresolved mimic risks
- `cases.summary`
- `cases.items`
- `learningGoalCoverage`
- `caseLearningGoalCoverage`
- `caseEscalationCoverage`
- `escalationCoverage`

Backend work required:

- None for v1.

### Content

Nested boards:

- Education
- Scoring Systems
- Mnemonics
- Recall Prompts

Powered by:

- `education`
- `revisions`
- `unsupportedClaimsBySection`
- `education.acceptedRepairs`
- Knowledge Layer unsupported claims and evidence support by section
- Diagnostic Reasoning Layer diagnostic comparisons and reasoning narratives for education coverage

Board rules:

- Scoring Systems should contain formal severity/risk/functional classifications.
- Mnemonics are memory aids and must not be treated as scoring systems.
- Recall Prompts should test reasoning and discrimination, not only definitions.
- Education should teach the reasoning contest, not only the definition or symptom list.

Backend work required:

- None for read/review-focused v1.
- Possible later: section-level read/write if inline editing requires it and existing education endpoints are insufficient.

### Publish

Nested board:

- Publication Readiness

Powered by:

- Knowledge Layer blockers
- Diagnostic Reasoning Layer publication reasoning blockers
- Diagnostic Reasoning Layer unresolved A-vs-B teaching gaps
- `readinessBreakdown`
- `workspaceSummary`
- `coverageGaps`
- `lifecycle`
- `lifecycleGovernance`
- `maturityBreakdown`
- `maturityExplanation`
- `editorialPrioritization`

Backend work required:

- None for v1.

## 7. Frontend folder structure

Proposed shape:

```txt
workspace/
  WorkspacePageShell.tsx
  WorkspaceWorkflowRegistry.ts
  WorkspaceWorkflowNav.tsx
  WorkspaceReviewRail.tsx
  WorkspaceHeader.tsx
  workflows/
    ReviewQueueWorkflow.tsx
    OverviewWorkflow.tsx
    TeachingWorkflow.tsx
    ReasoningWorkflow.tsx
    CasesWorkflow.tsx
    ContentWorkflow.tsx
    PublishWorkflow.tsx
  boards/
    DiagnosisHealthBoard.tsx
    CurriculumCoverageBoard.tsx
    TeachingRulesBoard.tsx
    EvidenceBoard.tsx
    DifferentialsBoard.tsx
    ReasoningPathsBoard.tsx
    DiagnosticCasesBoard.tsx
    EducationBoard.tsx
    ScoringSystemsBoard.tsx
    MnemonicsBoard.tsx
    RecallPromptsBoard.tsx
    PublicationReadinessBoard.tsx
  components/
    BoardVerdict.tsx
    BoardEmptyState.tsx
    BoardDecisionCard.tsx
    BoardMetric.tsx
    CoverageGoalRow.tsx
    TeachingRuleBoardCard.tsx
    EvidenceRelationshipCard.tsx
    MimicSeparationCard.tsx
    ReasoningPathCard.tsx
    CaseReasoningCard.tsx
    ClueProgressionTimeline.tsx
    EducationSectionCard.tsx
    PublicationBlockerChecklist.tsx
    ReviewQueueItem.tsx
  viewModels/
    knowledgeGraphViewModel.ts
    diagnosticReasoningViewModel.ts
    editorialWorkflowViewModel.ts
    editorialBoardViewModel.ts
    workflowNavigationViewModel.ts
    reviewQueueViewModel.ts
  actions/
    workspaceActions.ts
    teachingRuleActions.ts
    evidenceActions.ts
    reasoningPathActions.ts
    caseDraftActions.ts
    educationActions.ts
  docs/
    EDITORIAL_WORKFLOW_IMPLEMENTATION_PLAN.md
```

Keep temporarily:

- `tabs/*`
- `workspaceTransforms.ts`
- `workspaceDeepLinks.ts`
- `workspaceSectionNavigation.ts`
- `EditorialPrimitives.tsx`
- `EditorialNarrativePrimitives.tsx`
- `ClaimRepairPanel.tsx`
- `AuditTrailPanel.tsx`

Retire after parity:

- `TabBar`
- `WorkspaceTab` as the primary navigation concept.
- `tabs/*` once workflows and nested boards have absorbed relevant sections.

## 8. Navigation and route plan

Keep route:

`/editorial/diagnoses/:diagnosisRegistryId`

Recommended query param:

- Replace `?tab=` with `?workflow=`.
- Optional nested board selection can use `?board=` or in-page anchors.
- Do not make every conceptual board a top-level route.

Examples:

- `/editorial/diagnoses/:id?workflow=reviewQueue`
- `/editorial/diagnoses/:id?workflow=overview`
- `/editorial/diagnoses/:id?workflow=teaching&board=curriculumCoverage`
- `/editorial/diagnoses/:id?workflow=reasoning&board=differentials`
- `/editorial/diagnoses/:id?workflow=content&board=education`
- `/editorial/diagnoses/:id?workflow=publish`

Legacy mapping:

| Legacy tab | New workflow | Optional board |
|---|---|---|
| `overview` | `overview` | `diagnosisHealth` |
| `editorial-brief` | `teaching` | `curriculumCoverage` |
| `teaching-rules` | `teaching` | `teachingRules` |
| `graph` | `reasoning` | `differentials` by default |
| `cases` | `cases` | `diagnosticCases` |
| `education` | `content` | `education` |
| `integrity` | `publish` | `publicationReadiness` |

## 9. Implementation phases

### Phase 0: Planning and safety

- Keep this document as the source plan.
- Add no runtime behavior changes.
- Agree workflow IDs, board IDs, and query params.

### Phase 1: Knowledge Layer

- Add `knowledgeGraphViewModel.ts`.
- Add tests proving all graph/reasoning/differential/case/publish interpretations flow through it.
- Do not render a new UI yet.

### Phase 2: Diagnostic Reasoning Layer

- Add `diagnosticReasoningViewModel.ts`.
- Consume `knowledgeGraphViewModel.ts`; do not parse raw graph payloads directly.
- Model the core diagnostic claim, A-vs-B comparisons, discriminators, clue interpretation, reasoning narratives, case reasoning checks, teaching risks, and publication reasoning blockers.
- Add tests proving Evidence, Differentials, Reasoning Paths, Cases, Content, Publish, and Review Queue can consume shared diagnostic reasoning.
- Do not render a new UI yet.

### Phase 3: Workflow shell behind existing data

- Add `WorkspacePageShell`.
- Add `WorkspaceWorkflowRegistry`.
- Add `WorkspaceWorkflowNav`.
- Add `WorkspaceReviewRail`.
- Add `editorialWorkflowViewModel.ts`.
- Wire `editorialWorkflowViewModel.ts` to consume both Knowledge and Diagnostic Reasoning view models.
- Keep existing tab components available.
- Render using `/full`.
- Do not change mutations yet.

### Phase 4: First workflows

Recommended order:

1. Review Queue
2. Overview
3. Publish

Reason: these depend most on centralized prioritization, blocker interpretation, and diagnostic teachability checks, so they validate both the Knowledge Layer and Diagnostic Reasoning Layer early.

### Phase 5: Teaching, Cases, and Content

Migrate:

1. Teaching
2. Cases
3. Content

Special Content rule:

- Split Education, Scoring Systems, Mnemonics, and Recall Prompts into separate nested boards.
- Ensure Recall Prompts test diagnostic comparisons, not only memorized facts.

### Phase 6: Reasoning

Split current graph functionality into:

- Evidence
- Differentials
- Reasoning Paths

All three must consume Diagnostic Reasoning outputs for educational meaning and Knowledge Layer outputs for normalized support. They must not reinterpret raw graph payloads or present technical artifacts as the final teaching object.

### Phase 7: Actions and cleanup

- Move page-level handlers into `workspace/actions/*`.
- Keep `EditorialDiagnosisWorkspacePage.tsx` thin:
  - read route params
  - load `/full`
  - construct knowledge, diagnostic reasoning, and workflow view models
  - provide action dispatcher
  - render shell
- Remove `TabBar` after workflow parity.
- Retire legacy `tabs/*` after workflow parity.
- Keep legacy deep-link compatibility for at least one release.

## 10. Tests to add

Frontend unit tests:

- `knowledgeGraphViewModel.test.ts`
  - normalizes evidence relationships once.
  - normalizes differential/mimic separation once.
  - normalizes reasoning path readiness once.
  - normalizes clue progression and mimic persistence once.
  - produces blocker/review item severities reused by workflows.
  - prevents workflows from needing raw graph interpretation.
- `diagnosticReasoningViewModel.test.ts`
  - consumes `knowledgeGraphViewModel` rather than raw graph payloads.
  - produces a core diagnostic claim.
  - produces target-vs-mimic diagnostic comparisons.
  - maps discriminators to the comparisons they support.
  - maps clue interpretation to rule-in/rule-out reasoning.
  - identifies cases with premature lock-in or unresolved mimic persistence.
  - produces publication reasoning blockers when A-vs-B teaching is weak.
  - keeps evidence relationships, differential links, and reasoning paths as support for diagnostic reasoning rather than final UI meaning.
- `editorialWorkflowViewModel.test.ts`
  - maps `/full` payload to all seven workflow keys.
  - maps all conceptual boards under the correct workflows.
  - consumes `knowledgeGraphViewModel`.
  - consumes `diagnosticReasoningViewModel`.
  - maps legacy `targetTab` to `targetWorkflow` and optional `targetBoard`.
  - ranks Review Queue blockers before warnings.
  - handles empty/new diagnosis states.
  - separates Scoring Systems, Mnemonics, and Recall Prompts in Content.

Frontend component tests:

- Workflow nav selects the right workflow and updates query params.
- Nested board selection stays within a workflow.
- Legacy `?tab=` links map to correct workflow/board.
- Review Queue renders all pending decision types.
- Review rail reflects active workflow and global review queue.
- Reasoning boards render diagnostic comparisons, discriminators, and reasoning narratives, not raw graph interpretations.
- Evidence, Differentials, and Reasoning Paths can still expose technical detail, but only as supporting evidence under the diagnostic reasoning frame.

Backend tests:

- No immediate backend tests required for workflow-only frontend migration.
- Add backend tests only if `/full` projection is expanded.

## 11. Risks and constraints

- Do not introduce a separate app.
- Do not move away from `/editorial/diagnoses/:diagnosisRegistryId`.
- Do not make conceptual boards equal top-level tabs.
- Do not let Evidence, Differentials, Reasoning Paths, Cases, and Publish independently interpret graph data.
- Do not let Evidence, Differentials, or Reasoning Paths become the final educational object. The final reasoning object is why diagnosis A beats diagnosis B.
- Do not bypass `diagnosticReasoningViewModel.ts` when rendering diagnostic comparisons, clue interpretation, mimic separation, or publication reasoning blockers.
- Do not add backend endpoints unless a workflow cannot be powered by `/full` or existing endpoints.
- Do not loosen editorial governance or publishing gates.
- Do not make legacy graph candidates the primary workspace model.
- Avoid copying the mockup code directly; use its information architecture, workflow questions, responsive patterns, and editorial voice.

## 12. Smallest safe implementation path

The smallest safe production path is:

1. Add and test `knowledgeGraphViewModel.ts`.
2. Add and test `diagnosticReasoningViewModel.ts` so "why diagnosis A beats diagnosis B" is modeled before UI migration.
3. Add workflow registry and workflow view model that consume both Knowledge and Diagnostic Reasoning layers.
4. Render a workflow shell using the same `/full` data.
5. Make Review Queue first-class.
6. Migrate Overview and Publish next to validate blocker consistency and diagnostic teachability checks.
7. Gradually replace tab internals with workflow-native components and nested boards.
8. Keep all existing actions and endpoint calls intact.
9. Add tests around Knowledge Layer normalization, Diagnostic Reasoning composition, workflow mapping, nested board mapping, review queue ranking, and route/deep-link compatibility before removing legacy tab code.

This keeps the redesign inside the existing workspace, preserves backend behavior, prevents competing frontend interpretations of graph truth, and makes diagnostic comparison the explicit teaching asset.
