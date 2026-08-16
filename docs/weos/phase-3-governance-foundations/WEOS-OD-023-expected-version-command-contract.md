# WEOS-OD-023: Expected-Version Command Contract

## Document Control

- Decision ID: `WEOS-OD-023`
- Version: `0.1`
- Status: `Approved with conditions`
- Disposition: `APPROVED_WITH_CONDITIONS`
- Approval state: `APPROVED_WITH_CONDITIONS`
- Implementation authority: `GRANTED_FOR_STAGE_1_CONTRACTS_ONLY`
- Evidence baseline: `6f41136c21c9e854cbf231752d71939fab82bdac`
- Review date: `2026-07-29`

## Decision Question

What expected-version or concurrency token must governed mutation commands provide, and how must stale commands fail?

## Selected Decision

WEOS adopts Option D: a hybrid expected-state command contract.

Every governed command type must declare its concurrency policy. Each command instance must carry explicit expected-state preconditions for every authoritative dependency relevant to its requested effect.

Revisioned canonical artifacts use exact expected revision identifiers.

Mutable identity records or compatibility projections may use expected versions or approved server-issued opaque concurrency tokens where an exact revision identifier is unavailable or insufficient.

A command involving multiple authoritative dependencies must declare every dependency explicitly. A primary-target version must not silently represent other state that affects correctness.

Expected-state validation and authority validation are independent. Both must pass before a governed command may be considered eligible for mutation.

A stale or otherwise invalid command fails closed and produces:

- no canonical mutation;
- no resulting revision;
- no Governance Decision;
- no projection update;
- no partial batch effect;
- no duplicate effect through retry.

A rejected attempt may later be represented as an Audit Event under a separate approved policy. It must not be represented as a Governance Decision.

Stage 1 defines documentation, JSON schemas, serializable TypeScript contracts, pure registries, pure validation, pure stale-state comparison, pure idempotency resolution, pure batch-policy evaluation and deterministic conformance tests.

This decision does not authorize Prisma, migrations, database compare-and-swap, transactions, DTOs, controllers, services, command handlers, API responses, projection synchronization, audit persistence, token issuance, runtime idempotency storage or production enforcement.

## Approval Conditions

- Every governed command declares an approved concurrency contract.
- Revisioned canonical artifacts use exact expected revision identifiers.
- Every authoritative dependency is declared explicitly.
- Expected version and opaque-token use is registered and policy-defined.
- Authority and expected-state validation remain independent.
- Stale commands fail closed without mutation, projection update or Governance Decision.
- Governed batches are atomic by default.
- Idempotency cannot bypass concurrency or authority checks.
- Duplicate retries cannot produce duplicate effects.
- Stale commands are not silently rebased or automatically retried.
- Safe current-state details require disclosure authorization.
- Legacy concurrency history is not invented.
- Stage 1 does not claim current runtime command compliance, production enforcement, API 409 mapping, database concurrency safety, audit persistence, projection synchronization or token security.

## Why This Decision Is Blocking

Phase 2 evidence shows revision records and some transactions, but no universal `expectedVersion`, `expectedRevisionId` or equivalent stale-write contract. Unique version numbers prevent duplicate rows but do not prove that a command targeted the current version the actor reviewed.

## Scope

Expected-version inputs, stale-command failure semantics, transaction boundaries, compare-and-swap behavior, idempotency, command deduplication, batch mutation and projection update safety for governed mutation commands.

## Out of Scope

This decision does not alter DTOs, services, database schema, client behavior or existing transaction isolation. It does not select concrete column names for implementation.

## Current Repository Evidence

- `docs/weos/gaps/IMPLEMENTATION-GAPS.md` now marks `WEOS-GAP-004` partially mitigated by Stage 1 contract evidence.
- `docs/weos/capability-map/DATABASE-MODEL-MAP.md` states `CaseRevision` and `DiagnosisEducationRevision` uniqueness prevents duplicate version numbers only.
- `doctordle-backend/src/modules/admin/case-review.service.ts` uses serializable transactions on selected case paths but not a generic expected-version command input.
- `doctordle-backend/src/modules/education/diagnosis-education.service.ts` increments education version and creates revisions without a universal stale-write contract.
- `docs/weos/agent-rules/DO-NOT-GUESS.md` says revision support does not guarantee concurrency safety.

## Canonical Constraints

- Every governed mutation declares a concurrency contract.
- Stale commands fail consistently.
- Rejected stale commands produce no partial mutation and no governance decision.
- Direct service calls cannot bypass checks.
- Tests must prove race behavior deterministically.

## Terminology

- Expected version: command-declared version the actor intends to mutate.
- Expected revision ID: exact revision target the actor reviewed.
- Opaque token: server-issued concurrency token.
- Stale command: command whose expected version/revision/token no longer matches current governed state.
- Compare-and-swap: update that succeeds only when expected state still matches.

## Decision Drivers

- Race prevention.
- Clear API failure semantics.
- Projection synchronization safety.
- Command idempotency and retries.
- Batch mutation consistency.
- Deterministic tests for stale writes.

## Options Considered

### Option A - Integer artifact version

Commands carry `expectedVersion`. It is easy to inspect and store, but can be ambiguous when artifacts have both identity rows and revision rows.

### Option B - Exact revision ID

Commands carry `expectedRevisionId`. This is strong for revisioned artifacts such as `CaseRevision` and `DiagnosisEducationRevision`, but less direct for mutable identity/projection rows.

### Option C - Opaque concurrency token

Commands carry `expectedToken`. This can encode multiple dependencies, but is less transparent and requires token issuing and validation.

### Option D - Hybrid contract

Use revision ID for revisioned artifacts and version/token for mutable identity or projection records. This matches current mixed artifact shapes while requiring explicit contract declaration per command.

## Comparative Evaluation

| Criterion                 | Option A | Option B | Option C | Option D |
| ------------------------- | -------- | -------- | -------- | -------- |
| Revision safety           | Medium   | High     | High     | High     |
| Mutable projection safety | Medium   | Low      | High     | High     |
| Human readability         | High     | High     | Low      | Medium   |
| Implementation fit        | Medium   | Medium   | Medium   | High     |

## Recommended Direction for Human Architecture Review

Use a hybrid contract. Revisioned artifacts should require `expectedRevisionId`; mutable identity or projection records should require `expectedVersion` or an opaque token that captures all relevant dependencies. Failure should be `409 Conflict` with a stable machine-readable error code, current version/revision returned where safe, no partial mutation and no governance record on rejected stale command.

This recommendation is not an approval, does not resolve the decision, and does not grant implementation authority.

## Rejected Options and Reasons

- Reject relying on unique version numbers because uniqueness is not proof the actor reviewed the current version.
- Reject transaction isolation alone because it does not define command intent.
- Reject silent last-write-wins because projections and decisions can be corrupted.
- Reject creating governance records for rejected stale commands because no governed effect occurred.

## Consequences

### Positive

- Gives consistent stale-write behavior.
- Protects decisions, applications and projections.
- Enables deterministic tests.
- Makes retry behavior explicit.

### Negative

- Requires command DTO changes after approval.
- Requires service-level compare checks.
- Legacy clients need compatibility handling.

### Risks

- Incorrect token scope may miss dependencies.
- Returning current state may expose sensitive information if not filtered.
- Batch operations can be partially specified unless contract is strict.

### Compatibility Effects

- Existing commands remain unchanged until implementation approval.
- Compatibility projections must not update on stale rejection.
- Legacy rows without version data may require conservative unknown handling.

## Migration Prerequisites

- Inventory governed mutations and target artifacts.
- Inventory revision IDs, version fields and dependency projections.
- Define safe current-state response shape.
- Define idempotency and command-deduplication needs.

## Implementation Prerequisites

- Approve command contract schema.
- Define common stale-error code.
- Define service helper for compare-and-swap.
- Add deterministic race tests for pilot domain.

## Data and Backfill Constraints

- Backfill cannot prove previous commands were concurrency-safe.
- Legacy rows may need initialized version/token without invented decision history.
- Rejected commands may be audited separately as attempts, not decisions.

## Security and Authority Implications

- Stale failures prevent unauthorized overwrite of reviewed content.
- Actor authority and expected-version checks must both pass.
- Error responses must not leak forbidden artifact content.

## Audit and Observability Requirements

- Record stale rejection metrics and safe audit events.
- Monitor conflict rates.
- Report commands that lack declared concurrency contract.

## Acceptance Criteria

- Every governed mutation declares its concurrency contract.
- Stale commands are rejected consistently.
- Direct service calls cannot bypass checks.
- Rejected stale commands do not partially update projections.
- Tests can prove race behavior deterministically.

## Unresolved Questions

- Which commands require idempotency keys? Every governed command requires a unique `commandId`. An `idempotencyKey` is additionally mandatory when its registered contract represents client retry, queued delivery, automation, at-least-once delivery or external integration. Each command contract declares its idempotency policy.
- Which artifacts require multi-dependency tokens? Every authoritative dependency affecting command correctness must be declared. Typed exact-revision or expected-version preconditions are preferred. An opaque token may be used only where an approved token policy binds the complete declared dependency set. The production command inventory remains deferred.
- Should stale rejected attempts be persisted as audit events? A stale attempt may be classified as an Audit Event, never as a Governance Decision. Persistence, retention and sensitive-field policy remain deferred.
- How long should clients retry before refreshing? Stale conflicts are not transient retries. Clients must refresh or rebase before issuing a new command. Transport retries may reuse an existing idempotency key but must not alter the command fingerprint or expected-state preconditions. No retry duration is invented here.

## Dependencies

- Depends on `WEOS-OD-022` for actor/authority context.
- Blocks `WEOS-OD-019` projection synchronization and `WEOS-OD-024` controlled application.
- Primary decision for `WEOS-GAP-004`.

## Exact Implementation Sequence After Approval

1. Approve concurrency contract choice.
2. Catalogue governed commands and target artifacts.
3. Add TypeScript command-contract definitions.
4. Add conformance tests requiring contract declarations.
5. Design additive storage/version fields if needed.
6. Implement read-only helpers.
7. Pilot compare-and-swap in one command.
8. Roll out stale failure semantics and projection rollback guarantees.

## Approval Record

- Decision status: `APPROVED_WITH_CONDITIONS`
- Approved option: `OPTION_D_HYBRID_EXPECTED_REVISION_VERSION_AND_TOKEN_CONTRACT`
- Approver: `Gideon Lemasika Saningo`
- Approver role: `Founding Architecture Authority`
- Approval date: `2026-08-01`
- Approval evidence: `docs/weos/authority/records/document-approvals/WEOS-AUTH-APP-004.json`
- Authority basis: `docs/weos/authority/records/document-approvals/WEOS-AUTH-APP-001.json`
- Dependency evidence: `docs/weos/authority/records/document-approvals/WEOS-AUTH-APP-003.json`
- Supporting foundation: `docs/weos/authority/records/document-approvals/WEOS-AUTH-APP-002.json`
- Conditions:
  - every governed command declares an approved concurrency contract;
  - revisioned canonical artifacts use exact expected revision identifiers;
  - every authoritative dependency is declared explicitly;
  - version and opaque-token policies are registered and approved;
  - authority and expected-state validation remain independent;
  - stale commands fail closed without mutation or Governance Decision;
  - governed batches are atomic by default;
  - idempotency cannot bypass concurrency or authority;
  - retries cannot create duplicate effects;
  - stale commands are not silently rebased or automatically retried;
  - safe current-state details require disclosure authorization;
  - legacy concurrency history is not invented;
  - no persistence, runtime integration or enforcement is authorized.
- Implementation authorization: `GRANTED_FOR_STAGE_1_CONTRACTS_ONLY`
