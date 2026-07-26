# WEOS Runtime Action Crosswalk

This crosswalk maps repository-proven runtime operations to intended WEOS
canonical actions. It is interpretation guidance only; it does not create a new
canonical action, permission, migration, audit record or runtime contract.

Core rule: each detailed mapping represents one runtime operation or request
decision, one intended canonical action, one runtime transition, one permission
pathway and one persistence pathway.

Exception: a mapping classified as `CONFLICT` may identify multiple canonical
actions when one runtime operation improperly couples those actions. In that
case, the canonical action field must state that no single settled mapping
exists.

## Verification Metadata

- Last verified commit: `4e4b65ce1704304b3eb69b888b51265f51af0731`
- Last verified date: `2026-07-26`
- Verification scope:
  - canonical action definitions,
  - HTTP routes,
  - request decisions,
  - controller symbols,
  - service and repository symbols,
  - runtime permissions,
  - database writes,
  - governance and audit writes,
  - transactions,
  - revision and concurrency handling,
  - relevant tests.
- Not verified:
  - production behaviour,
  - live-data effects,
  - institutional authority outside the repository,
  - runtime pathways not represented in repository code or tests.

## Classification Model

Runtime mapping values:

- `COMPLETE`: the HTTP route, request operation or decision, controller symbol,
  service symbol and principal persistence operation are identified. A separate
  repository class is not required when the service writes directly through
  Prisma, but the exact Prisma model operation must be identified.
- `PARTIAL`: at least one material runtime component remains uncertain or
  unverified.
- `UNMAPPED`: no first-class runtime equivalent has been identified.

Canonical conformance values:

- `CONFORMING`: runtime behaviour is supported as matching the canonical action
  and transition.
- `PARTIAL`: runtime implements only part of the canonical contract.
- `CONFLICT`: runtime behaviour materially combines, contradicts or bypasses
  canonical behaviour.
- `OPEN_DECISION`: conformance cannot be decided until a named WEOS open
  decision is resolved.
- `UNKNOWN`: repository evidence is insufficient.
- `NOT_ASSESSED`: used only for unmapped actions not yet evaluated.

Audit classifications:

- `PERSISTED_GOVERNANCE_DECISION`
- `PERSISTED_REVIEW_RECORD`
- `PERSISTED_AUDIT_RECORD`
- `PERSISTED_AUDIT_EVENT`
- `ENTITY_REVIEW_FIELDS`
- `ENTITY_STATUS_ONLY`
- `SERVICE_LOG_ONLY`
- `MODEL_EXISTS_NOT_PROVEN_IN_PATH`
- `NONE_IDENTIFIED`
- `UNKNOWN`

An audit record is a persisted artifact containing audit-oriented context or
decision fields. An audit event is a distinct persisted occurrence representing
that an action happened. Updating one audit-oriented row does not by itself
prove that an append-only audit event was created.

`PERSISTED_REVIEW_RECORD` means a dedicated persisted review artifact that may
contain reviewer, decision and timing fields. Its presence does not by itself
prove that the canonical cross-artifact governance decision required by WEOS
was written.

A review row containing decision fields may therefore be a persisted review
record without being the canonical cross-artifact governance decision required
by WEOS.

`PERSISTED_AUDIT_RECORD` means a persisted record explicitly designed to
capture an AI, editorial or operational audit context, but whose mutation path
does not prove that every decision is stored as a separate append-only event.

Test coverage qualifiers: `DIRECT_ACTION_COVERAGE`, `TRANSITION_COVERAGE`,
`PERMISSION_ONLY`, `CONTROLLER_WIRING_ONLY`, `ACTION_REGISTRY_ONLY`,
`SMOKE_ONLY`, `INDIRECT`, `FILE_EXISTS_ACTION_NOT_PROVEN`, `UNKNOWN`.

Concurrency classifications:

- Transaction isolation: `SERIALIZABLE`,
  `EXPLICIT_TRANSACTION_DEFAULT_ISOLATION`,
  `SINGLE_OPERATION_NO_EXPLICIT_TRANSACTION`, `NO_TRANSACTION_IDENTIFIED`,
  `UNKNOWN`
- Revision binding: `EXACT_REVISION_BOUND`, `CURRENT_REVISION_CHECK`,
  `STATUS_GATE_ONLY`, `VERSION_INCREMENT_ONLY`, `NONE_IDENTIFIED`, `UNKNOWN`
- Expected-version input: `PRESENT`, `ABSENT`, `UNKNOWN`
- Stale-write rejection: `PROVEN`, `PARTIAL`, `NOT_PROVEN`, `UNKNOWN`

## Summary

| Mapping ID      | Runtime operation                         | Canonical action                          | Artifact                        | Runtime mapping | Canonical conformance | Primary gap                              |
| --------------- | ----------------------------------------- | ----------------------------------------- | ------------------------------- | --------------- | --------------------- | ---------------------------------------- |
| `WEOS-ACT-001`  | `START_CASE_REVIEW`                       | `BEGIN_REVIEW`                            | `CASE_REVISION`                 | `COMPLETE`      | `PARTIAL`             | Canonical `REQUEST_REVIEW` alias open    |
| `WEOS-ACT-002`  | `APPROVE_CASE_REVISION`                   | `APPROVE_REVISION`                        | `CASE_REVISION`                 | `COMPLETE`      | `PARTIAL`             | Decision projection is not universal     |
| `WEOS-ACT-003`  | `REJECT_CASE_REVISION`                    | `REJECT_REVISION`                         | `CASE_REVISION`                 | `COMPLETE`      | `PARTIAL`             | Decision projection is not universal     |
| `WEOS-ACT-004`  | `REQUIRE_CASE_REVISION`                   | `REQUIRE_REVISION`                        | `CASE_REVISION`                 | `COMPLETE`      | `PARTIAL`             | Runtime literal differs                  |
| `WEOS-ACT-005`  | `MARK_CASE_READY_TO_PUBLISH`              | `RECORD_PUBLICATION_READINESS_ASSESSMENT` | `CASE_REVISION`                 | `COMPLETE`      | `OPEN_DECISION`       | Readiness is not authorisation           |
| `WEOS-ACT-006`  | `APPLY_APPROVED_CLUE_REVISION_DRAFT`      | `APPLY_ACCEPTED_DRAFT`                    | `CLUE_REVISION_DRAFT`           | `COMPLETE`      | `PARTIAL`             | Application record is not first-class    |
| `WEOS-ACT-007`  | `APPROVE_CLUE_REVISION_DRAFT`             | `ACCEPT_CLUE_REVISION_DRAFT`              | `CLUE_REVISION_DRAFT`           | `COMPLETE`      | `PARTIAL`             | Entity fields, not decision record       |
| `WEOS-ACT-008`  | `REJECT_CLUE_REVISION_DRAFT`              | `REJECT_CLUE_REVISION_DRAFT`              | `CLUE_REVISION_DRAFT`           | `COMPLETE`      | `PARTIAL`             | Entity fields, not decision record       |
| `WEOS-ACT-008A` | `REQUEST_CHANGES_FOR_CLUE_REVISION_DRAFT` | `REQUEST_CLUE_REVISION_DRAFT_CHANGES`     | `CLUE_REVISION_DRAFT`           | `COMPLETE`      | `PARTIAL`             | Entity fields, not decision record       |
| `WEOS-ACT-008B` | `SUPERSEDE_CLUE_REVISION_DRAFT`           | `SUPERSEDE_CLUE_REVISION_DRAFT`           | `CLUE_REVISION_DRAFT`           | `COMPLETE`      | `PARTIAL`             | Entity fields, not decision record       |
| `WEOS-ACT-009A` | `ACCEPT_AI_DRAFT`                         | `ACCEPT_AI_DRAFT`                         | `AI_DRAFT`                      | `COMPLETE`      | `PARTIAL`             | Acceptance may materialize another draft |
| `WEOS-ACT-009B` | `REJECT_AI_DRAFT`                         | `REJECT_AI_DRAFT`                         | `AI_DRAFT`                      | `COMPLETE`      | `PARTIAL`             | Audit row is not generic decision record |
| `WEOS-ACT-009C` | `REQUEST_AI_DRAFT_CHANGES`                | `REQUEST_AI_DRAFT_CHANGES`                | `AI_DRAFT`                      | `COMPLETE`      | `PARTIAL`             | Audit row is not generic decision record |
| `WEOS-ACT-009D` | `SUPERSEDE_AI_DRAFT`                      | `SUPERSEDE_AI_DRAFT`                      | `AI_DRAFT`                      | `COMPLETE`      | `PARTIAL`             | Audit row is not generic decision record |
| `WEOS-ACT-010`  | `ACTIVATE_REGISTRY_ENTRY`                 | `ACTIVATE_REGISTRY_ENTRY`                 | `DIAGNOSIS_REGISTRY`            | `COMPLETE`      | `PARTIAL`             | No generic governance record             |
| `WEOS-ACT-011A` | `HIDE_REGISTRY_ENTRY`                     | `HIDE_REGISTRY_ENTRY`                     | `DIAGNOSIS_REGISTRY`            | `COMPLETE`      | `PARTIAL`             | Runtime action is `deactivate`           |
| `WEOS-ACT-012A` | `GRANT_PLAYABILITY`                       | `GRANT_PLAYABILITY`                       | `DIAGNOSIS_REGISTRY`            | `COMPLETE`      | `PARTIAL`             | Boolean projection only                  |
| `WEOS-ACT-012B` | `REMOVE_PLAYABILITY`                      | `REMOVE_PLAYABILITY`                      | `DIAGNOSIS_REGISTRY`            | `COMPLETE`      | `PARTIAL`             | Also clears generatability               |
| `WEOS-ACT-012C` | `GRANT_GENERATABILITY`                    | `GRANT_GENERATABILITY`                    | `DIAGNOSIS_REGISTRY`            | `COMPLETE`      | `PARTIAL`             | Boolean projection only                  |
| `WEOS-ACT-012D` | `REMOVE_GENERATABILITY`                   | `REMOVE_GENERATABILITY`                   | `DIAGNOSIS_REGISTRY`            | `COMPLETE`      | `PARTIAL`             | Boolean projection only                  |
| `WEOS-ACT-013`  | `APPROVE_GRAPH_CANDIDATE_RUNTIME`         | Not settled as one canonical action       | `GRAPH_CANDIDATE`, `GRAPH_FACT` | `COMPLETE`      | `CONFLICT`            | Approval and promotion are coupled       |
| `WEOS-ACT-014`  | `REJECT_GRAPH_CANDIDATE`                  | `REJECT_GRAPH_CANDIDATE`                  | `GRAPH_CANDIDATE`               | `COMPLETE`      | `PARTIAL`             | Entity fields, not decision record       |
| `WEOS-ACT-015`  | `MERGE_GRAPH_CANDIDATE`                   | `MERGE_CANDIDATE`                         | `GRAPH_CANDIDATE`               | `COMPLETE`      | `PARTIAL`             | Entity fields, not decision record       |
| `WEOS-ACT-016A` | `APPROVE_DIAGNOSIS_EDUCATION_REVISION`    | `APPROVE_REVISION`                        | `DIAGNOSIS_EDUCATION_REVISION`  | `COMPLETE`      | `PARTIAL`             | Version increment only                   |
| `WEOS-ACT-016B` | `REJECT_DIAGNOSIS_EDUCATION_REVISION`     | `REJECT_REVISION`                         | `DIAGNOSIS_EDUCATION_REVISION`  | `COMPLETE`      | `PARTIAL`             | Version increment only                   |
| `WEOS-ACT-016C` | `REQUEST_DIAGNOSIS_EDUCATION_CHANGES`     | `REQUIRE_REVISION`                        | `DIAGNOSIS_EDUCATION_REVISION`  | `COMPLETE`      | `PARTIAL`             | Runtime literal is `NEEDS_EDIT`          |
| `WEOS-ACT-016D` | `PUBLISH_DIAGNOSIS_EDUCATION_REVISION`    | `AUTHORISE_PUBLICATION`                   | `DIAGNOSIS_EDUCATION_REVISION`  | `COMPLETE`      | `CONFLICT`            | Approval and publication not separated   |
| `WEOS-ACT-016E` | `ARCHIVE_DIAGNOSIS_EDUCATION`             | `ARCHIVE_ARTIFACT`                        | `DIAGNOSIS_EDUCATION`           | `COMPLETE`      | `PARTIAL`             | Version increment only                   |
| `WEOS-ACT-017A` | `ACTIVATE_TEACHING_RELATIONSHIP`          | `ACTIVATE_ARTIFACT`                       | `TEACHING_RELATIONSHIP`         | `COMPLETE`      | `PARTIAL`             | Entity fields, not decision record       |
| `WEOS-ACT-017B` | `REJECT_TEACHING_RELATIONSHIP`            | `REJECT_ARTIFACT`                         | `TEACHING_RELATIONSHIP`         | `COMPLETE`      | `PARTIAL`             | Entity fields, not decision record       |
| `WEOS-ACT-017C` | `DEPRECATE_TEACHING_RELATIONSHIP`         | `DEPRECATE_ARTIFACT`                      | `TEACHING_RELATIONSHIP`         | `COMPLETE`      | `PARTIAL`             | Entity fields, not decision record       |
| `WEOS-ACT-017D` | `REQUEST_TEACHING_RELATIONSHIP_CHANGES`   | `REQUEST_CHANGES`                         | `TEACHING_RELATIONSHIP`         | `COMPLETE`      | `UNKNOWN`             | Canonical action name not proven         |
| `WEOS-ACT-018A` | `ACTIVATE_EVIDENCE_RELATIONSHIP`          | `ACTIVATE_ARTIFACT`                       | `EVIDENCE_RELATIONSHIP`         | `COMPLETE`      | `OPEN_DECISION`       | Node activation side effect              |
| `WEOS-ACT-018B` | `REJECT_EVIDENCE_RELATIONSHIP`            | `REJECT_ARTIFACT`                         | `EVIDENCE_RELATIONSHIP`         | `COMPLETE`      | `PARTIAL`             | Entity fields, not decision record       |
| `WEOS-ACT-018C` | `DEPRECATE_EVIDENCE_RELATIONSHIP`         | `DEPRECATE_ARTIFACT`                      | `EVIDENCE_RELATIONSHIP`         | `COMPLETE`      | `PARTIAL`             | Entity fields, not decision record       |
| `WEOS-ACT-019`  | `RUN_REASONING_DRAFT_VALIDATION`          | `VALIDATE_AI_DRAFT`                       | `REASONING_VALIDATION_RESULT`   | `PARTIAL`       | `PARTIAL`             | Validation is not approval               |
| `WEOS-ACT-020`  | `GENERATE_UNSUPPORTED_CLAIM_REPAIR_DRAFT` | `CREATE_AI_DRAFT`                         | `AI_DRAFT`                      | `PARTIAL`       | `PARTIAL`             | Creation only; application separate      |

## `WEOS-ACT-001` - `START_CASE_REVIEW`

### Canonical interpretation

- Canonical action: `BEGIN_REVIEW`
- Canonical action ID: Not proven in repository metadata; `REQUEST_REVIEW` and
  `BEGIN_REVIEW` appear related but aliasing is not proven.
- Canonical document:
  `docs/weos/WEOS-IMP-003-editorial-action-decision-catalogue.md`
- Canonical transition: `CASE_REVISION` review opening against current revision.
- Related open decisions: None identified.
- Open-decision dependency: `NONE_IDENTIFIED`
- Implementation gap: Are `REQUEST_REVIEW` and `BEGIN_REVIEW` aliases or distinct canonical actions?
- Gap tracking: `docs/weos/gaps/IMPLEMENTATION-GAPS.md`
- Interpretation confidence: Medium.

### Runtime mapping

- HTTP method: `POST`
- Route: `/admin/cases/:caseId/start-review`
- Request decision or body: No decision literal; route operation only.
- Controller path: `doctordle-backend/src/modules/admin/admin.controller.ts`
- Controller symbol: `AdminController.startReview`
- Service path: `doctordle-backend/src/modules/admin/case-review.service.ts`
- Service symbol: `CaseReviewService.startReview`
- Repository path: Not proven.
- Repository symbol: Not proven.
- Other directly invoked services: None identified.

### Authority

- Route guard: `AdminGuard`
- Backend permission check: `@EditorialAccess()`
- Backend role requirement: runtime permission level `editor`
- Frontend eligibility: `analytics-dashboard/src/api/admin.ts`
  `startCaseReview`
- Canonical authority: Not proven.
- Authority mapping status: `PARTIAL`
- Evidence:
  `doctordle-backend/src/auth/editorial-permission.decorator.ts`,
  `doctordle-backend/src/modules/admin/admin-editorial-permissions.spec.ts`
  Coverage qualifier: `PERMISSION_ONLY`; verifies access level for the mapped controller route.

### State and persistence

- Runtime preconditions: Case exists; `canStartEditorialReview` passes.
- Runtime transition: `Case.editorialStatus -> REVIEW`; creates or refreshes
  open `CaseReview`.
- Exact runtime status literals: `REVIEW`
- Models written: `Case`, `CaseReview`
- Principal persistence operation: `tx.caseReview.update` or `tx.caseReview.create`; `tx.case.update`
- Canonical records written: Not proven.
- Projection fields written: `Case.editorialStatus`,
  `CaseReview.reviewerUserId`
- Revision records written: None identified.
- Reviewer or actor fields written: `CaseReview.reviewerUserId`
- Other side effects: service logger entries.

### Governance and audit

- Audit classification: `PERSISTED_REVIEW_RECORD`, `SERVICE_LOG_ONLY`,
  `ENTITY_REVIEW_FIELDS`
- Persisted review record: `CaseReview`
- Canonical governance decision: Not applicable; this operation opens review
  and does not make a review decision.
- Persisted event record: None identified.
- Entity review fields: `CaseReview.reviewerUserId`
- Service logging: `admin.case.review.start_requested`,
  `admin.case.review.started`
- Evidence: `CaseReviewService.startReview`
- Missing governance evidence: No `CaseReviewEvent` write proven in this path.

### Transaction and concurrency

- Transaction isolation: `SERIALIZABLE`
- Revision binding: `CURRENT_REVISION_CHECK`
- Expected-version input: `ABSENT`
- Stale-write rejection: `PARTIAL`
- Status gating: `canStartEditorialReview`
- Idempotency: Existing open review is refreshed for current revision.
- Concurrency assessment: Serializable retry exists, but no expected-version
  input is accepted.

### Verification

- Service tests:
  `doctordle-backend/src/modules/admin/case-review.service.spec.ts`
  Coverage qualifier: `FILE_EXISTS_ACTION_NOT_PROVEN`; the service test file
  exists, but exact action or request-decision coverage was not reverified in
  this documentation pass.
- Permission tests:
  `doctordle-backend/src/modules/admin/admin-editorial-permissions.spec.ts`
  Coverage qualifier: `PERMISSION_ONLY`; verifies access level for the mapped controller route.
- Dashboard unit tests:
  `analytics-dashboard/src/features/editorial/workspace/actions/workspaceActionRegistry.test.ts`
  Coverage qualifier: `ACTION_REGISTRY_ONLY`; verifies dashboard action registration, not backend enforcement.
- Browser tests:
  `analytics-dashboard/qa/editorial-workspace-smoke.spec.ts`
  Coverage qualifier: `SMOKE_ONLY`; browser workflow coverage exists, but exact action execution is not proven.
- Runtime mapping: `COMPLETE`
- Canonical conformance: `PARTIAL`

### Open questions

- Are `REQUEST_REVIEW` and `BEGIN_REVIEW` aliases or distinct canonical
  actions?

## `WEOS-ACT-002` - `APPROVE_CASE_REVISION`

### Canonical interpretation

- Canonical action: `APPROVE_REVISION`
- Canonical action ID: Not proven as a row-specific ID.
- Canonical document:
  `docs/weos/WEOS-IMP-003-editorial-action-decision-catalogue.md`
- Canonical transition: current case revision review decision to approved.
- Related open decisions: None identified.
- Open-decision dependency: `NONE_IDENTIFIED`
- Implementation gap: Should `CaseEditorialDecision` be the mandatory canonical projection for every review decision?
- Gap tracking: `docs/weos/gaps/IMPLEMENTATION-GAPS.md`
- Interpretation confidence: Medium.

### Runtime mapping

- HTTP method: `POST`
- Route: `/admin/cases/:caseId/review`
- Request decision or body: `decision: APPROVED`
- Controller path: `doctordle-backend/src/modules/admin/admin.controller.ts`
- Controller symbol: `AdminController.submitReview`
- Service path: `doctordle-backend/src/modules/admin/case-review.service.ts`
- Service symbol: `CaseReviewService.submitReview`
- Repository path: Not proven.
- Repository symbol: Not proven.
- Other directly invoked services:
  `DiagnosisGraphExtractionService.extractFromApprovedCase`
- Related governance capability:
  `CaseReviewGovernanceRepository.createEditorialDecision` exists and is
  tested, but invocation from this mapped runtime operation is not proven.

### Authority

- Route guard: `AdminGuard`
- Backend permission check: `@SeniorEditorialAccess()`
- Backend role requirement: runtime permission level `senior`
- Frontend eligibility: `analytics-dashboard/src/api/admin.ts`
  `submitCaseReview`
- Canonical authority: Not proven equivalent to runtime `senior`.
- Authority mapping status: `PARTIAL`
- Evidence:
  `doctordle-backend/src/auth/editorial-permission.decorator.ts`,
  `doctordle-backend/src/modules/admin/admin-editorial-permissions.spec.ts`
  Coverage qualifier: `PERMISSION_ONLY`; verifies access level for the mapped controller route.

### State and persistence

- Runtime preconditions: `Case.editorialStatus === REVIEW`; open `CaseReview`
  exists for `currentRevisionId`.
- Runtime transition: `ReviewDecision.APPROVED`;
  `Case.editorialStatus -> APPROVED`.
- Exact runtime status literals: `APPROVED`, `REVIEW`
- Models written: `Case`, `CaseReview`
- Principal persistence operation: `tx.caseReview.update`; `tx.case.update`
- Related governance model: `CaseEditorialDecision` - `MODEL_EXISTS_NOT_PROVEN_IN_PATH`
- Canonical records written: Not proven.
- Projection fields written: `Case.editorialStatus`, `Case.approvedAt`,
  `Case.approvedByUserId`
- Revision records written: None identified.
- Reviewer or actor fields written: `CaseReview.reviewerUserId`,
  `Case.approvedByUserId`
- Other side effects: graph extraction attempted after approval.

### Governance and audit

- Audit classification: `PERSISTED_REVIEW_RECORD`, `ENTITY_REVIEW_FIELDS`,
  `MODEL_EXISTS_NOT_PROVEN_IN_PATH`, `SERVICE_LOG_ONLY`
- Persisted review record: `CaseReview`
- Canonical governance decision: Not proven; the
  `CaseEditorialDecision` path is not proven for every submit call.
- Persisted event record: Not proven.
- Entity review fields: `CaseReview.decision`, `CaseReview.decidedAt`
- Service logging: `admin.case.review.submit_requested`,
  `admin.case.review.submitted`
- Evidence: `CaseReviewService.submitReview`
- Missing governance evidence: Mandatory canonical decision projection is not
  proven.

### Transaction and concurrency

- Transaction isolation: `SERIALIZABLE`
- Revision binding: `CURRENT_REVISION_CHECK`
- Expected-version input: `ABSENT`
- Stale-write rejection: `PARTIAL`
- Status gating: Requires `REVIEW` and open review for current revision.
- Idempotency: None identified.
- Concurrency assessment: Status and current-revision checks exist; optimistic
  expected-version input is absent.

### Verification

- Service tests:
  `doctordle-backend/src/modules/admin/case-review.service.spec.ts`
  Coverage qualifier: `FILE_EXISTS_ACTION_NOT_PROVEN`; the service test file
  exists, but exact action or request-decision coverage was not reverified in
  this documentation pass.
- Related governance tests:
  `doctordle-backend/src/modules/admin/case-review-governance.repository.spec.ts`
  Coverage qualifier: `FILE_EXISTS_ACTION_NOT_PROVEN`; referenced file exists; exact mapped action coverage was not reverified in this correction.
- Dashboard unit tests:
  `analytics-dashboard/src/features/editorial/workspace/actions/workspaceActionRegistry.test.ts`
  Coverage qualifier: `ACTION_REGISTRY_ONLY`; verifies dashboard action registration, not backend enforcement.
- Browser tests:
  `analytics-dashboard/qa/editorial-workspace-smoke.spec.ts`
  Coverage qualifier: `SMOKE_ONLY`; browser workflow coverage exists, but exact action execution is not proven.
- Runtime mapping: `COMPLETE`
- Canonical conformance: `PARTIAL`

### Open questions

- Should `CaseEditorialDecision` be the mandatory canonical projection for every
  review decision?

## `WEOS-ACT-003` - `REJECT_CASE_REVISION`

### Canonical interpretation

- Canonical action: `REJECT_REVISION`
- Canonical action ID: Not proven as a row-specific ID.
- Canonical document:
  `docs/weos/WEOS-IMP-003-editorial-action-decision-catalogue.md`
- Canonical transition: current case revision review decision to rejected.
- Related open decisions: None identified.
- Open-decision dependency: `NONE_IDENTIFIED`
- Implementation gap: Should rejection create a first-class canonical decision record beyond `CaseReview`?
- Gap tracking: `docs/weos/gaps/IMPLEMENTATION-GAPS.md`
- Interpretation confidence: Medium.

### Runtime mapping

- HTTP method: `POST`
- Route: `/admin/cases/:caseId/review`
- Request decision or body: `decision: REJECTED`
- Controller path: `doctordle-backend/src/modules/admin/admin.controller.ts`
- Controller symbol: `AdminController.submitReview`
- Service path: `doctordle-backend/src/modules/admin/case-review.service.ts`
- Service symbol: `CaseReviewService.submitReview`
- Repository path: Not proven.
- Repository symbol: Not proven.
- Other directly invoked services: None identified for this decision.
- Related governance capability:
  `CaseReviewGovernanceRepository.createEditorialDecision` exists and is
  tested, but invocation from this mapped runtime operation is not proven.

### Authority

- Route guard: `AdminGuard`
- Backend permission check: `@SeniorEditorialAccess()`
- Backend role requirement: runtime permission level `senior`
- Frontend eligibility: `analytics-dashboard/src/api/admin.ts`
  `submitCaseReview`
- Canonical authority: Not proven equivalent to runtime `senior`.
- Authority mapping status: `PARTIAL`
- Evidence:
  `doctordle-backend/src/auth/editorial-permission.decorator.ts`,
  `doctordle-backend/src/modules/admin/admin-editorial-permissions.spec.ts`
  Coverage qualifier: `PERMISSION_ONLY`; verifies access level for the mapped controller route.

### State and persistence

- Runtime preconditions: `Case.editorialStatus === REVIEW`; open `CaseReview`
  exists for `currentRevisionId`.
- Runtime transition: `ReviewDecision.REJECTED`;
  `Case.editorialStatus -> REJECTED`.
- Exact runtime status literals: `REJECTED`, `REVIEW`
- Models written: `Case`, `CaseReview`
- Principal persistence operation: `tx.caseReview.update`; `tx.case.update`
- Canonical records written: Not proven.
- Projection fields written: `Case.editorialStatus`, approval reset fields.
- Revision records written: None identified.
- Reviewer or actor fields written: `CaseReview.reviewerUserId`
- Other side effects: service logger entries.

### Governance and audit

- Audit classification: `PERSISTED_REVIEW_RECORD`, `ENTITY_REVIEW_FIELDS`,
  `MODEL_EXISTS_NOT_PROVEN_IN_PATH`, `SERVICE_LOG_ONLY`
- Persisted review record: `CaseReview`
- Canonical governance decision: Not proven.
- Persisted event record: Not proven.
- Entity review fields: `CaseReview.decision`, `CaseReview.decidedAt`
- Service logging: `admin.case.review.submit_requested`,
  `admin.case.review.submitted`
- Evidence: `CaseReviewService.submitReview`
- Missing governance evidence: Mandatory canonical decision projection is not
  proven.

### Transaction and concurrency

- Transaction isolation: `SERIALIZABLE`
- Revision binding: `CURRENT_REVISION_CHECK`
- Expected-version input: `ABSENT`
- Stale-write rejection: `PARTIAL`
- Status gating: Requires `REVIEW` and open review for current revision.
- Idempotency: None identified.
- Concurrency assessment: No expected-version input.

### Verification

- Service tests:
  `doctordle-backend/src/modules/admin/case-review.service.spec.ts`
  Coverage qualifier: `FILE_EXISTS_ACTION_NOT_PROVEN`; the service test file
  exists, but exact action or request-decision coverage was not reverified in
  this documentation pass.
- Related governance tests:
  `doctordle-backend/src/modules/admin/case-review-governance.repository.spec.ts`
  Coverage qualifier: `FILE_EXISTS_ACTION_NOT_PROVEN`; referenced file exists; exact mapped action coverage was not reverified in this correction.
- Dashboard unit tests:
  `analytics-dashboard/src/features/editorial/workspace/actions/workspaceActionRegistry.test.ts`
  Coverage qualifier: `ACTION_REGISTRY_ONLY`; verifies dashboard action registration, not backend enforcement.
- Browser tests:
  `analytics-dashboard/qa/editorial-workspace-smoke.spec.ts`
  Coverage qualifier: `SMOKE_ONLY`; browser workflow coverage exists, but exact action execution is not proven.
- Runtime mapping: `COMPLETE`
- Canonical conformance: `PARTIAL`

### Open questions

- Should rejection create a first-class canonical decision record beyond
  `CaseReview`?

## `WEOS-ACT-004` - `REQUIRE_CASE_REVISION`

### Canonical interpretation

- Canonical action: `REQUIRE_REVISION`
- Canonical action ID: Not proven as a row-specific ID.
- Canonical document:
  `docs/weos/WEOS-IMP-003-editorial-action-decision-catalogue.md`
- Canonical transition: current case revision review decision to revision
  required.
- Related open decisions: None identified.
- Open-decision dependency: `NONE_IDENTIFIED`
- Implementation gap: Should runtime `NEEDS_EDIT` be canonicalized as `REQUIRE_REVISION` or kept as a compatibility literal?
- Gap tracking: `docs/weos/gaps/IMPLEMENTATION-GAPS.md`
- Interpretation confidence: Medium.

### Runtime mapping

- HTTP method: `POST`
- Route: `/admin/cases/:caseId/review`
- Request decision or body: `decision: NEEDS_EDIT`
- Controller path: `doctordle-backend/src/modules/admin/admin.controller.ts`
- Controller symbol: `AdminController.submitReview`
- Service path: `doctordle-backend/src/modules/admin/case-review.service.ts`
- Service symbol: `CaseReviewService.submitReview`
- Repository path: Not proven.
- Repository symbol: Not proven.
- Other directly invoked services: None identified for this decision.
- Related governance capability:
  `CaseReviewGovernanceRepository.createEditorialDecision` exists and is
  tested, but invocation from this mapped runtime operation is not proven.

### Authority

- Route guard: `AdminGuard`
- Backend permission check: `@SeniorEditorialAccess()`
- Backend role requirement: runtime permission level `senior`
- Frontend eligibility: `analytics-dashboard/src/api/admin.ts`
  `submitCaseReview`
- Canonical authority: Not proven equivalent to runtime `senior`.
- Authority mapping status: `PARTIAL`
- Evidence:
  `doctordle-backend/src/auth/editorial-permission.decorator.ts`,
  `doctordle-backend/src/modules/admin/admin-editorial-permissions.spec.ts`
  Coverage qualifier: `PERMISSION_ONLY`; verifies access level for the mapped controller route.

### State and persistence

- Runtime preconditions: `Case.editorialStatus === REVIEW`; open `CaseReview`
  exists for `currentRevisionId`.
- Runtime transition: `ReviewDecision.NEEDS_EDIT`;
  `Case.editorialStatus -> NEEDS_EDIT`.
- Exact runtime status literals: `NEEDS_EDIT`, `REVIEW`
- Models written: `Case`, `CaseReview`
- Principal persistence operation: `tx.caseReview.update`; `tx.case.update`
- Canonical records written: Not proven.
- Projection fields written: `Case.editorialStatus`, approval reset fields.
- Revision records written: None identified.
- Reviewer or actor fields written: `CaseReview.reviewerUserId`
- Other side effects: service logger entries.

### Governance and audit

- Audit classification: `PERSISTED_REVIEW_RECORD`, `ENTITY_REVIEW_FIELDS`,
  `MODEL_EXISTS_NOT_PROVEN_IN_PATH`, `SERVICE_LOG_ONLY`
- Persisted review record: `CaseReview`
- Canonical governance decision: Not proven.
- Persisted event record: Not proven.
- Entity review fields: `CaseReview.decision`, `CaseReview.decidedAt`
- Service logging: `admin.case.review.submit_requested`,
  `admin.case.review.submitted`
- Evidence: `CaseReviewService.submitReview`
- Missing governance evidence: Canonical name and runtime literal differ.

### Transaction and concurrency

- Transaction isolation: `SERIALIZABLE`
- Revision binding: `CURRENT_REVISION_CHECK`
- Expected-version input: `ABSENT`
- Stale-write rejection: `PARTIAL`
- Status gating: Requires `REVIEW` and open review for current revision.
- Idempotency: None identified.
- Concurrency assessment: No expected-version input.

### Verification

- Service tests:
  `doctordle-backend/src/modules/admin/case-review.service.spec.ts`
  Coverage qualifier: `FILE_EXISTS_ACTION_NOT_PROVEN`; the service test file
  exists, but exact action or request-decision coverage was not reverified in
  this documentation pass.
- Related governance tests:
  `doctordle-backend/src/modules/admin/case-review-governance.repository.spec.ts`
  Coverage qualifier: `FILE_EXISTS_ACTION_NOT_PROVEN`; referenced file exists; exact mapped action coverage was not reverified in this correction.
- Dashboard unit tests:
  `analytics-dashboard/src/features/editorial/workspace/actions/workspaceActionRegistry.test.ts`
  Coverage qualifier: `ACTION_REGISTRY_ONLY`; verifies dashboard action registration, not backend enforcement.
- Browser tests:
  `analytics-dashboard/qa/editorial-workspace-smoke.spec.ts`
  Coverage qualifier: `SMOKE_ONLY`; browser workflow coverage exists, but exact action execution is not proven.
- Runtime mapping: `COMPLETE`
- Canonical conformance: `PARTIAL`

### Open questions

- Should runtime `NEEDS_EDIT` be canonicalized as `REQUIRE_REVISION` or kept as
  a compatibility literal?

## `WEOS-ACT-005` - `MARK_CASE_READY_TO_PUBLISH`

### Canonical interpretation

- Canonical action: `RECORD_PUBLICATION_READINESS_ASSESSMENT`
- Canonical action ID: Not proven as a row-specific ID.
- Canonical document:
  `docs/weos/WEOS-IMP-002-lifecycle-transition-specification.md`,
  `docs/weos/WEOS-IMP-003-editorial-action-decision-catalogue.md`
- Canonical transition: readiness assessment for approved case revision.
- Related open decisions:
  `docs/weos/WEOS-IMP-005-phase-2-open-decisions.md`
- Open-decision ID: `NOT_REGISTERED`
- Open-decision document: `docs/weos/WEOS-IMP-005-phase-2-open-decisions.md`
- Relevant question: What first-class route and record authorise publication after readiness?
- Gap implication: The unresolved decision should be registered in docs/weos/gaps/IMPLEMENTATION-GAPS.md.
- Interpretation confidence: Medium.

### Runtime mapping

- HTTP method: `POST`
- Route: `/admin/cases/:caseId/ready-to-publish`
- Request decision or body: No decision literal; route operation only.
- Controller path: `doctordle-backend/src/modules/admin/admin.controller.ts`
- Controller symbol: `AdminController.markReadyToPublish`
- Service path: `doctordle-backend/src/modules/admin/case-review.service.ts`
- Service symbol: `CaseReviewService.markReadyToPublish`
- Repository path: Not proven.
- Repository symbol: Not proven.
- Other directly invoked services:
  `getCaseDiagnosisPublishReadiness`,
  `CaseEligibilityPolicyService.validatePlayableClues`
- Related governance capability:
  `CaseReviewGovernanceRepository.createEditorialDecision` exists and is
  tested, but invocation from this mapped runtime operation is not proven.

### Authority

- Route guard: `AdminGuard`
- Backend permission check: `@SeniorEditorialAccess()`
- Backend role requirement: runtime permission level `senior`
- Frontend eligibility: `analytics-dashboard/src/api/admin.ts`
  `markCaseReadyToPublish`
- Canonical authority: Publication authority not proven equivalent to runtime
  `senior`.
- Authority mapping status: `PARTIAL`
- Evidence:
  `doctordle-backend/src/auth/editorial-permission.decorator.ts`,
  `doctordle-backend/src/modules/admin/admin-editorial-permissions.spec.ts`
  Coverage qualifier: `PERMISSION_ONLY`; verifies access level for the mapped controller route.

### State and persistence

- Runtime preconditions: Case exists; `canMoveToReadyToPublish` passes; diagnosis
  publish readiness passes; clue playability validation passes.
- Runtime transition: `Case.editorialStatus APPROVED -> READY_TO_PUBLISH`.
- Exact runtime status literals: `APPROVED`, `READY_TO_PUBLISH`
- Models written: `Case`
- Principal persistence operation: `tx.case.update`
- Related governance model: `CaseEditorialDecision` - `MODEL_EXISTS_NOT_PROVEN_IN_PATH`
- Canonical records written: Not proven.
- Projection fields written: `Case.editorialStatus`
- Revision records written: None identified.
- Reviewer or actor fields written: None written by controller call; no request
  actor is passed to service.
- Other side effects: service logger entries.

### Governance and audit

- Audit classification: `ENTITY_STATUS_ONLY`,
  `MODEL_EXISTS_NOT_PROVEN_IN_PATH`, `SERVICE_LOG_ONLY`
- Persisted decision record: Not proven.
- Persisted event record: Not proven.
- Entity review fields: None identified.
- Service logging: `admin.case.ready_to_publish.requested`,
  `admin.case.ready_to_publish.marked`
- Evidence: `CaseReviewService.markReadyToPublish`
- Missing governance evidence: Marking a case `READY_TO_PUBLISH` is not treated
  as evidence that a first-class canonical publication authorisation decision
  has been persisted.

### Transaction and concurrency

- Transaction isolation: `SERIALIZABLE`
- Revision binding: `STATUS_GATE_ONLY`
- Expected-version input: `ABSENT`
- Stale-write rejection: `PARTIAL`
- Status gating: Requires approved case and readiness checks.
- Idempotency: None identified.
- Concurrency assessment: Serializable retry exists; no expected-version input.

### Verification

- Service tests:
  `doctordle-backend/src/modules/admin/case-review.service.spec.ts`
  Coverage qualifier: `FILE_EXISTS_ACTION_NOT_PROVEN`; the service test file
  exists, but exact action or request-decision coverage was not reverified in
  this documentation pass.
- Policy tests:
  `doctordle-backend/src/modules/editorial/policies/diagnosis-publish-readiness.policy.spec.ts`
  Coverage qualifier: `FILE_EXISTS_ACTION_NOT_PROVEN`; referenced file exists; exact mapped action coverage was not reverified in this correction.
- Dashboard unit tests:
  `analytics-dashboard/src/features/editorial/workspace/actions/workspaceActionRegistry.test.ts`
  Coverage qualifier: `ACTION_REGISTRY_ONLY`; verifies dashboard action registration, not backend enforcement.
- Browser tests:
  `analytics-dashboard/qa/editorial-workspace-smoke.spec.ts`
  Coverage qualifier: `SMOKE_ONLY`; browser workflow coverage exists, but exact action execution is not proven.
- Runtime mapping: `COMPLETE`
- Canonical conformance: `OPEN_DECISION`

### Open questions

- Which runtime route, if any, persists canonical `AUTHORISE_PUBLICATION`?

## `WEOS-ACT-006` - `APPLY_APPROVED_CLUE_REVISION_DRAFT`

### Canonical interpretation

- Canonical action: `APPLY_ACCEPTED_DRAFT`
- Canonical action ID: Not proven as a row-specific ID.
- Canonical document:
  `docs/weos/WEOS-IMP-003-editorial-action-decision-catalogue.md`
- Canonical transition: accepted clue revision draft is applied to case content.
- Related open decisions: None identified.
- Open-decision dependency: `NONE_IDENTIFIED`
- Implementation gap: Should application produce a separate immutable governance record?
- Gap tracking: `docs/weos/gaps/IMPLEMENTATION-GAPS.md`
- Interpretation confidence: Medium.

### Runtime mapping

- HTTP method: `POST`
- Route: `/admin/case-clue-revision-drafts/:draftId/apply`
- Request decision or body: No decision literal; route operation only.
- Controller path: `doctordle-backend/src/modules/admin/admin.controller.ts`
- Controller symbol: `AdminController.applyCaseClueRevisionDraft`
- Service path:
  `doctordle-backend/src/modules/admin/diagnosis-editorial-workspace.service.ts`
- Service symbol:
  `DiagnosisEditorialWorkspaceService.applyApprovedClueRevisionDraft`
- Repository path: Not proven.
- Repository symbol: Not proven.
- Other directly invoked services: None identified.

### Authority

- Route guard: `AdminGuard`
- Backend permission check: `@EditorialAccess()`
- Backend role requirement: runtime permission level `editor`
- Frontend eligibility: `analytics-dashboard/src/api/admin.ts`
  `applyCaseClueRevisionDraft`
- Canonical authority: Not proven.
- Authority mapping status: `PARTIAL`
- Evidence:
  `doctordle-backend/src/auth/editorial-permission.decorator.ts`,
  `doctordle-backend/src/modules/admin/admin-editorial-permissions.spec.ts`
  Coverage qualifier: `PERMISSION_ONLY`; verifies access level for the mapped controller route.

### State and persistence

- Runtime preconditions: Draft exists; draft is approved or is blocked to
  `NEEDS_CHANGES` when not applicable.
- Runtime transition: `CaseClueRevisionDraft.status APPROVED -> APPLIED`;
  creates `CaseRevision`; updates `Case`.
- Exact runtime status literals: `APPROVED`, `APPLIED`, `NEEDS_CHANGES`
- Models written: `Case`, `CaseRevision`, `CaseClueRevisionDraft`
- Principal persistence operation: `tx.case.update`; `tx.caseRevision.create`; `tx.caseClueRevisionDraft.update`
- Canonical records written: Not proven.
- Projection fields written: `Case.clues`, `Case.currentRevisionId`,
  `Case.editorialStatus`
- Revision records written: `CaseRevision`
- Reviewer or actor fields written: `CaseClueRevisionDraft.decisionByUserId`
- Other side effects: progression analysis deletion identified in prior
  crosswalk remains unverified in this pass.

### Governance and audit

- Audit classification: `ENTITY_REVIEW_FIELDS`, `ENTITY_STATUS_ONLY`
- Persisted decision record: Not proven; decision-like fields are stored on the draft entity row.
- Persisted event record: None identified.
- Entity review fields: `decisionByUserId`, `decisionAt`, `decisionNote`
- Service logging: None identified.
- Evidence:
  `DiagnosisEditorialWorkspaceService.applyApprovedClueRevisionDraft`
- Missing governance evidence: No generic controlled-application record proven.

### Transaction and concurrency

- Transaction isolation: `EXPLICIT_TRANSACTION_DEFAULT_ISOLATION`
- Revision binding: `STATUS_GATE_ONLY`
- Expected-version input: `ABSENT`
- Stale-write rejection: `NOT_PROVEN`
- Status gating: Draft status checks.
- Idempotency: None identified.
- Concurrency assessment: Transaction exists; no expected-version input.

### Verification

- Service tests:
  `doctordle-backend/src/modules/admin/diagnosis-editorial-workspace.service.spec.ts`
  Coverage qualifier: `FILE_EXISTS_ACTION_NOT_PROVEN`; the service test file
  exists, but exact action or request-decision coverage was not reverified in
  this documentation pass.
- Controller tests:
  `doctordle-backend/src/modules/admin/admin.controller.spec.ts`
  Coverage qualifier: `CONTROLLER_WIRING_ONLY`; verifies controller wiring for the mapped method.
- Dashboard unit tests:
  `analytics-dashboard/src/features/editorial/workspace/actions/workspaceActionRegistry.test.ts`
  Coverage qualifier: `ACTION_REGISTRY_ONLY`; verifies dashboard action registration, not backend enforcement.
- Browser tests:
  `analytics-dashboard/qa/editorial-workspace-smoke.spec.ts`
  Coverage qualifier: `SMOKE_ONLY`; browser workflow coverage exists, but exact action execution is not proven.
- Runtime mapping: `COMPLETE`
- Canonical conformance: `PARTIAL`

### Open questions

- Should application produce a separate immutable governance record?

## `WEOS-ACT-007` - `APPROVE_CLUE_REVISION_DRAFT`

### Canonical interpretation

- Canonical action: `ACCEPT_CLUE_REVISION_DRAFT`
- Canonical action ID: Not proven.
- Canonical document:
  `docs/weos/WEOS-IMP-003-editorial-action-decision-catalogue.md`
- Canonical transition: clue revision draft accepted but not applied.
- Related open decisions: None identified.
- Open-decision dependency: `NONE_IDENTIFIED`
- Implementation gap: Should runtime `editor` be sufficient authority for draft acceptance?
- Gap tracking: `docs/weos/gaps/IMPLEMENTATION-GAPS.md`
- Interpretation confidence: Medium.

### Runtime mapping

- HTTP method: `POST`
- Route: `/admin/case-clue-revision-drafts/:draftId/approve`
- Request decision or body: Optional `note`.
- Controller path: `doctordle-backend/src/modules/admin/admin.controller.ts`
- Controller symbol: `AdminController.approveCaseClueRevisionDraft`
- Service path:
  `doctordle-backend/src/modules/admin/diagnosis-editorial-workspace.service.ts`
- Service symbol: `DiagnosisEditorialWorkspaceService.approveClueRevisionDraft`
- Repository path: Not proven.
- Repository symbol: Not proven.
- Other directly invoked services: None identified.

### Authority

- Route guard: `AdminGuard`
- Backend permission check: `@EditorialAccess()`
- Backend role requirement: runtime permission level `editor`
- Frontend eligibility: `analytics-dashboard/src/api/admin.ts`
  `approveCaseClueRevisionDraft`
- Canonical authority: Not proven.
- Authority mapping status: `PARTIAL`
- Evidence:
  `doctordle-backend/src/auth/editorial-permission.decorator.ts`

### State and persistence

- Runtime preconditions: Draft status in `PENDING_REVIEW`, `NEEDS_CHANGES`.
- Runtime transition: `CaseClueRevisionDraft.status -> APPROVED`.
- Exact runtime status literals: `PENDING_REVIEW`, `NEEDS_CHANGES`, `APPROVED`
- Models written: `CaseClueRevisionDraft`
- Principal persistence operation: `prisma.caseClueRevisionDraft.update`
- Canonical records written: Not proven.
- Projection fields written: `CaseClueRevisionDraft.status`
- Revision records written: None identified.
- Reviewer or actor fields written: `decisionByUserId`, `decisionAt`,
  `decisionNote`
- Other side effects: None identified.

### Governance and audit

- Audit classification: `ENTITY_REVIEW_FIELDS`
- Persisted decision record: Not proven; decision-like fields are stored on the entity row.
- Persisted event record: None identified.
- Entity review fields: `decisionByUserId`, `decisionAt`, `decisionNote`
- Service logging: None identified.
- Evidence: `DiagnosisEditorialWorkspaceService.decideClueRevisionDraft`
- Missing governance evidence: No immutable decision record proven.

### Transaction and concurrency

- Transaction isolation: `SINGLE_OPERATION_NO_EXPLICIT_TRANSACTION`
- Revision binding: `STATUS_GATE_ONLY`
- Expected-version input: `ABSENT`
- Stale-write rejection: `NOT_PROVEN`
- Status gating: Draft allowed-status check before update.
- Idempotency: None identified.
- Concurrency assessment: Check and update are not proven atomic.

### Verification

- Service tests:
  `doctordle-backend/src/modules/admin/diagnosis-editorial-workspace.service.spec.ts`
  Coverage qualifier: `FILE_EXISTS_ACTION_NOT_PROVEN`; the service test file
  exists, but exact action or request-decision coverage was not reverified in
  this documentation pass.
- Controller tests:
  `doctordle-backend/src/modules/admin/admin.controller.spec.ts`
  Coverage qualifier: `CONTROLLER_WIRING_ONLY`; verifies controller wiring for the mapped method.
- Dashboard unit tests:
  `analytics-dashboard/src/features/editorial/workspace/actions/workspaceActionRegistry.test.ts`
  Coverage qualifier: `ACTION_REGISTRY_ONLY`; verifies dashboard action registration, not backend enforcement.
- Browser tests:
  `analytics-dashboard/qa/editorial-workspace-smoke.spec.ts`
  Coverage qualifier: `SMOKE_ONLY`; browser workflow coverage exists, but exact action execution is not proven.
- Runtime mapping: `COMPLETE`
- Canonical conformance: `PARTIAL`

### Open questions

- Should runtime `editor` be sufficient authority for draft acceptance?

## `WEOS-ACT-008` - `REJECT_CLUE_REVISION_DRAFT`

### Canonical interpretation

- Canonical action: `REJECT_CLUE_REVISION_DRAFT`
- Canonical action ID: Not proven.
- Canonical document:
  `docs/weos/WEOS-IMP-003-editorial-action-decision-catalogue.md`
- Canonical transition: clue revision draft rejected.
- Related open decisions: None identified.
- Open-decision dependency: `NONE_IDENTIFIED`
- Implementation gap: Should rejection create a separate governance record?
- Gap tracking: `docs/weos/gaps/IMPLEMENTATION-GAPS.md`
- Interpretation confidence: Medium.

### Runtime mapping

- HTTP method: `POST`
- Route: `/admin/case-clue-revision-drafts/:draftId/reject`
- Request decision or body: Optional `note`.
- Controller path: `doctordle-backend/src/modules/admin/admin.controller.ts`
- Controller symbol: `AdminController.rejectCaseClueRevisionDraft`
- Service path:
  `doctordle-backend/src/modules/admin/diagnosis-editorial-workspace.service.ts`
- Service symbol: `DiagnosisEditorialWorkspaceService.rejectClueRevisionDraft`
- Repository path: Not proven.
- Repository symbol: Not proven.
- Other directly invoked services: None identified.

### Authority

- Route guard: `AdminGuard`
- Backend permission check: `@EditorialAccess()`
- Backend role requirement: runtime permission level `editor`
- Frontend eligibility: `analytics-dashboard/src/api/admin.ts`
  `rejectCaseClueRevisionDraft`
- Canonical authority: Not proven.
- Authority mapping status: `PARTIAL`
- Evidence:
  `doctordle-backend/src/auth/editorial-permission.decorator.ts`

### State and persistence

- Runtime preconditions: Draft status in `PENDING_REVIEW`, `NEEDS_CHANGES`.
- Runtime transition: `CaseClueRevisionDraft.status -> REJECTED`.
- Exact runtime status literals: `PENDING_REVIEW`, `NEEDS_CHANGES`, `REJECTED`
- Models written: `CaseClueRevisionDraft`
- Principal persistence operation: `prisma.caseClueRevisionDraft.update`
- Canonical records written: Not proven.
- Projection fields written: `CaseClueRevisionDraft.status`
- Revision records written: None identified.
- Reviewer or actor fields written: `decisionByUserId`, `decisionAt`,
  `decisionNote`
- Other side effects: None identified.

### Governance and audit

- Audit classification: `ENTITY_REVIEW_FIELDS`
- Persisted decision record: Not proven; decision-like fields are stored on the entity row.
- Persisted event record: None identified.
- Entity review fields: `decisionByUserId`, `decisionAt`, `decisionNote`
- Service logging: None identified.
- Evidence: `DiagnosisEditorialWorkspaceService.decideClueRevisionDraft`
- Missing governance evidence: No immutable decision record proven.

### Transaction and concurrency

- Transaction isolation: `SINGLE_OPERATION_NO_EXPLICIT_TRANSACTION`
- Revision binding: `STATUS_GATE_ONLY`
- Expected-version input: `ABSENT`
- Stale-write rejection: `NOT_PROVEN`
- Status gating: Draft allowed-status check before update.
- Idempotency: None identified.
- Concurrency assessment: Check and update are not proven atomic.

### Verification

- Service tests:
  `doctordle-backend/src/modules/admin/diagnosis-editorial-workspace.service.spec.ts`
  Coverage qualifier: `FILE_EXISTS_ACTION_NOT_PROVEN`; the service test file
  exists, but exact action or request-decision coverage was not reverified in
  this documentation pass.
- Controller tests:
  `doctordle-backend/src/modules/admin/admin.controller.spec.ts`
  Coverage qualifier: `CONTROLLER_WIRING_ONLY`; verifies controller wiring for the mapped method.
- Dashboard unit tests:
  `analytics-dashboard/src/features/editorial/workspace/actions/workspaceActionRegistry.test.ts`
  Coverage qualifier: `ACTION_REGISTRY_ONLY`; verifies dashboard action registration, not backend enforcement.
- Browser tests:
  `analytics-dashboard/qa/editorial-workspace-smoke.spec.ts`
  Coverage qualifier: `SMOKE_ONLY`; browser workflow coverage exists, but exact action execution is not proven.
- Runtime mapping: `COMPLETE`
- Canonical conformance: `PARTIAL`

### Open questions

- Should rejection create a separate governance record?

## `WEOS-ACT-008A` - `REQUEST_CHANGES_FOR_CLUE_REVISION_DRAFT`

### Canonical interpretation

- Canonical action: `REQUEST_CLUE_REVISION_DRAFT_CHANGES`
- Canonical action ID: Not proven.
- Canonical document:
  `docs/weos/WEOS-IMP-003-editorial-action-decision-catalogue.md`
- Canonical transition: clue revision draft returned for changes.
- Related open decisions: None identified.
- Open-decision dependency: `NONE_IDENTIFIED`
- Implementation gap: Is this canonical action distinct from generic `REQUIRE_REVISION`?
- Gap tracking: `docs/weos/gaps/IMPLEMENTATION-GAPS.md`
- Interpretation confidence: Medium.

### Runtime mapping

- HTTP method: `POST`
- Route: `/admin/case-clue-revision-drafts/:draftId/request-changes`
- Request decision or body: Optional `note`.
- Controller path: `doctordle-backend/src/modules/admin/admin.controller.ts`
- Controller symbol: `AdminController.requestChangesForCaseClueRevisionDraft`
- Service path:
  `doctordle-backend/src/modules/admin/diagnosis-editorial-workspace.service.ts`
- Service symbol:
  `DiagnosisEditorialWorkspaceService.requestChangesForClueRevisionDraft`
- Repository path: Not proven.
- Repository symbol: Not proven.
- Other directly invoked services: None identified.

### Authority

- Route guard: `AdminGuard`
- Backend permission check: `@EditorialAccess()`
- Backend role requirement: runtime permission level `editor`
- Frontend eligibility: `analytics-dashboard/src/api/admin.ts`
  `requestChangesForCaseClueRevisionDraft`
- Canonical authority: Not proven.
- Authority mapping status: `PARTIAL`
- Evidence:
  `doctordle-backend/src/auth/editorial-permission.decorator.ts`

### State and persistence

- Runtime preconditions: Draft status in `PENDING_REVIEW`, `NEEDS_CHANGES`.
- Runtime transition: `CaseClueRevisionDraft.status -> NEEDS_CHANGES`.
- Exact runtime status literals: `PENDING_REVIEW`, `NEEDS_CHANGES`
- Models written: `CaseClueRevisionDraft`
- Principal persistence operation: `prisma.caseClueRevisionDraft.update`
- Canonical records written: Not proven.
- Projection fields written: `CaseClueRevisionDraft.status`
- Revision records written: None identified.
- Reviewer or actor fields written: `decisionByUserId`, `decisionAt`,
  `decisionNote`
- Other side effects: None identified.

### Governance and audit

- Audit classification: `ENTITY_REVIEW_FIELDS`
- Persisted decision record: Not proven; decision-like fields are stored on the entity row.
- Persisted event record: None identified.
- Entity review fields: `decisionByUserId`, `decisionAt`, `decisionNote`
- Service logging: None identified.
- Evidence: `DiagnosisEditorialWorkspaceService.decideClueRevisionDraft`
- Missing governance evidence: No immutable decision record proven.

### Transaction and concurrency

- Transaction isolation: `SINGLE_OPERATION_NO_EXPLICIT_TRANSACTION`
- Revision binding: `STATUS_GATE_ONLY`
- Expected-version input: `ABSENT`
- Stale-write rejection: `NOT_PROVEN`
- Status gating: Draft allowed-status check before update.
- Idempotency: None identified.
- Concurrency assessment: Check and update are not proven atomic.

### Verification

- Service tests:
  `doctordle-backend/src/modules/admin/diagnosis-editorial-workspace.service.spec.ts`
  Coverage qualifier: `FILE_EXISTS_ACTION_NOT_PROVEN`; the service test file
  exists, but exact action or request-decision coverage was not reverified in
  this documentation pass.
- Controller tests:
  `doctordle-backend/src/modules/admin/admin.controller.spec.ts`
  Coverage qualifier: `CONTROLLER_WIRING_ONLY`; verifies controller wiring for the mapped method.
- Dashboard unit tests:
  `analytics-dashboard/src/features/editorial/workspace/actions/workspaceActionRegistry.test.ts`
  Coverage qualifier: `ACTION_REGISTRY_ONLY`; verifies dashboard action registration, not backend enforcement.
- Browser tests:
  `analytics-dashboard/qa/editorial-workspace-smoke.spec.ts`
  Coverage qualifier: `SMOKE_ONLY`; browser workflow coverage exists, but exact action execution is not proven.
- Runtime mapping: `COMPLETE`
- Canonical conformance: `PARTIAL`

### Open questions

- Is this canonical action distinct from generic `REQUIRE_REVISION`?

## `WEOS-ACT-008B` - `SUPERSEDE_CLUE_REVISION_DRAFT`

### Canonical interpretation

- Canonical action: `SUPERSEDE_CLUE_REVISION_DRAFT`
- Canonical action ID: Not proven.
- Canonical document:
  `docs/weos/WEOS-IMP-003-editorial-action-decision-catalogue.md`
- Canonical transition: clue revision draft superseded.
- Related open decisions: None identified.
- Open-decision dependency: `NONE_IDENTIFIED`
- Implementation gap: Should supersession require a replacement draft reference?
- Gap tracking: `docs/weos/gaps/IMPLEMENTATION-GAPS.md`
- Interpretation confidence: Medium.

### Runtime mapping

- HTTP method: `POST`
- Route: `/admin/case-clue-revision-drafts/:draftId/supersede`
- Request decision or body: Optional `note`.
- Controller path: `doctordle-backend/src/modules/admin/admin.controller.ts`
- Controller symbol: `AdminController.supersedeCaseClueRevisionDraft`
- Service path:
  `doctordle-backend/src/modules/admin/diagnosis-editorial-workspace.service.ts`
- Service symbol: `DiagnosisEditorialWorkspaceService.supersedeClueRevisionDraft`
- Repository path: Not proven.
- Repository symbol: Not proven.
- Other directly invoked services: None identified.

### Authority

- Route guard: `AdminGuard`
- Backend permission check: `@EditorialAccess()`
- Backend role requirement: runtime permission level `editor`
- Frontend eligibility: `analytics-dashboard/src/api/admin.ts`
  `supersedeCaseClueRevisionDraft`
- Canonical authority: Not proven.
- Authority mapping status: `PARTIAL`
- Evidence:
  `doctordle-backend/src/auth/editorial-permission.decorator.ts`

### State and persistence

- Runtime preconditions: Draft exists.
- Runtime transition: `CaseClueRevisionDraft.status -> SUPERSEDED`.
- Exact runtime status literals: `SUPERSEDED`
- Models written: `CaseClueRevisionDraft`
- Principal persistence operation: `prisma.caseClueRevisionDraft.update`
- Canonical records written: Not proven.
- Projection fields written: `CaseClueRevisionDraft.status`
- Revision records written: None identified.
- Reviewer or actor fields written: `decisionByUserId`, `decisionAt`,
  `decisionNote`
- Other side effects: None identified.

### Governance and audit

- Audit classification: `ENTITY_REVIEW_FIELDS`
- Persisted decision record: Not proven; decision-like fields are stored on the entity row.
- Persisted event record: None identified.
- Entity review fields: `decisionByUserId`, `decisionAt`, `decisionNote`
- Service logging: None identified.
- Evidence: `DiagnosisEditorialWorkspaceService.supersedeClueRevisionDraft`
- Missing governance evidence: No immutable supersession record proven.

### Transaction and concurrency

- Transaction isolation: `SINGLE_OPERATION_NO_EXPLICIT_TRANSACTION`
- Revision binding: `STATUS_GATE_ONLY`
- Expected-version input: `ABSENT`
- Stale-write rejection: `NOT_PROVEN`
- Status gating: Draft existence only was proven.
- Idempotency: None identified.
- Concurrency assessment: No expected-version input.

### Verification

- Service tests:
  `doctordle-backend/src/modules/admin/diagnosis-editorial-workspace.service.spec.ts`
  Coverage qualifier: `FILE_EXISTS_ACTION_NOT_PROVEN`; the service test file
  exists, but exact action or request-decision coverage was not reverified in
  this documentation pass.
- Controller tests:
  `doctordle-backend/src/modules/admin/admin.controller.spec.ts`
  Coverage qualifier: `CONTROLLER_WIRING_ONLY`; verifies controller wiring for the mapped method.
- Dashboard unit tests:
  `analytics-dashboard/src/features/editorial/workspace/actions/workspaceActionRegistry.test.ts`
  Coverage qualifier: `ACTION_REGISTRY_ONLY`; verifies dashboard action registration, not backend enforcement.
- Browser tests:
  `analytics-dashboard/qa/editorial-workspace-smoke.spec.ts`
  Coverage qualifier: `SMOKE_ONLY`; browser workflow coverage exists, but exact action execution is not proven.
- Runtime mapping: `COMPLETE`
- Canonical conformance: `PARTIAL`

### Open questions

- Should supersession require a replacement draft reference?

## `WEOS-ACT-009A` - `ACCEPT_AI_DRAFT`

### Canonical interpretation

- Canonical action: `ACCEPT_AI_DRAFT`
- Canonical action ID: Lifecycle row `AI_DRAFT_ACCEPT`.
- Canonical document:
  `docs/weos/WEOS-IMP-002-lifecycle-transition-specification.md`,
  `docs/weos/WEOS-IMP-003-editorial-action-decision-catalogue.md`
- Canonical transition: `AI_DRAFT PENDING_REVIEW -> ACCEPTED`.
- Related open decisions: None identified.
- Open-decision dependency: `NONE_IDENTIFIED`
- Implementation gap: Should AI draft acceptance be prevented from materializing clue draft output in the acceptance operation?
- Gap tracking: `docs/weos/gaps/IMPLEMENTATION-GAPS.md`
- Interpretation confidence: High.

### Runtime mapping

- HTTP method: `POST`
- Route:
  `/admin/diagnosis-workspace/:diagnosisRegistryId/ai-drafts/:auditId/accept`
- Request decision or body: Controller passes `decision: accept`; frontend path
  literal is `accept`.
- Controller path: `doctordle-backend/src/modules/admin/admin.controller.ts`
- Controller symbol: `AdminController.acceptAiDraftRevision`
- Service path:
  `doctordle-backend/src/modules/admin/diagnosis-editorial-workspace.service.ts`
- Service symbol: `DiagnosisEditorialWorkspaceService.decideAiDraftRevision`
- Repository path: Not proven.
- Repository symbol: Not proven.
- Other directly invoked services:
  `DiagnosisEditorialWorkspaceService.applyAcceptedDraftOutput`

### Authority

- Route guard: `AdminGuard`
- Backend permission check: `@EditorialAccess()`
- Backend role requirement: runtime permission level `editor`
- Frontend eligibility: `analytics-dashboard/src/api/admin.ts`
  `decideAiDraftRevision`
- Canonical authority: Required authority exists canonically, but runtime
  equivalence is not proven.
- Authority mapping status: `PARTIAL`
- Evidence:
  `doctordle-backend/src/auth/editorial-permission.decorator.ts`,
  `analytics-dashboard/src/api/admin.types.ts`

### State and persistence

- Runtime preconditions: `AiDraftRevisionAudit` found for diagnosis.
- Runtime transition: `reviewStatus` derived by `reviewStatusForDecision`;
  accepted draft may create a `CaseClueRevisionDraft`.
- Exact runtime status literals: `accept`, `accepted_audit_only`,
  `materialized`, `PENDING_REVIEW`
- Models written: `AiDraftRevisionAudit`; sometimes `CaseClueRevisionDraft`
- Principal persistence operation: `prisma.aiDraftRevisionAudit.update`; optional `prisma.caseClueRevisionDraft.create`
- Canonical records written: Not proven.
- Projection fields written: `editorDecision`, `reviewStatus`,
  `reviewerUserId`, `decisionAt`, `reviewNote`
- Revision records written: None identified.
- Reviewer or actor fields written: `AiDraftRevisionAudit.reviewerUserId`
- Other side effects: materialization may create a clue revision draft.

### Governance and audit

- Audit classification: `PERSISTED_AUDIT_RECORD`, `ENTITY_REVIEW_FIELDS`
- Persisted decision record: Not proven as a separate append-only decision event.
- Persisted audit record: `AiDraftRevisionAudit`
- Persisted event record: Not proven
- Entity review fields: `editorDecision`, `reviewStatus`, `decisionAt`
- Service logging: None identified.
- Evidence: `DiagnosisEditorialWorkspaceService.decideAiDraftRevision`
- Missing governance evidence: Audit row is not proven to satisfy generic
  `EDITORIAL_DECISION`.

### Transaction and concurrency

- Transaction isolation: `NO_TRANSACTION_IDENTIFIED`
- Revision binding: `STATUS_GATE_ONLY`
- Expected-version input: `ABSENT`
- Stale-write rejection: `NOT_PROVEN`
- Status gating: Audit lookup; materialization target case editability check.
- Idempotency: Materialization checks existing `sourceAuditId`.
- Concurrency assessment: No expected-version input; materialization idempotency
  is limited to clue draft creation.

### Verification

- Service tests:
  `doctordle-backend/src/modules/admin/diagnosis-editorial-workspace.service.spec.ts`
  Coverage qualifier: `FILE_EXISTS_ACTION_NOT_PROVEN`; the service test file
  exists, but exact action or request-decision coverage was not reverified in
  this documentation pass.
- Controller tests:
  `doctordle-backend/src/modules/admin/admin.controller.spec.ts`
  Coverage qualifier: `CONTROLLER_WIRING_ONLY`; verifies controller wiring for the mapped method.
- Dashboard unit tests:
  `analytics-dashboard/src/features/editorial/workspace/actions/workspaceActionRegistry.test.ts`
  Coverage qualifier: `ACTION_REGISTRY_ONLY`; verifies dashboard action registration, not backend enforcement.
- Browser tests:
  `analytics-dashboard/qa/editorial-workspace-smoke.spec.ts`
  Coverage qualifier: `SMOKE_ONLY`; browser workflow coverage exists, but exact action execution is not proven.
- Runtime mapping: `COMPLETE`
- Canonical conformance: `PARTIAL`

### Open questions

- Should AI draft acceptance be prevented from materializing clue draft output in
  the acceptance operation?

## `WEOS-ACT-009B` - `REJECT_AI_DRAFT`

### Canonical interpretation

- Canonical action: `REJECT_AI_DRAFT`
- Canonical action ID: Not proven as a lifecycle row ID.
- Canonical document:
  `docs/weos/WEOS-IMP-003-editorial-action-decision-catalogue.md`
- Canonical transition: AI draft rejected.
- Related open decisions: None identified.
- Open-decision dependency: `NONE_IDENTIFIED`
- Implementation gap: Should rejection require a structured rationale?
- Gap tracking: `docs/weos/gaps/IMPLEMENTATION-GAPS.md`
- Interpretation confidence: High.

### Runtime mapping

- HTTP method: `POST`
- Route:
  `/admin/diagnosis-workspace/:diagnosisRegistryId/ai-drafts/:auditId/reject`
- Request decision or body: Controller passes `decision: reject`; frontend path
  literal is `reject`.
- Controller path: `doctordle-backend/src/modules/admin/admin.controller.ts`
- Controller symbol: `AdminController.rejectAiDraftRevision`
- Service path:
  `doctordle-backend/src/modules/admin/diagnosis-editorial-workspace.service.ts`
- Service symbol: `DiagnosisEditorialWorkspaceService.decideAiDraftRevision`
- Repository path: Not proven.
- Repository symbol: Not proven.
- Other directly invoked services: None identified.

### Authority

- Route guard: `AdminGuard`
- Backend permission check: `@EditorialAccess()`
- Backend role requirement: runtime permission level `editor`
- Frontend eligibility: `analytics-dashboard/src/api/admin.ts`
  `decideAiDraftRevision`
- Canonical authority: Not proven.
- Authority mapping status: `PARTIAL`
- Evidence: `doctordle-backend/src/auth/editorial-permission.decorator.ts`

### State and persistence

- Runtime preconditions: `AiDraftRevisionAudit` found for diagnosis.
- Runtime transition: `reviewStatus` derived by `reviewStatusForDecision`.
- Exact runtime status literals: `reject`
- Models written: `AiDraftRevisionAudit`
- Principal persistence operation: `prisma.aiDraftRevisionAudit.update`
- Canonical records written: Not proven.
- Projection fields written: `editorDecision`, `reviewStatus`,
  `reviewerUserId`, `decisionAt`, `reviewNote`
- Revision records written: None identified.
- Reviewer or actor fields written: `AiDraftRevisionAudit.reviewerUserId`
- Other side effects: None identified.

### Governance and audit

- Audit classification: `PERSISTED_AUDIT_RECORD`, `ENTITY_REVIEW_FIELDS`
- Persisted decision record: Not proven as a separate append-only decision event.
- Persisted audit record: `AiDraftRevisionAudit`
- Persisted event record: Not proven
- Entity review fields: `editorDecision`, `reviewStatus`, `decisionAt`
- Service logging: None identified.
- Evidence: `DiagnosisEditorialWorkspaceService.decideAiDraftRevision`
- Missing governance evidence: Audit row is not proven as canonical
  `EDITORIAL_DECISION`.

### Transaction and concurrency

- Transaction isolation: `SINGLE_OPERATION_NO_EXPLICIT_TRANSACTION`
- Revision binding: `STATUS_GATE_ONLY`
- Expected-version input: `ABSENT`
- Stale-write rejection: `NOT_PROVEN`
- Status gating: Audit lookup only was proven.
- Idempotency: None identified.
- Concurrency assessment: No expected-version input.

### Verification

- Service tests:
  `doctordle-backend/src/modules/admin/diagnosis-editorial-workspace.service.spec.ts`
  Coverage qualifier: `FILE_EXISTS_ACTION_NOT_PROVEN`; the service test file
  exists, but exact action or request-decision coverage was not reverified in
  this documentation pass.
- Controller tests:
  `doctordle-backend/src/modules/admin/admin.controller.spec.ts`
  Coverage qualifier: `CONTROLLER_WIRING_ONLY`; verifies controller wiring for the mapped method.
- Dashboard unit tests:
  `analytics-dashboard/src/features/editorial/workspace/actions/workspaceActionRegistry.test.ts`
  Coverage qualifier: `ACTION_REGISTRY_ONLY`; verifies dashboard action registration, not backend enforcement.
- Browser tests:
  `analytics-dashboard/qa/editorial-workspace-smoke.spec.ts`
  Coverage qualifier: `SMOKE_ONLY`; browser workflow coverage exists, but exact action execution is not proven.
- Runtime mapping: `COMPLETE`
- Canonical conformance: `PARTIAL`

### Open questions

- Should rejection require a structured rationale?

## `WEOS-ACT-009C` - `REQUEST_AI_DRAFT_CHANGES`

### Canonical interpretation

- Canonical action: `REQUEST_AI_DRAFT_CHANGES`
- Canonical action ID: Not proven as a lifecycle row ID.
- Canonical document:
  `docs/weos/WEOS-IMP-003-editorial-action-decision-catalogue.md`
- Canonical transition: AI draft returned for changes.
- Related open decisions: None identified.
- Open-decision dependency: `NONE_IDENTIFIED`
- Implementation gap: Should backend and frontend use matching literal spelling?
- Gap tracking: `docs/weos/gaps/IMPLEMENTATION-GAPS.md`
- Interpretation confidence: High.

### Runtime mapping

- HTTP method: `POST`
- Route:
  `/admin/diagnosis-workspace/:diagnosisRegistryId/ai-drafts/:auditId/request-changes`
- Request decision or body: Controller passes `decision: request_changes`;
  frontend path literal is `request-changes`.
- Controller path: `doctordle-backend/src/modules/admin/admin.controller.ts`
- Controller symbol: `AdminController.requestAiDraftRevisionChanges`
- Service path:
  `doctordle-backend/src/modules/admin/diagnosis-editorial-workspace.service.ts`
- Service symbol: `DiagnosisEditorialWorkspaceService.decideAiDraftRevision`
- Repository path: Not proven.
- Repository symbol: Not proven.
- Other directly invoked services: None identified.

### Authority

- Route guard: `AdminGuard`
- Backend permission check: `@EditorialAccess()`
- Backend role requirement: runtime permission level `editor`
- Frontend eligibility: `analytics-dashboard/src/api/admin.ts`
  `decideAiDraftRevision`
- Canonical authority: Not proven.
- Authority mapping status: `PARTIAL`
- Evidence: `doctordle-backend/src/auth/editorial-permission.decorator.ts`

### State and persistence

- Runtime preconditions: `AiDraftRevisionAudit` found for diagnosis.
- Runtime transition: `reviewStatus` derived by `reviewStatusForDecision`.
- Exact runtime status literals: `request_changes`, `request-changes`
- Models written: `AiDraftRevisionAudit`
- Principal persistence operation: `prisma.aiDraftRevisionAudit.update`
- Canonical records written: Not proven.
- Projection fields written: `editorDecision`, `reviewStatus`,
  `reviewerUserId`, `decisionAt`, `reviewNote`
- Revision records written: None identified.
- Reviewer or actor fields written: `AiDraftRevisionAudit.reviewerUserId`
- Other side effects: None identified.

### Governance and audit

- Audit classification: `PERSISTED_AUDIT_RECORD`, `ENTITY_REVIEW_FIELDS`
- Persisted decision record: Not proven as a separate append-only decision event.
- Persisted audit record: `AiDraftRevisionAudit`
- Persisted event record: Not proven
- Entity review fields: `editorDecision`, `reviewStatus`, `decisionAt`
- Service logging: None identified.
- Evidence: `DiagnosisEditorialWorkspaceService.decideAiDraftRevision`
- Missing governance evidence: Audit row is not proven as canonical
  `EDITORIAL_DECISION`.

### Transaction and concurrency

- Transaction isolation: `SINGLE_OPERATION_NO_EXPLICIT_TRANSACTION`
- Revision binding: `STATUS_GATE_ONLY`
- Expected-version input: `ABSENT`
- Stale-write rejection: `NOT_PROVEN`
- Status gating: Audit lookup only was proven.
- Idempotency: None identified.
- Concurrency assessment: No expected-version input.

### Verification

- Service tests:
  `doctordle-backend/src/modules/admin/diagnosis-editorial-workspace.service.spec.ts`
  Coverage qualifier: `FILE_EXISTS_ACTION_NOT_PROVEN`; the service test file
  exists, but exact action or request-decision coverage was not reverified in
  this documentation pass.
- Controller tests:
  `doctordle-backend/src/modules/admin/admin.controller.spec.ts`
  Coverage qualifier: `CONTROLLER_WIRING_ONLY`; verifies controller wiring for the mapped method.
- Dashboard unit tests:
  `analytics-dashboard/src/features/editorial/workspace/actions/workspaceActionRegistry.test.ts`
  Coverage qualifier: `ACTION_REGISTRY_ONLY`; verifies dashboard action registration, not backend enforcement.
- Browser tests:
  `analytics-dashboard/qa/editorial-workspace-smoke.spec.ts`
  Coverage qualifier: `SMOKE_ONLY`; browser workflow coverage exists, but exact action execution is not proven.
- Runtime mapping: `COMPLETE`
- Canonical conformance: `PARTIAL`

### Open questions

- Should backend and frontend use matching literal spelling?

## `WEOS-ACT-009D` - `SUPERSEDE_AI_DRAFT`

### Canonical interpretation

- Canonical action: `SUPERSEDE_AI_DRAFT`
- Canonical action ID: Not proven.
- Canonical document:
  `docs/weos/WEOS-IMP-003-editorial-action-decision-catalogue.md`
- Canonical transition: AI draft superseded.
- Related open decisions: None identified.
- Open-decision dependency: `NONE_IDENTIFIED`
- Implementation gap: Should supersession require a successor draft identity?
- Gap tracking: `docs/weos/gaps/IMPLEMENTATION-GAPS.md`
- Interpretation confidence: Medium.

### Runtime mapping

- HTTP method: `POST`
- Route:
  `/admin/diagnosis-workspace/:diagnosisRegistryId/ai-drafts/:auditId/supersede`
- Request decision or body: Controller passes `decision: supersede`; frontend
  path literal is `supersede`.
- Controller path: `doctordle-backend/src/modules/admin/admin.controller.ts`
- Controller symbol: `AdminController.supersedeAiDraftRevision`
- Service path:
  `doctordle-backend/src/modules/admin/diagnosis-editorial-workspace.service.ts`
- Service symbol: `DiagnosisEditorialWorkspaceService.decideAiDraftRevision`
- Repository path: Not proven.
- Repository symbol: Not proven.
- Other directly invoked services: None identified.

### Authority

- Route guard: `AdminGuard`
- Backend permission check: `@EditorialAccess()`
- Backend role requirement: runtime permission level `editor`
- Frontend eligibility: `analytics-dashboard/src/api/admin.ts`
  `decideAiDraftRevision`
- Canonical authority: Not proven.
- Authority mapping status: `PARTIAL`
- Evidence: `doctordle-backend/src/auth/editorial-permission.decorator.ts`

### State and persistence

- Runtime preconditions: `AiDraftRevisionAudit` found for diagnosis.
- Runtime transition: `reviewStatus` derived by `reviewStatusForDecision`.
- Exact runtime status literals: `supersede`
- Models written: `AiDraftRevisionAudit`
- Principal persistence operation: `prisma.aiDraftRevisionAudit.update`
- Canonical records written: Not proven.
- Projection fields written: `editorDecision`, `reviewStatus`,
  `reviewerUserId`, `decisionAt`, `reviewNote`
- Revision records written: None identified.
- Reviewer or actor fields written: `AiDraftRevisionAudit.reviewerUserId`
- Other side effects: None identified.

### Governance and audit

- Audit classification: `PERSISTED_AUDIT_RECORD`, `ENTITY_REVIEW_FIELDS`
- Persisted decision record: Not proven as a separate append-only decision event.
- Persisted audit record: `AiDraftRevisionAudit`
- Persisted event record: Not proven
- Entity review fields: `editorDecision`, `reviewStatus`, `decisionAt`
- Service logging: None identified.
- Evidence: `DiagnosisEditorialWorkspaceService.decideAiDraftRevision`
- Missing governance evidence: No replacement audit binding proven.

### Transaction and concurrency

- Transaction isolation: `SINGLE_OPERATION_NO_EXPLICIT_TRANSACTION`
- Revision binding: `STATUS_GATE_ONLY`
- Expected-version input: `ABSENT`
- Stale-write rejection: `NOT_PROVEN`
- Status gating: Audit lookup only was proven.
- Idempotency: None identified.
- Concurrency assessment: No expected-version input.

### Verification

- Service tests:
  `doctordle-backend/src/modules/admin/diagnosis-editorial-workspace.service.spec.ts`
  Coverage qualifier: `FILE_EXISTS_ACTION_NOT_PROVEN`; the service test file
  exists, but exact action or request-decision coverage was not reverified in
  this documentation pass.
- Controller tests:
  `doctordle-backend/src/modules/admin/admin.controller.spec.ts`
  Coverage qualifier: `CONTROLLER_WIRING_ONLY`; verifies controller wiring for the mapped method.
- Dashboard unit tests:
  `analytics-dashboard/src/features/editorial/workspace/actions/workspaceActionRegistry.test.ts`
  Coverage qualifier: `ACTION_REGISTRY_ONLY`; verifies dashboard action registration, not backend enforcement.
- Browser tests:
  `analytics-dashboard/qa/editorial-workspace-smoke.spec.ts`
  Coverage qualifier: `SMOKE_ONLY`; browser workflow coverage exists, but exact action execution is not proven.
- Runtime mapping: `COMPLETE`
- Canonical conformance: `PARTIAL`

### Open questions

- Should supersession require a successor draft identity?

## `WEOS-ACT-010` - `ACTIVATE_REGISTRY_ENTRY`

### Canonical interpretation

- Canonical action: `ACTIVATE_REGISTRY_ENTRY`
- Canonical action ID: Not proven as a row-specific ID.
- Canonical document:
  `docs/weos/WEOS-IMP-003-editorial-action-decision-catalogue.md`
- Canonical transition: registry entry becomes active.
- Related open decisions: None identified.
- Open-decision dependency: `NONE_IDENTIFIED`
- Implementation gap: What canonical authority approves registry activation?
- Gap tracking: `docs/weos/gaps/IMPLEMENTATION-GAPS.md`
- Interpretation confidence: Medium.

### Runtime mapping

- HTTP method: `POST`
- Route: `/admin/diagnosis-registry/:diagnosisRegistryId/lifecycle/action`
- Request decision or body: `action: activate`
- Controller path: `doctordle-backend/src/modules/admin/admin.controller.ts`
- Controller symbol: `AdminController.updateDiagnosisRegistryLifecycle`
- Service path:
  `doctordle-backend/src/modules/diagnosis-registry/diagnosis-registry-lifecycle-policy.service.ts`
- Service symbol: `DiagnosisRegistryLifecyclePolicyService.performAction`
- Repository path: Not proven.
- Repository symbol: Not proven.
- Other directly invoked services:
  `DiagnosisRegistryLifecycleTelemetryService.recordAction` if wired by service.

### Authority

- Route guard: `AdminGuard`
- Backend permission check: `@SeniorEditorialAccess()`
- Backend role requirement: runtime permission level `senior`
- Frontend eligibility: Not proven from backend route alone.
- Canonical authority: Not proven equivalent to runtime `senior`.
- Authority mapping status: `PARTIAL`
- Evidence:
  `doctordle-backend/src/modules/admin/admin.controller.ts`,
  `doctordle-backend/src/modules/admin/admin-editorial-permissions.spec.ts`
  Coverage qualifier: `PERMISSION_ONLY`; verifies access level for the mapped controller route.

### State and persistence

- Runtime preconditions: Readiness evaluation for `activate` passes.
- Runtime transition: `DiagnosisRegistry.status -> ACTIVE`; `active -> true`.
- Exact runtime status literals: `activate`, `ACTIVE`
- Models written: `DiagnosisRegistry`
- Principal persistence operation: `prisma.diagnosisRegistry.update`
- Canonical records written: Not proven.
- Projection fields written: `status`, `active`,
  `activationReviewedByUser`, `activationReviewedAt`
- Revision records written: None identified.
- Reviewer or actor fields written: `activationReviewedByUser`,
  `activationReviewedAt`
- Other side effects: telemetry event name
  `diagnosis.lifecycle.activated`.

### Governance and audit

- Audit classification: `ENTITY_REVIEW_FIELDS`, `SERVICE_LOG_ONLY`
- Persisted decision record: None identified.
- Persisted event record: Not proven.
- Entity review fields: `activationReviewedByUser`,
  `activationReviewedAt`
- Service logging: telemetry or logger not treated as persisted audit evidence.
- Evidence:
  `DiagnosisRegistryLifecyclePolicyService.getActionUpdate`,
  `DiagnosisRegistryLifecyclePolicyService.getActionEvent`
- Missing governance evidence: No generic governance record proven.

### Transaction and concurrency

- Transaction isolation: `NO_TRANSACTION_IDENTIFIED`
- Revision binding: `STATUS_GATE_ONLY`
- Expected-version input: `ABSENT`
- Stale-write rejection: `NOT_PROVEN`
- Status gating: Readiness evaluation.
- Idempotency: None identified.
- Concurrency assessment: No expected-version input.

### Verification

- Service tests:
  `doctordle-backend/src/modules/diagnosis-registry/diagnosis-registry-lifecycle-policy.service.spec.ts`
  Coverage qualifier: `FILE_EXISTS_ACTION_NOT_PROVEN`; the service test file
  exists, but exact action or request-decision coverage was not reverified in
  this documentation pass.
- Permission tests:
  `doctordle-backend/src/modules/admin/admin-editorial-permissions.spec.ts`
  Coverage qualifier: `PERMISSION_ONLY`; verifies access level for the mapped controller route.
- Dashboard unit tests:
  `analytics-dashboard/src/features/editorial/workspace/actions/workspaceActionRegistry.test.ts`
  Coverage qualifier: `ACTION_REGISTRY_ONLY`; verifies dashboard action registration, not backend enforcement.
- Browser tests:
  `analytics-dashboard/qa/editorial-workspace-smoke.spec.ts`
  Coverage qualifier: `SMOKE_ONLY`; browser workflow coverage exists, but exact action execution is not proven.
- Runtime mapping: `COMPLETE`
- Canonical conformance: `PARTIAL`

### Open questions

- What canonical authority approves registry activation?

## `WEOS-ACT-011A` - `HIDE_REGISTRY_ENTRY`

### Canonical interpretation

- Canonical action: `HIDE_REGISTRY_ENTRY`
- Canonical action ID: Not proven.
- Canonical document:
  `docs/weos/WEOS-IMP-003-editorial-action-decision-catalogue.md`
- Canonical transition: registry entry hidden from active use.
- Related open decisions: None identified.
- Open-decision dependency: `NONE_IDENTIFIED`
- Implementation gap: Is runtime `deactivate` the approved canonical hide action?
- Gap tracking: `docs/weos/gaps/IMPLEMENTATION-GAPS.md`
- Interpretation confidence: Medium.

### Runtime mapping

- HTTP method: `POST`
- Route: `/admin/diagnosis-registry/:diagnosisRegistryId/lifecycle/action`
- Request decision or body: `action: deactivate`
- Controller path: `doctordle-backend/src/modules/admin/admin.controller.ts`
- Controller symbol: `AdminController.updateDiagnosisRegistryLifecycle`
- Service path:
  `doctordle-backend/src/modules/diagnosis-registry/diagnosis-registry-lifecycle-policy.service.ts`
- Service symbol: `DiagnosisRegistryLifecyclePolicyService.performAction`
- Repository path: Not proven.
- Repository symbol: Not proven.
- Other directly invoked services:
  `DiagnosisRegistryLifecycleTelemetryService.recordAction` if wired by service.

### Authority

- Route guard: `AdminGuard`
- Backend permission check: `@SeniorEditorialAccess()`
- Backend role requirement: runtime permission level `senior`
- Frontend eligibility: Not proven from backend route alone.
- Canonical authority: Not proven.
- Authority mapping status: `PARTIAL`
- Evidence:
  `doctordle-backend/src/modules/admin/admin.controller.ts`,
  `doctordle-backend/src/modules/admin/admin-editorial-permissions.spec.ts`
  Coverage qualifier: `PERMISSION_ONLY`; verifies access level for the mapped controller route.

### State and persistence

- Runtime preconditions: Registry exists.
- Runtime transition: `DiagnosisRegistry.status -> HIDDEN`; `active -> false`;
  `isPlayable -> false`; `isGeneratable -> false`.
- Exact runtime status literals: `deactivate`, `HIDDEN`
- Models written: `DiagnosisRegistry`
- Principal persistence operation: `prisma.diagnosisRegistry.update`
- Canonical records written: Not proven.
- Projection fields written: `status`, `active`, `isPlayable`,
  `isGeneratable`
- Revision records written: None identified.
- Reviewer or actor fields written: None identified for this action.
- Other side effects: telemetry event name `diagnosis.lifecycle.deactivated`.

### Governance and audit

- Audit classification: `ENTITY_STATUS_ONLY`, `SERVICE_LOG_ONLY`
- Persisted decision record: None identified.
- Persisted event record: Not proven.
- Entity review fields: None identified.
- Service logging: telemetry or logger not treated as persisted audit evidence.
- Evidence: `DiagnosisRegistryLifecyclePolicyService.getActionUpdate`
- Missing governance evidence: No rationale or decision record proven.

### Transaction and concurrency

- Transaction isolation: `NO_TRANSACTION_IDENTIFIED`
- Revision binding: `STATUS_GATE_ONLY`
- Expected-version input: `ABSENT`
- Stale-write rejection: `NOT_PROVEN`
- Status gating: Registry lookup and policy evaluation.
- Idempotency: None identified.
- Concurrency assessment: No expected-version input.

### Verification

- Service tests:
  `doctordle-backend/src/modules/diagnosis-registry/diagnosis-registry-lifecycle-policy.service.spec.ts`
  Coverage qualifier: `FILE_EXISTS_ACTION_NOT_PROVEN`; the service test file
  exists, but exact action or request-decision coverage was not reverified in
  this documentation pass.
- Permission tests:
  `doctordle-backend/src/modules/admin/admin-editorial-permissions.spec.ts`
  Coverage qualifier: `PERMISSION_ONLY`; verifies access level for the mapped controller route.
- Dashboard unit tests:
  `analytics-dashboard/src/features/editorial/workspace/actions/workspaceActionRegistry.test.ts`
  Coverage qualifier: `ACTION_REGISTRY_ONLY`; verifies dashboard action registration, not backend enforcement.
- Browser tests:
  `analytics-dashboard/qa/editorial-workspace-smoke.spec.ts`
  Coverage qualifier: `SMOKE_ONLY`; browser workflow coverage exists, but exact action execution is not proven.
- Runtime mapping: `COMPLETE`
- Canonical conformance: `PARTIAL`

### Open questions

- Is runtime `deactivate` the approved canonical hide action?

## `WEOS-ACT-012A` - `GRANT_PLAYABILITY`

### Canonical interpretation

- Canonical action: `GRANT_PLAYABILITY`
- Canonical action ID: Not proven.
- Canonical document:
  `docs/weos/WEOS-IMP-003-editorial-action-decision-catalogue.md`
- Canonical transition: operational playability permission granted.
- Related open decisions:
  `docs/weos/phase-2-review/REVIEW-CHECKLIST.md`
- Open-decision ID: `WEOS-OD-012`
- Open-decision document: `docs/weos/WEOS-IMP-005-phase-2-open-decisions.md`
- Relevant question: Are operational permission expiries required?
- Interpretation confidence: Medium.

### Runtime mapping

- HTTP method: `POST`
- Route: `/admin/diagnosis-registry/:diagnosisRegistryId/lifecycle/action`
- Request decision or body: `action: mark_playable`
- Controller path: `doctordle-backend/src/modules/admin/admin.controller.ts`
- Controller symbol: `AdminController.updateDiagnosisRegistryLifecycle`
- Service path:
  `doctordle-backend/src/modules/diagnosis-registry/diagnosis-registry-lifecycle-policy.service.ts`
- Service symbol: `DiagnosisRegistryLifecyclePolicyService.performAction`
- Repository path: Not proven.
- Repository symbol: Not proven.
- Other directly invoked services: None identified.

### Authority

- Route guard: `AdminGuard`
- Backend permission check: `@SeniorEditorialAccess()`
- Backend role requirement: runtime permission level `senior`
- Frontend eligibility: Not proven from backend route alone.
- Canonical authority: Not proven.
- Authority mapping status: `PARTIAL`
- Evidence: `doctordle-backend/src/modules/admin/admin.controller.ts`

### State and persistence

- Runtime preconditions: Playability readiness evaluation passes.
- Runtime transition: `DiagnosisRegistry.isPlayable -> true`.
- Exact runtime status literals: `mark_playable`
- Models written: `DiagnosisRegistry`
- Principal persistence operation: `prisma.diagnosisRegistry.update`
- Canonical records written: Not proven.
- Projection fields written: `isPlayable`
- Revision records written: None identified.
- Reviewer or actor fields written: None identified.
- Other side effects: telemetry event name
  `diagnosis.lifecycle.playable_enabled`.

### Governance and audit

- Audit classification: `ENTITY_STATUS_ONLY`, `SERVICE_LOG_ONLY`
- Persisted decision record: None identified.
- Persisted event record: Not proven.
- Entity review fields: None identified.
- Service logging: telemetry or logger not treated as persisted audit evidence.
- Evidence: `DiagnosisRegistryLifecyclePolicyService.getActionUpdate`
- Missing governance evidence: No permission-standing record with rationale.

### Transaction and concurrency

- Transaction isolation: `NO_TRANSACTION_IDENTIFIED`
- Revision binding: `STATUS_GATE_ONLY`
- Expected-version input: `ABSENT`
- Stale-write rejection: `NOT_PROVEN`
- Status gating: Readiness evaluation.
- Idempotency: None identified.
- Concurrency assessment: No expected-version input.

### Verification

- Service tests:
  `doctordle-backend/src/modules/diagnosis-registry/diagnosis-registry-lifecycle-policy.service.spec.ts`
  Coverage qualifier: `FILE_EXISTS_ACTION_NOT_PROVEN`; the service test file
  exists, but exact action or request-decision coverage was not reverified in
  this documentation pass.
- Controller tests: None identified.
- Dashboard unit tests:
  `analytics-dashboard/src/features/editorial/workspace/actions/workspaceActionRegistry.test.ts`
  Coverage qualifier: `ACTION_REGISTRY_ONLY`; verifies dashboard action registration, not backend enforcement.
- Browser tests:
  `analytics-dashboard/qa/editorial-workspace-smoke.spec.ts`
  Coverage qualifier: `SMOKE_ONLY`; browser workflow coverage exists, but exact action execution is not proven.
- Runtime mapping: `COMPLETE`
- Canonical conformance: `PARTIAL`

### Open questions

- Should playability have expiry or review metadata?

## `WEOS-ACT-012B` - `REMOVE_PLAYABILITY`

### Canonical interpretation

- Canonical action: `REMOVE_PLAYABILITY`
- Canonical action ID: Not proven.
- Canonical document:
  `docs/weos/WEOS-IMP-003-editorial-action-decision-catalogue.md`
- Canonical transition: operational playability permission removed.
- Related open decisions:
  `docs/weos/phase-2-review/REVIEW-CHECKLIST.md`
- Open-decision ID: `WEOS-OD-012`
- Open-decision document: `docs/weos/WEOS-IMP-005-phase-2-open-decisions.md`
- Relevant question: Are operational permission expiries required?
- Interpretation confidence: Medium.

### Runtime mapping

- HTTP method: `POST`
- Route: `/admin/diagnosis-registry/:diagnosisRegistryId/lifecycle/action`
- Request decision or body: `action: unmark_playable`
- Controller path: `doctordle-backend/src/modules/admin/admin.controller.ts`
- Controller symbol: `AdminController.updateDiagnosisRegistryLifecycle`
- Service path:
  `doctordle-backend/src/modules/diagnosis-registry/diagnosis-registry-lifecycle-policy.service.ts`
- Service symbol: `DiagnosisRegistryLifecyclePolicyService.performAction`
- Repository path: Not proven.
- Repository symbol: Not proven.
- Other directly invoked services: None identified.

### Authority

- Route guard: `AdminGuard`
- Backend permission check: `@SeniorEditorialAccess()`
- Backend role requirement: runtime permission level `senior`
- Frontend eligibility: Not proven from backend route alone.
- Canonical authority: Not proven.
- Authority mapping status: `PARTIAL`
- Evidence: `doctordle-backend/src/modules/admin/admin.controller.ts`

### State and persistence

- Runtime preconditions: Registry exists.
- Runtime transition: `DiagnosisRegistry.isPlayable -> false`;
  `DiagnosisRegistry.isGeneratable -> false`.
- Exact runtime status literals: `unmark_playable`
- Models written: `DiagnosisRegistry`
- Principal persistence operation: `prisma.diagnosisRegistry.update`
- Canonical records written: Not proven.
- Projection fields written: `isPlayable`, `isGeneratable`
- Revision records written: None identified.
- Reviewer or actor fields written: None identified.
- Other side effects: telemetry event name
  `diagnosis.lifecycle.playable_disabled`.

### Governance and audit

- Audit classification: `ENTITY_STATUS_ONLY`, `SERVICE_LOG_ONLY`
- Persisted decision record: None identified.
- Persisted event record: Not proven.
- Entity review fields: None identified.
- Service logging: telemetry or logger not treated as persisted audit evidence.
- Evidence: `DiagnosisRegistryLifecyclePolicyService.getActionUpdate`
- Missing governance evidence: No permission-standing record with rationale.

### Transaction and concurrency

- Transaction isolation: `NO_TRANSACTION_IDENTIFIED`
- Revision binding: `STATUS_GATE_ONLY`
- Expected-version input: `ABSENT`
- Stale-write rejection: `NOT_PROVEN`
- Status gating: Registry lookup and policy evaluation.
- Idempotency: None identified.
- Concurrency assessment: No expected-version input.

### Verification

- Service tests:
  `doctordle-backend/src/modules/diagnosis-registry/diagnosis-registry-lifecycle-policy.service.spec.ts`
  Coverage qualifier: `FILE_EXISTS_ACTION_NOT_PROVEN`; the service test file
  exists, but exact action or request-decision coverage was not reverified in
  this documentation pass.
- Controller tests: None identified.
- Dashboard unit tests:
  `analytics-dashboard/src/features/editorial/workspace/actions/workspaceActionRegistry.test.ts`
  Coverage qualifier: `ACTION_REGISTRY_ONLY`; verifies dashboard action registration, not backend enforcement.
- Browser tests:
  `analytics-dashboard/qa/editorial-workspace-smoke.spec.ts`
  Coverage qualifier: `SMOKE_ONLY`; browser workflow coverage exists, but exact action execution is not proven.
- Runtime mapping: `COMPLETE`
- Canonical conformance: `PARTIAL`

### Open questions

- Is automatic generatability removal canonical or runtime-only coupling?

## `WEOS-ACT-012C` - `GRANT_GENERATABILITY`

### Canonical interpretation

- Canonical action: `GRANT_GENERATABILITY`
- Canonical action ID: Not proven.
- Canonical document:
  `docs/weos/WEOS-IMP-003-editorial-action-decision-catalogue.md`
- Canonical transition: operational generatability permission granted.
- Related open decisions:
  `docs/weos/phase-2-review/REVIEW-CHECKLIST.md`
- Open-decision ID: `WEOS-OD-012`
- Open-decision document: `docs/weos/WEOS-IMP-005-phase-2-open-decisions.md`
- Relevant question: Are operational permission expiries required?
- Interpretation confidence: Medium.

### Runtime mapping

- HTTP method: `POST`
- Route: `/admin/diagnosis-registry/:diagnosisRegistryId/lifecycle/action`
- Request decision or body: `action: mark_generatable`
- Controller path: `doctordle-backend/src/modules/admin/admin.controller.ts`
- Controller symbol: `AdminController.updateDiagnosisRegistryLifecycle`
- Service path:
  `doctordle-backend/src/modules/diagnosis-registry/diagnosis-registry-lifecycle-policy.service.ts`
- Service symbol: `DiagnosisRegistryLifecyclePolicyService.performAction`
- Repository path: Not proven.
- Repository symbol: Not proven.
- Other directly invoked services: None identified.

### Authority

- Route guard: `AdminGuard`
- Backend permission check: `@SeniorEditorialAccess()`
- Backend role requirement: runtime permission level `senior`
- Frontend eligibility: Not proven from backend route alone.
- Canonical authority: Not proven.
- Authority mapping status: `PARTIAL`
- Evidence: `doctordle-backend/src/modules/admin/admin.controller.ts`

### State and persistence

- Runtime preconditions: Generatability readiness evaluation passes.
- Runtime transition: `DiagnosisRegistry.isGeneratable -> true`.
- Exact runtime status literals: `mark_generatable`
- Models written: `DiagnosisRegistry`
- Principal persistence operation: `prisma.diagnosisRegistry.update`
- Canonical records written: Not proven.
- Projection fields written: `isGeneratable`
- Revision records written: None identified.
- Reviewer or actor fields written: None identified.
- Other side effects: telemetry event name
  `diagnosis.lifecycle.generatable_enabled`.

### Governance and audit

- Audit classification: `ENTITY_STATUS_ONLY`, `SERVICE_LOG_ONLY`
- Persisted decision record: None identified.
- Persisted event record: Not proven.
- Entity review fields: None identified.
- Service logging: telemetry or logger not treated as persisted audit evidence.
- Evidence: `DiagnosisRegistryLifecyclePolicyService.getActionUpdate`
- Missing governance evidence: No permission-standing record with rationale.

### Transaction and concurrency

- Transaction isolation: `NO_TRANSACTION_IDENTIFIED`
- Revision binding: `STATUS_GATE_ONLY`
- Expected-version input: `ABSENT`
- Stale-write rejection: `NOT_PROVEN`
- Status gating: Readiness evaluation.
- Idempotency: None identified.
- Concurrency assessment: No expected-version input.

### Verification

- Service tests:
  `doctordle-backend/src/modules/diagnosis-registry/diagnosis-registry-lifecycle-policy.service.spec.ts`
  Coverage qualifier: `FILE_EXISTS_ACTION_NOT_PROVEN`; the service test file
  exists, but exact action or request-decision coverage was not reverified in
  this documentation pass.
- Controller tests: None identified.
- Dashboard unit tests:
  `analytics-dashboard/src/features/editorial/workspace/actions/workspaceActionRegistry.test.ts`
  Coverage qualifier: `ACTION_REGISTRY_ONLY`; verifies dashboard action registration, not backend enforcement.
- Browser tests:
  `analytics-dashboard/qa/editorial-workspace-smoke.spec.ts`
  Coverage qualifier: `SMOKE_ONLY`; browser workflow coverage exists, but exact action execution is not proven.
- Runtime mapping: `COMPLETE`
- Canonical conformance: `PARTIAL`

### Open questions

- Should generatability require independent review metadata?

## `WEOS-ACT-012D` - `REMOVE_GENERATABILITY`

### Canonical interpretation

- Canonical action: `REMOVE_GENERATABILITY`
- Canonical action ID: Not proven.
- Canonical document:
  `docs/weos/WEOS-IMP-003-editorial-action-decision-catalogue.md`
- Canonical transition: operational generatability permission removed.
- Related open decisions:
  `docs/weos/phase-2-review/REVIEW-CHECKLIST.md`
- Open-decision ID: `WEOS-OD-012`
- Open-decision document: `docs/weos/WEOS-IMP-005-phase-2-open-decisions.md`
- Relevant question: Are operational permission expiries required?
- Interpretation confidence: Medium.

### Runtime mapping

- HTTP method: `POST`
- Route: `/admin/diagnosis-registry/:diagnosisRegistryId/lifecycle/action`
- Request decision or body: `action: unmark_generatable`
- Controller path: `doctordle-backend/src/modules/admin/admin.controller.ts`
- Controller symbol: `AdminController.updateDiagnosisRegistryLifecycle`
- Service path:
  `doctordle-backend/src/modules/diagnosis-registry/diagnosis-registry-lifecycle-policy.service.ts`
- Service symbol: `DiagnosisRegistryLifecyclePolicyService.performAction`
- Repository path: Not proven.
- Repository symbol: Not proven.
- Other directly invoked services: None identified.

### Authority

- Route guard: `AdminGuard`
- Backend permission check: `@SeniorEditorialAccess()`
- Backend role requirement: runtime permission level `senior`
- Frontend eligibility: Not proven from backend route alone.
- Canonical authority: Not proven.
- Authority mapping status: `PARTIAL`
- Evidence: `doctordle-backend/src/modules/admin/admin.controller.ts`

### State and persistence

- Runtime preconditions: Registry exists.
- Runtime transition: `DiagnosisRegistry.isGeneratable -> false`.
- Exact runtime status literals: `unmark_generatable`
- Models written: `DiagnosisRegistry`
- Principal persistence operation: `prisma.diagnosisRegistry.update`
- Canonical records written: Not proven.
- Projection fields written: `isGeneratable`
- Revision records written: None identified.
- Reviewer or actor fields written: None identified.
- Other side effects: telemetry event name
  `diagnosis.lifecycle.generatable_disabled`.

### Governance and audit

- Audit classification: `ENTITY_STATUS_ONLY`, `SERVICE_LOG_ONLY`
- Persisted decision record: None identified.
- Persisted event record: Not proven.
- Entity review fields: None identified.
- Service logging: telemetry or logger not treated as persisted audit evidence.
- Evidence: `DiagnosisRegistryLifecyclePolicyService.getActionUpdate`
- Missing governance evidence: No permission-standing record with rationale.

### Transaction and concurrency

- Transaction isolation: `NO_TRANSACTION_IDENTIFIED`
- Revision binding: `STATUS_GATE_ONLY`
- Expected-version input: `ABSENT`
- Stale-write rejection: `NOT_PROVEN`
- Status gating: Registry lookup and policy evaluation.
- Idempotency: None identified.
- Concurrency assessment: No expected-version input.

### Verification

- Service tests:
  `doctordle-backend/src/modules/diagnosis-registry/diagnosis-registry-lifecycle-policy.service.spec.ts`
  Coverage qualifier: `FILE_EXISTS_ACTION_NOT_PROVEN`; the service test file
  exists, but exact action or request-decision coverage was not reverified in
  this documentation pass.
- Controller tests: None identified.
- Dashboard unit tests:
  `analytics-dashboard/src/features/editorial/workspace/actions/workspaceActionRegistry.test.ts`
  Coverage qualifier: `ACTION_REGISTRY_ONLY`; verifies dashboard action registration, not backend enforcement.
- Browser tests:
  `analytics-dashboard/qa/editorial-workspace-smoke.spec.ts`
  Coverage qualifier: `SMOKE_ONLY`; browser workflow coverage exists, but exact action execution is not proven.
- Runtime mapping: `COMPLETE`
- Canonical conformance: `PARTIAL`

### Open questions

- Should removal preserve a historical permission-standing record?

## `WEOS-ACT-013` - `APPROVE_GRAPH_CANDIDATE_RUNTIME`

### Canonical interpretation

- Canonical action: Not settled as one canonical action.
- Canonical actions implicated:
  - `APPROVE_GRAPH_PROMOTION`
  - `ACTIVATE_ARTIFACT` for `GRAPH_FACT` activation
- Canonical action ID: `WEOS-OD-005` marks separation open.
- Canonical document:
  `docs/weos/WEOS-IMP-003-editorial-action-decision-catalogue.md`,
  `docs/weos/WEOS-IMP-005-phase-2-open-decisions.md`
- Canonical transition: graph candidate approval and graph fact promotion are
  canonically separable.
- Related open decisions: `WEOS-OD-005`
- Open-decision ID: `WEOS-OD-005`
- Open-decision document: `docs/weos/WEOS-IMP-005-phase-2-open-decisions.md`
- Relevant question: How are Graph Candidate approval and promotion separated?
- Interpretation confidence: High.

### Runtime mapping

- HTTP method: `POST`
- Route: `/admin/diagnosis-graph/candidates/:id/approve`
- Request decision or body: No body decision; route operation only.
- Controller path:
  `doctordle-backend/src/modules/diagnosis-graph/admin-diagnosis-graph.controller.ts`
- Controller symbol: `AdminDiagnosisGraphController.approveCandidate`
- Service path:
  `doctordle-backend/src/modules/diagnosis-graph/diagnosis-graph-candidates.service.ts`
- Service symbol: `DiagnosisGraphCandidatesService.approveCandidate`
- Repository path: Not proven.
- Repository symbol: Not proven.
- Other directly invoked services:
  `DiagnosisGraphCandidatesService.upsertFactForCandidate`

### Authority

- Route guard: `AdminGuard`
- Backend permission check: `@SeniorEditorialAccess()`
- Backend role requirement: runtime permission level `senior`
- Frontend eligibility: `analytics-dashboard/src/api/admin.ts`
  `approveDiagnosisGraphCandidate`
- Canonical authority: Not proven equivalent to runtime `senior`.
- Authority mapping status: `PARTIAL`
- Evidence:
  `doctordle-backend/src/modules/diagnosis-graph/admin-diagnosis-graph.permissions.spec.ts`
  Coverage qualifier: `PERMISSION_ONLY`; verifies access level for the mapped controller route.

### State and persistence

- Runtime preconditions: Candidate exists; `assertCanPromoteCandidate` passes.
- Runtime transition: `DiagnosisGraphCandidate.status -> APPROVED`; fact
  created or updated as `DiagnosisGraphFact.status -> ACTIVE`.
- Exact runtime status literals: `APPROVED`, `ACTIVE`
- Models written: `DiagnosisGraphCandidate`, `DiagnosisGraphFact`
- Principal persistence operation: `tx.diagnosisGraphCandidate.update`; `tx.diagnosisGraphFact.create` or `tx.diagnosisGraphFact.update`
- Canonical records written: Not proven as separate records.
- Projection fields written: Candidate `status`, `reviewedByUserId`,
  `reviewedAt`, `promotedFactId`; fact `label`, `payload`, `status`,
  `sourceCandidateId`, `provenance`
- Revision records written: None identified.
- Reviewer or actor fields written: `DiagnosisGraphCandidate.reviewedByUserId`,
  `DiagnosisGraphCandidate.reviewedAt`
- Other side effects: fact upsert side effect occurs inside the approval
  transaction; approval and promotion are coupled runtime effects.

### Governance and audit

- Audit classification: `ENTITY_REVIEW_FIELDS`, `ENTITY_STATUS_ONLY`
- Persisted decision record: Not proven; decision-like fields are stored on the entity row.
- Persisted event record: None identified.
- Entity review fields: candidate reviewer fields.
- Service logging: None identified.
- Evidence: `DiagnosisGraphCandidatesService.approveCandidate`,
  `DiagnosisGraphCandidatesService.upsertFactForCandidate`
- Missing governance evidence: No separate promotion decision is persisted.

### Transaction and concurrency

- Transaction isolation: `EXPLICIT_TRANSACTION_DEFAULT_ISOLATION`
- Revision binding: `STATUS_GATE_ONLY`
- Expected-version input: `ABSENT`
- Stale-write rejection: `NOT_PROVEN`
- Status gating: Candidate promotion assertion.
- Idempotency: Fact dedupe key upsert pattern.
- Concurrency assessment: Transaction exists; no expected-version input.

### Verification

- Service tests:
  `doctordle-backend/src/modules/diagnosis-graph/diagnosis-graph-candidates.service.spec.ts`
  Coverage qualifier: `FILE_EXISTS_ACTION_NOT_PROVEN`; the service test file
  exists, but exact action or request-decision coverage was not reverified in
  this documentation pass.
- Permission tests:
  `doctordle-backend/src/modules/diagnosis-graph/admin-diagnosis-graph.permissions.spec.ts`
  Coverage qualifier: `PERMISSION_ONLY`; verifies access level for the mapped controller route.
- Dashboard unit tests:
  `analytics-dashboard/src/features/editorial/workspace/actions/workspaceActionRegistry.test.ts`
  Coverage qualifier: `ACTION_REGISTRY_ONLY`; verifies dashboard action registration, not backend enforcement.
- Browser tests:
  `analytics-dashboard/qa/editorial-workspace-command-matrix.spec.ts`
  Coverage qualifier: `SMOKE_ONLY`; browser workflow coverage exists, but exact action execution is not proven.
- Runtime mapping: `COMPLETE`
- Canonical conformance: `CONFLICT`

### Open questions

- `WEOS-OD-005`: how are Graph Candidate approval and promotion separated?

## `WEOS-ACT-014` - `REJECT_GRAPH_CANDIDATE`

### Canonical interpretation

- Canonical action: `REJECT_GRAPH_CANDIDATE`
- Canonical action ID: Not proven as row-specific ID.
- Canonical document:
  `docs/weos/WEOS-IMP-003-editorial-action-decision-catalogue.md`
- Canonical transition: graph candidate rejected.
- Related open decisions: None identified.
- Open-decision dependency: `NONE_IDENTIFIED`
- Implementation gap: Should rejection produce a first-class graph governance record?
- Gap tracking: `docs/weos/gaps/IMPLEMENTATION-GAPS.md`
- Interpretation confidence: High.

### Runtime mapping

- HTTP method: `POST`
- Route: `/admin/diagnosis-graph/candidates/:id/reject`
- Request decision or body: `RejectGraphCandidateDto`
- Controller path:
  `doctordle-backend/src/modules/diagnosis-graph/admin-diagnosis-graph.controller.ts`
- Controller symbol: `AdminDiagnosisGraphController.rejectCandidate`
- Service path:
  `doctordle-backend/src/modules/diagnosis-graph/diagnosis-graph-candidates.service.ts`
- Service symbol: `DiagnosisGraphCandidatesService.rejectCandidate`
- Repository path: Not proven.
- Repository symbol: Not proven.
- Other directly invoked services: None identified.

### Authority

- Route guard: `AdminGuard`
- Backend permission check: `@SeniorEditorialAccess()`
- Backend role requirement: runtime permission level `senior`
- Frontend eligibility: `analytics-dashboard/src/api/admin.ts`
  `rejectDiagnosisGraphCandidate`
- Canonical authority: Not proven equivalent to runtime `senior`.
- Authority mapping status: `PARTIAL`
- Evidence:
  `doctordle-backend/src/modules/diagnosis-graph/admin-diagnosis-graph.permissions.spec.ts`
  Coverage qualifier: `PERMISSION_ONLY`; verifies access level for the mapped controller route.

### State and persistence

- Runtime preconditions: Candidate exists.
- Runtime transition: `DiagnosisGraphCandidate.status -> REJECTED`.
- Exact runtime status literals: `REJECTED`
- Models written: `DiagnosisGraphCandidate`
- Principal persistence operation: `prisma.diagnosisGraphCandidate.update`
- Canonical records written: Not proven.
- Projection fields written: `status`, `reviewedByUserId`, `reviewedAt`,
  `reviewNote`
- Revision records written: None identified.
- Reviewer or actor fields written: `reviewedByUserId`, `reviewedAt`
- Other side effects: None identified.

### Governance and audit

- Audit classification: `ENTITY_REVIEW_FIELDS`
- Persisted decision record: Not proven; decision-like fields are stored on the entity row.
- Persisted event record: None identified.
- Entity review fields: candidate reviewer fields.
- Service logging: None identified.
- Evidence: `DiagnosisGraphCandidatesService.rejectCandidate`
- Missing governance evidence: No immutable decision record proven.

### Transaction and concurrency

- Transaction isolation: `SINGLE_OPERATION_NO_EXPLICIT_TRANSACTION`
- Revision binding: `STATUS_GATE_ONLY`
- Expected-version input: `ABSENT`
- Stale-write rejection: `NOT_PROVEN`
- Status gating: Candidate lookup only was proven.
- Idempotency: None identified.
- Concurrency assessment: No expected-version input.

### Verification

- Service tests:
  `doctordle-backend/src/modules/diagnosis-graph/diagnosis-graph-candidates.service.spec.ts`
  Coverage qualifier: `FILE_EXISTS_ACTION_NOT_PROVEN`; the service test file
  exists, but exact action or request-decision coverage was not reverified in
  this documentation pass.
- Permission tests:
  `doctordle-backend/src/modules/diagnosis-graph/admin-diagnosis-graph.permissions.spec.ts`
  Coverage qualifier: `PERMISSION_ONLY`; verifies access level for the mapped controller route.
- Dashboard unit tests:
  `analytics-dashboard/src/features/editorial/workspace/actions/workspaceActionRegistry.test.ts`
  Coverage qualifier: `ACTION_REGISTRY_ONLY`; verifies dashboard action registration, not backend enforcement.
- Browser tests:
  `analytics-dashboard/qa/editorial-workspace-command-matrix.spec.ts`
  Coverage qualifier: `SMOKE_ONLY`; browser workflow coverage exists, but exact action execution is not proven.
- Runtime mapping: `COMPLETE`
- Canonical conformance: `PARTIAL`

### Open questions

- Should rejection produce a first-class graph governance record?

## `WEOS-ACT-015` - `MERGE_GRAPH_CANDIDATE`

### Canonical interpretation

- Canonical action: `MERGE_CANDIDATE`
- Canonical action ID: Not proven.
- Canonical document:
  `docs/weos/WEOS-IMP-003-editorial-action-decision-catalogue.md`
- Canonical transition: graph candidate merged into target candidate or fact.
- Related open decisions: `WEOS-OD-005`
- Open-decision ID: `WEOS-OD-005`
- Open-decision document: `docs/weos/WEOS-IMP-005-phase-2-open-decisions.md`
- Relevant question: How does candidate merge interact with graph fact promotion semantics?
- Interpretation confidence: Medium.

### Runtime mapping

- HTTP method: `POST`
- Route: `/admin/diagnosis-graph/candidates/:id/merge`
- Request decision or body: `MergeGraphCandidateDto`
- Controller path:
  `doctordle-backend/src/modules/diagnosis-graph/admin-diagnosis-graph.controller.ts`
- Controller symbol: `AdminDiagnosisGraphController.mergeCandidate`
- Service path:
  `doctordle-backend/src/modules/diagnosis-graph/diagnosis-graph-candidates.service.ts`
- Service symbol: `DiagnosisGraphCandidatesService.mergeCandidate`
- Repository path: Not proven.
- Repository symbol: Not proven.
- Other directly invoked services: None identified.

### Authority

- Route guard: `AdminGuard`
- Backend permission check: `@SeniorEditorialAccess()`
- Backend role requirement: runtime permission level `senior`
- Frontend eligibility: `analytics-dashboard/src/api/admin.ts`
  `mergeDiagnosisGraphCandidate`
- Canonical authority: Not proven equivalent to runtime `senior`.
- Authority mapping status: `PARTIAL`
- Evidence:
  `doctordle-backend/src/modules/diagnosis-graph/admin-diagnosis-graph.permissions.spec.ts`
  Coverage qualifier: `PERMISSION_ONLY`; verifies access level for the mapped controller route.

### State and persistence

- Runtime preconditions: Candidate exists; target exists where required.
- Runtime transition: `DiagnosisGraphCandidate.status -> MERGED`.
- Exact runtime status literals: `MERGED`
- Models written: `DiagnosisGraphCandidate`
- Principal persistence operation: `tx.diagnosisGraphCandidate.update`
- Canonical records written: Not proven.
- Projection fields written: `status`, `reviewedByUserId`, `reviewedAt`,
  `mergedIntoId`
- Revision records written: None identified.
- Reviewer or actor fields written: `reviewedByUserId`, `reviewedAt`
- Other side effects: None identified.

### Governance and audit

- Audit classification: `ENTITY_REVIEW_FIELDS`
- Persisted decision record: Not proven; decision-like fields are stored on the entity row.
- Persisted event record: None identified.
- Entity review fields: candidate reviewer fields.
- Service logging: None identified.
- Evidence: `DiagnosisGraphCandidatesService.mergeCandidate`
- Missing governance evidence: No immutable merge governance record proven.

### Transaction and concurrency

- Transaction isolation: `EXPLICIT_TRANSACTION_DEFAULT_ISOLATION`
- Revision binding: `STATUS_GATE_ONLY`
- Expected-version input: `ABSENT`
- Stale-write rejection: `NOT_PROVEN`
- Status gating: Candidate and target checks.
- Idempotency: None identified.
- Concurrency assessment: Transaction exists; no expected-version input.

### Verification

- Service tests:
  `doctordle-backend/src/modules/diagnosis-graph/diagnosis-graph-candidates.service.spec.ts`
  Coverage qualifier: `FILE_EXISTS_ACTION_NOT_PROVEN`; the service test file
  exists, but exact action or request-decision coverage was not reverified in
  this documentation pass.
- Permission tests:
  `doctordle-backend/src/modules/diagnosis-graph/admin-diagnosis-graph.permissions.spec.ts`
  Coverage qualifier: `PERMISSION_ONLY`; verifies access level for the mapped controller route.
- Dashboard unit tests:
  `analytics-dashboard/src/features/editorial/workspace/actions/workspaceActionRegistry.test.ts`
  Coverage qualifier: `ACTION_REGISTRY_ONLY`; verifies dashboard action registration, not backend enforcement.
- Browser tests:
  `analytics-dashboard/qa/editorial-workspace-command-matrix.spec.ts`
  Coverage qualifier: `SMOKE_ONLY`; browser workflow coverage exists, but exact action execution is not proven.
- Runtime mapping: `COMPLETE`
- Canonical conformance: `PARTIAL`

### Open questions

- Should graph candidate merge produce a separate governance record?

## `WEOS-ACT-016A` - `APPROVE_DIAGNOSIS_EDUCATION_REVISION`

### Canonical interpretation

- Canonical action: `APPROVE_REVISION`
- Canonical action ID: Not proven as education-specific ID.
- Canonical document:
  `docs/weos/WEOS-IMP-003-editorial-action-decision-catalogue.md`
- Canonical transition: education revision approved, not published.
- Related open decisions: None identified.
- Open-decision dependency: `NONE_IDENTIFIED`
- Implementation gap: Should approval target an explicit education revision identity supplied by the request?
- Gap tracking: `docs/weos/gaps/IMPLEMENTATION-GAPS.md`
- Interpretation confidence: Medium.

### Runtime mapping

- HTTP method: `POST`
- Route: `/admin/education/:educationId/review`
- Request decision or body: `status: APPROVED`
- Controller path:
  `doctordle-backend/src/modules/education/admin-education.controller.ts`
- Controller symbol: `AdminEducationController.reviewDiagnosisEducation`
- Service path:
  `doctordle-backend/src/modules/education/diagnosis-education.service.ts`
- Service symbol: `DiagnosisEducationService.reviewEducation`
- Repository path: Not proven.
- Repository symbol: Not proven.
- Other directly invoked services:
  `DiagnosisEducationService.refreshDifferentialMappings`

### Authority

- Route guard: `AdminGuard`
- Backend permission check: `@SeniorEditorialAccess()`
- Backend role requirement: runtime permission level `senior`
- Frontend eligibility: `analytics-dashboard/src/api/admin.ts`
  `reviewDiagnosisEducationForAdmin`
- Canonical authority: Not proven equivalent to runtime `senior`.
- Authority mapping status: `PARTIAL`
- Evidence:
  `doctordle-backend/src/modules/education/admin-education.permissions.spec.ts`
  Coverage qualifier: `PERMISSION_ONLY`; verifies access level for the mapped controller route.

### State and persistence

- Runtime preconditions: Education exists; status belongs to
  `PUBLISHABLE_REVIEW_STATUSES`.
- Runtime transition: `DiagnosisEducation.editorialStatus -> APPROVED`;
  version increments.
- Exact runtime status literals: `APPROVED`
- Models written: `DiagnosisEducation`, `DiagnosisEducationRevision`
- Principal persistence operation: `tx.diagnosisEducation.update`; `DiagnosisEducationService.createRevision`
- Canonical records written: Not proven.
- Projection fields written: `editorialStatus`, `reviewedAt`,
  `reviewedByUserId`, `version`
- Revision records written: `DiagnosisEducationRevision`
- Reviewer or actor fields written: `reviewedByUserId`, `reviewedAt`
- Other side effects: differential mapping refresh.

### Governance and audit

- Audit classification: `ENTITY_REVIEW_FIELDS`
- Persisted decision record: Not proven; decision-like fields are stored on the entity row.
- Persisted event record: None identified.
- Entity review fields: `reviewedByUserId`, `reviewedAt`
- Service logging: None identified.
- Evidence: `DiagnosisEducationService.reviewEducation`
- Missing governance evidence: No immutable education decision record proven.

### Transaction and concurrency

- Transaction isolation: `EXPLICIT_TRANSACTION_DEFAULT_ISOLATION`
- Revision binding: `VERSION_INCREMENT_ONLY`
- Expected-version input: `ABSENT`
- Stale-write rejection: `NOT_PROVEN`
- Status gating: Supported status set.
- Idempotency: None identified.
- Concurrency assessment: Version increment is not expected-version
  concurrency.

### Verification

- Service tests:
  `doctordle-backend/src/modules/education/diagnosis-education.service.spec.ts`
  Coverage qualifier: `FILE_EXISTS_ACTION_NOT_PROVEN`; the service test file
  exists, but exact action or request-decision coverage was not reverified in
  this documentation pass.
- Permission tests:
  `doctordle-backend/src/modules/education/admin-education.permissions.spec.ts`
  Coverage qualifier: `PERMISSION_ONLY`; verifies access level for the mapped controller route.
- Dashboard unit tests:
  `analytics-dashboard/src/features/editorial/workspace/actions/workspaceActionRegistry.test.ts`
  Coverage qualifier: `ACTION_REGISTRY_ONLY`; verifies dashboard action registration, not backend enforcement.
- Browser tests:
  `analytics-dashboard/qa/editorial-workspace-smoke.spec.ts`
  Coverage qualifier: `SMOKE_ONLY`; browser workflow coverage exists, but exact action execution is not proven.
- Runtime mapping: `COMPLETE`
- Canonical conformance: `PARTIAL`

### Open questions

- Should approval target an explicit education revision identity supplied by the
  request?

## `WEOS-ACT-016B` - `REJECT_DIAGNOSIS_EDUCATION_REVISION`

### Canonical interpretation

- Canonical action: `REJECT_REVISION`
- Canonical action ID: Not proven as education-specific ID.
- Canonical document:
  `docs/weos/WEOS-IMP-003-editorial-action-decision-catalogue.md`
- Canonical transition: education revision rejected.
- Related open decisions: None identified.
- Open-decision dependency: `NONE_IDENTIFIED`
- Implementation gap: Should rejection write reviewer fields and rationale?
- Gap tracking: `docs/weos/gaps/IMPLEMENTATION-GAPS.md`
- Interpretation confidence: Medium.

### Runtime mapping

- HTTP method: `POST`
- Route: `/admin/education/:educationId/review`
- Request decision or body: `status: REJECTED`
- Controller path:
  `doctordle-backend/src/modules/education/admin-education.controller.ts`
- Controller symbol: `AdminEducationController.reviewDiagnosisEducation`
- Service path:
  `doctordle-backend/src/modules/education/diagnosis-education.service.ts`
- Service symbol: `DiagnosisEducationService.reviewEducation`
- Repository path: Not proven.
- Repository symbol: Not proven.
- Other directly invoked services:
  `DiagnosisEducationService.refreshDifferentialMappings`

### Authority

- Route guard: `AdminGuard`
- Backend permission check: `@SeniorEditorialAccess()`
- Backend role requirement: runtime permission level `senior`
- Frontend eligibility: `analytics-dashboard/src/api/admin.ts`
  `reviewDiagnosisEducationForAdmin`
- Canonical authority: Not proven.
- Authority mapping status: `PARTIAL`
- Evidence:
  `doctordle-backend/src/modules/education/admin-education.permissions.spec.ts`
  Coverage qualifier: `PERMISSION_ONLY`; verifies access level for the mapped controller route.

### State and persistence

- Runtime preconditions: Education exists; status belongs to
  `PUBLISHABLE_REVIEW_STATUSES`.
- Runtime transition: `DiagnosisEducation.editorialStatus -> REJECTED`;
  version increments.
- Exact runtime status literals: `REJECTED`
- Models written: `DiagnosisEducation`, `DiagnosisEducationRevision`
- Principal persistence operation: `tx.diagnosisEducation.update`; `DiagnosisEducationService.createRevision`
- Canonical records written: Not proven.
- Projection fields written: `editorialStatus`, `version`
- Revision records written: `DiagnosisEducationRevision`
- Reviewer or actor fields written: Existing review fields preserved; new
  reviewer is not set for rejected status.
- Other side effects: differential mapping refresh.

### Governance and audit

- Audit classification: `ENTITY_STATUS_ONLY`
- Persisted decision record: Not proven; decision-like fields are stored on the entity row.
- Persisted event record: None identified.
- Entity review fields: Existing reviewer fields may be preserved.
- Service logging: None identified.
- Evidence: `DiagnosisEducationService.reviewEducation`
- Missing governance evidence: No immutable education rejection record proven.

### Transaction and concurrency

- Transaction isolation: `EXPLICIT_TRANSACTION_DEFAULT_ISOLATION`
- Revision binding: `VERSION_INCREMENT_ONLY`
- Expected-version input: `ABSENT`
- Stale-write rejection: `NOT_PROVEN`
- Status gating: Supported status set.
- Idempotency: None identified.
- Concurrency assessment: Version increment is not expected-version
  concurrency.

### Verification

- Service tests:
  `doctordle-backend/src/modules/education/diagnosis-education.service.spec.ts`
  Coverage qualifier: `FILE_EXISTS_ACTION_NOT_PROVEN`; the service test file
  exists, but exact action or request-decision coverage was not reverified in
  this documentation pass.
- Permission tests:
  `doctordle-backend/src/modules/education/admin-education.permissions.spec.ts`
  Coverage qualifier: `PERMISSION_ONLY`; verifies access level for the mapped controller route.
- Dashboard unit tests:
  `analytics-dashboard/src/features/editorial/workspace/actions/workspaceActionRegistry.test.ts`
  Coverage qualifier: `ACTION_REGISTRY_ONLY`; verifies dashboard action registration, not backend enforcement.
- Browser tests:
  `analytics-dashboard/qa/editorial-workspace-smoke.spec.ts`
  Coverage qualifier: `SMOKE_ONLY`; browser workflow coverage exists, but exact action execution is not proven.
- Runtime mapping: `COMPLETE`
- Canonical conformance: `PARTIAL`

### Open questions

- Should rejection write reviewer fields and rationale?

## `WEOS-ACT-016C` - `REQUEST_DIAGNOSIS_EDUCATION_CHANGES`

### Canonical interpretation

- Canonical action: `REQUIRE_REVISION`
- Canonical action ID: Not proven as education-specific ID.
- Canonical document:
  `docs/weos/WEOS-IMP-003-editorial-action-decision-catalogue.md`
- Canonical transition: education revision needs changes.
- Related open decisions: None identified.
- Open-decision dependency: `NONE_IDENTIFIED`
- Implementation gap: Should runtime `NEEDS_EDIT` be mapped to canonical `REQUIRE_REVISION`?
- Gap tracking: `docs/weos/gaps/IMPLEMENTATION-GAPS.md`
- Interpretation confidence: Medium.

### Runtime mapping

- HTTP method: `POST`
- Route: `/admin/education/:educationId/review`
- Request decision or body: `status: NEEDS_EDIT`
- Controller path:
  `doctordle-backend/src/modules/education/admin-education.controller.ts`
- Controller symbol: `AdminEducationController.reviewDiagnosisEducation`
- Service path:
  `doctordle-backend/src/modules/education/diagnosis-education.service.ts`
- Service symbol: `DiagnosisEducationService.reviewEducation`
- Repository path: Not proven.
- Repository symbol: Not proven.
- Other directly invoked services:
  `DiagnosisEducationService.refreshDifferentialMappings`

### Authority

- Route guard: `AdminGuard`
- Backend permission check: `@SeniorEditorialAccess()`
- Backend role requirement: runtime permission level `senior`
- Frontend eligibility: `analytics-dashboard/src/api/admin.ts`
  `reviewDiagnosisEducationForAdmin`
- Canonical authority: Not proven.
- Authority mapping status: `PARTIAL`
- Evidence:
  `doctordle-backend/src/modules/education/admin-education.permissions.spec.ts`
  Coverage qualifier: `PERMISSION_ONLY`; verifies access level for the mapped controller route.

### State and persistence

- Runtime preconditions: Education exists; status belongs to
  `PUBLISHABLE_REVIEW_STATUSES`.
- Runtime transition: `DiagnosisEducation.editorialStatus -> NEEDS_EDIT`;
  version increments.
- Exact runtime status literals: `NEEDS_EDIT`
- Models written: `DiagnosisEducation`, `DiagnosisEducationRevision`
- Principal persistence operation: `tx.diagnosisEducation.update`; `DiagnosisEducationService.createRevision`
- Canonical records written: Not proven.
- Projection fields written: `editorialStatus`, `version`
- Revision records written: `DiagnosisEducationRevision`
- Reviewer or actor fields written: Existing review fields preserved.
- Other side effects: differential mapping refresh.

### Governance and audit

- Audit classification: `ENTITY_STATUS_ONLY`
- Persisted decision record: Not proven; decision-like fields are stored on the entity row.
- Persisted event record: None identified.
- Entity review fields: Existing reviewer fields may be preserved.
- Service logging: None identified.
- Evidence: `DiagnosisEducationService.reviewEducation`
- Missing governance evidence: No immutable request-changes record proven.

### Transaction and concurrency

- Transaction isolation: `EXPLICIT_TRANSACTION_DEFAULT_ISOLATION`
- Revision binding: `VERSION_INCREMENT_ONLY`
- Expected-version input: `ABSENT`
- Stale-write rejection: `NOT_PROVEN`
- Status gating: Supported status set.
- Idempotency: None identified.
- Concurrency assessment: Version increment is not expected-version
  concurrency.

### Verification

- Service tests:
  `doctordle-backend/src/modules/education/diagnosis-education.service.spec.ts`
  Coverage qualifier: `FILE_EXISTS_ACTION_NOT_PROVEN`; the service test file
  exists, but exact action or request-decision coverage was not reverified in
  this documentation pass.
- Permission tests:
  `doctordle-backend/src/modules/education/admin-education.permissions.spec.ts`
  Coverage qualifier: `PERMISSION_ONLY`; verifies access level for the mapped controller route.
- Dashboard unit tests:
  `analytics-dashboard/src/features/editorial/workspace/actions/workspaceActionRegistry.test.ts`
  Coverage qualifier: `ACTION_REGISTRY_ONLY`; verifies dashboard action registration, not backend enforcement.
- Browser tests:
  `analytics-dashboard/qa/editorial-workspace-smoke.spec.ts`
  Coverage qualifier: `SMOKE_ONLY`; browser workflow coverage exists, but exact action execution is not proven.
- Runtime mapping: `COMPLETE`
- Canonical conformance: `PARTIAL`

### Open questions

- Should runtime `NEEDS_EDIT` be mapped to canonical `REQUIRE_REVISION`?

## `WEOS-ACT-016D` - `PUBLISH_DIAGNOSIS_EDUCATION_REVISION`

### Canonical interpretation

- Canonical action: `AUTHORISE_PUBLICATION`
- Canonical action ID: `AUTHORISE_PUBLICATION`
- Canonical document:
  `docs/weos/WEOS-IMP-002-lifecycle-transition-specification.md`,
  `docs/weos/WEOS-IMP-003-editorial-action-decision-catalogue.md`
- Canonical transition: publication decision for education revision.
- Related open decisions: Publication decision separation remains unresolved for
  runtime.
- Open-decision ID: `NOT_REGISTERED`
- Open-decision document: `docs/weos/WEOS-IMP-005-phase-2-open-decisions.md`
- Relevant question: Should education approval and publication be separate runtime decisions?
- Gap implication: The unresolved decision should be registered in docs/weos/gaps/IMPLEMENTATION-GAPS.md.
- Interpretation confidence: Medium.

### Runtime mapping

- HTTP method: `POST`
- Route: `/admin/education/:educationId/review`
- Request decision or body: `status: PUBLISHED`
- Controller path:
  `doctordle-backend/src/modules/education/admin-education.controller.ts`
- Controller symbol: `AdminEducationController.reviewDiagnosisEducation`
- Service path:
  `doctordle-backend/src/modules/education/diagnosis-education.service.ts`
- Service symbol: `DiagnosisEducationService.reviewEducation`
- Repository path: Not proven.
- Repository symbol: Not proven.
- Other directly invoked services:
  `DiagnosisGraphExtractionService.extractFromPublishedEducation`

### Authority

- Route guard: `AdminGuard`
- Backend permission check: `@SeniorEditorialAccess()`
- Backend role requirement: runtime permission level `senior`
- Frontend eligibility: `analytics-dashboard/src/api/admin.ts`
  `reviewDiagnosisEducationForAdmin`
- Canonical authority: Publication authority not proven equivalent to runtime
  `senior`.
- Authority mapping status: `PARTIAL`
- Evidence:
  `doctordle-backend/src/modules/education/admin-education.permissions.spec.ts`
  Coverage qualifier: `PERMISSION_ONLY`; verifies access level for the mapped controller route.

### State and persistence

- Runtime preconditions: Education exists; publish blockers absent.
- Runtime transition: `DiagnosisEducation.editorialStatus -> PUBLISHED`;
  `publishedAt` set; version increments.
- Exact runtime status literals: `PUBLISHED`
- Models written: `DiagnosisEducation`, `DiagnosisEducationRevision`
- Principal persistence operation: `tx.diagnosisEducation.update`; `DiagnosisEducationService.createRevision`
- Canonical records written: Not proven.
- Projection fields written: `editorialStatus`, `reviewedAt`,
  `reviewedByUserId`, `publishedAt`, `version`
- Revision records written: `DiagnosisEducationRevision`
- Reviewer or actor fields written: `reviewedByUserId`, `reviewedAt`
- Other side effects: graph extraction after publication.

### Governance and audit

- Audit classification: `ENTITY_REVIEW_FIELDS`, `ENTITY_STATUS_ONLY`
- Persisted decision record: Not proven; decision-like fields are stored on the entity row.
- Persisted event record: None identified.
- Entity review fields: `reviewedByUserId`, `reviewedAt`
- Service logging: None identified.
- Evidence: `DiagnosisEducationService.reviewEducation`
- Missing governance evidence: Approval and publication are represented through
  one status endpoint, not separate canonical publication decision records.

### Transaction and concurrency

- Transaction isolation: `EXPLICIT_TRANSACTION_DEFAULT_ISOLATION`
- Revision binding: `VERSION_INCREMENT_ONLY`
- Expected-version input: `ABSENT`
- Stale-write rejection: `NOT_PROVEN`
- Status gating: Publish-blocker check.
- Idempotency: None identified.
- Concurrency assessment: Version increment is not expected-version
  concurrency.

### Verification

- Service tests:
  `doctordle-backend/src/modules/education/diagnosis-education.service.spec.ts`
  Coverage qualifier: `FILE_EXISTS_ACTION_NOT_PROVEN`; the service test file
  exists, but exact action or request-decision coverage was not reverified in
  this documentation pass.
- Permission tests:
  `doctordle-backend/src/modules/education/admin-education.permissions.spec.ts`
  Coverage qualifier: `PERMISSION_ONLY`; verifies access level for the mapped controller route.
- Dashboard unit tests:
  `analytics-dashboard/src/features/editorial/workspace/actions/workspaceActionRegistry.test.ts`
  Coverage qualifier: `ACTION_REGISTRY_ONLY`; verifies dashboard action registration, not backend enforcement.
- Browser tests:
  `analytics-dashboard/qa/editorial-workspace-smoke.spec.ts`
  Coverage qualifier: `SMOKE_ONLY`; browser workflow coverage exists, but exact action execution is not proven.
- Runtime mapping: `COMPLETE`
- Canonical conformance: `CONFLICT`

### Open questions

- Should education publication be split from review-status mutation into a
  first-class publication decision route?

## `WEOS-ACT-016E` - `ARCHIVE_DIAGNOSIS_EDUCATION`

### Canonical interpretation

- Canonical action: `ARCHIVE_ARTIFACT`
- Canonical action ID: Not proven.
- Canonical document:
  `docs/weos/WEOS-IMP-003-editorial-action-decision-catalogue.md`
- Canonical transition: education artifact archived.
- Related open decisions: None identified.
- Open-decision dependency: `NONE_IDENTIFIED`
- Implementation gap: Is archive a supported user-facing education decision or only a backend accepted status?
- Gap tracking: `docs/weos/gaps/IMPLEMENTATION-GAPS.md`
- Interpretation confidence: Low.

### Runtime mapping

- HTTP method: `POST`
- Route: `/admin/education/:educationId/review`
- Request decision or body: `status: ARCHIVED`
- Controller path:
  `doctordle-backend/src/modules/education/admin-education.controller.ts`
- Controller symbol: `AdminEducationController.reviewDiagnosisEducation`
- Service path:
  `doctordle-backend/src/modules/education/diagnosis-education.service.ts`
- Service symbol: `DiagnosisEducationService.reviewEducation`
- Repository path: Not proven.
- Repository symbol: Not proven.
- Other directly invoked services:
  `DiagnosisEducationService.refreshDifferentialMappings`

### Authority

- Route guard: `AdminGuard`
- Backend permission check: `@SeniorEditorialAccess()`
- Backend role requirement: runtime permission level `senior`
- Frontend eligibility: `analytics-dashboard/src/api/admin.ts`
  `reviewDiagnosisEducationForAdmin`
- Canonical authority: Not proven.
- Authority mapping status: `PARTIAL`
- Evidence:
  `doctordle-backend/src/modules/education/admin-education.permissions.spec.ts`
  Coverage qualifier: `PERMISSION_ONLY`; verifies access level for the mapped controller route.

### State and persistence

- Runtime preconditions: Education exists; status belongs to
  `PUBLISHABLE_REVIEW_STATUSES`.
- Runtime transition: `DiagnosisEducation.editorialStatus -> ARCHIVED`;
  version increments.
- Exact runtime status literals: `ARCHIVED`
- Models written: `DiagnosisEducation`, `DiagnosisEducationRevision`
- Principal persistence operation: `tx.diagnosisEducation.update`; `DiagnosisEducationService.createRevision`
- Canonical records written: Not proven.
- Projection fields written: `editorialStatus`, `version`
- Revision records written: `DiagnosisEducationRevision`
- Reviewer or actor fields written: Existing review fields preserved.
- Other side effects: differential mapping refresh.

### Governance and audit

- Audit classification: `ENTITY_STATUS_ONLY`
- Persisted decision record: Not proven; decision-like fields are stored on the entity row.
- Persisted event record: None identified.
- Entity review fields: Existing reviewer fields may be preserved.
- Service logging: None identified.
- Evidence: `DiagnosisEducationService.reviewEducation`
- Missing governance evidence: No immutable archive decision record proven.

### Transaction and concurrency

- Transaction isolation: `EXPLICIT_TRANSACTION_DEFAULT_ISOLATION`
- Revision binding: `VERSION_INCREMENT_ONLY`
- Expected-version input: `ABSENT`
- Stale-write rejection: `NOT_PROVEN`
- Status gating: Supported status set.
- Idempotency: None identified.
- Concurrency assessment: Version increment is not expected-version
  concurrency.

### Verification

- Service tests:
  `doctordle-backend/src/modules/education/diagnosis-education.service.spec.ts`
  Coverage qualifier: `FILE_EXISTS_ACTION_NOT_PROVEN`; the service test file
  exists, but exact action or request-decision coverage was not reverified in
  this documentation pass.
- Permission tests:
  `doctordle-backend/src/modules/education/admin-education.permissions.spec.ts`
  Coverage qualifier: `PERMISSION_ONLY`; verifies access level for the mapped controller route.
- Dashboard unit tests: None identified.
- Browser tests: None identified.
- Runtime mapping: `COMPLETE`
- Canonical conformance: `PARTIAL`

### Open questions

- Is archive a supported user-facing education decision or only a backend
  accepted status?

## `WEOS-ACT-017A` - `ACTIVATE_TEACHING_RELATIONSHIP`

### Canonical interpretation

- Canonical action: `ACTIVATE_ARTIFACT`
- Canonical action ID: Abstract family; concrete relationship ID not proven.
- Canonical document:
  `docs/weos/WEOS-IMP-003-editorial-action-decision-catalogue.md`
- Canonical transition: teaching relationship becomes active.
- Related open decisions: None identified.
- Open-decision dependency: `NONE_IDENTIFIED`
- Implementation gap: Should teaching relationship activation use a concrete canonical action name?
- Gap tracking: `docs/weos/gaps/IMPLEMENTATION-GAPS.md`
- Interpretation confidence: Medium.

### Runtime mapping

- HTTP method: `POST`
- Route: `/admin/diagnosis-teaching-relationships/:id/review`
- Request decision or body: `action: activate`
- Controller path: `doctordle-backend/src/modules/admin/admin.controller.ts`
- Controller symbol: `AdminController.reviewDiagnosisTeachingRelationship`
- Service path:
  `doctordle-backend/src/modules/admin/diagnosis-teaching-relationship.service.ts`
- Service symbol: `DiagnosisTeachingRelationshipService.reviewRelationship`
- Repository path: Not proven.
- Repository symbol: Not proven.
- Other directly invoked services: None identified.

### Authority

- Route guard: `AdminGuard`
- Backend permission check: `@SeniorEditorialAccess()`
- Backend role requirement: runtime permission level `senior`
- Frontend eligibility: `analytics-dashboard/src/api/admin.ts`
  `reviewDiagnosisTeachingRelationship`
- Canonical authority: Not proven.
- Authority mapping status: `PARTIAL`
- Evidence: `doctordle-backend/src/modules/admin/admin.controller.ts`

### State and persistence

- Runtime preconditions: Relationship exists; readiness passes for activation.
- Runtime transition: `DiagnosisTeachingRelationship.status -> ACTIVE`.
- Exact runtime status literals: `activate`, `ACTIVE`
- Models written: `DiagnosisTeachingRelationship`
- Principal persistence operation: `prisma.diagnosisTeachingRelationship.update`
- Canonical records written: Not proven.
- Projection fields written: `status`, `reviewedByUserId`, `reviewedAt`
- Revision records written: None identified.
- Reviewer or actor fields written: `reviewedByUserId`, `reviewedAt`
- Other side effects: None identified.

### Governance and audit

- Audit classification: `ENTITY_REVIEW_FIELDS`
- Persisted decision record: Not proven; decision-like fields are stored on the entity row.
- Persisted event record: None identified.
- Entity review fields: relationship reviewer fields.
- Service logging: None identified.
- Evidence: `DiagnosisTeachingRelationshipService.reviewRelationship`
- Missing governance evidence: No immutable relationship decision record proven.

### Transaction and concurrency

- Transaction isolation: `SINGLE_OPERATION_NO_EXPLICIT_TRANSACTION`
- Revision binding: `STATUS_GATE_ONLY`
- Expected-version input: `ABSENT`
- Stale-write rejection: `NOT_PROVEN`
- Status gating: Readiness evaluation.
- Idempotency: None identified.
- Concurrency assessment: No expected-version input.

### Verification

- Service tests: None identified.
- Permission tests:
  `doctordle-backend/src/modules/admin/admin-editorial-permissions.spec.ts`
  Coverage qualifier: `PERMISSION_ONLY`; verifies access level for the mapped controller route.
- Dashboard unit tests:
  `analytics-dashboard/src/features/editorial/workspace/actions/workspaceActionRegistry.test.ts`
  Coverage qualifier: `ACTION_REGISTRY_ONLY`; verifies dashboard action registration, not backend enforcement.
- Browser tests:
  `analytics-dashboard/qa/editorial-workspace-command-matrix.spec.ts`
  Coverage qualifier: `SMOKE_ONLY`; browser workflow coverage exists, but exact action execution is not proven.
- Runtime mapping: `COMPLETE`
- Canonical conformance: `PARTIAL`

### Open questions

- Should teaching relationship activation use a concrete canonical action name?

## `WEOS-ACT-017B` - `REJECT_TEACHING_RELATIONSHIP`

### Canonical interpretation

- Canonical action: `REJECT_ARTIFACT`
- Canonical action ID: Not proven.
- Canonical document:
  `docs/weos/WEOS-IMP-003-editorial-action-decision-catalogue.md`
- Canonical transition: teaching relationship rejected.
- Related open decisions: None identified.
- Open-decision dependency: `NONE_IDENTIFIED`
- Implementation gap: Is `REJECT_ARTIFACT` the intended canonical action for teaching relationship rejection?
- Gap tracking: `docs/weos/gaps/IMPLEMENTATION-GAPS.md`
- Interpretation confidence: Low.

### Runtime mapping

- HTTP method: `POST`
- Route: `/admin/diagnosis-teaching-relationships/:id/review`
- Request decision or body: `action: reject`
- Controller path: `doctordle-backend/src/modules/admin/admin.controller.ts`
- Controller symbol: `AdminController.reviewDiagnosisTeachingRelationship`
- Service path:
  `doctordle-backend/src/modules/admin/diagnosis-teaching-relationship.service.ts`
- Service symbol: `DiagnosisTeachingRelationshipService.reviewRelationship`
- Repository path: Not proven.
- Repository symbol: Not proven.
- Other directly invoked services: None identified.

### Authority

- Route guard: `AdminGuard`
- Backend permission check: `@SeniorEditorialAccess()`
- Backend role requirement: runtime permission level `senior`
- Frontend eligibility: `analytics-dashboard/src/api/admin.ts`
  `reviewDiagnosisTeachingRelationship`
- Canonical authority: Not proven.
- Authority mapping status: `PARTIAL`
- Evidence: `doctordle-backend/src/modules/admin/admin.controller.ts`

### State and persistence

- Runtime preconditions: Relationship exists.
- Runtime transition: `DiagnosisTeachingRelationship.status -> REJECTED`.
- Exact runtime status literals: `reject`, `REJECTED`
- Models written: `DiagnosisTeachingRelationship`
- Principal persistence operation: `prisma.diagnosisTeachingRelationship.update`
- Canonical records written: Not proven.
- Projection fields written: `status`, `reviewedByUserId`, `reviewedAt`
- Revision records written: None identified.
- Reviewer or actor fields written: `reviewedByUserId`, `reviewedAt`
- Other side effects: None identified.

### Governance and audit

- Audit classification: `ENTITY_REVIEW_FIELDS`
- Persisted decision record: Not proven; decision-like fields are stored on the entity row.
- Persisted event record: None identified.
- Entity review fields: relationship reviewer fields.
- Service logging: None identified.
- Evidence: `DiagnosisTeachingRelationshipService.reviewRelationship`
- Missing governance evidence: No immutable relationship decision record proven.

### Transaction and concurrency

- Transaction isolation: `SINGLE_OPERATION_NO_EXPLICIT_TRANSACTION`
- Revision binding: `STATUS_GATE_ONLY`
- Expected-version input: `ABSENT`
- Stale-write rejection: `NOT_PROVEN`
- Status gating: Relationship lookup only was proven.
- Idempotency: None identified.
- Concurrency assessment: No expected-version input.

### Verification

- Service tests: None identified.
- Permission tests:
  `doctordle-backend/src/modules/admin/admin-editorial-permissions.spec.ts`
  Coverage qualifier: `PERMISSION_ONLY`; verifies access level for the mapped controller route.
- Dashboard unit tests:
  `analytics-dashboard/src/features/editorial/workspace/actions/workspaceActionRegistry.test.ts`
  Coverage qualifier: `ACTION_REGISTRY_ONLY`; verifies dashboard action registration, not backend enforcement.
- Browser tests:
  `analytics-dashboard/qa/editorial-workspace-command-matrix.spec.ts`
  Coverage qualifier: `SMOKE_ONLY`; browser workflow coverage exists, but exact action execution is not proven.
- Runtime mapping: `COMPLETE`
- Canonical conformance: `PARTIAL`

### Open questions

- Is `REJECT_ARTIFACT` the intended canonical action for teaching
  relationship rejection?

## `WEOS-ACT-017C` - `DEPRECATE_TEACHING_RELATIONSHIP`

### Canonical interpretation

- Canonical action: `DEPRECATE_ARTIFACT`
- Canonical action ID: Abstract family; concrete relationship ID not proven.
- Canonical document:
  `docs/weos/WEOS-IMP-003-editorial-action-decision-catalogue.md`
- Canonical transition: teaching relationship deprecated.
- Related open decisions: None identified.
- Open-decision dependency: `NONE_IDENTIFIED`
- Implementation gap: Should relationship deprecation trigger dependent-artifact review?
- Gap tracking: `docs/weos/gaps/IMPLEMENTATION-GAPS.md`
- Interpretation confidence: Medium.

### Runtime mapping

- HTTP method: `POST`
- Route: `/admin/diagnosis-teaching-relationships/:id/review`
- Request decision or body: `action: deprecate`
- Controller path: `doctordle-backend/src/modules/admin/admin.controller.ts`
- Controller symbol: `AdminController.reviewDiagnosisTeachingRelationship`
- Service path:
  `doctordle-backend/src/modules/admin/diagnosis-teaching-relationship.service.ts`
- Service symbol: `DiagnosisTeachingRelationshipService.reviewRelationship`
- Repository path: Not proven.
- Repository symbol: Not proven.
- Other directly invoked services: None identified.

### Authority

- Route guard: `AdminGuard`
- Backend permission check: `@SeniorEditorialAccess()`
- Backend role requirement: runtime permission level `senior`
- Frontend eligibility: `analytics-dashboard/src/api/admin.ts`
  `reviewDiagnosisTeachingRelationship`
- Canonical authority: Not proven.
- Authority mapping status: `PARTIAL`
- Evidence: `doctordle-backend/src/modules/admin/admin.controller.ts`

### State and persistence

- Runtime preconditions: Relationship exists.
- Runtime transition: `DiagnosisTeachingRelationship.status -> DEPRECATED`.
- Exact runtime status literals: `deprecate`, `DEPRECATED`
- Models written: `DiagnosisTeachingRelationship`
- Principal persistence operation: `prisma.diagnosisTeachingRelationship.update`
- Canonical records written: Not proven.
- Projection fields written: `status`, `reviewedByUserId`, `reviewedAt`
- Revision records written: None identified.
- Reviewer or actor fields written: `reviewedByUserId`, `reviewedAt`
- Other side effects: None identified.

### Governance and audit

- Audit classification: `ENTITY_REVIEW_FIELDS`
- Persisted decision record: Not proven; decision-like fields are stored on the entity row.
- Persisted event record: None identified.
- Entity review fields: relationship reviewer fields.
- Service logging: None identified.
- Evidence: `DiagnosisTeachingRelationshipService.reviewRelationship`
- Missing governance evidence: No immutable deprecation record proven.

### Transaction and concurrency

- Transaction isolation: `SINGLE_OPERATION_NO_EXPLICIT_TRANSACTION`
- Revision binding: `STATUS_GATE_ONLY`
- Expected-version input: `ABSENT`
- Stale-write rejection: `NOT_PROVEN`
- Status gating: Relationship lookup only was proven.
- Idempotency: None identified.
- Concurrency assessment: No expected-version input.

### Verification

- Service tests: None identified.
- Permission tests:
  `doctordle-backend/src/modules/admin/admin-editorial-permissions.spec.ts`
  Coverage qualifier: `PERMISSION_ONLY`; verifies access level for the mapped controller route.
- Dashboard unit tests:
  `analytics-dashboard/src/features/editorial/workspace/actions/workspaceActionRegistry.test.ts`
  Coverage qualifier: `ACTION_REGISTRY_ONLY`; verifies dashboard action registration, not backend enforcement.
- Browser tests:
  `analytics-dashboard/qa/editorial-workspace-command-matrix.spec.ts`
  Coverage qualifier: `SMOKE_ONLY`; browser workflow coverage exists, but exact action execution is not proven.
- Runtime mapping: `COMPLETE`
- Canonical conformance: `PARTIAL`

### Open questions

- Should relationship deprecation trigger dependent-artifact review?

## `WEOS-ACT-017D` - `REQUEST_TEACHING_RELATIONSHIP_CHANGES`

### Canonical interpretation

- Canonical action: `REQUEST_CHANGES`
- Canonical action ID: Not proven.
- Canonical document:
  `docs/weos/WEOS-IMP-003-editorial-action-decision-catalogue.md`
- Canonical transition: teaching relationship returned to needs-review state.
- Related open decisions: None identified.
- Open-decision dependency: `NONE_IDENTIFIED`
- Implementation gap: Is `needs_review` a request-changes decision or a queue-state reset?
- Gap tracking: `docs/weos/gaps/IMPLEMENTATION-GAPS.md`
- Interpretation confidence: Low.

### Runtime mapping

- HTTP method: `POST`
- Route: `/admin/diagnosis-teaching-relationships/:id/review`
- Request decision or body: `action: needs_review`
- Controller path: `doctordle-backend/src/modules/admin/admin.controller.ts`
- Controller symbol: `AdminController.reviewDiagnosisTeachingRelationship`
- Service path:
  `doctordle-backend/src/modules/admin/diagnosis-teaching-relationship.service.ts`
- Service symbol: `DiagnosisTeachingRelationshipService.reviewRelationship`
- Repository path: Not proven.
- Repository symbol: Not proven.
- Other directly invoked services: None identified.

### Authority

- Route guard: `AdminGuard`
- Backend permission check: `@SeniorEditorialAccess()`
- Backend role requirement: runtime permission level `senior`
- Frontend eligibility: `analytics-dashboard/src/api/admin.ts`
  `reviewDiagnosisTeachingRelationship`
- Canonical authority: Not proven.
- Authority mapping status: `PARTIAL`
- Evidence: `doctordle-backend/src/modules/admin/admin.controller.ts`

### State and persistence

- Runtime preconditions: Relationship exists.
- Runtime transition: `DiagnosisTeachingRelationship.status -> NEEDS_REVIEW`.
- Exact runtime status literals: `needs_review`, `NEEDS_REVIEW`
- Models written: `DiagnosisTeachingRelationship`
- Principal persistence operation: `prisma.diagnosisTeachingRelationship.update`
- Canonical records written: Not proven.
- Projection fields written: `status`, `reviewedByUserId`, `reviewedAt`
- Revision records written: None identified.
- Reviewer or actor fields written: `reviewedByUserId`, `reviewedAt`
- Other side effects: None identified.

### Governance and audit

- Audit classification: `ENTITY_REVIEW_FIELDS`
- Persisted decision record: Not proven; decision-like fields are stored on the entity row.
- Persisted event record: None identified.
- Entity review fields: relationship reviewer fields.
- Service logging: None identified.
- Evidence: `DiagnosisTeachingRelationshipService.reviewRelationship`
- Missing governance evidence: Canonical action label is not proven.

### Transaction and concurrency

- Transaction isolation: `SINGLE_OPERATION_NO_EXPLICIT_TRANSACTION`
- Revision binding: `STATUS_GATE_ONLY`
- Expected-version input: `ABSENT`
- Stale-write rejection: `NOT_PROVEN`
- Status gating: Relationship lookup only was proven.
- Idempotency: None identified.
- Concurrency assessment: No expected-version input.

### Verification

- Service tests: None identified.
- Permission tests:
  `doctordle-backend/src/modules/admin/admin-editorial-permissions.spec.ts`
  Coverage qualifier: `PERMISSION_ONLY`; verifies access level for the mapped controller route.
- Dashboard unit tests:
  `analytics-dashboard/src/features/editorial/workspace/actions/workspaceActionRegistry.test.ts`
  Coverage qualifier: `ACTION_REGISTRY_ONLY`; verifies dashboard action registration, not backend enforcement.
- Browser tests:
  `analytics-dashboard/qa/editorial-workspace-command-matrix.spec.ts`
  Coverage qualifier: `SMOKE_ONLY`; browser workflow coverage exists, but exact action execution is not proven.
- Runtime mapping: `COMPLETE`
- Canonical conformance: `UNKNOWN`

### Open questions

- Is `needs_review` a request-changes decision or a queue-state reset?

## `WEOS-ACT-018A` - `ACTIVATE_EVIDENCE_RELATIONSHIP`

### Canonical interpretation

- Canonical action: `ACTIVATE_ARTIFACT`
- Canonical action ID: Abstract family; concrete evidence relationship ID not
  proven.
- Canonical document:
  `docs/weos/WEOS-IMP-003-editorial-action-decision-catalogue.md`,
  `docs/weos/WEOS-IMP-005-phase-2-open-decisions.md`
- Canonical transition: evidence relationship becomes active.
- Related open decisions: `WEOS-OD-016` referenced by prior crosswalk as
  evidence-source and claim-support governance.
- Open-decision ID: `WEOS-OD-016`
- Open-decision document: `docs/weos/WEOS-IMP-005-phase-2-open-decisions.md`
- Relevant question: Evidence Source and Claim-Support Link boundary?
- Interpretation confidence: Medium.

### Runtime mapping

- HTTP method: `POST`
- Route: `/admin/evidence-graph/relationships/:id/review`
- Request decision or body: `action: activate`
- Controller path: `doctordle-backend/src/modules/admin/admin.controller.ts`
- Controller symbol: `AdminController.reviewEvidenceGraphRelationship`
- Service path: `doctordle-backend/src/modules/admin/evidence-graph.service.ts`
- Service symbol: `EvidenceGraphService.reviewRelationship`
- Repository path: Not proven.
- Repository symbol: Not proven.
- Other directly invoked services: None identified.

### Authority

- Route guard: `AdminGuard`
- Backend permission check: `@SeniorEditorialAccess()`
- Backend role requirement: runtime permission level `senior`
- Frontend eligibility: `analytics-dashboard/src/api/admin.ts`
  `reviewEvidenceGraphRelationship`
- Canonical authority: Not proven.
- Authority mapping status: `PARTIAL`
- Evidence: `doctordle-backend/src/modules/admin/admin.controller.ts`

### State and persistence

- Runtime preconditions: Relationship exists; readiness passes; duplicate active
  relationship absent.
- Runtime transition: `DiagnosisEvidenceRelationship.status -> ACTIVE`;
  `EvidenceNode.status -> ACTIVE`.
- Exact runtime status literals: `activate`, `ACTIVE`
- Models written: `DiagnosisEvidenceRelationship`, `EvidenceNode`
- Principal persistence operation: `prisma.diagnosisEvidenceRelationship.update`; `prisma.evidenceNode.update`
- Canonical records written: Not proven.
- Projection fields written: relationship `status`, `reviewedByUserId`,
  `reviewedAt`; node `status`
- Revision records written: None identified.
- Reviewer or actor fields written: relationship reviewer fields.
- Other side effects: Node activation side effect is bundled with relationship
  activation.

### Governance and audit

- Audit classification: `ENTITY_REVIEW_FIELDS`, `ENTITY_STATUS_ONLY`
- Persisted decision record: Not proven; decision-like fields are stored on the entity row.
- Persisted event record: None identified.
- Entity review fields: relationship reviewer fields.
- Service logging: None identified.
- Evidence: `EvidenceGraphService.reviewRelationship`
- Missing governance evidence: No separate evidence-node activation decision
  record proven.

### Transaction and concurrency

- Transaction isolation: `NO_TRANSACTION_IDENTIFIED`
- Revision binding: `STATUS_GATE_ONLY`
- Expected-version input: `ABSENT`
- Stale-write rejection: `NOT_PROVEN`
- Status gating: Readiness and duplicate checks.
- Idempotency: Duplicate active relationship check.
- Concurrency assessment: Relationship update and node update are not proven to
  be in one transaction.

### Verification

- Service tests:
  `doctordle-backend/src/modules/admin/evidence-graph.service.spec.ts`
  Coverage qualifier: `FILE_EXISTS_ACTION_NOT_PROVEN`; the service test file
  exists, but exact action or request-decision coverage was not reverified in
  this documentation pass.
- Permission tests:
  `doctordle-backend/src/modules/admin/admin-editorial-permissions.spec.ts`
  Coverage qualifier: `PERMISSION_ONLY`; verifies access level for the mapped controller route.
- Dashboard unit tests:
  `analytics-dashboard/src/features/editorial/workspace/actions/workspaceActionRegistry.test.ts`
  Coverage qualifier: `ACTION_REGISTRY_ONLY`; verifies dashboard action registration, not backend enforcement.
- Browser tests:
  `analytics-dashboard/qa/editorial-workspace-command-matrix.spec.ts`
  Coverage qualifier: `SMOKE_ONLY`; browser workflow coverage exists, but exact action execution is not proven.
- Runtime mapping: `COMPLETE`
- Canonical conformance: `OPEN_DECISION`

### Open questions

- Should evidence node activation be a separate canonical decision from
  relationship activation?

## `WEOS-ACT-018B` - `REJECT_EVIDENCE_RELATIONSHIP`

### Canonical interpretation

- Canonical action: `REJECT_ARTIFACT`
- Canonical action ID: Not proven.
- Canonical document:
  `docs/weos/WEOS-IMP-003-editorial-action-decision-catalogue.md`
- Canonical transition: evidence relationship rejected.
- Related open decisions: None identified.
- Open-decision dependency: `NONE_IDENTIFIED`
- Implementation gap: Is `REJECT_ARTIFACT` the intended canonical action for evidence relationship rejection?
- Gap tracking: `docs/weos/gaps/IMPLEMENTATION-GAPS.md`
- Interpretation confidence: Low.

### Runtime mapping

- HTTP method: `POST`
- Route: `/admin/evidence-graph/relationships/:id/review`
- Request decision or body: `action: reject`
- Controller path: `doctordle-backend/src/modules/admin/admin.controller.ts`
- Controller symbol: `AdminController.reviewEvidenceGraphRelationship`
- Service path: `doctordle-backend/src/modules/admin/evidence-graph.service.ts`
- Service symbol: `EvidenceGraphService.reviewRelationship`
- Repository path: Not proven.
- Repository symbol: Not proven.
- Other directly invoked services: None identified.

### Authority

- Route guard: `AdminGuard`
- Backend permission check: `@SeniorEditorialAccess()`
- Backend role requirement: runtime permission level `senior`
- Frontend eligibility: `analytics-dashboard/src/api/admin.ts`
  `reviewEvidenceGraphRelationship`
- Canonical authority: Not proven.
- Authority mapping status: `PARTIAL`
- Evidence: `doctordle-backend/src/modules/admin/admin.controller.ts`

### State and persistence

- Runtime preconditions: Relationship exists.
- Runtime transition: `DiagnosisEvidenceRelationship.status -> REJECTED`.
- Exact runtime status literals: `reject`, `REJECTED`
- Models written: `DiagnosisEvidenceRelationship`
- Principal persistence operation: `prisma.diagnosisEvidenceRelationship.update`
- Canonical records written: Not proven.
- Projection fields written: `status`, `reviewedByUserId`, `reviewedAt`
- Revision records written: None identified.
- Reviewer or actor fields written: relationship reviewer fields.
- Other side effects: None identified.

### Governance and audit

- Audit classification: `ENTITY_REVIEW_FIELDS`
- Persisted decision record: Not proven; decision-like fields are stored on the entity row.
- Persisted event record: None identified.
- Entity review fields: relationship reviewer fields.
- Service logging: None identified.
- Evidence: `EvidenceGraphService.reviewRelationship`
- Missing governance evidence: No immutable decision record proven.

### Transaction and concurrency

- Transaction isolation: `SINGLE_OPERATION_NO_EXPLICIT_TRANSACTION`
- Revision binding: `STATUS_GATE_ONLY`
- Expected-version input: `ABSENT`
- Stale-write rejection: `NOT_PROVEN`
- Status gating: Relationship lookup only was proven.
- Idempotency: None identified.
- Concurrency assessment: No expected-version input.

### Verification

- Service tests:
  `doctordle-backend/src/modules/admin/evidence-graph.service.spec.ts`
  Coverage qualifier: `FILE_EXISTS_ACTION_NOT_PROVEN`; the service test file
  exists, but exact action or request-decision coverage was not reverified in
  this documentation pass.
- Permission tests:
  `doctordle-backend/src/modules/admin/admin-editorial-permissions.spec.ts`
  Coverage qualifier: `PERMISSION_ONLY`; verifies access level for the mapped controller route.
- Dashboard unit tests:
  `analytics-dashboard/src/features/editorial/workspace/actions/workspaceActionRegistry.test.ts`
  Coverage qualifier: `ACTION_REGISTRY_ONLY`; verifies dashboard action registration, not backend enforcement.
- Browser tests:
  `analytics-dashboard/qa/editorial-workspace-command-matrix.spec.ts`
  Coverage qualifier: `SMOKE_ONLY`; browser workflow coverage exists, but exact action execution is not proven.
- Runtime mapping: `COMPLETE`
- Canonical conformance: `PARTIAL`

### Open questions

- Is `REJECT_ARTIFACT` the intended canonical action for evidence relationship
  rejection?

## `WEOS-ACT-018C` - `DEPRECATE_EVIDENCE_RELATIONSHIP`

### Canonical interpretation

- Canonical action: `DEPRECATE_ARTIFACT`
- Canonical action ID: Abstract family; concrete evidence relationship ID not
  proven.
- Canonical document:
  `docs/weos/WEOS-IMP-003-editorial-action-decision-catalogue.md`
- Canonical transition: evidence relationship deprecated.
- Related open decisions: None identified.
- Open-decision dependency: `NONE_IDENTIFIED`
- Implementation gap: Should evidence relationship deprecation flag publication assessments?
- Gap tracking: `docs/weos/gaps/IMPLEMENTATION-GAPS.md`
- Interpretation confidence: Medium.

### Runtime mapping

- HTTP method: `POST`
- Route: `/admin/evidence-graph/relationships/:id/review`
- Request decision or body: `action: deprecate`
- Controller path: `doctordle-backend/src/modules/admin/admin.controller.ts`
- Controller symbol: `AdminController.reviewEvidenceGraphRelationship`
- Service path: `doctordle-backend/src/modules/admin/evidence-graph.service.ts`
- Service symbol: `EvidenceGraphService.reviewRelationship`
- Repository path: Not proven.
- Repository symbol: Not proven.
- Other directly invoked services: None identified.

### Authority

- Route guard: `AdminGuard`
- Backend permission check: `@SeniorEditorialAccess()`
- Backend role requirement: runtime permission level `senior`
- Frontend eligibility: `analytics-dashboard/src/api/admin.ts`
  `reviewEvidenceGraphRelationship`
- Canonical authority: Not proven.
- Authority mapping status: `PARTIAL`
- Evidence: `doctordle-backend/src/modules/admin/admin.controller.ts`

### State and persistence

- Runtime preconditions: Relationship exists.
- Runtime transition: `DiagnosisEvidenceRelationship.status -> DEPRECATED`.
- Exact runtime status literals: `deprecate`, `DEPRECATED`
- Models written: `DiagnosisEvidenceRelationship`
- Principal persistence operation: `prisma.diagnosisEvidenceRelationship.update`
- Canonical records written: Not proven.
- Projection fields written: `status`, `reviewedByUserId`, `reviewedAt`
- Revision records written: None identified.
- Reviewer or actor fields written: relationship reviewer fields.
- Other side effects: None identified.

### Governance and audit

- Audit classification: `ENTITY_REVIEW_FIELDS`
- Persisted decision record: Not proven; decision-like fields are stored on the entity row.
- Persisted event record: None identified.
- Entity review fields: relationship reviewer fields.
- Service logging: None identified.
- Evidence: `EvidenceGraphService.reviewRelationship`
- Missing governance evidence: No immutable deprecation record proven.

### Transaction and concurrency

- Transaction isolation: `SINGLE_OPERATION_NO_EXPLICIT_TRANSACTION`
- Revision binding: `STATUS_GATE_ONLY`
- Expected-version input: `ABSENT`
- Stale-write rejection: `NOT_PROVEN`
- Status gating: Relationship lookup only was proven.
- Idempotency: None identified.
- Concurrency assessment: No expected-version input.

### Verification

- Service tests:
  `doctordle-backend/src/modules/admin/evidence-graph.service.spec.ts`
  Coverage qualifier: `FILE_EXISTS_ACTION_NOT_PROVEN`; the service test file
  exists, but exact action or request-decision coverage was not reverified in
  this documentation pass.
- Permission tests:
  `doctordle-backend/src/modules/admin/admin-editorial-permissions.spec.ts`
  Coverage qualifier: `PERMISSION_ONLY`; verifies access level for the mapped controller route.
- Dashboard unit tests:
  `analytics-dashboard/src/features/editorial/workspace/actions/workspaceActionRegistry.test.ts`
  Coverage qualifier: `ACTION_REGISTRY_ONLY`; verifies dashboard action registration, not backend enforcement.
- Browser tests:
  `analytics-dashboard/qa/editorial-workspace-command-matrix.spec.ts`
  Coverage qualifier: `SMOKE_ONLY`; browser workflow coverage exists, but exact action execution is not proven.
- Runtime mapping: `COMPLETE`
- Canonical conformance: `PARTIAL`

### Open questions

- Should evidence relationship deprecation flag publication assessments?

## `WEOS-ACT-019` - `RUN_REASONING_DRAFT_VALIDATION`

### Canonical interpretation

- Canonical action: `VALIDATE_AI_DRAFT`
- Canonical action ID: Not proven.
- Canonical document:
  `docs/weos/WEOS-IMP-003-editorial-action-decision-catalogue.md`
- Canonical transition: validation result produced; no approval implied.
- Related open decisions: None identified.
- Open-decision dependency: `NONE_IDENTIFIED`
- Implementation gap: Which validation result statuses are canonical standing versus outcome?
- Gap tracking: `docs/weos/gaps/IMPLEMENTATION-GAPS.md`
- Interpretation confidence: Medium.

### Runtime mapping

- HTTP method: `POST`
- Route: `/admin/reasoning-draft-validation/run`
- Request decision or body: `artifactType`, `artifactId`
- Controller path: `doctordle-backend/src/modules/admin/admin.controller.ts`
- Controller symbol: `AdminController.runReasoningDraftValidation`
- Service path:
  `doctordle-backend/src/modules/admin/reasoning-draft-validation.service.ts`
- Service symbol: `ReasoningDraftValidationService.runForArtifact`
- Repository path: Not proven.
- Repository symbol: Not proven.
- Other directly invoked services: None identified.

### Authority

- Route guard: `AdminGuard`
- Backend permission check: `@EditorialAccess()`
- Backend role requirement: runtime permission level `editor`
- Frontend eligibility: Not proven from backend route alone.
- Canonical authority: Not proven.
- Authority mapping status: `PARTIAL`
- Evidence: `doctordle-backend/src/modules/admin/admin.controller.ts`

### State and persistence

- Runtime preconditions: `artifactType` and `artifactId` are required.
- Runtime transition: Validation run is created for artifact.
- Exact runtime status literals: Validation statuses from service; exact enum
  set not re-read in this pass.
- Models written: `ReasoningDraftValidationRun`
- Principal persistence operation: Not proven
- Canonical records written: Validation result only.
- Projection fields written: Validation run fields.
- Revision records written: None identified.
- Reviewer or actor fields written: None identified.
- Other side effects: None identified.

### Governance and audit

- Audit classification: `UNKNOWN`
- Persisted decision record: None identified.
- Persisted audit record: `ReasoningDraftValidationRun` model identified, but
  the creation operation is not proven in this mapping.
- Persisted event record: Not proven
- Entity review fields: None identified.
- Service logging: Not proven.
- Evidence:
  `doctordle-backend/src/modules/admin/reasoning-draft-validation.service.ts`
- Missing governance evidence: Validation is not approval or application.

### Transaction and concurrency

- Transaction isolation: `UNKNOWN`
- Revision binding: `NONE_IDENTIFIED`
- Expected-version input: `ABSENT`
- Stale-write rejection: `NOT_PROVEN`
- Status gating: Required request fields only.
- Idempotency: Not proven.
- Concurrency assessment: No expected-version input.

### Verification

- Service tests:
  `doctordle-backend/src/modules/admin/reasoning-draft-validation.service.spec.ts`
  Coverage qualifier: `TRANSITION_COVERAGE`; covers validation-run behaviour, not canonical approval.
- Controller tests: None identified.
- Dashboard unit tests:
  `analytics-dashboard/src/features/editorial/workspace/actions/workspaceActionRegistry.test.ts`
  Coverage qualifier: `ACTION_REGISTRY_ONLY`; verifies dashboard action registration, not backend enforcement.
- Browser tests:
  `analytics-dashboard/qa/editorial-workspace-command-matrix.spec.ts`
  Coverage qualifier: `SMOKE_ONLY`; browser workflow coverage exists, but exact action execution is not proven.
- Runtime mapping: `PARTIAL`
- Canonical conformance: `PARTIAL`

### Open questions

- Which validation result statuses are canonical standing versus outcome?

## `WEOS-ACT-020` - `GENERATE_UNSUPPORTED_CLAIM_REPAIR_DRAFT`

### Canonical interpretation

- Canonical action: `CREATE_AI_DRAFT`
- Canonical action ID: Not proven.
- Canonical document:
  `docs/weos/WEOS-IMP-003-editorial-action-decision-catalogue.md`
- Canonical transition: AI repair draft created, not accepted or applied.
- Related open decisions: None identified.
- Open-decision dependency: `NONE_IDENTIFIED`
- Implementation gap: Which exact backend route symbol owns unsupported-claim repair generation?
- Gap tracking: `docs/weos/gaps/IMPLEMENTATION-GAPS.md`
- Interpretation confidence: Medium.

### Runtime mapping

- HTTP method: `POST`
- Route: `/admin/diagnosis-workspace/:diagnosisRegistryId/claims/:claimId/repair`
- Request decision or body: Repair generation payload; exact DTO not fully
  re-read in this pass.
- Controller path: `doctordle-backend/src/modules/admin/admin.controller.ts`
- Controller symbol: Not fully verified for this route in this pass.
- Service path:
  `doctordle-backend/src/modules/admin/diagnosis-editorial-workspace.service.ts`
- Service symbol: `DiagnosisEditorialWorkspaceService` repair-generation
  symbol not fully verified in this pass.
- Repository path: Not proven.
- Repository symbol: Not proven.
- Other directly invoked services: None identified.

### Authority

- Route guard: `AdminGuard`
- Backend permission check: `@EditorialAccess()` likely, but exact decorator was
  not fully re-read for this route.
- Backend role requirement: `NOT_PROVEN`
- Frontend eligibility: `analytics-dashboard/src/api/admin.ts` repair API
  client entries.
- Canonical authority: Not proven.
- Authority mapping status: `NOT_PROVEN`
- Evidence: `analytics-dashboard/src/api/admin.ts`,
  `doctordle-backend/src/modules/admin/diagnosis-editorial-workspace.service.ts`

### State and persistence

- Runtime preconditions: Diagnosis workspace and claim exist; exact checks not
  fully re-read.
- Runtime transition: Creates repair draft audit; no application.
- Exact runtime status literals: Not fully verified in this pass.
- Models written: `AiDraftRevisionAudit`
- Principal persistence operation: Not proven
- Canonical records written: Not proven.
- Projection fields written: Audit row fields.
- Revision records written: None identified.
- Reviewer or actor fields written: Not fully verified.
- Other side effects: None identified.

### Governance and audit

- Audit classification: `PERSISTED_AUDIT_RECORD`
- Persisted decision record: None identified.
- Persisted audit record: `AiDraftRevisionAudit`
- Persisted event record: Not proven
- Entity review fields: None identified at creation.
- Service logging: Not proven.
- Evidence:
  `doctordle-backend/src/modules/admin/diagnosis-editorial-workspace.service.ts`
- Missing governance evidence: Creation is not acceptance or application.

### Transaction and concurrency

- Transaction isolation: `UNKNOWN`
- Revision binding: `NONE_IDENTIFIED`
- Expected-version input: `ABSENT`
- Stale-write rejection: `UNKNOWN`
- Status gating: Not fully verified.
- Idempotency: Not proven.
- Concurrency assessment: Partial mapping.

### Verification

- Service tests:
  `doctordle-backend/src/modules/admin/diagnosis-editorial-workspace.service.spec.ts`
  Coverage qualifier: `FILE_EXISTS_ACTION_NOT_PROVEN`; the service test file
  exists, but exact action or request-decision coverage was not reverified in
  this documentation pass.
- Controller tests: None identified.
- Dashboard unit tests:
  `analytics-dashboard/src/features/editorial/workspace/actions/workspaceActionRegistry.test.ts`
  Coverage qualifier: `ACTION_REGISTRY_ONLY`; verifies dashboard action registration, not backend enforcement.
- Browser tests:
  `analytics-dashboard/qa/editorial-workspace-smoke.spec.ts`
  Coverage qualifier: `SMOKE_ONLY`; browser workflow coverage exists, but exact action execution is not proven.
- Runtime mapping: `PARTIAL`
- Canonical conformance: `PARTIAL`

### Open questions

- Which exact backend route symbol owns unsupported-claim repair generation?

## Unmapped Canonical Actions

### `WEOS-UNMAPPED-REGISTRY-DEPRECATE` - `DEPRECATE_REGISTRY_ENTRY`

- Canonical document: `docs/weos/WEOS-IMP-002-lifecycle-transition-specification.md`, `docs/weos/WEOS-IMP-003-editorial-action-decision-catalogue.md`
- Canonical action ID: `DEPRECATE_REGISTRY_ENTRY`
- Runtime search performed: Searched registry lifecycle action literals, admin lifecycle route and registry merge paths.
- Routes inspected: `/admin/diagnosis-registry/:diagnosisRegistryId/lifecycle/action`
- Services inspected: `doctordle-backend/src/modules/diagnosis-registry/diagnosis-registry-lifecycle-policy.service.ts`, `doctordle-backend/src/modules/diagnosis-registry/diagnosis-registry-merge-execution.service.ts`
- Closest runtime behaviour: Merge execution can write `DiagnosisRegistryStatus.DEPRECATED`; lifecycle route exposes `deactivate` but no `deprecate` action.
- Why mapping remains unsafe: No first-class deprecate route, request decision, permission pathway or governance record is proven.
- Related open-decision ID: `NOT_REGISTERED`
- Blocks agent automation: Yes
- Recommended next investigation: Register a deprecation authority/gap decision and inspect merge execution separately.

### `WEOS-UNMAPPED-AUTHORISE-PUBLICATION` - `AUTHORISE_PUBLICATION`

- Canonical document: `docs/weos/WEOS-IMP-002-lifecycle-transition-specification.md`, `docs/weos/WEOS-IMP-003-editorial-action-decision-catalogue.md`
- Canonical action ID: `AUTHORISE_PUBLICATION`
- Runtime search performed: Searched admin case routes, case review service and education review endpoint.
- Routes inspected: `/admin/cases/:caseId/ready-to-publish`, `/admin/education/:educationId/review`
- Services inspected: `doctordle-backend/src/modules/admin/case-review.service.ts`, `doctordle-backend/src/modules/education/diagnosis-education.service.ts`
- Closest runtime behaviour: Case readiness route; education `status: PUBLISHED`.
- Why mapping remains unsafe: Case readiness is not publication authorisation; education publication combines review and publication.
- Related open-decision ID: `NOT_REGISTERED`
- Blocks agent automation: Yes
- Recommended next investigation: Define first-class publication decision route and authority.

### `WEOS-UNMAPPED-DECLINE-PUBLICATION` - `DECLINE_PUBLICATION`

- Canonical document: `docs/weos/WEOS-IMP-003-editorial-action-decision-catalogue.md`
- Canonical action ID: `DECLINE_PUBLICATION`
- Runtime search performed: Searched admin case routes and education review statuses.
- Routes inspected: `/admin/cases/:caseId/review`, `/admin/education/:educationId/review`
- Services inspected: `doctordle-backend/src/modules/admin/case-review.service.ts`, `doctordle-backend/src/modules/education/diagnosis-education.service.ts`
- Closest runtime behaviour: Case revision rejection; education `status: REJECTED`.
- Why mapping remains unsafe: Rejection of a revision is not first-class decline of publication for an approved publication candidate.
- Related open-decision ID: `NOT_REGISTERED`
- Blocks agent automation: Yes
- Recommended next investigation: Add publication-decline decision model and route if required.

### `WEOS-UNMAPPED-WITHDRAW-PUBLICATION` - `WITHDRAW_PUBLICATION`

- Canonical document: `docs/weos/WEOS-IMP-002-lifecycle-transition-specification.md`, `docs/weos/WEOS-IMP-003-editorial-action-decision-catalogue.md`
- Canonical action ID: `WITHDRAW_PUBLICATION`
- Runtime search performed: Searched admin case, education and publication-related routes.
- Routes inspected: No first-class route identified.
- Services inspected: `doctordle-backend/src/modules/admin/case-review.service.ts`, `doctordle-backend/src/modules/education/diagnosis-education.service.ts`
- Closest runtime behaviour: No first-class runtime behaviour identified.
- Why mapping remains unsafe: Withdrawal targets published artifact versions and schedule/exposure effects; no equivalent route is proven.
- Related open-decision ID: `NOT_REGISTERED`
- Blocks agent automation: Yes
- Recommended next investigation: Define publication history, withdrawal record and exposure/schedule effects.

### `WEOS-UNMAPPED-SUPERSEDE-PUBLICATION` - `SUPERSEDE_PUBLICATION`

- Canonical document: `docs/weos/WEOS-IMP-002-lifecycle-transition-specification.md`, `docs/weos/WEOS-IMP-003-editorial-action-decision-catalogue.md`
- Canonical action ID: `SUPERSEDE_PUBLICATION`
- Runtime search performed: Searched admin case, education and publication-related routes.
- Routes inspected: No first-class route identified.
- Services inspected: `doctordle-backend/src/modules/admin/case-review.service.ts`, `doctordle-backend/src/modules/education/diagnosis-education.service.ts`
- Closest runtime behaviour: New revisions and publish-like status changes.
- Why mapping remains unsafe: Supersession requires publication history and replacement-version semantics; no equivalent route is proven.
- Related open-decision ID: `NOT_REGISTERED`
- Blocks agent automation: Yes
- Recommended next investigation: Define supersession record and replacement published artifact version flow.

### `WEOS-UNMAPPED-REMAP-DIAGNOSIS-REFERENCE` - `REMAP_DIAGNOSIS_REFERENCE`

- Canonical document: `docs/weos/WEOS-IMP-002-lifecycle-transition-specification.md`, `docs/weos/WEOS-IMP-003-editorial-action-decision-catalogue.md`
- Canonical action ID: `REMAP_DIAGNOSIS_REFERENCE`
- Runtime search performed: Searched registry merge/link services and canonical docs.
- Routes inspected: Registry merge/link routes not revalidated as first-class WEOS remap in this correction.
- Services inspected: `doctordle-backend/src/modules/diagnosis-registry/diagnosis-registry-merge-execution.service.ts`, `doctordle-backend/src/modules/diagnosis-registry/diagnosis-registry-link.service.ts`
- Closest runtime behaviour: Registry merge execution can reassign references and create merge logs.
- Why mapping remains unsafe: Canonical remap requires source/target inventory, authority, rationale, impact assessment and concurrency.
- Related open-decision ID: `NOT_REGISTERED`
- Blocks agent automation: Yes
- Recommended next investigation: Map merge/link routes to WEOS remap requirements with exact expected-version evidence.

### `WEOS-UNMAPPED-GOVERNANCE-RECORD` - `GOVERNANCE_RECORD`

- Canonical document: `docs/weos/WEOS-IMP-003-editorial-action-decision-catalogue.md`, `docs/weos/WEOS-IMP-005-phase-2-open-decisions.md`
- Canonical action ID: Generic cross-artifact governance-record creation
- Runtime search performed: Searched case governance repository and entity review fields across case, registry, graph, education, teaching and evidence paths.
- Routes inspected: Multiple editorial routes; no generic cross-artifact governance route identified.
- Services inspected: `doctordle-backend/src/modules/admin/case-review-governance.repository.ts` plus mapped service paths above.
- Closest runtime behaviour: Case governance repository exists; many other paths use entity fields, status fields, logs or audit-specific rows.
- Why mapping remains unsafe: Model existence and service logging do not prove a generic governance record is written for every action.
- Related open-decision ID: `NOT_REGISTERED`
- Blocks agent automation: Yes
- Recommended next investigation: Register generic governance-record requirements and action-family coverage gaps.
