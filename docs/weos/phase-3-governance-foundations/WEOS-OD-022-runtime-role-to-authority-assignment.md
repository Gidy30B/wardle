# WEOS-OD-022: Runtime Role to Authority Assignment

## Document Control

- Decision ID: `WEOS-OD-022`
- Version: `0.1`
- Status: `Approved with conditions`
- Disposition: `APPROVED_WITH_CONDITIONS`
- Approval state: `APPROVED_WITH_CONDITIONS`
- Implementation authority: `GRANTED_FOR_STAGE_1_CONTRACTS_ONLY`
- Evidence baseline: `6f41136c21c9e854cbf231752d71939fab82bdac`
- Review date: `2026-07-29`
- Approval date: `2026-08-01`
- Effective date: `2026-08-01`

## Decision Question

How are technical runtime roles mapped, if at all, to scoped canonical or institutional authority for governed actions?

## Selected Decision

Selected option: `OPTION_D_HYBRID_TECHNICAL_ACCESS_AND_SCOPED_AUTHORITY`.

Runtime access remains necessary where technical operation requires it, but runtime roles, guards, frontend visibility and state eligibility never establish canonical authority. Authority-bearing governed actions require independently validated, scoped `AuthorityAssignment` records.

The model distinguishes `runtimeRoles`, `actorType`, `actorId`, `authorityAssignmentId`, `authorityType` and `humanAuthorityActorId`. Runtime roles are technical-access only; execution actor identity is not automatically the authority source; authority is not collapsed into a user-role field.

Actor and subject categories are compatible with WEOS-OD-018: `USER`, `SERVICE_ACCOUNT`, `AUTOMATION` and `SYSTEM`.

## Why This Decision Is Blocking

`docs/weos/capability-map/PERMISSION-MAP.md` proves route access for `user`, `editor`, `senior_editor` and `admin`, but explicitly warns that runtime access is not canonical authority. Governed mutation cannot safely rely on route roles alone.

## Scope

Stage 1 authorizes repository-native documentation, `WEOS-AUTH-APP-003`, JSON schemas, TypeScript serializable contracts, pure in-memory authority-type registry, pure validation, actor-command-context validation, authority resolution, scope evaluation, grant non-escalation, delegation, separation-of-duties and deterministic conformance tests.

## Out of Scope

This decision does not authorize Prisma, migrations, database persistence, production `AuthorityAssignment` records, real grants, institutional authority claims, automatic role-derived authority, repositories, Nest modules/providers/controllers/routes/guards/auth-role changes, runtime services, command handlers, dashboards, production enforcement, break-glass, backfill or deployment.

## Current Repository Evidence

- `doctordle-backend/src/auth/roles.ts` defines `user`, `editor`, `senior_editor`, `admin` and helpers including `canPublishEditorial`.
- `doctordle-backend/src/auth/editorial.guard.ts` enforces editor and senior-editor route access.
- `doctordle-backend/src/modules/admin/admin.guard.ts` lets `admin` pass and uses editorial metadata for editor/senior access.
- `docs/weos/capability-map/PERMISSION-MAP.md` says `canPublishEditorial` is a runtime compatibility name, not canonical publication authority.
- `docs/weos/gaps/IMPLEMENTATION-GAPS.md` marks runtime role to canonical authority assignment as `WEOS-GAP-008`.
- `WEOS-AUTH-APP-002` approves WEOS-OD-018 Stage 1 decision-envelope contracts used by this decision's authority evidence shape.

## Canonical Constraints

- Runtime access is not canonical authority.
- Admin technical override is not by itself editorial or institutional authority.
- Frontend visibility and state gates cannot prove authority.
- Governed services need actor and authority context.
- Authority must be scoped, auditable, revocable and fail closed.

## Terminology

- Runtime role: application role used by guards.
- Execution actor: the actor performing a command at runtime.
- Canonical authority: WEOS authority to make a governed decision.
- Institutional authority: external or organizational authorization represented in repository-visible form only after approval.
- AuthorityAssignment: scoped grant binding subject, authority type, scope, decision type, evidence and validity window.
- Break-glass: emergency technical path requiring a separate governance decision.

## Options Considered

### Option A - Runtime roles directly imply authority

`editor`, `senior_editor` or `admin` would imply governed authority. This is unsafe because route access and canonical authority are distinct, admin can be technical, and role names do not encode scope, expiry, conflict or rationale.

### Option B - Separate scoped authority assignments

Introduce scoped `AuthorityAssignment` records. This is auditable and scoped but needs persistence and service integration.

### Option C - Policy matrix without persisted assignments

A static matrix maps roles to decisions. This is simple but weak for audit, expiry, organization scope and individual exceptions.

### Option D - Hybrid technical access plus scoped authority

Route role permits access; authority assignment permits governed decision. Admin override grants operational access but not canonical decision authority unless a scoped assignment exists.

## Approval Conditions

- Authority types are governed powers independent of runtime roles; `USER`, `EDITOR`, `SENIOR_EDITOR` and `ADMIN` are not authority types.
- Illustrative authority powers include `DOCUMENT_ARCHITECTURE_APPROVAL`, `AUTHORITY_ASSIGNMENT_GRANT`, `EDITORIAL_REVIEW`, `EDITORIAL_APPROVAL`, `PUBLICATION_AUTHORIZATION`, `GRAPH_PROMOTION`, `CONTROLLED_APPLICATION` and `OPERATIONAL_PERMISSION`; these examples are not approved production registrations.
- Scope supports `organizationIds[]`, `specialtyIds[]`, `artifactTypes[]`, `artifactIds[]`, `artifactRevisionIds[]`, `decisionTypes[]` and `environmentScopes[]` with intersection semantics. Missing or empty scope fields must not silently mean global.
- Scope mode is `SCOPED` or `GLOBAL`. Global authority is valid only where approved authority-type policy permits it and requires explicit rationale, enhanced evidence, authorized grantor, expiry or review and explicit global marking. Empty scope is never global.
- Grant-time evidence preserves `authorityEvidenceReference`, `grantingAuthoritySnapshot`, `grantedByActorType`, `grantedByActorId`, `grantingAuthorityAssignmentId`, `grantedAt`, `validFrom`, `validUntil` and `reviewDueAt`.
- Decision-time authority evidence remains compatible with WEOS-OD-018 fields: `authorityAssignmentId`, `authorityEvidenceReference`, `authorityScopeSnapshot` and `authorityResolvedAt`.
- Standing values are `PENDING`, `ACTIVE`, `SUSPENDED`, `EXPIRED`, `REVOKED`, `SUPERSEDED` and `INVALID`. Only active, currently valid assignments may authorize.
- Expiry or revocation prevents future use but does not rewrite historical authority evidence snapshots.
- Granting an assignment requires separately proven `AUTHORITY_ASSIGNMENT_GRANT` authority; a grantor cannot grant an unpermitted type, broader scope, longer validity, delegation rights not held or greater delegation depth.
- Delegation is denied by default and must reject missing permission, circular delegation, self-parenting, self-originating grants and scope or duration escalation.
- Separation-of-duties rules are policy driven. Initial rule identifiers include `AUTHOR_CANNOT_BE_SOLE_FINAL_APPROVER`, `REQUESTER_CANNOT_BE_FINAL_AUTHORITY`, `ASSIGNMENT_REQUESTER_CANNOT_BE_SOLE_GRANT_APPROVER` and `PROTECTED_FIELD_REQUESTER_AND_APPROVER_MUST_DIFFER`.
- Ordinary assignments do not establish emergency or break-glass authority. Fields such as `isEmergencyOverride`, `bypassAuthority` or `skipGovernance` are not authorized.
- Authority must not be backfilled from runtime role, admin status, repository ownership, GitHub permissions, dashboard access, employment title, profile specialty, organization profile, previous action, mutable status or frontend visibility. Unknown remains unknown.
- Bootstrap authority remains valid only within its recorded scope and is not converted into a permanent production `AuthorityAssignment`.
- Production authority-type registry and production assignment collection remain empty in Stage 1. Test-only authority types and assignments may appear only in tests.

## Comparative Evaluation

| Criterion              | Option A | Option B | Option C | Option D |
| ---------------------- | -------- | -------- | -------- | -------- |
| Safety                 | Low      | High     | Medium   | High     |
| Auditability           | Low      | High     | Low      | High     |
| Operational simplicity | High     | Medium   | High     | Medium   |
| Scope/expiry support   | Low      | High     | Low      | High     |

## Rejected Options and Reasons

- Reject direct role authority because `admin` and `senior_editor` prove runtime access only.
- Reject frontend visibility as authority because it is not backend enforcement.
- Reject state gates as permission because eligibility and authority are separate.
- Reject static-only policy because revocation, expiry and scope need audit.

## Consequences

### Positive

- Clarifies actor authority before mutation.
- Supports organization, specialty and artifact scopes.
- Enables future emergency/break-glass design without redefining admin.
- Makes service-level enforcement testable.

### Negative

- Requires future authority persistence and actor-context propagation.
- Existing routes need gradual adaptation after later authorization.
- More commands may fail once authority assignments are configured.

### Risks

- Misconfigured assignments could block legitimate work or permit excess authority.
- Emergency override could bypass governance if not separately audited.
- Service paths not receiving actor context may remain unsafe until later enforcement work.

### Compatibility Effects

- Existing route permissions continue for access.
- Compatibility UI can still show actions but must not claim authority.
- Legacy rows may have unknown authority provenance.
- WEOS-OD-018 authority evidence snapshots remain the decision-time evidence shape.

## Unresolved Questions

- Who grants authority assignments? Resolved for Stage 1: a grantor must hold separately proven `AUTHORITY_ASSIGNMENT_GRANT` covering the requested authority type, scope and duration. Permanent hierarchy is deferred.
- What scope dimensions are mandatory? Resolved for Stage 1: subject, authority type, allowed decision type, scope mode and validity are mandatory; organization, specialty, artifact, revision and environment dimensions are mandatory where the registered authority-type policy requires them.
- How are service accounts represented? Resolved for Stage 1: `SERVICE_ACCOUNT` is a distinct subject and actor category; service-account execution is not human or institutional authority by itself.
- What is the emergency review deadline? Deferred to a future emergency or break-glass decision; no deadline is invented here.

## Dependencies

- Depends on `WEOS-OD-018` for decision references and authority evidence shape.
- Uses `WEOS-AUTH-APP-002` as dependency evidence.
- Blocks `WEOS-OD-023` command enforcement and `WEOS-OD-024` controlled application.
- Registers primary decision for `WEOS-GAP-008`.

## Exact Implementation Sequence After Approval

1. Define authority assignment TypeScript contract.
2. Define actor command context.
3. Define authority-type registry contract.
4. Add pure validation, scope evaluation, grant non-escalation, delegation, separation-of-duties and resolution utilities.
5. Add conformance tests proving route role is not authority.
6. Keep production registry and assignment collection empty.
7. Defer additive authority persistence until separately approved.
8. Defer runtime command-handler enforcement until WEOS-OD-023 or successor approval.

## Approval Record

- Decision status: `APPROVED_WITH_CONDITIONS`
- Approved option: `OPTION_D_HYBRID_TECHNICAL_ACCESS_AND_SCOPED_AUTHORITY`
- Approver: `Gideon Lemasika Saningo`
- Approver role: `Founding Architecture Authority`
- Approval date: `2026-08-01`
- Approval evidence: `docs/weos/authority/records/document-approvals/WEOS-AUTH-APP-003.json`
- Authority basis: `docs/weos/authority/records/document-approvals/WEOS-AUTH-APP-001.json`
- Dependency evidence: `docs/weos/authority/records/document-approvals/WEOS-AUTH-APP-002.json`
- Conditions: runtime/canonical authority separation; scoped `AuthorityAssignment`; authority types independent from runtime roles; fail-closed validation and resolution; explicit global authority; preserved grant and decision evidence; distinct grant authority; non-escalation; delegation denied by default; policy-driven separation-of-duties; non-human execution is not human authority; break-glass excluded; role/profile/frontend backfill prohibited; bootstrap not converted; no production assignments, persistence or runtime enforcement.
- Implementation authorization: `GRANTED_FOR_STAGE_1_CONTRACTS_ONLY`
