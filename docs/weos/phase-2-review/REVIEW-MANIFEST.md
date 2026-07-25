# WEOS Phase 2 Review Manifest

## Git Evidence

- Accepted Phase 1 base commit: `b4db6ac8c7d796d0f83fef40f0d31127b676ccdc`
- Phase 2 review branch commit before drift correction: `cda0c15c052ea187dfb2529256febefad42a734b`
- Branch: `weos/phase-2-review`
- Disposition: `REVIEW_REQUIRED`
- Phase 3 status: `NOT STARTED`

## Phase 1 Baseline Preservation

- Protected fields: `canonicalPurpose`, diagnosis scope, review requirement, approval requirement, decision requirement, publication applicability, implementation support, alignment classification, severity, verification confidence, canonical document references, known divergences, Prisma model evidence, implementation model evidence, and revision model evidence.
- Restoration method: the accepted Phase 1 catalogue at `b4db6ac8c7d796d0f83fef40f0d31127b676ccdc` supplied protected semantic values; Phase 2 retained only structural additions such as record kind, knowledge standing, versioning mode, revision carriers, implementation symbols, and implementation paths.
- Future drift prevention: `canonical-artifact-catalogue-phase-1-baseline.spec.ts` compares the current catalogue to a reviewed static fixture in `phase-1-protected-catalogue.fixture.ts`.
- Approved exceptions: `CLUE_DISCRIMINATOR_ANNOTATION`, `DIFFERENTIAL_MAPPING`, and `SUPERSESSION_REVIEW` changed approval/decision requirement from contextual to not-required/not-applicable because assessment records do not themselves require approval or constitute decisions.

## Changed Files for This Review Bundle

- `doctordle-backend/src/modules/editorial-governance/canonical-actions.ts`: corrected action categories, abstract/composite metadata, decision outcomes, governance record expectations, materiality actions, publication assessment action, and projection-write treatment.
- `doctordle-backend/src/modules/editorial-governance/canonical-actions.spec.ts`: added tests for decision metadata, request/change distinction, abstract/composite actions, materiality, retirement/archive/supersession, and publication assessment.
- `doctordle-backend/src/modules/editorial-governance/canonical-concepts.ts`: added missing decision outcome constants for graph/clue/revision/retirement distinctions.
- `doctordle-backend/src/modules/editorial-governance/canonical-invalidation.ts`: removed compatibility projection write as a peer evidence-withdrawal cause.
- `doctordle-backend/src/modules/editorial-governance/canonical-transitions.ts`: corrected withdrawal target, removed diagnosis remapping lifecycle transition, and removed material-edit impacts from `REQUIRE_REVISION`.
- `doctordle-backend/src/modules/editorial-governance/canonical-transitions.spec.ts`: added transition tests for withdrawal, remapping, abstract actions, and material-change timing.
- `doctordle-backend/src/modules/editorial-governance/legacy-status-crosswalk.ts`: redesigned source/target model, split semantic and record migration safety, corrected validation outcome/standing, publication projections, and string-status mappings.
- `doctordle-backend/src/modules/editorial-governance/legacy-status-crosswalk.spec.ts`: added conformance tests for the redesigned crosswalk model.
- `doctordle-backend/src/modules/editorial-governance/phase-1-protected-catalogue.fixture.ts`: static reviewed Phase 1 protected-field fixture.
- `doctordle-backend/src/modules/editorial-governance/canonical-artifact-catalogue-phase-1-baseline.spec.ts`: regression guard for protected Phase 1 catalogue fields.
- `doctordle-backend/scripts/generate-weos-phase-2-docs.js`: deterministic development-only documentation generator.
- `docs/weos/WEOS-IMP-002-lifecycle-transition-specification.md`: regenerated synchronized lifecycle/transition/precondition/standing-impact documentation.
- `docs/weos/WEOS-IMP-003-editorial-action-decision-catalogue.md`: regenerated complete action and decision catalogue.
- `docs/weos/WEOS-IMP-004-legacy-status-crosswalk.md`: regenerated complete crosswalk documentation.
- `docs/weos/WEOS-IMP-005-phase-2-open-decisions.md`: preserved open decisions and disposition.
- `docs/weos/phase-2-review/REVIEW-MANIFEST.md`: this manifest.
- `docs/weos/phase-2-review/CONTRACT-INVENTORY.md`: inventory counts and keys.
- `docs/weos/phase-2-review/REVIEW-CHECKLIST.md`: external reviewer checklist.

## Canonical Issues Corrected

- `REQUEST_CHANGES` is review communication; `REQUIRE_REVISION` is the governed decision.
- Material edits are separate from material-change determination.
- Revision supersession, archive, and retirement are no longer ordinary authoring.
- Publication Readiness Assessment and Publication Assessment are distinct.
- Evidence-source withdrawal is canonical; projection updates are implementation effects.
- Generic activation/deprecation actions are abstract and cannot appear in executable transitions.
- `MERGE_CANDIDATE` and `MERGE_REGISTRY_ENTRY` are distinct.
- `REPUBLISH_REVISION` is composite.
- Crosswalk source artifact is separate from canonical interpretations.
- Semantic mapping safety is separate from record migration safety.
- Validation outcome and standing are independent; failed validation can remain current.
- Teaching Rule `APPROVED` is not automatically `ACTIVE`.
- Editorial Brief `ACTIVE` is not automatically `APPROVED`.
- `BLOCKED_CASE_NOT_EDITABLE` is not forced into canonical lifecycle state.
- Legacy `PUBLISHED` does not infer authorised Publication Decision or immutable learner exposure.
- Withdrawal targets Published Artifact Version and preserves the original Publication Decision.
- Diagnosis remapping is a governed identity operation, not ordinary lifecycle transition.
- `REQUIRE_REVISION` does not carry material content-change standing impacts.
- Phase 1 catalogue semantics were restored while retaining Phase 2 structural fields.
- Playability and generatability are independent permission lifecycle families.
- Publication Decision no longer contains withdrawal or supersession states.
- Validation standing excludes `ERROR`; validation outcome still includes `ERROR`.
- Action metadata separates subjects, target revisions, produced artifacts, produced record kinds, governance record subtype, and audit record subtype.
- Withdrawal standing impacts no longer flag the historical Publication Decision for review.

## Tests Covering the Change

- `canonical-actions.spec.ts`
- `canonical-artifact-catalogue-phase-1-baseline.spec.ts`
- `canonical-transitions.spec.ts`
- `canonical-invalidation.spec.ts`
- `legacy-status-crosswalk.spec.ts`
- `weos-phase-1-documentation-conformance.spec.ts`
- `weos-phase-2-documentation-conformance.spec.ts`

## Unresolved Questions

Open decisions remain in `WEOS-IMP-005`. Live-data and backfill questions remain unresolved until Phase 3+ audit work.

## Runtime/Schema Confirmation

No Prisma schema, migration, runtime service, controller, guard, role, permission, scheduling, publication behavior, learner-facing read, current status-write behavior, or database data was changed.
