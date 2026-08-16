# Case Review Packet Proposal

## Purpose

Make one case reviewable and approvable from a single editorial surface without
restructuring the diagnosis workspace. The packet is a case-scoped read model, not a
new source of truth.

## Existing Data Inventory

| Editorial question    | Current source                                                             | Relevant fields                                                                                                                      |
| --------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| What case is this?    | `EditorialCaseDetail`                                                      | `id`, `title`, `diagnosisRegistryId`, `proposedDiagnosisText`, `difficulty`, `date`                                                  |
| Current version/state | `EditorialCaseDetail`                                                      | `editorialStatus`, `currentRevisionId`, `currentRevision.revisionNumber/source/createdAt`, `approvedAt`, `validationRuns`, `reviews` |
| Case inventory health | `cases.items[].qualityProjection` → `CaseReasoningCardViewModel`           | status, difficulty, quality, reasoning objective, linked goals/discriminators/comparisons, blocker/warning counts                    |
| Clue progression      | `cases.items[].clueProgression` → `ClueProgressionCaseViewModel`           | ordered diagnostic states, interpretation, confidence shifts, leak risk, unresolved mimics, discriminator timing, concerns           |
| Reasoning coverage    | `caseLearningGoalCoverage`, diagnostic comparisons, reasoning paths        | learning goal strength, missing discriminators/mimics, A-vs-B verdict, confidence, supporting path IDs                               |
| Differential support  | case `differentials`, `linkedDifferentials`, `mimicEliminations`           | listed mimics, elimination status, discriminator used, strength, residual confusion                                                  |
| Evidence integrity    | `evidenceGraph.relationships`, `unsupportedClaimsBySection` → knowledge VM | relationship status/trust/strength, evidence IDs, unsupported claims, publication blocking                                           |
| Explanation           | `EditorialCaseDetail.explanation`                                          | diagnosis, summary, reasoning, key findings, generation quality metadata                                                             |
| Learner education     | diagnosis `education`, `caseLearningGoalCoverage`, content boards          | education status/version/quality and case-linked goals; section content itself remains diagnosis-level                               |
| Graph relationships   | diagnostic comparisons and knowledge VM                                    | teaching relationships, evidence relationship IDs, reasoning path IDs, discriminator map                                             |
| Publication readiness | case quality, validation, diagnosis publish readiness, publish checklist   | quality blockers, current validation, diagnosis eligibility, workspace blockers                                                      |
| AI contribution       | `aiDraftAuditTrail`, clue revision drafts, explanation generation quality  | action/artifact, output, status, reviewer, decision time, pending human review                                                       |
| Review actions        | case-detail APIs plus workspace action registry                            | start review, submit decision, rerun validation; clue/AI/evidence actions; mark ready                                                |

The existing `EditorialWorkflowViewModel` already exposes the normalized knowledge,
diagnostic reasoning, case reasoning, review queue, content, and publication layers.
The packet should consume it rather than re-derive those projections.

## Gaps in the Current Shape

1. `DiagnosisEditorialWorkspace.cases.items` is a projection, not a complete case. It
   omits history, raw clues, explanation, differentials, revision details, validation
   history, and review decisions.
2. `EditorialCaseDetail` contains the case but not the diagnosis-level reasoning,
   evidence, teaching coverage, graph, or AI audit context.
3. Unsupported claims are section/diagnosis scoped. They cannot currently be
   attributed safely to an exact explanation sentence or case revision.
4. Education is diagnosis scoped. The model knows that a case covers a learning goal,
   but not which exact education passages the case depends upon.
5. Evidence relationships link to comparisons and paths, not directly to explanation
   claims. Evidence sufficiency must therefore be shown as mapped, unassessed, or
   diagnosis-unattributed—not guessed.
6. Review queue `sourceId` is inconsistently case ID, comparison ID, relationship ID,
   or artefact ID. Case membership cannot always be inferred reliably.
7. AI audit data records generated output but lacks a normalized before/after diff,
   model identity, prompt version, and confidence.
8. The default workspace action registry does not contain the existing case review
   decision actions. Those still live in the case-detail surface.
9. Diagnosis publication readiness is broader than case approval. The packet must not
   block a clinically sound case merely because unrelated diagnosis inventory is weak;
   it should distinguish approval from publication eligibility.
10. No backend endpoint returns the composed packet. The first implementation can
    fetch case detail alongside the already-loaded workspace and compose client-side.

## Proposed View Model

The concrete TypeScript contract and mapper are implemented in
`viewModels/caseReviewPacketViewModel.ts`.

Top-level sections:

- `identity`: case and diagnosis identity
- `state`: current revision, workflow status, validation, and review decision
- `clinicalContent`: history, symptoms, ordered clues, and clue-coherence verdict
- `reasoning`: objective, comparisons, discriminators, confidence, and defensibility
- `differentials`: listed, assessed, and unassessed mimics
- `explanation`: learner explanation, evidence relationships, and unsupported claims
- `education`: case-linked goals plus explicitly diagnosis-level content health
- `aiContribution`: case-scoped audit records and pending human review
- `governance`: blockers, warnings, review queue items, and honest data gaps
- `decision`: approval eligibility, rationale, next action, and available actions

The mapper accepts:

```ts
buildCaseReviewPacketViewModel({
  caseDetail: EditorialCaseDetail,
  workspace: DiagnosisEditorialWorkspace,
  workflow?: EditorialWorkflowViewModel,
})
```

This boundary is intentional. `EditorialCaseDetail` supplies authoritative revision
content and decisions; the workspace supplies diagnosis-level governance; the workflow
view model supplies normalized reasoning and graph projections.

## Mapping Rules

1. Match the selected case by `caseDetail.id` across inventory, clue progression,
   knowledge case reasoning, coverage rows, clue drafts, and AI audits.
2. Use `currentRevision` and the latest completed validation/review for state.
3. Parse raw clues from case detail, then enrich each clue with its projected
   interpretation and mimic/discriminator effects.
4. Follow the case card's `linkedComparisonIds` into diagnostic comparisons.
5. Follow comparison evidence IDs into normalized evidence relationships.
6. Compare case-listed differentials with mimic eliminations to expose unassessed
   distractors.
7. Preserve unsupported claims as `diagnosis_unattributed` until the backend supports
   claim-to-case/revision links.
8. Treat diagnosis education as diagnosis-level and use case learning-goal rows only
   for case-specific completeness.
9. Block approval for missing critical content, failed/missing validation, projected
   clinical blockers, pending clue revisions, or pending case-scoped AI review.
10. Keep approval and publication eligibility separate. A case may be approvable while
    the diagnosis is not yet publishable.

## Minimal UI Integration Plan

1. Add an **Open review packet** action to each card in `DiagnosticCasesBoard`; keep
   the existing four case boards unchanged.
2. Open a route-addressable drawer or full-width nested panel using
   `?workflow=cases&caseId=<id>&view=review-packet`. Do not add an eighth workflow.
3. On selection, call the existing `getEditorialCaseDetail` endpoint and compose the
   packet with the already-built workflow view model.
4. Render a sticky case header with revision, validation, blockers, and the single
   recommended next action.
5. Render sections in editorial order: case → clues → reasoning/differentials →
   explanation/evidence → education → AI contribution → decision.
6. Keep evidence IDs, raw audits, and technical metadata collapsed, but never hide
   blocker counts or unsupported-claim attribution.
7. Wire existing case-detail review/validation APIs for start review, approve, request
   changes, and reject. Continue using workspace actions for clue, evidence, AI, and
   mark-ready operations.
8. After an action, refresh both case detail and workspace before recalculating the
   decision. Do not optimistically claim approval.

## Tests

`caseReviewPacketViewModel.test.ts` covers:

- **Mature:** passing validation, coherent clues, defensible comparison, active
  evidence, complete learning-goal coverage → approvable.
- **Sparse:** missing revision, clues, explanation, validation, education, and
  projections → insufficient data and blocked.
- **Reasoning-poor:** premature leakage, unresolved mimic, blocked case reasoning, and
  unsafe comparison → changes required.
- **AI-heavy:** otherwise mature case with pending case-scoped AI audit → human review
  required before approval.

## Deliberate Non-Goals

No portfolio dashboard, assignment system, committee workflow, new enterprise
governance model, or rewrite of the existing boards is included. This proposal solves
one problem only: making one case reviewable and approvable in one place.
