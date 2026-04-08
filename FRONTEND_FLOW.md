# Project Overview

- This repo has two frontend apps:
  - `doctordle-game`: the player-facing "Wardle" daily diagnosis game.
  - `analytics-dashboard`: an internal dashboard for gameplay metrics.
- The main product flow lives in `doctordle-game`.
- Core concept: a signed-in user gets one daily medical case, submits diagnosis guesses, receives graded feedback (`correct` / `close` / `wrong`), unlocks more clues after wrong guesses, and ends on a scored outcome with progress and leaderboard updates.

# Folder Structure

```text
DxLab/
|- doctordle-game/                # Main game frontend (React + Vite)
|  |- src/
|  |  |- main.tsx                 # App bootstrap, Clerk, React Query, error boundary
|  |  |- app/                     # Entry shell, animated auth/loading screens
|  |  |- pages/                   # Top-level screens: GamePage, ExplanationPage
|  |  |- features/
|  |  |  |- game/                 # Game state, API layer, keyboard, progress UI
|  |  |  |- leaderboard/          # Leaderboard fetching and rendering
|  |  |  |- user-progress/        # XP, streak, rank fetching and reward effects
|  |  |  |- share/                # Share text helpers
|  |  |- components/              # Reusable UI pieces like CaseCard, BottomSheet
|  |  |- layout/                  # Header and layout wrappers
|  |  |- lib/                     # Authenticated API client
|  |- vite.config.ts
|
|- analytics-dashboard/           # Separate internal analytics frontend
|  |- src/
|  |  |- main.tsx                 # Simple bootstrap
|  |  |- App.tsx                  # Single-screen dashboard entry
|  |  |- components/              # Dashboard cards and charts
|  |  |- services/analytics.api.ts# Fetch layer for analytics endpoints
|
|- doctordle-backend/             # Backend API used by the frontends
|- docs/                          # Product and architecture notes
```

# Architecture

## Core pages / screen entry points

- `doctordle-game`
  - `App.tsx`: top-level auth gate, not a route in the React Router sense.
  - `GamePage.tsx`: the main authenticated gameplay screen.
  - `ExplanationPage.tsx`: secondary educational screen, currently mounted inside a bottom sheet rather than navigated by URL.
  - `LandingScreen.tsx`: signed-out marketing / entry screen.
  - `AuthLoadingScreen.tsx`: initial auth/bootstrap screen.
- `analytics-dashboard`
  - `App.tsx` -> `Dashboard.tsx`: a single-screen internal dashboard with no client-side routing.

## Component hierarchy

```text
main.tsx
-> ClerkProvider
-> QueryClientProvider
-> AppErrorBoundary
-> App
   -> AuthLoadingScreen | LandingScreen | GamePage

GamePage
-> AppHeader
-> ProgressSection
-> GamePlaySection
   -> CaseCard
-> GameKeyboard
-> FloatingReward
-> BottomSheet
   -> LeaderboardSection
   -> ExplanationPage
   -> menu / how-to panels
```

## Separation of concerns

- App shell:
  - `src/main.tsx` provides platform concerns: auth, query cache, error boundary.
  - `src/app/App.tsx` decides which top-level screen to show based on Clerk auth state.
- Game orchestration:
  - `src/pages/GamePage.tsx` is the main composition root. It owns sheet visibility, leaderboard mode, countdown display, and wires hooks to UI.
- Domain state:
  - `src/features/game/useGameSession.ts` owns the live session state: `sessionId`, `caseData`, `guess`, `result`, attempt labels, loading, and submission.
  - `src/features/game/useGameFlow.ts` adds a reducer-based UI state machine on top of session data: `PLAYING -> SUBMITTING -> FINAL_FEEDBACK -> WAITING`.
- Data services:
  - `src/lib/api.ts` centralizes authenticated fetch requests.
  - `src/features/game/game.api.ts` maps frontend calls to backend endpoints.
- Read models:
  - `src/features/user-progress/useUserProgress.ts` and `src/features/leaderboard/leaderboard.hook.ts` use React Query for server-backed read state.
- Presentation:
  - `CaseCard`, `ProgressSection`, `LeaderboardSection`, `BottomSheet`, `AppHeader`, and the animated auth components are mostly presentational.

## Shared components

- Reused UI shell pieces:
  - `components/ui/BottomSheet.tsx`
  - `layout/AppHeader.tsx`
  - `app/components/AnimatedScreen.tsx`
  - `app/components/AnimatedContainer.tsx`
  - `app/components/AppErrorBoundary.tsx`
- Reused domain-presentational pieces:
  - `components/CaseCard.tsx`
  - `components/FeedbackPanel.tsx`
  - `components/GuessInput.tsx` (currently not part of the active gameplay path)

# Game Flow

## Step-by-step user journey

1. App boot:
   - `main.tsx` mounts the app with Clerk auth, React Query, and an error boundary.
2. Entry decision:
   - `App.tsx` shows:
     - `AuthLoadingScreen` while Clerk loads,
     - `LandingScreen` if signed out,
     - `GamePage` if signed in.
3. Session start:
   - `useGameSession` runs once after auth is ready and calls `POST /game/start`.
   - Response seeds `sessionId`, the initial case history, and current symptoms.
4. Initial render:
   - `GamePage` shows `ProgressSection`, `CaseCard`, the current guess preview, and `GameKeyboard`.
5. Interaction:
   - User types through `GameKeyboard`, which updates `guess` in `useGameSession`.
   - Submit triggers `useGameFlow.submitGuess()`, which delegates to `useGameSession.submitGuess()`.
6. Guess evaluation:
   - `POST /game/guess` returns score, label, game-over flags, optional explanation, and possibly updated case data.
   - Wrong guesses can return a case payload with more revealed symptoms.
7. UI update:
   - `useGameSession` updates `result`, appends to `attemptLabels`, updates `caseData`, clears the input, and invalidates `progress` and `leaderboard`.
   - `useUserProgress` reacts to XP changes and emits a floating reward event.
8. Terminal outcome:
   - `useGameFlow` treats a correct answer or exhausted clues as a final result and moves to `FINAL_FEEDBACK`.
   - Explanation content becomes available and can be opened in a bottom sheet.
9. Next case:
   - The reducer has a `WAITING` state with a countdown to the next UTC day.
   - In the current code, the intended `FINAL_FEEDBACK -> WAITING -> next case` path exists in the reducer, but the UI does not fully render that path yet.

## Load -> gameplay -> result -> next case

- Load:
  - Clerk resolves auth.
  - `useGameSession` creates or resumes today's playable session.
- Gameplay:
  - Case history is always shown.
  - Symptoms are progressively revealed from backend responses.
  - Input is handled locally in React state.
- Result:
  - Backend returns the authoritative score/result.
  - Frontend refreshes progress and leaderboard reads.
  - Explanation becomes available only after terminal outcomes.
- Next case:
  - The reducer supports a waiting countdown until the next UTC case.
  - The actual re-start logic for a fresh case is not fully connected in the current UI.

# Key Components

## `CaseCard`

- Responsibility:
  - Renders the active case history and up to six symptom slots.
  - Handles loading, empty, and error states.
  - Enables the "Details" action once explanation data exists.
- Interactions:
  - Receives `caseData`, loading, and error from `GamePage` through `GamePlaySection`.
  - Reflects clue progression by rendering the updated `caseData.symptoms` returned from the backend.

## `GamePlaySection`

- Responsibility:
  - Currently a very thin wrapper around `CaseCard`.
- Interactions:
  - Receives more props than it uses (`finalResult`, `streak`, `onContinue`, `onWhy`), which suggests it was intended to host richer gameplay and result UI.

## Other important pieces

- `GamePage`:
  - The real screen orchestrator.
  - Combines game session state, flow state, progress, leaderboard, keyboard input, and bottom sheets.
- `useGameSession`:
  - The core frontend domain hook.
  - Owns mutable gameplay state and API writes.
- `useGameFlow`:
  - A reducer-based finite state machine for interaction timing and post-submit transitions.
- `GameKeyboard`:
  - Handles both on-screen keyboard input and physical keyboard events.
- `ProgressSection`:
  - Displays streak, rank, XP progress, and the leaderboard entry point.
- `LeaderboardSection`:
  - Displays server-backed daily/weekly rankings inside a bottom sheet.
- `ExplanationPage`:
  - Shows diagnosis summary, reasoning, and deeper educational content after a case ends.

# Data Flow

## API -> state -> UI -> feedback

1. Auth token:
   - `useApi()` gets a Clerk JWT and adds it to every request.
2. Session creation:
   - `startGameApi()` -> `useGameSession` local state (`sessionId`, `caseData`, `requestState`).
3. Gameplay mutation:
   - `submitGuessApi()` -> `useGameSession` updates `result`, `attemptLabels`, and `caseData`.
4. Dependent refreshes:
   - After submit, `useGameSession` invalidates React Query caches for `['leaderboard']` and `['progress']`.
5. Read models:
   - `useUserProgress` refetches progress and derives XP gain / reward animation.
   - `useLeaderboard` refetches ranking data for the selected mode.
6. Presentation:
   - `GamePage` passes session state into `CaseCard`, `GameKeyboard`, progress widgets, and bottom sheets.
7. Feedback loop:
   - Backend is authoritative for clue reveal, score, terminal state, and explanation.
   - Frontend is responsible for input capture, transient UI states, animation, and post-submit transitions.

## State management summary

- Local component state:
  - Sheet visibility, leaderboard mode, countdown clock.
- Custom hooks with local React state:
  - `useGameSession` for the active game.
- Reducer state machine:
  - `useGameFlow` for interaction phases.
- React Query:
  - Progress and leaderboard reads.
- Clerk context:
  - Authentication and token retrieval.

# Observations

## Strengths

- Clean layering: API client, feature hooks, and UI components are separated reasonably well.
- Good use of React Query for server-backed read models like progress and leaderboard.
- Auth gating is simple and explicit.
- `useGameFlow` adds a clear state-machine mindset instead of scattering submit-phase flags everywhere.
- Backend remains the source of truth for clue progression and scoring, which keeps gameplay rules centralized.

## Weaknesses

- There is no real route system; "pages" are conditional screens and bottom sheets, so navigation is state-driven rather than URL-driven.
- `GamePage` is the real god component. It owns screen orchestration, sheets, countdowns, keyboard wiring, and feature composition.
- `GamePlaySection` is under-utilized and currently acts as a pass-through wrapper.
- Several components appear unused or partially integrated (`GuessInput`, `FooterInput`, `MobileLayout`, `ResultPanel`, `AttemptList`, `FeedbackSection`, `StreakBadge`, share helpers), which suggests UI drift.
- The terminal loop is incomplete:
  - `useGameFlow` can enter `FINAL_FEEDBACK`, but `GamePlaySection` does not render the final-result props or a continue action.
  - The reducer supports `WAITING`, but `useGameSession` does not clearly reinitialize a fresh session when the next case becomes available.

## Potential improvements

- Move gameplay screen composition into a clearer container/presenter split:
  - Example: `GamePage` as orchestration, `GamePlaySection` as the actual interactive screen.
- Finish or simplify the state machine:
  - Either fully wire `FINAL_FEEDBACK` and `WAITING`, or collapse unused states.
- Consolidate unused components and dead paths to reduce maintenance noise.
- Consider using a route layer if explanation, leaderboard, or future multi-screen flows need deep links.
- Standardize state ownership:
  - Either keep gameplay in local hooks by design, or migrate it to a single query/mutation-driven session model for easier refresh/recovery behavior.
- Add a deliberate "next case" re-fetch/reset path so the daily rollover works without a full page reload.
