# WEOS Do-Not-Guess Rules

Agents working on WEOS must record uncertainty instead of silently inferring
authority or behavior.

## Prohibited Assumptions

| Rule ID         | Do not assume                                              | Evidence to check                                                                         | Required behavior                                             |
| --------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `WEOS-RULE-001` | Formal document approval from document existence           | `docs/weos/authority/STATUS-AND-PRECEDENCE.md`; baseline README                           | Report stated status only                                     |
| `WEOS-RULE-002` | Document supersession without explicit evidence            | `docs/weos/WEOS_Documentation_Baseline_0.2/WEOS_Document_Register.csv`; Phase review docs | Mark precedence unresolved                                    |
| `WEOS-RULE-003` | Mutable fields are canonical records                       | `docs/weos/capability-map/DATABASE-MODEL-MAP.md`                                          | Classify as projection unless evidence proves record status   |
| `WEOS-RULE-004` | Service logs are sufficient audit records                  | `case-review-governance.repository.ts`; domain services                                   | Distinguish persisted events from logs                        |
| `WEOS-RULE-005` | Graph approval authorizes fact promotion                   | `diagnosis-graph-candidates.service.ts`; `WEOS-OD-005`                                    | Mark approval/promotion coupling as conflict/open             |
| `WEOS-RULE-006` | Senior editor equals canonical publication authority       | `auth/roles.ts`; permission map                                                           | Treat runtime permission and canonical authority separately   |
| `WEOS-RULE-007` | Lifecycle terms are interchangeable across artifacts       | `WEOS-IMP-002`; `WEOS-IMP-004`; schema enums                                              | Scope terms by artifact                                       |
| `WEOS-RULE-008` | `apply` means publication                                  | `diagnosis-editorial-workspace.service.ts`; `WEOS-IMP-003`                                | Treat apply as controlled application only                    |
| `WEOS-RULE-009` | Revision support guarantees concurrency safety             | case/education revision services                                                          | Look for expected-version or transaction evidence             |
| `WEOS-RULE-010` | Frontend action visibility grants backend permission       | `workspaceActionRegistry.ts`; backend guards                                              | Backend guard/controller remains authority for runtime access |
| `WEOS-RULE-011` | Runtime implementation overrides unresolved WEOS authority | `WEOS-IMP-005`                                                                            | Preserve behavior and record gap                              |
| `WEOS-RULE-012` | AI drafts become canonical automatically                   | `AiDraftRevisionAudit`; `WEOS-IMP-003`                                                    | Require human acceptance and controlled application evidence  |

## Required Agent Response to Conflict

1. Cite the conflicting files and symbols.
2. State what the repository proves.
3. State what remains unresolved.
4. Avoid code/schema/API changes unless the user explicitly authorizes a scoped
   implementation task.
