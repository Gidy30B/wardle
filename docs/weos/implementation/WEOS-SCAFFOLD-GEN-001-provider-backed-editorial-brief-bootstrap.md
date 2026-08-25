# WEOS SCAFFOLD-GEN-001 - Provider-Backed Editorial Brief Bootstrap

Status: implemented locally on `master`

Starting boundary: `d9722c08a22a285354be63f400d33a21beb92186`

## Runtime Change

`DiagnosisEditorialBriefService.generateBrief` now delegates successful
bootstrap generation to `DiagnosisEditorialBriefGenerationService`.

The generator sends only the approved diagnosis-level bootstrap context to the
provider:

- registry identity;
- active aliases;
- taxonomy metadata;
- non-patient registry notes;
- active diagnosis-level graph facts.

It does not send Education, Cases, Teaching Rules, Reasoning Paths, learner
data, user data, patient data, identifiable clinical records, or unrelated
application data.

Provider output is a richer non-authoritative Editorial Brief draft shape used
for validation and mapping into the existing `DiagnosisEditorialBrief` model.
No new Brief schema was introduced.

## Governance Boundary

Generated Brief rows are persisted only as `NEEDS_REVIEW`. The existing
manual review, approval and activation lifecycle remains authoritative.

AI generation contributes diagnosis-specific scaffold specificity and
coherence signals only. It does not create evidence authority, editorial
approval, active scaffold readiness, graph authority, Education material, Cases
or learner-visible content.

Provider failure returns `BOOTSTRAP_GENERATION_FAILED` and no deterministic
generic fallback is treated as successful generation.

## Validation

`EditorialBriefDraftQualityValidator` blocks generic filler, wrong-diagnosis
or mimic-only target confusion, missing target-specific identity, weak learning
goals, missing clinical pattern, missing meaningful mimic discriminators and
generic investigation guidance.

High-quality but incomplete output may pass with warnings for review-visible
issues such as missing reasoning traps, over-precise management language,
weak management anchors, weak finding roles or provider-stated uncertainty.

Validation never approves the Brief.

## Provenance

`AiDraftRevisionAudit` records provider-backed generation provenance including:

- provider and model;
- generator and prompt versions;
- generation time;
- diagnosis registry ID;
- context hash;
- validation result;
- resolved and unresolved proposed mimics;
- affected Brief artifact after persistence.

Blocked provider output is recorded as a rejected bootstrap audit against the
diagnosis registry entry when generation completed but quality validation
failed.

## Next Boundary

This package stops before `SCAFFOLD-GEN-002`. Teaching Rule generation remains
unchanged until the next package.
