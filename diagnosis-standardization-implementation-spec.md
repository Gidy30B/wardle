# Diagnosis Standardization Implementation Spec

## Document Purpose

This document is the **implementation contract** for Codex to execute the diagnosis standardization program cleanly across backend, admin/editorial, and frontend gameplay.

It translates the approved architecture into concrete engineering work, sequencing, invariants, and acceptance criteria.

This system must move from loosely controlled free-text diagnosis handling to a **registry-backed, editorially governed, frontend-cached, ID-driven diagnosis architecture**.

---

# 1. Problem Statement

The current system still has an architectural gap between:

- generated diagnosis text
- editorial diagnosis intent
- gameplay answer correctness
- frontend input/autocomplete behavior

This creates production issues:

- clinically reasonable guesses can be rejected because case diagnosis text is overly descriptive or inconsistently phrased
- semantically related but non-equivalent answers are not governed consistently
- frontend autocomplete risks too many backend requests if implemented naively
- editorial cannot fully standardize diagnosis quality as a first-class workflow
- publish gating is not yet strong enough to guarantee gameplay-fair diagnosis quality

The goal is to make diagnosis quality deterministic, editable, scalable, and observable.

---

# 2. Target Outcome

At completion, the system must satisfy all of the following:

1. Every playable case links to one active diagnosis registry entry.
2. Case diagnosis correctness is determined by registry identity, not raw free-text equality.
3. Editorial can review, change, create, and link diagnoses during case review.
4. Frontend autocomplete primarily uses a compact cached diagnosis dictionary loaded from backend.
5. Gameplay submissions use diagnosis IDs whenever possible.
6. Raw user input is retained only for telemetry, search analytics, and registry growth.
7. Cases with unresolved diagnosis standardization cannot move to publish-ready state.
8. Registry growth happens through controlled editorial/governance mechanisms.

---

# 3. Architecture Decision

The approved architecture is:

## ICD-guided custom registry
plus
## governed aliases
plus
## explicit case-to-registry linkage
plus
## editorial diagnosis review
plus
## local frontend dictionary caching
plus
## ID-based gameplay submission
plus
## deterministic registry-backed correctness

This is **not** a pure ICD implementation, **not** unrestricted fuzzy matching, and **not** runtime LLM-based answer judging.

---

# 4. Scope

## In scope

- diagnosis registry schema hardening
- alias model and alias governance
- case linkage to canonical diagnosis registry entries
- diagnosis mapping metadata on cases
- registry seed import/backfill
- editorial diagnosis review tools
- gameplay correctness hardening
- compact public dictionary generation for frontend autocomplete
- local frontend autocomplete with cached dictionary
- publish gating enforcement for diagnosis readiness
- telemetry and observability for registry quality and gameplay matching

## Out of scope for this implementation wave

- full SNOMED/ontology reasoning
- broad semantic diagnosis equivalence at runtime
- automated diagnosis generation replacing editorial judgment
- full terminology management beyond the game’s operational needs
- unrestricted fuzzy answer acceptance

---

# 5. Operational Principles

These principles are mandatory and must guide all implementation decisions.

## 5.1 Registry is the source of truth
Canonical diagnosis identity must live in the registry.

## 5.2 Editorial owns diagnosis quality
Diagnosis standardization is an editorial concern, not only a backend normalization concern.

## 5.3 Gameplay correctness must be deterministic
Runtime correctness must be explainable and based on explicit registry rules.

## 5.4 Frontend should guide valid selection
The UI should move the player toward valid diagnosis selection rather than rely on arbitrary raw typing.

## 5.5 Raw input becomes telemetry, not truth
Raw guesses should remain useful for analytics, alias growth, and wrong-guess mining, but must not be the long-term source of correctness.

## 5.6 Descriptive diagnoses are allowed only by policy
Controlled descriptive canonicals are acceptable only where clinically justified and editorially governed.

---

# 6. Domain Model Requirements

## 6.1 DiagnosisRegistry

Represents the canonical diagnosis entity.

### Required fields

- `id`
- `canonicalName`
- `normalizedCanonicalName`
- `status`
- `isDescriptive`
- `isCompositional`
- `searchPriority`
- `createdAt`
- `updatedAt`

### Optional fields

- `icd10Code`
- `icd11Code`
- `category`
- `specialty`
- `notes`

### Recommended status enum

- `ACTIVE`
- `HIDDEN`
- `DEPRECATED`
- `DRAFT`

## 6.2 DiagnosisAlias

Represents alternate playable or searchable names linked to a canonical diagnosis.

### Required fields

- `id`
- `diagnosisId`
- `alias`
- `normalizedAlias`
- `aliasType`
- `isAcceptedForGameplay`
- `createdAt`
- `updatedAt`

### Recommended alias type enum

- `EXACT`
- `COMMON_NAME`
- `ABBREVIATION`
- `LAY_VARIANT`
- `LEGACY`
- `EDITORIAL_VARIANT`

## 6.3 Case linkage fields

Each case must explicitly store diagnosis standardization state.

### Required additions on Case

- `diagnosisRegistryId`
- `proposedDiagnosisText`
- `diagnosisMappingStatus`
- `diagnosisMappingMethod`
- `diagnosisMappingConfidence`
- `diagnosisEditorialNote`

### Notes

- `proposedDiagnosisText` preserves generated/editorial origin wording.
- `diagnosisRegistryId` becomes required before publish-ready state.
- Mapping metadata must support queue visibility and auditability.

## 6.4 Mapping enums

### `diagnosisMappingStatus`

- `MATCHED`
- `REVIEW_REQUIRED`
- `UNRESOLVED`
- `NEW_REGISTRY_ENTRY_NEEDED`

### `diagnosisMappingMethod`

- `EXACT_ALIAS`
- `NORMALIZED_ALIAS`
- `EDITOR_SELECTED`
- `MANUAL_CREATED`
- `LEGACY_BACKFILL`
- `NONE`

---

# 7. Canonical Diagnosis Policy

## 7.1 Allowed canonicals

Canonicals must be:

- clinically meaningful
- stable
- playable
- concise where possible
- specific enough to be fair

Examples:

- `Pneumonia`
- `Acute appendicitis`
- `Diabetic ketoacidosis`
- `Iron deficiency anemia`

## 7.2 Allowed controlled descriptive canonicals

These are acceptable only when the causal or descriptive relationship is central to diagnosis identity.

Examples:

- `Malignant pleural effusion secondary to lung carcinoma`
- `Iron deficiency anemia due to chronic blood loss`

## 7.3 Disallowed canonicals

Do not allow canonicals that are:

- vague
- uncertainty-based
- narrative-like
- symptom-cluster descriptions pretending to be diagnosis
- explanation fragments

Examples:

- `Respiratory distress likely due to infection`
- `Anemia with neurological findings`
- `Chest pain due to heart problem`

---

# 8. Registry Content Strategy

## 8.1 Source strategy

The registry must be **ICD-guided but custom**.

That means:

- use ICD to inform taxonomy and naming
- do not blindly mirror ICD names where they hurt gameplay usability
- include common clinician wording and accepted aliases
- optimize for playable, clinically defensible diagnosis identity

## 8.2 Initial seed priorities

Prioritize diagnoses likely to occur in:

- internal medicine
- pediatrics
- obstetrics and gynecology
- surgery
- emergency medicine
- infectious disease
- cardiology
- pulmonology
- neurology
- psychiatry
- gastroenterology
- hematology
- endocrinology

## 8.3 Growth strategy

Registry growth must happen through:

- editorial creation of missing diagnoses
- alias additions informed by gameplay wrong guesses
- controlled deprecation of poor canonicals
- recurrent unresolved diagnosis review

---

# 9. Backend Implementation Requirements

## 9.1 Schema and migrations

Backend must add the new registry and linkage fields with safe migrations.

### Requirements

- preserve existing case diagnosis text for provenance
- avoid destructive migration patterns
- add indexes for registry lookup and case linkage
- add uniqueness rules where normalization requires them
- support historical linked cases even when diagnoses later become deprecated

## 9.2 Registry matcher service

The matcher service must remain deterministic.

### Responsibilities

- normalize canonical names and aliases
- resolve exact alias matches
- resolve normalized alias matches
- explicitly reject uncontrolled fuzzy semantic equivalence at runtime
- produce structured mapping results for case generation/backfill workflows

## 9.3 Gameplay evaluation boundary

Gameplay correctness must resolve by registry identity.

### Rules

A submission is correct when:

- submitted diagnosis ID equals the case diagnosis registry ID
- or transitional raw input resolves deterministically to an accepted alias of that diagnosis

### Disallowed runtime behavior

- broad fuzzy similarity scoring as truth source
- LLM runtime correctness decisions
- implicit acceptance of related-but-not-equivalent diagnoses

## 9.4 Public dictionary endpoint

Backend must expose a compact public endpoint for frontend diagnosis search.

### Recommended endpoints

- `GET /api/diagnosis-registry/dictionary`
- optional `GET /api/diagnosis-registry/version`

### Payload principles

- compact
- stable
- cacheable
- only gameplay-relevant fields
- no admin-only metadata

## 9.5 Admin endpoints

Backend must expose admin CRUD and linkage flows.

### Minimum required endpoint capabilities

- list/search diagnosis registry
- read diagnosis detail
- create diagnosis
- update diagnosis
- add/edit aliases
- link case to diagnosis
- create-and-link diagnosis from case review

---

# 10. Editorial/Admin Implementation Requirements

## 10.1 Diagnosis review block in case detail

Case detail must include a diagnosis standardization section showing:

- proposed diagnosis text
- current linked diagnosis
- diagnosis mapping status
- diagnosis mapping method
- diagnosis editorial note
- controls to search/select diagnosis
- controls to create diagnosis if missing
- access to aliases relevant to selected diagnosis

## 10.2 Editorial responsibilities in UI

Reviewer must be able to:

- determine whether current diagnosis is clinically correct
- determine whether it is playable
- re-link case to existing registry diagnosis
- create a new registry diagnosis when necessary
- add aliases when needed
- leave diagnosis-specific editorial notes

## 10.3 Queue visibility

Editorial queues should surface diagnosis readiness explicitly.

### Recommended queue filters/badges

- Diagnosis matched
- Diagnosis needs review
- New diagnosis required
- Diagnosis unresolved
- Diagnosis standardized

## 10.4 Publish gating

A case must not move to `READY_TO_PUBLISH` unless:

- `diagnosisRegistryId` is set
- linked diagnosis status is `ACTIVE`
- diagnosis mapping status is not unresolved
- no diagnosis-specific quality block is present

---

# 11. Frontend Gameplay Implementation Requirements

## 11.1 Autocomplete model

Frontend must use local cached filtering against a compact dictionary.

### Required behavior

- fetch dictionary at app start
- cache dictionary locally
- search/filter in memory
- rank suggestions predictably
- submit selected diagnosis ID
- preserve raw input for telemetry if needed

## 11.2 Search behavior

Search must support:

- canonical prefix match
- alias prefix match
- normalized contains match
- abbreviation support
- stable priority ordering

### Recommended ranking order

1. exact prefix on canonical
2. exact prefix on accepted alias
3. contains match on canonical
4. contains match on alias
5. higher search priority diagnoses

## 11.3 Rollout behavior

### Transitional mode

- allow raw typing
- strongly encourage selection
- preserve raw input fallback only if backend can resolve via registry rules

### Target steady-state mode

- require selection from autocomplete for gameplay submission
- submit diagnosis ID as primary truth

## 11.4 Performance expectations

- eliminate per-keystroke backend diagnosis search in normal gameplay
- keep startup overhead acceptable on mobile devices
- support warm start from local cache

---

# 12. Backfill Requirements

## 12.1 Existing case backfill

All existing cases must be processed through a deterministic mapping/backfill workflow.

### Required outcomes per case

- `MATCHED`
- `REVIEW_REQUIRED`
- `UNRESOLVED`
- `NEW_REGISTRY_ENTRY_NEEDED`

## 12.2 Backfill priorities

Prioritize in this order:

1. currently published/active gameplay cases
2. ready-to-publish cases
3. approved/review-complete cases
4. draft/review backlog

## 12.3 Backfill output visibility

The system must produce operationally useful outputs for admin review.

Examples:

- unresolved case list
- diagnosis conflicts
- likely duplicates
- new diagnosis candidates

---

# 13. Observability Requirements

## 13.1 Registry metrics

Track:

- active diagnoses count
- alias count
- aliases per diagnosis
- diagnoses created manually
- deprecated diagnoses count

## 13.2 Case metrics

Track:

- cases linked to registry
- cases unresolved by diagnosis
- cases blocked from publish due to diagnosis readiness
- manual remaps over time

## 13.3 Gameplay metrics

Track:

- selected diagnosis submission rate
- raw-text fallback rate
- alias hit rate
- wrong guesses by normalized text
- near-match guess patterns
- top unresolved guess clusters

## 13.4 Performance metrics

Track:

- dictionary payload size
- frontend autocomplete latency
- dictionary cache hit rate
- reduction in backend diagnosis-search request volume

---

# 14. Implementation Phases

## Phase 1 — Schema hardening

### Goal
Introduce durable models and case linkage fields.

### Deliverables

- schema changes
- migrations
- enums
- model constraints
- repository/service wiring for new fields

### Exit criteria

- cases can store both proposed text and linked diagnosis identity
- registry/alias models support governance and lookup

## Phase 2 — Registry seed + dictionary generation

### Goal
Load initial registry and enable public compact dictionary build.

### Deliverables

- seed import path
- normalization scripts/utilities
- dictionary generation logic
- duplicate handling rules

### Exit criteria

- initial registry usable for mapping and frontend search

## Phase 3 — Existing case backfill

### Goal
Map existing cases to diagnosis registry.

### Deliverables

- backfill job/script
- structured mapping outcomes
- review queues/flags

### Exit criteria

- active cases classified by diagnosis readiness

## Phase 4 — Editorial/admin diagnosis workflow

### Goal
Make diagnosis standardization first-class in admin.

### Deliverables

- diagnosis review panel
- link/select diagnosis flow
- create-and-link flow
- alias review/edit support

### Exit criteria

- editorial can standardize diagnoses without developer intervention

## Phase 5 — Gameplay correctness hardening

### Goal
Move answer correctness fully behind registry identity.

### Deliverables

- ID-based submission support
- deterministic correctness resolution
- transitional raw-input resolution via explicit registry logic only

### Exit criteria

- correctness no longer depends on raw diagnosis strings

## Phase 6 — Frontend cached autocomplete rollout

### Goal
Replace chatty backend search with local dictionary filtering.

### Deliverables

- preload/cache flow
- local filtering engine
- ranked suggestions
- selected diagnosis submission

### Exit criteria

- diagnosis search is fast and mostly local

## Phase 7 — Publish gating enforcement

### Goal
Prevent unresolved diagnosis quality from reaching production gameplay.

### Deliverables

- publish gating checks
- admin visibility into diagnosis readiness failures

### Exit criteria

- newly publishable cases always have standardized linked diagnoses

## Phase 8 — Governance loop

### Goal
Use gameplay/editorial telemetry to improve the registry over time.

### Deliverables

- wrong-guess review workflow
- alias update process
- new diagnosis creation governance
- deprecation policy

### Exit criteria

- registry quality improves through observed product behavior

---

# 15. Validation and Testing Requirements

## Unit tests

Must cover:

- canonical normalization
- alias normalization
- deterministic alias resolution
- abbreviation handling
- descriptive diagnosis policy checks
- dictionary ranking behavior

## Integration tests

Must cover:

- case creation storing proposed diagnosis + mapping metadata
- admin linking case to diagnosis
- create-and-link diagnosis flow
- publish blocked for unresolved diagnosis
- gameplay correct answer resolution by ID
- transitional raw-input path resolving only through registry rules

## Regression tests

Must include known examples such as:

- `lung carcinoma` vs `pleural effusion from lung cancer`
- acceptable synonyms that should match
- related but non-equivalent diagnoses that must not match
- abbreviations like `TB`, `MI`, `DKA` where alias acceptance must be explicit

## Frontend tests

Must cover:

- dictionary cache bootstrap
- local search filtering
- ranking correctness
- selection submission flow
- strict versus transitional behavior

---

# 16. Risks and Controls

## Risk 1 — Registry duplication

### Control

- normalized canonical uniqueness policy
- duplicate warnings in admin
- deprecate instead of destructive delete

## Risk 2 — Dictionary becomes too large

### Control

- compact payload shape
- exclude admin-only fields
- monitor payload size
- compress or trim search fields if needed

## Risk 3 — Strict selection harms UX too early

### Control

- roll out in transitional mode first
- measure autocomplete coverage and selection rate
- move to strict mode only after quality proves out

## Risk 4 — Descriptive diagnoses remain inconsistent

### Control

- explicit editorial policy
- metadata flags for descriptive/compositional diagnoses
- publish blocking for vague diagnosis forms

## Risk 5 — Legacy cases remain unfair

### Control

- backfill active/published cases first
- block unresolved new publish paths
- maintain backlog visibility for legacy debt

---

# 17. Definition of Done

The implementation is complete when:

- every playable case has a linked active registry diagnosis
- editorial can standardize diagnosis in admin without developer intervention
- publish-ready state requires diagnosis readiness
- gameplay correctness resolves from registry identity
- frontend diagnosis autocomplete primarily uses cached local dictionary data
- backend diagnosis-search keystroke load is eliminated or near-zero
- raw input is telemetry, not long-term truth
- registry growth is governed and observable

---

# 18. Recommended Delivery Order

1. Phase 1 — schema hardening
2. Phase 2 — registry seed and dictionary generation
3. Phase 3 — existing case backfill
4. Phase 4 — editorial/admin workflow
5. Phase 5 — gameplay correctness hardening
6. Phase 6 — frontend cached autocomplete
7. Phase 7 — publish gating enforcement
8. Phase 8 — governance loop

This order must be preserved unless there is a clearly documented dependency reason to change it.

