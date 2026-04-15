# Codex Implementation Instructions

Use this file as the persistent implementation contract for the admin frontend work.

## Objective
Implement the admin frontend cleanup in phases, grounded in the existing codebase and audit. Each phase should deliver a meaningful improvement without destabilizing the system.

## Primary constraints
- Audit and understand first, then modify.
- Make incremental changes only.
- Preserve current architecture unless the phase explicitly changes ownership.
- Prefer low-risk, high-clarity improvements.
- Do not mix multiple phases in one implementation unless explicitly requested.

## Working method
For each task:
1. Read the current files in scope.
2. Explain the current behavior and why it matters.
3. State the exact intended change.
4. Implement only what is necessary for that phase.
5. Run the most relevant validation available.
6. Report what changed, what remains, and any risks.

## Decision rules

### When to change routes
Change routes when the current route ownership is part of the problem.
Examples:
- adding `/publish`
- making `/` the stable admin landing page
- adding `/cases/:caseId`

Do not add routes just because they are theoretically cleaner.

### When to extract components
Extract components when:
- a file mixes multiple responsibilities
- a section can be moved without changing behavior
- the extraction makes ownership clearer

Do not extract components merely to increase file count.

### When to create hooks/helpers
Create a hook or helper only when it reduces repeated logic in a clearly repeated pattern.
Examples:
- a tiny `useAdminApiClient` helper
- case payload transforms isolated from rendering

Do not create new abstraction layers that compete with the existing API module.

## UX rules
- Reduce density before adding more data.
- Avoid duplicating the same KPI or summary in multiple panels.
- Make every page answer one dominant question.
- Prefer drill-down over squeezing everything onto overview.
- Keep publish as a first-class workflow, not a hidden state.

## Technical rules
- Keep page-owned fetching.
- Keep backend mutations authoritative.
- Keep feature-local code close to the feature.
- Use URL-backed selection when that improves continuity and deep-linking.
- Avoid brittle path-title logic when adding nested routes.

## Phase boundaries

### Phase 0 — no-risk cleanup
Allowed:
- navigation label cleanup
- redirect cleanup
- removal of obvious duplicated summaries
- structured success output for generation page
- documenting or removing confirmed wrapper leftovers

Not allowed:
- moving major workflows between pages
- large component splits
- backend contract changes

### Phase 1 — route and layout ownership
Allowed:
- add `/publish`
- update sidebar and topbar labeling
- change dashboard content ownership
- prepare route structure for nested detail views

Not allowed:
- large editorial workflow redesign
- deep case detail refactors unless explicitly requested

### Phase 2 — analytics separation
Allowed:
- move trend charts from dashboard to analytics
- consolidate analytics ownership in `/analytics`
- reduce duplicate dashboard fetching where appropriate

Not allowed:
- broad redesign of the analytics API surface unless necessary

### Phase 3 — editorial workflow depth
Allowed:
- add `/cases/:caseId`
- split `CaseDetail.tsx` into feature-local sections
- improve queue/detail ownership
- clarify editorial actions and review structure

Not allowed:
- replacing `/cases` with a separate editorial domain

### Phase 4 — publish/distribution workflow
Allowed:
- make publish a dedicated surface
- move publish-readiness workflows out of hidden queue modes
- create focused publish views using existing data when possible

Not allowed:
- introducing speculative backend distribution systems without requirement

## What good looks like
A good implementation:
- keeps the best existing structures
- makes route ownership clearer
- reduces dashboard congestion
- gives analytics a real home
- preserves `/cases` as editorial home
- makes publish visible and intentional
- breaks down oversized files safely

## Required completion block
At the end of each implementation, return:
- scope completed
- files changed
- what was intentionally not changed
- validation run
- regression risks
- next best incremental step
