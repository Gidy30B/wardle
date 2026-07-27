# WEOS Do-Not-Guess Rules

Agents working on WEOS must record uncertainty instead of silently inferring
authority or behavior.

## Prohibited Assumptions

| Rule ID         | Do not assume                                              | Evidence to check                                                                         | Required behavior                                             |
| --------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `WEOS-RULE-001` | Formal document approval from document existence           | `docs/weos/authority/STATUS-AND-PRECEDENCE.md`; baseline README                           | Report stated status only                                     |
| `WEOS-RULE-002` | Document supersession without explicit evidence            | `docs/weos/WEOS_Documentation_Baseline_0.2/WEOS_Document_Register.csv`; Phase review docs | Mark precedence unresolved                                    |
| `WEOS-RULE-003` | Mutable fields are canonical records                       | `docs/weos/capability-map/DATABASE-MODEL-MAP.md`                                          | Classify as projection unless evidence proves record status   |
| `WEOS-RULE-004` | Service logs are sufficient audit records                  | `docs/weos/capability-map/DATABASE-MODEL-MAP.md`; domain services                         | Distinguish persisted records, unavailable models and logs    |
| `WEOS-RULE-005` | Graph approval authorizes fact promotion                   | `diagnosis-graph-candidates.service.ts`; `WEOS-OD-005`                                    | Mark approval/promotion coupling as conflict/open             |
| `WEOS-RULE-006` | Senior editor equals canonical publication authority       | `auth/roles.ts`; permission map                                                           | Treat runtime permission and canonical authority separately   |
| `WEOS-RULE-007` | Lifecycle terms are interchangeable across artifacts       | `WEOS-IMP-002`; `WEOS-IMP-004`; schema enums                                              | Scope terms by artifact                                       |
| `WEOS-RULE-008` | `apply` means publication                                  | `diagnosis-editorial-workspace.service.ts`; `WEOS-IMP-003`                                | Treat apply as controlled application only                    |
| `WEOS-RULE-009` | Revision support guarantees concurrency safety             | case/education revision services                                                          | Look for expected-version or transaction evidence             |
| `WEOS-RULE-010` | Frontend action visibility grants backend permission       | `docs/weos/capability-map/PERMISSION-MAP.md`; backend guards                              | Backend guard/controller remains authority for runtime access |
| `WEOS-RULE-011` | Runtime implementation overrides unresolved WEOS authority | `WEOS-IMP-005`                                                                            | Preserve behavior and record gap                              |
| `WEOS-RULE-012` | AI drafts become canonical automatically                   | `AiDraftRevisionAudit`; `WEOS-IMP-003`                                                    | Require human acceptance and controlled application evidence  |
| `WEOS-RULE-013` | Branch-missing models or files are implemented             | `docs/weos/capability-map/DATABASE-MODEL-MAP.md`; committed `HEAD` paths                  | Mark as `FILE_NOT_IN_BRANCH` or `UNAVAILABLE_IN_BRANCH`       |
| `WEOS-RULE-014` | Service-level authority from controller route access       | `docs/weos/capability-map/PERMISSION-MAP.md`; service signatures                          | Separate route permission from service-level actor authority  |
| `WEOS-RULE-015` | Validation run means approval                              | `ReasoningDraftValidationRun`; `docs/weos/gaps/IMPLEMENTATION-GAPS.md`                    | Treat validation standing and approval separately             |
| `WEOS-RULE-016` | Configured commands have passed                            | `docs/weos/capability-map/TEST-COMMAND-MAP.md`                                            | Use execution status and proof boundary, not script existence |
| `WEOS-RULE-017` | Action equivalence without a crosswalk entry               | `docs/weos/capability-map/RUNTIME-ACTION-CROSSWALK.md`                                    | Mark action equivalence unresolved                            |
| `WEOS-RULE-018` | Version-number uniqueness proves stale-write safety        | `docs/weos/capability-map/DATABASE-MODEL-MAP.md`                                          | Require expected-version or stale-write rejection evidence    |
| `WEOS-RULE-019` | Backfill may invent historical governance records          | `docs/weos/gaps/IMPLEMENTATION-GAPS.md`; `WEOS-OD-019`                                    | Preserve projection/history uncertainty                       |
| `WEOS-RULE-020` | Open-decision outcomes can be inferred                     | `docs/weos/WEOS-IMP-005-phase-2-open-decisions.md`                                        | Use the stated open decision or an unregistered decision      |

## Interpretation References

- Authority: `docs/weos/authority/STATUS-AND-PRECEDENCE.md`
- Capability map: `docs/weos/capability-map/WEOS-CAPABILITY-MAP.md`
- Runtime-action crosswalk: `docs/weos/capability-map/RUNTIME-ACTION-CROSSWALK.md`
- Database model map: `docs/weos/capability-map/DATABASE-MODEL-MAP.md`
- Permission map: `docs/weos/capability-map/PERMISSION-MAP.md`
- Test-command map: `docs/weos/capability-map/TEST-COMMAND-MAP.md`
- Gap register: `docs/weos/gaps/IMPLEMENTATION-GAPS.md`
- Open-decision register: `docs/weos/WEOS-IMP-005-phase-2-open-decisions.md`

## Required Agent Response to Conflict

1. Cite the conflicting files and symbols.
2. State what the repository proves.
3. State what remains unresolved.
4. Avoid code/schema/API changes unless the user explicitly authorizes a scoped
   implementation task.
