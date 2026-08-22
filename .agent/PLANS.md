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
