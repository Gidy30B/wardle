# WEOS Pilot-Critical Conformance Matrix

Inspection date: 2026-08-09

This matrix is evidence, not approval.

## APP-006 Closure Status

| Field | Value |
| --- | --- |
| Authority record | `WEOS-AUTH-APP-006` |
| Authorized operation | `APPROVE_CASE_REVISION` |
| Implementation status | `CLOSED` |
| Conformance | `CONFORMANT_WITH_NONBLOCKING_FINDINGS` |
| Closure authority | Final independent APP-006 conformance review |
| Governance baseline commit SHA | `1009a80494b429cfc9eb9f7de50f1c677e1e4c7c` |
| APP-006 implementation commit SHA | `c428fe1094e7a1a49250fb34bfb2b83d893df112` |

APP-006 remains an approved authorization record whose bounded implementation
is now conformant and closed. This closure does not approve publication,
learner exposure, controlled AI application, graph promotion, Diagnosis
Education governance, broad lifecycle conversion, backfill, repair, destructive
migration, or a general governance-kernel rollout.

Final verified APP-006 evidence includes explicit exact `CaseRevision`
targeting, explicit review targeting, expected-version and stale-state
protection, persisted editorial authority assignments, production Nest
authority registry/provider wiring, role/authority separation, scoped authority
resolution, separation of duties, unknown authorship fail-closed behavior,
deterministic material-context hashing, review-context identity,
validation-basis consistency, blocking validation enforcement, semantically
conformant OD-018 governance decision envelope persistence, exact
target-reference validation, authority-evidence validation, rationale and
timestamp validation, obligation validation, compatibility-projection
validation, immutable governed decision persistence, serializable transaction
atomicity, no supported runtime case-approval bypass, governed dashboard
approval path, sequential idempotency, fingerprint mismatch rejection,
PostgreSQL-safe concurrent idempotency, fresh-Prisma post-rollback replay,
historical integrity, and APP-006 scope containment.

Final PostgreSQL concurrent-idempotency evidence:

| Requirement | Result |
| --- | --- |
| Concurrent unique-race evidence | `REAL_PRISMA_POSTGRESQL` |
| Database | local Docker PostgreSQL / dedicated `weos_integration` database |
| Identical concurrent commands | `PASS` |
| Post-rollback replay | `PASS` |
| Governed approval decisions persisted | `1` |
| Effective compatibility projection | `1` |
| Raw persistence error exposed to identical retry | `NO` |
| Mismatched fingerprint | `DETERMINISTIC CONFLICT` |
| Final concurrent idempotency | `PASS` |

PostgreSQL Serializable execution may surface the losing concurrent command as
a serialization conflict. APP-006 resolves that condition only after transaction
rollback, through a fresh persisted-decision lookup and canonical fingerprint
comparison.

Nonblocking finding retained: the real PostgreSQL race test proves that the
post-rollback replay path was exercised, but its test observability does not
explicitly assert the exact Prisma conflict classification observed during the
losing transaction. Current evidence demonstrates real collision, rollback,
fresh replay lookup, one persisted decision, one effective projection, and
deterministic replay/conflict behavior. Future improvement: capture and assert
the observed `conflictTarget`/error classification, including
`serializableWriteConflict`/`P2034` where applicable. This finding does not
weaken the APP-006 governed approval invariant and does not reopen APP-006.

| Requirement ID  | Source Requirement                      | Runtime Invariant                                                                    | Current Implementation                                                                                                                                                                                              | Target Implementation                                                                                 | Test / Evidence                                    | Status            | Authority Dependency                                          |
| --------------- | --------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ----------------- | ------------------------------------------------------------- |
| `WEOS-CONF-001` | Exact case identity                     | A learner-facing case has stable case identity.                                      | `Case.id`, `DailyCase.caseId`, `GameSession.caseId`, and `Attempt.caseId` exist.                                                                                                                                    | Preserve exact case identity through governed exposure records.                                       | Phase 0 learner exposure read path; gameplay tests | `PARTIAL`         | Publication/exposure decision required.                       |
| `WEOS-CONF-002` | Case revision identity                  | Approved/publicized content targets an exact revision.                               | Remediated Stage 2 `APPROVE_CASE_REVISION` requires explicit `expectedRevisionId` and targets exact `CaseRevision`; `DailyCase`, `GameSession`, and `Attempt` still do not bind to it.                              | Exposure and attempts preserve exact published revision or equivalent approved snapshot identity.     | `case-review.service.spec.ts`; Phase 0 read path   | `PARTIAL`         | Publication and exposure binding authority still required.    |
| `WEOS-CONF-003` | Approval versus publication distinction | Approval must not equal publication or exposure.                                     | Runtime uses editorial statuses and timestamps; daily assignment can mark `PUBLISHED`.                                                                                                                              | Separate governed approval, readiness, publication, schedule, and exposure records.                   | Phase 0 audit; gap register                        | `PARTIAL`         | `WEOS-OD-008`, `WEOS-OD-011`, `WEOS-OD-014`.                  |
| `WEOS-CONF-004` | Revision-targeted publication           | Publication targets an approved revision.                                            | No first-class published version binding in learner exposure path.                                                                                                                                                  | Publication decision references exact approved revision.                                              | Phase 0 read path                                  | `NOT_IMPLEMENTED` | Publication authority decision required.                      |
| `WEOS-CONF-005` | Learner exposure version identity       | Learner exposure records preserve content identity.                                  | Exposure reads mutable `Case`; sessions/attempts lack revision/version/hash.                                                                                                                                        | `DailyCase`/session/attempt or equivalent exposure record stores approved published version identity. | Phase 0 read path; gameplay tests                  | `DIVERGENT`       | Exposure model decision required.                             |
| `WEOS-CONF-006` | Authority distinction                   | Runtime access is not canonical authority.                                           | Closed Stage 2 `APPROVE_CASE_REVISION` loads persisted `EditorialAuthorityAssignment` candidates in the approval transaction, then resolves them through the Stage 1 authority-assignment resolver; guards remain technical access controls only. | Runtime commands validate scoped authority assignments independent of role.                           | `WEOS-AUTH-APP-006`; `case-review.service.spec.ts`; `editorial-authority-assignment.repository.ts` | `PARTIAL`         | APP-006 implementation is `CLOSED` and `CONFORMANT_WITH_NONBLOCKING_FINDINGS`; authority outside APP-006 still requires approval. |
| `WEOS-CONF-007` | Expected-version commands               | Stale governed writes fail without mutation.                                         | Closed Stage 2 `APPROVE_CASE_REVISION` requires expected revision, accepts expected review tokens, and fails closed on stale or conflicting idempotency inputs. Concurrent APP-006 approval replay now exits the failed PostgreSQL transaction before root-client lookup and canonical fingerprint comparison; final concurrent idempotency is `PASS`. | Governed commands declare expected state and fail closed on stale inputs.                             | `WEOS-AUTH-APP-006`; `case-review.service.spec.ts`; `test/app006-case-approval-race.e2e-spec.ts` using local Docker `weos_integration` | `PARTIAL`         | Repository-wide command enforcement not approved; APP-006 implementation is closed with a nonblocking observability finding. |
| `WEOS-CONF-008` | Immutable governance history            | Decisions preserve actor, authority, target, rationale, effect, and time.            | Closed Stage 2 `APPROVE_CASE_REVISION` builds and semantically validates an OD-018 `GovernanceDecisionEnvelope` with typed `CASE_REVISION_APPROVAL` payload, target references for revision/review/validation/context, persisted authority evidence, empty APP-006 obligations, exact projection metadata, review basis, and command fingerprint. The governed decision is inserted before legacy review/case projection updates inside the same serializable transaction so failed attempts commit neither decision nor projection. | Approved governance decision envelope integrated with runtime persistence.                            | `WEOS-AUTH-APP-006`; `case-review.service.spec.ts`; `app006-case-revision-approval.decision.ts`; real Prisma/PostgreSQL race spec | `PARTIAL`         | APP-006 implementation is `CLOSED`; other decision families still require authorization. |
| `WEOS-CONF-009` | Controlled AI application               | AI output remains candidate until accepted and applied through controlled operation. | AI draft audit and clue draft flows exist; acceptance/application semantics are service-local.                                                                                                                      | Separate accepted candidate, application authority, target, effect, and history.                      | mutation inventory; workspace specs                | `BLOCKED`         | Controlled application approval record required.              |
