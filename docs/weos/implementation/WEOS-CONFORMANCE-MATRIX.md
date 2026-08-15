# WEOS Pilot-Critical Conformance Matrix

Inspection date: 2026-08-15

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

## APP-007 Closure Status

| Field | Value |
| --- | --- |
| Authority record | `WEOS-AUTH-APP-007` |
| Authorized operation | `CREATE_CASE_REVISION` |
| Implementation status | `CLOSED` |
| Conformance | `CONFORMANT_WITH_NONBLOCKING_FINDINGS` |
| Baseline commit SHA | `fc0d24639f23cbf14d731bbb0ee5d07af3cde3b0` |
| APP-007 implementation commit SHA | `1a53f131ae99cbde50e1174a7e3395461fe55710` |
| Independent closure evidence commit | This closure-evidence commit |

APP-007 adds bounded runtime hardening for material case mutation through
`CREATE_CASE_REVISION`. The implementation adds nullable CaseRevision lineage,
content-hash, change-summary, change-reason, material-change, and command
idempotency persistence. Diagnosis relink/update and revision restore now use
explicit expected revision and idempotency inputs; approved clue draft
materialization fails closed because the stored draft contract does not yet
carry an explicit base revision/idempotency identity. Scheduled,
`READY_TO_PUBLISH`, and `PUBLISHED` cases also fail closed because learner
gameplay still reads mutable `Case` material through `DailyCase.caseId`.
R1 remediation also removes the supported existing-date `POST /cases` material
update bypass, evaluates compatible completed idempotency replay before stale
current-revision rejection, fingerprints the logical command before random
effect allocation, and adds APP-007 root-Prisma post-rollback replay evidence
against local PostgreSQL.

APP-007 command identity and revision content identity are intentionally
distinct. The command fingerprint represents the logical requested mutation and
excludes generated revision IDs, revision numbers, timestamps, and newly
allocated opaque clue keys. `CaseRevision.contentHash` represents the persisted
resulting material snapshot and may include final persisted clue keys.

R1 PostgreSQL evidence:

| Requirement | Result |
| --- | --- |
| Concurrent evidence | `REAL_PRISMA_POSTGRESQL` |
| Database | local Docker PostgreSQL / guarded `weos_integration` database |
| Identical concurrent `CREATE_CASE_REVISION` commands | `PASS` |
| Stored commands persisted | `1` |
| Resulting revisions persisted | `1` |
| Raw persistence error exposed to identical retry | `NO` |
| Competing same-base edits | `PASS`; one succeeds and one conflicts |
| Same-key fingerprint mismatch | `DETERMINISTIC CONFLICT` |
| APP-006 PostgreSQL regression on updated schema | `PASS` |

Independent closure verification on 2026-08-15 reran the guarded APP-007
PostgreSQL race E2E against local `weos_integration`, reran the APP-006
PostgreSQL regression, backend build, Prisma validate, focused APP-007 unit
and service specs, WEOS authority validation, dashboard build, and `git diff
--check`. The review found no supported material-edit bypass risk. The
retained nonblocking finding is scope containment: generated case/bootstrap
creation, registry merge repair, repair/seed scripts, publication projection,
and learner-exposure cutover remain outside APP-007 and require separate
authority where applicable.

APP-007 does not authorize publication, `PublishedCaseVersion`, DailyCase
binding changes, gameplay cutover, attempt provenance changes, controlled AI
application governance, graph promotion, education governance, tenancy,
backfill, repair, or destructive migration.

## APP-008 Authority Status

| Field | Value |
| --- | --- |
| Authority record | `WEOS-AUTH-APP-008` |
| Authorized package | Revision-Targeted Case Publication and Learner Exposure |
| Implementation status | `AUTHORIZED_NOT_IMPLEMENTED` |
| Conformance | `NOT_IMPLEMENTED` |
| Prerequisites | APP-006 exact `CaseRevision` approval; APP-007 closed `CREATE_CASE_REVISION` mutation hardening |

APP-008 authorizes later staged runtime work only. It preserves APP-006 as the
approval authority for an exact `CaseRevision`, APP-007 as the controlled
creation/mutation-hardening authority for `CaseRevision`, and APP-008 as the
separate publication and learner-exposure authority for an exact approved
revision. It authorizes APP-008A revision-targeted publication governance,
APP-008B `DailyCase` revision/publication binding, APP-008C `GameSession`
revision binding and revision-bound learner hydration, and APP-008D attempt
provenance and legacy hardening. It does not implement runtime code or change
the current conformance status of publication or learner exposure rows.

| Requirement ID  | Source Requirement                      | Runtime Invariant                                                                    | Current Implementation                                                                                                                                                                                              | Target Implementation                                                                                 | Test / Evidence                                    | Status            | Authority Dependency                                          |
| --------------- | --------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ----------------- | ------------------------------------------------------------- |
| `WEOS-CONF-001` | Exact case identity                     | A learner-facing case has stable case identity.                                      | `Case.id`, `DailyCase.caseId`, `GameSession.caseId`, and `Attempt.caseId` exist.                                                                                                                                    | Preserve exact case identity through governed exposure records.                                       | Phase 0 learner exposure read path; gameplay tests | `PARTIAL`         | Publication/exposure decision required.                       |
| `WEOS-CONF-002` | Case revision identity                  | Approved/publicized content targets an exact revision.                               | Remediated Stage 2 `APPROVE_CASE_REVISION` requires explicit `expectedRevisionId` and targets exact `CaseRevision`; APP-007 `CREATE_CASE_REVISION` adds lineage/hash/idempotency for supported material edits; `DailyCase`, `GameSession`, and `Attempt` still do not bind to it. | Exposure and attempts preserve exact published revision or equivalent approved snapshot identity.     | `case-review.service.spec.ts`; `case-revision.service.spec.ts`; Phase 0 read path   | `PARTIAL`         | Publication and exposure binding authority still required.    |
| `WEOS-CONF-003` | Approval versus publication distinction | Approval must not equal publication or exposure.                                     | Runtime uses editorial statuses and timestamps; daily assignment can mark `PUBLISHED`.                                                                                                                              | Separate governed approval, readiness, publication, schedule, and exposure records.                   | Phase 0 audit; gap register                        | `PARTIAL`         | `WEOS-OD-008`, `WEOS-OD-011`, `WEOS-OD-014`.                  |
| `WEOS-CONF-004` | Revision-targeted publication           | Publication targets an approved revision.                                            | No first-class published version binding in learner exposure path; APP-008 now authorizes later APP-008A publication governance but implements no runtime code.                                                       | Publication decision references exact approved revision.                                              | Phase 0 read path                                  | `NOT_IMPLEMENTED` | APP-008A implementation required.                             |
| `WEOS-CONF-005` | Learner exposure version identity       | Learner exposure records preserve content identity.                                  | Exposure reads mutable `Case`; sessions/attempts lack revision/version/hash; APP-008 authorizes later APP-008B through APP-008D binding/provenance work but implements no runtime code.                              | `DailyCase`/session/attempt or equivalent exposure record stores approved published version identity. | Phase 0 read path; gameplay tests                  | `DIVERGENT`       | APP-008B, APP-008C and APP-008D implementation required.      |
| `WEOS-CONF-006` | Authority distinction                   | Runtime access is not canonical authority.                                           | Closed Stage 2 `APPROVE_CASE_REVISION` loads persisted `EditorialAuthorityAssignment` candidates in the approval transaction, then resolves them through the Stage 1 authority-assignment resolver; guards remain technical access controls only. | Runtime commands validate scoped authority assignments independent of role.                           | `WEOS-AUTH-APP-006`; `case-review.service.spec.ts`; `editorial-authority-assignment.repository.ts` | `PARTIAL`         | APP-006 implementation is `CLOSED` and `CONFORMANT_WITH_NONBLOCKING_FINDINGS`; authority outside APP-006 still requires approval. |
| `WEOS-CONF-007` | Expected-version commands               | Stale governed writes fail without mutation.                                         | Closed Stage 2 `APPROVE_CASE_REVISION` requires expected revision, accepts expected review tokens, and fails closed on stale or conflicting idempotency inputs. Closed Stage 2 APP-007 `CREATE_CASE_REVISION` requires expected current revision and command idempotency for diagnosis relink/update and restore, blocks unsafe clue draft materialization, fails closed for existing-date `/cases` material updates, replays compatible completed commands before stale rejection, and uses root-Prisma post-rollback replay after qualifying PostgreSQL conflicts. | Governed commands declare expected state and fail closed on stale inputs.                             | `WEOS-AUTH-APP-006`; `WEOS-AUTH-APP-007`; `case-review.service.spec.ts`; `case-revision.service.spec.ts`; `cases.service.spec.ts`; `test/app006-case-approval-race.e2e-spec.ts`; `test/app007-case-revision-race.e2e-spec.ts` using local Docker `weos_integration` | `PARTIAL`         | Repository-wide command enforcement not approved; APP-006 and APP-007 closed for their named operations. |
| `WEOS-CONF-008` | Immutable governance history            | Decisions preserve actor, authority, target, rationale, effect, and time.            | Closed Stage 2 `APPROVE_CASE_REVISION` builds and semantically validates an OD-018 `GovernanceDecisionEnvelope` with typed `CASE_REVISION_APPROVAL` payload, target references for revision/review/validation/context, persisted authority evidence, empty APP-006 obligations, exact projection metadata, review basis, and command fingerprint. The governed decision is inserted before legacy review/case projection updates inside the same serializable transaction so failed attempts commit neither decision nor projection. | Approved governance decision envelope integrated with runtime persistence.                            | `WEOS-AUTH-APP-006`; `case-review.service.spec.ts`; `app006-case-revision-approval.decision.ts`; real Prisma/PostgreSQL race spec | `PARTIAL`         | APP-006 implementation is `CLOSED`; other decision families still require authorization. |
| `WEOS-CONF-009` | Controlled AI application               | AI output remains candidate until accepted and applied through controlled operation. | AI draft audit and clue draft flows exist; acceptance/application semantics are service-local.                                                                                                                      | Separate accepted candidate, application authority, target, effect, and history.                      | mutation inventory; workspace specs                | `BLOCKED`         | Controlled application approval record required.              |
