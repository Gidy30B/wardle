# WEOS Agent Start Here

This interpretation layer helps a fresh agent understand the Wardle Editorial
Operating System (WEOS) as it exists in this repository. It is explanatory only:
it does not approve documents, resolve open decisions, rename actions, or change
runtime behavior.

## Scope

WEOS scope includes diagnosis registry governance, diagnosis education,
teaching rules, cases and clue editorial lifecycle, editorial decisions and
audit, readiness and publication controls, knowledge-graph editorial governance,
the diagnosis editorial workspace, and related backend permissions and tests.

Primary implementation evidence lives in:

- `doctordle-backend/src/modules/editorial-governance/*`
- `doctordle-backend/src/modules/admin/*`
- `doctordle-backend/src/modules/diagnosis-registry/*`
- `doctordle-backend/src/modules/education/*`
- `doctordle-backend/src/modules/diagnosis-graph/*`
- `doctordle-backend/prisma/schema.prisma`
- `analytics-dashboard/src/features/editorial/*`
- `analytics-dashboard/src/features/editorial/workspace/*`

## Reading Order

1. `docs/weos/authority/STATUS-AND-PRECEDENCE.md`
2. `docs/weos/WEOS-IMP-001-current-to-canonical-mapping.md`
3. `docs/weos/WEOS-IMP-001-divergence-register.md`
4. `docs/weos/WEOS-IMP-002-lifecycle-transition-specification.md`
5. `docs/weos/WEOS-IMP-003-editorial-action-decision-catalogue.md`
6. `docs/weos/WEOS-IMP-004-legacy-status-crosswalk.md`
7. `docs/weos/WEOS-IMP-005-phase-2-open-decisions.md`
8. `docs/weos/capability-map/WEOS-CAPABILITY-MAP.md`
9. `docs/weos/capability-map/RUNTIME-ACTION-CROSSWALK.md`
10. `docs/weos/capability-map/DATABASE-MODEL-MAP.md`
11. `docs/weos/capability-map/PERMISSION-MAP.md`
12. `docs/weos/glossary/WEOS-TERMS.md`
13. `docs/weos/gaps/IMPLEMENTATION-GAPS.md`
14. `docs/weos/agent-rules/DO-NOT-GUESS.md`

## Phase 2 Interpretation Closure

Phase 2 interpretation work is closed for this reviewed repository state.

- Reviewed branch: `weos/phase-2-review`
- Reviewed implementation baseline: `bc6621a937bc1182a3a4b8a1a9d959b7b917f26a`
- Review date: `2026-07-28`
- Maturity statement:

```text
DOCUMENTED + PARTIALLY_IMPLEMENTED + AGENT-LEGIBLE +
NOT YET SAFE FOR FULL GOVERNANCE AUTOMATION
```

Closure means that the current implementation, permissions, storage,
verification commands and known governance gaps are documented consistently.

Closure does not resolve open decisions, approve canonical authority, complete
runtime governance architecture or authorize Phase 3 implementation. Later
runtime, schema, dashboard, permission or test changes require revalidation of
this interpretation layer.

## Authority Cautions

Document existence does not imply formal approval. The baseline package states
that newly authored controlled documents remain drafts until formal approval
(`docs/weos/WEOS_Documentation_Baseline_0.2/README.md`, "Baseline status").
Phase 2 implementation documents are marked `Draft` and `REVIEW_REQUIRED`
(`docs/weos/WEOS-IMP-002-lifecycle-transition-specification.md`, "Document
Control"; `docs/weos/phase-2-review/REVIEW-MANIFEST.md`, "Git Evidence").

Architecture authority and implementation evidence are different things. The
canonical documents describe intended WEOS concepts; runtime services,
controllers, schemas, and dashboard files show current behavior.

## Human-Controlled Decisions

Open governance questions remain human-controlled in
`docs/weos/WEOS-IMP-005-phase-2-open-decisions.md`. Agents must not close,
silently resolve, or override those decisions.

Branch-missing models, repositories, tests, action registries and dashboard files
must not be treated as implemented. If a file exists only in local worktree state
or another branch, classify it as unavailable rather than active evidence.

Runtime route access, state gates and canonical authority are separate. Where the
gap register marks automation unsafe, agents must not perform autonomous
governed mutation without explicit human authorization.

## Agent Rule

If implementation and authority conflict, record the conflict and preserve the
existing behavior. Do not guess document precedence, canonical status, role
authority, audit sufficiency, or lifecycle equivalence.

## Interpretation-Layer Index

- Authority: `docs/weos/authority/STATUS-AND-PRECEDENCE.md`
- Capability map: `docs/weos/capability-map/WEOS-CAPABILITY-MAP.md`
- Runtime crosswalk: `docs/weos/capability-map/RUNTIME-ACTION-CROSSWALK.md`
- Database model map: `docs/weos/capability-map/DATABASE-MODEL-MAP.md`
- Permission map: `docs/weos/capability-map/PERMISSION-MAP.md`
- Test/command map: `docs/weos/capability-map/TEST-COMMAND-MAP.md`
- Glossary: `docs/weos/glossary/WEOS-TERMS.md`
- Gaps: `docs/weos/gaps/IMPLEMENTATION-GAPS.md`
- Do-not-guess rules: `docs/weos/agent-rules/DO-NOT-GUESS.md`
