# WEOS EDU-001 Diagnosis Education Mutation Safety

Status: implemented safety hardening for the current direct-mutation Education architecture.

Baseline: `50ab64545f0dca21f898a9641587363b87d869cf`.

## Invariants

- Material Diagnosis Education edits to `PUBLISHED` content invalidate publication authority.
- Material Diagnosis Education edits to `APPROVED` content invalidate approval authority.
- The invalidation target for `APPROVED` and `PUBLISHED` content mutation is `NEEDS_REVIEW`.
- `REJECTED` and `ARCHIVED` are not implicitly reopened by EDU-001.
- Existing-row manual edits, section regeneration, whole AI regeneration, and review decisions must target the caller-observed `DiagnosisEducation.version`.
- Stale Education commands fail with conflict instead of overwriting newer content.
- Learner access to the latest published revision remains part of the temporary architecture.
- Clinical Case generation continues to import Diagnosis Education only when the current Education row is `PUBLISHED`.

## Runtime Boundary

EDU-001 keeps the current direct-write model temporarily:

`AI output -> current DiagnosisEducation row -> NEEDS_REVIEW -> revision snapshot`

Candidate-first Education generation and section candidate application are deferred to EDU-002. This package does not introduce `EducationGenerationCandidate`, publication decision records, graph provenance redesign, distributed locks, durable AI failure records, or a new review UI.

## Differential Trust Treatment

`EducationDifferentialMapping` rows remain editorial normalization projections. `EducationDifferentialLink` synchronization now treats a mapping as trusted only when its source current Education row, or source Education revision, is `PUBLISHED`. Non-published current Education can still be mapped for editorial review, but it must not silently produce trusted downstream teaching differential links.

## Expected Version Contract

Runtime callers must send `expectedVersion` for:

- existing-row manual Education updates;
- section regeneration;
- whole Education AI regeneration over an existing row;
- Education review, approval, and publication decisions.

Create flows without an existing `DiagnosisEducation` row may omit `expectedVersion`.
