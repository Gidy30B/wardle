# WEOS APP-008B - DailyCase Revision / Publication Binding

## Purpose

Make every new governed `DailyCase` exposure identify the enduring `caseId`,
the exact APP-008A publication-authorized `caseRevisionId`, and the exact
canonical `publicationDecisionId` that authorized learner exposure scheduling.

## Approved Authority

- Authority record:
  `docs/weos/authority/records/document-approvals/WEOS-AUTH-APP-008.json`.
- Governing sequence: APP-006 exact `CaseRevision` approval; APP-007 controlled
  `CaseRevision` creation/mutation hardening; APP-008A publication governance;
  APP-008B `DailyCase` revision/publication binding.
- Required baseline: `7cae7aa378789ace3ef5b0d80bb05709797a7169`
  (`feat(weos): implement APP-008A publication governance`).
- Branch: `weos/phase-1c-case-revision-hardening`.

## Current Behavior

- `DailyCase` stores `caseId`, `date`, `track`, and `sequenceIndex`, but no
  revision or publication decision identity.
- `CaseAssignmentService` chooses scheduler inventory from mutable `Case`
  records and assignment/editorial compatibility state.
- APP-008A creates canonical `CaseRevisionPublicationDecision` rows with
  `standing = AUTHORIZED`, but `DailyCase` does not yet bind to them.
- `GameSession` and `Attempt` still lack revision identity and are out of
  scope for this package.

## Required Invariant

For every new governed `DailyCase` created after APP-008B:

- `DailyCase.caseId` identifies the enduring case.
- `DailyCase.caseRevisionId` identifies the exact revision named by the active
  APP-008A publication decision.
- `DailyCase.publicationDecisionId` identifies the exact APP-008A publication
  decision that authorized scheduling.
- The scheduler must not infer publication authority from `Case.editorialStatus`,
  validation, approval, date, route access, or existing mutable case state.

## Scope

- Add nullable `DailyCase.caseRevisionId` and `DailyCase.publicationDecisionId`
  fields and relations.
- Make new scheduler-created DailyCase rows bind to APP-008A `AUTHORIZED`
  publication decisions.
- Preserve readable legacy DailyCase rows with null revision/publication
  bindings.
- Surface binding metadata in backend read models for auditability without
  changing learner hydration semantics.
- Update APP-008B evidence and conformance documentation.

## Files Expected To Change

- `.agent/plans/WEOS-APP-008B-DAILYCASE-REVISION-PUBLICATION-BINDING.md`
- `doctordle-backend/prisma/schema.prisma`
- `doctordle-backend/prisma/migrations/20260815123000_app008b_dailycase_revision_publication_binding/migration.sql`
- `doctordle-backend/src/modules/admin/case-publication-governance.service.ts`
- `doctordle-backend/src/modules/gameplay/case-assignment.service.ts`
- `doctordle-backend/src/modules/gameplay/daily-cases.service.ts`
- `doctordle-backend/src/modules/gameplay/daily-cases.module.ts`
- `doctordle-backend/src/modules/gameplay/daily-cases.service.spec.ts`
- APP-008B conformance/evidence docs under `docs/weos`.

## Prohibited Changes

- Do not implement APP-008C.
- Do not modify `GameSession` revision binding.
- Do not modify `Attempt` provenance.
- Do not cut learner hydration over from mutable `Case`.
- Do not redesign gameplay.
- Do not fabricate historical publication decisions or backfill uncertain
  legacy DailyCase rows.

## Data Model Implications

Additive, nullable DailyCase columns only. Existing rows remain legacy-compatible
with null `caseRevisionId` and `publicationDecisionId`. No destructive migration
and no historical data fabrication are authorized.

## API Implications

Backend read models may expose `caseRevisionId`, `publicationDecisionId`, and a
derived exposure classification for auditability. Learner clinical payload
hydration remains unchanged until APP-008C.

## Migration Plan

Create an additive Prisma migration adding nullable columns, indexes, and
foreign keys. Existing rows are untouched and can be classified as legacy when
either binding is absent.

## Compatibility Strategy

Legacy reads continue through `DailyCase.case`. New scheduler writes carry exact
APP-008A publication provenance. APP-008C will later use that binding for
revision-bound hydration.

## Testing Strategy

- Scheduler unit coverage for APP-008B creation and legacy rows.
- Scheduler regression that APPROVED/READY_TO_PUBLISH without APP-008A
  publication no longer creates governed DailyCase rows.
- APP-008A regression tests.
- APP-007 and APP-006 race regression tests.
- Prisma validate/generate, backend build, authority/conformance checks, and
  diff checks.
- Guarded PostgreSQL race/integration coverage when local test DB is available.

## Rollback/Recovery

Revert the APP-008B commit and apply the inverse additive migration if needed.
Because the new fields are nullable and no backfill is performed, legacy rows
remain readable throughout rollback.

## Progress

- [x] Confirm clean baseline at APP-008A commit.
- [x] Audit current DailyCase and scheduler behavior.
- [x] Implement schema and scheduler binding.
- [x] Add/update tests.
- [x] Update conformance evidence.
- [x] Run validation.
- [x] Commit APP-008B only.

## Discoveries

- `CaseAssignmentService` currently loads candidates from mutable `Case` records.
- `markCreatedCasesPublished` updates `Case.editorialStatus` only as a
  compatibility projection for READY_TO_PUBLISH cases.
- APP-008A publication decisions are already the canonical publication authority
  source but are not consumed by DailyCase scheduling yet.
- APP-008B changes scheduler inventory to read APP-008A `AUTHORIZED`
  publication decisions and write their `caseId`, `caseRevisionId`, and
  `publicationDecisionId` into new DailyCase rows.

## Decisions

- APP-008B keeps `caseId` as domain compatibility identity and adds nullable
  revision/publication authority identity.
- Existing DailyCase rows with missing binding remain legacy; no repair or
  backfill is performed in this package.
- `markCreatedCasesPublished` is retained only as a compatibility projection for
  newly publication-bound DailyCase rows.
- Learner payload hydration is intentionally unchanged until APP-008C.

## Validation Results

- `git diff --check` passed, with expected CRLF normalization warnings.
- `npx.cmd prisma validate --schema prisma/schema.prisma` passed.
- `npx.cmd prisma generate --schema prisma/schema.prisma` passed.
- `npm run build` passed.
- `npm run weos:authority:check` passed.
- `npx.cmd jest src/modules/gameplay/daily-cases.service.spec.ts --runInBand`
  passed: 26 tests.
- `npx.cmd jest src/modules/admin/case-review.service.spec.ts --runInBand`
  passed: 36 tests.
- `npx.cmd jest src/modules/case-validation/case-revision.service.spec.ts --runInBand`
  passed: 8 tests.
- Guarded PostgreSQL APP-008B integration passed:
  `test/app008b-dailycase-binding.e2e-spec.ts`.
- Guarded PostgreSQL APP-008A regression passed:
  `test/app008a-case-publication-race.e2e-spec.ts`.
- Guarded PostgreSQL APP-007 regression passed:
  `test/app007-case-revision-race.e2e-spec.ts`.
- Guarded PostgreSQL APP-006 regression passed:
  `test/app006-case-approval-race.e2e-spec.ts`.

## Remaining Risks

- Learner hydration still reads mutable `Case` until APP-008C.
- Game sessions and attempts still lack revision-bound provenance until
  APP-008C and APP-008D.
