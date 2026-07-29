# WEOS-OD-019: Compatibility Projection Ownership

## Document Control

- Decision ID: `WEOS-OD-019`
- Version: `0.1`
- Status: `Draft`
- Disposition: `REVIEW_REQUIRED`
- Approval state: `NOT_APPROVED`
- Implementation authority: `NOT_GRANTED`
- Evidence baseline: `6f41136c21c9e854cbf231752d71939fab82bdac`
- Review date: `2026-07-29`

## Decision Question

Who owns each legacy or current-state compatibility projection, and may it be written directly or only derived through governed command handlers?

## Why This Decision Is Blocking

Mutable fields such as `Case.editorialStatus`, `Case.approvedAt`, `DiagnosisEducation.editorialStatus` and `DiagnosisRegistry` status/permission flags remain active runtime state. Phase 2 maps classify them as compatibility projections or mutable current state, not independent canonical authority.

## Scope

Ownership, writer policy, transaction boundary, read consumers, synchronization strategy, drift detection, repair mechanism, direct-write policy and deprecation conditions for representative compatibility projections.

## Out of Scope

This decision does not remove fields, change direct writes, run backfills, alter live data, or declare any existing projection canonical.

## Current Repository Evidence

- `doctordle-backend/prisma/schema.prisma` contains `Case.editorialStatus`, `approvedAt`, `approvedByUserId`, `publishedAt`, `DiagnosisEducation.editorialStatus`, `reviewedAt`, `publishedAt`, `DiagnosisRegistry.status`, `active`, `isPlayable` and `isGeneratable`.
- `docs/weos/capability-map/DATABASE-MODEL-MAP.md` classifies many of these as `COMPATIBILITY_PROJECTION` or mutable current state.
- `doctordle-backend/src/modules/admin/case-review.service.ts` writes case status and approval projections.
- `doctordle-backend/src/modules/education/diagnosis-education.service.ts` writes education status/revision projections.
- `docs/weos/gaps/IMPLEMENTATION-GAPS.md` identifies `WEOS-GAP-010` as the primary canonical-record-versus-compatibility-projection gap.
- `docs/weos/gaps/IMPLEMENTATION-GAPS.md` ties projection synchronization to `WEOS-GAP-004`, `WEOS-GAP-015` and other related gaps.

## Canonical Constraints

- No projection is independent authority.
- Every projection has one owner.
- Direct writes are inventoried and restricted.
- Drift is detectable.
- Backfill never invents history.
- Unknown legacy state remains unknown.
- Command handlers update canonical records before or atomically with projections.

## Terminology

- Compatibility projection: mutable field used by current runtime reads that represents or approximates canonical standing.
- Canonical owner: future decision/record that owns meaning.
- Direct write: service update to projection without creating/deriving from canonical record.
- Drift: projection value inconsistent with canonical record or expected derivation.

## Decision Drivers

- Preserve existing runtime reads while adding governance.
- Avoid treating projections as canonical decisions.
- Support gradual migration.
- Detect and repair drift.
- Prevent direct writes after command handlers exist.

## Options Considered

### Option A - Derived-only projections

Canonical records are authoritative; projections are rebuilt. This is clean but requires canonical records to exist and can be disruptive.

### Option B - Synchronized dual writes

Governed command handler writes canonical record and projection in one transaction. This preserves current reads but requires strict transaction and rollback design.

### Option C - Event-driven asynchronous projection

Canonical record commits first; projection updates asynchronously. This scales but introduces temporary drift and requires replay/monitoring.

### Option D - Transitional hybrid

Different projections use different strategies during migration, with a documented end state of canonical-record ownership and restricted projection writes.

## Comparative Evaluation

| Criterion              | Option A | Option B | Option C | Option D                 |
| ---------------------- | -------- | -------- | -------- | ------------------------ |
| Runtime compatibility  | Medium   | High     | High     | High                     |
| Drift risk             | Low      | Low      | Medium   | Medium during transition |
| Migration ease         | Low      | Medium   | Medium   | High                     |
| Operational complexity | Medium   | Medium   | High     | Medium-high              |

## Recommended Direction for Human Architecture Review

Use a transitional hybrid with an explicit end state: canonical governance records own meaning; projections are either derived or atomically synchronized by governed command handlers; direct writes are restricted after owners exist.

This recommendation is not an approval, does not resolve the decision, and does not grant implementation authority.

## Rejected Options and Reasons

- Reject permanent direct projection writes because projections would remain independent authority.
- Reject immediate derived-only migration without live-data audit because runtime consumers still depend on fields.
- Reject asynchronous-only projection for authority-bearing publication or approval state unless drift windows are explicitly tolerated.

## Consequences

### Positive

- Preserves compatibility while moving authority into records.
- Lets each projection choose a safe migration path.
- Enables drift detection and repair.
- Prevents future confusion between status fields and decisions.

### Negative

- Requires projection ownership inventory.
- Requires dual-read or drift reports during migration.
- Some fields may need long-lived compatibility support.

### Risks

- Projection owners may be misassigned.
- Repair jobs could invent history if not constrained.
- Asynchronous projections could create temporary user-facing inconsistency.

### Compatibility Effects

- Current fields remain available to existing reads.
- Future command handlers must update canonical records before or atomically with projections.
- Deprecated direct writes need compatibility shims or blocked paths.

## Migration Prerequisites

- Inventory direct writes for representative fields.
- Identify read consumers for each projection.
- Define canonical owner per projection.
- Define drift detection query and repair policy.
- Classify unknown legacy standing without invention.

## Implementation Prerequisites

- Approve projection ownership metadata.
- Approve per-projection synchronization strategy.
- Define command handler transaction boundaries.
- Define drift reports and repair authorization.

## Data and Backfill Constraints

- Backfill records observed current values only.
- Historical authority/rationale remains unknown if not recorded.
- Repair must not create governance decisions unless a real decision occurred after approval.

## Security and Authority Implications

- Projection writes must happen under authority-checked commands after rollout.
- Direct scripts, seeds or backfills must be classified and restricted.
- Drift reports may expose governance risks.

## Audit and Observability Requirements

- Monitor projection drift.
- Log direct-write attempts after restriction.
- Record repair actions separately from governance decisions unless authorized.

## Acceptance Criteria

- No projection is independent authority.
- Every projection has one owner.
- Direct writes are inventoried and restricted.
- Drift is detectable.
- Backfill never invents history.
- Unknown legacy state remains unknown.
- Command handlers update canonical records before or atomically with projections.

## Unresolved Questions

- Which projections can be derived immediately?
- Which runtime reads require compatibility fields indefinitely?
- What drift windows are acceptable?
- Who may authorize repair?

## Dependencies

- Depends on `WEOS-OD-023` for stale command safety.
- `WEOS-GAP-010` is the primary gap governed by `WEOS-OD-019`.
- `WEOS-GAP-004` uses `WEOS-OD-019` only for related projection synchronization after `WEOS-OD-023` defines concurrency.
- `WEOS-GAP-015` uses `WEOS-OD-019` only for education projection synchronization after review/publication separation is decided.
- Feeds `WEOS-OD-024`, `WEOS-OD-025` and downstream publication/history decisions without broadening into authority, publication or concurrency ownership.

## Exact Implementation Sequence After Approval

1. Approve projection ownership strategy.
2. Create projection ownership metadata contract.
3. Inventory direct writes and read consumers.
4. Mark direct-write policy per projection.
5. Add drift detection reports.
6. Add canonical command writes for a pilot projection.
7. Restrict direct writes after observe/warning phases.
8. Deprecate projections only when consumers no longer need them.

## Approval Record

- Decision status: `OPEN`
- Approved option: `NOT_SELECTED`
- Approver: `NOT_RECORDED`
- Approval date: `NOT_RECORDED`
- Approval evidence: `NOT_RECORDED`
- Implementation authorization: `NOT_GRANTED`
