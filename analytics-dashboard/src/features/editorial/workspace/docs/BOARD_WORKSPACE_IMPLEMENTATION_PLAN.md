# Editorial Workspace Workflow Implementation Plan

Status: planning only. Do not implement from this document without a follow-up implementation task.

This plan converts the existing editorial diagnosis workspace into a board-informed editorial operating system inside the existing route:

`/editorial/diagnoses/:diagnosisRegistryId`

Important architecture decision: the workspace should be organized around editorial workflows, not nine equal top-level boards.

The nine conceptual boards still exist, but they are nested under seven workflow destinations:

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

The design artifact is UX direction, not code to paste directly. This is not a separate app. The modern source of truth should remain the existing diagnosis workspace read model plus the evidence graph, teaching relationship, reasoning path, differential, clue progression, validation, targeted generation, education, and lifecycle governance services already present in the backend.

## 1. Current workspace architecture summary

### Route

- Current frontend route target: `analytics-dashboard/src/features/editorial/EditorialDiagnosisWorkspacePage.tsx`.
- Current backend primary read endpoint: `GET /admin/diagnosis-workspace/:diagnosisRegistryId/full`.
- Existing page behavior already assumes the workspace lives under a diagnosis registry ID and loads a single diagnosis workspace payload.
- Current deep-linking is tab-based through `?tab=...` plus hash section navigation.

Keep the route. The implementation should evolve the in-route information architecture.

### Current page/component structure

Current high-level page:

- `EditorialDiagnosisWorkspacePage.tsx`
  - Loads auth/access state.
  - Loads the full workspace payload.
  - Owns action handlers and refresh behavior.
  - Owns the legacy tab router.
  - Renders:
    - `WorkspaceHeader`
    - `TabBar`
    - tab components
    - `EditorialRightRail`
    - `TeachingRuleDrawer`

Current workspace folder:

- `workspace/WorkspaceHeader.tsx`
- `workspace/EditorialRightRail.tsx`
- `workspace/EditorialPrimitives.tsx`
- `workspace/EditorialNarrativePrimitives.tsx`
- `workspace/CoveragePanels.tsx`
- `workspace/ClaimRepairPanel.tsx`
- `workspace/AuditTrailPanel.tsx`
- `workspace/workspaceTypes.ts`
- `workspace/workspaceTransforms.ts`
- `workspace/workspaceDeepLinks.ts`
- `workspace/workspaceSectionNavigation.ts`
- `workspace/viewModels/editorialWorkspaceViewModel.ts`
- `workspace/tabs/OverviewTab.tsx`
- `workspace/tabs/ObjectivesTab.tsx`
- `workspace/tabs/ClinicalPictureTab.tsx`
- `workspace/tabs/TeachingLearningTab.tsx`
- `workspace/tabs/DifferentialMapTab.tsx`
- `workspace/tabs/CasesTab.tsx`
- `workspace/tabs/IntegrityTab.tsx`

### Current data loading

Primary load:

- `getDiagnosisEditorialWorkspace(client, diagnosisRegistryId)`
- `GET /admin/diagnosis-workspace/:diagnosisRegistryId/full`

Secondary/conditional loads:

- `getDiagnosisEditorialBrief(...)` when the Objectives tab is opened.
- Education revision comparison through `compareDiagnosisEducationRevisions(...)`.

The `/full` payload is already a composite read model. `DiagnosisEditorialWorkspaceService.getFullWorkspace()` loads, composes, and returns:

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

Conclusion: `/full` is sufficient for the first workflow-based redesign. Do not add backend endpoints unless a workflow cannot be powered by `/full` or by existing secondary endpoints.

### Current mutation/action structure

Current page-level action handlers call existing admin API helpers and refresh `/full` afterward.

Relevant action families already wired in `EditorialDiagnosisWorkspacePage.tsx` and `analytics-dashboard/src/api/admin.ts`:

- Lifecycle governance:
  - `updateDiagnosisRegistryLifecycle`
  - `normalizeDiagnosisRegistryLifecycleRow`
- Teaching rules:
  - `generateDiagnosisTeachingRuleCandidates`
  - `seedLegacyDiagnosisTeachingRules`
  - `createDiagnosisTeachingRule`
  - `updateDiagnosisTeachingRule`
  - `reviewDiagnosisTeachingRule`
- Editorial brief/objectives:
  - `getDiagnosisEditorialBrief`
  - `generateDiagnosisEditorialBrief`
  - `createDiagnosisEditorialBrief`
  - `updateDiagnosisEditorialBrief`
  - `reviewDiagnosisEditorialBrief`
- Targeted cases:
  - `generateTargetedDiagnosisCase`
  - `generateCaseFromUncoveredGoal`
  - `generateTargetedDiscriminatorCaseDraft`
- Clue revision and discriminator repair:
  - `generateClueRevisionProposalDraft`
  - `updateCaseClueRevisionDraft`
  - `approveCaseClueRevisionDraft`
  - `rejectCaseClueRevisionDraft`
  - `requestChangesForCaseClueRevisionDraft`
  - `supersedeCaseClueRevisionDraft`
  - `applyCaseClueRevisionDraft`
- Claim repair:
  - `repairUnsupportedClaimDraft`
  - `decideAiDraftRevision`
- Learning-goal and escalation coverage:
  - `createCaseLearningGoalCoverage`
  - `updateCaseLearningGoalCoverage`
  - `deleteCaseLearningGoalCoverage`
  - `createCaseEscalationAnnotation`
  - `updateCaseEscalationAnnotation`
  - `deleteCaseEscalationAnnotation`
- Clue discriminator annotations:
  - `createCaseDiscriminatorAnnotation`
  - `updateCaseDiscriminatorAnnotation`
  - `deleteCaseDiscriminatorAnnotation`
- Education:
  - `regenerateDiagnosisEducationSection`
  - education revision comparison
- Evidence graph / teaching relationship / reasoning path actions exist in `admin.ts`, and much of this is currently concentrated inside `DifferentialMapTab`.

### Current tab structure

Current tabs are domain/legacy workflow tabs:

| Current tab | Current label | Primary component | Main concern |
|---|---|---|---|
| `overview` | Overview | `OverviewTab` | Publication readiness narrative, health, governance |
| `editorial-brief` | Objectives | `ObjectivesTab` | Editorial brief and learning goals |
| `education` | Clinical Picture | `ClinicalPictureTab` | Education/content sections |
| `teaching-rules` | Teaching & Learning | `TeachingLearningTab` | Teaching rules and coverage matrix |
| `graph` | Differential Map | `DifferentialMapTab` | Evidence graph, differentials, teaching relationships, reasoning paths |
| `cases` | Cases | `CasesTab` | Case inventory, clues, progression, drafts |
| `integrity` | Integrity | `IntegrityTab` | Unsupported claims, audits, revisions, governance/validation |

The replacement should be workflow-based:

| New top-level workflow | Purpose | Nested conceptual boards |
|---|---|---|
| Review Queue | “What needs my decision now?” | all blockers, pending reviews, draft decisions |
| Overview | “Can this diagnosis teach safely?” | Diagnosis Health |
| Teaching | “Does it teach the right things, with sound rules?” | Curriculum Coverage, Teaching Rules |
| Reasoning | “Is the clinical reasoning grounded and discriminating?” | Evidence, Differentials, Reasoning Paths |
| Cases | “Do cases reason correctly?” | Diagnostic Cases |
| Content | “Is learner-facing content accurate and memorable?” | Education, Scoring Systems, Mnemonics, Recall Prompts |
| Publish | “What blocks publication?” | Publication Readiness |

## 2. Preferred workflow architecture

### Top-level workflow principles

- Top-level navigation should reflect what editors are doing, not the database object they are inspecting.
- The nine conceptual boards are still useful, but they should be board modules inside workflow destinations.
- Each workflow should answer a primary editorial question.
- Each nested board should expose a verdict, blockers, supporting evidence, and local actions.
- The right rail should become a workflow-aware review rail rather than a static diagnostic side panel.

### Workflow questions

| Workflow | Primary editorial question |
|---|---|
| Review Queue | “What is waiting on me?” |
| Overview | “Can this diagnosis teach safely?” |
| Teaching | “Does it teach the right things, and is the teaching logic sound?” |
| Reasoning | “Is the evidence defensible, does it separate mimics, and is generation grounded?” |
| Cases | “Do cases reason correctly?” |
| Content | “Is the learner-facing content accurate, usable, and memorable?” |
| Publish | “What blocks publication?” |

## 3. Backend capability map by workflow

### Workflow 1: Review Queue

Question: “What is waiting on me?”

Can be powered from `/full`: yes.

Primary `/full` fields:

- `readinessBreakdown`
- `workspaceSummary.blockers`
- `workspaceSummary.warnings`
- `coverageGaps`
- `editorialPrioritization`
- `unsupportedClaimsBySection`
- `aiDraftAuditTrail`
- `discriminatorDraftReviews`
- `materializedClueRevisionDrafts`
- `graph.candidates`
- `graph.teachingRelationships`
- `evidenceGraph.relationships`
- `reasoningPaths`
- `lifecycleGovernance`
- `cases.items`
- `education.sectionHealth`

Useful existing secondary endpoints:

- Existing review endpoints for evidence relationships, teaching relationships, reasoning paths, AI drafts, clue revision drafts, lifecycle actions, claim repair, teaching rules, and education.

Missing data:

- No single backend-native “review queue” object ranked across all artifact types. The frontend can build one from `/full`.
- Current readiness items target legacy tabs, not workflow IDs.

New backend work required:

- Not required for v1.
- Later enhancement: expose a backend-ranked `reviewQueue` if client-side ranking becomes inconsistent across pages.

### Workflow 2: Overview

Nested board:

- Diagnosis Health

Question: “Can this teach safely?”

Can be powered from `/full`: yes.

Primary `/full` fields:

- `diagnosis`
- `workspaceSummary`
- `readinessBreakdown`
- `lifecycle`
- `lifecycleGovernance`
- `maturityBreakdown`
- `maturityExplanation`
- `editorialPrioritization`
- `cases.summary`
- `education`
- `graph`
- `evidenceCoverage`
- `unsupportedClaimsBySection`

Useful existing secondary endpoints:

- `GET /admin/diagnosis-workspace/:diagnosisRegistryId` for a lighter quality summary if needed.
- Lifecycle action endpoints.

Missing data:

- No backend-native workflow verdict sentence. Compute in the frontend view model.

New backend work required:

- Not required for v1.

### Workflow 3: Teaching

Nested boards:

- Curriculum Coverage
- Teaching Rules

Question: “Does it teach the right things, and is the teaching logic sound?”

Can be powered from `/full`: yes.

Primary `/full` fields:

- `coverageMatrix`
- `coverageGaps`
- `teachingRules.summary`
- `teachingRules.items`
- `editorialBrief`
- `learningGoalCoverage`
- `caseLearningGoalCoverage`
- `caseEscalationCoverage`
- `escalationCoverage`
- `cases`
- `evidenceCoverage`
- `reasoningPaths`
- `graph.teachingRelationships`
- `evidenceGraph.relationships`

Useful existing secondary endpoints:

- `GET /admin/diagnosis-workspace/:diagnosisRegistryId/teaching-units`
- `GET /admin/diagnosis-workspace/:diagnosisRegistryId/editorial-brief`
- `GET /admin/diagnosis-workspace/:diagnosisRegistryId/teaching-rules`
- teaching rule create/update/review/generate endpoints.
- case learning-goal coverage endpoints.
- case escalation annotation endpoints.
- `POST /admin/diagnosis-workspace/:diagnosisRegistryId/draft-actions/generate-case-from-goal`

Missing data:

- Exact “linked cases per rule” may need stronger projection later. V1 can infer from `coverageMatrix`, `learningGoalCoverage`, and case quality.
- Polished editorial explanations per coverage row should be frontend-derived from existing `recommendedAction`, status, and teaching rule metadata.

New backend work required:

- Not required for v1.
- Potential later enhancement: explicit `teachingRuleSupport` projection per rule.

### Workflow 4: Reasoning

Nested boards:

- Evidence
- Differentials
- Reasoning Paths

Question: “Is the clinical reasoning grounded and discriminating?”

Can be powered from `/full`: yes for v1.

Primary `/full` fields:

- `evidenceGraph.summary`
- `evidenceGraph.nodes`
- `evidenceGraph.relationships`
- `evidenceCoverage`
- `graph.candidates`
- `graph.factsSummary`
- `graph.teachingRelationships`
- `workspaceSummary.differentialResolutionSummary`
- `workspaceSummary.differentialCoverage`
- `linkedDifferentials`
- `reasoningPaths`
- `cases.items[].clueProgression`
- `cases.items[].clueDiscriminatorAnnotations`
- `discriminatorDraftReviews`
- `materializedClueRevisionDrafts`
- `unsupportedClaimsBySection`

Useful existing secondary endpoints:

- Evidence graph nodes/relationships/review/generation endpoints.
- `GET /admin/diagnosis-registry/:diagnosisRegistryId/evidence-graph`
- `GET /admin/differential-mappings/unresolved`
- differential mapping resolve/create-candidate endpoints.
- diagnosis teaching relationship generation/review endpoints.
- reasoning path generation/context/review endpoints.
- reasoning draft validation run/list endpoints.
- targeted discriminator case and clue revision endpoints.

Missing data:

- `/full` does not include full unresolved differential mapping rows, only summary-level coverage. Use existing secondary endpoint for drawer/detail views.
- `/full` includes reasoning paths but not generation context. Lazy-load `generation-context` when expanding a path.
- `/full` should not become a global evidence search payload; keep v1 diagnosis-local.

New backend work required:

- Not required for v1.
- Add new backend work only if a Reasoning workflow feature cannot use `/full` plus existing secondary endpoints.

Important constraint:

- Do not center Reasoning on legacy `/admin/diagnosis-graph/candidates/*` routes. Candidates are review items. The main model should be evidence relationships, teaching relationships, differential links, reasoning paths, clue progression, and validation.

### Workflow 5: Cases

Nested board:

- Diagnostic Cases

Question: “Do cases reason correctly?”

Can be powered from `/full`: yes.

Primary `/full` fields:

- `cases.summary`
- `cases.items`
- `cases.items[].qualityProjection`
- `cases.items[].clueProgression`
- `cases.items[].clueDiscriminatorAnnotations`
- `materializedClueRevisionDrafts`
- `discriminatorDraftReviews`
- `learningGoalCoverage`
- `caseLearningGoalCoverage`
- `caseEscalationCoverage`
- `escalationCoverage`

Useful existing secondary endpoints:

- targeted case generation endpoints.
- clue revision draft workflow endpoints.
- case learning-goal coverage endpoints.
- case escalation annotation endpoints.
- case discriminator annotation endpoints.
- case ready-to-publish endpoint where appropriate.

Missing data:

- `/full` is sufficient for case board v1.
- Full case detail can be lazy-loaded through existing case detail endpoints if needed.

New backend work required:

- Not required for v1.

### Workflow 6: Content

Nested boards:

- Education
- Scoring Systems
- Mnemonics
- Recall Prompts

Question: “Is the learner-facing content accurate, usable, and memorable?”

Can be powered from `/full`: mostly yes.

Primary `/full` fields:

- `education`
- `revisions`
- `unsupportedClaimsBySection`
- `aiDraftAuditTrail`
- `education.acceptedRepairs`
- `coverageMatrix`
- `coverageGaps`
- `teachingRules.items`
- `evidenceCoverage`

Useful existing secondary endpoints:

- education generation endpoint.
- education section regeneration endpoint.
- claim repair endpoints.
- education revision comparison endpoint.
- editorial brief endpoints for objective context.

Nested content-specific handling:

- Education: use `education.sectionHealth`, revision quality, unsupported claims, and accepted repairs.
- Scoring Systems: derive from education section health for `scoringSystems`, teaching rule coverage, and unsupported claims mapped to scoring.
- Mnemonics: derive from `examPearls` and section health. Treat mnemonics as memory aids, not scoring systems.
- Recall Prompts: derive from `recallPrompts`, section health, recall quality warnings, and teaching rule coverage.

Missing data:

- `/full` currently returns health and revision quality, not necessarily a full editable education payload.
- If inline editing of section content is required, audit current education endpoints before adding anything new.

New backend work required:

- Not required for read/review-focused v1.
- Possible later: section-level read/write if inline editing becomes required and existing education APIs are insufficient.

### Workflow 7: Publish

Nested board:

- Publication Readiness

Question: “What blocks publication?”

Can be powered from `/full`: yes.

Primary `/full` fields:

- `readinessBreakdown`
- `workspaceSummary.blockers`
- `workspaceSummary.warnings`
- `coverageGaps`
- `lifecycle`
- `lifecycleGovernance`
- `maturityBreakdown`
- `maturityExplanation`
- `editorialPrioritization`
- `unsupportedClaimsBySection`
- `cases.summary`
- `education`
- `graph`
- `evidenceCoverage`

Useful existing secondary endpoints:

- lifecycle action endpoints.
- case ready-to-publish endpoint where appropriate.
- education review/publish endpoints where appropriate.

Missing data:

- Existing readiness items target legacy tabs, not workflow IDs. Remap in frontend view model.

New backend work required:

- Not required for v1.
- Later enhancement: return workflow-native `targetWorkflow` once workflow IDs stabilize.

## 4. Frontend gap map by workflow

### Review Queue

Current matching tab/component:

- `EditorialRightRail`
- parts of `OverviewTab`
- parts of `IntegrityTab`
- `AuditTrailPanel`
- AI draft / clue draft review elements in `CasesTab`

Reusable components:

- readiness breakdown cards
- audit trail
- AI draft decision cards
- clue revision draft cards
- unsupported claim repair cards

Components to retire or split:

- Static right rail should become workflow-aware `WorkspaceReviewRail`.
- Review queue should not be a passive side panel only; it should be a first-class workflow destination.

New components needed:

- `workflows/ReviewQueueWorkflow.tsx`
- `components/ReviewQueueItem.tsx`
- `viewModels/reviewQueueViewModel.ts`

### Overview

Nested board:

- Diagnosis Health

Current matching tab/component:

- `OverviewTab`
- `DiagnosisHealthPanel`
- `WorkspaceHeader`
- `buildEditorialWorkspaceViewModel().diagnosisHealth`

Reusable components:

- `OperatorDashboard`
- `OperatorMetricGrid`
- `IssueSummaryStrip`
- `StatusStrip`
- `EditorialNarrativeThread`
- `WorkspaceHeader`, after visual simplification

Components to retire or downgrade:

- Legacy `OverviewTab` as a tab entry.
- Tab-first `TabBar`.

New components needed:

- `workflows/OverviewWorkflow.tsx`
- `boards/DiagnosisHealthBoard.tsx`
- shared `BoardVerdict`

### Teaching

Nested boards:

- Curriculum Coverage
- Teaching Rules

Current matching tab/component:

- `ObjectivesTab`
- `TeachingLearningTab`
- `CoveragePanels`
- `TeachingRuleDrawer`
- `CoverageMatrixPreview`

Reusable components:

- coverage gap cards
- coverage status blocks
- teaching rule cards/forms
- teaching rule drawer concepts

Components to retire or split:

- `ObjectivesTab` should not remain a top-level destination.
- Legacy “Teaching & Learning” should split into coverage and rule logic boards.

New components needed:

- `workflows/TeachingWorkflow.tsx`
- `boards/CurriculumCoverageBoard.tsx`
- `boards/TeachingRulesBoard.tsx`
- `components/CoverageGoalRow.tsx`
- `components/TeachingRuleBoardCard.tsx`

### Reasoning

Nested boards:

- Evidence
- Differentials
- Reasoning Paths

Current matching tab/component:

- `DifferentialMapTab`
- evidence relationship sections
- linked differential list
- `ReasoningPathsPanel`
- `mimicSurvival.ts`
- clue discriminator annotations in `CasesTab`

Reusable components:

- evidence relationship rows/cards
- graph candidate rows
- differential relationship cards
- mimic survival helpers
- reasoning path cards
- discriminator draft cards

Components to retire or split:

- Legacy “Differential Map” as a catch-all tab.
- Any candidate-first graph UI. Candidates should support evidence/reasoning review, not define the workflow.

New components needed:

- `workflows/ReasoningWorkflow.tsx`
- `boards/EvidenceBoard.tsx`
- `boards/DifferentialsBoard.tsx`
- `boards/ReasoningPathsBoard.tsx`
- `components/EvidenceRelationshipCard.tsx`
- `components/MimicSeparationCard.tsx`
- `components/ReasoningPathCard.tsx`

### Cases

Nested board:

- Diagnostic Cases

Current matching tab/component:

- `CasesTab`
- clue progression panels
- case learning-goal coverage controls
- escalation annotation controls
- discriminator annotation controls
- clue revision draft workflow

Reusable components:

- Most of `CasesTab`, reorganized around the board question.
- `mimicSurvival` and `clinicalRecognition` helpers.

Components to retire or split:

- Case inventory sections that lead with counts rather than editorial meaning should be downgraded.

New components needed:

- `workflows/CasesWorkflow.tsx`
- `boards/DiagnosticCasesBoard.tsx`
- `components/CaseReasoningCard.tsx`
- `components/ClueProgressionTimeline.tsx`

### Content

Nested boards:

- Education
- Scoring Systems
- Mnemonics
- Recall Prompts

Current matching tab/component:

- `ClinicalPictureTab`
- `IntegrityTab` claim repair sections
- `ClaimRepairPanel`
- `AuditTrailPanel`

Reusable components:

- education section health cards
- claim repair panel
- accepted repairs helpers
- revision comparison UI

Components to retire or split:

- “Clinical Picture” should become part of Content, not a top-level tab.
- Unsupported claims should appear in both Content and Publish, but the repair workflow should be shared.

New components needed:

- `workflows/ContentWorkflow.tsx`
- `boards/EducationBoard.tsx`
- `boards/ScoringSystemsBoard.tsx`
- `boards/MnemonicsBoard.tsx`
- `boards/RecallPromptsBoard.tsx`
- `components/EducationSectionCard.tsx`
- `components/EducationClaimRepairQueue.tsx`

### Publish

Nested board:

- Publication Readiness

Current matching tab/component:

- `IntegrityTab`
- lifecycle governance card in `OverviewTab`
- `ReadinessBreakdownCard`
- `EditorialRightRail`

Reusable components:

- readiness breakdown cards
- lifecycle governance controls
- audit trail
- revision timeline

Components to retire or split:

- Current “Integrity” tab should become Publish / Publication Readiness.
- Audit trail should be supporting detail, not the headline.

New components needed:

- `workflows/PublishWorkflow.tsx`
- `boards/PublicationReadinessBoard.tsx`
- `components/PublicationBlockerChecklist.tsx`

## 5. Recommended final folder structure

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
    BOARD_WORKSPACE_IMPLEMENTATION_PLAN.md
```

Keep these existing files temporarily during migration:

- `tabs/*` as source components to harvest/split.
- `workspaceTransforms.ts`
- `workspaceDeepLinks.ts`
- `workspaceSectionNavigation.ts`
- `EditorialPrimitives.tsx`
- `EditorialNarrativePrimitives.tsx`
- `ClaimRepairPanel.tsx`
- `AuditTrailPanel.tsx`

Retire after parity:

- `TabBar`
- `WorkspaceTab` naming as the primary navigation concept.
- `tabs/*` once every workflow and nested board has absorbed relevant sections.

## 6. View-model strategy

Create:

`workspace/viewModels/editorialWorkflowViewModel.ts`

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

Principles:

- Top-level components should render workflow view models, not raw `DiagnosisEditorialWorkspace`.
- Nested boards should render board view models.
- Each workflow should start with:
  - `question`
  - `verdict`
  - `detail`
  - `tone`
  - `primaryAction`
  - `reviewItems`
  - `boards`
- Each board should start with:
  - `question`
  - `verdict`
  - `detail`
  - `tone`
  - `items`
  - `emptyState`
- Keep raw records attached only where action handlers need IDs.
- Convert legacy `targetTab` into new `targetWorkflow` and optional `targetBoard`.
- Keep endpoint use centralized in action modules, not individual workflow or board components.

Suggested mapper responsibilities:

- `reviewQueue`
  - Rank all pending decisions from evidence, teaching, reasoning, cases, education, lifecycle, unsupported claims, AI drafts, clue drafts, and readiness blockers.
- `overview.diagnosisHealth`
  - Derive safe-to-teach verdict from blockers, maturity, lifecycle, cases, education, graph, unsupported claims.
- `teaching.curriculumCoverage`
  - Group coverage by teaching goal, brief learning goals, missing case/evidence/education support.
- `teaching.teachingRules`
  - Group active, weak, candidate, deprecated/rejected rules.
  - Surface rule logic problems and missing graph/case support.
- `reasoning.evidence`
  - Group active/candidate/rejected evidence relationships.
  - Surface low trust, hallucination risk, unsupported claim links.
- `reasoning.differentials`
  - Group linked mimics, unresolved mappings, mimic survival, discriminator drafts.
- `reasoning.reasoningPaths`
  - Group paths by generation purpose and readiness tier.
  - Surface ungrounded or weak paths.
- `cases.diagnosticCases`
  - Group cases by clean/weak/draft/blocking.
  - Surface premature lock-in and unresolved mimic progression.
- `content.education`
  - Group education sections by clean/warning/blocker/missing.
  - Attach unsupported claims and accepted repairs.
- `content.scoringSystems`
  - Extract health and issues from the `scoringSystems` education section and related teaching rules.
  - Keep scoring systems separate from mnemonics.
- `content.mnemonics`
  - Extract mnemonic-like pearls from `examPearls` and flag if they are misplaced under scoring systems.
- `content.recallPrompts`
  - Surface recall prompt quality, gaps, and missing reasoning-oriented prompts.
- `publish.publicationReadiness`
  - Turn `readinessBreakdown`, lifecycle governance, coverage blockers, unsupported claims, case blockers, and audit queue into one checklist.

## 7. Navigation and route plan

Keep route:

`/editorial/diagnoses/:diagnosisRegistryId`

Recommended query param:

- Replace `?tab=` with `?workflow=`.
- Optional nested board selection can use `?board=` or local in-page anchors, but the first implementation should avoid making every board a top-level route.

Recommended URL examples:

- `/editorial/diagnoses/:id?workflow=reviewQueue`
- `/editorial/diagnoses/:id?workflow=overview`
- `/editorial/diagnoses/:id?workflow=teaching&board=curriculumCoverage`
- `/editorial/diagnoses/:id?workflow=reasoning&board=differentials`
- `/editorial/diagnoses/:id?workflow=content&board=education`
- `/editorial/diagnoses/:id?workflow=publish`

Maintain backward compatibility by mapping old `tab` values:

| Legacy tab | New workflow | Optional board |
|---|---|---|
| `overview` | `overview` | `diagnosisHealth` |
| `editorial-brief` | `teaching` | `curriculumCoverage` |
| `teaching-rules` | `teaching` | `teachingRules` |
| `graph` | `reasoning` | `differentials` by default |
| `cases` | `cases` | `diagnosticCases` |
| `education` | `content` | `education` |
| `integrity` | `publish` | `publicationReadiness` |

Do not break existing deep links immediately. Add a compatibility mapper in the workflow navigation layer, then retire old `tab` links later.

## 8. Implementation phases

### Phase 0: Planning and safety

- Keep this document as the source plan.
- Add no runtime behavior changes.
- Agree workflow IDs, nested board IDs, and target query params.

### Phase 1: Workflow shell behind existing data

- Add `WorkspacePageShell`.
- Add `WorkspaceWorkflowRegistry`.
- Add `WorkspaceWorkflowNav`.
- Add `WorkspaceReviewRail`.
- Add `editorialWorkflowViewModel`.
- Keep existing tab components available.
- Render the new workflow shell using `/full`.
- Do not change mutations yet; pass existing handlers through the shell.

### Phase 2: Workflow-by-workflow migration

Recommended order:

1. Review Queue
2. Overview
3. Publish
4. Teaching
5. Cases
6. Content
7. Reasoning

Reason: begin with the workflow surfaces most directly powered by existing projected fields and most valuable for daily editorial operations; defer the Reasoning split until shell, queue, and content patterns are stable.

### Phase 3: Split legacy graph functionality into Reasoning

Move current `DifferentialMapTab` sections into:

- Evidence
- Differentials
- Reasoning Paths

Do not center these boards on legacy `/admin/diagnosis-graph/candidates/*` routes. Candidates should appear as review items within Evidence/Differentials, while modern evidence graph relationships, teaching relationships, reasoning paths, differential links, clue progression, and validation drive the workflow.

### Phase 4: Split Content into section-specific boards

Move current education/content sections into:

- Education
- Scoring Systems
- Mnemonics
- Recall Prompts

Special rule:

- Mnemonics must not be treated as scoring systems.
- Scoring Systems should contain formal severity/risk/functional classifications.
- Recall Prompts should test reasoning and discrimination, not only definitions.

### Phase 5: Actions and review queue

- Move page-level handlers into `workspace/actions/*`.
- Keep `EditorialDiagnosisWorkspacePage.tsx` thin:
  - read route params
  - load `/full`
  - construct workflow view model
  - provide action dispatcher
  - render shell
- Review rail should be workflow-aware and item-aware.
- Review Queue should be a first-class workflow, while the rail provides contextual access from other workflows.

### Phase 6: Clean up legacy tab code

- Delete or archive retired `tabs/*` components only after each workflow has parity.
- Remove `TabBar`.
- Rename tab-centric types to workflow-centric types.
- Keep redirect/deep-link compatibility for at least one release.

## 9. Tests to add

Frontend unit tests:

- `editorialWorkflowViewModel.test.ts`
  - maps `/full` payload to all seven workflow keys.
  - maps all conceptual boards under the correct workflows.
  - maps legacy `targetTab` to `targetWorkflow` and optional `targetBoard`.
  - ranks Review Queue blockers before warnings.
  - handles empty/new diagnosis states.
  - keeps unsupported claims visible in Content and Publish.
  - keeps reasoning paths under Reasoning, not Evidence/Differentials as top-level destinations.
  - separates Scoring Systems, Mnemonics, and Recall Prompts in Content.

Frontend component tests:

- Workflow nav selects the right workflow and updates query params.
- Nested board selection stays within a workflow.
- Legacy `?tab=` links map to correct workflow/board.
- Workflow verdict renders question-first UX.
- Review rail reflects active workflow and global review queue.
- Empty states for no cases, no education, no teaching rules, no evidence, no review items.

Backend tests:

- No immediate backend tests required for workflow-only frontend migration.
- Add backend tests only if `/full` projection is expanded.
- If adding workflow-native projection later, test that every workflow can be populated without relying on legacy graph-candidate routes as the primary model.

## 10. Risks and constraints

- Do not introduce a separate app.
- Do not move away from `/editorial/diagnoses/:diagnosisRegistryId`.
- Do not make the nine conceptual boards equal top-level tabs.
- Do not add backend endpoints unless a workflow cannot be powered by `/full` or existing endpoints.
- Do not loosen editorial governance or publishing gates.
- Do not make legacy graph candidates the primary workspace model.
- Avoid copying the mockup code directly; use its information architecture, board questions, responsive patterns, and editorial voice.
- Keep current safe mutation pathways and refresh behavior until the workflow action layer is tested.

## 11. Smallest safe implementation path

The smallest safe production path is:

1. Add workflow registry and workflow view model.
2. Render a workflow shell using the same `/full` data.
3. Make Review Queue a first-class workflow.
4. Initially have workflows reuse existing tab internals where practical.
5. Gradually replace tab internals with workflow-native components and nested boards.
6. Keep all existing actions and endpoint calls intact.
7. Add tests around workflow mapping, nested board mapping, review queue ranking, and route/deep-link compatibility before removing any legacy tab code.

This keeps the redesign inside the existing workspace, preserves backend behavior, and lets the UX become workflow-based without risking the editorial pipeline.
