# Dashboard Agent Instructions

## WEOS Dashboard Rules

1. Governed actions must be derived from backend contracts or backend-provided
   available actions.
2. Frontend visibility, enabled buttons, local role checks, and route affordances
   are not authority decisions.
3. Show exact artifact and revision context where the backend provides it.
4. Keep warnings, blockers, validation results, and authority denials distinct.
5. Handle stale state and conflicts explicitly.
6. Governed actions need tests for action availability, blocked state, stale
   state, and backend error handling.

## Scope Boundary

Do not duplicate editorial governance rules into the dashboard as independent
authority. The dashboard may present backend state and invoke backend commands;
it must not decide canonical authority on its own.
