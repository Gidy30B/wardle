# WEOS Phase 1C - APP-007 Case Revision Mutation Hardening

Status: CLOSED

## Objective

Implement the bounded APP-007 runtime slice for canonical action
`CREATE_CASE_REVISION`, without publication, learner-exposure cutover,
controlled AI application, destructive migration, or self-closing conformance.

## Authority

- `WEOS-AUTH-APP-007`: Stage 2 Case Revision Mutation Hardening Runtime
  Authorization.
- Baseline SHA: `fc0d24639f23cbf14d731bbb0ee5d07af3cde3b0`.
- APP-006 anchor: `c428fe1094e7a1a49250fb34bfb2b83d893df112`.

## Mutation Inventory

| Path | Classification | Notes |
| --- | --- | --- |
| `CaseRevisionService.createRevisionFromSnapshotInTransaction` | CANONICAL_REVISION_CREATION_CANDIDATE | Generated-case/bootstrap helper creates revision and updates `Case.currentRevisionId`; remains outside ordinary supported edit paths. APP-007 governed edits use `createCaseRevisionCommandInTransaction`. |
| `CaseReviewService.applyDiagnosisLinkInTransaction` | CREATE_CASE_REVISION | Diagnosis link/update/create-and-link delegate material projection to `CREATE_CASE_REVISION` with explicit expected revision and command idempotency. |
| `CaseReviewService.restoreRevision` | CREATE_CASE_REVISION | Restore creates a forward revision via `CREATE_CASE_REVISION` and now uses the shared validation-run creation path with material context and review-context identity. |
| `DiagnosisEditorialWorkspaceService.applyApprovedClueRevisionDraft` | FAIL_CLOSED | Approved clue draft application no longer mutates `Case` or draft state without APP-007 expected-revision/idempotency context. |
| `CasesService.createCase` new case | CREATE_ONLY | Creates genuinely new manual cases where no existing date row exists. |
| `CasesService.createCase` existing-date branch | FAIL_CLOSED | Existing-date material update bypass removed; callers must use governed revision edit path. |
| `CaseGeneratorService` case creation | AI_CALLER | Creates generated case material; APP-007 does not authorize generic controlled AI application. Existing creation path remains classified, not broadened. |
| `DiagnosisRegistryMergeExecutionService` `case.updateMany` / `caseRevision.updateMany` | REPAIR_OR_BACKFILL / registry merge | Bulk remaps diagnosis registry references during merge; not ordinary authoring. Must remain out of APP-007 runtime edit path. |
| `CaseAssignmentService.markCreatedCasesPublished` | PUBLICATION_OR_SCHEDULING | Marks ready cases published after DailyCase assignment; not APP-007. |
| `prisma/seed/*`, `prisma/repair/*` | SEED_OR_DEMO / REPAIR_OR_BACKFILL | Data setup or repair scripts. Not ordinary runtime APIs; do not alter unless directly callable by runtime. |

## R1 Remediation Inventory

| Mutation path | Material? | Runtime supported? | Final APP-007 behavior |
| --- | ---: | ---: | --- |
| CasesService create new | Yes | Yes | `CREATE_ONLY`; creates new `Case` rows, no existing material update. |
| CasesService existing-date upsert | Yes | Yes | `FAIL_CLOSED`; existing date no longer writes material fields through `POST /cases`. |
| Diagnosis link | Yes | Yes | `CREATE_CASE_REVISION`. |
| Diagnosis update | Yes | Yes | `CREATE_CASE_REVISION`. |
| Create-and-link diagnosis | Yes | Yes | `CREATE_CASE_REVISION` for case material projection. |
| Revision restore | Yes | Yes | `CREATE_CASE_REVISION`; validation uses shared material-context helper. |
| Clue draft apply | Yes | Yes | `FAIL_CLOSED`; draft and case remain unchanged without explicit APP-007 command context. |
| Generation | Yes | Yes | Classified `AI_CALLER`; not expanded by APP-007. |
| Merge | Yes | Repair/backfill | Out of ordinary runtime edit scope. |
| Admin/editorial direct edit | Yes | Yes where present | Diagnosis/restore paths delegate; unsupported clue application fails closed. |
| Repair/backfill | Yes | No ordinary runtime | Separately classified; not changed. |
| Seeds | Yes | No ordinary runtime | Separately classified; not changed. |

## Canonical Material-Field Map

| Canonical concept | Current Case field | Current CaseRevision field | Material? | Hash participation |
| --- | --- | --- | --- | --- |
| Title | `title` | `title` | Yes | Yes |
| Presentation/history | `history` | `history` | Yes | Yes |
| Symptoms | `symptoms` | `symptoms` | Yes | Yes |
| Labs/investigations | `labs` | `labs` | Yes | Yes |
| Clues | `clues` | `clues` | Yes | Yes |
| Clue order | `clues` array order | `clues` array order | Yes | Yes |
| Explanation | `explanation` | `explanation` | Yes | Yes |
| Differentials | `differentials` | `differentials` | Yes | Yes |
| Diagnosis relationship | `diagnosisId`, `diagnosisRegistryId`, mapping fields | same | Yes | Yes |
| Difficulty | `difficulty` | `difficulty` | Yes | Yes |
| Source | NOT_MODELED on `Case` | `source` | Yes for revision provenance | Yes |
| Publication track | NOT_MODELED on `Case` | `publishTrack` | Yes when represented | Yes |
| Educational purpose | NOT_MODELED | NOT_MODELED | No current field | No |
| Learning-goal refs | `learningGoalCoverage` relation | NOT_MODELED on revision | No revision field | No |

## Content-Hash Definition

Use APP-006 `stableStringify` and the existing material context field set as the
shared canonicalization basis. Extract/reuse it so APP-006
`materialContextHash` and APP-007 `CaseRevision.contentHash` cannot drift.
Normalize object keys, preserve array order, preserve clue order, serialize
dates deterministically, and exclude IDs, timestamps, approval state,
validation/review state, and operational metadata.

## Clue-Key Strategy

Resulting revisions must reject duplicate clue keys. Existing keyed clues retain
keys across reorder/edit. New clues receive opaque stable keys. Legacy keyless
base revisions are not rewritten; new resulting revisions establish keys while
preserving uncertainty about historical cross-revision identity.

## Compatibility Projection

APP-006 approval decisions remain bound to the old revision. New revisions clear
legacy approval projection fields using existing approved reset semantics
(`approvedAt = null`, `approvedByUserId = null`) and use the existing
validation-result status mapping after a new validation run.

## Published/Scheduled Safety

`DailyCase` currently links to mutable `Case`, and gameplay payloads read
`Case.title`, `difficulty`, `clues`, `explanation`, and `differentials`.
Therefore material projection to `Case` can alter scheduled or learner-facing
content. Phase 1C must fail closed for scheduled, `READY_TO_PUBLISH`, or
`PUBLISHED` cases rather than implementing `PublishedCaseVersion`.

## Idempotency

Persist `CREATE_CASE_REVISION` command idempotency with a unique
`commandIdempotencyKey`, canonical command fingerprint, result revision ID, and
status. Equivalent retries replay the prior compatible result. Same key with a
different base or payload is a deterministic conflict.

R1 remediation separates command identity from effect allocation. The command
fingerprint is built from the logical request before new opaque clue keys,
revision IDs, revision numbers, timestamps, or result IDs are allocated. The
persisted revision `contentHash` remains the identity of the resulting material
snapshot and may include the final persisted clue keys. Compatible completed
idempotency replay is checked before stale-current rejection, and replay loads
the persisted result revision snapshot so generated clue keys are not
regenerated.

PostgreSQL rollback replay follows the APP-006 principle: after a qualifying
`P2002`/`P2034`, the failed transaction exits and a root Prisma lookup loads
`CaseRevisionCreationCommand`, compares the deterministic fingerprint, and only
replays when the stored successful result revision exists. Mismatches remain
deterministic conflicts.

## Migration

Additive only. Add nullable lineage/hash/change fields to `CaseRevision` and a
bounded idempotency table for APP-007. Do not backfill historical lineage,
content hash, or clue keys.

## Tests

Focused backend tests must cover new revision creation, source immutability,
expected revision conflict, lineage, hash behavior, approval non-inheritance,
validation/review non-inheritance, clue key behavior, idempotency, concurrency
or unique-conflict handling, scheduled/published safety, and bypass hardening.

R1 verification evidence:

| Evidence | Result |
| --- | --- |
| APP-007 focused unit tests | `PASS` |
| APP-007 real PostgreSQL identical retry | `PASS`; one command, one resulting revision, equivalent caller results. |
| APP-007 real PostgreSQL competing same-base edits | `PASS`; one winner, one conflict, one current successor. |
| APP-007 real PostgreSQL mismatch | `PASS`; deterministic idempotency conflict. |
| APP-006 real PostgreSQL regression after schema sync | `PASS` |

The guarded local `weos_integration` database was schema-synced with current
Prisma schema using `prisma db push` after `migrate deploy` refused the
pre-existing non-baselined integration database. No production database was
used.

Independent closure verification on 2026-08-15:

| Evidence | Result |
| --- | --- |
| Base verification | `PASS`; branch `weos/phase-1c-case-revision-hardening`, starting HEAD `cbcbc03230a7cf71dfe0ce4688f2466530566486`, clean worktree. |
| Integration database safety | `PASS`; `WEOS_INTEGRATION_TESTS=1`, local host, database name exactly `weos_integration`, ordinary `DATABASE_URL` cleared, guard refuses non-local/prod/shared URLs. |
| APP-007 PostgreSQL race E2E | `PASS`; `test/app007-case-revision-race.e2e-spec.ts`, 3 tests. |
| APP-007 test harness repair | `PASS`; fixed duplicate throwaway destructuring alias in the E2E fixture so the committed guard test can parse and run. |
| APP-007 focused unit/spec validation | `PASS`; 5 suites, 94 tests. |
| APP-006 PostgreSQL regression | `PASS`; `test/app006-case-approval-race.e2e-spec.ts`, 2 tests. |
| Backend build | `PASS`; `npm run build`. |
| Prisma schema validation | `PASS`; `npx prisma validate --schema prisma/schema.prisma` after elevated schema-engine access. |
| WEOS authority validation | `PASS`; 1 suite, 11 tests. |
| Analytics dashboard build | `PASS`; `npm run build`. |
| Diff check | `PASS`; CRLF warnings only. |
| Mutation-path audit | `PASS`; no supported material-edit bypass risk found. |
| Closure evidence commit | This closure-evidence commit. |

## Findings

- R1 blocking findings remediated: supported existing-date `/cases` material
  update bypass removed; sequential idempotency replay now precedes stale
  rejection for matching completed commands; command fingerprint no longer
  includes randomly allocated new clue keys; APP-007 has real PostgreSQL
  rollback replay evidence.
- Existing gameplay reads mutable `Case`; scheduled/published material edits
  cannot safely project to `Case` in this slice.
- Existing clue JSON has no guaranteed stable key.

## Decisions And Ambiguities

- Legacy keyless clue identity cannot be confidently reconstructed; preserve
  uncertainty and establish keys only on resulting revisions.
- `PublishedCaseVersion` and gameplay cutover remain explicitly excluded.

## Independent Review Gate

Independent review completed on 2026-08-15. APP-007 is `CLOSED` with
`CONFORMANT_WITH_NONBLOCKING_FINDINGS` conformance, matching the existing
repository status vocabulary for independently verified bounded runtime
implementation. The retained nonblocking finding is that generated case
creation, repair/backfill scripts, registry merge repair, publication
projection, and learner-exposure cutover remain outside APP-007 and require
their own authority where applicable.
