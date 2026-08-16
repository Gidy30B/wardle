# WEOS Implementation Map

Inspection date: 2026-08-08

This map tells future agents where current behavior lives. It is evidence, not
approval.

| Area                         | Canonical / Current Service Owner                                                  | Legacy Compatibility Owner                                       | Known Direct Mutation Paths                                                         | Test Locations                                                                             | Status                                                    |
| ---------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| Case review                  | Current owner: `CaseReviewService`; canonical owner: `UNKNOWN / DECISION REQUIRED` | `Case` status/timestamps and `CaseReview` records                | Admin case review routes, ready-to-publish, diagnosis link/update, revision restore | `doctordle-backend/src/modules/admin/case-review.service.spec.ts`                          | Direct runtime path; governance envelope not integrated.  |
| Case revision                | Current owner: `CaseReviewService`, `DiagnosisEditorialWorkspaceService`           | `Case.currentRevisionId`, mutable `Case` fields                  | Revision create/restore, clue draft apply                                           | case review and workspace service specs                                                    | Partial; not learner-exposure binding.                    |
| Publication path             | Current owner: `CaseReviewService` and `CaseAssignmentService` projections         | `Case.editorialStatus`, `approvedAt`, `publishedAt`, `DailyCase` | mark ready, schedule/assignment publishes projection                                | daily cases/session/case review specs                                                      | Divergent; revision-targeted publication unresolved.      |
| Learner exposure path        | Current owner: gameplay services                                                   | `DailyCase.caseId` to mutable `Case`                             | daily-case schedule, start game, submit attempts                                    | `daily-cases.service.spec.ts`, `session.service.spec.ts`, `attempt.service.spec.ts`        | Divergent; version binding absent.                        |
| Authority path               | Stage 1 contracts on selected baseline; runtime owner unknown                      | Runtime guards and roles                                         | Admin guards, editorial guards, service-local checks                                | admin permission specs, authority assignment specs on candidate branch                     | Stage 1 contracts only; no runtime authority enforcement. |
| Governance decision envelope | Stage 1 contracts on selected baseline                                             | Case-specific review/audit records                               | case review governance worktree files, service logs, validation runs                | governance-decision specs on candidate branch; dirty worktree case-review-governance specs | Stage 1 contracts only; runtime integration unresolved.   |
| Expected-version commands    | Stage 1 contracts on selected baseline                                             | Service-specific transaction/version behavior                    | Case review, education, graph, workspace services                                   | governed-command specs on candidate branch; service specs                                  | Stage 1 contracts only; no runtime command enforcement.   |
| Compatibility projections    | Stage 1 contracts on selected baseline                                             | Mutable runtime status/timestamp fields                          | case assignment publication projection, education status, registry lifecycle flags  | compatibility-projection specs on candidate branch; current service tests                  | Stage 1 contracts only; production owner unresolved.      |
| Controlled AI application    | Current owner: workspace/generation services                                       | AI draft audit and clue draft status records                     | AI draft accept/reject/request/supersede/apply, generation paths                    | targeted-case-generation and workspace specs                                               | Decision required; no approved runtime authority found.   |
| Diagnosis graph              | Current owner: graph/admin services                                                | candidate/fact tables and aliases                                | candidate review/generate, fact creation/update                                     | diagnosis graph specs                                                                      | Graph approval/promotion separation unresolved.           |
| Diagnosis education          | Current owner: `DiagnosisEducationService` and admin education controller          | education status/revision fields                                 | generate, review/publish/archive, section regeneration                              | education service specs                                                                    | Publication separation unresolved.                        |
| Dashboard actions            | Current owner: dashboard components/action registry worktree                       | UI state and route affordances                                   | workspace action handlers and runners                                               | dashboard node tests                                                                       | Evidence only; frontend authority cannot stand alone.     |

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
- authority runtime integration: guards, controllers, command handlers;
- compatibility projection writers and repair paths;
- graph promotion and evidence activation side-effect paths;
- education review/publication coupling paths;
- clue-level identity schema and autonomous clue mutation paths.
