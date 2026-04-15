# AGENTS.md

## Mission
You are implementing incremental improvements to the existing admin frontend for a medical case game platform. Your job is to preserve what already works, reduce congestion, and improve route ownership, analytics separation, editorial workflow clarity, and publishing/distribution visibility.

This repository already has a viable admin architecture. Do not behave as if the codebase needs a rewrite.

## Product context
The admin supports four real product domains:
1. Overview / operations
2. Editorial / case review
3. Analytics / gameplay-quality insights
4. Distribution / publishing

The current audit found that these domains are compressed into too few surfaces. Keep this mental model during all work.

## Current truths you must preserve
- Feature-based page grouping is good and should stay.
- The single API surface is good and should stay.
- Page-owned state and page-owned fetching should stay.
- The `/cases` master-detail pattern is a good foundation and should stay.
- Backend mutations remain authoritative.

## Current pain points you must solve incrementally
- Route boundaries do not match product domains.
- Dashboard is overloaded with both operational and analytics concerns.
- Publish workflow is hidden instead of having a dedicated destination.
- Analytics ownership is split between dashboard and analytics page.
- `CaseDetail.tsx` is too large and mixes too many responsibilities.
- Case selection is not URL-addressable.

## Non-goals
Do not:
- rewrite the admin shell
- replace page-level fetching with a global state library
- introduce a second API abstraction beside the current admin API layer
- create a competing `/editorial` route if `/cases` remains the editorial home
- refactor unrelated product areas while implementing admin changes
- make speculative backend changes unless the task explicitly requires them

## Default operating mode
For every implementation task:
1. Inspect the relevant routes, pages, components, and API calls first.
2. Summarize the current behavior before changing code.
3. Make the smallest useful change that matches the requested phase.
4. Preserve naming and patterns already used in the repo unless they are part of the problem.
5. Prefer local feature extraction over introducing broad shared abstractions.
6. Verify the build or type-check affected files when possible.
7. End with a concise change summary, risks, and any follow-up suggestions.

## Architecture rules

### Routing
- `/` is the operational overview.
- `/cases` is the main editorial and case management surface.
- `/analytics` is the home for gameplay and quality analytics.
- `/publish` is the home for publish readiness and distribution operations.
- `/generate` remains a narrow generation workflow.
- Prefer additive routing changes over route churn.
- When adding deep-link support, prefer `/cases/:caseId` over introducing a parallel route family.

### Dashboard
The dashboard should answer: "What needs attention now?"
Keep only:
- high-level counts
- validation health summary
- publish supply summary
- direct links into queues
- small operational summaries

Move full analytics experiences elsewhere.

### Analytics
The analytics page should own:
- trends
- gameplay performance
- wrong guesses
- accuracy / fallback / signal breakdowns
- future cohort analysis

Do not leave major analytics widgets split across overview and analytics once a phase says to consolidate them.

### Cases / editorial
`/cases` owns:
- queue browsing
- filtering
- pagination
- case review
- case detail
- editorial actions

When refactoring, keep the master-detail experience unless the task explicitly changes it.

### Publish / distribution
`/publish` owns:
- ready-to-publish visibility
- publish readiness
- publish health
- distribution outcomes
- publish assignment visibility

Do not hide publish behavior only behind a filter inside `/cases` once publish route work begins.

## Implementation style
- Prefer clear, direct UI hierarchy over dense dashboards.
- Prefer tables for queue management and cards/panels for summaries.
- Prefer tabs or sections when one screen has multiple sub-concerns.
- Reuse existing primitives when they are real abstractions.
- Extract new components only when they reduce ownership confusion.

## File-level guidance

### Large files
If working in a large file like `CaseDetail.tsx`:
- first identify sections by concern
- extract feature-local sections before creating cross-feature abstractions
- move parsing/transform helpers into local helper files when practical
- avoid combining extraction with major behavior changes in the same diff

### Shared primitives
Only promote a primitive to shared UI if it is already useful in more than one feature. Do not over-abstract prematurely.

### Workflow language
Avoid encoding policy-heavy workflow truth in client copy. The backend should remain the source of truth for mutation legality. Frontend helper text should describe state, not invent policy.

## Review checklist before finishing any task
- Did I preserve the existing architecture where it was already strong?
- Did I keep the change inside the requested phase scope?
- Did I avoid unnecessary rewrites?
- Did I reduce cognitive load or ownership confusion?
- Did I avoid creating parallel concepts that compete with `/cases`?
- Did I keep analytics, editorial, and publish concerns moving toward cleaner separation?
- Did I validate likely regression points?

## Preferred response format for implementation tasks
1. Current state observed
2. Planned minimal change
3. Files changed
4. Important implementation notes
5. Validation performed
6. Risks / follow-ups

## Preferred response format for planning tasks
1. Current state map
2. Problem statement
3. Smallest viable change
4. Exact files likely affected
5. Risks
6. Acceptance criteria
