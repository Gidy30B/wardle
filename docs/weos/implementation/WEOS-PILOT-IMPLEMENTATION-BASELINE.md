# WEOS Pilot Implementation Baseline

Date: 2026-08-08

## Branch And Commit

| Item                            | Value                                          |
| ------------------------------- | ---------------------------------------------- |
| Branch                          | `weos/pilot-governance-runtime`                |
| Base commit                     | `9bbe883c6ec9d6fd376d53be649de7ac3a426a3b`     |
| Resulting HEAD                  | `9bbe883c6ec9d6fd376d53be649de7ac3a426a3b`     |
| Worktree path                   | `C:\Users\user\DxLab-pilot-governance-runtime` |
| Source dirty worktree preserved | `C:\Users\user\DxLab`                          |

This branch was created as a separate Git worktree from `9bbe883` so the dirty
`C:\Users\user\DxLab` checkout remains untouched.

## Authority Records Present

The baseline contains:

- `docs/weos/authority/records/`
- `docs/weos/authority/schemas/`
- `docs/weos/phase-3-governance-foundations/`

Parsed authority records:

- `docs/weos/authority/records/index.json`
- `docs/weos/authority/records/document-approvals/WEOS-AUTH-APP-001.json`
- `docs/weos/authority/records/document-approvals/WEOS-AUTH-APP-002.json`
- `docs/weos/authority/records/document-approvals/WEOS-AUTH-APP-003.json`
- `docs/weos/authority/records/document-approvals/WEOS-AUTH-APP-004.json`
- `docs/weos/authority/records/document-approvals/WEOS-AUTH-APP-005.json`
- `docs/weos/authority/records/document-approvals/WEOS-AUTH-APP-006.json`

## Implementation Authority Currently Granted

Current bounded runtime authorization:

```text
GRANTED_FOR_NAMED_STAGE
```

`WEOS-AUTH-APP-006` authorizes only Stage 2 governed approval of an exact
`CaseRevision` through `APPROVE_CASE_REVISION`. All other active records retain
their recorded Stage 1 repository-native scope.

## Implementation Authority Explicitly Not Granted

Outside `APPROVE_CASE_REVISION`, this baseline does not grant:

- Prisma changes;
- database persistence;
- migrations;
- API routes;
- controllers;
- guards;
- runtime services;
- command handlers;
- runtime enforcement;
- dashboard behavior;
- learner behavior;
- production authority assignments;
- compatibility projection synchronization;
- backfills;
- repair execution;
- deployment;
- production rollout.

This baseline authorizes no runtime implementation beyond the implementation
authority contained in approved authority records.

## Agent Instruction Files

Canonical instruction files present:

- `AGENTS.md`
- `docs/weos/AGENTS.md`
- `doctordle-backend/AGENTS.md`
- `analytics-dashboard/AGENTS.md`
- `doctordle-game/AGENTS.md`
- `.agent/PLANS.md`

The historical spaced file `AGENTS .md` remains in the base commit, but
`AGENTS.md` is the canonical root instruction file for agent execution.

## Phase Evidence Present

Phase 0 evidence:

- `docs/weos/implementation/phase-0/CURRENT-HEAD-AUDIT.md`
- `docs/weos/implementation/phase-0/GOVERNED-MUTATION-INVENTORY.md`
- `docs/weos/implementation/phase-0/LEARNER-EXPOSURE-READ-PATH.md`
- `docs/weos/implementation/phase-0/PHASE-0-READINESS-REPORT.md`

Phase 1A evidence:

- `docs/weos/implementation/phase-1a/PREEXISTING-WORKTREE-INVENTORY.md`
- `docs/weos/implementation/phase-1a/PHASE-1A-READINESS-REPORT.md`

Implementation planning and registers:

- `docs/weos/implementation/WEOS-PILOT-TECHNICAL-IMPLEMENTATION-PLAN.md`
- `docs/weos/implementation/WEOS-DECISION-REGISTER.md`
- `docs/weos/implementation/WEOS-AMBIGUITY-REGISTER.md`
- `docs/weos/implementation/WEOS-IMPLEMENTATION-MAP.md`
- `docs/weos/implementation/WEOS-CONFORMANCE-MATRIX.md`

## Verification Commands Executed

| Command                                                                                                                            | Outcome                                                                                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `git diff --check`                                                                                                                 | Passed. Git emitted a CRLF warning for `package.json`.                                                                                                                                                                                                 |
| `git diff --cached --check`                                                                                                        | Passed.                                                                                                                                                                                                                                                |
| `C:\Users\user\DxLab\doctordle-backend\node_modules\.bin\prisma.cmd validate --schema doctordle-backend/prisma/schema.prisma`      | Passed against the clean baseline schema without installing dependencies into this worktree.                                                                                                                                                           |
| `node C:\Users\user\DxLab\doctordle-backend\node_modules\jest\bin\jest.js --runInBand --no-cache ...editorial-governance specs...` | Passed, 5 suites and 274 tests.                                                                                                                                                                                                                        |
| `Get-ChildItem docs/weos/authority/records -Recurse -Filter *.json \| ... ConvertFrom-Json`                                        | Passed for `index.json` and `WEOS-AUTH-APP-001` through `WEOS-AUTH-APP-006`.                                                                                                                                                                           |
| file presence checks for canonical agent files and Phase 0/1A evidence                                                             | Passed.                                                                                                                                                                                                                                                |
| `npx prisma validate --schema doctordle-backend/prisma/schema.prisma`                                                              | Timed out in the new clean worktree because dependencies are not installed there and no dependency installation was performed. The installed-binary Prisma command above passed.                                                                       |
| `npm run verify`                                                                                                                   | Timed out in the new clean worktree because dependencies are not installed there and no dependency installation was performed. Equivalent Git checks, Prisma validation, and Stage 1 WEOS tests passed through installed tooling as separate commands. |

## Known Exclusions

The following were intentionally not copied into the clean baseline:

- dirty Prisma schema changes from `C:\Users\user\DxLab`;
- dirty migrations;
- dirty backend runtime/admin service changes;
- dirty dashboard runtime/workspace changes;
- dirty game config changes;
- seed, repair, backfill, scheduler, importer, or data scripts;
- experimental runtime governance files from the dirty worktree.

## Remaining Blockers

- Runtime authorization remains limited to `APPROVE_CASE_REVISION`.
- Permanent runtime authority assignments are not approved.
- Runtime expected-version enforcement outside `APPROVE_CASE_REVISION` is not
  approved.
- Runtime compatibility projection owners outside governed case revision
  approval are not approved.
- Controlled application authority remains unapproved.
- Revision-targeted publication and learner exposure version binding remain
  unresolved.
- Dependency installation is absent in this clean worktree, so `npm run verify`
  cannot complete directly until dependencies are installed or linked.
  Equivalent non-mutating Git, Prisma, and Stage 1 WEOS test checks passed
  through already installed tooling.

## Readiness

`READY_WITH_CONDITIONS`

The baseline is cleanly rooted at `9bbe883`, contains Phase 0/1A evidence and
canonical agent instructions, and preserves the Stage 1 authority boundary
except for the explicitly approved APP-006 `APPROVE_CASE_REVISION` runtime
slice. Before any additional runtime implementation begins, a human must
approve a separate narrowly scoped authorization.
