# WEOS Implementation Map

Inspection date: 2026-08-15

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
| Governance baseline commit SHA | `1009a80494b429cfc9eb9f7de50f1c677e1e4c7c` |
| APP-006 implementation commit SHA | `c428fe1094e7a1a49250fb34bfb2b83d893df112` |

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

## Closed Governed Runtime Command

`CREATE_CASE_REVISION` is the second closed conformant governed runtime command
under `WEOS-AUTH-APP-007`. Independent review completed on 2026-08-15 and
verified material mutation hardening, lineage, content-hash behavior, clue
identity, approval non-inheritance, validation/review non-inheritance,
idempotency, concurrency, bypass hardening, and interim learner-exposure
safety.

| Field | Value |
| --- | --- |
| Stage | Implemented |
| Conformance | `CONFORMANT_WITH_NONBLOCKING_FINDINGS` |
| Closure | `CLOSED` |
| Authority record | `WEOS-AUTH-APP-007` |
| Baseline commit SHA | `fc0d24639f23cbf14d731bbb0ee5d07af3cde3b0` |
| APP-007 implementation commit SHA | `1a53f131ae99cbde50e1174a7e3395461fe55710` |
| Independent closure evidence commit | This closure-evidence commit |

R1 remediation evidence:

| Evidence item | Result |
| --- | --- |
| Existing-date `POST /cases` material update bypass | Removed; endpoint fails closed and directs callers to governed revision edit path. |
| Sequential idempotency after current revision advanced | Matching successful command replay precedes stale-current rejection. |
| Keyless clue command identity | Command fingerprint is computed before opaque clue-key effect allocation. |
| Result replay | Replay loads the persisted result revision snapshot and clue keys. |
| Post-rollback replay | Root Prisma lookup compares stored `CaseRevisionCreationCommand` fingerprint after qualifying PostgreSQL persistence conflicts. |
| APP-007 PostgreSQL race evidence | `PASS` in `test/app007-case-revision-race.e2e-spec.ts` on local `weos_integration`. |
| APP-006 PostgreSQL regression | `PASS` in `test/app006-case-approval-race.e2e-spec.ts` after integration schema sync. |
| Independent review rerun | `PASS` on 2026-08-15; guarded `weos_integration` PostgreSQL race E2E, focused unit/spec tests, backend build, Prisma validate, WEOS authority check, dashboard build, and mutation-path audit. |
| Bypass audit | `PASS`; no supported material-edit bypass risk found. Generated case/bootstrap creation, registry merge repair, repair/seed scripts, and publication projection remain outside APP-007. |

## Staged Publication And Learner Exposure Slice

`WEOS-AUTH-APP-008` authorizes staged Revision-Targeted Case Publication and
Learner Exposure work. APP-008A now implements canonical revision-targeted
publication decisions. APP-008B now binds newly scheduler-created `DailyCase`
rows to an exact APP-008A publication decision and exact `CaseRevision`.
APP-008C and APP-008D remain open.

APP-008 preserves the package boundaries:

- APP-006: approval of an exact `CaseRevision`;
- APP-007: controlled creation and mutation hardening of `CaseRevision`;
- APP-008: separate authorization for publication and learner exposure of an
  exact approved revision.

Authorized staged sequence:

1. APP-008A - Revision-Targeted Publication Governance. Implemented.
2. APP-008B - `DailyCase` Revision / Publication Binding. Implemented for new
   governed DailyCase rows.
3. APP-008C - `GameSession` Revision Binding and Revision-Bound Learner
   Hydration.
4. APP-008D - Attempt Provenance and Legacy Hardening.

APP-007 is `CLOSED`; the APP-008A prerequisite for APP-007 independent-review
closure is satisfied.

| Area                         | Canonical / Current Service Owner                                                                                                  | Legacy Compatibility Owner                                       | Known Direct Mutation Paths                                                                                                                                 | Test Locations                                                                      | Status                                                                                      |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Case review                  | Stage 2 owner for `APPROVE_CASE_REVISION`: `CaseReviewService` governed approval branch under `WEOS-AUTH-APP-006`                  | `Case` status/timestamps and `CaseReview` records                | Admin case review route delegates approved decisions to governed approval; approvals require explicit expected revision plus matching material review context; ready-to-publish, diagnosis link/update, and revision restore remain separate | `doctordle-backend/src/modules/admin/case-review.service.spec.ts`; `doctordle-backend/test/app006-case-approval-race.e2e-spec.ts` | `APPROVE_CASE_REVISION` implemented; `CONFORMANT_WITH_NONBLOCKING_FINDINGS`; `CLOSED`; publication/exposure not included. |
| Case revision                | Stage 2 owner for `CREATE_CASE_REVISION`: `CaseRevisionService.createCaseRevisionCommandInTransaction` under `WEOS-AUTH-APP-007`                                                           | `Case.currentRevisionId`, mutable `Case` fields                  | Diagnosis relink/update and revision restore delegate to `CREATE_CASE_REVISION`; completed matching commands replay before stale rejection; command fingerprint excludes random effect allocation; root-Prisma rollback replay handles qualified PostgreSQL conflicts; clue draft apply and existing-date `/cases` updates fail closed until explicit revision/idempotency semantics exist. Generated case creation remains outside APP-007 mutation hardening. | `case-revision.service.spec.ts`; `case-revision-material.spec.ts`; `cases.service.spec.ts`; case review specs; `test/app007-case-revision-race.e2e-spec.ts` | `CONFORMANT_WITH_NONBLOCKING_FINDINGS`; `CLOSED`; not learner-exposure binding.                                             |
| Publication path             | APP-008A owner: `CasePublicationGovernanceService` canonical `CaseRevisionPublicationDecision`; compatibility projection still updates `Case.editorialStatus`/`publishedAt` | `Case.editorialStatus`, `approvedAt`, `publishedAt` | `AUTHORIZE_CASE_REVISION_PUBLICATION`; mark ready remains separate from publication; scheduler consumes only APP-008A authorized decisions for new governed rows | `case-publication-governance.service.spec.ts`; `app008a-case-publication-race.e2e-spec.ts`; daily cases specs | APP-008A implemented; publication/exposure not complete until APP-008B/C/D finish. |
| Learner exposure path        | APP-008B owner: `CaseAssignmentService` writes new `DailyCase.caseId`, `caseRevisionId`, and `publicationDecisionId` from active APP-008A publication decisions | `DailyCase.caseId` to mutable `Case`; nullable binding for legacy rows | daily-case schedule now binds new rows to exact publication provenance; start game and submit attempts still use existing mutable Case hydration/provenance | `daily-cases.service.spec.ts`, `session.service.spec.ts`, `attempt.service.spec.ts` | Partial; APP-008B implemented for new `DailyCase` rows; APP-008C/D still required. |
| Authority path               | Stage 2 owner for `APPROVE_CASE_REVISION`: `EditorialAuthorityAssignmentRepository` plus Stage 1 authority-assignment resolver under APP-006 | Runtime guards and roles                                         | Admin guards remain technical access; governed approval loads persisted assignment candidates in-transaction and rejects absent, expired, revoked, insufficient, or out-of-scope authority assignments | admin permission specs, authority assignment specs, `case-review.service.spec.ts`   | APP-006 authority path closed for `APPROVE_CASE_REVISION`; no role-to-authority conversion. |
| Governance decision envelope | Stage 2 owner for case revision approval history: `GovernedCaseRevisionApprovalDecision` and typed `CASE_REVISION_APPROVAL` extension | Case-specific review/audit records                               | Approved case review constructs a canonical OD-018 envelope, validates APP-006 target references/authority/obligations/projection metadata, stores validated envelope and extension payload, then writes legacy projection | governance-decision specs; `case-review.service.spec.ts`                            | APP-006 OD-018 envelope path closed for `APPROVE_CASE_REVISION`.                           |
| Expected-version commands    | Stage 2 owner for case revision approval: `CaseReviewService` explicit expected revision/review checks, material context identity, and idempotency fingerprint; Stage 2 owner for case material mutation: `CaseRevisionService` explicit expected current revision plus idempotency command fingerprint | Service-specific transaction/version behavior                    | Approved case review rejects missing or stale expected revision, stale review/material/validation context, and idempotency key conflicts; APP-006 approval-decision uniqueness races and approval serialization conflicts exit the failed PostgreSQL transaction before root-client replay. APP-007 `CREATE_CASE_REVISION` rejects stale new commands, replays matching completed commands before stale rejection, conflicts same-key/different-fingerprint commands, and resolves qualified PostgreSQL races only after rollback through root-client command lookup. | governed-command specs; `case-review.service.spec.ts`; `case-revision.service.spec.ts`; local Docker PostgreSQL `weos_integration` APP-006 and APP-007 race specs | APP-006 expected-version/idempotency path closed; APP-007 expected-version/idempotency path closed for `CREATE_CASE_REVISION`. |
| Compatibility projections    | Stage 2 owner for case approval projection: `APPROVE_CASE_REVISION` governed branch                                                | Mutable runtime status/timestamp fields                          | Governed decision creation and `Case.editorialStatus`, `Case.approvedAt`, `Case.approvedByUserId`, and `CaseReview` decision projection remain in the same serializable transaction; decision insertion precedes legacy projection writes so failed attempts commit neither decision nor projection | compatibility-projection specs; `case-review.service.spec.ts`; real Prisma/PostgreSQL race spec | APP-006 case approval projection ownership closed; no other projection writers approved.    |
| Controlled AI application    | Current owner: workspace/generation services                                                                                       | AI draft audit and clue draft status records                     | AI draft accept/reject/request/supersede/apply, generation paths; APP-007 blocks approved clue draft materialization rather than applying direct `Case.clues` mutation without explicit expected revision/idempotency. | targeted-case-generation and workspace specs; `diagnosis-editorial-workspace.service.ts`                                        | Decision required; no approved runtime authority found.                                     |
| Diagnosis graph              | Current owner: graph/admin services                                                                                                | candidate/fact tables and aliases                                | candidate review/generate, fact creation/update                                                                                                             | diagnosis graph specs                                                               | Graph approval/promotion separation unresolved.                                             |
| Diagnosis education          | EDU-002 owner: `DiagnosisEducationCandidateService` for AI whole/section candidates and controlled application; `DiagnosisEducationService` remains owner for manual edits and existing review lifecycle | education status/revision fields plus `DiagnosisEducationCandidate` and application command records | AI whole generation and section regeneration create candidates; Accept/Reject/Request Changes do not mutate Education; Apply is stale-safe/idempotent and creates a `NEEDS_REVIEW` Education revision; manual edit/review/publish/archive remain existing Education paths | education service specs; candidate service specs; workspace candidate integration | AI candidate-first generation implemented; exact Education approval/publication authority remains EDU-003. |
| Dashboard actions            | Current owner: dashboard components/action registry worktree                                                                       | UI state and route affordances                                   | workspace action handlers and runners                                                                                                                       | dashboard node tests                                                                | Evidence only; frontend authority cannot stand alone.                                       |

## Migration Locations

- Backend Prisma schema: `doctordle-backend/prisma/schema.prisma`
- Migrations: `doctordle-backend/prisma/migrations/`
- Seeds/repair scripts: `doctordle-backend/prisma/seed/`,
  `doctordle-backend/prisma/repair/`

Do not run seeds, repair scripts, backfills, migrations, schedulers, or
importers as verification.

## Files That Must Not Yet Be Changed Without New Authority

- learner exposure runtime path beyond APP-008B `DailyCase` binding:
  `GameSession`, `Attempt`, gameplay hydration, and provenance services;
- publication runtime path beyond APP-008A canonical publication decisions and
  APP-008B scheduler consumption;
- authority runtime integration outside `APPROVE_CASE_REVISION`;
- compatibility projection writers and repair paths outside governed case
  revision approval;
- graph promotion and evidence activation side-effect paths;
- education review/publication coupling paths;
- autonomous clue mutation paths that lack explicit expected revision and
  idempotency identity.

Exact next candidate implementation slice: APP-008C - GameSession Revision
Binding and Revision-Bound Learner Hydration.
