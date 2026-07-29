# WEOS Phase 3 Governance Foundations Implementation Sequence

## Document Control

- Pack ID: `WEOS-P3-GOV-FOUNDATIONS`
- Version: `0.1`
- Status: `Draft`
- Disposition: `REVIEW_REQUIRED`
- Approval state: `NOT_APPROVED`
- Implementation authority: `NOT_GRANTED`
- Evidence baseline: `6f41136c21c9e854cbf231752d71939fab82bdac`
- Review date: `2026-07-29`

This sequence is a proposed order for work after human approval. It does not authorize runtime, schema, dashboard, migration, backfill, database or deployment work.

## Stage 0 - Human Decision Approval

Required approvals:

- `WEOS-OD-021`
- `WEOS-OD-018`
- `WEOS-OD-022`
- `WEOS-OD-023`
- `WEOS-OD-019`
- `WEOS-OD-024`

No runtime implementation may begin before applicable approvals.

Entry criteria:

- Decision documents are reviewed by humans with authority to approve architecture.
- Approval records identify selected option, approver, date, evidence and implementation authorization.
- Dependencies and downstream decisions remain visible.

Exit criteria:

- Each approved decision has a repository-visible approval record.
- Decisions not approved remain `OPEN` and cannot drive implementation.
- No runtime implementation starts before applicable approvals.

## Stage 1 - Canonical TypeScript Contracts

Planned only:

- decision-envelope interfaces;
- authority-assignment contracts;
- concurrency command contract;
- projection ownership metadata;
- controlled-application contract;
- conformance tests.

Entry criteria:

- Stage 0 approvals cover the contracts being drafted.
- Generated-document authority rules are clear.

Exit criteria:

- Contracts encode approved options and open boundaries.
- Tests prove no recommendation is treated as approval.
- No Prisma or runtime behavior has changed.

## Stage 2 - Additive Persistence Design

Planned only:

- schema proposal;
- indexes;
- uniqueness;
- immutable fields;
- revision references;
- authority references;
- no destructive migration.

Entry criteria:

- Stage 1 contracts are reviewed.
- Direct-write inventory is complete enough for design.

Exit criteria:

- Persistence proposal is additive and reversible.
- Unknown legacy state remains representable.
- No migration has been run.

## Stage 3 - Read-Only Repository Adapters

Planned only:

- repository interfaces;
- read models;
- audit queries;
- no enforcement.

Entry criteria:

- Additive persistence design is reviewed.
- Query shapes and unknown-state semantics are approved.

Exit criteria:

- Read-only adapters can report decisions, authority, projections and drift.
- No service mutation path depends on them for enforcement yet.

## Stage 4 - Governed Command Handlers

Planned only:

- actor context;
- authority check;
- expected-version check;
- decision persistence;
- projection synchronization;
- transactional semantics.

Entry criteria:

- Stage 2 persistence and Stage 3 adapters are ready.
- Pilot command is selected but not production-authorized.

Exit criteria:

- Command handler can fail closed in tests.
- Stale commands return consistent conflict semantics.
- Projection writes are atomic or explicitly derived.

## Stage 5 - Pilot One Narrow Domain

Recommended initial pilot:

```text
Case review/approval targeting an exact CaseRevision.
```

Controlled clue application is not eligible as the initial pilot until `WEOS-OD-007` stable clue identity has an approved decision and an implemented stable revision-local clue-targeting contract.

Selection criteria:

- small number of artifacts;
- exact `CaseRevision` target available;
- approved expected-version contract;
- approved actor/authority contract;
- existing service tests provide behavioral reference;
- deterministic stale-command tests can be written;
- projection writes are visible;
- rollback and idempotency can be tested;
- no dependency on unresolved stable clue identity;
- no production rollout is implied by selection.

Entry criteria:

- Human review selects case review/approval as the pilot.
- Exact `CaseRevision` target semantics are defined.
- Pilot authority, expected-version and projection strategy are approved.
- Deterministic stale-command tests are designed before implementation.
- The pilot has no dependency on unresolved stable clue identity.

Explicit exclusion:

Controlled clue application remains a downstream pilot candidate only after:

- `WEOS-OD-007` is approved;
- stable revision-local clue identity exists;
- clue reorder and revision behavior is tested;
- controlled application can target a stable clue identity rather than an array index alone.

Exit criteria:

- Pilot passes deterministic tests.
- Legacy behavior is preserved or explicitly gated.
- Observability reports rejected stale and unauthorized attempts.

## Stage 6 - Backfill and Legacy Classification

Rules:

- prove before backfilling;
- do not invent decisions;
- mark unknown legacy state;
- preserve existing runtime behavior;
- dry-run reports first.

Entry criteria:

- Live-data audit plan is approved.
- Historical evidence classes are defined.

Exit criteria:

- Dry-run reports classify every row as proven, inferred, unknown or excluded.
- Backfill plan does not fabricate rationale, authority or approvals.

## Stage 7 - Enforcement Rollout

- observe-only mode;
- warning mode;
- enforced mode;
- rollback plan;
- monitoring.

Entry criteria:

- Pilot is stable.
- Backfill/unknown handling is accepted.
- Operators understand break-glass workflow.

Exit criteria:

- Enforcement blocks unauthorized/stale governed commands.
- Rollback plan is tested.
- Metrics show no unexplained blocked production flows.

## Stage 8 - Projection Write Restriction

- remove or block direct writes;
- retain compatibility reads as required;
- drift monitoring;
- final migration.

Entry criteria:

- Governed command handlers own the relevant projection writes.
- Drift reports are clean or classified.

Exit criteria:

- Direct writes are blocked, deprecated or routed through handlers.
- Compatibility projections are derived or synchronized by one owner.
- Deprecation conditions are documented per projection.

## Stage 9 - Downstream Conflict Resolution

Proceed to:

```text
WEOS-OD-025
WEOS-OD-026
WEOS-OD-027
graph approval/promotion
education publication separation
evidence activation boundary
reasoning revision
stable clue identity
revision-targeted publication
```

Entry criteria:

- Foundation decisions have approval records.
- Pilot outcomes are reviewed.
- Remaining conflicts are scoped to downstream decisions.

Exit criteria:

- Downstream decisions have their own approval records before implementation.
- No Phase 3 foundation recommendation is treated as automatic authorization.
- Generated documents are updated only through approved source/generator process.

## Approval Record

- Decision status: `OPEN`
- Approved option: `NOT_SELECTED`
- Approver: `NOT_RECORDED`
- Approval date: `NOT_RECORDED`
- Approval evidence: `NOT_RECORDED`
- Implementation authorization: `NOT_GRANTED`
