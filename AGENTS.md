# AGENTS.md

## Purpose

This repository is the Wardle / DxLabs implementation workspace. For WEOS,
editorial, governance, publication, learner-exposure, diagnosis-registry, or
case-review work, agents must treat repository evidence, approved authority, and
runtime implementation as distinct.

Older diagnosis-standardization guidance has been preserved at
`docs/agents/DIAGNOSIS-STANDARDIZATION.md` and applies only when the task is
specifically about diagnosis standardization.

## Gameplay Agent Layer

For learner gameplay/runtime work, start with `docs/gameplay/README.md` after
reading the applicable `AGENTS.md` files. Runtime code and schema remain the
source of truth for current gameplay behavior. `docs/gameplay/PARTICIPATION-POLICY.md`
is a target-state implementation specification for later participation-policy
work; it does not describe behavior that is already fully implemented unless it
explicitly says so.

WEOS documentation governs editorial, governance, publication, authority, and
learner-exposure concerns. Gameplay documentation governs learner gameplay and
runtime interpretation. Do not infer gameplay runtime architecture from WEOS
concepts unless the connection is explicit.

## Repository Rules

1. Read `docs/weos/AGENT-START-HERE.md` before WEOS or editorial work.
2. Respect `docs/weos/authority/STATUS-AND-PRECEDENCE.md`.
3. Validate implementation authority before changing governed behavior.
4. Distinguish runtime evidence from canonical authority.
5. Never infer approval from validation, tests, generated docs, reviewed drafts,
   UI visibility, route access, or working code.
6. Never infer editorial authority from technical roles such as `admin`,
   `editor`, `senior_editor`, service accounts, or repository ownership.
7. Never invent unresolved WEOS semantics or fabricate historical governance
   records.
8. Preserve user changes. Do not reset, delete, stash, overwrite, or commit
   unrelated work unless explicitly authorized.
9. Avoid unrelated refactors and keep work packages exact and bounded.
10. Avoid destructive migrations or data-changing scripts unless explicitly
    authorized for the current task.
11. Run the documented non-mutating verification path before completion when it
    is available and safe.
12. Report all unresolved decisions and authority gaps that affect the task.

## WEOS Runtime Boundaries

Do not change runtime semantics for approval, readiness, publication,
scheduling, learner exposure, case revision identity, authority, controlled AI
application, compatibility projections, or governance history unless the task
names an approved authority record and exact implementation scope.

## Planning Requirement

Use `.agent/PLANS.md` for any WEOS task that touches high-risk governance,
schema, migration, publication, learner exposure, authority, controlled AI
application, multiple backend modules, or backend/frontend contracts.
