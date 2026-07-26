# WEOS Phase 2 Review Checklist

## Conceptual Distinctions

- [ ] Validation Result is not Assessment.
- [ ] Assessment is not Review.
- [ ] Review is not Decision.
- [ ] Technical actor is not authority.
- [ ] Audit Event is not Governance Record.
- [ ] Readiness is not lifecycle.
- [ ] Phase 1 catalogue semantics are preserved unless an approved exception gives rationale.

## Lifecycle Correctness

- [ ] Lifecycle families are artifact-specific.
- [ ] Case Revision lifecycle does not include publication or learner exposure.
- [ ] AI Draft lifecycle does not include Controlled Application.
- [ ] `BLOCKED_CASE_NOT_EDITABLE` is not forced into canonical lifecycle state.
- [ ] Playability and generatability are independent permission dimensions.
- [ ] Publication Decision does not contain `WITHDRAWN` or later supersession standing.
- [ ] Validation standing excludes `ERROR` while validation outcome includes `ERROR`.
- [ ] `UNDER_REVIEW` and `APPROVED` do not permit direct content mutation.

## Transition Correctness

- [ ] Abstract actions do not appear in executable transitions.
- [ ] Composite workflows do not appear as atomic transitions.
- [ ] Withdrawal targets Published Artifact Version, not historical Publication Decision.
- [ ] Diagnosis remapping is governed identity operation, not lifecycle transition.
- [ ] `REQUIRE_REVISION` does not carry material content-change impacts.

## Migration Safety

- [ ] Crosswalk separates source artifact from target interpretation.
- [ ] Semantic mapping safety and record migration safety are separate.
- [ ] No record migration is marked safe without live evidence.
- [ ] Legacy `PUBLISHED` does not infer authorised Publication Decision.
- [ ] Legacy `PUBLISHED` does not infer immutable learner exposure.

## Historical Immutability

- [ ] Historical validation, assessment, review, decision, publication, and exposure records remain preserved.
- [ ] New revisions do not inherit prior standing without proof.
- [ ] Publication withdrawal preserves publication history.

## Publication Integrity

- [ ] Approval is not publication.
- [ ] Authorise/decline publication targets exact Case/Diagnosis Education revisions, not already-published versions.
- [ ] Publication is not schedule.
- [ ] Schedule is not release.
- [ ] Release is not learner exposure.
- [ ] Withdrawal creates Withdrawal Record and exposure/schedule effects.
- [ ] Withdrawal/supersession change Published Artifact Version standing without producing a replacement Published Artifact Version.
- [ ] Withdrawal does not weaken the historical Publication Decision.

## Action Contract Integrity

- [ ] `subjectArtifactTypes` identifies the artifact an action operates on.
- [ ] `targetRevisionTypes` identifies exact revision targets when required.
- [ ] `producesArtifactTypes` and `producesRecordKinds` contain newly created artifacts/records only.
- [ ] `changesStandingOfArtifactTypes` contains existing artifacts whose lifecycle, standing, visibility, operational permission, or publication status changes.
- [ ] `applicableArtifactTypes` is treated only as legacy broad compatibility/discovery metadata.

## Learner-Exposure Integrity

- [ ] Current learner exposure requires inventory before withdrawal effects.
- [ ] No legacy status is treated as immutable exposure proof.

## Documentation Synchronization

- [ ] WEOS-IMP-002 tables are generated from lifecycle/transition metadata.
- [ ] WEOS-IMP-003 tables are generated from action metadata.
- [ ] WEOS-IMP-004 tables are generated from crosswalk metadata.
- [ ] Documentation conformance tests fail if entries are omitted.
- [ ] Deterministic generation check reports no Markdown drift after build and generator run.
- [ ] Local `npm run weos:docs:check` passes; CI enforcement is absent because this repository has no `.github/workflows` directory.

## Phase 3 Readiness

- [ ] Open decisions remain unresolved where evidence is missing.
- [ ] Governance Record structure is documented but not implemented.
- [ ] Required live-data queries are documented but not executed.
- [ ] Prisma/schema/runtime behavior remains unchanged.
