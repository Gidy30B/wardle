# Workflow Browser QA Report

Date: 2026-06-30  
Status: Incomplete — local QA API dependency failure  
Recommendation: **not ready**

## Scope and guardrails

This pass targeted the editorial workflow shell at:

```txt
/editorial/diagnoses/:diagnosisRegistryId
```

Note: The workflow shell is the default as of PR 10 gate inversion. This report
covers the earlier opt-in (`?workspaceShell=workflow`) state. No Phase 6 work was
performed in that pass — legacy tabs were not removed and no deferred action was
intentionally invoked.

The dashboard started successfully with local-only QA configuration. Escalated
Playwright execution was approved and Edge launched successfully. The local QA
API started, then lost its Redis connection (`ECONNRESET` / `ECONNABORTED`) and
stopped listening on port 3001. All three browser tests therefore failed during
fixture retrieval with `ECONNREFUSED` before a workspace page was visited.

## Diagnoses selected

The local QA endpoint returned the intended maturity spread:

| Scenario | Diagnosis | Registry ID | Browser status |
|---|---|---|---|
| Mature / near-ready | Peptic Ulcer Disease | `56021b82-20bb-4a21-ba12-aa026d932951` | Blocked before gated-shell visit |
| Medium maturity / content issues | Acute Pancreatitis | `37130aa7-dd86-43f1-923a-68cce7f1f0e6` | Blocked before gated-shell visit |
| Weak / sparse | Nutritional Vitamin D Deficiency Rickets | `71e19421-85d3-4eca-a325-f1c53b3fcd5e` | Blocked before gated-shell visit |
| Reasoning / differential issues | SIADH | `a82f8e98-e01e-4886-991e-d88599bfa92c` | Blocked before gated-shell visit |
| Case / clue progression issues | Diabetic Ketoacidosis | `1843d440-8383-428c-a547-aa5575c38bb4` | Blocked before gated-shell visit |
| Legacy control | Appendicitis | `1c36ca1b-701f-452f-a4bb-42e3f3914cce` | Loaded successfully |

## Evidence obtained

The existing Edge smoke test successfully opened the ungated Appendicitis
workspace and confirmed that the legacy tab interface remained active. Its
accessibility snapshot showed Overview, Objectives, Clinical Picture, Teaching
& Learning, Differential Map, Cases, and Integrity; it did not show the gated
workflow navigation.

The same smoke test then failed on an obsolete assertion for `Editorial
copilot`. The current legacy workspace renders the newer diagnosis-health and
publication-readiness surfaces instead. This is a QA harness defect rather than
a demonstrated product regression.

The local QA services were also verified independently:

- API served the seven expected QA diagnoses with local QA authentication.
- Dashboard served successfully on the intended QA origin using Vite's native
  config loader.
- The QA harness assertions were updated to stable current legacy landmarks:
  `Diagnosis health` and `Coverage, risks, and next best actions`.
- Escalated Playwright launched Edge and scheduled three tests with one worker.
- The API process then lost Redis connectivity and all tests failed on
  `GET /api/auth/local-qa/diagnoses` with `ECONNREFUSED ::1:3001`.

## Pass / fail matrix

| Area | Result | Evidence / limitation |
|---|---|---|
| Legacy route opens legacy workspace | Pass | Appendicitis loaded with legacy tab controls. |
| Workflow shell absent without query flag | Pass | No workflow navigation appeared in the legacy accessibility snapshot. |
| Default URL opens workflow shell | Resolved — covered by automated Playwright smoke test |
| Seven-workflow navigation | Blocked | Redis/Docker failure prevented the QA API from serving browser fixtures. |
| Query parameter preservation | Blocked | Unit coverage exists, but manual browser verification did not run. |
| Invalid workflow fallback | Blocked | Unit coverage exists, but manual browser verification did not run. |
| Invalid board fallback | Blocked | Unit coverage exists, but manual browser verification did not run. |
| Review Queue ordering and deduplication | Blocked | No gated queue was rendered in this pass. |
| Review Queue deep links | Blocked | No gated queue was rendered in this pass. |
| Safe action pending / success / refresh states | Not run | No mutation was attempted without browser evidence. |
| Safe action failure state | Not run | No mutation was attempted without browser evidence. |
| Non-senior permission behavior | Not run | Requires a second editor-role QA session. |
| Deferred actions absent | Blocked | Requires rendered gated workflows. |
| Desktop layout, scrolling, overflow, rail clarity | Blocked | Requires rendered gated workflows. |
| Clinical/editorial verdict quality across fixtures | Blocked | Requires rendered gated workflows. |

## Actions tested

No workflow mutation was executed. The QA API dependency failure occurred
before the gated-shell action pass, so teaching-rule, evidence, reasoning-path,
clue-revision, and unsupported-claim actions remain unverified manually.

This report does not treat existing action-policy unit tests as a substitute for
the requested browser pass.

## Defects found

### BQA-001 — legacy smoke test expected retired copy (fixed)

- File: `qa/editorial-workspace-smoke.spec.ts`
- Lines: 41–42
- Severity: QA maintenance
- Finding: the test expected `Editorial copilot` and `Next editorial moves`, but
  the current legacy workspace renders the newer diagnosis-health experience.
- Resolution: replaced those assertions with stable current landmarks already
  present in the legacy workspace. No runtime behavior changed.

### BQA-002 — local Redis instability terminates the QA API

- Severity: environment blocker
- Finding: the QA API initially binds to port 3001, then reports repeated Redis
  `ECONNRESET` / `ECONNABORTED` errors and stops accepting requests.
- Impact: Edge launches, but fixture retrieval fails before navigation, so the
  gated-shell, visual, action, and permission checks cannot be certified.
- Follow-up: restore a stable local Redis service, restart the local-QA API, and
  rerun the browser suite. Do not change workflow runtime behavior to bypass the
  dependency.

## Screenshots

No new screenshots are claimed. Edge launched, but the API fixture request
failed before navigation. Playwright traces record the failed API request only
and are not used as UI pass evidence.

## Parity gaps versus the legacy workspace

Parity could not be assessed manually beyond confirming that the legacy default
still loads. The known deferred areas remain unchanged:

- publish and lifecycle operations;
- generation operations;
- edit/apply clue-revision flows;
- AI-draft decisions;
- education review/regeneration/publish;
- case ready-to-publish;
- delete and bulk operations.

## Recommendation

**Not ready to make default.**

This is not a negative verdict on the workflow implementation itself; it is a
release-confidence verdict. The manual gated-shell pass, action-state pass,
non-senior permission pass, deferred-action absence check, and visual review
remain incomplete. Keep the shell gated and do not start Phase 6 until those
checks run successfully.
