# Editorial Workspace QA Seed

This seed creates local-only diagnosis workspace data for end-to-end QA of the Wardle editorial analytics workspace.

It is intentionally opt-in and refuses to run unless `EDITORIAL_WORKSPACE_QA_SEED=1` is set. Do not run it against production data.

## Run

From `doctordle-backend`:

```powershell
$env:EDITORIAL_WORKSPACE_QA_SEED="1"
$env:DATABASE_URL="postgres://postgres:postgres@localhost:5432/doctordle?sslmode=disable"
npm run seed:editorial-workspace-qa
```

The script is idempotent. It upserts by registry canonical name, teaching-rule stable keys, graph/evidence keys, case QA marker, learning-goal coverage key, escalation type, and QA audit keys.

## Diagnoses

- Appendicitis: near-ready workspace with approved brief, active rules, usable case, escalation coverage, pending and accepted draft audits.
- Acute Pancreatitis: draft-heavy workspace with review-needed rules/brief, unsupported claim, pending and needs-changes draft audits.
- Diabetic Ketoacidosis: blocked workspace with weak management, candidate rules, unsupported claim, pending and rejected draft audits.
- Ruptured Ectopic Pregnancy: blocked emergency workspace with escalation contrast, weak exam pearls, pending and superseded draft audits.
- Peptic Ulcer Disease: near-ready outpatient workspace with approved brief/rules and explicit upper-GI-bleed escalation coverage.
- Nutritional Vitamin D Deficiency Rickets: sparse workspace with no brief, candidate rules, weak investigations, pending draft audit.
- SIADH: draft-heavy workspace with weak differentials, mimic contrast, escalation coverage, pending draft audit.

## Workflows Covered

- Editorial brief/objectives presence and absence.
- Clinical picture sections with at least one intentionally weak section.
- Unsupported claim signals via `ReasoningDraftValidationRun.unsupportedClaimSignals`.
- Teaching rules/distinctions with active, approved, candidate, and needs-review states.
- Differential map entries via graph facts, graph candidates, teaching relationships, evidence relationships, and reasoning paths.
- Case inventory without daily scheduling.
- Persisted learning-goal coverage annotations.
- Persisted escalation annotations where clinically relevant.
- AI draft audit trail with `PENDING_REVIEW`, plus accepted/rejected/needs-changes/superseded examples across the dataset.
- Coverage/maturity variation: near-ready, blocked, sparse, and draft-heavy workspaces.

## QA Notes

All seed-owned records are marked with `QA_ONLY_EDITORIAL_WORKSPACE_SEED` in notes, source, provenance, validator version, evidence source, or generated JSON payloads where the schema provides a suitable field.

The seed does not create `DailyCase` rows and does not alter scheduling behavior.
