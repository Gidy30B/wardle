# Frontend Editorial UI Spec

## Objective

Define the expected product quality for the admin/editorial interface so implementation stays polished and consistent.

---

## Design Intent

The admin UI should feel:
- operational
- trustworthy
- clear
- fast to scan
- decisive
- aligned with the current admin shell

It should not feel like:
- an internal debug screen
- a raw JSON browser
- a temporary MVP
- a collection of disconnected tools

---

## Core Screens

### 1. Dashboard

#### Must communicate
- how many cases are in each editorial state
- how validation is performing
- whether publishing has healthy supply

#### Recommended structure
- top summary cards
- secondary grouped cards/panels for validation and publish health
- good empty/loading/error states

#### UX goals
- fast understanding in under 10 seconds
- obvious anomalies (e.g. many NEEDS_EDIT or no publishable cases)

---

### 2. Editorial Queue

#### Must communicate per row
- what case this is
- where it is in the editorial pipeline
- whether validation is healthy
- what should happen next

#### Expected UI features
- queue filter
- editorial status filter
- pagination
- stable sorting
- clickable row or clear action affordance
- readable status badges

#### UX goals
- admin should scan many rows quickly
- no ambiguity between review queue and publish queue intent

---

### 3. Case Detail

#### Sections
1. Case content
2. Editorial metadata
3. Validation
4. Review
5. Revision history
6. Actions

#### Case content section
Should clearly present:
- title
- diagnosis
- difficulty
- history
- symptoms/clues
- differentials/explanation if available

#### Validation section
Should present:
- outcome
- validator version if available
- summary/findings in structured form where possible

#### Review section
Should present:
- latest decision
- notes
- approval metadata

#### Revision history
Should present:
- revision identity/order
- source
- created timestamp
- restore action

#### Action area
Must include:
- rerun validation
- start review
- approve/reject
- restore revision
- mark ready to publish

#### UX goals
- scannable
- action-oriented
- no clutter
- easy to understand status before acting

---

## Shared UI Requirements

### Status Badges
Need one reusable system for:
- editorial status
- validation outcome
- possibly review state/source

### Action Feedback
Need consistent:
- pending indicators
- success messaging
- error messaging
- confirm-before-destructive-action patterns

### States
All major screens/components should support:
- loading
- empty
- error
- partial data gracefully

### Layout
Use the current admin shell and page-title conventions.
Prefer consistent panel/card styling across all editorial screens.

---

## Behavior Rules

- Frontend displays backend truth; it does not invent workflow rules
- Actions should be disabled or hidden based on backend-provided context only where appropriate
- After mutation, relevant views must refresh
- Avoid stale detail panels after review/restore/rerun actions

---

## Quality Bar

A screen is not complete unless:
- it looks intentional
- statuses are obvious
- primary actions are easy to find
- errors are understandable
- the user does not need to reload the page manually after action