# Codex Phase Prompts

Use these prompts one at a time. Keep the AGENTS.md and Codex instructions file in context for every run.

---

## Phase 0 — no-risk cleanup

```text
You are implementing Phase 0 of my admin frontend cleanup.

Read AGENTS.md and CODEX_INSTRUCTIONS.md first and follow them strictly.

Goal:
Make only no-risk cleanup changes that improve clarity without changing the core architecture.

Current truths to preserve:
- feature-based page grouping is good
- single admin API layer is good
- page-owned state/fetching is good
- `/cases` remains the editorial home

Phase 0 tasks to evaluate and implement where grounded in the codebase:
1. Change `/admin` redirect to `/` so overview becomes the stable admin entry point.
2. Rename sidebar and topbar labels/branding so the admin language matches the medical case platform.
3. Remove or reduce duplicated KPI summaries on the dashboard where the same editorial counts appear more than once.
4. Replace any raw JSON success output on the generation page with a structured success summary using the same endpoint and flow.
5. Reuse existing formatting helpers where duplicate status/source formatting logic exists.
6. Audit obvious wrapper or compatibility files and either document them or remove them if clearly unused inside the app.

Requirements:
- inspect current files first
- implement only grounded changes
- avoid behavior churn
- keep diffs small
- do not start route redesign beyond the redirect cleanup
- do not begin large file extraction

Return format:
1. current files inspected
2. changes selected for this phase
3. files changed
4. implementation notes
5. validation run
6. risks and follow-ups
```

---

## Phase 1 — route and layout ownership

```text
You are implementing Phase 1 of my admin frontend cleanup.

Read AGENTS.md and CODEX_INSTRUCTIONS.md first and follow them strictly.

Goal:
Improve route and layout ownership so the UI better matches the real product domains without rewriting the app.

Target direction:
- `/` = overview / operations
- `/cases` = editorial + case management
- `/analytics` = analytics home
- `/publish` = publish/distribution home
- `/generate` = generation flow

Tasks:
1. Inspect current route definitions, sidebar navigation, topbar title logic, and page ownership.
2. Add a dedicated `/publish` route using the smallest viable implementation.
3. Update sidebar navigation and any route title logic to support the new route cleanly.
4. Make dashboard ownership more operational and less mixed, without yet doing a full analytics redesign.
5. Keep `/cases` as the editorial home. Do not create a competing `/editorial` route.

Constraints:
- prefer reuse of existing publish-related panels/components before building new systems
- do not deeply refactor `CaseDetail.tsx` yet
- do not move multiple analytics modules in this phase unless required to support clean ownership
- avoid brittle exact-path title logic if nested routes are being prepared

Return format:
1. current routing and ownership summary
2. minimal route/layout plan implemented
3. files changed
4. why each change belongs to Phase 1
5. validation run
6. remaining gaps for Phase 2
```

---

## Phase 2 — analytics separation

```text
You are implementing Phase 2 of my admin frontend cleanup.

Read AGENTS.md and CODEX_INSTRUCTIONS.md first and follow them strictly.

Goal:
Make `/analytics` the real owner of gameplay and quality analytics, while reducing dashboard congestion.

Tasks:
1. Inspect DashboardPage, AnalyticsPage, analytics widgets, and relevant admin API calls.
2. Move full analytics experiences out of dashboard and into `/analytics`, especially trend/chart ownership.
3. Keep dashboard focused on operational awareness and queue health.
4. Reduce duplicated fetching if the same payload is being requested in multiple places unnecessarily.
5. Preserve existing API contracts where possible.

Requirements:
- be conservative with data-flow changes
- prefer reusing existing chart/panel components
- do not redesign analytics beyond ownership cleanup
- do not refactor unrelated cases/editorial code

Deliverables:
- dashboard answers “what needs attention now?”
- analytics answers “what is happening in gameplay and quality?”

Return format:
1. analytics ownership before changes
2. changes implemented
3. files changed
4. data-flow notes
5. validation run
6. follow-up opportunities for later analytics depth
```

---

## Phase 3 — editorial workflow depth

```text
You are implementing Phase 3 of my admin frontend cleanup.

Read AGENTS.md and CODEX_INSTRUCTIONS.md first and follow them strictly.

Goal:
Improve editorial workflow depth and detail ownership while preserving `/cases` as the editorial home.

Tasks:
1. Inspect `CasesPage.tsx`, `CaseDetail.tsx`, supporting case components, and route definitions.
2. Add URL-backed case selection with `/cases/:caseId` if the codebase supports it cleanly.
3. Refactor `CaseDetail.tsx` by extracting feature-local sections or helper files where that reduces responsibility mixing.
4. Keep behavior stable while improving structure.
5. Clarify queue/detail ownership so the cases area feels less like a monolith.

Constraints:
- do not create a competing `/editorial` route
- do not rewrite the cases page architecture
- do not combine extraction with broad UI redesign
- prefer local sections such as workflow, clinical content, validation, review summary, history, or transforms

Return format:
1. current case workflow structure
2. minimal editorial improvements chosen
3. files changed
4. extraction boundaries and rationale
5. validation run
6. regression risks and next steps
```

---

## Phase 4 — publish / distribution workflow

```text
You are implementing Phase 4 of my admin frontend cleanup.

Read AGENTS.md and CODEX_INSTRUCTIONS.md first and follow them strictly.

Goal:
Make publish/distribution a first-class admin workflow instead of a hidden filter inside the cases area.

Tasks:
1. Inspect current publish-related UI, queue filters, helper text, and dashboard publish panels.
2. Expand `/publish` into a focused publish-readiness and distribution surface using existing data and components where possible.
3. Remove or reduce publish workflow dependence on hidden queue states inside `/cases`.
4. Keep `/cases` focused on editorial review and case management.
5. Avoid speculative backend redesign unless explicitly required.

Requirements:
- preserve existing data contracts when possible
- make publish visibility operationally clear
- separate editorial review from publish readiness
- avoid overbuilding a new system in one pass

Return format:
1. current publish workflow map
2. implemented publish ownership changes
3. files changed
4. UX impact
5. validation run
6. what remains for future distribution sophistication
```

---

## Review-only prompt before each implementation

```text
Before implementing, inspect the relevant files for this phase and give me:
1. what exists now
2. the smallest useful change for this phase
3. exact files you would modify
4. likely regressions
5. acceptance criteria
Do not code yet.
```

---

## Final verification prompt after each phase

```text
Review the completed phase against AGENTS.md and CODEX_INSTRUCTIONS.md.
Check for:
- scope creep
- architecture drift
- regressions in route ownership
- duplicated logic introduced by the diff
- whether the page now better answers its main question

Return:
1. pass/fail by criterion
2. issues found
3. exact cleanup changes still needed
Do not perform additional refactors unless they are required to fix a concrete issue.
```
