# ExecPlan Standard

An ExecPlan is required for any WEOS task involving:

- database schema;
- migration;
- publication;
- learner exposure;
- authority;
- more than one backend module;
- cross-backend/frontend change;
- controlled AI application;
- high-risk governance behavior.

Each ExecPlan must include:

## Purpose

State the exact invariant the work will make true.

## Approved Authority

List the approval record, decision document, branch, and commit that authorize
the work. If authority is absent or unresolved, stop before implementation.

## Current Behavior

Summarize observed runtime and documentation behavior with file references.

## Required Invariant

Define the invariant in testable terms.

## Scope

List included behavior and excluded behavior.

## Files Expected To Change

Name expected files or directories before editing.

## Prohibited Changes

List runtime, data, API, schema, or documentation changes that must not happen.

## Data Model Implications

Describe schema, migration, backfill, and compatibility effects. State `None`
when none are expected.

## API Implications

Describe DTO, response, route, and client contract effects. State `None` when
none are expected.

## Migration Plan

Describe migration order, reversibility, and data safety. State `None` when no
migration is authorized.

## Compatibility Strategy

Explain how legacy reads/writes remain safe during transition.

## Testing Strategy

List exact checks, tests, and fixtures.

## Rollback/Recovery

Explain how to revert safely or recover from partial application.

## Progress

Maintain a short checklist while working.

## Discoveries

Record new facts found during implementation.

## Decisions

Record decisions made inside the authorized scope only.

## Remaining Risks

Record unresolved authority, technical, data, or verification risks.

---

# ExecPlan: WEOS WS-CLOSE-002 Queue, Action, Publish and Legacy Convergence

## Purpose

Make the routine diagnosis workspace path converge from queue item to exact
work packet, governed decision, canonical refresh and next task, while
preserving candidate, application, approval and publication as separate
governance acts.

## Approved Authority

Implementation package: user-provided `WEOS WS-CLOSE-002 - Queue, Action,
Publish, and Legacy Convergence`. Required starting branch and commit:
`master` at `938dde0ef8e74885b6755c152f6b225ed5dcc696`.

Canonical constraints carried forward from the user's instructions:
`WEOS-CANON-004` Diagnosis Education Standards, `WEOS-CANON-006` AI Draft
Standards and `WEOS-CANON-007` Governance Record Standards. Work is limited to
Workspace v1 operational convergence; no new Education, Clinical Case or graph
governance semantics are authorized.

## Current Behavior

WS-CLOSE-001 added Education candidate, revision and publication work packets,
but the queue can still duplicate or omit some Education lifecycle tasks, exact
standing Education revision visibility is thin, the Publish workflow does not
fully separate Case publication from Education publication, governed conflict
messages are still generic in places, and the legacy Education panel remains a
competing routine surface.

## Required Invariant

Editors can complete routine Education and Clinical Case editorial work from the
normal workspace without legacy/API/Prisma knowledge: queue items open exact
packets, packet actions execute through the workspace action registry/runner,
state refreshes after governed actions, next tasks are derived from refreshed
canonical read models, and current/approved/published Education revision
standing is visible without conflating approval and publication.

## Scope

Included: workspace queue lifecycle mapping, Education packet deep links,
post-action refresh/conflict handling, Publish workflow separation, concise
Education standing summary, governance-history display from existing records,
legacy Education panel deconfliction, focused dashboard tests and builds.
Backend changes are allowed only if the existing workspace read model cannot
project exact Education approval/publication standing from existing EDU-003
records.

Excluded: backend governance redesign, new schema/migration, Knowledge Graph
provenance redesign, learner exposure changes, Clinical Case governance
redesign, APP-008C/APP-008D, institutional authority assignment and generic
cross-artifact governance.

## Files Expected To Change

- `.agent/PLANS.md`
- `doctordle-backend/src/modules/admin/*` only if read-model projection is
  required
- `analytics-dashboard/src/api/admin.types.ts`
- `analytics-dashboard/src/features/editorial/EditorialDiagnosisWorkspacePage.tsx`
- `analytics-dashboard/src/features/editorial/workspace/actions/*`
- `analytics-dashboard/src/features/editorial/workspace/components/*`
- `analytics-dashboard/src/features/editorial/workspace/boards/EducationBoard.tsx`
- `analytics-dashboard/src/features/editorial/workspace/workflows/*`
- `analytics-dashboard/src/features/editorial/workspace/viewModels/*`
- focused dashboard tests

## Prohibited Changes

No schema or migration. No direct mutation from queue components. No optimistic
approval/publication inference. No candidate material exposure to learners or
case generation. No weakening confirmation gates. No deleting legacy
maintenance surfaces without proof it is safe.

## Data Model Implications

None expected.

## API Implications

Prefer existing workspace DTOs. If exact standing summary requires backend work,
extend the diagnosis workspace read model additively from existing EDU-003
approval/publication records.

## Migration Plan

None.

## Compatibility Strategy

Legacy Education UI remains accessible as a compatibility/manual maintenance
surface, but routine governed work should route to canonical workspace packets.

## Testing Strategy

Run focused Education packet, editorial workflow view-model, review queue,
workspace action policy/runner, publish workflow and legacy deconfliction tests
where present; run `analytics-dashboard` tests/build and `git diff --check`.
Run backend build/focused backend tests only if backend read-model code changes.

## Rollback/Recovery

Changes are code-only and can be reverted by the final commit. No data is
modified.

## Progress

- [x] Verify starting HEAD, branch and clean worktree.
- [x] Read WEOS repository instructions and package authority.
- [x] Re-trace WS-CLOSE-001 implementation and current queue/action/publish surfaces.
- [x] Implement queue and deep-link convergence.
- [x] Implement standing summary/history visibility.
- [x] Deconflict legacy Education routine UX.
- [x] Add focused tests.
- [x] Run verification.
- [ ] Commit if closure criteria are met.

## Discoveries

- Starting checkout is clean on `master` at `938dde0`.
- Existing EDU-003 governance records are persisted, but the workspace read
  model did not expose latest standing approval or standing publication
  summaries, so WS-CLOSE-002 needed a narrow read-only backend projection.
- Focused dashboard, backend workspace, Education governance/candidate,
  Education section-regeneration and Clinical Case generator/regression specs
  passed; dashboard and backend builds passed.

## Decisions

- Keep WS-CLOSE-002 centered on workspace operational convergence and only add
  backend read-model fields if frontend state cannot safely derive exact
  standing revision visibility from existing projections.
- Use existing Education approval/publication records for standing summaries
  and packet history; do not introduce a new governance data model.

## Remaining Risks

- Browser automation availability is unknown.
- Browser automation was not run for this package; verification is unit/spec and
  build based.

---

# ExecPlan: WS-CLOSE-001 Canonical Education Work Packets

## Purpose

Make routine Diagnosis Education candidate review, controlled application,
exact revision review and publication assessment visible as decision-oriented
workspace packets, without creating new canonical artifact or governance-record
persistence.

## Approved Authority

Implementation package: user-provided `WEOS WORKSPACE CLOSURE -
IMPLEMENTATION PLAN`, WS-CLOSE-001 only. Required starting branch and commit:
`master` at `11fc8880b0ffb02f74e93fbb8daf35e288dfedcb`.

The package explicitly preserves `WEOS-CANON-004` Diagnosis Education
Standards, `WEOS-CANON-006` AI Draft Standards and `WEOS-CANON-007`
Governance Record Standards. Work packets are read models only; they do not
establish authority, approve artifacts, publish artifacts or persist generic
WorkPacket records.

## Current Behavior

Backend Education candidate and exact revision governance services already
support candidate-first generation/regeneration, review, separate application,
exact revision approval decisions, publication readiness and publication
authorization. The diagnosis workspace read model carries Education candidates,
current revision identity and publication readiness.

Dashboard action registry, policy and runner already include
`educationCandidate.*`, `educationRevision.*` and
`educationPublication.*` actions. The current frontend queue exposes pending
Education candidates but lacks rich Education candidate/revision/publication
packets; accepted candidate Apply is hidden behind confirmation-action filtering;
Education revision governance and Education publication governance are not
fully represented as packet surfaces.

## Required Invariant

An editor can inspect the exact Education candidate/revision/publication target
inside the workspace, see provenance, validation, standing/current identity and
available governed actions, and run only through the workspace action
registry/policy/runner into canonical backend commands. Accept remains distinct
from Apply; Apply remains distinct from revision approval; approval remains
distinct from publication authorization.

## Scope

Included: dashboard view models, packet components, Content/Publish workflow
rendering, queue action visibility for Education confirmation-gated actions,
focused tests and non-mutating verification. Backend changes are allowed only if
the existing read model proves insufficient.

Excluded: schema/migration, backend authority semantics, Knowledge Graph
redesign, learner exposure changes, case workflow redesign, generic WorkPacket
persistence, WS-CLOSE-002 queue/legacy convergence beyond what is required to
operate packet actions.

## Files Expected To Change

- `.agent/PLANS.md`
- `analytics-dashboard/src/features/editorial/workspace/viewModels/*`
- `analytics-dashboard/src/features/editorial/workspace/components/*`
- `analytics-dashboard/src/features/editorial/workspace/boards/EducationBoard.tsx`
- `analytics-dashboard/src/features/editorial/workspace/workflows/ContentWorkflow.tsx`
- `analytics-dashboard/src/features/editorial/workspace/workflows/PublishWorkflow.tsx`
- `analytics-dashboard/src/features/editorial/workspace/components/ReviewQueueItem.tsx`
- focused dashboard tests for packet/view-model/action behavior

## Prohibited Changes

No Prisma schema or migration. No backend mutation semantic changes unless a
blocking read-model gap is discovered and recorded. No direct API calls from
packet components. No candidate acceptance/application/revision
approval/publication conflation. No learner/case/graph authority changes. No
legacy broad deletion.

## Data Model Implications

None expected.

## API Implications

None expected. Reuse the diagnosis workspace read model and existing Education
candidate/revision/publication action APIs.

## Migration Plan

None.

## Compatibility Strategy

Existing workspace and legacy APIs remain intact. New packet surfaces consume
current workspace projections and execute governed actions through the existing
workspace action runner.

## Testing Strategy

Add focused dashboard tests for Education candidate packet states/actions,
revision packet identity/actions, publication packet readiness/action gating,
queue confirmation-action visibility and view-model mapping. Run focused
dashboard tests, dashboard build, backend build if backend touched and
`git diff --check`.

## Rollback/Recovery

Frontend-only changes can be reverted file-wise before deployment. No data is
modified by the package.

## Progress

- [x] Verify starting HEAD, branch and clean worktree.
- [x] Read WEOS repository instructions and precedence.
- [x] Re-trace backend candidate/governance/read-model surfaces.
- [x] Re-trace dashboard queue/action/workflow/case packet patterns.
- [x] Add Education packet view models.
- [x] Add Education packet components.
- [x] Integrate Content/Publish workflow packet rendering.
- [x] Fix Education confirmation action visibility in queue/packets.
- [x] Add focused tests.
- [x] Run verification.
- [x] Commit WS-CLOSE-001.

## Discoveries

- The target checkout is clean on `master` at the required EDU-003 commit.
- Existing backend read models already expose candidate material, provenance,
  validation, stale/application status and current Education revision identity.
- Existing frontend action infrastructure already has canonical Education
  action IDs and executors; packet wiring can reuse it.
- Publication decision history beyond the current readiness/standing action is
  not fully projected in the workspace read model and should remain a recorded
  WS-CLOSE-002/standing-visibility gap unless needed for WS-CLOSE-001.
- `educationCandidate.apply` was registered and executable but absent from the
  workflow-safe action set, so accepted Education candidates could render as
  deferred instead of actionable from the workspace.

## Decisions

- Implement packet composition in frontend view models for WS-CLOSE-001, using
  backend-projected canonical state and avoiding duplicate mutation authority.
- Keep the first package focused on packet operability; broader queue lifecycle
  and legacy convergence stay for WS-CLOSE-002 after commit.
- Treat Education revision and publication queue items as frontend review-item
  kinds backed by existing canonical action IDs rather than new aliases.

## Remaining Risks

- Exact Education approval/publication history visibility may need a backend
  projection in WS-CLOSE-002 to fully satisfy the final closure plan.
- Browser automation availability is unknown in this checkout.

---

# ExecPlan: WEOS EDU-003 Exact Diagnosis Education Revision Governance

## Purpose

Make Diagnosis Education approval and publication target exact `DiagnosisEducationRevision` records, with approval decisions, publication readiness, publication decisions, withdrawal/supersession history, and downstream learner/case/graph/differential trust resolving from canonical revision-specific authority rather than mutable `DiagnosisEducation` row status alone.

## Approved Authority

Implementation package: user-provided `WEOS EDU-003 - Exact Diagnosis Education Revision Approval and Publication Governance`.

Starting branch and commit required by the package: `master` at `4ac7bcce68714aaeb12ea8dfa6aae7fac8f91645`.

Canonical constraints explicitly named by the user: `WEOS-CANON-004` Diagnosis Education Standards, `WEOS-CANON-006` AI Draft Standards, `WEOS-CANON-007` Governance Record Standards, and `WEOS-ARCH-008` Institutional Editorial Governance. The package authorizes this bounded Diagnosis Education runtime slice only; broader generic governance-kernel rollout, exact role-to-authority assignment, graph provenance redesign, and destructive historical backfill remain out of scope.

## Current Behavior

EDU-002 established candidate-first AI whole/section generation and stale-safe controlled application into `DiagnosisEducationRevision`, but left Education approval/publication as legacy status projection behavior. Current runtime audit must reconfirm `DiagnosisEducationService.reviewEducation`, publish blocker evaluation, learner reads, case generation context, graph extraction, trusted differential link sync, workspace actions, and legacy Education UI before edits.

## Required Invariant

Candidate acceptance remains distinct from candidate application. Candidate application creates or updates a `NEEDS_REVIEW` Education revision only. Human approval creates an attributable, rationale-bearing decision for one exact `DiagnosisEducationRevision`. Publication authorization creates a separate attributable, rationale-bearing decision for that exact approved revision. Standing published Education for learners, case generation, graph extraction, and trusted differential links resolves deterministically from standing publication decisions, with legacy compatibility explicitly documented and no new publication authority inferred from mutable row status alone.

## Scope

Included: additive schema/migration for Education revision approval and publication governance; exact revision approval/reject/changes-required operations; publication readiness; publication authorization and withdrawal; compatibility projection synchronization; downstream standing-published-revision resolution; workspace action registry/policy/runner integration; dashboard review packet/action wiring; focused tests and docs.

Excluded: generic governance records for all artifacts, exact institutional authority-assignment enforcement beyond existing access controls and recorded actor/rationale, destructive backfill or fabricated historical decisions, graph staleness engine, knowledge graph provenance redesign, learner redesign, case workflow redesign, distributed queues/locks, collaborative Education review, semantic AI diff engine, and seed/repair data rewrites.

## Files Expected To Change

Expected areas: `doctordle-backend/prisma/schema.prisma`, a new Prisma migration, backend Education services/controllers/DTOs/tests, workspace action registry/policy/runner/read-model services/tests, graph/differential/case/learner Education trust resolution touchpoints, `analytics-dashboard/src/api`, dashboard Education/workspace/review queue components/tests, and `docs/weos/implementation`.

## Prohibited Changes

Do not fabricate historical approval or publication decisions from existing row statuses. Do not weaken EDU-001 expected-version protections or EDU-002 candidate application protections. Do not let validation, UI visibility, route access, runtime roles, application, approval, or mutable projections imply publication. Do not expose candidate, accepted-only, applied-NEEDS_REVIEW, or approved-unpublished material to learners or case generation.

## Data Model Implications

Add narrow Education-specific governance records for revision approval and publication decisions, with exact revision identity, version, responsible actor, rationale, material/readiness context, standing/supersession/withdrawal state, and idempotency identity. Migration is additive and does not rewrite existing Education history.

## API Implications

Add backend/admin contracts for exact revision approval outcomes, publication readiness, publication authorization, and withdrawal. Existing legacy review/publish calls should be routed through canonical exact-revision governance where possible, or constrained so they cannot bypass the new authority model.

## Migration Plan

Create an additive Prisma migration. No historical backfill. Legacy `APPROVED`/`PUBLISHED` rows retain documented compatibility semantics until reauthorized, but new approvals/publications after EDU-003 must create canonical exact-revision decision records.

## Compatibility Strategy

Keep `DiagnosisEducation.editorialStatus`, `reviewedAt`, `reviewedByUserId`, and `publishedAt` as compatibility/workflow projections synchronized from canonical decisions. Reads that must preserve legacy published material may use an explicit legacy fallback only when no canonical standing publication decision exists and the behavior is documented as compatibility, not canonical authority.

## Testing Strategy

Add focused backend tests for exact approval, rejected/changes-required outcomes, stale approval rejection, publication readiness, publication requiring exact approval, publication supersession/withdrawal, idempotency/concurrency behavior where available, no learner/case/graph/differential trust without standing publication, published revision downstream consumption, EDU-001/EDU-002 regressions, workspace actions/policy/runner, and legacy compatibility. Run Prisma format/validate/generate, targeted backend suites, dashboard tests/build, backend build, and `git diff --check`.

## Rollback/Recovery

Rollback is schema/code rollback of the single EDU-003 commit before deployment. Since no historical data is rewritten or fabricated, production recovery should require disabling the new routes/actions and reverting compatibility projection writers if needed.

## Progress

- [x] Verify starting HEAD and clean worktree.
- [x] Read repository WEOS instructions and precedence.
- [x] Read relevant canon/institutional governance clauses.
- [x] Audit current runtime paths.
- [x] Add schema/migration.
- [x] Implement backend governance services/routes.
- [x] Integrate downstream trust resolution.
- [x] Integrate workspace/dashboard actions.
- [x] Add tests and docs.
- [x] Run verification.
- [ ] Commit and confirm clean worktree.

## Discoveries

- EDU-002 leaves exact Education revision approval and publication authority open by design.
- `WEOS-CANON-007` requires approval, readiness, publication, audit events, and governance records to remain distinct; mutable status alone is insufficient.
- `WEOS-ARCH-008` treats Diagnosis Education approval as an elevated editorial decision and publication as a separate institutional decision; software roles alone do not establish authority.
- Legacy mock clients in older unit tests do not include the additive publication-decision delegate; canonical runtime clients do, so compatibility guards are needed at read-only downstream trust boundaries.

## Decisions

- Use narrow Education-specific governance records for this package instead of introducing a generic governance platform.
- Preserve compatibility projections while making new canonical decisions revision-specific.
- Treat legacy `PUBLISHED` row reads as explicit compatibility fallback only when no standing canonical publication decision exists.

## Remaining Risks

- Exact institutional authority-assignment enforcement remains outside this package unless existing runtime utilities provide a bounded reusable check.
- Legacy `PUBLISHED` rows cannot be converted into canonical publication decisions without fabricating history; compatibility behavior must remain explicitly non-canonical.
- Isolated tests can still construct `DiagnosisEducationService` without the governance dependency; normal runtime wiring injects the governance bridge for legacy review/publish calls.

---

# ExecPlan: WEOS EDU-002 Candidate-First Diagnosis Education Generation

## Purpose

Make AI Diagnosis Education whole generation and section regeneration candidate-first, with human review separated from controlled application, and controlled application separated from Education approval/publication.

## Approved Authority

Implementation package: user-provided `WEOS EDU-002 - Candidate-First Diagnosis Education Generation and Section Regeneration`.
Branch/worktree: `C:\Users\user\DxLab-master-live`, `master`.
Required baseline verified before implementation: `a3ca9934aca5c4286039773db8ed180bcdd3a8bb`.

User-stated canonical constraint: conform to `WEOS-CANON-004` Diagnosis Education Standards, `WEOS-CANON-006` AI Draft Standards, and `WEOS-CANON-007` Governance Record Standards. Where implementation convenience conflicts with source/resulting Education revision identity, responsible authority/rationale, controlled application records, candidate supersession, or separation of acceptance/application/artifact approval/publication, the Canon distinction controls within this package scope.

This package authorizes only the narrow Education candidate lifecycle, additive persistence, review/application operations, workspace integration, and verification. It does not authorize exact Education revision approval/publication decisions, graph provenance redesign, generic governance-kernel rollout, learner redesign, distributed orchestration, or durable AI failure analytics.

## Current Behavior

At baseline, `DiagnosisEducationService.generateDraft` and `EducationSectionRegenerationService.regenerateSection` invoke AI and then directly create/update `DiagnosisEducation`. EDU-001 added expected-version checks and invalidation to `NEEDS_REVIEW`, but AI still mutates the governed Education row before human candidate review.

## Required Invariant

AI Education output must first persist as an independently identifiable candidate with provenance, validation, exact base Education version, source/result revision linkage fields, review state, supersession state, and controlled-application state. Accept/Reject/Request Changes must not mutate `DiagnosisEducation`. Apply must be a separate transactional, idempotent, stale-safe command that creates or increments exactly one `DiagnosisEducation` version and one corresponding `DiagnosisEducationRevision`, with the resulting Education in `NEEDS_REVIEW` and no approval, publication, learner exposure, trusted differential link, or graph authority conferred by candidate existence, acceptance, or application.

## Scope

Included: additive Prisma model/migration, candidate service and DTOs, refactor whole/section AI generation to candidate creation, review and controlled application endpoints, dashboard API/types/action wiring, workspace candidate inventory/review packet/queue integration, legacy Education panel bypass removal for AI generation/regeneration, focused backend/dashboard tests, and WEOS implementation documentation.

Excluded: exact revision-targeted Education approval/publication decisions, generic governance records for all artifacts, graph staleness/provenance redesign, distributed locks/queues, collaborative section editing, semantic AI diff engine, learner redesign, Case workflow changes, historical backfill, seed/repair edits, and destructive migration.

## Files Expected To Change

- `.agent/PLANS.md`
- `doctordle-backend/prisma/schema.prisma`
- an additive migration under `doctordle-backend/prisma/migrations/`
- `doctordle-backend/src/modules/education/**`
- `doctordle-backend/src/modules/admin/diagnosis-editorial-workspace.service.ts`
- focused backend specs in Education, diagnosis graph, editorial intent, learner Education fallback, or workspace modules
- `analytics-dashboard/src/api/admin.ts`
- `analytics-dashboard/src/api/admin.types.ts`
- `analytics-dashboard/src/features/cases/DiagnosisEducationPanel.tsx`
- `analytics-dashboard/src/features/editorial/**`
- focused dashboard tests adjacent to changed workspace action/view model files
- `docs/weos/implementation/**` and/or `docs/weos/gaps/IMPLEMENTATION-GAPS.md`

## Prohibited Changes

No destructive migration. No historical candidate backfill. No schema changes outside candidate/application persistence unless proven necessary for referential links. No publication/learner exposure semantic change. No graph fact promotion or trusted graph authority from candidates. No direct work in `C:\Users\user\DxLab`. No seed/repair edits. Do not silently fix unrelated broad-suite stale fixtures unless they block EDU-002 verification.

## Data Model Implications

Additive candidate/application persistence is expected. Existing `DiagnosisEducation` and `DiagnosisEducationRevision` remain valid. No existing rows are rewritten or backfilled.

## API Implications

AI generation/regeneration routes should return candidate records instead of live Education mutation results. Add candidate list/read/review/apply routes. Existing manual Education edit/review DTO expected-version safety remains authoritative.

## Migration Plan

Add candidate enums/model and generate a Prisma migration. Migration must be additive and reversible by dropping new candidate-only structures before rollout; no data backfill.

## Compatibility Strategy

Manual Education edits keep EDU-001 behavior. Existing AI UI affordances remain available but now route through candidate APIs and candidate review/application UX. Existing learner fallback, case generation published-Education gating, and published-only trusted differential links remain unchanged.

## Testing Strategy

Add focused tests for whole candidate creation, initial candidate creation without Education, section candidate creation, Education unchanged on AI generation/failure, validation persistence, candidate Accept/Reject/Request Changes, Apply preconditions, stale-base failure, idempotent repeated/concurrent application, resulting `NEEDS_REVIEW` version/revision, no approval/publication, no trusted differential/graph/case-generation side effects, workspace action visibility/queue behavior, legacy AI bypass closure, and EDU-001 regressions. Run Prisma format/validate/generate, targeted backend tests, backend build, dashboard tests/build, and `git diff --check`.

## Rollback/Recovery

Code and additive migration can be reverted as one EDU-002 commit before deployment. Since no historical data is backfilled or rewritten, rollback is expected to be schema/code rollback only.

## Progress

- [x] Verify baseline SHA, branch, and clean worktree.
- [x] Read WEOS repository/backend instructions and Canon constraints.
- [x] Re-audit Education generation/regeneration/review, schema, differential, case-generation, learner, workspace, legacy UI, and existing draft models.
- [x] Implement additive candidate/application schema and Prisma migration.
- [x] Refactor backend generation/regeneration to candidate creation.
- [x] Add candidate review and controlled application operations.
- [x] Integrate workspace/legacy UI candidate flow.
- [x] Add focused tests and documentation.
- [x] Run final verification and commit.

## Discoveries

- `WEOS-OD-024` remains open as a generic architecture decision, but this user package authorizes a bounded Education-candidate controlled-application implementation without claiming generic governance-kernel closure.
- `WEOS-CANON-004` requires section regeneration to preserve target section, source revision, original section, reason/input context, proposed replacement, review decision, and resulting artifact revision.
- `WEOS-CANON-006` requires AI-generated Education to remain candidate knowledge until human review and controlled application; acceptance approves the proposal for controlled application but not the resulting Education revision.
- `WEOS-CANON-007` requires material AI contribution provenance, responsible authority/rationale, distinction between acceptance and controlled application, and target pre-application plus resulting version identity.
- Existing `DiagnosisEducationService.generateDraft` and `EducationSectionRegenerationService.regenerateSection` were the direct AI mutation boundaries. Refactoring them is sufficient to close the legacy backend AI bypass while leaving manual EDU-001 mutation safety unchanged.
- Trusted differential link refresh remains gated inside the differential link service by published Education status. Candidate creation performs no trusted mapping side effects.
- Learner Education and Case generation already select only `PUBLISHED` Education; candidate existence and applied `NEEDS_REVIEW` Education do not enter those contexts.

## Decisions

- Use one `DiagnosisEducationCandidate` model for whole and section proposals, plus a separate `DiagnosisEducationCandidateApplicationCommand` controlled-application record for idempotency, actor, rationale, authority references, conflicts, and resulting Education/revision identity.
- Store exact source version through `baseEducationVersion` and `baseEducationRevisionId`; store exact result through `resultingEducationVersion` and `resultingRevisionId`.
- Supersede pending/needs-changes candidates in the same diagnosis/scope/section when a new candidate is created; do not supersede accepted/applied/rejected history.
- Keep Education candidate acceptance at editorial access level and require explicit rationale; keep application as a separate command with explicit idempotency key and authority rationale. Exact role-to-authority semantics remain an EDU-003 governance gap.

## Remaining Risks

- EDU-003 still needs exact revision-targeted Diagnosis Education approval/publication authority and any richer authority-assignment checks beyond runtime access guards.
- Candidate review packets expose validation/provenance/history through workspace inventory and queue records; a richer section-by-section diff UI remains future enhancement.
- Application idempotency is persisted through a unique command key and candidate application state; full distributed orchestration/queue locking remains out of scope.

---

# ExecPlan: WEOS EDU-001 Diagnosis Education Mutation Safety

## Purpose

Make ordinary Diagnosis Education content mutations and review decisions version-targeted and authority-invalidating so approved or published Education material cannot be changed while retaining that authority.

## Approved Authority

Implementation package: user-provided `WEOS EDU-001 - Diagnosis Education Mutation Safety`.
Branch/worktree: `C:\Users\user\DxLab-master-live`, `master`.
Required baseline verified before implementation: `50ab64545f0dca21f898a9641587363b87d869cf`.

This package authorizes only immediate Education mutation safety hardening. It does not authorize candidate-first Education, broad governance architecture, graph redesign, workspace redesign, schema migration, distributed locks, or durable AI failure entities.

## Current Behavior

`DiagnosisEducationService.upsertForDiagnosisRegistry` preserves existing `editorialStatus`, so runtime manual content writes can leave `PUBLISHED` or `APPROVED` content trusted after mutation. `updateByEducationId` demotes `PUBLISHED` but preserves `APPROVED`. `reviewEducation` and `EducationSectionRegenerationService.regenerateSection` do not require the caller's observed version. Current differential mapping refreshes from the current mutable Education row after writes.

## Required Invariant

Material content mutation of `PUBLISHED` or `APPROVED` Diagnosis Education must produce an untrusted editable state, ordinary existing-row mutations and review decisions must reject stale expected versions, learner fallback to the last published revision must remain readable, and case generation must continue to import only published Education into editorial intent.

## Scope

Included: shared backend invalidation/version policy, Education DTO/API expected-version wiring, runtime Education service hardening, section regeneration hardening, focused differential trust test coverage, dashboard expected-version payload wiring, repository-native documentation, and targeted tests/builds.

Excluded: schema/migration, `EducationGenerationCandidate`, section candidate UI, exact publication decision records, graph provenance redesign, distributed locks, durable AI failure entities, semantic diff UI, broad generic governance framework, and learner redesign.

## Files Expected To Change

- `.agent/PLANS.md`
- `doctordle-backend/src/modules/education/**`
- focused backend specs in `doctordle-backend/src/modules/education`, `editorial`, `diagnosis-graph`, or `case-generator`
- `analytics-dashboard/src/api/admin.ts`
- `analytics-dashboard/src/api/admin.types.ts`
- `analytics-dashboard/src/features/cases/DiagnosisEducationPanel.tsx`
- `analytics-dashboard/src/features/editorial/**`
- `docs/weos/**` documentation/gap files as needed

## Prohibited Changes

No schema or migration unless implementation proves impossible and work stops for user disposition. No seed/repair changes. No candidate-first Education. No learner API redesign. No weakening legacy UI behavior. No direct work in `C:\Users\user\DxLab`.

## Data Model Implications

None expected. Existing `DiagnosisEducation.version` is sufficient for stale-state protection.

## API Implications

Existing mutation DTOs gain `expectedVersion` for existing-row updates, section regeneration, review/publish decisions, and whole draft regeneration over an existing Education row. Stale requests should return `409 Conflict`.

## Migration Plan

None.

## Compatibility Strategy

Existing create flows without an Education row may omit `expectedVersion`. Existing legacy and workspace UI must send the visible Education version for mutation/review/regeneration. Backend remains authoritative.

## Testing Strategy

Add focused backend tests for approved/published invalidation, stale manual edit/regeneration/review/publish rejection, failed AI preservation, learner published-revision fallback, case-generation publication gating, and differential link trust treatment. Add/update dashboard tests where affected and run targeted tests, backend build, dashboard build, `git diff --check`, and final clean status.

## Rollback/Recovery

Code-only rollback by reverting the EDU-001 commit. No migration or data recovery expected.

## Progress

- [x] Verify pinned worktree, branch, baseline commit, and clean status.
- [x] Re-audit current writers, DTOs, callers, and downstream differential/case paths.
- [x] Implement shared invalidation/version policy and backend hardening.
- [x] Wire dashboard expected-version payloads and stale conflict copy.
- [x] Add focused tests.
- [x] Update documentation.
- [x] Run verification and commit.

## Discoveries

- `upsertForDiagnosisRegistry` and `updateByEducationId` are the immediate P0 authority-preservation defects.
- `EditorialIntentProjectionService` imports Education only when current Education is `PUBLISHED`; learner API falls back to latest published revision when current row is no longer published.
- Differential mappings/links are editorial projections from current Education rows and need explicit trust treatment rather than deletion.
- Initial verification required `npm ci` in backend and dashboard because `node_modules` were absent.
- A full backend `npm test -- --runInBand --silent` without env fails in unrelated suites at environment validation. A rerun with test env values gets past validation but still fails in unrelated broad-suite expectations: stale `DiagnosisEditorialWorkspaceService` fixtures lacking newer fields and diagnostic scoring/golden dataset expectations.

## Decisions

- Content mutation invalidates `APPROVED` and `PUBLISHED` to `NEEDS_REVIEW`, matching existing AI generation/regeneration review convention.
- `REJECTED` and `ARCHIVED` are not reopened by this package.

## Remaining Risks

Candidate-first Education and exact publication decision records remain deferred to EDU-002.
Full backend-suite health remains outside this EDU-001 package because of unrelated existing failures noted above. Focused EDU-001 backend tests, backend build, dashboard build, dashboard tests, and diff hygiene passed.

---

# ExecPlan: WEOS CLOSE-006 Workspace Operational Closure

## Purpose

Make the WEOS workspace the normal operational surface for governed AI Clinical Case production from editorial need through diagnosis-targeted draft generation, draft review, controlled application, exact CaseRevision review/APP-006 approval, APP-008A publication authorization, APP-008B scheduler binding visibility, and learner-exposure traceability.

## Approved Authority

Implementation package: user-provided `WEOS CLOSE-006 - Workspace Operational Closure`.
Branch/worktree: `C:\Users\user\DxLab-workspace-closure`, `weos/workspace-closure`.
Required baseline verified before implementation: `48e5fc5eff01cd26ed9eb991fc8943e51f5d832c`.

This package authorizes workspace operational closure only. It does not authorize schema redesign, migration, generic governance redesign, scheduler architecture redesign, legacy seed/repair promotion, or raw admin/terminal workflows as the normal path.

## Current Behavior

The WEOS workspace exposes diagnosis workspace evidence, generation readiness, Clinical Case Draft inventory, review packets, and draft review/application actions. Backend controlled application creates a `Case` plus exact initial `CaseRevision`.

APP-006 exact CaseRevision approval exists in backend and the older case detail surface, but the workspace does not yet provide a first-class post-application CaseRevision review and governed approval handoff.

APP-008A publication readiness and publication authorization exist in backend routes/services, but workspace publication remains read-oriented and still includes legacy ready-to-publish affordances.

APP-008B scheduler services bind `DailyCase` to exact `caseRevisionId` and `publicationDecisionId`, but the workspace does not yet surface publication eligibility, scheduled exact bindings, or governed learner-exposure state.

## Required Invariant

An editor with appropriate WEOS authority can complete and audit the routine Clinical Case path in the workspace without terminal access, raw Prisma/database access, seed/repair scripts, legacy generator tooling, or standalone admin-only bypasses:

`editorial need -> diagnosis workspace -> generation readiness/action -> ClinicalCaseDraft -> Review Packet -> human review -> accepted draft -> controlled application -> Case + exact CaseRevision -> CaseRevision review -> APP-006 exact revision approval -> APP-008A publication authorization -> APP-008B exact scheduled binding -> governed learner exposure`.

## Scope

Included: workspace read-model additions, dashboard API/types/actions/view models/components for the missing post-application governance steps, APP-008A client wiring, exact DailyCase binding visibility, focused tests, closure documentation, bypass classification, and conformance matrix.

Excluded: schema/migration unless proven unavoidable, seed/repair edits, scheduler redesign, generic authority redesign, APP-006/APP-007/APP-008 architectural rewrites, legacy route removal beyond clearly safe UI de-emphasis, and changes outside the closure worktree.

## Files Expected To Change

- `doctordle-backend/src/modules/admin/diagnosis-editorial-workspace.service.ts`
- `analytics-dashboard/src/api/admin.ts`
- `analytics-dashboard/src/api/admin.types.ts`
- `analytics-dashboard/src/features/editorial/workspace/**`
- focused backend/dashboard specs adjacent to changed modules
- `docs/weos/implementation/WEOS-WORKSPACE-CLOSURE.md`
- `docs/weos/WEOS-IMP-001-divergence-register.md` and/or gap/conformance docs if needed

## Prohibited Changes

No database schema or migration changes unless implementation proves it impossible without one and the authority gap is reported before proceeding. No data-changing repair or seed scripts. No direct work in `C:\Users\user\DxLab`. No learner-exposure semantics change hidden inside dashboard work. No approval inferred from validation, publication readiness, UI visibility, route access, or tests.

## Data Model Implications

None expected. Existing `CaseRevisionPublicationDecision`, `GovernedCaseRevisionApprovalDecision`, `DailyCase.caseRevisionId`, and `DailyCase.publicationDecisionId` should be consumed rather than replaced.

## API Implications

Expected additive client/read-model contracts for revision governance, publication authorization, and scheduled binding visibility. Existing backend APP-006 and APP-008A routes should be reused where possible. No route removal is expected.

## Migration Plan

None expected.

## Compatibility Strategy

Legacy backend routes may remain for compatibility, but the workspace should stop presenting legacy or partial paths as the normal operational route. Scheduler compatibility projections remain read-visible as projections, not as authority.

## Testing Strategy

Add focused deterministic tests for workspace view-model gating and action payloads, APP-008A client/action wiring, and any backend workspace projection helpers changed. Run targeted tests, dashboard build, backend build if feasible, `git diff --check`, and `git status --short`. Investigate Playwright readiness and document any infrastructure blocker with a concrete reason.

## Rollback/Recovery

Changes are expected to be additive/read-model/UI/action wiring only. Roll back by reverting the closure commit; no migration or data recovery should be required.

## Progress

- [x] Verify isolated closure worktree, branch, baseline commit, and clean status.
- [x] Record baseline trace before modifying code.
- [x] Inspect exact APP-006, APP-008A, APP-008B, and workspace contracts.
- [x] Implement workspace closure surfaces and actions.
- [x] Add focused tests.
- [x] Document closure state, bypass inventory, and conformance matrix.
- [x] Run verification and commit.

## Discoveries

- APP-008A backend readiness/authorization routes and service exist and are revision-exact.
- Scheduler services already create exact `DailyCase.caseRevisionId` and `publicationDecisionId` bindings from active publication decisions.
- Workspace currently lacks operational APP-006 and APP-008A/008B continuation after draft application.
- Dashboard review action buttons already implement explicit browser confirmation for confirmation-gated actions; APP-008A authorization must flow through that mechanism rather than pre-confirming generated payloads.
- `npm test -- <file>` in `analytics-dashboard` does not run the named file directly; focused tests were run with `node --experimental-strip-types`.

## Decisions

- Reuse existing APP-006, APP-008A, and scheduler identity models instead of creating replacement governance semantics.
- Treat legacy ready-to-publish as a compatibility surface, not the closure path.
- Keep APP-008B as scheduler-owned; the workspace shows exact binding state rather than adding a manual scheduling mutation.

## Remaining Risks

Playwright local QA previously timed out; this task must investigate whether the issue is infrastructure, routing, auth, or app-state related before final reporting.

Playwright local QA investigation remains blocked: the sandboxed run failed with `EPERM` writing `analytics-dashboard/test-results/.last-run.json`; an escalated rerun moved past that immediate file-permission failure but timed out after 154 seconds without a usable browser result. No Playwright result is claimed.

---

# ExecPlan: WEOS CLOSE-003 Single Registry-First Clinical Case Generator Cutover

## Purpose

Make the runtime AI Clinical Case generator single-path and registry-first: every AI-generated Clinical Case must have a governed `DiagnosisRegistry` identity selected and generation-eligible before provider invocation.

## Approved Authority

Implementation package: user-provided `WEOS CLOSE-003 - Single Registry-First Clinical Case Generator Cutover`.
Branch/worktree: `C:\Users\user\DxLab-workspace-closure`, `weos/workspace-closure`.
Required baseline: `71911b22114139917db49d0241cb4f4b6580c490`.

This package authorizes generator architecture consolidation only. It does not authorize CLOSE-004 candidate-first persistence, publication, learner exposure, or broad WEOS governance-kernel implementation.

## Current Behavior

`CaseGeneratorService` contains a registry-first path and a legacy `registryFirst:false` path where the AI selects diagnosis identity. Planner selection uses `active + ACTIVE + isPlayable + isGeneratable`, but explicit target resolution currently checks only `active + ACTIVE`. `POST /admin/generate-cases`, `src/scripts/generate-cases.ts`, and the dashboard Generate page expose the `registryFirst` mode choice.

## Required Invariant

No production AI Clinical Case generation path may invoke a model before resolving an eligible `DiagnosisRegistry` target. Explicit and planner-selected targets must use the same generation eligibility predicate. `registryFirst:false` must not invoke legacy generation.

## Scope

Included: backend generator, admin generation API contract, targeted workspace generation call path, CLI generation script, dashboard generation API/types/page, focused tests, and WEOS implementation/gap documentation.

Excluded: candidate-first `ClinicalCaseDraft` persistence, controlled application, manual `POST /cases` routing, seed/repair scripts, publication, scheduling, learner exposure, and broad admin-controller fixture redesign.

## Files Expected To Change

- `doctordle-backend/src/modules/case-generator/*`
- `doctordle-backend/src/modules/admin/admin.controller.ts`
- `doctordle-backend/src/modules/admin/targeted-case-generation.service.ts` if needed
- `doctordle-backend/src/scripts/generate-cases.ts`
- focused backend specs for generator/planner/targeted/CLI
- `analytics-dashboard/src/api/admin.types.ts`
- `analytics-dashboard/src/features/generation/GeneratePage.tsx`
- focused dashboard tests if present/appropriate
- `docs/weos/WEOS-IMP-001-divergence-register.md` and/or `docs/weos/gaps/IMPLEMENTATION-GAPS.md`

## Prohibited Changes

No schema or migration changes. No seed/repair script edits. No candidate-first draft lifecycle. No publication/readiness/scheduling/learner-exposure semantic changes. No direct modification of the original dirty `DxLab` worktree.

## Data Model Implications

None. Current `Case` persistence remains temporarily in place behind a named boundary for CLOSE-004 replacement.

## API Implications

`registryFirst` is removed from runtime choice. If compatibility requires temporary acceptance, `false` must be rejected deterministically and `true` must behave normally. No route renames are planned.

## Migration Plan

No data migration. Code migration order: tests, canonical target eligibility helper reuse, backend generator cutover, caller contract cleanup, dashboard/CLI cleanup, docs, verification.

## Compatibility Strategy

Preserve existing `/admin/generate-cases` route while removing the generator-mode choice. Explicit diagnosis IDs and balanced planner generation remain supported as selection strategies over the single registry-target generator.

## Testing Strategy

Run focused `CaseGeneratorService`, `GenerationPlannerService`, `DiagnosisSelectionService`, `GenerationContextBuilder`, `TargetedCaseGenerationService`, dedup/alignment, CLI tests where viable, dashboard generation/workspace action tests, backend build, dashboard build, `git diff --check`, and `git status --short`.

## Rollback/Recovery

Changes are code-only and can be reverted commit/file-wise. Since no schema or data migration is introduced, rollback is restoring the previous generator/controller/dashboard files.

## Progress

- [x] Freeze/strengthen registry-first characterization tests.
- [x] Enforce canonical generatability for explicit targets.
- [x] Remove legacy/open generator production path.
- [x] Migrate API, CLI, and dashboard away from `registryFirst` mode.
- [x] Add temporary persistence boundary for CLOSE-004.
- [x] Update WEOS implementation/gap docs.
- [x] Run verification.

## Discoveries

- `DiagnosisRegistryLifecyclePolicyService.getGeneratableRegistryWhere()` is the reusable runtime predicate for generatable registry targets.
- The existing admin-controller spec file has unrelated stale mocks for many controller methods; focused generation/controller behavior is covered by the generation suites and edited compatibility assertions.

## Decisions

- Preserve `/admin/generate-cases` and tolerate compatibility `registryFirst: true`/`--registry-first=true` as no-op inputs, while rejecting `false` deterministically.
- Keep direct generated `Case` persistence only behind a named temporary boundary for CLOSE-004 replacement.

## Remaining Risks

Generated cases will still persist as `Case` rows before candidate review; this remains intentionally open for CLOSE-004.

---

# ExecPlan: WEOS CLOSE-004 AI Clinical Case Draft and Controlled Application

## Purpose

Replace AI Clinical Case generation direct persistence with an independently identifiable Clinical Case Draft lifecycle. Generation creates candidate knowledge only; human review and controlled application are separate. Controlled application creates the first governed `Case` and exact initial `CaseRevision`.

## Approved Authority

Implementation package: user-provided `WEOS CLOSE-004 - AI Clinical Case Draft and Controlled Application`.
Branch/worktree: `C:\Users\user\DxLab-workspace-closure`, `weos/workspace-closure`.
Required baseline: `6b6c8ff3904d1160ee25b0d082270797e9309c38`.

This package authorizes only the AI Clinical Case Draft lifecycle, review decisions, and controlled application into initial Case/CaseRevision. It does not authorize CLOSE-005 workspace review UX, publication, scheduling, learner exposure, manual `POST /cases` redesign, seed/repair changes, or APP-008 behavior changes.

## Current Behavior

CLOSE-003 consolidated generation to registry-targeted AI generation, but `saveCaseForRegistryTarget` still persists generated candidate knowledge as `Case` plus generated `CaseRevision`. Targeted discriminator generation then writes `AiDraftRevisionAudit` after the real Case exists.

## Required Invariant

AI Clinical Case generation must not create `Case`, `CaseRevision`, `DailyCase`, publication authority, scheduling state, or learner exposure. It must create an independently identifiable draft preserving diagnosis identity, generated content, provenance/context, validation outcome, and review/application state.

## Audit Findings

`AiDraftRevisionAudit` is an audit/provenance row with optional `caseId` and affected-artifact strings. It is not a standalone candidate artifact and should not be repurposed as the Clinical Case Draft.

`CaseClueRevisionDraft` is specific to clue edits against an existing `Case` and is not appropriate for whole generated case candidate knowledge.

`ReasoningDraftValidationRun` is reasoning/teaching-rule oriented. It can remain related contextual validation evidence, but it is not the Clinical Case Draft artifact.

`CaseValidationService.validateSnapshot` and APP-007 material hash helpers can be reused against draft material before a Case exists. APP-007 `CREATE_CASE_REVISION` command itself assumes an existing current revision, so controlled application must reuse lower-level material hashing, deterministic material representation, idempotency, and serializable transaction patterns rather than forcing that command.

## Scope

Included: additive Prisma schema/migration; backend draft service, review operations, controlled application and read API; generator persistence refactor; targeted discriminator fix; admin/CLI/dashboard contract updates; focused unit and gated integration-style tests where feasible; WEOS docs.

Excluded: full dashboard review packet UI, queue redesign, learner-facing changes, publication/readiness/scheduling behavior, seed/repair scripts, and manual case authoring redesign.

## Files Expected To Change

- `doctordle-backend/prisma/schema.prisma`
- a new additive migration under `doctordle-backend/prisma/migrations/`
- `doctordle-backend/src/modules/case-generator/*`
- focused backend service/controller/API specs
- `doctordle-backend/src/modules/admin/*` for service registration and admin routes
- `doctordle-backend/src/scripts/generate-cases.ts`
- `analytics-dashboard/src/api/*` and minimal caller handling where generation assumes a Case
- `docs/weos/gaps/IMPLEMENTATION-GAPS.md`

## Prohibited Changes

No destructive migration or backfill. No fabricated historical draft rows. No APP-006/APP-008A/APP-008B semantic changes. No `DailyCase` or learner exposure changes. No seed/repair edits. No original dirty `DxLab` worktree edits.

## Data Model Plan

Introduce focused models for Clinical Case Draft, review decisions, and application commands. Preserve generated content and provenance as JSON, exact diagnosis registry ID, validation outcome/findings, state, nullable resulting `caseId` and `caseRevisionId`, and idempotency fingerprints for controlled application.

## API Plan

Generation endpoints return draft semantics. Review endpoints support accept/reject/request changes without creating Cases. A separate apply endpoint applies only accepted drafts with an idempotency key. A read endpoint returns the draft packet needed by CLOSE-005.

## Testing Strategy

Add focused tests for generation creating drafts only, review decisions, application idempotency/conflict, no approval/publication/scheduling side effects, targeted discriminator candidate-first behavior, CLI summary output, and existing CLOSE-003 registry-target regressions. Add gated integration/concurrency coverage if the repository test environment supports it.

## Rollback/Recovery

Schema changes are additive and can be rolled back by reverting the migration before deployment. Runtime rollback is restoring the previous generator/direct persistence files before applying migrations.

## Progress

- [x] Audit existing draft/governance/validation infrastructure.
- [x] Add Clinical Case Draft schema and migration.
- [x] Implement draft persistence, review, and controlled application service.
- [x] Refactor generator and targeted discriminator callers.
- [x] Update admin, CLI, dashboard contracts.
- [x] Update docs.
- [x] Run verification.

## Discoveries

Prisma 7 nullable JSON writes require `Prisma.DbNull`/nullable JSON sentinels
rather than raw `null` for nullable JSON columns in create inputs.

## Decisions

`GenerateBatchResult.created` remains as the real Case count and is now `0` for
AI generation batches; `draftCreated` is the candidate artifact count. This
preserves the distinction between draft generation and controlled application.

Admin review/application routes are editor-access runtime routes for the
authorized package. They do not claim to resolve broad canonical runtime
role-to-authority assignment outside this CLOSE-004 scope.

## Remaining Risks

Full Clinical Case Draft review UX and workspace queue integration remain
CLOSE-005. Manual `POST /cases` remains a direct authoring path outside this
package. Generic cross-artifact controlled-application authority remains
partially mitigated, not fully resolved.

---

# ExecPlan: WEOS CLOSE-005 Clinical Case Draft Review Packet and Workspace Integration

## Purpose

Make the CLOSE-004 Clinical Case Draft lifecycle operational from the WEOS
Editorial Workspace without terminal/API/database use, while preserving the hard
separation between human review decisions and controlled application.

## Approved Authority

Implementation package: user-provided `WEOS CLOSE-005 - Clinical Case Draft
Review Packet and Workspace Integration`.
Branch/worktree: `C:\Users\user\DxLab-workspace-closure`,
`weos/workspace-closure`.
Required baseline: `388288807b72d7e8b5297cf7fa313e40627206bf`.

This package authorizes workspace read models, review packet UI, workspace
action registration, queue/next-best-action projection and narrow draft
inventory/read endpoints for Clinical Case Drafts only. It does not authorize
CLOSE-006, publication/scheduling/learner exposure changes, APP-006/007/008
architecture changes, manual case authoring redesign, seed/repair changes or a
new generator.

## Current Behavior

CLOSE-004 added Clinical Case Draft persistence, review endpoints and apply
endpoint. The dashboard API client has low-level draft read/review/apply helpers,
and the Generate page displays draft IDs, but the diagnosis workspace does not
yet surface diagnosis-scoped draft inventory, draft review packets, queue items
or governed workspace actions for Clinical Case Draft decisions.

## Required Invariant

Clinical Case Drafts are visible and reviewable in the diagnosis workspace as
candidate artifacts distinct from governed Cases. Pending drafts expose Accept,
Request Changes and Reject. Accepted drafts separately expose Apply Accepted
Draft. Applying creates a Case/CaseRevision handoff without implying APP-006
approval, publication readiness, scheduling or learner exposure.

## Scope

Included: audit/reuse existing workspace action system and review queue,
diagnosis-scoped Clinical Case Draft inventory/read model endpoint if needed,
dashboard API types/clients, draft review packet view model/components,
workspace action registry/runner/policy entries, Cases workflow integration,
queue/next-action projections, generation success navigation affordance, focused
tests and documentation updates.

Excluded: new schema/migration, full workspace redesign, new generation
architecture, publication/scheduling/learner exposure, APP architecture changes,
seed/repair scripts, manual `POST /cases` governance redesign, and CLOSE-006.

## Files Expected To Change

- `.agent/PLANS.md`
- `doctordle-backend/src/modules/case-generator/clinical-case-draft.service.ts`
- `doctordle-backend/src/modules/admin/admin.controller.ts`
- focused backend specs if backend read model changes
- `analytics-dashboard/src/api/admin.ts`
- `analytics-dashboard/src/api/admin.types.ts`
- `analytics-dashboard/src/features/editorial/EditorialDiagnosisWorkspacePage.tsx`
- `analytics-dashboard/src/features/editorial/workspace/actions/*`
- `analytics-dashboard/src/features/editorial/workspace/components/*`
- `analytics-dashboard/src/features/editorial/workspace/tabs/CasesTab.tsx`
- `analytics-dashboard/src/features/editorial/workspace/viewModels/*`
- focused dashboard tests for packet/policy/runner/queue behavior
- `docs/weos/gaps/IMPLEMENTATION-GAPS.md`

## Prohibited Changes

No schema/migration. No seed/repair edits. No publication, readiness,
scheduling, learner-facing or APP-006/007/008 semantic changes. No hidden
accept-and-apply. No raw JSON/database inspector packet. No original dirty
`DxLab` worktree edits.

## Data Model Implications

None expected. Existing CLOSE-004 draft models are sufficient.

## API Implications

Add or reuse narrow admin read endpoints so the workspace can list
diagnosis-scoped Clinical Case Drafts efficiently and fetch a review packet.
Existing review/apply endpoints remain authoritative for state transitions and
conflict handling.

## Testing Strategy

Focused tests for draft packet view model states/actions, workspace action
policy/runner/API invocation, queue and next-action projection, draft inventory
not counted as Case inventory, generation-to-review navigation where feasible,
backend read model if changed, backend build, dashboard build, `git diff
--check` and clean final status. Playwright will be attempted only if existing
local QA infrastructure is available without live AI generation.

## Rollback/Recovery

Backend changes are read-focused code only and can be reverted file-wise.
Frontend packet/action integration can be reverted without data changes.

## Progress

- [x] Verify CLOSE-005 boundary and clean starting worktree.
- [x] Audit workspace review/action/queue patterns.
- [x] Add backend diagnosis-scoped draft read model if needed.
- [x] Add dashboard draft packet view model and components.
- [x] Register Clinical Case Draft workspace actions.
- [x] Integrate Cases workflow inventory, packet, generation navigation.
- [x] Integrate review queue and next-best-action projections.
- [x] Add focused tests.
- [x] Update docs.
- [x] Run verification.
- [x] Commit.

## Remaining Risks

Full end-to-end workspace operational closure, publication/scheduling path
verification, remaining non-workspace editorial bypasses, manual case authoring
classification and final conformance report remain for CLOSE-006.

## Discoveries

The existing workflow shell already centralizes action execution through
`workspaceActionRunner`, so Clinical Case Draft review could be added as another
domain executor instead of creating a parallel packet action path.

`WorkspaceReviewActionButtons` intentionally filtered confirmation-required
actions. CLOSE-005 keeps that behavior for queue-safe actions and allows packet
components to include confirmation-required Apply only after a browser
confirmation.

The workspace full read model was the right place to add diagnosis-scoped draft
inventory; no new route or schema was required.

## Decisions

Clinical Case Drafts are projected as draft packets on the existing Diagnostic
Cases board rather than as a new board ID. Review queue items deep-link to the
Cases workflow/Diagnostic Cases board.

Batch generation results now carry `diagnosisRegistryId` for draft-created
items so the standalone Generate page can link to the workspace review packet
path without client-side inference.

## WEOS SCAFFOLD-BOOT-001 - Diagnosis-Specific Educational Scaffold Bootstrap

Date: 2026-08-25
Repository: `C:\Users\user\DxLab-master-live`
Starting HEAD: `29f90830b8501b32e74ea632ed46a9d361c085af`
Scope: implement diagnosis scaffold bootstrap and generation readiness gates
without schema changes.

## Objective

Prevent empty/new diagnoses from producing generic scaffold-looking content
that downstream Education or Case generation treats as sufficient context.
Require metadata readiness before Editorial Brief bootstrap, approved/active
Brief before generated Teaching Rules, and scaffold readiness before Education
or Case generation.

## Files Expected

- `doctordle-backend/src/modules/diagnosis-registry/diagnosis-registry-lifecycle-policy.service.ts`
- `doctordle-backend/src/modules/education/diagnosis-editorial-brief.service.ts`
- `doctordle-backend/src/modules/admin/teaching-rules-admin.service.ts`
- `doctordle-backend/src/modules/education/diagnosis-education.service.ts`
- `doctordle-backend/src/modules/admin/targeted-case-generation.service.ts`
- `doctordle-backend/src/modules/case-generator/*`
- `doctordle-backend/src/modules/admin/diagnosis-editorial-workspace.service.ts`
- `analytics-dashboard/src/features/editorial/*`
- `analytics-dashboard/src/features/cases/*`
- focused backend and dashboard tests
- WEOS documentation/gap notes

## Constraints

No schema migration unless proven necessary. No workspace architecture reopen.
No Education/Cases lifecycle redesign. No automatic approval. Static knowledge
packs can enrich bootstrap but cannot bypass human-approved scaffold.

## Progress

- [x] Read package and verify starting HEAD/worktree.
- [x] Revalidate current dependency graph.
- [x] Add lifecycle-owned scaffold readiness projection.
- [x] Make Editorial Brief bootstrap diagnosis-specific and validate generic-only output.
- [x] Require approved/active Brief for generated Teaching Rule candidates.
- [x] Gate Education candidate generation by scaffold readiness.
- [x] Gate Case generation by scaffold readiness, including `isGeneratable` bypass.
- [x] Expose readiness in workspace read model and recommendations.
- [x] Gate dashboard buttons with backend readiness.
- [x] Add focused tests.
- [x] Update documentation.
- [x] Run verification and commit.

## Risks

The existing Canon baseline remains draft/approval-not-proven in repository
records, but this task supplies explicit implementation scope. Keep runtime
changes bounded to scaffold bootstrap and generation readiness.

Provider-backed initial Editorial Brief bootstrap was not added in this package;
the attempted direct OpenAI brief-generation path was rejected by the tool safety
review. Runtime now validates and enriches bootstrap output from local/static
sources where available, and blocks generic-only scaffold output.

Verification completed: Prisma format, Prisma validate, Prisma generate,
focused backend scaffold/Education/Teaching Rule/Case generation specs, backend
build, dashboard tests, dashboard build, and `git diff --check`.
