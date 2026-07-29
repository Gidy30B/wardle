# WEOS-OD-018: Governance Decision Envelope

## Document Control

- Decision ID: `WEOS-OD-018`
- Version: `0.1`
- Status: `Draft`
- Disposition: `REVIEW_REQUIRED`
- Approval state: `NOT_APPROVED`
- Implementation authority: `NOT_GRANTED`
- Evidence baseline: `6f41136c21c9e854cbf231752d71939fab82bdac`
- Review date: `2026-07-29`

## Decision Question

Should cross-artifact WEOS governance use a generic decision envelope with typed payload constraints, separate typed decision tables, or a hybrid model?

## Why This Decision Is Blocking

Phase 2 maps identify `CaseReview`, `AiDraftRevisionAudit`, revision records, validation records, mutable status fields and logs, but these are not equivalent to a generic canonical governance-decision envelope. Cross-artifact decisions remain incomparable without a common target, actor, authority, rationale, outcome and effect structure.

## Scope

Cross-artifact governance decision representation for cases, education, graph, registry, controlled application, operational permission, publication and document authority.

## Out of Scope

This decision does not create Prisma tables, migrate legacy rows, rewrite services, convert existing audit logs into decisions, or decide every domain-specific payload.

## Current Repository Evidence

- `docs/weos/gaps/IMPLEMENTATION-GAPS.md` marks `WEOS-GAP-002` as open and tied to `WEOS-OD-018`.
- `doctordle-backend/prisma/schema.prisma` contains `CaseReview`, `AiDraftRevisionAudit`, `CaseRevision`, `DiagnosisEducationRevision`, `CaseValidationRun` and `ReasoningDraftValidationRun`, but no generic `GovernanceDecision` model at this baseline.
- `docs/weos/capability-map/DATABASE-MODEL-MAP.md` classifies `CaseReview` as `REVIEW_WORKFLOW_RECORD` and `NOT_CANONICAL_DECISION`.
- `doctordle-backend/src/modules/diagnosis-graph/diagnosis-graph-candidates.service.ts` updates candidate status and may create facts in one approval path.
- `doctordle-backend/src/modules/admin/case-review.service.ts` writes review/projection records but does not create a cross-artifact envelope.

## Canonical Constraints

- Governance Decision, Workflow Record, Assessment, Validation Result, Audit Event, Revision Record and Compatibility Projection are distinct.
- Audit events cannot substitute for decisions.
- Decisions must target exact artifact/revision where required.
- Decisions must include actor, authority, rationale, findings, outcome, effect and immutable history.

## Terminology

- Governance Decision: authority-bearing decision with target, execution identity, authority source, rationale, outcome and effect.
- Workflow Record: operational progress row such as `CaseReview`.
- Assessment: structured judgement that is not approval.
- Validation Result: validator output, not authority.
- Audit Event: event that something happened, not why it was authorized.
- Revision Record: content snapshot.
- Compatibility Projection: mutable current-state field derived from or standing in for canonical records.
- `actorType`: proposed execution-identity category such as `USER`, `SERVICE_ACCOUNT`, `AUTOMATION` or `SYSTEM`; this is illustrative, not a selected final enum.
- `actorId`: identity that executed, submitted or recorded the operation.
- `humanAuthorityActorId`: human authority source when an automated or system actor executes an authorized governance decision. It may be absent only where the approved decision type explicitly permits non-human authority.
- `authorityAssignmentId`: scoped authority assignment authorizing the decision.

## Decision Drivers

- Cross-artifact query needs.
- Typed validation needs.
- Migration uncertainty.
- Referential integrity and exact revision targets.
- Avoiding invented historical governance.
- Future publication and controlled-application enforcement.

## Options Considered

### Option A - Generic polymorphic envelope

Use common fields: `id`, `decisionType`, `artifactType`, `artifactId`, `artifactRevisionId`, `actorType`, `actorId`, `humanAuthorityActorId`, `authorityAssignmentId`, `rationale`, `findings`, `outcome`, `effectiveAction`, `obligations`, `supersedesDecisionId`, `occurredAt`, `createdAt`, `payload`, `schemaVersion`. This supports uniform audit and search, but referential integrity is limited unless artifact references are constrained separately and payload validation is strict. Actor identity must not be restricted to application users, and execution identity must remain distinct from the authority source.

### Option B - Fully typed domain-specific decision tables

Examples include `CaseApprovalDecision`, `EducationPublicationDecision`, `GraphPromotionDecision`, `OperationalPermissionDecision` and `ControlledApplicationDecision`. This gives strong foreign keys and domain validation, but duplicates common fields and weakens cross-artifact reporting.

### Option C - Hybrid envelope with typed extension records

Use a common envelope plus typed one-to-one extension records or validated payload schemas. This preserves common query and authority fields while giving domain-specific validation.

## Comparative Evaluation

| Criterion                | Option A | Option B | Option C             |
| ------------------------ | -------- | -------- | -------------------- |
| Cross-artifact reporting | High     | Low      | High                 |
| Referential integrity    | Medium   | High     | High with extensions |
| Payload validation       | Medium   | High     | High                 |
| Migration complexity     | Medium   | High     | Medium-high          |
| Avoids duplicated fields | High     | Low      | Medium               |

## Recommended Direction for Human Architecture Review

Prefer a hybrid envelope with typed extension records or strict validated payload schemas. The common envelope should carry execution actor type, execution actor identity, human authority source where required, scoped authority assignment, target, rationale, findings, outcome, effective action, obligations, supersession and schema version; typed extensions should enforce artifact-specific constraints. Automation may execute an operation, but it must not silently become the authority source.

This recommendation is not an approval, does not resolve the decision, and does not grant implementation authority.

## Rejected Options and Reasons

- Reject audit-log-only governance because logs do not prove authority, rationale or effect.
- Reject mutable status-field governance because projections are not immutable decision history.
- Reject a purely generic payload without validation because it hides invalid targets and weakens migration safety.
- Reject fully separate tables if they cannot support shared authority and supersession queries.

## Consequences

### Positive

- Provides a common decision spine across artifacts.
- Supports typed domain validation.
- Gives future projections and applications a single decision reference.
- Preserves distinction between assessment, validation, revision, audit and decision.

### Negative

- Requires careful schema and adapter design.
- Requires domain teams to define typed payloads.
- Querying may need joins or validated JSON indexing.

### Risks

- Bad payload schemas could become a second ungoverned system.
- Migration pressure could tempt invented historical decisions.
- Missing authority assignment design would weaken decision legitimacy.
- Collapsing service-account, automation, system and human identities into a user-only field would obscure accountability.

### Compatibility Effects

- Existing rows remain current runtime evidence, not converted decisions unless proven.
- Compatibility projections continue to exist but gain future decision references.
- Read models must tolerate legacy rows with `UNKNOWN` decision provenance.

## Migration Prerequisites

- Direct-write inventory.
- Artifact identity inventory.
- Revision-target availability.
- Actor provenance inventory.
- Legacy uncertainty handling.
- Additive migration first.
- Compatibility projection strategy.
- No invented historical decisions.

## Implementation Prerequisites

- Approve envelope fields and typed extension strategy.
- Approve authority assignment dependency.
- Define validation schemas and invariants.
- Define immutable append/update policy.
- Define service transaction boundaries.

## Data and Backfill Constraints

- Legacy mutable fields may be classified as `UNKNOWN` or projection-only.
- Backfills may record observed state, not fabricate rationale or approver.
- Historical timestamps must remain source-attributed.
- Additive tables must allow null/unknown legacy links where proof is absent.

## Security and Authority Implications

- Decisions must reference scoped authority assignments after `WEOS-OD-022`.
- Unauthorized decision creation must fail closed.
- Actor identity must not be restricted to application users.
- Execution identity and authority source must be distinct.
- Automation may execute but must not silently become the authority source.
- Service accounts, automation and system operations must be distinguishable.
- Human accountability must be preserved where the decision requires human authority.

## Audit and Observability Requirements

- Decision creation, rejection, supersession and stale-command rejection need observable records.
- Audit events may point to decisions but cannot replace them.
- Reports must detect decisions without typed payload validation.
- Actor and authority provenance must be queryable by execution actor, human authority source and scoped authority assignment.

## Acceptance Criteria

- Exact artifact/revision target is recorded.
- Execution actor type, execution actor identity, human authority source where required and scoped authority reference are recorded.
- Rationale and findings are recorded.
- Outcome and effect are recorded.
- Supersession linkage is supported.
- Typed validation is enforced.
- History is immutable.
- Audit events cannot substitute for decisions.

## Unresolved Questions

- Which domains need typed extension tables first?
- Which payload schemas can be enforced at TypeScript only versus database level?
- How should failed decision attempts be audited?
- Which decision types may permit non-human authority?
- What final actor-type vocabulary is sufficient without selecting schema prematurely?
- What historical decision provenance is provable?

## Dependencies

- Depends on `WEOS-OD-021` for approval/supersession authority.
- Feeds `WEOS-OD-022`, `WEOS-OD-023`, `WEOS-OD-019` and `WEOS-OD-024`.
- Relates to `WEOS-GAP-002`, `WEOS-GAP-006`, `WEOS-GAP-013` and `WEOS-CAP-013`.

## Exact Implementation Sequence After Approval

1. Select envelope strategy through human review.
2. Define TypeScript decision-envelope and typed payload contracts, including execution actor and authority-source provenance fields.
3. Define conformance tests separating decision, review, audit, validation and revision records.
4. Inventory direct writes, artifact/revision targets, execution actors, service accounts, automation paths and human authority sources.
5. Design additive persistence with immutable fields.
6. Add read-only repository adapters.
7. Pilot one domain only after authority and expected-version decisions are also approved.
8. Backfill observed legacy state without invented decisions.

## Approval Record

- Decision status: `OPEN`
- Approved option: `NOT_SELECTED`
- Approver: `NOT_RECORDED`
- Approval date: `NOT_RECORDED`
- Approval evidence: `NOT_RECORDED`
- Implementation authorization: `NOT_GRANTED`
