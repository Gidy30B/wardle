# Gameplay Participation Policy

## Status

APPROVED IMPLEMENTATION TARGET.

IMPLEMENTED IN RUNTIME WORK PACKAGE.

This document defines the approved participation-policy architecture. Local
runtime implementation exists in the active branch once the Archive and
participation runtime commit is applied.

## Goal

Separate gameplay completion from competitive and daily-reward assumptions.
Every completed assignment may be valid gameplay, but only some completions
should affect XP, Daily streak, leaderboards, and Learn.

Initial participation contexts:

- `CURRENT_DAILY`
- `ARCHIVED_DAILY`
- `PREMIUM`
- `PRACTICE`

These names are target concepts. They do not require adding enum values or
schema fields for the initial implementation.

## Initial Policy Matrix

| Context | XP | Daily Streak | Leaderboard | Learn |
| --- | --- | --- | --- | --- |
| `CURRENT_DAILY` | Yes | Yes | Yes | Yes |
| `ARCHIVED_DAILY` | Yes | No | No | Yes |
| `PREMIUM` | Yes | No | No | Yes |
| `PRACTICE` | Proposed Yes | No | No | Yes |

`PRACTICE` XP is provisionally implemented as eligible. Product can still
revise this in a scoped policy task before a public Practice surface launches.

## Core Principle

A `Case` is clinical content.

`DailyCase` is currently the playable distribution/assignment identity, despite
its historical name.

`GameSession` is gameplay state.

`ParticipationPolicy` determines which completion side effects apply.

Subscription/access determines whether a user may start an assignment.

These concerns must not be collapsed into one another.

## Server Authority

The frontend must never submit:

- `competitive=true`
- `leaderboardEligible=true`
- `streakEligible=true`
- `xpEligible=true`

The server derives participation context from authoritative assignment data,
the authenticated user, release timing, and access rules.

## Invariants

`GP-PART-001`: `DailyCase` remains the playable assignment identity for this
phase.

`GP-PART-002`: `GameSession` remains assignment-specific and unique by
`userId + dailyCaseId`.

`GP-PART-003`: The client cannot choose reward, streak, or leaderboard
eligibility.

`GP-PART-004`: Only `CURRENT_DAILY` may mutate the Daily streak.

`GP-PART-005`: Only `CURRENT_DAILY` may create competitive leaderboard
participation under the current product model.

`GP-PART-006`: `ARCHIVED_DAILY` may award first-completion XP.

`GP-PART-007`: `PREMIUM` may award first-completion XP.

`GP-PART-008`: `GameSession.xpAwardedAt` remains the current XP idempotency
authority.

`GP-PART-009`: All contexts reuse the existing gameplay engine.

`GP-PART-010`: No schema migration is expected for the initial
participation-policy implementation.

`GP-PART-011`: Future/unreleased `DailyCase` assignments remain inaccessible.

`GP-PART-012`: Participation context is resolved server-side.

`GP-PART-013`: Archive completion must not retroactively repair or extend Daily
streaks.

`GP-PART-014`: Premium completion must not maintain or extend the Daily streak.

`GP-PART-015`: Archive and Premium completions must not contaminate weekly
competition.

`GP-PART-016`: Content/editorial lifecycle eligibility remains independent of
participation policy.

`GP-PART-017`: The implementation must reuse or extract a single authoritative
Wardle-day helper for current-day and release checks.

`GP-PART-018`: Participation policy must separate XP eligibility from streak
mutation so Archive and Premium XP can be awarded without Daily streak effects.

`GP-PART-019`: Reprocessing a completed session must not duplicate XP,
leaderboard rows, streak mutations, or notifications.

`GP-PART-020`: Same `Case` content in two different assignments must preserve
independent progress by `dailyCaseId`.

## Explicit Non-Goals

The initial participation-policy implementation must not automatically
introduce:

- `CaseOffering`
- `CaseRelease` rename migration
- `PremiumCase`
- `PremiumGameSession`
- second gameplay engine
- new subscription billing system
- full entitlement framework
- `LearningTrack`
- curriculum schema
- replay redesign
- WEOS lifecycle redesign
- scheduler redesign

Each would require separate justification and a scoped task.

## Open Decisions

- `PRACTICE` XP behavior.
- Archive usage-limit semantics.
- Future entitlement architecture.
- Wardle-day/date helper consolidation details.
- Replay reward semantics.
