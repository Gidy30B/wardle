# Backend Agent Instructions

## WEOS Backend Invariants

1. Approval, readiness, publication, scheduling, and learner exposure are
   distinct concepts.
2. Governed decisions must target explicit artifact versions once that
   capability is implemented.
3. Do not infer editorial authority from `admin`, `editor`, `senior_editor`, or
   any other runtime role.
4. Do not fabricate historical governance records from legacy status fields,
   validation runs, logs, projections, or UI actions.
5. Do not directly modify compatibility projections when a canonical owner
   exists.
6. Migrations must be additive unless an explicit approved task authorizes a
   destructive change.
7. Governed state transitions require tests.

## Current-State Caution

Do not claim unimplemented guarantees already exist. In the current Phase 1A
baseline, daily learner exposure still resolves through `DailyCase.caseId` and
mutable `Case` content unless a later approved runtime package changes that.

## Verification

Do not use `npm run lint` as a verification command in this package unless the
task explicitly allows mutation; that script runs ESLint with `--fix`.
