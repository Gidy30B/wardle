# Participation Implementation Scope

## Status

Guidance for the participation-policy runtime implementation task. This
document is not a runtime change request by itself.

## Expected Read Paths

- `docs/gameplay/README.md`
- `docs/gameplay/CURRENT-ARCHITECTURE.md`
- `docs/gameplay/PARTICIPATION-POLICY.md`
- `docs/gameplay/TEST-MATRIX.md`
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

Also inspect local Archive files when present:

- `doctordle-backend/src/modules/gameplay/daily-case-archive.service.spec.ts`
- `doctordle-game/src/features/game/react/ArchiveTabPage.tsx`
- `doctordle-game/src/features/game/useDailyCaseArchive.ts`

## Likely Write Paths

Keep the initial runtime implementation small. Likely write paths include:

- A proposed gameplay participation policy resolver/service under
  `doctordle-backend/src/modules/gameplay/`.
- Focused resolver tests under the existing backend gameplay test conventions.
- `doctordle-backend/src/modules/queue/queue.processor.ts` for completion
  side-effect integration.
- Targeted XP/streak/leaderboard integration tests.
- Archive regression tests.

Only add frontend changes if the backend contract changes. The client must not
send eligibility booleans.

## Restricted Areas

Do not modify without demonstrated necessity:

- `doctordle-backend/prisma/schema.prisma`
- `doctordle-backend/prisma/migrations/*`
- scheduler assignment semantics
- WEOS governance runtime
- diagnosis registry
- case generation
- auth
- analytics dashboard
- billing/subscriptions
- unrelated dirty files

No schema migration is expected for the initial participation-policy
implementation.

## Implementation Checkpoints

A. Audit the current Archive completion guard.

B. Implement a server-side participation resolver.

C. Unit-test resolver contexts and edge cases.

D. Integrate queue processing with the resolver.

E. Separate XP eligibility from streak mutation.

F. Protect leaderboard writes and weekly aggregation from non-competitive
contexts.

G. Regression-test Archive completion.

H. Characterize Premium completion.

I. Run focused builds/tests.

J. Review the diff and prove runtime scope stayed bounded.

## Guardrails

- Preserve `DailyCase` as playable assignment identity.
- Preserve `unique(userId, dailyCaseId)` gameplay progress semantics.
- Do not create a second gameplay engine.
- Do not let client-provided fields decide participation effects.
- Do not resolve WEOS/editorial authority gaps.
- Do not change scheduler behavior unless the task explicitly authorizes it.
- Preserve existing dirty work not created by the implementation task.
