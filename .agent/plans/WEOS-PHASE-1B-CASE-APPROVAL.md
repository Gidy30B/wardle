# WEOS Phase 1B Case Approval Remediation ExecPlan

## Purpose

Repair the existing APP-006 `APPROVE_CASE_REVISION` runtime slice so approval
targets an explicit `CaseRevision`, resolves scoped authority through the
approved Stage 1 authority-assignment resolver, persists OD-018 decision
semantics, preserves exact review and validation basis, and keeps compatibility
projection writes atomic.

## Approved Authority

- Approval record: `docs/weos/authority/records/document-approvals/WEOS-AUTH-APP-006.json`
- Dependencies: `WEOS-AUTH-APP-001` through `WEOS-AUTH-APP-005`
- Branch: `weos/pilot-governance-runtime`
- Base commit: `9bbe883c6ec9d6fd376d53be649de7ac3a426a3b`

## Current Behavior

The initial Phase 1B implementation adds `GovernedCaseRevisionApprovalDecision`
and delegates approved review decisions through `CaseReviewService`, but the
independent review found missing open-review select fields, role-derived
authority, optional revision targeting, incomplete OD-018 persistence,
incomplete review/validation basis, nullable authorship acceptance, partial
idempotency, and catalogue formatting issues.

## Required Invariant

A `CaseRevision` may be approved only through `APPROVE_CASE_REVISION` when the
request explicitly targets the exact current revision, the review context and
validation basis match that revision, scoped authority resolves through the
approved authority-assignment resolver, separation-of-duties can be evaluated
from trusted revision authorship, and the governance decision plus legacy
approval projections commit atomically.

## Scope

Included:

- Existing admin case-review approval path only.
- Additive governance decision persistence for APP-006.
- Stage 1 authority-assignment resolver integration.
- Expected revision and review checks.
- Review/validation basis preservation.
- Idempotency handling for approval commands.
- Documentation evidence updates.

Excluded:

- Publication, publication readiness redesign, `DailyCase`, gameplay, learner
  exposure, Diagnosis Education governance, graph promotion, controlled AI
  application, broad lifecycle conversion, backfill, repair, deployment, and
  production rollout.

## Files Expected To Change

- `doctordle-backend/src/modules/admin/case-review.service.ts`
- `doctordle-backend/src/modules/admin/case-review.service.spec.ts`
- `doctordle-backend/test/app006-case-approval-race.e2e-spec.ts`
- `doctordle-backend/test/jest-e2e.json`
- `doctordle-backend/src/modules/admin/app006-case-revision-approval.decision.ts`
- `doctordle-backend/src/modules/admin/editorial-authority-assignment.repository.ts`
- `doctordle-backend/src/modules/admin/dto/submit-case-review.dto.ts`
- `doctordle-backend/prisma/schema.prisma`
- `doctordle-backend/prisma/migrations/20260808120000_governed_case_revision_approval/migration.sql`
- `docs/weos/implementation/WEOS-CONFORMANCE-MATRIX.md`
- `docs/weos/implementation/WEOS-IMPLEMENTATION-MAP.md`
- `docs/weos/authority/STATUS-AND-PRECEDENCE.md`

## Prohibited Changes

No publication, exposure, gameplay, graph, Diagnosis Education, controlled AI,
seed, repair, backfill, scheduler, importer, destructive migration, or broader
governance-kernel changes.

## Data Model Implications

Additive changes only. The existing uncommitted APP-006 migration may be
expanded before commit to include OD-018 envelope mapping fields, review basis,
authority resolution evidence, command fingerprint, persisted
`EditorialAuthorityAssignment` records, and deterministic material review-context
identity columns on `CaseReview` and `CaseValidationRun`. No historical approval
records are fabricated.

## API Implications

Approval requests through the existing review endpoint must explicitly provide
`expectedRevisionId`. `expectedReviewId`, `commandIdempotencyKey`, and
authority assignment references remain command metadata. Non-approval review
decisions retain compatibility.

## Migration Plan

Update the uncommitted APP-006 migration SQL additively. Do not apply it to
production data in this task.

## Compatibility Strategy

Legacy `Case.editorialStatus`, `Case.approvedAt`, and `Case.approvedByUserId`
remain compatibility projections. For approval, their supported writer is the
governed `APPROVE_CASE_REVISION` branch.

## OD-018 Field Mapping

| OD-018 concept           | Runtime source                                                                                                             | Validation status          |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| Command action           | Trusted service constant `APPROVE_CASE_REVISION`                                                                           | `SEMANTICALLY_VALIDATED`   |
| Idempotency              | Server-built canonical command fingerprint plus unique `commandIdempotencyKey`                                             | `SEMANTICALLY_VALIDATED`   |
| Envelope version         | Trusted APP-006 constant                                                                                                   | `SEMANTICALLY_VALIDATED`   |
| Extension type/version   | Trusted `CASE_REVISION_APPROVAL` extension constants                                                                       | `SEMANTICALLY_VALIDATED`   |
| Primary target           | Exact `CaseRevision` selected inside the approval transaction                                                              | `SEMANTICALLY_VALIDATED`   |
| Related targets          | Server-derived `CASE_REVISION`, `CASE_REVIEW`, `CASE_VALIDATION_RUN`, and `CASE_REVIEW_CONTEXT` references                 | `SEMANTICALLY_VALIDATED`   |
| Actor                    | Authenticated user ID passed to service                                                                                    | `SEMANTICALLY_VALIDATED`   |
| Authority evidence       | Persisted `EditorialAuthorityAssignment` loaded in-transaction, resolved by Stage 1 resolver                               | `SEMANTICALLY_VALIDATED`   |
| Expected state           | Explicit `expectedRevisionId`, optional `expectedReviewId`, and current transaction reads                                  | `SEMANTICALLY_VALIDATED`   |
| Review context           | Deterministic material hash and review-context identity stored on review and validation run                                | `SEMANTICALLY_VALIDATED`   |
| Decision payload         | Typed APP-006 extension payload plus canonical rationale/findings/outcome/effect/empty obligations                         | `SEMANTICALLY_VALIDATED`   |
| Compatibility projection | Server-built projection effect matching `Case.editorialStatus`, `Case.approvedAt`, and `Case.approvedByUserId` transaction | `SEMANTICALLY_VALIDATED`   |

## Testing Strategy

Targeted service tests must cover real query selection, explicit revision
targeting, authority absence and scoped authority success/failure, separation of
duties, stale state, blocking validation, OD-018 mapping persistence, review
basis persistence, rollback, legacy route delegation, idempotency replay and
conflict, migration historical integrity, and real Prisma/PostgreSQL concurrent
approval replay against a guarded local `weos_integration` database.

## Rollback/Recovery

Because changes are uncommitted, rollback is by reverting only the APP-006
remediation files. Migration is additive and creates no historical records.

## Progress

- [x] Independent conformance findings reviewed.
- [x] Missing ExecPlan created.
- [x] Runtime remediation implemented.
- [x] Docs updated.
- [x] R2 persisted authority and OD-018 semantic remediation implemented.
- [x] R4B Docker-backed PostgreSQL integration database provisioned.
- [x] R4B post-rollback idempotency replay implemented and tested.
- [x] R4B real Prisma/PostgreSQL concurrent approval tests completed.
- [x] Final verification completed.
- [x] Independent conformance review completed.
- [x] APP-006 closure evidence recorded.

## Discoveries

- A bounded `EditorialAuthorityAssignment` Prisma model is needed because no
  existing runtime persistence model represented the approved Stage 1 assignment
  contract.
- Revision equality alone is insufficient review freshness evidence; APP-006
  now records and checks a deterministic hash over material `CaseRevision`
  clinical/editorial fields and a review-context identity derived from revision
  ID plus hash.
- APP-006 approval has no remaining obligations in the approved runtime slice;
  the extension validator enforces the canonical empty obligation form.
- PostgreSQL aborts interactive transactions after uniqueness failures, so APP-006
  replay must happen after the failed transaction exits and must use the root
  Prisma client, never the aborted transaction client.
- In the real serializable PostgreSQL service race, the losing caller can surface
  as a Prisma serialization conflict before retry replay; APP-006 approval now
  routes that conflict through the same post-rollback root replay boundary for
  exact idempotent commands.
- The local Docker database service is `doctordle-db` using
  `pgvector/pgvector:pg16`; the isolated APP-006 test database is
  `weos_integration` with the `vector` extension enabled.

## Decisions

- Do not invent production assignments or derive them from roles. The service
  resolves only persisted `EditorialAuthorityAssignment` records loaded within
  the approval transaction; absence, expiry, revocation, or scope mismatch fails
  closed.
- Do not treat runtime roles as governance authority. Admin and senior-editor
  roles remain route-access evidence only.
- Do not proceed when `CaseRevision.createdByUserId` is absent; separation of
  duties requires trusted authorship provenance.
- Represent APP-006 OD-018 evidence through a typed
  `CASE_REVISION_APPROVAL` extension payload and validate the full
  `GovernanceDecisionEnvelope` before persistence.
- Handle concurrent idempotency after rollback by qualifying APP-006
  approval-decision uniqueness conflicts for `commandIdempotencyKey` or
  `reviewId`, reloading the prior decision through the root Prisma client,
  comparing the canonical fingerprint, and replaying only when the fingerprint
  matches. APP-006 approval serialization conflicts are also resolved through
  the same post-rollback replay boundary to avoid in-transaction replay after a
  failed PostgreSQL transaction.
- Insert the governed decision before the legacy `CaseReview` and `Case`
  compatibility projection updates inside the same serializable transaction so
  the real database race reaches the idempotency uniqueness boundary before row
  update locks serialize callers.

## Remaining Risks

- Existing legacy rows do not have fabricated material context hashes or
  authority assignments; APP-006 approval remains fail-closed until canonical
  persisted evidence exists for the target review and actor.
- `docker compose ps` remains unavailable in this checkout because
  `doctordle-backend/.env` is absent; direct Docker inspection shows
  `doctordle-db` healthy and was used for database evidence.
- Nonblocking closure finding: the real PostgreSQL race test proves the
  post-rollback replay path was exercised, but its test observability does not
  explicitly assert the exact Prisma conflict classification observed during
  the losing transaction. Future improvement: capture and assert the observed
  `conflictTarget`/error classification, including
  `serializableWriteConflict`/`P2034` where applicable. This does not weaken
  the APP-006 governed approval invariant.

## Final Closure

- Final independent review: `CONFORMANT_WITH_NONBLOCKING_FINDINGS`
- APP-006: `CLOSED`
- Phase 1B: `COMPLETE`
- Authorized operation: `APPROVE_CASE_REVISION`
- Closure authority: Final independent APP-006 conformance review
- Governance baseline commit SHA: `1009a80494b429cfc9eb9f7de50f1c677e1e4c7c`
- APP-006 implementation commit SHA: `c428fe1094e7a1a49250fb34bfb2b83d893df112`

Progression:

```text
initial implementation
-> independent review
-> authority/OD-018/material-context remediation
-> production wiring remediation
-> PostgreSQL transaction-abort discovery
-> post-rollback concurrency remediation
-> real Prisma/PostgreSQL race evidence
-> final closure review
```

Closure evidence:

- exact `CaseRevision` targeting and explicit review targeting are enforced;
- expected-version and stale-state checks fail closed before mutation;
- persisted editorial authority assignments are resolved through production
  Nest authority registry/provider wiring, with runtime role kept distinct from
  canonical authority;
- authority scope, separation of duties, unknown authorship, material-context
  hashing, review-context identity, validation basis, and blocking validation
  findings are all checked before approval;
- the OD-018 governance decision envelope is semantically validated for target
  references, authority evidence, rationale, timestamps, obligations, and
  compatibility projection;
- the immutable governed approval decision and legacy `Case`/`CaseReview`
  compatibility projection commit atomically inside a serializable transaction;
- no supported runtime case-approval bypass remains for APP-006 approval;
- dashboard approval uses the governed command path;
- sequential idempotency, fingerprint mismatch rejection, and PostgreSQL-safe
  concurrent idempotency are verified;
- post-rollback replay uses a fresh root Prisma boundary and never the failed
  transaction client;
- historical integrity and APP-006 scope containment are preserved.

Final PostgreSQL concurrency evidence:

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
comparison.
