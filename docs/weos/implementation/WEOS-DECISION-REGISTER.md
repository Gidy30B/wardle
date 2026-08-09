# WEOS Implementation Decision Register

Inspection date: 2026-08-08

This register indexes actual implementation authority. It does not approve
decisions. Absence of an authority record means authority is unresolved.

Selected authority baseline: `weos/phase-3-governance-foundations` at
`9bbe883`.

| Topic                                      | Decision ID                                        | Authority Record                        | Status                     | Implementation Authorization         | Scope                                                                                                                                                                                        |
| ------------------------------------------ | -------------------------------------------------- | --------------------------------------- | -------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Document authority and supersession        | `WEOS-OD-021`                                      | `WEOS-AUTH-APP-001`                     | `APPROVED_WITH_CONDITIONS` | `GRANTED_FOR_STAGE_1_CONTRACTS_ONLY` | Repository-native records, schemas, validation/resolution utilities, tests, and documentation integration only. No Prisma, database, API, runtime enforcement, or production rollout.        |
| Governance decision envelope               | `WEOS-OD-018`                                      | `WEOS-AUTH-APP-002`                     | `APPROVED_WITH_CONDITIONS` | `GRANTED_FOR_STAGE_1_CONTRACTS_ONLY` | Repository-native envelope contracts, schemas, extension registry, pure validation, standing and supersession utilities, tests, and documentation integration only.                          |
| Role-to-authority mapping                  | `WEOS-OD-022`                                      | `WEOS-AUTH-APP-003`                     | `APPROVED_WITH_CONDITIONS` | `GRANTED_FOR_STAGE_1_CONTRACTS_ONLY` | Repository-native authority assignment contracts, registries, validation, scope evaluation, delegation checks, resolution, and tests only. No production assignments or runtime enforcement. |
| Expected-version commands                  | `WEOS-OD-023`                                      | `WEOS-AUTH-APP-004`                     | `APPROVED_WITH_CONDITIONS` | `GRANTED_FOR_STAGE_1_CONTRACTS_ONLY` | Repository-native governed-command contracts, registries, precondition comparison, idempotency, batch policy, eligibility resolution, and tests only.                                        |
| Compatibility projection ownership         | `WEOS-OD-019`                                      | `WEOS-AUTH-APP-005`                     | `APPROVED_WITH_CONDITIONS` | `GRANTED_FOR_STAGE_1_CONTRACTS_ONLY` | Repository-native projection ownership contracts, registries, validation, drift/repair/deprecation checks, and tests only.                                                                   |
| Controlled application                     | `WEOS-OD-024`                                      | None present in selected branch records | `REVIEW_REQUIRED`          | None                                 | Decision document exists on selected branch, but no approval record is present in `records/index.json`.                                                                                      |
| Revision-targeted publication              | `WEOS-OD-008`, `WEOS-OD-011`, `WEOS-OD-014`        | None present                            | `REVIEW_REQUIRED`          | None                                 | Publication schedule, history, withdrawal, and exposure semantics remain unresolved.                                                                                                         |
| Learner exposure version binding           | `WEOS-OD-008`, `WEOS-OD-014` plus Phase 0 finding  | None present                            | `REVIEW_REQUIRED`          | None                                 | Current runtime binds exposure to mutable `Case`; no approved version-binding decision found.                                                                                                |
| Graph approval versus promotion            | `WEOS-OD-005`                                      | None present                            | `REVIEW_REQUIRED`          | None                                 | Candidate approval and fact promotion remain unresolved.                                                                                                                                     |
| Diagnosis Education publication separation | Unregistered open decision in Phase 0/gap evidence | None present                            | `UNKNOWN`                  | None                                 | Needs a registered decision and authority record before runtime implementation.                                                                                                              |
| Stable clue identity                       | `WEOS-OD-007`                                      | None present                            | `REVIEW_REQUIRED`          | None                                 | Stable clue keys or records remain unresolved.                                                                                                                                               |

## Active Approved Records

- `WEOS-AUTH-APP-001`: approves `WEOS-OD-021` with conditions for Stage 1
  contracts only.
- `WEOS-AUTH-APP-002`: approves `WEOS-OD-018` with conditions for Stage 1
  contracts only.
- `WEOS-AUTH-APP-003`: approves `WEOS-OD-022` with conditions for Stage 1
  contracts only.
- `WEOS-AUTH-APP-004`: approves `WEOS-OD-023` with conditions for Stage 1
  contracts only.
- `WEOS-AUTH-APP-005`: approves `WEOS-OD-019` with conditions for Stage 1
  contracts only.
- `WEOS-AUTH-APP-006`: authorizes bounded Stage 2 runtime implementation only
  for governed exact `CaseRevision` approval through `APPROVE_CASE_REVISION`.

## Implementation Closure Evidence

Authorization status and implementation/conformance status are distinct.
`WEOS-AUTH-APP-006` remains an active approved authority record. Its bounded
`APPROVE_CASE_REVISION` implementation is now recorded as:

| Field | Value |
| --- | --- |
| Implementation status | `CLOSED` |
| Conformance | `CONFORMANT_WITH_NONBLOCKING_FINDINGS` |
| Closure authority | Final independent APP-006 conformance review |
| Authorized operation | `APPROVE_CASE_REVISION` |
| Implementation commit SHA | `PENDING_COMMIT` |

This closure does not create or approve Phase 1C, `WEOS-AUTH-APP-007`,
publication, learner exposure, controlled AI application, graph promotion,
Diagnosis Education governance, backfill, repair, destructive migration, or a
general governance-kernel rollout.

## Non-Authority Notes

`docs/weos/implementation/WEOS-PILOT-TECHNICAL-IMPLEMENTATION-PLAN.md` is an
implementation planning document. It is not Canon, not an authority record, and
not approval for runtime behavior.
