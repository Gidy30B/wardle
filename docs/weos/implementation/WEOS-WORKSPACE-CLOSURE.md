# WEOS Workspace Operational Closure

Status: `IMPLEMENTED_FOR_ROUTINE_AI_CLINICAL_CASE_PATH`

Branch: `weos/workspace-closure`

Baseline verified before implementation: `48e5fc5eff01cd26ed9eb991fc8943e51f5d832c`

This document records the operational closure state for the WEOS workspace. It
is implementation evidence, not editorial approval.

## Closed Routine Path

The workspace now exposes the routine AI Clinical Case path as a single
operational surface:

| Step | Workspace state |
| --- | --- |
| Editorial need | Diagnosis workspace readiness, gaps, reasoning, education, and case coverage remain the starting surface. |
| Diagnosis-targeted generation | Existing workspace generation surfaces remain registry-first and generation-readiness gated. |
| Clinical Case Draft | Draft inventory and review packets are visible in the cases board. |
| Human draft review | `caseDraft.accept`, `caseDraft.requestChanges`, and `caseDraft.reject` remain workspace actions. |
| Controlled application | `caseDraft.apply` remains separately confirmation-gated and creates `Case` plus exact `CaseRevision`. |
| CaseRevision review | Applied cases now project exact current revision and open or missing review state in the workspace. |
| APP-006 approval | The review queue exposes `caseRevision.startReview` and confirmation-gated `caseRevision.approve`, using existing APP-006 stale-safe backend commands. |
| APP-008A publication authorization | The publish workflow and review queue expose confirmation-gated `publication.authorizeRevision` only when APP-008A readiness is `READY`. |
| APP-008B scheduled binding | Case cards and the publish workflow surface exact `DailyCase.caseRevisionId` and `publicationDecisionId` binding state. |
| Learner exposure trace | New scheduler-created `DailyCase` rows are visible as exact bindings. APP-008C/D session and attempt provenance remain out of scope and still open. |

## Implementation Evidence

Backend workspace read model:

- `doctordle-backend/src/modules/admin/diagnosis-editorial-workspace.service.ts`
  selects existing `currentRevision`, `CaseReview`,
  `GovernedCaseRevisionApprovalDecision`,
  `CaseRevisionPublicationDecision`, and `DailyCase` identity.
- The same service calls `CasePublicationGovernanceService.getRevisionPublicationReadiness`
  for the current revision when available and projects blockers, warnings,
  material context hash, validation run, approval decision, active publication
  decision, and scheduling state.
- No schema or migration was added.

Dashboard operational surface:

- `analytics-dashboard/src/features/editorial/workspace/viewModels/editorialWorkflowViewModel.ts`
  maps exact CaseRevision review, APP-006 approval, APP-008A authorization,
  and APP-008B waiting state into review queue items.
- `analytics-dashboard/src/features/editorial/workspace/actions/caseRevisionActions.ts`
  reuses `startCaseReview` and `submitCaseReview`.
- `analytics-dashboard/src/features/editorial/workspace/actions/publicationActions.ts`
  posts the APP-008A authorization DTO through `authorizeCaseRevisionPublication`.
- `analytics-dashboard/src/features/editorial/workspace/workflows/PublishWorkflow.tsx`
  includes a governed publication path panel.
- `analytics-dashboard/src/features/editorial/workspace/components/CaseReasoningCard.tsx`
  shows revision, APP-006, APP-008A, and APP-008B status.

## Bypass Inventory

| Surface | Classification | Closure treatment |
| --- | --- | --- |
| Terminal scripts, Prisma, raw database updates | `BYPASS_NOT_ROUTINE` | Not part of the normal governed editor path. No new scripts were added. |
| Seed/repair scripts | `BYPASS_NOT_ROUTINE` | Remain non-routine data operations and were not modified. |
| Legacy `markCaseReadyToPublish` dashboard action | `COMPATIBILITY_SURFACE` | Kept for compatibility, but the workspace closure path uses APP-008A authorization instead. |
| Older case detail approval surface | `COMPATIBILITY_SURFACE` | Backend APP-006 command is reused; workspace now exposes the operational continuation. |
| Internal daily-case scheduler endpoints | `OPERATIONAL_INTERNAL` | APP-008B scheduler remains the binding mechanism; workspace surfaces exact binding state rather than replacing scheduler architecture. |
| Direct material case mutation | `OUT_OF_SCOPE_GOVERNANCE_RISK` | APP-007 protections remain the authority boundary; this closure did not redesign material mutation. |
| APP-008C/D gameplay/session/attempt provenance | `OPEN_SCOPE_GAP` | Not closed by workspace surface work; still required for full learner-exposure provenance. |

## Conformance Matrix

| Requirement | Status | Evidence |
| --- | --- | --- |
| Editors can see applied `Case` and exact current `CaseRevision` in workspace | `CLOSED_FOR_ROUTINE_PATH` | Case card revision governance projection. |
| CaseRevision review is reachable from applied draft continuation | `CLOSED_FOR_ROUTINE_PATH` | Review queue emits `caseRevision.startReview` for current revisions without active review. |
| APP-006 exact revision approval is operational in workspace | `CLOSED_FOR_ROUTINE_PATH` | Review queue emits confirmation-gated `caseRevision.approve` with `caseId`, `revisionId`, and `reviewId`. |
| APP-008A publication authorization is operational in workspace | `CLOSED_FOR_ROUTINE_PATH` | Publish workflow emits confirmation-gated `publication.authorizeRevision` only for `READY` readiness. |
| APP-008A authorization uses stale-safe expected state | `CLOSED_FOR_ROUTINE_PATH` | Payload carries expected revision, approval decision, material context hash, validation run, and active publication decision. |
| APP-008B exact scheduled binding is visible | `CLOSED_FOR_NEW_BINDINGS` | Projection shows `DailyCase.caseRevisionId`, `publicationDecisionId`, and exact binding flag. |
| Learner exposure is fully revision-bound through sessions and attempts | `OPEN` | APP-008C/D remain outside this closure. |
| Legacy/manual surfaces are eliminated | `PARTIAL` | Routine workspace no longer depends on them; compatibility/backend/internal surfaces remain. |

## Playwright Investigation

This closure does not change Playwright infrastructure. The previous timeout
condition remains treated as an environment/integration investigation item until
the local app, auth state, and backend seed state are all available for a
deterministic browser run. Deterministic unit tests and production builds were
used for this implementation.

## Verification

Required verification for this closure:

- `node --experimental-strip-types src/features/editorial/workspace/actions/workspaceReviewActionPolicy.test.ts`
- `node --experimental-strip-types src/features/editorial/workspace/actions/workspaceActionRegistry.test.ts`
- `npm run build` in `analytics-dashboard`
- `npm run build` in `doctordle-backend`
- `git diff --check`
- `git status --short`
