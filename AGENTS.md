# AGENTS.md

## Purpose
This repository contains a hybrid React + Phaser gameplay architecture for Wardle.

Agents working in this codebase must preserve the intended ownership boundary:

- React/domain layer owns canonical round/session state, API calls, auth/session bootstrap, websocket/session sync, and non-round companion UI.
- Phaser owns the full visible live-round gameplay surface, including layout, pointer/hardware input handling, animation, and transient visual presentation.

Do not collapse these responsibilities into one layer.

---

## Core architecture rules

### 1. Canonical truth
Canonical truth for round/session state must live outside Phaser.

Examples:
- current case/session
- visible clue progression
- current guess
- submit lifecycle
- correctness/finality
- explanation availability
- reward intake from server/websocket
- waiting/blocked states

Phaser may mirror and present this data, but must not become the source of truth.

---

### 2. Phaser responsibilities
Phaser should own the active round gameplay experience:
- HUD
- clue presentation
- diagnosis input surface
- custom keyboard
- action row
- feedback animations
- final round overlays
- reward presentation
- gameplay transitions

Phaser should feel like the game, not like a decorative canvas.

---

### 3. React responsibilities
React should continue owning:
- route shell
- auth/session bootstrap
- API orchestration
- websocket/session sync
- explanation sheet
- leaderboard sheet
- menu / how-to / product UI

Do not move these into Phaser unless there is a very strong reason.

---

### 4. View-model contract
React -> Phaser communication must go through one explicit typed view model.

Use a dedicated model such as:
- `RoundViewModel`
or
- `PlaySessionViewModel`

Do not assemble gameplay bridge data ad hoc inside leaf presentation components.

Create or maintain a dedicated builder function close to the gameplay engine/domain layer.

---

### 5. Intent contract
Phaser -> React communication must go through typed intents only.

Examples:
- type letter
- insert space
- backspace
- clear guess
- submit guess
- continue
- open explanation
- open menu
- reload

Do not make Phaser directly call API functions or mutate domain state outside the approved intent path.

---

### 6. Input ownership
Input ownership for the active round must be singular and explicit.

Preferred rule:
- Phaser custom keyboard + Phaser hardware keyboard handling are the primary live-round input system.

Avoid:
- duplicate DOM input paths
- shadow text-entry state
- mixed React/Phaser keyboard ownership

If a DOM input fallback is required for a specific platform reason, it must be:
- minimal
- documented
- clearly subordinate to the main interaction model

---

### 7. Scene design
Prefer a modular single-scene design over a giant monolithic scene file.

Recommended internal structure:
- `RoundScene`
- `HudLayer`
- `CluePanel`
- `DiagnosisBar`
- `ActionRow`
- `KeyboardPanel`
- `FeedbackLayer`
- `RewardLayer`
- `OverlayLayer`

These modules should:
- render from the current view model
- relayout from scene metrics
- own visual-only/transient presentation logic
- avoid becoming mini state stores

---

### 8. Full loop mindset
All gameplay work should reinforce the round loop:

- load case
- intro
- play
- submit
- receive result
- reveal next clue or finish
- reward
- explanation / continue
- wait for next case or next round

Do not build isolated UI widgets that ignore the loop.

---

### 9. Animation and gamefeel
Use Phaser-native polish intentionally:
- tweens
- time events
- grouped container transitions
- subtle camera emphasis only when justified

Avoid:
- long blocking animations
- noisy particle spam
- effects that hurt readability
- “overdesigned” motion

Wardle should feel tight, fast, and premium.

---

### 10. Layout and scaling
Respect the current hybrid sizing reality:
- React owns parent container bounds
- Phaser owns gameplay canvas behavior and in-scene layout

When changing layout/scaling:
- avoid casual changes to both CSS and camera/scale logic in the same pass
- test mobile and desktop
- keep canvas sharpness and interaction bounds aligned

---

## Editing guidance

### Safe kinds of changes
- introducing a formal round view model
- moving bridge derivation closer to the domain layer
- modularizing scene rendering
- consolidating input handling
- polishing reveal/submit/result transitions
- cleaning obsolete legacy gameplay paths

### Risky kinds of changes
- moving canonical state into Phaser
- adding another state store
- splitting logic across both React and Phaser without a clear owner
- mixing DOM input and Phaser input casually
- rewriting resize/scaling without testing the current pipeline
- changing API contracts during UI refactors unless necessary

---

## Output expectations for agents
When making gameplay architecture changes, always report:
1. what ownership/boundary was preserved
2. what moved and why
3. whether input ownership changed
4. whether the React -> Phaser contract changed
5. whether scene modules were added or removed
6. any unresolved risks

Keep explanations factual and code-grounded.

---

## Definition of success
A successful gameplay refactor in this repo should make the product feel more like a cohesive game loop while making the architecture easier to reason about.

Target result:
- React is the game brain
- Phaser is the game body
- companion product surfaces remain in React