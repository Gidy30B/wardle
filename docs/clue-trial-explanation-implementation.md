# Doctordle Clue + Trial-End + Explanation Implementation Summary

## Scope Delivered

- Reveal clues one symptom at a time on explicit user action (`Show clue` button).
- Reveal all clues when the user answers correctly.
- End the trial when the user is already at max clue depth and submits a wrong answer.
- Add an info icon that opens a dedicated explanation page.
- Keep the existing `/api/game/*` architecture intact (no route removals or breaking controller changes).

## Backend Changes

### 1) Terminal outcome rules in gameplay service

File: `doctordle-backend/src/modules/gameplay/game-session.service.ts`

- Updated `submitDailyGuess` terminal-state logic:
  - **Correct answer**:
    - Sets next clue index to max (all clues visible).
    - Marks session as completed (`status='completed'`, `completedAt` set).
    - Emits `game.completed` event as before.
  - **Wrong answer with clues exhausted**:
    - Detects `clueIndex >= maxClueIndex`.
    - Marks session as completed to hard-end the trial.
    - Does **not** emit `game.completed` event (avoids awarding completion-based postgame outcomes for failed runs).

### 2) Case payload expanded safely

- `buildCasePayloadByClueIndex` now also includes `allSymptoms` while preserving existing `symptoms` behavior.
- This allows frontend local reveal controls without changing clue derivation rules on the server.

### 3) Case explanation payload

- Added `buildCaseExplanation(...)` helper and returned explanation on terminal outcomes.
- Explanation payload includes:
  - `diagnosis`
  - `difficulty`
  - `summary`
  - `reasoning[]`

## Frontend Changes

### 1) Type and API contract updates

Files:
- `doctordle-game/src/features/game/game.types.ts`
- `doctordle-game/src/features/game/game.api.ts`

- Extended response models with:
  - `gameOver`
  - `gameOverReason`
  - `explanation`
  - optional `case` in guess responses
  - optional `allSymptoms` in case payload

### 2) Hook behavior for clues + terminal sessions

File: `doctordle-game/src/features/game/game.hooks.ts`

- Added local clue reveal state (`revealedSymptomsCount`).
- Added `showClue()` to reveal one additional symptom per click.
- On guess response:
  - syncs `caseData` from backend response if present,
  - reveals all symptoms when `gameOver` is true,
  - blocks further submissions when game is over.

### 3) UI integration

Files:
- `doctordle-game/src/components/CaseCard.tsx`
- `doctordle-game/src/components/GuessInput.tsx`
- `doctordle-game/src/components/FeedbackPanel.tsx`
- `doctordle-game/src/pages/GamePage.tsx`
- `doctordle-game/src/pages/ExplanationPage.tsx` (new)

- Added `Show clue` button and clue progress display.
- Added **info icon** on case card (`i`) that becomes active when explanation exists.
- Added dedicated `ExplanationPage` view with summary and reasoning, plus back navigation.
- Input submit button now clearly indicates terminal state (`Trial ended`) rather than loading state.

## Architecture Safety

- Existing route surface remains compatible:
  - `POST /api/game/start`
  - `POST /api/game/guess`
  - `GET /api/game/:sessionId`
  - other existing endpoints unchanged
- No breaking controller signature changes.
- Added response fields are additive and backward-compatible for existing consumers.

## Verification

Build validation completed successfully:

- `doctordle-game`: `npm.cmd run build` ✅
- `doctordle-backend`: `npm.cmd run build` ✅
