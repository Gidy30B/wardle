# Doctordle – Current Game System (As Implemented)

## 1. Core Playable Flow

### Frontend flow (current)
1. User signs in via Clerk (`SignedIn` in app shell).
2. `useGame` initializes exactly once after `isLoaded && isSignedIn`.
3. Frontend calls `POST /api/game/start`.
4. Backend returns:
   - `sessionId`
   - `dailyCaseId`
   - `clueIndex` (starts at `0`)
   - `attemptsCount` (starts at `0`)
  - `case` payload (history + clue-scoped symptoms)
5. User submits guess to `POST /api/game/guess`.
6. Backend evaluates and returns result, score, clue index, updated case payload, terminal state, and optional explanation.
7. On wrong guesses, the next clue appears automatically from backend progression logic.

## 2. API Surface (Current)

### Active gameplay endpoints
- `POST /api/game/start`
- `POST /api/game/guess`
- `GET /api/game/:sessionId`
- `GET /api/game/leaderboard/today?limit=`
- `GET /api/game/leaderboard/weekly?limit=`
- `GET /api/user/progress`

### Notes
- There is no active gameplay controller exposing `GET /api/case/today` or `POST /api/guess` in current module wiring.
- Auth is enforced globally by Clerk guard, and gameplay/user endpoints also use `RateLimitGuard`.

## 3. Session Lifecycle

### Creation (`startGame` -> `startDailyGame`)
- `GameController.startGame` calls `GameSessionService.startGame`, which delegates to daily flow.
- In Serializable transaction:
  - user is upserted,
  - free-tier daily limit is checked,
  - `DailyCase` is resolved by UTC date (created if missing by random `Case` selection),
  - `GameSession` is created with required links:
    - `caseId`
    - `dailyCaseId`
    - `userId`
    - `status='active'`
- Session status is cached in Redis (`game-session:{sessionId}`).

### Completion paths
- Session starts as `active`.
- Session is transitioned to `completed` in `submitDailyGuess` via `updateMany(where id + status='active')`.
- Completion occurs in two cases:
  1. guess is correct,
  2. guess is wrong when clues are exhausted.

## 4. Guessing, Clues, and Trial End Rules

### Duplicate suppression
- Duplicate window: `5000ms`.
- Key criteria: same `sessionId` + same `normalizedGuess` + recent `createdAt`.
- Duplicate response returns prior result/score and `duplicate: true`.

### Derived clue index (backend)
- `maxClueIndex = 2`.
- Derived from wrong attempts count: `min(maxClueIndex, wrongAttempts)`.

### Case payload by clue index (backend)
- `clueIndex <= 0`: `symptoms: []`
- `clueIndex === 1`: first symptom only
- `clueIndex >= 2`: all symptoms
- Payload never includes future clues beyond the current clue scope.

### Terminal rules (backend authoritative)
- **Correct answer**:
  - marks session completed,
  - forces clue index to max (all clues),
  - emits `game.completed` event,
  - returns `gameOver: true`, `gameOverReason: 'correct'`, and explanation.
- **Wrong answer with clues exhausted** (`clueIndex >= maxClueIndex` before evaluation):
  - marks session completed,
  - returns `gameOver: true`, `gameOverReason: 'clues_exhausted'`, and explanation,
  - does **not** emit `game.completed` event.
- **Wrong answer with clues remaining**:
  - increments clue index,
  - keeps session active,
  - returns `gameOver: false`.

## 5. Frontend Clue/Explanation UX

### Clue reveal UX
- There is no manual clue reveal control.
- `useGame` renders `response.case.symptoms` directly.
- New clues appear only after wrong attempts as determined by backend clue index progression.

### Guess input UX
- Guess submit is blocked when `gameOver` is true.
- Input/button disabled state reflects loading and game-over status.
- Button label switches to `Trial ended` after terminal outcome.

### Explanation UX
- Backend returns explanation only on terminal outcomes.
- Premium users receive advanced explanation fields (`deepDive`, `pitfalls`) in terminal responses.
- Case card info icon (`i`) is enabled only when explanation exists.
- Clicking icon opens dedicated explanation view (`ExplanationPage`) with:
  - diagnosis title,
  - summary,
  - reasoning bullets,
  - premium-only advanced sections when present,
  - back action to return to game view.

## 6. Scoring

### Current score computation path
- `POST /api/game/guess` uses `ScoringService.compute`.
- Logic:
  - semantic score clamped to `[0,1]` then scaled to 100,
  - difficulty multipliers: `easy 0.8`, `medium 1.0`, `hard 1.3`,
  - correct-answer penalty by attempts: `(attempts-1) * 15`,
  - first-attempt bonus: `+20`,
  - capped/floored to `[10,100]`.
- For incorrect guesses, returns rounded base with floor of 10.

## 7. Limits, Auth, and Rate Limiting

### Auth
- Global Clerk guard validates JWT (`iss`, `aud`, signature, exp/nbf) and resolves local user.
- Controllers consume `req.user.id` as canonical user id.

### Daily free-tier limit
- Enforced inside transaction via `DailyLimitService.assertCanStartInTransaction`.
- Free users blocked when completed sessions for UTC day >= 1.
- Premium users bypass this check (`subscriptionTier` normalized case-insensitively).

### Weekly leaderboard
- `GET /api/game/leaderboard/weekly?limit=` returns top entries for rolling last 7 days.
- Uses same ordering semantics as daily leaderboard (score desc, attempts asc, completedAt asc).
- Cached in Redis and invalidated on leaderboard updates.

### Rate limiting
- `RateLimitGuard` key: `rate:${userId}:${ip}:${method}:${routePath}`.
- Window: 60s, max 60 requests per key.

## 8. Events and Postgame Processing

### Emission
- `GameEventsService.emitGameCompleted` emits asynchronously via `setImmediate`.
- Event payload includes:
  - `sessionId`, `userId`, `dailyCaseId`, `difficulty`, `score`, `attemptsCount`, `completedAt`.

### Consumer
- `PostGameProcessor` subscribes on module init.
- On `game.completed`:
  1. updates streak,
  2. awards XP,
  3. upserts leaderboard entry.
- Errors are caught/logged and do not fail request path.

## 9. Data Model Snapshot (Prisma)

### `GameSession` (current)
- Required fields: `caseId`, `userId`, `dailyCaseId`, `status`, `startedAt`.
- Optional fields include `completedAt`, `userTierAtStart`, `xpAwardedAt`, legacy clue index column.
- Relations: `case`, `user`, `dailyCase`, `attempts`.

### `Attempt`
- Stores guess audit including normalized guess, score, result, evaluator metadata, clue index at attempt, timestamps.

### `DailyCase`
- One row per UTC date (`date` unique, `@db.Date`).
- Related to `Case`, `GameSession`, and leaderboard entries.

### `LeaderboardEntry`
- Unique by `(dailyCaseId, userId)`.
- Ordering semantics use score desc, attempts asc, completion time asc.

## 10. Known Caveats (Current)

1. Duplicate-guess short-circuit response currently returns result/score/clue metadata but does not include a refreshed case payload.
2. Daily free-tier limit counts only completed sessions; clue-exhausted losses mark sessions completed, so they consume the daily free attempt.
