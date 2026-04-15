# Frontend Editorial Implementation Plan

## Goal

Upgrade the existing admin frontend into a production-quality editorial console that matches the backend’s editorial pipeline.

This is not a rewrite.
This is a structured upgrade of the existing admin app.

---

## Current Understanding

The admin frontend already has:
- an authenticated admin shell
- feature-grouped routes/pages
- a dashboard
- a cases area with a master-detail mental model
- an API layer in `src/api/admin.ts`
- light shared UI primitives

The admin frontend is currently underpowered relative to the backend because it lacks:
- editorial summary integration
- editorial queue backed by editorial endpoints
- case detail actions for review workflow
- revision history UI
- validation presentation
- reusable status/action feedback primitives
- pagination/filtering patterns

---

## Implementation Principles

- Upgrade existing pages in place where possible
- Keep backend as source of truth
- Use one API layer
- Use one consistent data-fetching/mutation pattern
- Introduce shared UI primitives once
- Avoid duplicate routes, duplicate detail screens, and duplicate admin app structures

---

## Phase A — Foundation

### Goal
Prepare the frontend for editorial workflows without changing too many screens at once.

### Tasks
1. Extend `src/api/admin.ts` with:
   - editorial list endpoint
   - case detail endpoint
   - summary endpoints
   - review/validation/revision action endpoints
2. Add shared frontend types for:
   - editorial status
   - validation outcome
   - review decision
   - summary response shapes
   - editorial case list/detail shapes
3. Add reusable UI primitives:
   - status badge
   - empty state
   - error state
   - loading state
   - confirmation dialog
   - lightweight success/error feedback pattern

### Acceptance
- API functions are centralized
- no second API layer exists
- new shared primitives are reusable across dashboard, queue, and detail

---

## Phase B — Dashboard Upgrade

### Goal
Make the dashboard reflect editorial operations.

### Tasks
1. Integrate:
   - editorial status summary
   - validation outcome summary
   - publish results summary
2. Reuse the existing dashboard card/panel style
3. Keep charts/analytics areas coherent; do not create a disconnected second dashboard

### Acceptance
- dashboard reflects editorial system health clearly
- loading/error/empty states are deliberate
- cards feel aligned with the rest of the admin app

---

## Phase C — Cases Route → Editorial Queue

### Goal
Convert the current cases area into a true editorial queue.

### Tasks
1. Replace analytics-derived case list usage with editorial case list endpoint
2. Add:
   - queue filter
   - editorial status filter
   - pagination
   - stable sort
3. Add row-level next-step clarity:
   - current status
   - latest validation signal if available
   - primary action affordance

### Acceptance
- `/cases` becomes editorially truthful
- queue is scannable and operational
- no duplicate queue page is introduced

---

## Phase D — Case Detail Upgrade

### Goal
Turn case detail into the primary editorial decision surface.

### Tasks
1. Present:
   - case content
   - editorial metadata
   - latest validation summary/findings
   - review summary
   - revision history
2. Add actions:
   - rerun validation
   - start review
   - approve/reject
   - restore revision
   - mark ready to publish
3. Ensure action UX includes:
   - loading
   - confirmation where needed
   - success/error feedback
   - refresh after mutation

### Acceptance
- detail page is scannable
- actions are safe and clear
- no duplicate detail implementations exist

---

## Phase E — Publish Queue Refinement

### Goal
Make READY_TO_PUBLISH items easy to operate on.

### Tasks
1. Add queue mode or filtered view for publish-ready cases
2. Keep it inside the current cases/editorial architecture unless a separate page is clearly justified
3. Avoid introducing parallel workflows

### Acceptance
- publish-ready work is easy to scan
- no route duplication unless truly necessary

---

## Cross-Cutting Standards

### Status Presentation
Create one reusable status badge system for:
- editorial statuses
- validation outcomes
- review states where needed

### Feedback
Every mutation must:
- indicate pending state
- surface success/failure
- refresh affected data

### Refresh Strategy
Use one consistent mutation-refresh approach.
Do not invent page-specific refresh logic everywhere.

### Route Integrity
If routes/titles/sidebar items change, update them consistently in:
- route definitions
- sidebar navigation
- title/subtitle metadata

---

## Risks To Avoid

- keeping analytics-derived truth in editorial pages
- creating `/cases-v2` or a second editorial route tree
- duplicating API helpers in multiple files
- implementing ad hoc status pills in several pages
- adding mutations without refresh consistency
- leaving destructive actions without confirmation
- building both side-panel detail and separate page detail that duplicate logic

---

## Expected Deliverables Per Implementation Slice

For each slice:
1. files changed
2. why those files were touched
3. UI/components added or updated
4. API integration changes
5. loading/error/empty/action behavior
6. manual QA steps
7. rollback notes

---

## Definition of Success

The admin frontend should feel like a real editorial control room:
- the dashboard shows pipeline health
- the queue reflects editorial truth
- the detail page supports real decisions
- actions are safe and clear
- the UI matches backend maturity