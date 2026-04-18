# INSTRUCTIONS.md

## Goal
Implement gameplay changes in Wardle with a production-grade React + Phaser boundary.

This file gives execution instructions for contributors and coding agents working on the live gameplay loop.

---

## Current strategic direction
The intended direction is:

- React/domain layer remains canonical owner of round/session state and async/server truth
- Phaser becomes the complete live gameplay surface
- the React↔Phaser bridge is upgraded into a formal typed round view model
- gameplay input ownership becomes singular and explicit
- the round experience is treated as a full game loop, not a collection of unrelated widgets

---

## Mandatory implementation constraints

### 1. Preserve ownership boundary
React keeps:
- auth/session bootstrap
- API calls
- websocket sync
- explanation / leaderboard / shell UI
- canonical round/session state

Phaser keeps:
- round HUD
- clue panel
- diagnosis input surface
- custom keyboard
- action row
- transitions
- feedback layers
- overlays
- reward visuals

---

### 2. Use a dedicated round view model
All React -> Phaser gameplay data should flow through a single typed model.

Prefer:
- `RoundViewModel`
- `buildRoundViewModel()`

This builder should live near the gameplay engine/domain layer.

Do not build scene snapshots ad hoc in a leaf mount component unless there is a very small and temporary reason.

---

### 3. Use typed intents back to React
All Phaser -> React communication should go through typed gameplay intents.

Do not:
- call API functions directly from scene modules
- mutate canonical state from Phaser
- bypass the approved intent layer

---

### 4. Treat input ownership as a design decision
Phaser should be the primary active owner of live-round input.

When editing input logic:
- check custom keyboard flow
- check hardware keyboard flow
- check any hidden DOM input remnants
- remove ambiguity where safe

Input should feel singular to the user.

---

### 5. Scene modularization preferred
Do not keep expanding one giant gameplay scene file indefinitely.

Prefer modular internal structure:
- `RoundScene`
- `HudLayer`
- `CluePanel`
- `DiagnosisBar`
- `ActionRow`
- `KeyboardPanel`
- `FeedbackLayer`
- `RewardLayer`
- `OverlayLayer`

Modules should be presentation-oriented, not new sources of truth.

---

## Recommended work order

### Step 1 — verify before editing
Before making architecture changes, verify in code:
- current canonical state owner
- current bridge model
- current intent contract
- current input path
- current submit/result/reward flow
- current waiting/final states

Do not assume.

---

### Step 2 — extract view model
Create or refine:
- `RoundViewModel`
- `buildRoundViewModel()`

Move bridge derivation out of leaf UI assembly.

Aim for a contract that is:
- typed
- explicit
- audit-friendly
- rich enough for the scene
- not bloated with unrelated product data

---

### Step 3 — modularize scene
Refactor the gameplay scene into focused modules.

Each module should ideally support:
- `render(viewModel)`
- `relayout(metrics)`
- `destroy()`

If animations are stateful, keep that state purely visual and local.

---

### Step 4 — unify input
Consolidate:
- letter typing
- spacing
- clear
- backspace/delete
- submit

Ensure these flow through one consistent intent contract.

If a DOM fallback remains, document why.

---

### Step 5 — improve loop clarity
Gameplay should feel like a complete loop.

Important moments:
- round intro
- clue reveal
- submit
- result
- solved/fail transition
- reward presentation
- explanation/continue affordance
- waiting/blocked state handling

Transitions should reinforce these moments without slowing the game down.

---

### Step 6 — cleanup
After functional changes:
- remove dead or misleading gameplay UI paths if clearly obsolete
- improve naming
- leave comments only where ownership or non-obvious reasoning matters
- avoid over-commenting trivial code

---

## Quality standards

### Code quality
- strongly typed
- minimal duplication
- clear ownership
- readable naming
- small focused modules
- no speculative architecture

### UX quality
- fast
- responsive
- readable
- mobile-friendly
- desktop-friendly
- premium but restrained

### Architecture quality
- one canonical state owner
- one clear bridge model
- one primary input owner
- one coherent round loop

---

## Red flags
Stop and reassess if a change introduces:
- another gameplay state store
- duplicated input handling
- Phaser-side correctness logic
- mixed React/Phaser ownership without a documented reason
- scene modules that start managing domain state
- layout changes that break sharpness or input alignment

---

## What good output looks like
After a gameplay refactor, the repository should make it obvious that:

- React owns game truth
- Phaser owns game presentation and interaction
- the bridge between them is explicit
- the round loop is coherent
- the user is playing a game, not navigating a form

---

## Suggested commit grouping
Prefer small commits along these lines:
1. extract round view model + bridge typing
2. modularize scene structure
3. unify input ownership
4. improve transitions and loop presentation
5. cleanup dead legacy paths