# AGENTS.md

## Purpose

This file instructs Codex and any implementation agent how to execute the diagnosis standardization initiative safely, cleanly, and in a way that fits the existing system architecture.

This is a production implementation. The agent must favor correctness, controlled rollout, and reviewable incremental changes over broad speculative rewrites.

---

# 1. Project Context

The project is a medical diagnosis game platform with:

- NestJS backend
- Prisma + Postgres
- admin/editorial workflow with revisions, validation, review, and publish gating
- React/Tailwind frontend for gameplay
- diagnosis registry work already partially underway

The system is moving from free-text diagnosis handling toward a **registry-backed, editorially governed, frontend-cached, ID-based diagnosis architecture**.

The implementation must preserve current production behavior where necessary while tightening correctness and diagnosis quality step by step.

---

# 2. Mission

Implement diagnosis standardization end to end so that:

- cases link to canonical diagnosis registry entries
- editorial can review and fix diagnosis mapping
- gameplay correctness resolves by registry identity
- frontend autocomplete runs primarily from a cached local dictionary
- publish gating blocks unresolved diagnosis quality problems

---

# 3. Non-Negotiable Rules

## 3.1 Do not break current production flows unnecessarily

Prefer additive, migration-safe, reviewable changes.

## 3.2 Do not replace deterministic correctness with fuzzy or AI runtime judgment

Registry identity is the source of truth for gameplay correctness.

## 3.3 Do not build chatty autocomplete

Do not implement per-keystroke diagnosis search as the main architecture.

## 3.4 Do not bypass editorial governance

Diagnosis standardization must be visible and controllable in admin/editorial flow.

## 3.5 Do not destroy provenance

Preserve proposed/generated diagnosis text for audit even after canonical linkage is introduced.

## 3.6 Do not silently change canonical diagnosis semantics

Any canonical remapping or alias acceptance must be explicit and reviewable.

## 3.7 Prefer narrow, testable commits

Each phase should be implemented in a way that can be reviewed, tested, and reverted independently if needed.

---

# 4. Working Style Requirements

## 4.1 Audit before changing

Before modifying a phase area, inspect the exact existing files, services, DTOs, UI surfaces, and tests involved.

## 4.2 Minimize architectural drift

Fit new work into the current backend module structure, admin page structure, and gameplay data flow unless there is a strong reason not to.

## 4.3 Preserve established boundaries

Examples:

- editorial logic remains editorial-facing
- gameplay correctness remains deterministic backend logic
- frontend autocomplete remains a UI/data-loading concern, not a correctness source

## 4.4 Write migrations carefully

All schema changes must be backward-aware and safe for existing data.

## 4.5 Keep rollout transitional where needed

If a strict architecture change would break current usage, implement transitional compatibility first, then tighten in later phases.

---

# 5. Implementation Priorities

Follow this order unless a dependency forces a documented adjustment:

1. Schema hardening
2. Registry seed and dictionary generation
3. Existing case backfill
4. Editorial/admin diagnosis workflow
5. Gameplay correctness hardening
6. Frontend cached autocomplete
7. Publish gating enforcement
8. Governance/telemetry improvements

Do not jump ahead and create strict frontend behavior before the registry and case linkage model are trustworthy.

---

# 6. Backend Rules

## 6.1 Registry and alias modeling

- Canonical diagnosis identity belongs in the registry.
- Alternate wording belongs in aliases.
- Alias gameplay acceptance must be explicit.

## 6.2 Case linkage

- Cases must store linked diagnosis identity separately from proposed diagnosis text.
- Cases must expose structured diagnosis mapping state.

## 6.3 Matching

- Matching must be deterministic.
- Use normalization, exact alias matching, and explicit accepted alias rules.
- Do not allow fuzzy semantic runtime correctness as a primary path.

## 6.4 Publish gating

- A case must not become publish-ready if diagnosis mapping remains unresolved.

---

# 7. Frontend Rules

## 7.1 Autocomplete architecture

- Use a compact cached diagnosis dictionary.
- Filter locally.
- Submit diagnosis IDs whenever possible.
- Keep raw text only for telemetry or transitional fallback.

## 7.2 UX behavior

- Favor guided valid selection.
- Do not create a frustrating UI that blocks normal play without reliable suggestion coverage.
- Transitional mode is acceptable before strict mode.

## 7.3 Performance

- Avoid per-keystroke backend search.
- Prefer warm-start cache behavior where practical.

---

# 8. Editorial/Admin Rules

## 8.1 Diagnosis review is first-class

Case review must surface:

- proposed diagnosis text
- linked diagnosis
- mapping status
- ability to re-link
- ability to create a new diagnosis
- ability to manage aliases as permitted

## 8.2 Editorial authority

The admin/editorial surface must allow diagnosis quality repair without requiring manual database intervention.

---

# 9. Testing Rules

Every phase must include tests appropriate to the change.

## 9.1 Minimum expectations

- unit tests for new normalization/matching logic
- integration tests for linkage and workflow behavior
- regression coverage for known diagnosis mismatch examples
- frontend tests for dictionary loading and selection flow where relevant

## 9.2 Never ship matching logic changes without regression coverage

Known examples like related-but-not-equivalent diagnoses must be explicitly protected by tests.

---

# 10. Documentation Rules

When implementing each phase:

1. List files changed.
2. Summarize exactly what changed.
3. Explain why the approach matches the architecture.
4. Note any transitional compatibility decisions.
5. State what remains for the next phase.

Do not produce vague summaries.

---

# 11. Phase Execution Contract

For each phase, Codex should:

1. Inspect current implementation first.
2. Map the exact affected files.
3. Implement only the current phase scope.
4. Add/update tests.
5. Summarize changed files and behavior.
6. Stop after the scoped phase unless explicitly instructed to continue.

This prevents uncontrolled cross-phase rewrites.

---

# 12. Quality Bar

A phase is only complete when:

- architecture remains coherent
- code is production-readable
- tests cover the new behavior
- backward compatibility is respected where needed
- no hidden correctness shortcuts were introduced

---

# 13. Definition of Success

Success is not “autocomplete exists” or “registry exists.”

Success means the system now behaves as a coherent diagnosis platform where:

- diagnosis identity is standardized
- editorial can govern it
- gameplay correctness is fair and deterministic
- frontend is fast and low-request
- publish flow enforces diagnosis quality

