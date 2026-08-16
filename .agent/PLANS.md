# ExecPlan Standard

An ExecPlan is required for any WEOS task involving:

- database schema;
- migration;
- publication;
- learner exposure;
- authority;
- more than one backend module;
- cross-backend/frontend change;
- controlled AI application;
- high-risk governance behavior.

Each ExecPlan must include:

## Purpose

State the exact invariant the work will make true.

## Approved Authority

List the approval record, decision document, branch, and commit that authorize
the work. If authority is absent or unresolved, stop before implementation.

## Current Behavior

Summarize observed runtime and documentation behavior with file references.

## Required Invariant

Define the invariant in testable terms.

## Scope

List included behavior and excluded behavior.

## Files Expected To Change

Name expected files or directories before editing.

## Prohibited Changes

List runtime, data, API, schema, or documentation changes that must not happen.

## Data Model Implications

Describe schema, migration, backfill, and compatibility effects. State `None`
when none are expected.

## API Implications

Describe DTO, response, route, and client contract effects. State `None` when
none are expected.

## Migration Plan

Describe migration order, reversibility, and data safety. State `None` when no
migration is authorized.

## Compatibility Strategy

Explain how legacy reads/writes remain safe during transition.

## Testing Strategy

List exact checks, tests, and fixtures.

## Rollback/Recovery

Explain how to revert safely or recover from partial application.

## Progress

Maintain a short checklist while working.

## Discoveries

Record new facts found during implementation.

## Decisions

Record decisions made inside the authorized scope only.

## Remaining Risks

Record unresolved authority, technical, data, or verification risks.

---

# ExecPlan: Wardle Daily Case Archive

## Purpose

Expose a spoiler-safe archive of already released DailyCase assignments so authenticated users can open missed cases through the existing gameplay engine while preserving DailyCase assignment identity.

## Approved Authority

User-requested work package from the attached request in this Codex session. Scope is limited to reading already released DailyCase assignments and user-specific GameSession state. No WEOS/editorial lifecycle, publication authority, approval, readiness, scheduling, schema, migration, or inventory exposure semantics are changed.

## Current Behavior

`GET /game/today` lists only the current date's available DailyCases and returns spoiler-rich case fields. `POST /game/start` accepts a DailyCase ID in DTO/controller shape, but normal loading only resolves requested IDs from today's case list. `GameSession` is uniquely keyed by `[userId, dailyCaseId]`. Completion processing currently awards streak/XP and upserts leaderboard entries for every completed session.

## Required Invariant

Archive listing returns only DailyCase assignments with release date on or before the active game date, only for playable case statuses, with user-specific `unplayed`, `in_progress`, or `completed` status and no answer/explanation fields for unplayed items. Starting a historical DailyCase uses the same session/gameplay flow but historical completion does not update streak, XP, or leaderboards.

## Scope

Included: backend archive list, released DailyCase start guard, archive-aware frontend navigation/tab, focused tests. Excluded: schema migrations, scheduler behavior changes, editorial lifecycle changes, Learn domain merge, public unauthenticated archive.

## Files Expected To Change

`doctordle-backend/src/modules/gameplay/game.controller.ts`, `game-session.service.ts`, `daily-cases.service.ts`, `session.service.ts`, queue completion processing, focused specs, and Wardle game frontend files under `doctordle-game/src/features/game` and `doctordle-game/src/pages`.

## Prohibited Changes

Do not expose future DailyCases, arbitrary Cases, diagnosis answers before completion, draft/rejected/unplayable cases, or mutate editorial publication rules. Do not change today's DailyCase selection behavior or leaderboard ranking semantics.

## Data Model Implications

None. Existing `DailyCase`, `GameSession`, `Attempt`, and `LeaderboardEntry` relationships support assignment identity.

## API Implications

Add `GET /game/archive`. Extend client use of existing `POST /game/start` with `dailyCaseId` for released archive cases.

## Migration Plan

None.

## Compatibility Strategy

Default `POST /game/start` behavior remains today's case. Archive paths are explicit by DailyCase ID and use existing session uniqueness.

## Testing Strategy

Add backend tests for archive visibility/status/spoiler safety and archive start/future blocking. Add frontend unit/domain tests for archive API/status rendering and direct case selection where repository conventions allow.

## Rollback/Recovery

Revert the touched backend/frontend files. No data migration or backfill is involved.

## Progress

- [x] Audit endpoints and data flow.
- [x] Implement backend archive listing and start guard.
- [x] Guard archive completion side effects.
- [x] Implement frontend Archive flow.
- [x] Add tests and run checks.

## Discoveries

`POST /game/start` already has a `dailyCaseId` input but only resolves normal requested IDs from today's case list. `GameSession` preserves DailyCase assignment identity. The queue worker is the place where streak/XP/leaderboard side effects are applied.

Archive list was intentionally changed to exclude the active current-date DailyCase so the Today surface remains distinct.

## Decisions

Use `GET /game/archive` for list data and keep `POST /game/start` as the single gameplay opener.

## Remaining Risks

Game "today" normalization is UTC in existing runtime while scheduler records a separate timezone setting; this work preserves the current game service semantics rather than changing release timing behavior.

---

# ExecPlan: Wardle Gameplay Participation Docs Prep

## Purpose

Prepare a docs-only gameplay interpretation layer so a later Codex runtime task
can implement participation policy from verified Wardle architecture rather than
from stale filenames or assumptions.

## Scope

Documentation and agent guidance only. No runtime, schema, migration, package,
test implementation, queue, XP, streak, leaderboard, Archive, scheduler, API, or
frontend behavior changes.

## Discoveries

`PublishTrack` currently includes `DAILY`, `PREMIUM`, and `PRACTICE`.
`DailyCase` is assignment/distribution identity with unique
`[date, track, sequenceIndex]`. `GameSession` is unique by
`[userId, dailyCaseId]`. Current local Archive queue behavior skips XP, streak,
and leaderboard for non-current assignments, which is a runtime gap against the
target policy that Archive should earn XP without streak or leaderboard.

## Documents Created

- `docs/gameplay/README.md`
- `docs/gameplay/CURRENT-ARCHITECTURE.md`
- `docs/gameplay/PARTICIPATION-POLICY.md`
- `docs/gameplay/PARTICIPATION-IMPLEMENTATION-SCOPE.md`
- `docs/gameplay/TEST-MATRIX.md`

## Documents Updated

- `AGENTS.md`
- `docs/doctordle-current-game-system.md`
- `.agent/PLANS.md`

## Known Runtime Gaps

Archive XP target does not match current local queue guard. Practice XP remains
open. Archive usage-limit semantics remain ambiguous. Wardle-day helper
consolidation is needed before date-sensitive participation logic changes.
Replay reward semantics are not resolved.

## Verification

Final docs-only verification commands:

- `git status --short`
- `git diff --stat`
- `git diff --name-only`
- `git diff --check`

## Next Task

Participation-policy runtime implementation.

## Progress

- [x] Audit agent instructions.
- [x] Audit current gameplay runtime evidence.
- [x] Create gameplay docs layer.
- [x] Run docs-only verification commands.

---

# ExecPlan: Wardle Gameplay Participation Policy Implementation

## Purpose

Implement the server-authoritative gameplay participation policy so completion
side effects are decided independently for XP, Daily streak, leaderboard, and
Learn without adding schema or a second gameplay engine.

## Scope

Runtime scope is limited to gameplay participation resolution, queue completion
side-effect orchestration, focused backend tests, and narrow gameplay docs/ledger
updates. No schema, migration, dependency, scheduler, billing, auth, dashboard,
or frontend contract change is intended.

## Audit

`DailyCase` remains assignment identity with `[date, track, sequenceIndex]`.
`GameSession` remains unique by `[userId, dailyCaseId]`. Archive start and
future blocking remain in `DailyCasesService`/`SessionService`. The broad queue
guard previously skipped XP, streak, and leaderboard together for non-current
DailyCase dates.

## Date Semantics

The scheduler resolves an Africa/Nairobi calendar date into a UTC-normalized
`DailyCase.date`. Gameplay today/archive logic uses UTC-normalized dates.
Participation policy now uses `wardle-day.ts` as the shared helper for
UTC-normalized current-day comparison. Broader scheduler/timezone redesign
remains out of scope.

## Implementation

- [x] Added `ParticipationPolicyService`.
- [x] Added shared `wardle-day.ts` helper.
- [x] Reused the helper through `normalizeDailyDate`.
- [x] Replaced the broad Archive queue skip with independent XP/streak/leaderboard gates.
- [x] Archive XP restored without Daily streak or leaderboard.
- [x] Premium XP characterized without Daily streak or leaderboard.
- [x] Added defensive weekly leaderboard track filter.
- [x] Added resolver and queue processor tests.

## Verification

- Targeted backend tests pass:
  `npm test -- --runInBand participation-policy.service.spec.ts queue.processor.spec.ts session.service.spec.ts daily-case-archive.service.spec.ts`
- Backend build passes: `npm run build` in `doctordle-backend`.
- Frontend build passes: `npm run build` in `doctordle-game`.
- Final diff checks pending.

## Open Decisions

`PRACTICE` XP remains provisional yes. Archive usage-limit semantics remain
unchanged and ambiguous. Replay can reset `xpAwardedAt` in existing dev replay
reset behavior; replay reward policy remains a separate open decision. Future
entitlement architecture remains out of scope.
