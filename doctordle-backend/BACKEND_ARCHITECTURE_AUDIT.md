# Backend Architecture Audit

**Repository:** doctordle-backend  
**Scope:** NestJS API, gameplay engine, diagnostics/evaluation stack, persistence, caching, and operational behavior  
**Audit date:** 2026-04-06

## Executive summary

This backend is a **modular NestJS monolith** with clear functional boundaries:

- **Auth** is handled centrally with Clerk JWT verification and a global guard.
- **Gameplay** owns session lifecycle, guess submission, clue progression, daily limits, leaderboard writes, XP, and streak updates.
- **Diagnostics** evaluates guesses using a layered scoring stack: preprocessing, synonym/ontology logic, fuzzy matching, vector retrieval, and an optional LLM fallback.
- **Persistence** uses Prisma + PostgreSQL with pgvector for semantic retrieval.
- **Caching / rate limiting** use Redis.
- **Observability** is present, but mostly internal counters and logs rather than a full external telemetry stack.

The architecture is reasonably cohesive for a product in active development, but it has a few important risks:

1. **Semantic retrieval depends on a mock embedding path that does not match the stored vector dimension.**
2. **Some critical flows are in-memory only** and will not survive process restarts or horizontal scaling cleanly.
3. **A few endpoints swallow errors and return empty/default payloads**, which can hide operational failures.
4. **Startup seeding and user bootstrap occur on request/module lifecycle paths**, which is convenient but not ideal for production hardening.
5. **The system is already using several cross-cutting concerns** (auth, progress, scoring, leaderboard, cache) that will need stricter contracts as the app grows.

## Architecture overview

### High-level shape

```text
Client
  -> NestJS HTTP API (/api)
      -> Global Clerk auth guard
      -> Gameplay / Diagnostics / Analytics / Auth controllers
      -> Prisma + PostgreSQL
      -> Redis cache / rate limiting
      -> OpenAI embeddings (optional)
      -> In-process event pipeline for post-game processing
```

### Main runtime responsibilities

- **Authentication**: verify Clerk JWTs, hydrate `request.user`, sync local user records.
- **Session management**: create a daily game session, serve clue-scoped case data, accept guesses.
- **Evaluation**: normalize the guess, retrieve candidate diagnoses, compute score/signals, label result.
- **Persistence**: store attempts, session state, leaderboard entries, user stats/progress.
- **Progression**: award XP, update streaks, derive rank and level.
- **Analytics**: query attempt data for operational dashboards.

## Module inventory

| Module | Responsibility | Notes |
|---|---|---|
| `AuthModule` | Clerk auth and global guard | Installs `ClerkAuthGuard` as `APP_GUARD` |
| `GameplayModule` | Core game flow | Session start, guess submission, daily limit, leaderboard, XP, streak, attempts |
| `DiagnosticsModule` | Guess evaluation | v1/v2 evaluator engine, retrieval, fuzzy/scoring, LLM fallback |
| `CasesModule` | Case and diagnosis catalog access | Provides today case, by-date lookup, random case, diagnosis catalog |
| `UsersModule` | User sync from Clerk | Keeps local `User` rows aligned with Clerk |
| `KnowledgeModule` | Ontology/synonym knowledge | Supports semantic scoring and retrieval reranking |
| `AnalyticsModule` | Operational analytics endpoints | SQL aggregations over `Attempt` |
| `DatabaseModule` | Prisma and seeding | Prisma client lifecycle + startup seeding |
| Core cache/logger/config | Infrastructure services | Redis cache, env validation, pino logger, metrics |
| Infra embedding | Semantic embedding provider | OpenAI embeddings with timeout + fallback/mock path |

## Request lifecycle

### Bootstrap

- `main.ts` validates env, sets a global validation pipe, enables CORS, applies `/api`, and listens on `0.0.0.0`.
- `AppModule` imports all major modules and seeds cases during module init.
- `AuthModule` installs the global Clerk guard.

### Standard gameplay flow

1. Client starts a game via `POST /api/game/start`.
2. `GameSessionService` creates or reuses a session and enforces daily limit rules.
3. Client submits a guess via `POST /api/game/guess`.
4. Guess is normalized and evaluated.
5. Result, score, clue progression, and signals are persisted.
6. On completion, an in-process game-completed event triggers post-game processing.
7. XP, streak, and leaderboard state are updated.
8. Frontend reads session state or progress as needed.

## Auth and identity

### Implementation

- Clerk JWT verification is encapsulated in `ClerkJwtService`.
- `ClerkAuthGuard` is installed globally, so most routes are protected by default.
- `AuthController /me` returns Clerk identity plus derived progress.
- `UserSyncService` keeps a local `User` row in sync with Clerk users.

### Strengths

- Centralized auth policy.
- Simple `request.user` contract for downstream services.
- Local user records support gameplay progress and analytics without depending on Clerk at query time.

### Risks

- `GET /auth/me` has side effects because it upserts user and progress records on read.
- Guard behavior depends on external Clerk availability and JWT configuration.
- Public/private route semantics should be documented more explicitly.

## Data layer

### Prisma schema highlights

Primary entities:

- `Diagnosis`
- `DiagnosisEmbedding`
- `Synonym`
- `Case`
- `DailyCase`
- `GameSession`
- `Attempt`
- `User`
- `UserProgress`
- `UserStats`
- `LeaderboardEntry`

### Notes

- PostgreSQL is the source of truth.
- `pgvector` is used for semantic retrieval.
- Several tables are indexed for lookup and ranking performance, especially `Attempt`, `GameSession`, and `LeaderboardEntry`.
- `LeaderboardEntry` has a uniqueness constraint on `(dailyCaseId, userId)`.
- `UserProgress` stores both cumulative XP and derived level fields.

### Schema concerns

- `EmbeddingService` mock embeddings return a fixed length of **384**, while the database vector column is `vector(1536)`. This is a critical compatibility risk if the mock path is used in any retrieval path.
- Several fields are derived but persisted (`level`, `xpCurrentLevel`), so consistency depends on service logic staying correct.
- `Case.date` is unique, but daily case linkage also uses `DailyCase.date`, which means the mapping layer must remain tightly synchronized.

## Gameplay flow

### Core endpoints

- `POST /api/game/start`
- `POST /api/game/guess`
- `GET /api/game/:sessionId`
- `GET /api/game/leaderboard/today`
- `GET /api/game/leaderboard/weekly`
- `GET /api/game/leaderboard/me`
- `GET /api/user/progress`

### Important services

- `GameSessionService` orchestrates session state and guess submission.
- `DailyLimitService` enforces one completed free game per UTC day.
- `AttemptService` persists guesses and signals.
- `ScoringService` converts semantic score + attempts into an integer score.
- `PostGameProcessor` reacts to completion events and updates streak, XP, and leaderboard.
- `LeaderboardService` handles ranking and cache invalidation.
- `StreakService` tracks current and best streak by UTC day.
- `XpService` derives level and per-level XP values.

### Notable behavior

- Duplicate guesses are detected within a short time window.
- Session clue progression is derived from wrong attempts rather than trusting a mutable counter alone.
- Completion is handled by an in-process event emitter, not a durable queue.

### Risks

- The event pipeline is **not durable**. A process crash after completion but before post-game processing can lose streak/XP/leaderboard updates.
- Completion handling and leaderboard updates are tightly coupled to the process lifecycle.
- Error handling around some gameplay endpoints is lenient and may hide systemic issues.

## Diagnostics and scoring stack

### Versioning

- `EvaluatorEngineService` selects `v1` or `v2` based on `EVALUATOR_VERSION`.
- `v1` uses synonym + fuzzy logic only.
- `v2` adds vector retrieval, ontology scoring, and LLM fallback for ambiguous cases.

### Pipeline

1. Preprocess guess and answer.
2. Retrieve nearest diagnoses using vector search.
3. Rerank with fuzzy and ontology signals.
4. Compute score from weighted signals.
5. If needed, invoke LLM fallback.
6. Return result label, score, normalized guess, and diagnostic signals.

### Strengths

- Good separation between retrieval, scoring, and labeling.
- Retrieval is cache-aware and can fall back when vector search fails.
- Metrics are recorded at each layer, which helps identify bottlenecks.

### Risks

- `LlmFallbackService` is currently a mock/no-op decision source; it does not yet provide real fallback intelligence.
- `RetrievalService` depends on the embedding output shape matching the pgvector column.
- `ScoreWeights` are environment-driven, which is flexible but can become unstable without config governance.
- Ontology knowledge is hard-coded and very small, so it is useful for prototypes but not a long-term knowledge base.

## Config, startup, and deployment

### Environment validation

`env.validation.ts` validates:

- database and Redis URLs
- Clerk settings
- OpenAI settings
- host/port
- logging level
- allowed origins
- embedding model
- scoring weights
- evaluator version

### Startup behavior

- `main.ts` uses a global validation pipe with whitelist, transform, and non-whitelisted rejection.
- CORS is configured centrally.
- The app binds to `0.0.0.0` and defaults to port `8080` if `PORT` is absent.
- Request logging is done with `console.log` in the bootstrap path.

### Operational concerns

- The README still reads like a generic NestJS starter in places and should be updated to reflect the real product and operational constraints.
- Seeding occurs at application startup, which is acceptable for development but should be treated carefully in production.

## Caching, rate limiting, and performance

### Redis usage

Redis is used for:

- request rate limiting
- leaderboard caching
- retrieval caching
- embedding caching

### Rate limiting

`RateLimitGuard` limits requests per user/IP/method/path combination to 60 requests per minute.

### Leaderboard cache

- Daily leaderboard cache key includes date and limit.
- Weekly leaderboard cache key includes rolling-week date and limit.
- Cache invalidation occurs after leaderboard upserts.

### Strengths

- Clear caching strategy for expensive read paths.
- Leaderboards are protected from repeated full-table scans during heavy read traffic.

### Risks

- Redis errors are often swallowed or reduced to safe defaults, which improves resilience but can mask outages.
- Cache invalidation is prefix-based and may become expensive as traffic scales.
- The rate limit guard is simple and effective, but it is not a full abuse-prevention strategy on its own.

## Analytics

### Endpoints

- `GET /api/analytics/top-wrong`
- `GET /api/analytics/accuracy`
- `GET /api/analytics/signals`
- `GET /api/analytics/fallback-rate`
- `GET /api/analytics/attempts-over-time`
- `GET /api/analytics/dashboard`

### Observations

- Analytics uses raw SQL for aggregation and therefore bypasses most ORM abstractions.
- This is appropriate for dashboards, but the queries should be monitored as the attempt table grows.
- Metrics and logs are emitted for query latency and failures.

## Integrations

### Clerk

Used for authentication and identity sync.

### OpenAI

Used for embeddings when an API key is present.

### PostgreSQL / pgvector

Source of truth and semantic search.

### Redis

Cache and rate limiting.

## Scalability assessment

### What scales well today

- Modular NestJS boundaries.
- Prisma schema with indexes on key query paths.
- Redis-backed cache for hot leaderboard and retrieval reads.
- Separate analytics queries instead of embedding reporting into gameplay paths.

### Scaling bottlenecks

1. **In-process event processing** for completions.
2. **Hard-coded or small knowledge bases** in ontology/synonym services.
3. **Potential vector dimension mismatch** if the embedding fallback path is used.
4. **Raw SQL dashboard queries** on growing attempt volume.
5. **Startup seeding** and read-side upserts that can create hidden write load.

### Horizontal scaling notes

- Stateless HTTP routes should scale reasonably.
- The event emitter and any cached in-memory state do not scale across processes.
- Redis is already a key dependency, so multi-instance deployment should keep Redis highly available.

## Risks and gaps

### Critical

- **Mock embedding dimension mismatch** with the `vector(1536)` column.
- **Non-durable completion pipeline**.
- **Potentially hidden auth/progress writes** on read endpoints.

### High

- **Swallowed errors** in leaderboard and cache paths.
- **Generic startup request logging** via `console.log`.
- **Generic README and product documentation drift**.

### Medium

- **Small ontology / synonym coverage**.
- **Config-driven scoring without governance**.
- **Tight coupling between gameplay, ranking, and post-game update logic**.

## Prioritized recommendations

### 1. Make post-game processing durable

Move completion processing from in-memory events to a durable queue or job system. This would protect XP, streak, and leaderboard updates from process loss and make retries explicit.

### 2. Fix embedding compatibility

Ensure the fallback/mock embedding path produces the same dimensionality as the pgvector column, or disable retrieval when the provider is unavailable.

### 3. Separate reads from writes in auth/progress flows

Avoid upserting user and progress records inside `GET /auth/me`. Introduce an explicit sync path or perform bootstrap writes at login/session initialization.

### 4. Strengthen operational telemetry

Expose metrics via a standard endpoint or exporter, and replace ad hoc `console.log` startup request tracing with structured logging.

### 5. Harden error handling semantics

Return explicit degraded-mode responses where appropriate rather than empty arrays or silent fallbacks, especially for leaderboard and analytics consumers.

### 6. Expand knowledge sources

Replace hard-coded ontology/synonym maps with a maintained dataset or admin workflow.

### 7. Update documentation

Bring the README in line with the actual product architecture, env requirements, startup behavior, and deployment model.

### 8. Add integration tests around completion and ranking

Cover the full chain:

- guess submission
- attempt persistence
- completion event emission
- streak update
- XP award
- leaderboard write
- cache invalidation

## Conclusion

The backend is already well-structured enough to support the current game, and the separation between gameplay, diagnostics, and analytics is a strong foundation. The main next step is not major rewrites, but **hardening the completion pipeline, eliminating the embedding mismatch risk, and improving production observability and documentation**.
