# Wardle Editorial Workspace Readiness Audit

Date: 2026-07-06

## Audit method and limitation

This review examined the default seven-workflow shell, its 16 boards, review queue,
right rail, action registry and policy, legacy workspace, QA fixtures, automated tests,
and previous browser-QA evidence. The local dashboard and API responded, but the
current build does not expose local-QA authentication and the browser automation CLI
is unavailable. Consequently, this is a source-informed product audit, not a claim of
successful live task completion. That limitation itself matters: the repository's most
recent browser report also could not certify the workflow shell or mutations.

## Executive Summary

**Verdict: do not deploy this as the primary editorial environment for a medical
school today.**

Wardle has substantial foundations: diagnosis-level health, lifecycle stages,
teaching coverage, reasoning, cases, evidence, publication blockers, AI review items,
role-aware actions, and deep-linkable boards. It clearly understands more of the
clinical editorial domain than a generic admin dashboard.

It nevertheless fails the central test: a faculty member cannot comfortably produce,
review, approve, publish, and maintain hundreds of cases in the default workspace.
The shell fragments one diagnosis across seven workflows and 16 boards, repeats
status in the header/status strip/verdict/right rail/review queue, limits rail findings,
and makes publication a read-only checklist. Several consequential actions are
explicitly deferred because they require confirmation or are absent from the safe
workflow set. The legacy shell still contains capabilities the default shell does not.
This is workflow bifurcation, not a production editorial system.

Clinical governance is represented mainly as projected scores, warnings, candidates,
and raw relationships. It does not yet provide a defensible approval packet: claim →
evidence → reviewer decision → version → publication impact. AI supervision similarly
shows pending artefacts and permits selected decisions, but does not consistently show
generation provenance, prompt/model context, human edits, confidence, or a readable
before/after narrative.

The interface helps users inspect. It does not yet let them finish.

## Readiness Scores

| Dimension | Score | Assessment |
|---|---:|---|
| Information Architecture | 5/10 | Domain-aware, but fragmented and duplicative |
| Editorial Workflow | 4/10 | Reviewable; not end-to-end completable |
| Clinical Governance | 4/10 | Signals exist; defensible governance chain does not |
| Navigation | 6/10 | Stable workflows and deep links; high context switching |
| Discoverability | 4/10 | Important material is truncated, collapsed, or off-canvas |
| Decision Support | 5/10 | Verdicts and next actions exist, but often stop before action |
| Scalability | 3/10 | Diagnosis-centric architecture does not support portfolio operations |
| Medical UX | 6/10 | Mostly clinically meaningful concepts; some software/process jargon |
| AI Collaboration | 4/10 | Review statuses exist; provenance and edit accountability are weak |
| Visual Design | 6/10 | Consistent and polished, but card-heavy and status-saturated |
| Production Readiness | 3/10 | Not certifiable for institutional use |

## Major Strengths

1. The header communicates diagnosis, taxonomy, maturity, education state, usable
   cases, graph state, blockers, warnings, and lifecycle stages in one place.
2. The seven workflows map to recognizable editorial questions rather than database
   entities: governance, objectives, reasoning, cases, learner content, and readiness.
3. The 16 boards cover a serious clinical model: teaching rules, differential support,
   evidence, reasoning paths, clue progression, discriminator coverage, scoring
   systems, mnemonics, recall prompts, and publication readiness.
4. Review items are severity-ranked, deep-linkable, and connected to role-aware action
   policy.
5. The system distinguishes candidate, review-required, approved, rejected, and
   superseded artefacts instead of pretending AI output is published truth.
6. Publication blockers and passing criteria are separated, which is the correct
   conceptual direction.
7. Existing QA fixtures intentionally cover mature, medium, sparse, reasoning-poor,
   and case-poor diagnoses—a useful foundation for product validation.

## Critical Weaknesses

### 1. The default workspace cannot complete publication

`Publication Readiness` is explicitly a **read-only publication readiness
assessment**. Lifecycle normalization, lifecycle actions, education review, case-ready
actions, clue application, regeneration, destructive operations, and other confirmed
actions are deferred from the workflow shell. The editor must escape to legacy UI or
another page. A primary workspace that cannot publish is not a primary workspace.

### 2. Approval is not backed by an approval packet

The UI exposes facts, candidates, scores, and warnings, but not a single auditable view
of the exact case version, clue sequence, explanation, distractor logic, learner
content, supporting sources, validation findings, AI contribution, and downstream
impact being approved. Confidence is therefore social, not system-supported.

### 3. Case review is split across abstractions

Diagnostic cases, clue progression, reasoning coverage, discriminator coverage,
teaching objectives, differentials, evidence, and learner content live in different
workflows. This mirrors the data model, not the reviewer task. There is no complete
case review mode with persistent case context.

### 4. Clinical governance stops at surfacing risk

There is no dependable evidence freshness, source hierarchy, citation-to-claim
coverage, contradiction resolution, duplicate-teaching resolution, curriculum impact,
or sign-off chain. “Graph readiness” and “maturity” are projections without enough
visible calculation or governance meaning to support accreditation scrutiny.

### 5. Two workspace architectures remain in production code

The workflow shell is default, while `?workspaceShell=legacy` retains legacy tabs and
capabilities. Deep links deliberately route some claim repairs back to legacy. This
creates inconsistent navigation, terminology, permissions, and feature availability.
It will also double QA and training cost.

### 6. Release confidence is inadequate

The latest browser-QA report could not certify the workflow shell, desktop overflow,
mutations, failure states, or non-senior permissions. Unit tests are valuable but do
not prove that medical educators can perform the work.

## Medium Priority Issues

- Status is repeated in the header, lifecycle track, workflow navigation tone, status
  strip, board verdict, right rail, and review queue. Repetition consumes attention
  without adding certainty.
- The right rail shows only five global and three workflow findings. Hidden risk is an
  unacceptable side effect of presentation limits unless “view all” and counts are
  unmistakable.
- The rail disappears below `xl`; the alternate mobile copilot is collapsed, making
  next actions and readiness less discoverable on common laptop widths.
- The fixed 340px rail plus dense main boards creates a narrow reading column and
  encourages vertical card stacks.
- Review Queue is a workflow alongside domain workflows, although queue items then
  reappear in the persistent rail. Editors see the same work in two structures.
- Board selection is encoded in query parameters, but there is no persistent local
  board navigator or map of completed/remaining review within a workflow.
- “Maturity” is labelled “Publication readiness” while a separate publication
  readiness workflow exists. These concepts are not safely interchangeable.
- Header actions such as “Maturity history” and “+ Add distinction” are visually
  prominent before the user has resolved blockers; their relationship to the active
  review is unclear.
- Empty states can imply safety (“No governance concerns projected”) when absence of
  data may instead mean that assessment has not run.
- There is no clear autosave/draft state, ownership, due date, or concurrent-review
  signal in the diagnosis shell.

## Minor Polish Issues

- Internal UUIDs are displayed prominently in monospace and use scarce header space.
- Uppercase eyebrow text and wide tracking are overused, weakening hierarchy.
- Numerous similarly styled dark cards make semantic boundaries visually uniform.
- Status colours carry too much meaning and need stronger textual differentiation.
- Generic labels such as “Content,” “Overview,” “Graph,” “Ready,” “More actions,”
  “Perform lifecycle action,” and “Normalize lifecycle” are not faculty language.
- “Copilot,” “candidate,” “projection,” “stable key,” and “source ID” expose system
  vocabulary where reviewer-centred language is preferable.

## Discoverability Inventory

Important information is hidden or reduced in these locations:

1. Right rail is entirely hidden below extra-large layouts.
2. Mobile copilot summary is a collapsed `<details>` element.
3. “More actions” and copilot suggestions are collapsed.
4. Additional impact fixes are collapsed behind “N more impact fixes.”
5. Queue membership is collapsed.
6. Badge overflow is hidden behind a tiny `+N` control.
7. Generic overflow actions use a compact dropdown.
8. Evidence and audit details in claim repairs are collapsed.
9. Differential support details are collapsed.
10. Deprecated and rejected reasoning paths are collapsed.
11. Evidence-supported integrity details are collapsed.
12. The rail silently truncates global findings to five and workflow findings to three.
13. Board-level content is behind seven workflows and up to four boards per workflow.
14. Legacy-only capability is hidden behind the `workspaceShell=legacy` URL mode.
15. High-consequence actions are absent/deferred rather than visibly explained at the
    point where editors need them.

Collapsing secondary technical detail is reasonable. Collapsing evidence, audit
context, and unshown blocker counts is not.

## Editorial Workflow Assessment

### Review a diagnosis

An experienced editor can identify broad health in 2–4 minutes. Determining why a
score is low and whether the diagnosis is genuinely safe takes approximately 20–35
minutes and repeated movement among governance, teaching, reasoning, cases, content,
and publication.

### Review a case

Estimated 15–25 minutes for a straightforward case; 30–45 minutes for a contested
case. Clues, reasoning, distractors, explanation, teaching coverage, and evidence are
not presented as one reviewable unit. The reviewer repeatedly changes workflow and
loses case focus.

### Approve a case

Estimated 5–10 additional minutes after review, assuming the correct senior action is
available. Approval remains uncomfortable because the interface lacks a consolidated
versioned approval packet, source coverage, and downstream-impact summary.

### Publish a diagnosis

Not reliably estimable in the default shell because it is read-only and lifecycle
actions are deferred. With legacy/context switching, expect another 10–20 minutes and
high error risk. A publish operation that depends on knowing an escape route is a
failed workflow.

## Clinical Governance and AI Collaboration

The system surfaces useful raw material—unsupported claims, graph candidates,
reasoning paths, evidence relationships, warnings, blockers, and AI draft audit
statuses—but does not turn it into an institutional governance record.

An editor cannot consistently answer:

- Which exact words were generated by which model and prompt?
- Which words were changed by a human, when, and why?
- Which claims lack evidence, and which citations directly support each claim?
- Is evidence current, authoritative, and jurisdiction-appropriate?
- What conflicts with another approved diagnosis, rule, or case?
- What learners/curricula will be affected by this change?
- Who is accountable for final clinical and educational sign-off?

AI review should be provenance-first. Current review statuses are necessary but not
sufficient.

## Medical Language Audit

Recommended terminology changes:

| Current | Better clinical-editorial language |
|---|---|
| Overview | Diagnosis governance summary |
| Content | Learner-facing education |
| Graph | Clinical knowledge relationships |
| Maturity | Editorial completeness |
| Ready | Publication eligibility |
| Perform lifecycle action | Submit governance decision |
| Normalize lifecycle | Recalculate editorial status |
| Add distinction | Add diagnostic discriminator |
| Candidate | AI-proposed / editor-proposed, explicitly labelled |
| Repair unsupported claim | Draft evidence-aligned revision |
| Stable key / source ID | Keep in technical details, not primary UI |

## Scalability

At 500 diagnoses and 6,000 cases the diagnosis page alone cannot carry the operating
model. Missing are saved portfolio views, assignment and workload balancing, batch
triage, service-level targets, committee agendas, cross-diagnosis consistency checks,
curriculum heatmaps, specialty ownership, review cycles, evidence expiry queues,
version baselines, and accreditation exports. The current shell scales vertically
within one diagnosis, not operationally across an institution.

## Missing Capabilities

- Side-by-side case/revision comparison with semantic diffs
- Claim-level evidence provenance, strength, freshness, and jurisdiction
- Full reviewer timeline and immutable sign-off record
- Named ownership, assignment, due dates, and workload views
- Inline comments, threaded resolution, and multidisciplinary sign-off
- Curriculum and competency mapping with gap/duplication analysis
- Publication simulation and learner-impact preview
- Dependency and downstream-impact analysis before approval
- Cross-diagnosis contradiction and duplicate-teaching detection
- Evidence expiry and guideline-update monitoring
- Bulk triage and batch-safe editorial operations
- Saved filters, queues, and committee review packs
- Case-level end-to-end review mode
- AI prompt/model/provenance and human-edit comparison
- Rollback, withdrawal, supersession, and emergency correction workflows
- Accreditation-ready exports and governance evidence packs

## Estimated Product Maturity

**Internal Tool**

The product has real domain modelling, useful projections, and substantial UI. It is
beyond a prototype. It remains an internal tool because key workflows are bifurcated,
publication is incomplete in the default shell, governance evidence is not defensible
end to end, portfolio operations are absent, and browser release confidence is weak.

## Top 20 Improvements

| Rank | Problem | Impact | Difficulty | Expected editorial benefit |
|---:|---|---|---|---|
| 1 | Default shell cannot complete publish/lifecycle work | Critical | High | One safe end-to-end workflow |
| 2 | No consolidated, versioned case approval packet | Critical | High | Confident and auditable approval |
| 3 | Case review fragmented across workflows | Critical | High | Cuts review time and context loss |
| 4 | Claim-to-evidence chain is not explicit | Critical | High | Defensible clinical governance |
| 5 | Legacy and workflow shells coexist | Critical | High | Removes parity gaps and training risk |
| 6 | No immutable reviewer/sign-off timeline | Critical | High | Institutional accountability |
| 7 | AI provenance and human edits are incomplete | High | High | Safe supervision of generated content |
| 8 | Publication has no impact simulation | High | High | Prevents downstream learner harm |
| 9 | Portfolio assignment/workload tooling is absent | High | High | Makes hundreds of diagnoses operable |
| 10 | Cross-diagnosis conflict/duplication checks absent | High | High | Consistent curriculum and teaching |
| 11 | Findings are truncated in the rail | High | Low | Prevents hidden blockers |
| 12 | Status is repeated across too many surfaces | Medium | Medium | Faster visual comprehension |
| 13 | No persistent review progress within workflows | Medium | Medium | Clear “reviewed / remaining” state |
| 14 | Empty states confuse unassessed with safe | High | Low | Prevents false reassurance |
| 15 | Evidence freshness and authority are invisible | High | Medium | Safer guideline-based content |
| 16 | No comments or resolution threads | Medium | High | Supports multidisciplinary review |
| 17 | No curriculum/competency coverage at portfolio scale | High | High | Committee and accreditation utility |
| 18 | Labels expose software language | Medium | Low | Lower faculty learning curve |
| 19 | Card-heavy layout wastes vertical space | Medium | Medium | More comparison, less scrolling |
| 20 | Browser QA does not certify real editorial tasks | Critical | Medium | Evidence-based release confidence |

## Final Deployment Decision

**No.** Do not sell this as an enterprise editorial platform or make it the sole
authoring environment yet. Use it internally with trained editors, preserve explicit
warnings about deferred actions, and do not equate projected readiness with governance
approval. The next release gate should be successful task-based testing with medical
educators across mature, sparse, conflicting, and AI-heavy diagnoses—not another layer
of cards.
