# Wardle Gameplay Agent Layer

## Purpose

This directory is the entry point for agents working on Wardle learner gameplay.
It exists to keep current runtime evidence separate from target participation
policy.

## Scope

In scope: DailyCase distribution, track access, GameSession identity, attempts,
completion processing, XP, streaks, leaderboards, Learn/recall effects, Archive
implications, and the participation-policy target.

Out of scope: WEOS authority, editorial approval, publication governance,
diagnosis-registry governance, billing implementation, and schema redesigns.

## Source Of Truth

Current state is determined by runtime code and schema. `CURRENT-ARCHITECTURE.md`
summarizes the implementation evidence inspected on 2026-08-11, including the
Archive and participation-policy runtime work in this branch.

The participation-policy architecture is defined by
`PARTICIPATION-POLICY.md`. Do not treat target-state policy as current runtime
behavior unless implementation and tests prove it in the active branch.

## Reading Order

1. Applicable `AGENTS.md` files.
2. `docs/gameplay/README.md`.
3. `docs/gameplay/CURRENT-ARCHITECTURE.md`.
4. `docs/gameplay/PARTICIPATION-POLICY.md`.
5. `docs/gameplay/PARTICIPATION-IMPLEMENTATION-SCOPE.md`.
6. `docs/gameplay/TEST-MATRIX.md`.
7. Runtime sources listed below.

## Key Runtime Paths

- `doctordle-backend/prisma/schema.prisma`
- `doctordle-backend/src/modules/gameplay/case-assignment.service.ts`
- `doctordle-backend/src/modules/gameplay/daily-cases.service.ts`
- `doctordle-backend/src/modules/gameplay/session.service.ts`
- `doctordle-backend/src/modules/gameplay/game-session.service.ts`
- `doctordle-backend/src/modules/gameplay/game.controller.ts`
- `doctordle-backend/src/modules/gameplay/daily-limit.service.ts`
- `doctordle-backend/src/modules/gameplay/streak.service.ts`
- `doctordle-backend/src/modules/gameplay/xp.service.ts`
- `doctordle-backend/src/modules/gameplay/leaderboard.service.ts`
- `doctordle-backend/src/modules/gameplay/reward-orchestrator.service.ts`
- `doctordle-backend/src/modules/queue/queue.processor.ts`
- `doctordle-backend/src/modules/queue/queue.service.ts`
- `doctordle-game/src/features/game/game.types.ts`
- `doctordle-game/src/features/game/game.api.ts`
- `doctordle-game/src/features/game/useGameEngine.ts`
- `doctordle-game/src/pages/GamePage.tsx`

## Relationship To WEOS

WEOS documentation governs editorial/governance concerns. Gameplay
documentation governs learner gameplay/runtime interpretation. Do not infer
gameplay runtime architecture from WEOS concepts unless runtime code or an
approved scoped task explicitly connects them.

## Do Not Guess

- Do not collapse `Case`, `DailyCase`, `GameSession`, and `Attempt` into one
  concept.
- Do not treat `DailyCase` as one row per date; current schema includes
  `track` and `sequenceIndex`.
- Do not let the frontend choose XP, streak, or leaderboard eligibility.
- Do not resolve product policy gaps while documenting current behavior.
- Do not change runtime behavior from this documentation alone.
