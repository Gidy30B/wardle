# WEOS SCAFFOLD-GEN-002 Provider-Backed Teaching Rule Generation

Date: 2026-08-26

Implementation commit: pending

## Summary

SCAFFOLD-GEN-002 replaces local deterministic Teaching Rule candidate synthesis
with provider-backed, diagnosis-specific generation from one exact
`APPROVED` or `ACTIVE` `DiagnosisEditorialBrief`.

Editorial Briefs define what Wardle intends to teach for a diagnosis. Teaching
Rules encode how downstream generated artifacts must express that intent as
atomic, reusable, operational constraints.

## Authority Boundary

The provider payload is limited to diagnosis-level registry identity, active
aliases, taxonomy metadata, clue preferences, the exact approved/active
Editorial Brief, active diagnosis-level Graph Facts, constrained approved
reasoning context when available, and approved/active Teaching Rule summaries
for dedupe and coverage.

The provider payload excludes patient data, learner/user/account data, game
sessions, Clinical Case content, Clinical Case Draft content, unapproved
Education, Education candidates, unapproved Graph Candidates, unrelated
application data, and source artifacts merely because a Graph Fact references
them.

## Candidate Semantics

AI-generated Teaching Rules persist only as `DiagnosisTeachingRule` rows with:

- `status = CANDIDATE`
- `source = GENERATED`
- `expectedEvidence.evidenceVerified = false`
- provenance in `difficultyHints.generationMetadata`
- exact Editorial Brief ID, version and status in provenance

Candidate generation does not approve, activate, replace, supersede or mutate
existing governed Teaching Rules. Human review through the existing Teaching
Rule lifecycle remains required before rules can count toward scaffold
readiness.

## Validation

`TeachingRuleDraftQualityValidator` validates generated draft rules and the
batch before persistence. It rejects generic pedagogy, editorial workflow
recommendations, wrong-diagnosis content, invalid category or importance values,
rules with no operational application, weak differential separators, missing
investigation roles, missing management principles, and missing critical Brief
coverage.

The validator warns on overloaded multi-concept rules, unsupported precise
treatment/threshold claims, and high-risk management or investigation rules
that do not surface an evidence expectation.

Evidence expected means an editor should verify the claim. It does not mean the
AI output is verified evidence.

## Provenance And Audit

Successful generation records an `AiDraftRevisionAudit` entry with provider,
model, generator version, prompt version, context hash, exact Brief identity,
validation result and created candidate IDs.

Blocked provider output is recorded as a rejected generation audit on a
best-effort basis. Provider failure does not create fake generic candidates.

## Readiness And Downstream Generation

Generated candidate rules do not make the scaffold ready. Existing lifecycle
readiness continues to count only approved or active Teaching Rules.

Education and Clinical Case generation gates remain unchanged: they depend on
the existing scaffold readiness policy and cannot use unreviewed Teaching Rule
candidate knowledge as authority.

## Graph Boundary

Teaching Rules are educational constraints, not graph facts. Candidate,
approved, or active Teaching Rules do not automatically create Graph Facts or
Graph Candidates, and `appliesToGraph` remains editorial applicability only.

## Schema

No schema or migration was required. Existing `DiagnosisTeachingRule`,
`DiagnosisEditorialBrief`, `DiagnosisRegistry`, and `AiDraftRevisionAudit`
models were sufficient for this package.

## Remaining Limits

Live provider smoke testing is optional and was not required for CI. Broader
scaffold quality scoring, evidence retrieval, graph provenance/staleness and
deep Teaching Rule governance redesign remain outside SCAFFOLD-GEN-002.
