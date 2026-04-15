# Validation & Admin Review Implementation Plan

## Objective

Introduce a validation + admin review layer into the existing backend WITHOUT breaking:

- case generation
- scheduling/publishing
- gameplay

Validation must integrate into the current system — not replace it.

---

# System Assumptions

- Case generation already exists and persists cases
- Publishing (daily/premium/practice) already exists
- Gameplay reads from existing case tables
- Backend uses NestJS + Prisma + Postgres
- There may already be queue-based processing

---

# Global Constraints

- No duplicate case creation
- No duplicate validation execution
- No parallel pipelines
- No breaking gameplay
- No premature publish gating

---

# Phase 0 — Audit (NO CODE CHANGES)

## Goal
Understand the current system completely.

## Tasks
- Identify:
  - where cases are created
  - where cases are persisted
  - how cases are scheduled/published
  - how gameplay reads cases
- Map:
  - services
  - controllers
  - queue workers
- Identify duplication risks

## Deliverables
- architecture map
- integration points for:
  - validation
  - admin review

## Acceptance
- clear flow: generation → persistence → scheduling → gameplay

---

# Phase 1 — Schema Backbone

## Goal
Add editorial + validation schema WITHOUT runtime impact.

## Tasks
- Add enums:
  - CaseEditorialStatus
  - ValidationOutcome
  - ReviewDecision
  - CaseSource
  - PublishTrack
- Extend Case model:
  - editorialStatus
  - approvedAt
  - approvedByUserId
  - currentRevisionId
- Add models:
  - CaseValidationRun
  - CaseReview
  - CaseRevision
- Create safe migration

## Non-goals
- No validation execution
- No behavior changes

## Acceptance
- existing system behaves exactly the same
- DB migrated safely

---

# Phase 2 — Validation (Shadow Mode)

## Goal
Run validation WITHOUT affecting behavior.

## Tasks
- Implement:
  - CaseRevisionService
  - CaseValidationService
  - CaseValidationOrchestrator
- Add validators:
  - structure
  - clue
  - differential
  - explanation
  - difficulty
- On safe integration point:
  - create revision
  - run validation
  - store CaseValidationRun

## Non-goals
- No status enforcement
- No publish gating

## Acceptance
- validation runs exactly once per event
- no duplicate revisions
- no gameplay changes

---

# Phase 3 — Connect Generation → Validation

## Goal
Make validation the canonical post-generation step.

## Tasks
- Identify final persistence point of generated case
- Hook:
  - revision creation
  - validation execution
- Ensure:
  - single execution
  - no duplicate triggers

## Non-goals
- Do NOT gate publishing yet

## Acceptance
- every generated case:
  - has revision
  - has validation run
- no duplicates

---

# Phase 4 — Admin Review Workflow

## Goal
Enable manual validation.

## Tasks
- Add endpoints:
  - list by status
  - case detail
  - run validation
  - submit review
  - list revisions
  - restore revision
- Implement CaseReviewService
- Add status transitions

## Rules
- APPROVED / REJECTED / NEEDS_EDIT
- edits invalidate approval

## Acceptance
- admin can review cases
- approval flow works
- revision restore works

---

# Phase 5 — Publish Gating

## Goal
Only approved cases can be scheduled/published.

## Tasks
- Identify scheduling logic
- Restrict eligibility to:
  - APPROVED / READY_TO_PUBLISH
- Keep existing live cases working

## Non-goals
- no gameplay refactor unless required

## Acceptance
- new publishes only use approved cases
- existing live cases unaffected

---

# Phase 6 — Cleanup & Enforcement

## Goal
Remove ambiguity and enforce rules.

## Tasks
- enforce state transitions
- remove duplicate validation paths
- ensure:
  - one validation owner
  - one publish owner
- add logging + metrics

## Acceptance
- no duplicate triggers
- clean state transitions
- stable system

---

# Global Acceptance Checklist

After full implementation:

- [ ] No duplicate case creation
- [ ] No duplicate validation runs
- [ ] No duplicate revisions
- [ ] Gameplay unchanged until Phase 5
- [ ] Only approved cases get published
- [ ] Edits reset approval
- [ ] Admin review fully functional
- [ ] Validation results persisted

---

# Risk Controls

## High Risk Areas
- generation pipeline
- queue workers
- publish scheduling
- gameplay queries

## Mitigation
- implement in phases
- test after each phase
- avoid refactors

---

# Rollback Strategy

Each phase must be independently reversible:

- Phase 1: DB-only → rollback migration
- Phase 2: disable validation trigger
- Phase 3: remove integration hook
- Phase 4: disable admin endpoints
- Phase 5: revert publish filter
- Phase 6: restore previous flow

---

# Execution Strategy with Codex

1. Read AGENTS.md
2. Read this file
3. Execute ONE phase at a time
4. Stop after each phase
5. Wait for review before continuing

---

# Final Note

This system must evolve safely.

Correctness > speed  
Clarity > cleverness  
Integration > replacement
