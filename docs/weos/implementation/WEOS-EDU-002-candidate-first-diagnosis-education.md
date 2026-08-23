# WEOS EDU-002 Candidate-First Diagnosis Education

Status: implemented in package `WEOS EDU-002`.

Authority: user package requiring conformance with `WEOS-CANON-004`, `WEOS-CANON-006`, and `WEOS-CANON-007`.

## Resolved

- AI Diagnosis Education whole generation is candidate-first.
- AI section regeneration for `differentials`, `investigations`, `examPearls`, and `management` is candidate-first.
- Candidate review is separated from controlled application.
- Controlled application is separated from Education artifact approval.
- Education artifact approval remains separated from publication.
- Candidate provenance is persisted, including model/provider, generator and prompt version, generation time, scope, diagnosis identity, base Education version/revision, context hash, source artifacts where available, and validation result.
- Candidate review decisions persist responsible actor and rationale for Accept, Reject, and Request Changes.
- Controlled application has a distinguishable application command record with actor, rationale, idempotency key, command fingerprint, status, conflict reason, and resulting Education/revision identity.
- Application is stale-safe against the candidate source Education version and fails without overwriting newer material.
- Application is idempotent for repeated identical Apply commands and does not create duplicate Education versions/revisions.
- Application creates or updates `DiagnosisEducation` as `NEEDS_REVIEW` only.
- Application does not approve or publish Education.
- Candidate creation does not create trusted Education differential links.
- Candidate creation, acceptance, and application do not confer graph authority.
- Case generation remains gated to `PUBLISHED` Diagnosis Education only.
- Learner Education exposure remains gated to published Education and latest published revision fallback.
- Workspace inventory and review queue surface Education candidates, review actions, accepted-awaiting-application state, stale application state, and resulting Education linkage.
- Legacy Education AI generation/regeneration affordances now describe candidate creation rather than direct Education update.

## Still Open

- Exact Diagnosis Education revision approval authority.
- Exact Diagnosis Education publication decision authority.
- Graph candidate source-revision provenance and graph staleness rules.
- Broader cross-artifact governance unification.
- Durable AI failure analytics before candidate creation.
- Distributed orchestration or queue-backed application locking.
- Rich collaborative candidate editing and semantic section diff UI.

## Runtime Boundary

`DiagnosisEducationCandidate` is a proposed revision to an existing diagnosis-level Education artifact, not a second independent Education artifact. Whole candidates carry proposed full Education material. Section candidates carry the requested section, original section snapshot, proposed replacement, and proposed references.

Accepting a candidate means the proposal may be applied by a separate controlled command. It does not mutate `DiagnosisEducation`, approve a resulting Education revision, publish learner-facing content, refresh trusted differential links, or promote graph facts.

Applying an accepted candidate creates or increments exactly one `DiagnosisEducation` version and one `DiagnosisEducationRevision` snapshot when the candidate base version still matches current state. The resulting Education is `NEEDS_REVIEW` and must continue through the existing Education review lifecycle.

## Next Package

Next intended package: `WEOS EDU-003 - Exact Diagnosis Education Revision Governance`.

Exact EDU-003 starting boundary:

- `DiagnosisEducationCandidate` and application command records exist.
- AI whole and section generation no longer directly mutate `DiagnosisEducation`.
- Applied candidate output lands as a `NEEDS_REVIEW` Education revision.
- EDU-001 expected-version mutation safety remains active for manual edits and review actions.
- Publication and learner exposure still depend only on existing `PUBLISHED` Education semantics.
- Exact Education revision approval and publication authority remain unresolved and should be the first EDU-003 governance target.
