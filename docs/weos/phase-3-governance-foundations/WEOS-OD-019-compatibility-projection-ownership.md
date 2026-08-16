# WEOS-OD-019: Compatibility Projection Ownership

## Document Control

- Decision ID: `WEOS-OD-019`
- Version: `0.1`
- Status: `Approved with conditions`
- Disposition: `APPROVED_WITH_CONDITIONS`
- Approval state: `APPROVED_WITH_CONDITIONS`
- Implementation authority: `GRANTED_FOR_STAGE_1_CONTRACTS_ONLY`
- Evidence baseline: `6f41136c21c9e854cbf231752d71939fab82bdac`
- Review date: `2026-07-29`

## Decision Question

Who owns each legacy or current-state compatibility projection, and may it be written directly or only derived through governed command handlers?

## Selected Decision

WEOS adopts Option D: a transitional hybrid projection-ownership model with an explicit end state of canonical-record ownership and restricted compatibility projection writes.

Every operational compatibility projection requires one approved canonical owner.

Canonical owners may include an approved Governance Decision, immutable artifact revision, lifecycle record, publication record, controlled-application result or another separately approved canonical record type.

Projection fields do not independently establish:

- approval;
- publication;
- playability;
- generatability;
- learner exposure;
- lifecycle standing;
- clinical authority;
- institutional authority.

During migration, a projection may use one approved strategy:

- `DERIVED_ON_READ`;
- `ATOMIC_SYNCHRONOUS`;
- `ASYNCHRONOUS_BOUNDED_DRIFT`;
- `LEGACY_OBSERVED_ONLY`;
- `DEPRECATED`.

An unresolved legacy projection remains explicitly unresolved. Its current value must not be interpreted as proven canonical history.

Once an approved canonical owner and governed writer exist, ordinary direct writes are prohibited.

Temporary compatibility writes require explicit transitional metadata and must not create or alter canonical authority.

Stage 1 defines documentation, metadata contracts, schemas, pure registries, pure validation, drift classification, future synchronization eligibility, repair eligibility, deprecation checks and deterministic conformance tests.

This decision does not authorize Prisma, migrations, persistence, projection synchronization, backfill, repair execution, direct-write enforcement, command-handler integration, consumer migration or field removal.

## Current Repository Evidence

- `doctordle-backend/prisma/schema.prisma` contains `Case.editorialStatus`, `approvedAt`, `approvedByUserId`, `publishedAt`, `DiagnosisEducation.editorialStatus`, `reviewedAt`, `publishedAt`, `DiagnosisRegistry.status`, `active`, `isPlayable` and `isGeneratable`.
- `docs/weos/capability-map/DATABASE-MODEL-MAP.md` classifies many of these as `COMPATIBILITY_PROJECTION` or mutable current state.
- `doctordle-backend/src/modules/admin/case-review.service.ts` writes case status and approval projections.
- `doctordle-backend/src/modules/education/diagnosis-education.service.ts` writes education status/revision projections.
- `docs/weos/gaps/IMPLEMENTATION-GAPS.md` identifies `WEOS-GAP-010` as the primary canonical-record-versus-compatibility-projection gap.
- Runtime field locations, current service writers, admin access and historical convention are evidence only. They do not establish canonical ownership.

## Mandatory Conditions

### One Canonical Owner

Each projection definition declares one ownership status:

- `APPROVED_CANONICAL_OWNER`;
- `UNRESOLVED_OWNER`;
- `DEPRECATED_NO_OWNER_REQUIRED`.

Approved ownership requires exactly one canonical-owner definition: `canonicalOwnerType`, `canonicalOwnerReference`, `canonicalOwnerDecisionType`, `canonicalOwnerSchemaVersion` and `supportingApprovalRecordId`.

Unresolved ownership cannot invent an owner, claim authoritative synchronization or authorize automatic repair. Deprecated projections require deprecation criteria and no current governed consumer dependency.

### Ownership Is Semantic

Ownership requires approved repository-visible metadata and approval evidence. Prisma model location, database field location, current service writer, frontend consumer, most recent writer, runtime role, admin access, historical convention and field name do not establish ownership.

### Synchronization Strategy

Supported strategies are `DERIVED_ON_READ`, `ATOMIC_SYNCHRONOUS`, `ASYNCHRONOUS_BOUNDED_DRIFT`, `LEGACY_OBSERVED_ONLY` and `DEPRECATED`.

`DERIVED_ON_READ` requires a declared canonical source and deterministic derivation, and prohibits independent writes. `ATOMIC_SYNCHRONOUS` requires the future canonical effect and projection update to share a declared atomic application boundary. `ASYNCHRONOUS_BOUNDED_DRIFT` requires a complete approved drift policy and must not be selected by default for authority-sensitive projections. `LEGACY_OBSERVED_ONLY` preserves observed compatibility state without canonical provenance. `DEPRECATED` requires consumer-removal and removal-readiness criteria.

### Authority-Sensitive Defaults

Projection sensitivity supports `AUTHORITY_SENSITIVE`, `LEARNER_EXPOSURE_GATING`, `OPERATIONAL_ELIGIBILITY`, `NON_AUTHORITY_COMPATIBILITY` and `UNKNOWN`.

Authority-sensitive and learner-exposure-gating projections default to `DERIVED_ON_READ` or `ATOMIC_SYNCHRONOUS`. Asynchronous bounded drift requires explicit approval evidence, proof the drift window cannot produce unauthorized effects and a complete policy.

### Writer Policy

Each definition declares exactly one writer policy: `GOVERNED_HANDLER_ONLY`, `DERIVATION_ONLY`, `TEMPORARY_COMPATIBILITY_WRITE`, `OBSERVE_ONLY` or `NO_WRITES`.

`DERIVATION_ONLY` aligns with derived-on-read and allows no direct writer. `GOVERNED_HANDLER_ONLY` requires approved ownership and future authority plus expected-state eligibility. `TEMPORARY_COMPATIBILITY_WRITE` requires rationale, allowed writer references, expiry condition, migration milestone, audit classification and transitional approval evidence. `OBSERVE_ONLY` and `NO_WRITES` cannot produce projection mutation.

### Inventory, Drift and Repair

Writer and reader inventories are independent. Incomplete inventory remains visibly incomplete; empty writer lists are not proof of no writers unless inventory is complete and supported by evidence.

Future application order is authority validation, expected-state validation, Governance Decision, canonical effect or revision and only then compatibility projection synchronization. A projection must never be updated first and then treated as evidence of canonical decision.

Stale commands, rejected authority, invalid commands and successful idempotent replay permit no projection update.

Drift evaluation is pure, receives explicit snapshots and evaluation time, reads no database or files, mutates no input and performs no repair. Repair eligibility is declarative only, requires separately proven authority and expected-state eligibility, and cannot invent a Governance Decision, approver, rationale, timestamp or canonical effect.

Legacy observations record observed values only. Unknown legacy state remains unknown.

## Resolved Unresolved Questions

Which projections can be derived immediately?

A projection may become `DERIVED_ON_READ` only after its canonical owner, derivation rule and required source fields are approved and complete. OD-019 does not declare any representative projection immediately derivable.

Which runtime reads require compatibility fields indefinitely?

Compatibility retention is consumer-driven and transitional. Each projection definition records known consumers and deprecation criteria. No projection becomes permanent merely because current runtime code reads it.

What drift windows are acceptable?

No universal drift window exists. Each asynchronous projection requires a projection-specific approved policy. Authority-sensitive and learner-exposure-gating projections default to no tolerated asynchronous drift unless separately approved.

Who may authorize repair?

Repair requires separately proven controlled-application or operational permission authority, expected-state eligibility and an approved repair policy. OD-019 Stage 1 does not grant repair authority. Permanent repair-authority semantics remain deferred to OD-024 or an approved successor.

## Conservative Production Registry

The initial production projection registry and inventory are empty. OD-019 does not create production entries for `Case.editorialStatus`, `Case.approvedAt`, `Case.approvedByUserId`, `Case.publishedAt`, `DiagnosisEducation.editorialStatus`, `DiagnosisEducation.reviewedAt`, `DiagnosisEducation.publishedAt`, `DiagnosisRegistry.status`, `DiagnosisRegistry.active`, `DiagnosisRegistry.isPlayable` or `DiagnosisRegistry.isGeneratable`.

Representative classifications remain migration analysis only.

## Dependencies

- Depends on `WEOS-OD-023` for stale command safety and idempotency replay handling.
- Uses `WEOS-AUTH-APP-004` as dependency evidence.
- Uses `WEOS-AUTH-APP-002` and `WEOS-AUTH-APP-003` as supporting foundations.
- Feeds `WEOS-OD-024`, `WEOS-OD-025` and downstream publication/history decisions without broadening into authority, publication or concurrency ownership.

## Approval Record

- Decision status: `APPROVED_WITH_CONDITIONS`
- Approved option: `OPTION_D_TRANSITIONAL_HYBRID_CANONICAL_OWNER_AND_CONTROLLED_PROJECTIONS`
- Approver: `Gideon Lemasika Saningo`
- Approver role: `Founding Architecture Authority`
- Approval date: `2026-08-02`
- Approval evidence: `docs/weos/authority/records/document-approvals/WEOS-AUTH-APP-005.json`
- Authority basis: `docs/weos/authority/records/document-approvals/WEOS-AUTH-APP-001.json`
- Dependency evidence: `docs/weos/authority/records/document-approvals/WEOS-AUTH-APP-004.json`
- Supporting foundations:
  - `docs/weos/authority/records/document-approvals/WEOS-AUTH-APP-002.json`
  - `docs/weos/authority/records/document-approvals/WEOS-AUTH-APP-003.json`
- Conditions:
  - projections never independently establish canonical authority;
  - every operational projection requires exactly one approved canonical owner;
  - unresolved ownership remains explicitly unresolved;
  - synchronization strategy and writer policy are declared per projection;
  - authority-sensitive projections default to derived or atomic treatment;
  - direct writes become prohibited after governed ownership exists;
  - stale or unauthorized commands update neither canonical state nor projections;
  - asynchronous drift requires an explicit bounded-drift policy;
  - drift detection does not authorize repair;
  - repair cannot invent governance history;
  - legacy projection values remain observed state without proven provenance;
  - production ownership is not invented;
  - no persistence, backfill, synchronization, repair execution or runtime enforcement is authorized.
- Implementation authorization: `GRANTED_FOR_STAGE_1_CONTRACTS_ONLY`
