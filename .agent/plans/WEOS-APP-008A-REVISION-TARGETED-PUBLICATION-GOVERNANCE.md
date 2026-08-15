# WEOS APP-008A - Revision-Targeted Publication Governance

## Purpose

Implement the APP-008A invariant that canonical Case publication authorization
targets one exact approved `CaseRevision` and is separate from approval,
scheduling, `DailyCase`, learner exposure, session hydration, and attempt
provenance.

## Approved Authority

- Approval record: `WEOS-AUTH-APP-008`
- Authorized stage: APP-008A - revision-targeted publication governance
- Branch: `weos/phase-1c-case-revision-hardening`
- Required baseline: `3d77f46592d8d175bddf87bec56462ccaa636958`
- Prerequisites:
  - APP-006 closed for exact `CaseRevision` approval.
  - APP-007 closed for `CREATE_CASE_REVISION` mutation hardening.

## Current Behavior

Current publication-like behavior is represented by mutable `Case`
compatibility fields. `CaseReviewService.markReadyToPublish` checks an
approved case, diagnosis publish readiness, and playable clues, then sets
`Case.editorialStatus` to `READY_TO_PUBLISH`. `CaseAssignmentService` later
creates `DailyCase` rows and marks created cases `PUBLISHED` with
`Case.publishedAt`. These fields are compatibility projections and do not
identify an exact approved `CaseRevision` publication decision.

## Required Invariant

Successful APP-008A publication authorization must:

- identify exact `caseId` and `caseRevisionId`;
- reference an exact APP-006 approval decision;
- verify expected revision, approval decision, material context, validation
  context, readiness, authority, and absence of active publication conflict
  inside the publication transaction;
- persist a canonical publication decision before writing compatibility
  projections;
- support idempotent replay and deterministic fingerprint conflict;
- preserve historical publication records rather than rewriting old decisions.

## Scope

Included:

- additive publication standing enum and persisted publication decision model;
- additive publication command/idempotency model;
- revision-specific publication readiness computation;
- governed publication command service;
- minimal admin read/write API to inspect readiness, publish a revision, and
  inspect standing/history;
- guarded PostgreSQL race E2E;
- minimal conformance evidence updates after validation.

Excluded:

- `DailyCase.caseRevisionId`;
- `DailyCase.publicationDecisionId`;
- `GameSession.caseRevisionId`;
- `Attempt.caseRevisionId`;
- revision-bound learner hydration;
- scheduler cutover to canonical publication decisions;
- historical publication backfill or fabricated legacy records;
- withdrawal/supersession command UI.

## Files Expected To Change

- `doctordle-backend/prisma/schema.prisma`
- `doctordle-backend/prisma/migrations/**`
- `doctordle-backend/src/modules/admin/app008a-*`
- `doctordle-backend/src/modules/admin/case-publication-governance.service.ts`
- `doctordle-backend/src/modules/admin/dto/*publication*`
- `doctordle-backend/src/modules/admin/admin.controller.ts`
- `doctordle-backend/src/modules/admin/admin.module.ts`
- guarded APP-008A e2e spec
- APP-008A conformance/docs evidence

## Prohibited Changes

Do not alter `DailyCase`, `GameSession`, or `Attempt` revision identity. Do not
change learner-facing hydration, scheduler selection, or historical case
assignment semantics. Do not create publication records for existing
`PUBLISHED` or `READY_TO_PUBLISH` rows.

## Data Model Implications

Additive Prisma migration only. New records store publication decision,
standing, exact revision target, APP-006 approval decision, authority evidence,
readiness snapshot, command fingerprint, idempotency key, minimal content
boundary snapshot, and optional withdrawal/supersession references.

## API Implications

Add minimal senior-editor admin endpoints for revision publication readiness,
standing/history, and command submission. Publication does not schedule or
create `DailyCase`.

## Migration Plan

Generate and manually inspect one additive Prisma migration. No data backfill.
No destructive migration.

## Compatibility Strategy

After canonical publication succeeds, update only existing authorized
compatibility projections on `Case`: `editorialStatus=PUBLISHED` and
`publishedAt`. Existing ready-to-publish and scheduler behavior remains
compatibility behavior until APP-008B/C/D.

## Testing Strategy

- APP-008A guarded PostgreSQL race E2E against local `weos_integration`;
- APP-006 and APP-007 focused regression suites and race suites;
- backend build, Prisma validate/generate, WEOS authority check, diff check.

## Rollback/Recovery

Revert the APP-008A commit and apply the inverse migration before production
rollout. Because this task performs no backfill and does not alter learner
identity tables, rollback does not need historical learner exposure repair.

## Progress

- [x] Verify baseline.
- [x] Read APP-008 authority and prerequisites.
- [x] Map current publication compatibility path.
- [x] Implement additive schema and migration.
- [x] Implement APP-008A service/API.
- [x] Add guarded race tests.
- [x] Run validation.
- [x] Update conformance evidence.
- [ ] Commit APP-008A only.

## Discoveries

- `Case.editorialStatus`, `Case.publishedAt`, `Case.approvedAt`, and
  `Case.approvedByUserId` currently substitute for publication/approval
  compatibility projections.
- Scheduler assignment remains driven by `APPROVED` and `READY_TO_PUBLISH`
  case status and must not be cut over in APP-008A.
- APP-006 approval material context is stored inside the approval decision
  `reviewBasis` payload, not as a top-level governed approval decision column.
- Legacy `Case.editorialStatus=PUBLISHED` remains a compatibility projection
  and does not become canonical APP-008 publication authority.

## Decisions

- APP-008A uses `AUTHORIZE_CASE_REVISION_PUBLICATION` as the bounded runtime
  command/effective action name for the Case vertical slice.
- Withdrawal and supersession standing are represented in schema, while command
  surfaces for withdrawal/supersession are deferred.
- Active publication uniqueness is enforced with PostgreSQL partial unique
  indexes for `AUTHORIZED` standing per case and per revision, preserving
  historical `SUPERSEDED` and `WITHDRAWN` rows.

## Validation Evidence

- `npx.cmd prisma validate --schema prisma/schema.prisma` - passed.
- `npx.cmd prisma generate --schema prisma/schema.prisma` - passed.
- `npm run build` - passed.
- Guarded local PostgreSQL e2e:
  `npx.cmd jest --config ./test/jest-e2e.json test/app008a-case-publication-race.e2e-spec.ts --runInBand`
  - passed, 4 tests.
- APP-006/APP-007 guarded PostgreSQL regressions:
  `npx.cmd jest --config ./test/jest-e2e.json test/app006-case-approval-race.e2e-spec.ts test/app007-case-revision-race.e2e-spec.ts --runInBand`
  - passed, 5 tests.

## Remaining Risks

- APP-008B/C/D remain required before learner exposure can consume canonical
  publication identity.
