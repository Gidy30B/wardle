# Workflow Action QA Report

Status: PR 10 action expansion complete. The workflow shell remains gated by
`?workspaceShell=workflow`; the legacy workspace remains the default.

## Architecture verified

All workflow mutations follow one path:

```txt
Workflow UI
  -> workspaceReviewActionPolicy.ts
      -> runWorkspaceAction(...)
          -> domain action adapter
              -> existing admin API helper
                  -> workspace refresh
```

Workflow components do not import or call admin API helpers directly. Existing
backend contracts and legacy handlers are unchanged.

## Wired actions

| Action | Workflow surfaces | Access |
|---|---|---|
| Approve teaching rule | Teaching Rules, Review Queue, review rail | `seniorEditorial` |
| Reject teaching rule | Teaching Rules, Review Queue, review rail | `seniorEditorial` |
| Request teaching rule changes | Teaching Rules, Review Queue, review rail | `editorial` |
| Approve evidence relationship | Evidence, Review Queue, review rail | `seniorEditorial` |
| Reject evidence relationship | Evidence, Review Queue, review rail | `seniorEditorial` |
| Approve reasoning path | Reasoning Paths, Review Queue, review rail | `seniorEditorial` |
| Reject reasoning path | Reasoning Paths, Review Queue, review rail | `seniorEditorial` |
| Request reasoning path changes | Reasoning Paths, Review Queue, review rail | `editorial` |
| Approve clue revision draft | Diagnostic Cases, Review Queue, review rail | `seniorEditorial` |
| Reject clue revision draft | Diagnostic Cases, Review Queue, review rail | `seniorEditorial` |
| Request clue revision changes | Diagnostic Cases, Review Queue, review rail | `editorial` |
| Supersede clue revision draft | Diagnostic Cases, Review Queue, review rail | `seniorEditorial` |
| Repair unsupported claim | Education, Review Queue, review rail | `editorial` |

Actions appear only when the normalized artifact status is reviewable and a
stable artifact ID exists. Claim repair appears only when the backend marks the
claim as automatically repairable.

## Deferred actions

No buttons are exposed for:

- diagnosis publish or lifecycle actions;
- lifecycle normalization;
- delete or bulk actions;
- teaching, evidence, reasoning, case, or education generation;
- reasoning validation or generation-context operations;
- applying or editing clue revision drafts;
- education regeneration, publish, or review;
- case ready-to-publish actions;
- AI draft decisions.

AI draft accept/reject/request-changes remains deferred because the centralized
registry and runner do not currently define an AI draft action domain. Existing
legacy support was not bypassed or copied into workflow components.

## Permission policy

- `editorial` actions require `canAccessEditorial`.
- `seniorEditorial` actions require both editorial access and
  `canPublishEditorial`.
- Permission-blocked workflow actions render disabled with an explanatory
  accessible label. Disabled controls cannot invoke the runner.
- The runner repeats access checks before dispatch, so UI state is not the
  security boundary.

## Confirmation policy

Candidate rejection and supersede operations are classified as editorial
review-state decisions and do not require confirmation. Operations that mutate
published or case content, delete data, or perform governance transitions remain
confirmation-required and are not surfaced by the workflow action policy.

In particular, `clueRevision.apply` remains deferred even after a draft is
approved.

## Automated QA

Policy tests cover:

- wired action sets for teaching rules, evidence, reasoning paths, clue drafts,
  and unsupported claims;
- missing artifact IDs;
- non-senior permission blocking;
- confirmation-blocked, deferred, and not-applicable classifications;
- explicit exclusion of publish, lifecycle, delete, bulk, generation,
  education regeneration, and clue-apply actions.

Runner tests cover expanded reject/request-changes/clue/claim-repair dispatch,
refresh after success, permission and confirmation guards, and safe error
feedback. Workflow view-model tests verify that action metadata preserves
blocker-first ordering, source workflow, board target, and deduplication.

React component tests are not present in this package; UI behavior therefore
requires the manual pass below.

## Manual QA checklist

- [ ] Open the diagnosis workspace (default workflow shell, no params needed)
      and confirm the workflow and board query parameters remain unchanged after an action.
- [ ] Execute each wired action from Review Queue and confirm one request,
      pending feedback, success feedback, and refreshed data.
- [ ] Execute representative actions from Teaching Rules, Evidence, Reasoning
      Paths, Diagnostic Cases, and Education.
- [ ] Force an API failure and confirm safe error feedback with controls restored.
- [ ] Confirm non-senior editors can request changes and repair claims but cannot
      invoke senior-only approve/reject/supersede actions.
- [ ] Confirm Apply clue revision, generation, publish, lifecycle, delete, bulk,
      education review/regeneration, and case-ready buttons are absent.
- [ ] Confirm Review Queue remains ordered blockers, warnings, then info.
- [ ] Open the diagnosis with `?workspaceShell=legacy` and confirm the legacy workspace and its
      handlers behave exactly as before.

## Recommendation

The workflow action layer is ready for gated editor testing. Remaining
limitations are intentional: confirmation workflows do not yet exist for
content-mutating or governance operations, AI draft decisions are not registered
centrally, and UI action behavior still needs the documented manual browser pass.

## Validation result

- `npm test`: passed.
- `npm run build`: passed.
- Scoped ESLint for PR 10 files: passed.
- `git diff --check`: passed (line-ending warnings only).
- Repo-wide ESLint retains the unrelated existing fast-refresh error in
  `components/BoardVerdict.tsx` and exhaustive-deps warning in
  `RegistryMergeAnalysisPage.tsx`; neither was changed by PR 10.
