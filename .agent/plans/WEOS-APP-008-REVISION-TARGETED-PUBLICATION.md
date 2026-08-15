# APP-008 Revision-Targeted Publication Authority Plan

## Purpose

Create a documentation-only authority boundary for `WEOS-AUTH-APP-008`,
Revision-Targeted Case Publication and Learner Exposure.

## Approved Authority

- Approval record: `WEOS-AUTH-APP-008`
- Decision package: repository-native authority record under
  `docs/weos/authority/records/document-approvals/`
- Branch: `weos/phase-1c-case-revision-hardening`
- Prerequisite commit: `1a53f131ae99cbde50e1174a7e3395461fe55710`

APP-008 depends on `WEOS-AUTH-APP-006` for approval of an exact
`CaseRevision` and `WEOS-AUTH-APP-007` for controlled creation and mutation
hardening of `CaseRevision`. APP-007 independent review closed on 2026-08-15,
satisfying the APP-008A prerequisite. APP-008A still requires its own scoped
implementation work and must not be inferred from APP-008 authority alone.

## Current Behavior

Runtime publication and learner exposure remain divergent from the target WEOS
model. `DailyCase` binds to mutable `Case` identity, `GameSession` and
`Attempt` do not preserve exact revision exposure identity, and
`READY_TO_PUBLISH` remains a compatibility/workflow projection rather than a
canonical publication-readiness decision.

## Required Invariant

APP-008 must authorize later staged work only. It must preserve the distinction
between approval, revision creation, publication, scheduling, learner exposure,
session hydration and attempt provenance.

## Scope

Included:

- create APP-008 authority record;
- register APP-008 in the authority index;
- update status, implementation map, conformance matrix and gap evidence to
  reflect authorized-not-implemented status;
- define the APP-008A through APP-008D order and exclusions.

Excluded:

- runtime code;
- Prisma schema or migration changes;
- scheduler behavior;
- `DailyCase`, `GameSession`, or `Attempt` persistence changes;
- learner-facing API or hydration changes;
- backfill, repair, or destructive migration.

## Files Expected To Change

- `.agent/plans/WEOS-APP-008-REVISION-TARGETED-PUBLICATION.md`
- `docs/weos/authority/records/document-approvals/WEOS-AUTH-APP-008.json`
- `docs/weos/authority/records/index.json`
- `docs/weos/authority/STATUS-AND-PRECEDENCE.md`
- `docs/weos/implementation/WEOS-IMPLEMENTATION-MAP.md`
- `docs/weos/implementation/WEOS-CONFORMANCE-MATRIX.md`
- `docs/weos/gaps/IMPLEMENTATION-GAPS.md`

## Prohibited Changes

Do not alter APP-007 runtime implementation. Do not edit Prisma schema,
migrations, runtime services, controllers, schedulers, gameplay code, frontend
learner surfaces, generated packages, seeds, repair scripts, or backfill tools.

## Data Model Implications

None in APP-008. Later APP-008A through APP-008D may propose additive data
model changes after review.

## API Implications

None in APP-008.

## Migration Plan

None. APP-008 authorizes no migration.

## Compatibility Strategy

Existing runtime compatibility fields remain in place. Future APP-008 work must
add revision/publication identity without removing current compatibility fields
or fabricating historical governance records.

## Testing Strategy

- Validate authority records with the existing document-authority test.
- Run `git diff --check`.
- Confirm the final diff contains no runtime, schema, migration, scheduler, or
  gameplay implementation files.

## Rollback/Recovery

Revert the APP-008 documentation commit. Since no runtime or schema changes are
authorized, rollback has no data migration component.

## Progress

- [x] Confirm APP-007 clean committed boundary.
- [x] Inspect authority and planning conventions.
- [x] Create APP-008 authority package.
- [x] Run validation.
- [ ] Commit APP-008 separately.

## Discoveries

APP-007 is committed at `1a53f131ae99cbde50e1174a7e3395461fe55710` and the
worktree was clean before APP-008 began.

## Decisions

APP-008 is authority-only and uses the next available APP ID. It explicitly
authorizes later staged implementation as APP-008A through APP-008D.

## Remaining Risks

Publication and learner exposure runtime gaps remain open until APP-008A
through APP-008D are implemented and validated under this authority.
