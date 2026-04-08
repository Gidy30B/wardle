# Cases Module Audit

Date: 2026-04-06
Scope: `doctordle-backend/src/modules/cases/*` plus direct integration points (`app.module`, seed bootstrap, gameplay daily-case consumption, queue AI enqueueing).

## Executive Summary

The `CasesModule` is now a central lifecycle module with strong foundations:
- `DailyCase` reads/writes are centralized in `CasesService`.
- `getTodayCase()` is self-healing and race-aware.
- Dev reset/rebuild tooling is in place and guarded for non-production.
- AI generation includes queue-level dedupe and worker-level idempotency.

Overall status: **Good, with a few medium-priority consistency and boundary issues**.

---

## Audited Surface

### Module Files
- `src/modules/cases/cases.module.ts`
- `src/modules/cases/cases.service.ts`
- `src/modules/cases/cases.controller.ts`
- `src/modules/cases/dev.controller.ts`
- `src/modules/cases/guards/dev-only.guard.ts`
- `src/modules/cases/dto/create-case.dto.ts`
- `src/modules/cases/dto/assign-daily-case.dto.ts`

### Key Integrations
- `src/app.module.ts`
- `src/core/db/seed.service.ts`
- `src/modules/gameplay/game-session.service.ts`
- `src/modules/gameplay/leaderboard.service.ts`
- `src/modules/queue/queue.service.ts`
- `src/modules/queue/processors/ai.processor.ts`
- `prisma/schema.prisma`
- `prisma/migrations/20260406120000_add_case_title/migration.sql`

---

## What Is Working Well

1. **DailyCase source of truth is centralized**
   - `CasesService` owns `DailyCase` create/read/update behavior.
   - `GameSessionService` and `LeaderboardService` consume `getTodayCase()` context, not direct `prisma.dailyCase` queries.

2. **Self-healing daily-case resolution**
   - `getTodayCase()` attempts fetch, creates if missing, and handles unique collision recovery (`P2002`) by re-fetching.

3. **Schema-level uniqueness supports deterministic day selection**
   - `DailyCase.date` has `@unique` and is stored as `@db.Date`.
   - Date normalization to UTC day start exists in service methods.

4. **Dev tooling is properly environment constrained**
   - `POST /api/dev/reset-today` and `POST /api/dev/rebuild-today` are behind `InternalApiGuard` + `DevOnlyGuard`.

5. **AI safety layers are present**
   - Queue job IDs are deterministic (`hint-<caseId>`, `explanation-<caseId>`).
   - Worker checks DB existence before generating content (defense in depth).

---

## Findings & Risks

## 1) AI enqueue single-source policy is still violated (Medium)

**Observation**
- `CasesService` now enqueues AI on case creation only (good).
- But `GameSessionService.startDailyGame()` still calls `enqueueAiJobsForCase(... source: 'daily_case_selected')`.

**Risk**
- Duplicate enqueue attempts still occur from gameplay flow.
- Queue dedupe prevents many duplicates, but trigger ownership remains split.

**Recommendation**
- Remove gameplay-side AI prewarm enqueue in `GameSessionService`.
- Keep AI enqueue ownership strictly in `CasesService.createCase()`.

---

## 2) Queue dedupe check is non-atomic (Low/Medium)

**Observation**
- `QueueService` uses `queue.getJob(jobId)` before `queue.add(...)`.

**Risk**
- Under high concurrency, two producers can both miss `getJob` and race to `add`.
- BullMQ jobId uniqueness still helps, but this pattern can produce inconsistent logging and extra queue calls.

**Recommendation**
- Prefer relying on `add` with deterministic `jobId` as the primary dedupe primitive, then log based on add outcome.
- Keep `getJob` only if there is a specific operational reason.

---

## 3) `CasesController.getTodayCase()` does an extra query (Low)

**Observation**
- Controller calls `getTodayCase()` and then `getCaseById(today.caseId)`.

**Risk**
- Adds an avoidable DB round trip.

**Recommendation**
- Add a mapper from `TodayCaseContext.case` to API response shape, return directly from first call.

---

## 4) `createCase()` idempotency strategy is date-coupled (Medium)

**Observation**
- If `dto.date` is provided, `createCase()` uses `upsert` on `Case.date`.

**Risk**
- Repeated calls with same date overwrite case data for that date rather than representing separate case versions.
- This may be desired now, but it limits future content workflows.

**Recommendation**
- If long-term content growth is required, introduce explicit external identifiers/versioning strategy and avoid date-only upsert semantics.

---

## 5) Dev reset behavior can cascade data deletion (Expected but high-impact) (Info)

**Observation**
- `resetTodayCase()` deletes `DailyCase` then deletes `Case` by `caseId` in one transaction.

**Risk**
- Because `Case` is a parent relation for sessions/attempts (cascade paths), reset may remove related gameplay artifacts for that case.

**Recommendation**
- Keep as-is for dev utility, but document this clearly in runbook/README to prevent surprise data loss in shared dev databases.

---

## Diagnostics Snapshot

Current diagnostics for audited integration files:
- `GameSessionService`: no errors
- `LeaderboardService`: no errors
- `QueueService`: no errors

Note: historical/intermittent type diagnostics around `Case.title` have appeared previously in editor state; ensure Prisma client regeneration stays part of workflow after schema edits.

---

## Architecture Boundary Check

- `DailyCase` direct Prisma access outside `CasesService`: **not found** in gameplay services.
- Dev endpoints production protection: **present** (`NODE_ENV === 'production'` blocked).
- Seed bootstrap reuses cases lifecycle: **yes** (`SeedService.seedCases(casesService)`).

---

## Recommended Next Actions (Priority)

1. **P1**: Remove gameplay-side `enqueueAiJobsForCase` call to complete single-source AI trigger ownership.
2. **P2**: Simplify/strengthen queue dedupe path to reduce race window and noisy duplicate logs.
3. **P3**: Optimize `GET /cases/today` to avoid second query.
4. **P4**: Document dev reset cascade effects in backend README/runbook.

---

## Conclusion

The module is close to production-grade for dynamic daily-case lifecycle management. Core invariants (single daily case per date, self-healing creation, guarded dev reset/rebuild, AI idempotency) are mostly in place. The main remaining gap is strict trigger ownership for AI enqueueing: one gameplay hook still bypasses the intended single-source model.
