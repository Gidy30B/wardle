# WEOS Implementation Map

Inspection date: 2026-08-09

This map tells future agents where current behavior lives. It is evidence, not
approval.

## Closed Governed Runtime Command

`APPROVE_CASE_REVISION` is the first closed conformant governed runtime command
under `WEOS-AUTH-APP-006`.

| Field | Value |
| --- | --- |
| Stage | Implemented |
| Conformance | `CONFORMANT_WITH_NONBLOCKING_FINDINGS` |
| Closure | `CLOSED` |
| Reference implementation | YES |
| Implementation commit SHA | `PENDING_COMMIT` |

APP-006 establishes the current governed-command runtime pattern for subsequent
bounded slices: exact target selection, explicit expected-state checks,
persisted scoped authority resolution, semantically validated OD-018 decision
persistence, atomic compatibility projection, and idempotent replay only when a
persisted decision has a matching canonical fingerprint. Subsequent slices still
require separate authorization.

Final PostgreSQL concurrency evidence for APP-006:

| Evidence item | Result |
| --- | --- |
| Concurrent unique-race evidence | `REAL_PRISMA_POSTGRESQL` |
| Database | local Docker PostgreSQL / dedicated `weos_integration` database |
| Identical concurrent commands | `PASS` |
| Post-rollback replay | `PASS` |
| Governed approval decisions persisted | `1` |
| Effective compatibility projection | `1` |
| Raw persistence error exposed to identical retry | `NO` |
| Mismatched fingerprint | `DETERMINISTIC CONFLICT` |

PostgreSQL Serializable execution may surface the losing concurrent command as
a serialization conflict. APP-006 resolves that condition only after transaction
rollback, through a fresh persisted-decision lookup and canonical fingerprint
comparison. A retained nonblocking finding notes that the real PostgreSQL race
test proves post-rollback replay but does not explicitly assert the exact Prisma
conflict classification observed during the losing transaction; this does not
weaken the governed approval invariant.

| Area                         | Canonical / Current Service Owner                                                                                                  | Legacy Compatibility Owner                                       | Known Direct Mutation Paths                                                                                                                                 | Test Locations                                                                      | Status                                                                                      |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Case review                  | Stage 2 owner for `APPROVE_CASE_REVISION`: `CaseReviewService` governed approval branch under `WEOS-AUTH-APP-006`                  | `Case` status/timestamps and `CaseReview` records                | Admin case review route delegates approved decisions to governed approval; approvals require explicit expected revision plus matching material review context; ready-to-publish, diagnosis link/update, and revision restore remain separate | `doctordle-backend/src/modules/admin/case-review.service.spec.ts`; `doctordle-backend/test/app006-case-approval-race.e2e-spec.ts` | `APPROVE_CASE_REVISION` implemented; `CONFORMANT_WITH_NONBLOCKING_FINDINGS`; `CLOSED`; publication/exposure not included. |
| Case revision                | Current owner: `CaseReviewService`, `DiagnosisEditorialWorkspaceService`                                                           | `Case.currentRevisionId`, mutable `Case` fields                  | Revision create/restore, clue draft apply                                                                                                                   | case review and workspace service specs                                             | Partial; not learner-exposure binding.                                                      |
| Publication path             | Current owner: `CaseReviewService` and `CaseAssignmentService` projections                                                         | `Case.editorialStatus`, `approvedAt`, `publishedAt`, `DailyCase` | mark ready, schedule/assignment publishes projection                                                                                                        | daily cases/session/case review specs                                               | Divergent; revision-targeted publication unresolved.                                        |
| Learner exposure path        | Current owner: gameplay services                                                                                                   | `DailyCase.caseId` to mutable `Case`                             | daily-case schedule, start game, submit attempts                                                                                                            | `daily-cases.service.spec.ts`, `session.service.spec.ts`, `attempt.service.spec.ts` | Divergent; version binding absent.                                                          |
| Authority path               | Stage 2 owner for `APPROVE_CASE_REVISION`: `EditorialAuthorityAssignmentRepository` plus Stage 1 authority-assignment resolver under APP-006 | Runtime guards and roles                                         | Admin guards remain technical access; governed approval loads persisted assignment candidates in-transaction and rejects absent, expired, revoked, insufficient, or out-of-scope authority assignments | admin permission specs, authority assignment specs, `case-review.service.spec.ts`   | APP-006 authority path closed for `APPROVE_CASE_REVISION`; no role-to-authority conversion. |
| Governance decision envelope | Stage 2 owner for case revision approval history: `GovernedCaseRevisionApprovalDecision` and typed `CASE_REVISION_APPROVAL` extension | Case-specific review/audit records                               | Approved case review constructs a canonical OD-018 envelope, validates APP-006 target references/authority/obligations/projection metadata, stores validated envelope and extension payload, then writes legacy projection | governance-decision specs; `case-review.service.spec.ts`                            | APP-006 OD-018 envelope path closed for `APPROVE_CASE_REVISION`.                           |
| Expected-version commands    | Stage 2 owner for case revision approval: `CaseReviewService` explicit expected revision/review checks, material context identity, and idempotency fingerprint | Service-specific transaction/version behavior                    | Approved case review rejects missing or stale expected revision, stale review/material/validation context, and idempotency key conflicts; APP-006 approval-decision uniqueness races and approval serialization conflicts exit the failed PostgreSQL transaction before root-client replay, and replay succeeds only on matching canonical fingerprint | governed-command specs; `case-review.service.spec.ts`; local Docker PostgreSQL `weos_integration` race spec | APP-006 expected-version/idempotency path closed; bounded to `APPROVE_CASE_REVISION`.       |
| Compatibility projections    | Stage 2 owner for case approval projection: `APPROVE_CASE_REVISION` governed branch                                                | Mutable runtime status/timestamp fields                          | Governed decision creation and `Case.editorialStatus`, `Case.approvedAt`, `Case.approvedByUserId`, and `CaseReview` decision projection remain in the same serializable transaction; decision insertion precedes legacy projection writes so failed attempts commit neither decision nor projection | compatibility-projection specs; `case-review.service.spec.ts`; real Prisma/PostgreSQL race spec | APP-006 case approval projection ownership closed; no other projection writers approved.    |
| Controlled AI application    | Current owner: workspace/generation services                                                                                       | AI draft audit and clue draft status records                     | AI draft accept/reject/request/supersede/apply, generation paths                                                                                            | targeted-case-generation and workspace specs                                        | Decision required; no approved runtime authority found.                                     |
| Diagnosis graph              | Current owner: graph/admin services                                                                                                | candidate/fact tables and aliases                                | candidate review/generate, fact creation/update                                                                                                             | diagnosis graph specs                                                               | Graph approval/promotion separation unresolved.                                             |
| Diagnosis education          | Current owner: `DiagnosisEducationService` and admin education controller                                                          | education status/revision fields                                 | generate, review/publish/archive, section regeneration                                                                                                      | education service specs                                                             | Publication separation unresolved.                                                          |
| Dashboard actions            | Current owner: dashboard components/action registry worktree                                                                       | UI state and route affordances                                   | workspace action handlers and runners                                                                                                                       | dashboard node tests                                                                | Evidence only; frontend authority cannot stand alone.                                       |

## Migration Locations

- Backend Prisma schema: `doctordle-backend/prisma/schema.prisma`
- Migrations: `doctordle-backend/prisma/migrations/`
- Seeds/repair scripts: `doctordle-backend/prisma/seed/`,
  `doctordle-backend/prisma/repair/`

Do not run seeds, repair scripts, backfills, migrations, schedulers, or
importers as verification.

## Files That Must Not Yet Be Changed Without New Authority

- learner exposure runtime path: `DailyCase`, `GameSession`, `Attempt`, gameplay
  services;
- publication runtime path: case review publication readiness and scheduler
  projection writes;
- authority runtime integration outside `APPROVE_CASE_REVISION`;
- compatibility projection writers and repair paths outside governed case
  revision approval;
- graph promotion and evidence activation side-effect paths;
- education review/publication coupling paths;
- clue-level identity schema and autonomous clue mutation paths.

Next candidate slice: Case Revision Mutation Hardening requires separate
authorization.
