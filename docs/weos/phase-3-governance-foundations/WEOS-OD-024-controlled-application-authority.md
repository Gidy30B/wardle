# WEOS-OD-024: Controlled Application Authority

## Document Control

- Decision ID: `WEOS-OD-024`
- Version: `0.1`
- Status: `Draft`
- Disposition: `REVIEW_REQUIRED`
- Approval state: `NOT_APPROVED`
- Implementation authority: `NOT_GRANTED`
- Evidence baseline: `6f41136c21c9e854cbf231752d71939fab82bdac`
- Review date: `2026-07-29`

## Decision Question

What record and authority are required to apply an accepted proposal, AI draft, clue change or editorial recommendation to a governed artifact?

## Why This Decision Is Blocking

Phase 2 evidence shows candidate and draft records that can be reviewed and then applied to mutable runtime state. Without a controlled application record, acceptance, approval, authorization, application, resulting revision, validation and publication can be conflated.

## Scope

Controlled application of accepted proposals, AI drafts, clue changes, education generation outputs, teaching-rule changes, graph candidate promotion and editorial recommendations to governed artifacts.

## Out of Scope

This decision does not implement application records, alter clue draft workflows, approve applying any pending draft, define UI affordances, or authorize production mutation.

## Current Repository Evidence

- `doctordle-backend/prisma/schema.prisma` contains `CaseClueRevisionDraft` with reviewer, decision and application fields, and `AiDraftRevisionAudit` with review state.
- `doctordle-backend/src/modules/admin/diagnosis-editorial-workspace.service.ts` performs clue and AI draft workflow operations.
- `docs/weos/capability-map/DATABASE-MODEL-MAP.md` classifies `CaseClueRevisionDraft` as a mutable candidate record and notes no generic controlled-application record.
- `docs/weos/capability-map/RUNTIME-ACTION-CROSSWALK.md` includes `APPLY_ACCEPTED_DRAFT` as controlled application language.
- `docs/weos/gaps/IMPLEMENTATION-GAPS.md` marks `WEOS-GAP-013` open.

## Canonical Constraints

- Proposal, acceptance, approval, authorization, application, resulting revision, validation, publication and graph promotion are distinct.
- Acceptance alone cannot mutate governed content.
- Application requires authority and exact target revision/version.
- Resulting revision and failure state must be recorded.
- Application does not imply approval, publication or graph promotion.
- Controlled application does not solve stable clue identity. A clue-level application cannot be considered safely targetable while its identity depends only on JSON-array position or order. `WEOS-OD-007` remains controlling for stable revision-local clue identity.
- A controlled application record may prove execution of an already authorized graph promotion, but it does not approve the graph candidate, authorize merge or grant graph-fact promotion authority. `WEOS-OD-005` remains controlling for candidate approval, merge and graph-fact promotion separation.

## Terminology

- Proposal: candidate change suggestion.
- Acceptance: human decision that proposal is acceptable for possible application.
- Approval: governed decision about artifact standing.
- Authorization: authority check permitting application.
- Application: operational execution against target artifact.
- Resulting revision: content snapshot produced by successful application.
- Validation: separate downstream assessment standing.
- Publication: separate downstream release authority and exposure standing.
- Graph promotion: separate graph-fact promotion authority governed by `WEOS-OD-005`.

## Decision Drivers

- Prevent conflation of accepted and applied.
- Preserve exact target and resulting revision.
- Support retries and idempotency.
- Separate human actor from automation identity.
- Support rollback/failure evidence.

## Options Considered

### Option A - Acceptance immediately applies change

Acceptance mutates the target. This is unsafe because acceptance, authorization and application have different authority and failure semantics.

### Option B - Separate controlled application record

Candidate fields include `id`, `sourceProposalType`, `sourceProposalId`, `targetArtifactType`, `targetArtifactId`, `targetRevisionId`, `expectedVersion`, `applicationType`, `actorUserId`, `authorityAssignmentId`, `rationale`, `resultingRevisionId`, `status`, `appliedAt`, `failureReason` and `governanceDecisionId`. This creates clear execution evidence.

### Option C - Application represented only as governance-decision effect

A decision records the intended effect. This may be sufficient for very simple operations but does not prove execution, retries, failure or resulting revision.

### Option D - Hybrid governance decision plus controlled application record

Decision authorizes; application record proves execution and resulting revision. This separates authority from operational result.

## Comparative Evaluation

| Criterion                 | Option A | Option B | Option C | Option D |
| ------------------------- | -------- | -------- | -------- | -------- |
| Semantic clarity          | Low      | High     | Medium   | High     |
| Execution proof           | Low      | High     | Low      | High     |
| Authority separation      | Low      | Medium   | High     | High     |
| Retry/idempotency support | Low      | High     | Medium   | High     |

## Recommended Direction for Human Architecture Review

Use the hybrid model: a governance decision authorizes application, and a controlled application record records execution, expected version, actor/automation identity, status, failure or resulting revision. This must preserve separation among proposal, acceptance, approval, authorization, application, resulting revision, validation, publication and graph promotion.

This recommendation is not an approval, does not resolve the decision, and does not grant implementation authority.

## Rejected Options and Reasons

- Reject acceptance-as-application because it collapses proposal workflow into governed mutation.
- Reject application-only-without-decision for authority-bearing changes.
- Reject decision-only execution evidence where retries, failures or resulting revisions matter.

## Consequences

### Positive

- Clear chain from proposal to decision to application to revision.
- Better failure and retry audit.
- Safer AI/clue/graph workflows.
- Future publication can target resulting revision separately.

### Negative

- Requires more records and command orchestration.
- Existing workflows need migration shims.
- UI may need to display multiple states.

### Risks

- Poor idempotency can duplicate resulting revisions.
- Automation identity may obscure human authority if not separated.
- Rollback semantics can be hard for graph or projection effects.

### Compatibility Effects

- Current draft records remain compatibility/workflow records.
- Existing application paths may continue until governed handlers replace them.
- Projection updates must follow `WEOS-OD-019` ownership.

## Migration Prerequisites

- Inventory proposal types and target artifacts.
- Define target revision/version contract from `WEOS-OD-023`.
- Define authority requirements from `WEOS-OD-022`.
- Define resulting revision linkage per artifact.

## Implementation Prerequisites

- Approve controlled application contract.
- Define idempotency key semantics.
- Define failure and rollback statuses.
- Define transaction boundaries between decision, application and projection.

## Data and Backfill Constraints

- Do not backfill successful application records unless exact source, target and result are provable.
- Unknown legacy application state remains unknown.
- Failed legacy attempts are not inferred from missing result.

## Security and Authority Implications

- Application requires authority separate from route access.
- Automation may execute but must reference authorizing human/governance decision.
- Failed application must not imply success.

## Audit and Observability Requirements

- Record requested, started, applied, failed and superseded application states.
- Monitor retries and stale application attempts.
- Link application logs to decision and resulting revision where present.

## Acceptance Criteria

- Acceptance alone cannot mutate governed content.
- Application requires authority.
- Exact target revision/version is declared.
- Resulting revision is recorded.
- Retries are idempotent.
- Failed application does not imply success.
- Application does not imply approval, publication or graph promotion.
- Controlled application does not solve stable clue identity. A clue-level application cannot be considered safely targetable while its identity depends only on JSON-array position or order. `WEOS-OD-007` remains controlling for stable revision-local clue identity.
- A controlled application record may prove execution of an already authorized graph promotion, but it does not approve the graph candidate, authorize merge or grant graph-fact promotion authority. `WEOS-OD-005` remains controlling for candidate approval, merge and graph-fact promotion separation.

## Unresolved Questions

- Which proposal types need separate source records?
- Which applications can be synchronous?
- How are rollback and compensating actions represented?
- The recommended initial pilot is case review/approval targeting an exact `CaseRevision`; controlled clue application remains blocked until `WEOS-OD-007` is approved and stable revision-local clue identity has been implemented and tested.

## Dependencies

- Depends on `WEOS-OD-005` for graph approval, merge and promotion authority.
- Depends on `WEOS-OD-007` for stable clue targeting.
- Depends on `WEOS-OD-018` for the governance decision envelope.
- Depends on `WEOS-OD-022` for authority.
- Depends on `WEOS-OD-023` for expected-version safety.
- Depends on `WEOS-OD-019` for projection synchronization.
- Primary decision for `WEOS-GAP-013`.

## Exact Implementation Sequence After Approval

1. Approve controlled-application architecture.
2. Define source proposal taxonomy.
3. Define command contract with expected version.
4. Define application statuses and idempotency.
5. Add TypeScript contracts and conformance tests.
6. Design additive persistence.
7. Pilot case review/approval targeting an exact `CaseRevision`.
8. Consider controlled clue application only after `WEOS-OD-007` is approved and stable revision-local clue identity has been implemented and tested.
9. Restrict acceptance paths from mutating directly after rollout.

## Approval Record

- Decision status: `OPEN`
- Approved option: `NOT_SELECTED`
- Approver: `NOT_RECORDED`
- Approval date: `NOT_RECORDED`
- Approval evidence: `NOT_RECORDED`
- Implementation authorization: `NOT_GRANTED`
