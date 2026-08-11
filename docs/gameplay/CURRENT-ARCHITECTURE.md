# Current Gameplay Architecture

## Status

Implementation evidence summary. This document describes current runtime
behavior observed in the local worktree on 2026-08-11. Runtime code and schema
remain authoritative if this summary drifts.

This branch includes Daily Case Archive and participation-policy runtime work.
Archive and participation notes in this document describe implementation
evidence in the active branch.

## Scope

This document covers learner gameplay only: content assignment, access, play
state, completion side effects, and date semantics. It does not grant WEOS
editorial, publication, or governance authority.

## Architecture Overview

```text
Case
  |
  v
CaseRevision
  |
  | publishTrack
  v
DailyCase
  (date, track, sequenceIndex)
  |
  v
GameSession
  |
  v
Attempt
  |
  v
Completion processing
  |- XP
  |- Streak
  |- Leaderboard
  `- notifications/events
```

## 1. Content / Editorial

`Case` is the clinical content record. `CaseRevision` stores revision content
and includes optional `publishTrack`. The `PublishTrack` enum currently contains
`DAILY`, `PREMIUM`, and `PRACTICE`.

Assignment eligibility is checked through gameplay services and case
eligibility policy. Do not infer editorial approval or publication authority
from the existence of a playable case, route access, user role, or generated
documentation.

## 2. Distribution

`DailyCase` is the playable distribution and assignment row. Despite its
historical name, it is not limited to one case per calendar date.

Current schema fields include:

- `id`
- `caseId`
- `date`
- `track`
- `sequenceIndex`

The unique key is `[date, track, sequenceIndex]`. This allows multiple playable
assignments on the same date across tracks and sequence slots.

## 3. Assignment

`CaseAssignmentService.ensureWindow` implements rolling-window scheduling. In
current code it fills `DAILY` track, `sequenceIndex = 1`, across a bounded date
window.

`CaseAssignmentService.assignDate` implements editorial-date assignment. It can
consider `DAILY`, `PREMIUM`, and `PRACTICE`, groups eligible cases by
`CaseRevision.publishTrack` with `DAILY` as the fallback, and assigns
`sequenceIndex` values within each track.

Eligibility gates include assignable editorial status, playable clues, matched
diagnosis registry, playable registry standing, and explanation presence.

## 4. Access

`User.subscriptionTier` stores the current tier string. Access decisions are
implemented in gameplay services, not in a standalone entitlement system.

Current access helpers in `daily-cases.service.ts` allow:

- `DAILY`: all tiers.
- `PREMIUM`: normalized `premium` tier.
- `PRACTICE`: no distinct playable access path through `hasPremiumTrackAccess`.

`getAllowedTracksForTier` returns `DAILY` for free users and `DAILY` plus
`PREMIUM` for premium/practice-tier users. This is current behavior, not a
general billing or entitlement architecture.

## 5. Gameplay

Playable identity flows from `Case` to `DailyCase` to `GameSession` to
`Attempt`.

`GameSession` is assignment-specific. The schema enforces
`unique(userId, dailyCaseId)`, so progress belongs to a user's assignment, not
just to a clinical `caseId`. The same `Case` can appear in more than one
assignment over time or track; those assignments must not be collapsed.

`POST /game/start` accepts optional `dailyCaseId`, `track`, and
`sequenceIndex`. Default play resolves from today's available cases. Local
Archive work also allows explicit released historical `dailyCaseId` starts
through server-side guards.

## 6. Completion Processing

`session.service.ts` records attempts and transitions a session to completed.
It emits gameplay events through `RewardOrchestrator`. `QueueService` enqueues
completed-game jobs, and `queue.processor.ts` performs postgame side effects.

The queue processor validates session/user/case assignment consistency, computes
completion timing, finds the latest attempt, and then applies reward and
competition effects. It marks processing state through `processingAt` and
`processedAt`.

In the local participation-policy work, queue processing resolves a server-side
participation policy from `DailyCase.track` and the shared Wardle-day helper.
XP, streak, and leaderboard effects are gated independently: current daily can
receive all three, while Archive and Premium completions can receive XP without
Daily streak or leaderboard effects.

## 7. XP

`XpService` calculates XP from correctness, clue index, attempts count, and a
streak bonus. Correct answers can earn more XP based on earlier clue solve and
streak. Incorrect completion still has a reward calculation path, but current
queue integration calls XP only for correctly completed XP-eligible sessions.
Non-streak contexts pass `streak = 0`, so they do not receive a Daily streak
bonus.

`GameSession.xpAwardedAt` is the current XP idempotency authority. XP is general
progression and is not inherently a leaderboard entry.

## 8. Streak

`StreakService` mutates `UserStats` using UTC day boundaries derived from
`completedAt`. Same-day completion is idempotent: it returns the existing
streak. Consecutive UTC-day completion increments; a gap resets to 1 on the next
completion. `getCurrentStats` can reset a stale visible streak to 0.

The streak service itself has no track or DailyCase awareness. Eligibility is
therefore controlled by callers. In the local participation-policy work, the
queue caller only invokes streak mutation for `CURRENT_DAILY` completions.

## 9. Leaderboards

Daily leaderboard display selects today's UTC `DailyCase` where
`track = DAILY`, ordered by highest `sequenceIndex`.

Completion writes use `LeaderboardService.upsertCompletion`, keyed by
`dailyCaseId + userId`. The service validates that the session case matches the
assigned DailyCase, but track/date eligibility is enforced by the queue
participation policy.

Weekly leaderboard aggregation reads `LeaderboardEntry` rows by `completedAt`
range and defensively filters to `DailyCase.track = DAILY`. The primary
competition defense remains the queue write boundary.

## 10. Daily Limits

`DailyLimitService` is a usage policy gate, not a complete access policy. Free
users are blocked after one completed session in the supplied date range.
Premium users bypass this limit. Development can bypass it through
`DEV_BYPASS_DAILY_LIMIT`.

Current callers pass a range derived from the assignment date. Archive semantics
are ambiguous because the service counts completion time within the supplied
range, not a first-class participation context. Do not resolve this in gameplay
docs.

## 11. Learn / Recall Relationship

Learn/recall surfaces are based on completed sessions and case review data.
They are distinct from Archive browsing and competition. Target participation
policy keeps Learn eligibility for completed current daily, archived daily,
premium, and practice contexts.

## 12. Date/Time Semantics

The scheduler resolves a schedule date using `DAILY_SCHEDULE_TIMEZONE`, default
tested as `Africa/Nairobi`, and stores a normalized UTC date.

Gameplay date normalization uses the shared `wardle-day.ts` helper for
UTC-normalized Wardle-day comparison. Streak and leaderboard helpers still use
local UTC day boundaries. Local Archive release logic uses UTC-normalized
release cutoffs through daily-case normalization.

## 13. Known Architectural Coupling

- `DailyCase` carries distribution, track, assignment, and competition identity.
- Subscription access is distributed through gameplay helpers rather than a
  dedicated entitlement layer.
- XP currently depends on a streak value supplied by the queue caller.
- Streak and leaderboard eligibility are caller responsibilities.
- Weekly leaderboard aggregation assumes only competitive entries are written.
- Daily free-limit semantics are unclear for Archive and non-current contexts.
- Current playable content still points from `DailyCase.caseId` to mutable case
  content unless a later approved package changes version targeting.

## 14. Runtime Source Map

- Schema: `doctordle-backend/prisma/schema.prisma`
- Assignment: `doctordle-backend/src/modules/gameplay/case-assignment.service.ts`
- Scheduler: `doctordle-backend/src/modules/gameplay/daily-case-scheduler.service.ts`
- Daily case access/archive: `doctordle-backend/src/modules/gameplay/daily-cases.service.ts`
- Game start and guess flow: `doctordle-backend/src/modules/gameplay/session.service.ts`
- Controller: `doctordle-backend/src/modules/gameplay/game.controller.ts`
- Completion events: `doctordle-backend/src/modules/gameplay/reward-orchestrator.service.ts`
- Queue integration: `doctordle-backend/src/modules/queue/queue.service.ts`
- Queue side effects: `doctordle-backend/src/modules/queue/queue.processor.ts`
- Participation policy: `doctordle-backend/src/modules/gameplay/participation-policy.service.ts`
- Wardle-day helper: `doctordle-backend/src/modules/gameplay/wardle-day.ts`
- XP: `doctordle-backend/src/modules/gameplay/xp.service.ts`
- Streak: `doctordle-backend/src/modules/gameplay/streak.service.ts`
- Leaderboard: `doctordle-backend/src/modules/gameplay/leaderboard.service.ts`
- Daily limit: `doctordle-backend/src/modules/gameplay/daily-limit.service.ts`
- Frontend game API/types/engine: `doctordle-game/src/features/game/`
- Frontend route shell: `doctordle-game/src/pages/GamePage.tsx`
