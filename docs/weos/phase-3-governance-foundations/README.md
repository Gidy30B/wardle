# WEOS Phase 3 Governance Foundations Decision Pack

## Document Control

- Pack ID: `WEOS-P3-GOV-FOUNDATIONS`
- Version: `0.1`
- Status: `Draft`
- Disposition: `REVIEW_REQUIRED`
- Approval state: `NOT_APPROVED`
- Implementation authority: `NOT_GRANTED`
- Evidence baseline: `6f41136c21c9e854cbf231752d71939fab82bdac`
- Review date: `2026-07-29`

## Purpose

This pack converts blocking Phase 2 governance gaps into explicit reviewable choices. It does not resolve those gaps, approve a governance model, authorize schema or runtime work, or replace committed Phase 2 evidence. It establishes prerequisites for later implementation after human architecture review records an approval and implementation authorization.

The pack is local documentation only. It records options, recommendations, consequences, dependencies and implementation sequence so future Phase 3 work can proceed without inferring authority from draft documents, generated specifications, runtime roles, mutable status fields, audit logs or compatibility projections.

## Included Decisions

- [`WEOS-OD-018`](WEOS-OD-018-governance-decision-envelope.md): Governance decision envelope.
- [`WEOS-OD-019`](WEOS-OD-019-compatibility-projection-ownership.md): Compatibility projection ownership and synchronization.
- [`WEOS-OD-021`](WEOS-OD-021-document-authority-and-supersession.md): Document authority and supersession.
- [`WEOS-OD-022`](WEOS-OD-022-runtime-role-to-authority-assignment.md): Runtime role to canonical or institutional authority assignment.
- [`WEOS-OD-023`](WEOS-OD-023-expected-version-command-contract.md): Expected-version and stale-command contract.
- [`WEOS-OD-024`](WEOS-OD-024-controlled-application-authority.md): Controlled application record and authority.

## Registered Downstream Decisions

- `WEOS-OD-025`: Education review and publication-authorization separation.
- `WEOS-OD-026`: Evidence relationship activation and evidence-node activation coupling.
- `WEOS-OD-027`: Executable canonical-to-runtime action registry ownership and enforcement.

These downstream decisions are registered in the open-decision register so gap references no longer depend on unregistered placeholders. They are not fully resolved by this pack.

## Individual Decision Status

| Decision      | Status                     | Implementation authority             |
| ------------- | -------------------------- | ------------------------------------ |
| `WEOS-OD-021` | `APPROVED_WITH_CONDITIONS` | `GRANTED_FOR_STAGE_1_CONTRACTS_ONLY` |
| `WEOS-OD-018` | `APPROVED_WITH_CONDITIONS` | `GRANTED_FOR_STAGE_1_CONTRACTS_ONLY` |
| `WEOS-OD-022` | Open                       | `NOT_GRANTED`                        |
| `WEOS-OD-023` | Open                       | `NOT_GRANTED`                        |
| `WEOS-OD-019` | Open                       | `NOT_GRANTED`                        |
| `WEOS-OD-024` | Open                       | `NOT_GRANTED`                        |

Individual approval of `WEOS-OD-021` and `WEOS-OD-018` does not approve the complete pack. Pack-level status remains `REVIEW_REQUIRED`, approval state remains `NOT_APPROVED`, and implementation authority remains `NOT_GRANTED`.

## Dependency Graph

```text
WEOS-OD-021
    |
    v
WEOS-OD-018
    |
    v
WEOS-OD-022
    |
    v
WEOS-OD-023
    |
    v
WEOS-OD-019
    |
    v
WEOS-OD-024
```

`WEOS-OD-021` is first because agents and humans need a repository-visible authority and supersession process before treating any draft decision as controlling. `WEOS-OD-018` depends on that authority process because a decision envelope must carry approval and supersession evidence. `WEOS-OD-022` depends on the envelope because authority assignments must reference governed decisions. `WEOS-OD-023` depends on authority context because stale-command failures must apply to governed commands. `WEOS-OD-019` depends on command contracts because projections must be synchronized only through governed writes. `WEOS-OD-024` depends on all prior choices because controlled application needs authority, target versions, decision records and projection synchronization.

This order is an implementation dependency proposal, not an approval sequence.

## Implementation Prohibition

No Prisma, service, controller, dashboard, migration, backfill, permission enforcement or production rollout may be derived from this pack until the relevant decision has an explicit approval record.

## Evidence Baseline

Evidence is restricted to committed `HEAD` in `C:\Users\user\DxLab-weos-phase3` at `6f41136c21c9e854cbf231752d71939fab82bdac`. Local uncommitted files in `C:\Users\user\DxLab` are excluded. Branch-missing evidence remains classified as `FILE_NOT_IN_BRANCH`, `UNAVAILABLE_IN_BRANCH`, `PLANNED` or `NOT_IMPLEMENTED`.

## Pack-Level Approval Record

- Decision status: `OPEN`
- Approved option: `NOT_SELECTED`
- Approver: `NOT_RECORDED`
- Approval date: `NOT_RECORDED`
- Approval evidence: `NOT_RECORDED`
- Implementation authorization: `NOT_GRANTED`
