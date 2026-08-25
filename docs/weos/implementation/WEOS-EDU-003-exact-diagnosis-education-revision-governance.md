# WEOS EDU-003 - Exact Diagnosis Education Revision Governance

## Status

Implemented as a bounded Diagnosis Education governance slice.

Authority basis:

- WEOS-CANON-004 Diagnosis Education Standards
- WEOS-CANON-006 AI Draft Standards
- WEOS-CANON-007 Governance Record Standards
- WEOS-ARCH-008 Institutional Editorial Governance
- Package: WEOS EDU-003 - Exact Diagnosis Education Revision Approval and Publication Governance

## Resolved

- Diagnosis Education approval decisions now target an exact `DiagnosisEducationRevision`.
- Diagnosis Education publication decisions now target an exact approved `DiagnosisEducationRevision`.
- Approval, publication authorization, and withdrawal are persisted as distinct, attributable governance records.
- Publication readiness is exact-revision scoped and blocks stale material.
- `DiagnosisEducation.editorialStatus`, `reviewedAt`, `reviewedByUserId`, and `publishedAt` remain compatibility projections, not the canonical authority record.
- Legacy Education review/publish routes are bridged through exact-revision governance in normal dependency-injected runtime.
- Standing publication decisions supersede previous standing publications for the same Education/channel.
- Publication withdrawal preserves the original decision record and changes its standing to withdrawn.
- Learner Education hydration resolves canonical standing published revisions before legacy compatibility fallback.
- Clinical Case generation context resolves canonical standing published revisions before legacy compatibility fallback.
- Knowledge Graph extraction uses exact standing publication decisions for canonical Education revision authority.
- Trusted Education differential links require standing publication authority when generated from revision-specific mappings.
- Workspace summaries can surface exact Education revision review and publication work.
- Dashboard workspace actions can approve/reject/request changes for Education revisions and authorize/withdraw publication through registered workspace actions.

## Governance Separation

EDU-003 preserves the full sequence:

1. AI draft candidate acceptance does not apply material.
2. Controlled candidate application creates or updates a `DiagnosisEducation` revision in `NEEDS_REVIEW`.
3. Revision approval records a human editorial decision for one exact revision.
4. Publication authorization records a separate publication decision for that same exact approved revision.
5. Mutable row status is synchronized only as a compatibility/workflow projection.

Validation, readiness, UI visibility, route access, and technical role are not treated as editorial or publication authority.

## Data Model

The additive model is Education-specific and does not introduce a generic governance platform.

New records:

- `DiagnosisEducationRevisionApprovalDecision`
  - exact Education, diagnosis, revision, and version identity
  - outcome: approved, rejected, or changes required
  - standing state for the currently standing approval
  - actor, rationale, authority references
  - material context hash and snapshots
  - command idempotency and fingerprint
  - supersession linkage

- `DiagnosisEducationPublicationDecision`
  - exact Education, diagnosis, revision, version, and approval decision identity
  - publication channel
  - readiness result and snapshot
  - actor, rationale, authority references
  - material context hash and snapshots
  - command idempotency and fingerprint
  - standing state: authorized, superseded, or withdrawn
  - withdrawal actor/rationale when applicable

No historical Education rows are backfilled into fabricated governance records.

## Runtime Behavior

Approval:

- requires an exact current revision and expected Education version
- records `APPROVED`, `REJECTED`, or `CHANGES_REQUIRED`
- does not publish
- does not create learner/case/graph authority

Publication authorization:

- requires a standing exact approval decision for the same revision
- requires matching expected version
- requires matching active publication expectation
- stores readiness context
- supersedes the previous active publication for the channel
- synchronizes the compatibility projection to `PUBLISHED`
- triggers graph extraction from the exact published revision

Withdrawal:

- requires rationale
- marks the publication decision `WITHDRAWN`
- clears the compatibility published projection
- does not delete the governance record

## Downstream Authority

Canonical standing publication decisions now govern trusted Education use for:

- learner Education exposure
- Clinical Case generation Education context
- Knowledge Graph extraction from Diagnosis Education
- trusted Education differential links

Legacy `PUBLISHED` row fallback remains only as compatibility when no canonical standing publication decision exists. It is not treated as a new canonical authority source.

## Workspace

The diagnosis workspace can now include an `educationGovernance` summary with:

- current Education revision/version
- exact publication readiness
- review action when current Education is `NEEDS_REVIEW`
- publication action when exact revision readiness is `READY`

Dashboard workspace actions added:

- `educationRevision.approve`
- `educationRevision.reject`
- `educationRevision.requestChanges`
- `educationPublication.authorizeRevision`
- `educationPublication.withdraw`

These actions use the workspace action registry, policy, and runner rather than ad hoc endpoint calls.

## Still Open

- Exact institutional authority assignment beyond existing access gates.
- Generic governance records across all artifact types.
- Graph source-revision provenance and staleness engine hardening.
- Durable AI failure analytics.
- Distributed orchestration or queues.
- Historical conversion of legacy approved/published Education rows.

Next intended package boundary: exact institutional authority assignment and/or graph provenance hardening, depending on the approved WEOS package that follows EDU-003.
