# WEOS-OD-022: Runtime Role to Authority Assignment

## Document Control

- Decision ID: `WEOS-OD-022`
- Version: `0.1`
- Status: `Draft`
- Disposition: `REVIEW_REQUIRED`
- Approval state: `NOT_APPROVED`
- Implementation authority: `NOT_GRANTED`
- Evidence baseline: `6f41136c21c9e854cbf231752d71939fab82bdac`
- Review date: `2026-07-29`

## Decision Question

How are technical runtime roles mapped, if at all, to scoped canonical or institutional authority for governed actions?

## Why This Decision Is Blocking

`docs/weos/capability-map/PERMISSION-MAP.md` proves route access for `user`, `editor`, `senior_editor` and `admin`, but explicitly warns that runtime access is not canonical authority. Governed mutation cannot safely rely on route roles alone.

## Scope

Mapping between runtime roles, actor context, scoped authority assignments, governed decision types, organization/specialty scope, expiry, revocation and service-level enforcement.

## Out of Scope

This decision does not change current guards, assign real institutional authority, grant emergency powers, modify user roles, or authorize governed mutation.

## Current Repository Evidence

- `doctordle-backend/src/auth/roles.ts` defines `user`, `editor`, `senior_editor`, `admin` and helpers including `canPublishEditorial`.
- `doctordle-backend/src/auth/editorial.guard.ts` enforces editor and senior-editor route access.
- `doctordle-backend/src/modules/admin/admin.guard.ts` lets `admin` pass and uses editorial metadata for editor/senior access.
- `docs/weos/capability-map/PERMISSION-MAP.md` says `canPublishEditorial` is a runtime compatibility name, not canonical publication authority.
- `docs/weos/gaps/IMPLEMENTATION-GAPS.md` marks runtime role to canonical authority assignment as `WEOS-GAP-008`.

## Canonical Constraints

- Runtime access is not canonical authority.
- Admin technical override is not by itself editorial or institutional authority.
- Frontend visibility and state gates cannot prove authority.
- Governed services need actor and authority context.
- Authority must be scoped, auditable, revocable and fail closed.

## Terminology

- Runtime role: application role used by guards.
- Canonical authority: WEOS authority to make a governed decision.
- Institutional authority: external or organizational authorization represented in repository-visible form only after approval.
- AuthorityAssignment: proposed scoped grant binding actor, authority type, scope, decision type and validity window.
- Break-glass: emergency technical path requiring post-hoc governance.

## Decision Drivers

- Safety of autonomous mutation.
- Service-level enforcement rather than route-only checks.
- Organization and specialty scoping.
- Expiry, revocation and audit.
- Separation of ordinary editor work from authority-bearing decisions.

## Options Considered

### Option A - Runtime roles directly imply authority

`editor`, `senior_editor` or `admin` would imply governed authority. This is unsafe because route access and canonical authority are distinct, admin can be technical, and role names do not encode scope, expiry, conflict or rationale.

### Option B - Separate scoped authority assignments

Introduce concepts such as `AuthorityAssignment`, `authorityType`, `scopeType`, `scopeId`, `artifactType`, `allowedDecisionTypes`, `validFrom`, `validUntil`, `grantedBy`, `revokedAt` and `rationale`. This is auditable and scoped but needs persistence and service integration.

### Option C - Policy matrix without persisted assignments

A static matrix maps roles to decisions. This is simple but weak for audit, expiry, organization scope and individual exceptions.

### Option D - Hybrid technical access plus scoped authority

Route role permits access; authority assignment permits governed decision. Admin override grants operational access but not canonical decision authority unless a scoped assignment exists.

## Comparative Evaluation

| Criterion              | Option A | Option B | Option C | Option D |
| ---------------------- | -------- | -------- | -------- | -------- |
| Safety                 | Low      | High     | Medium   | High     |
| Auditability           | Low      | High     | Low      | High     |
| Operational simplicity | High     | Medium   | High     | Medium   |
| Scope/expiry support   | Low      | High     | Low      | High     |

## Recommended Direction for Human Architecture Review

Use the hybrid model: technical route access remains necessary but not sufficient; governed decisions require scoped authority assignments passed into service-level command handlers. Preserve `runtime access != canonical authority` as a hard rule.

This recommendation is not an approval, does not resolve the decision, and does not grant implementation authority.

## Rejected Options and Reasons

- Reject direct role authority because `admin` and `senior_editor` prove runtime access only.
- Reject frontend visibility as authority because it is not backend enforcement.
- Reject state gates as permission because eligibility and authority are separate.
- Reject static-only policy because revocation, expiry and scope need audit.

## Consequences

### Positive

- Clarifies actor authority before mutation.
- Supports organization, specialty and artifact scopes.
- Enables emergency/break-glass design without redefining admin.
- Makes service-level enforcement testable.

### Negative

- Requires authority persistence and actor-context propagation.
- Existing routes need gradual adaptation.
- More commands may fail until authority assignments are configured.

### Risks

- Misconfigured assignments could block legitimate work or permit excess authority.
- Emergency override could bypass governance if not separately audited.
- Service paths not receiving actor context may remain unsafe.

### Compatibility Effects

- Existing route permissions continue for access.
- Compatibility UI can still show actions but must not claim authority.
- Legacy rows may have unknown authority provenance.

## Migration Prerequisites

- Inventory governed actions and required authority types.
- Inventory actor identity propagation in controllers/services.
- Classify existing users/roles without assigning institutional authority.
- Define emergency authority policy separately or as extension.

## Implementation Prerequisites

- Approve `AuthorityAssignment` contract.
- Define service command context shape.
- Define fail-closed behavior for absent, expired or revoked authority.
- Add tests proving route access is insufficient for governed decisions.

## Data and Backfill Constraints

- Do not backfill authority assignments from role values alone.
- Existing decisions/projections without authority proof remain `UNKNOWN`.
- Organization and specialty scope must not be invented from user profile fields.

## Security and Authority Implications

- Admin role alone cannot prove editorial authority.
- Break-glass must record emergency rationale and post-hoc review obligation.
- Service-level checks must receive actor and authority context.
- Unauthorized decisions fail closed.

## Audit and Observability Requirements

- Log authority lookup, grant, revocation and rejection.
- Record rejected unauthorized attempts where safe.
- Expose reports for decisions without authority assignment.

## Acceptance Criteria

- Admin role alone cannot prove editorial authority.
- Frontend visibility cannot prove authority.
- State gates cannot prove authority.
- Governed services receive actor and authority context.
- Authority is scoped and auditable.
- Unauthorized decisions fail closed.

## Unresolved Questions

- Who grants authority assignments?
- What scope dimensions are mandatory: organization, specialty, artifact, decision type?
- How are service accounts represented?
- What is the emergency review deadline?

## Dependencies

- Depends on `WEOS-OD-018` for decision references.
- Blocks `WEOS-OD-023` command enforcement and `WEOS-OD-024` controlled application.
- Registers primary decision for `WEOS-GAP-008`.

## Exact Implementation Sequence After Approval

1. Approve role/authority separation.
2. Define authority assignment TypeScript contract.
3. Define actor command context.
4. Add conformance tests proving route role is not authority.
5. Add additive authority persistence after schema approval.
6. Add read-only authority lookup.
7. Integrate one pilot command handler.
8. Roll out fail-closed enforcement by governed action category.

## Approval Record

- Decision status: `OPEN`
- Approved option: `NOT_SELECTED`
- Approver: `NOT_RECORDED`
- Approval date: `NOT_RECORDED`
- Approval evidence: `NOT_RECORDED`
- Implementation authorization: `NOT_GRANTED`
