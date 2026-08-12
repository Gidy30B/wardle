# Workflow Shell QA Report

Status: PR 7 QA and parity audit. This report covers the gated workflow shell only.

The workflow shell is the default as of PR 10 gate inversion. Use `?workspaceShell=legacy` to access the legacy tab UI.

## Implemented workflows

All seven planned workflows are implemented in the gated shell:

1. Review Queue
2. Overview
3. Teaching
4. Reasoning
5. Cases
6. Content
7. Publish

## Board inventory

Implemented workflow boards:

| Workflow | Boards |
|---|---|
| Review Queue | Global review queue groups |
| Overview | Diagnosis Health |
| Teaching | Curriculum Coverage, Teaching Rules |
| Reasoning | Diagnostic Reasoning, Evidence, Differentials, Reasoning Paths |
| Cases | Diagnostic Cases, Clue Progression, Reasoning Coverage, Discriminator Coverage |
| Content | Education, Scoring Systems, Mnemonics, Recall Prompts |
| Publish | Publication Readiness |

## Data sources

All workflows continue to use the existing `/full` workspace payload and frontend projections. No backend contract was changed.

| Workflow | Primary projection sources |
|---|---|
| Review Queue | `editorialWorkflowViewModel`, `knowledgeGraphViewModel`, `diagnosticReasoningViewModel`, `caseReasoningViewModel`, `contentCoverageViewModel` |
| Overview | `editorialWorkflowViewModel`, `knowledgeGraphViewModel`, `diagnosticReasoningViewModel` |
| Teaching | `editorialWorkflowViewModel`, `knowledgeGraphViewModel`, `diagnosticReasoningViewModel`, coverage matrix/gaps, teaching rules |
| Reasoning | `diagnosticReasoningViewModel` for A-vs-B reasoning, `knowledgeGraphViewModel` for normalized evidence/differential/path support |
| Cases | `caseReasoningViewModel`, backed by Knowledge and Diagnostic Reasoning layers |
| Content | `contentCoverageViewModel`, backed by Knowledge, Diagnostic Reasoning, and Case Reasoning layers |
| Publish | `editorialWorkflowViewModel`, `knowledgeGraphViewModel`, `diagnosticReasoningViewModel`, readiness/lifecycle/coverage projections |

## Legacy mapping

Current legacy workspace destinations map to workflow shell destinations as follows:

```txt
Overview
  -> Overview

Objectives
  -> Teaching

Teaching Rules
  -> Teaching

Graph
  -> Reasoning

Cases
  -> Cases

Education
  -> Content

Integrity
  -> Publish
```

## QA findings

### Workflow consistency

- All workflow headers now use the shared verdict pattern:
  - title/eyebrow
  - question
  - verdict
  - detail
  - top concerns
- Workflows with multiple boards use local board navigation.
- Review Queue, Overview, and Publish remain workflow-level surfaces rather than multi-board tab sets.

### Severity consistency

The shell normalizes severity presentation into:

```txt
BLOCKER
WARNING
INFO
PASSING
```

Queue ordering remains:

1. blockers
2. warnings
3. informational items

Review Queue now uses the unified queue as its source of truth, including Knowledge, Diagnostic Reasoning, Case Reasoning, and Content Coverage signals.

### Empty states

Every implemented board has a safe empty state through `BoardEmptyState` or guarded rendering. Empty states avoid dead-end "0 item" screens by explaining what will appear when the relevant projection exists.

### URL and navigation consistency

The shell navigation preserves:

```txt
workspaceShell=workflow
workflow
board
diagnosis route
unrelated query params
```

Invalid workflow and board values safely fall back through `workflowNavigationViewModel`.

### Review Queue QA

- Items are sorted by severity.
- Items include workflow/source metadata where available.
- Queue item navigation targets workflow + board context.
- Obvious duplicate signals are deduped by kind, workflow, board, and source ID while preserving the highest severity.

## Remaining gaps

Not implemented in this PR:

- action wiring
- edit flows
- publish flows
- review/approval flows
- generation flows
- migration of legacy tab internals
- removal of old tabs
- making workflow shell the default

## Risks

- Duplicated review signals can still occur when two projections describe the same editorial problem with different source IDs.
- Some Content projections depend on optional revision snapshot data; when unavailable, the shell intentionally falls back to safe empty states.
- Frontend projections can become stale if `/full` expands or changes without corresponding mapper updates.
- Workflow parity is read-only; editors may still need to return to legacy tabs for actions.
- Payload growth should be monitored before making the shell default.

## Recommendation

The workflow shell is ready for editor evaluation as a gated, read-only workspace:

```txt
workflow shell ready for editor evaluation
```

It should not be made the default until action wiring, edit/review flows, and parity with legacy tab operations are intentionally completed.
