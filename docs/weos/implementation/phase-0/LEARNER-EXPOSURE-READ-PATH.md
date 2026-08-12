# WEOS Phase 0 Learner Exposure Read Path

Inspection date: 2026-08-08

## Summary

Current learner exposure resolves daily playable case content through
`DailyCase.case`, where `DailyCase.caseId` points to the mutable `Case` row.
`CaseRevision` exists, but `DailyCase`, `GameSession`, and `Attempt` do not store
the published revision identity, publication version, or content hash used for a
learner exposure event.

## Observed Path

1. `CaseAssignmentService.ensureWindow` selects eligible `Case` rows and creates
   `DailyCase` rows with `date`, `caseId`, `track`, and `sequenceIndex`.
2. The same assignment path can call `markCreatedCasesPublished`, which updates
   selected `Case` rows from `READY_TO_PUBLISH` to `PUBLISHED` and sets
   `publishedAt`.
3. `DailyCasesService` loads the daily case with a relation to `case` and selects
   mutable `Case` fields including title, date, difficulty, diagnosis, clues,
   explanation, differentials, editorial status, and current revision metadata.
4. `DailyCasesService.startDailyGame` creates `GameSession` with `caseId` and
   `dailyCaseId`.
5. `SessionService` and `AttemptService` submit guesses and create `Attempt`
   rows keyed by `caseId` and `sessionId`.
6. Client-facing payloads are built from the selected `DailyCase.case` content.

## Direct Answers

### A. Does `DailyCase` point to `Case` or `CaseRevision`?

`DailyCase` points to `Case`.

The Prisma model has `caseId` and a relation to `Case`. It does not have
`caseRevisionId`, `publishedRevisionId`, or a snapshot/content-hash field.

### B. Is learner-visible content read from mutable `Case` fields or immutable revisions?

Learner-visible content is read from mutable `Case` fields.

`DailyCasesService` selects the `case` relation and exposes fields such as
`title`, `date`, `difficulty`, `diagnosis`, `clues`, `explanation`, and
`differentials`. It also selects `currentRevision` metadata, but the learner
payload is not sourced from `CaseRevision` content.

### C. Do attempts or sessions preserve case revision identity?

No.

`GameSession` stores `caseId` and `dailyCaseId`. `Attempt` stores `caseId` and
`sessionId`. Neither model stores a case revision id, publication version, or
content hash.

### D. Can later case edits affect already scheduled learner-facing content?

Yes, by schema and read-path shape.

Because `DailyCase` stores only `caseId` and the runtime reads mutable `Case`
fields when building learner payloads, a later mutation to learner-visible
fields on the same `Case` row can alter the content served for an already
scheduled daily case unless prevented by service policy outside the exposure
record itself. The current exposure record does not carry enough identity to
prove what content was originally published.

## Evidence Files

| Path                                                                | Evidence                                                                                |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `doctordle-backend/prisma/schema.prisma`                            | `DailyCase`, `GameSession`, and `Attempt` lack revision/version/hash binding.           |
| `doctordle-backend/src/modules/gameplay/case-assignment.service.ts` | Creates daily assignments from eligible `Case` rows and updates publication projection. |
| `doctordle-backend/src/modules/gameplay/daily-cases.service.ts`     | Builds daily payloads from `DailyCase.case` mutable fields.                             |
| `doctordle-backend/src/modules/gameplay/session.service.ts`         | Starts and submits gameplay using `caseId`/`dailyCaseId` session identity.              |
| `doctordle-backend/src/modules/gameplay/attempt.service.ts`         | Persists attempts by `caseId` and `sessionId`.                                          |

## Governance Implication

Before WEOS can guarantee publication immutability, learner exposure needs a
governed identity boundary. That could be a revision id, content hash,
publication event id, or another approved exposure snapshot mechanism, but the
choice is an unresolved architecture decision and is not implemented by Phase 0.
