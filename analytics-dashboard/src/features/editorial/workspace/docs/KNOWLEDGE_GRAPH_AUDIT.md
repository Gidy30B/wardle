# Wardle Medical Knowledge Graph Audit

Date: 2026-07-03
Scope: monorepo architecture and code-path audit
Status: audit complete; no schema or feature changes performed

## Executive summary

Wardle does not currently have one medical knowledge graph. It has a useful but
fragmented **knowledge-graph ecosystem** built around the diagnosis registry:

1. extracted graph candidates and promoted graph facts;
2. structured case and education differential mappings and links;
3. diagnosis-to-diagnosis teaching relationships;
4. evidence nodes and diagnosis-evidence relationships;
5. reasoning paths that reference the other stores by JSON ID arrays;
6. case learning-goal, escalation, clue-progression, and discriminator records;
7. education, teaching rules, editorial briefs, lifecycle policy, and derived
   workspace quality projections.

This ecosystem is already valuable for editorial work. It can identify pending
candidates, missing mimic separation, weak evidence coverage, reasoning-path
gaps, case progression problems, and publication blockers. The new diagnosis
workspace makes those specialized stores feel like one system through a unified
backend read model and frontend view models.

It is not yet mature enough to be treated as a single source of clinical truth
or exposed directly to learners. The strongest data is reviewed active graph
facts, active teaching/evidence relationships, resolved differential links,
published education, and explicit case annotations. The weakest signals are
heuristic evidence extraction, frontend text matching, inferred coverage,
unreviewed candidates, and case progression projections without explicit
annotations.

The recommended direction is **not** to collapse every table into a generic
node/edge store. Keep the specialized editorial models, but introduce a
canonical `DiagnosisKnowledgeGraph` read/domain abstraction with explicit edge
semantics, shared provenance, consistent score scales, typed references, and a
learner-safety projection that includes only reviewed evidence.

### Bottom line

- Editorial usefulness: functional and already strong enough to guide review.
- Clinical truth/governance: partially implemented and inconsistent by model.
- Learner-facing readiness: not ready without canonical semantics, provenance,
  scale fixes, coverage measurement, and a reviewed-only projection.
- Overall maturity: **2.8 / 5 — functional but immature**.

## Current architecture

```text
DiagnosisRegistry (canonical diagnosis identity)
|
+-- Case / CaseRevision -------------------------------+
|   |                                                   |
|   +-- differential text -> DifferentialMapping       |
|   |                         -> DifferentialLink ------+-->
|   +-- approved-case extraction -> GraphCandidate     |   DiagnosisTeachingRelationship
|   +-- clues -> EvidenceNode/Relationship candidates -+-->
|   +-- clue progression / discriminator annotations       ReasoningPath
|   +-- learning-goal / escalation coverage                EvidenceGraph
|
+-- DiagnosisEducation / Revision ---------------------+
|   |                                                   |
|   +-- published extraction -> GraphCandidate          |
|   +-- differential text -> Mapping -> Link -----------+
|   +-- symptoms/signs/investigations -> evidence seeds |
|
+-- DiagnosisTeachingRule / EditorialBrief ------------+
|   +-- required differentials -> teaching relationships
|   +-- expected evidence -> evidence relationships
|
+-- reviewed GraphCandidate -> DiagnosisGraphFact
    +-- target facts -> teaching relationships
    +-- finding/investigation/etc. facts -> evidence relationships

Specialized stores
        |
        v
DiagnosisEditorialWorkspaceService.getFullWorkspace()
        |
        v
DiagnosisEditorialWorkspace API read model
        |
        +-- knowledgeGraphViewModel
        +-- diagnosticReasoningViewModel
        +-- caseReasoningViewModel
        +-- contentCoverageViewModel
        +-- editorialWorkflowViewModel
        |
        v
Review Queue / Overview / Teaching / Reasoning / Cases / Content / Publish
```

The unifying layer is currently a projection, not a canonical graph domain.

## Model inventory

| Model | Classification | Important fields and relations | Governance / quality | Assessment |
|---|---|---|---|---|
| `DiagnosisRegistry` | Registry entity | canonical names, aliases, taxonomy, lifecycle flags; parent of cases, education, facts, relationships, paths, coverage | activation reviewer/time; lifecycle flags; timestamps | Correct graph root and canonical node identity. |
| `DiagnosisAlias` | Registry entity | normalized term, kind, accepted-for-match, rank, source | active flag; timestamps | Important normalization layer; source is free text. |
| `DiagnosisGraphCandidate` | Evidence/support object | type, source type/id/version/path, raw and normalized text, payload, target diagnosis, confidence, dedupe key | candidate status, reviewer/time/note, merge target, promoted fact | Strong provenance relative to other models; still mixes facts, mimics, reasoning, management, and recall artifacts. |
| `DiagnosisGraphFact` | Evidence/support object | diagnosis, coarse fact type, label, payload, optional target diagnosis, provenance, source candidate | active/archived; timestamps | Reviewed promotion target, but no direct reviewer fields; inherits provenance through candidate/JSON. |
| `CaseDifferentialMapping` | Resolution object | raw/normalized differential, resolved diagnosis, suggestions, confidence, source path, dedupe | status, reviewer/time/note | Good staging model for normalization and human resolution. |
| `EducationDifferentialMapping` | Resolution object | education/revision context plus same resolution fields | status, reviewer/time/note | Parallel to case mapping; necessary but duplicated implementation. |
| `CaseDifferentialLink` | Graph edge | case/revision -> diagnosis, role, confidence, source text, source mapping | no review fields; relies on resolved mapping | Structured, idempotent case-to-diagnosis edge. |
| `EducationDifferentialLink` | Graph edge | education/revision -> diagnosis, role, confidence, source text, source mapping | no review fields | Structured education-to-diagnosis edge. |
| `DiagnosisTeachingRelationship` | Graph edge / teaching object | directed diagnosis pair, relationship type, purpose, discriminator/confusion/pitfall text, strength; optional graph fact/rule support | candidate/review/active/rejected/deprecated; reviewer/time; readiness checks | Central A-vs-B teaching edge. `supportingDifferentialLinkId` is an untyped string, not a relation. Review `note` is accepted but not persisted. |
| `EvidenceNode` | Evidence object | normalized global evidence concept, display label, evidence type/category, synonyms | candidate/active/rejected/deprecated | Useful reusable evidence vocabulary; normalization remains mostly text heuristic. |
| `DiagnosisEvidenceRelationship` | Graph edge / evidence object | diagnosis -> evidence node, relationship type, strength, discriminator weight, reasoning summary, contradictory diagnosis IDs, optional rule/relationship/case support | candidate/active/rejected/deprecated; reviewer/time; readiness checks | Valuable reviewed edge, but contradictory IDs are JSON and scale semantics are undocumented. |
| `ReasoningPath` | Reasoning object | diagnosis, goal, generation purpose, differential/evidence/teaching/node ID arrays, constraints, clue distribution, readiness score | candidate/active/rejected/deprecated; reviewer/time | A generation-oriented hyperedge. Most dependencies are JSON IDs without referential integrity. |
| `ReasoningDraftValidationRun` | Publication/readiness signal | artifact identity, trust score/tier, validation status, blockers/warnings, hallucination and coverage JSON, validator version | immutable run timestamp | Strong audit concept; artifact and path references are not database relations. |
| `DiagnosisTeachingRule` | Teaching object | stable key, category, rationale, required differentials, expected evidence, applicability flags | free-text status/source, version/timestamps | Important curriculum source, but status/source should eventually be typed. |
| `DiagnosisEditorialBrief` | Teaching object | learning goals, required rule/mimic IDs, investigation/management/generation guidance | free-text status, version | Curriculum contract; many references are JSON IDs. |
| `DiagnosisEducation` / `Revision` | Teaching object / publication artifact | structured learner content and immutable snapshots | editorial status/source, reviewer/time, publish time, creator metadata | Published education is a legitimate graph extraction source. |
| `CaseClueDiscriminatorAnnotation` | Case coverage object | clue -> eliminated diagnosis name/ID, discriminator, reasoning, strength/value | optional reviewer/time | Explicit human signal and more trustworthy than heuristic elimination. No relation to eliminated diagnosis. |
| `CaseClueProgressionAnalysis` | Case coverage/readiness signal | diagnostic states, mimic collapses, elimination, signals, ambiguity/leak flags, counts | analysis version and generated time; no reviewer | Primarily heuristic projection; must not be mistaken for clinical truth. |
| `CaseLearningGoalCoverage` | Case coverage object | case -> learning goal plus covered/missing discriminators and mimics | strength, evidence-source string, timestamps | Useful explicit coverage annotation; learning goal is not a typed entity/FK. |
| `CaseEscalationAnnotation` | Case coverage object | case -> escalation type, evidence strength, optional reasoning path | timestamps; no reviewer | Useful but escalation type and evidence scale are free-form. |
| `AiDraftRevisionAudit` / `CaseClueRevisionDraft` | Review/audit object | generated output, source issue/context, decision status, reviewer, materialization data | explicit human decision trail | Good separation of generated draft from accepted artifact. |
| `CaseValidationRun` | Publication/readiness signal | outcome, validator version, summary/findings, trigger metadata | timestamps and triggering user | Reliable only to the validator version and finding semantics. |
| `DiagnosisRegistryCandidate` / `MergeLog` | Registry governance | candidate creation/duplicate suggestions; merge snapshots and reassignment summary | reviewer/approver/performer metadata | Strong normalization workflow, though merge log registry IDs are strings rather than relations. |

## Relationship semantics

### Extracted graph payload relations

These are strings inside `DiagnosisGraphCandidate.payload`, not schema-level
edge enums.

| Relation | Nodes / direction | Meaning | Trust |
|---|---|---|---|
| `MIMICS` | source diagnosis -> target differential | The target appeared as a differential/mimic of the source. Directional storage; clinical similarity may be symmetric, but evidence is source-context-specific. | Candidate until reviewed/promoted; not directly learner-safe. |
| `SUPPORTS` | evidence/finding -> source diagnosis, sometimes in a target comparison context | Finding favors the source diagnosis. Asymmetric. | Extracted from case prose; requires review. |
| `RULES_OUT` | finding -> target differential | Finding argues against target in this comparison. Asymmetric and context-dependent, rarely absolute clinical exclusion. | Must be presented as “makes less likely,” not universal truth. |
| `DISCRIMINATES_FROM` | source diagnosis -> target diagnosis with rationale | Teaching distinction between diagnoses. Directional editorial claim. | Candidate until reviewed; can seed teaching but not learner output directly. |
| `CONFIRMS` | evidence -> diagnosis | Declared in the extractor type but no observed extraction branch currently emits it. | Effectively a placeholder semantic. |

### Diagnosis teaching relationships

All are stored as directed source-diagnosis -> target-diagnosis edges. Even
conceptually symmetric relationships need two reviewed directional edges or a
canonical symmetric projection.

| Type | Semantics | Typical source | Learner-facing safety |
|---|---|---|---|
| `DIFFERENTIAL_DISCRIMINATOR` | How source beats target | differential links, rules, pitfalls | Active + supported + reviewed summary may be used through a safe projection. |
| `MIMIC_CONFUSION` | Why target is commonly confused with source | mimic facts or primary-mimic case links | Conceptually symmetric confusion, directionally evidenced. Requires review. |
| `SHARED_PRESENTATION` | Shared clinical presentation / DDX cluster | default mapping from non-specific graph facts | Noisy; should not be learner-facing without explicit shared features. |
| `ESCALATION_CONTRAST` | Difference in urgency/escalation | modeled but not strongly generated by current collectors | Potentially high value; requires clinical review. |
| `MANAGEMENT_CONTRAST` | Management difference | management graph fact | Context-sensitive; reviewed-only. |
| `INVESTIGATION_CONTRAST` | Test/result distinction | investigation graph fact | Useful discriminator if evidence-backed. |
| `COMPLICATION_RELATIONSHIP` | Related complication teaching | complication graph fact | Often association rather than differential edge; semantics need tightening. |

Purposes (`TEACH_DISCRIMINATOR`, `PREVENT_COMMON_ERROR`,
`BUILD_DDX_CLUSTER`, `SUPPORT_CASE_GENERATION`, `SUPPORT_EDUCATION`,
`SUPPORT_RECALL`) describe editorial use, not clinical truth.

### Evidence relationships

| Type | Direction and meaning | Caveat |
|---|---|---|
| `SUPPORTS` | evidence node supports diagnosis | Does not encode prevalence, likelihood ratio, or context. |
| `DISCRIMINATES` | evidence helps separate diagnosis from contradictory IDs | Contradictory diagnoses live in JSON; target-specific meaning is weakly enforced. |
| `ESCALATES` | evidence signals urgency/severity | Generated partly by keyword matching. |
| `RULES_OUT` | evidence argues against another diagnosis | Modeled but candidate generator primarily emits `DISCRIMINATES`; avoid absolute wording. |
| `COMPLICATION_SIGNAL` | evidence signals complication | Keyword-inferred unless manually reviewed. |
| `MANAGEMENT_SIGNAL` | evidence is management-relevant | Mixes clinical evidence and action guidance. |

### Differential and case relationships

- `CaseDifferentialLink`: case -> diagnosis with role `PRIMARY_MIMIC`,
  `DIFFERENTIAL`, `IMPORTANT_EXCLUSION`, or `TEACHING_DIFFERENTIAL`.
- `EducationDifferentialLink`: education artifact -> diagnosis with the same
  roles.
- `CaseLearningGoalCoverage`: case -> free-form learning-goal ID; explicit
  editorial metadata, not a clinical edge.
- `CaseClueDiscriminatorAnnotation`: clue -> eliminated diagnosis text/optional
  ID; explicit teaching evidence, but the diagnosis reference is not enforced.
- `CaseEscalationAnnotation`: case -> escalation concept and optional reasoning
  path; explicit editorial metadata.

## Data sources and lifecycle

| Pipeline | Input -> transformation -> output | Review and idempotency | Main failure modes / automation |
|---|---|---|---|
| Approved-case graph extraction | Approved/published case clues, differentials, key findings, reasoning and differential analysis -> normalized candidate drafts -> `DiagnosisGraphCandidate` | Unique semantic/source keys and `createMany(skipDuplicates)`; candidates require senior approval before fact promotion | Runs automatically after approved case review; extraction failures are logged and do not roll back approval. Source-scoped dedupe allows cross-source semantic duplicates. |
| Published-education extraction | Published education arrays -> typed candidate drafts -> graph candidates | Same candidate review/promotion path | Runs after publish; failure logged without rolling back publication. Nested JSON extraction can select an incomplete field. |
| Graph candidate review | candidate -> transactional approve/reject/merge/resolve -> active graph fact and provenance | Senior editorial access; reviewer/time/note on candidates; fact upsert dedupe | Facts have no direct reviewer fields; unresolved mimic targets block/special-case promotion. |
| Differential mapping | case/education differential strings -> registry matcher -> mapping rows | Upsert by dedupe/source uniqueness; human resolution supports aliases/rejection | Automatically invoked during case generation and education save/regeneration; bulk backfill scripts are manual. Ambiguity and self-matches need monitoring. |
| Differential link sync | resolved mappings -> case/education links | Upsert; removes stale alternative link for mapping | Manual backfill available; link role derivation is coarse and links have no review state. |
| Teaching relationship generation | active facts + differential links + teaching-rule required differentials -> deterministic seeds -> candidate relationships | Unique source/target/type/purpose; strongest seed wins; senior activation enforces non-self, active registries, support, summary | Manual endpoint/workspace action. `supportingDifferentialLinkId` is a prefixed string. API review note is currently ignored. |
| Evidence graph generation | cases + teaching rules + education + teaching relationships + graph facts -> text extraction and keyword classification -> nodes and candidate diagnosis relationships | Node and relationship upserts; senior activation checks registry, summary and duplicate active edge | Manual endpoint/workspace action. Collector does not consistently restrict cases, rules, education, or teaching relationships to approved/active states. Keyword classification can overstate clinical meaning. |
| Reasoning path generation | active evidence, active teaching relationships, differentials, cases, rules -> goal-specific constraints and score -> candidate paths | Unique normalized key/upsert; activation requires score >=60 and dependency readiness | Manual endpoint/workspace action. Dependencies are JSON IDs and can become stale. Score is 0–100. |
| Draft validation | case/teaching/education artifact -> deterministic validation projection -> immutable validation run | Versioned validator string; no mutation of source | Manual/flow-triggered; accuracy depends on JSON heuristics and validator version. |
| Case clue progression | case clues + mimics + annotations -> heuristic states/eliminations/flags -> one analysis per case | Analysis version and regeneration; explicit annotations counted separately | Heuristic signals can be mistaken for reviewed knowledge. |
| Case coverage annotation | editor creates/updates learning-goal, escalation, discriminator records | Uniques prevent duplicate goal/escalation rows | Manual. Several target concepts are strings/JSON, so renames and merges can orphan semantics. |
| Registry candidate/merge | unresolved terms/duplicate analysis -> review/create/merge -> registry reassignments and merge log | senior approval, snapshots, hash check, audit user/time | Mature relative to graph governance; must update JSON-held graph references explicitly. |
| QA seed | deterministic registry, facts, evidence, paths, and case coverage fixtures | upserts with stable keys | Local QA only; proves UI paths, not production coverage. |

## Backend API map

All routes pass the global `ClerkAuthGuard` (or local-QA branch in development).
`/api/admin/**` routes additionally use `AdminGuard`; read/generate operations
generally require editor access, while activation/review/merge operations require
senior-editor access. The non-admin active graph routes are authenticated but do
not require editorial permission.

### Unified workspace and quality

| Method / route | Service | Shape / consumer |
|---|---|---|
| `GET /api/admin/diagnosis-workspace/:id/full` | `DiagnosisEditorialWorkspaceService.getFullWorkspace` | Unified raw/editorial read model consumed by `EditorialDiagnosisWorkspacePage`; includes graph, evidence, paths, links, cases, education, coverage and lifecycle. |
| `GET /api/admin/diagnosis-workspace/:id` | `DiagnosisWorkspaceQualityService.getSummary` | Quality summary used by case/education surfaces. |
| `GET /api/admin/diagnosis-workspace/:id/teaching-units` | `TeachingUnitCoverageService.getCoverage` | Derived education/case/graph coverage matrix. |
| `GET /api/admin/diagnosis-workspace/:id/teaching-rules` | `TeachingRulesAdminService` | Rules and rule status. |
| `GET /api/admin/diagnosis-workspace/:id/editorial-brief` | `DiagnosisEditorialBriefService` | Curriculum brief. Generate/create/update/review companion endpoints exist. |
| `POST/PATCH/DELETE .../case-learning-goal-coverage` | workspace service | Explicit case coverage annotations. |
| `POST/PATCH/DELETE .../case-escalation-annotations` | workspace service | Explicit escalation coverage. |
| `POST/PATCH/DELETE .../cases/:caseId/clue-discriminator-annotations` | workspace service | Explicit clue discriminator annotations. |
| `POST .../draft-actions/*` | targeted generation/workspace services | Case, discriminator, clue-revision, claim-repair and teaching-distinction drafts. |

### Extracted diagnosis graph

| Method / route | Purpose |
|---|---|
| `GET /api/admin/diagnosis-graph/candidates` and `/:id` | Candidate queue/detail. |
| `GET /api/admin/diagnosis-graph/candidates/unresolved-mimics` | Mimic target-resolution queue. |
| `POST .../candidates/:id/approve|reject|merge|resolve-mimic` | Senior review and fact promotion. |
| `POST /api/admin/diagnosis-graph/extract/smoke` | Manual extraction for selected diagnoses; controller currently lacks an explicit editorial decorator, so `AdminGuard` defaults to admin-only. |
| `GET /api/diagnosis-registry/:id/graph|mimics|findings|pitfalls` | Active raw facts for authenticated consumers. No current workspace consumer; workspace uses the unified admin projection. |

### Teaching, evidence, reasoning and differentials

| Method / route | Purpose / consumer |
|---|---|
| `GET /api/admin/diagnosis-teaching-relationships` | Filtered relationship list. |
| `GET /api/admin/diagnosis-registry/:id/teaching-relationships` | Per-diagnosis relationship projection. |
| `POST /api/admin/diagnosis-teaching-relationships/candidates/generate` | Deterministic candidate generation; used by graph/reasoning UI actions. |
| `POST /api/admin/diagnosis-teaching-relationships/:id/review` | Senior activation/rejection/deprecation. |
| `GET /api/admin/evidence-graph/nodes|relationships` | Raw evidence graph lists. |
| `GET /api/admin/diagnosis-registry/:id/evidence-graph` | Per-diagnosis evidence relationships. |
| `POST /api/admin/evidence-graph/candidates/generate` | Candidate generation; workspace evidence action. |
| `POST /api/admin/evidence-graph/relationships/:id/review` | Senior review. |
| `GET /api/admin/evidence-coverage/overview|diagnoses|:id` | Derived coverage/readiness projections. |
| `GET /api/admin/reasoning-paths` | Filtered path list. |
| `POST /api/admin/reasoning-paths/candidates/generate` | Candidate generation. |
| `GET /api/admin/reasoning-paths/:id/generation-context` | Active dependency context for generation. |
| `POST /api/admin/reasoning-paths/:id/review` | Senior review. |
| `POST /api/admin/reasoning-draft-validation/run` and `GET .../reasoning-draft-validation` | Validation run and audit list. |
| `GET /api/admin/differential-mappings/unresolved` | Case/education resolution queue. |
| `POST /api/admin/differential-mappings/:id/resolve` | Senior resolution. |
| `POST .../:id/create-registry-candidate` | Turn unresolved term into registry workflow. |

### Registry and lifecycle

Registry search/update, candidate review/create, merge analyze/execute,
merge-related reads, lifecycle reads/actions/normalization, and onboarding APIs
provide identity and publication governance. They are graph-adjacent because
every graph store depends on registry identity.

## Frontend consumption map

The frontend fetches one `DiagnosisEditorialWorkspace` and then derives most
board semantics locally.

| Workflow / board | Primary inputs | Nature of signal | Actions |
|---|---|---|---|
| Review Queue | all readiness items, candidates, claims, path warnings, case risks, drafts | Aggregated/deduped frontend projection | Deep links and reviewed action registry. |
| Overview / Diagnosis Health | lifecycle, coverage gaps, education, cases, graph counts, evidence/reasoning blockers | Mixed backend facts and frontend verdict | Navigation and selected safe actions. |
| Teaching / Curriculum Coverage | `coverageMatrix`, `coverageGaps`, brief learning goals | Mostly backend text-overlap coverage projection | Navigate to gaps. |
| Teaching Rules | persisted teaching rules and status | Real teaching objects | create/generate/review through existing APIs. |
| Reasoning / Diagnostic Reasoning | active/candidate teaching relationships, linked differentials, evidence, paths | Graph-backed A-vs-B projection, but confidence/verdict are frontend-derived | Primarily review/navigation. |
| Reasoning / Evidence | evidence relationships and coverage | Real specialized graph with frontend trust classification | generate candidates; activate/reject/deprecate. |
| Reasoning / Differentials | structured links and teaching relationships | Real links plus missing-discriminator simulation | Legacy shell exposes generation/review; workflow board is mostly read-only. |
| Reasoning Paths | persisted paths and readiness metadata | Real reasoning objects; warnings/verdict derived | review actions via action registry. |
| Cases / Diagnostic Cases | cases, quality projection, explicit goal coverage, diagnostic comparisons | Case-powered with graph-derived objectives | targeted case/clue draft actions. |
| Cases / Clue Progression | persisted heuristic analysis, explicit annotations, drafts | Case heuristic + human annotations | Review/navigation; detailed legacy tools remain. |
| Cases / Reasoning Coverage | diagnostic comparisons + inferred case titles + education status | Largely frontend simulation; “education covered” currently means education is not missing | Read-only. |
| Cases / Discriminator Coverage | teaching discriminator + evidence IDs + text-matched claims + inferred cases | Mixed graph and heuristic matching | Read-only. |
| Content / Education | education section health and unsupported claims | Education-powered | education/claim actions. |
| Content / Scoring Systems | education JSON | Content-derived | Read-only in workflow shell. |
| Content / Mnemonics | education exam pearls classified as mnemonics | Content-derived heuristic | Read-only. |
| Content / Recall Prompts | education JSON and shallow-depth heuristic | Content-derived | Read-only. |
| Publish | lifecycle, workspace blockers, coverage, claims, cases, reasoning, education | Frontend checklist over backend projections | Explicitly read-only; no publish action wired. |
| Right/review rail | all above | Contextual frontend prioritization | Deep links and policy-gated actions. |

### Important computed/fallback behavior

- A diagnostic comparison is synthesized from a teaching relationship; linked
  differentials without an active relationship become “missing discriminator”
  comparisons.
- Case-to-comparison coverage is inferred from persisted annotations and case
  progression/text signals; it is not a canonical edge in every case.
- Education coverage in case reasoning can be treated as covered merely because
  education exists, not because the exact reasoning/discriminator is present.
- Unresolved differential issues are sometimes reconstructed from generic
  coverage gaps and title text.
- Review queues merge the same underlying weakness from several projections;
  dedupe reduces but does not eliminate semantic duplication.

## Diagnosis workspace coherence

### Genuinely graph-powered

- Evidence board (`EvidenceNode` + reviewed diagnosis relationships).
- Reasoning paths board.
- Candidate/review portions of the differential board.
- Mimic-separation comparisons backed by active teaching relationships.
- Graph fact/candidate queues and their review actions.

### Case-powered

- Diagnostic cases, clue progression, case quality, explicit discriminator
  annotations, learning-goal coverage, escalation coverage, and clue drafts.

### Education/content-powered

- Education, scoring systems, mnemonics, recall prompts, unsupported claims,
  and some teaching/evidence candidate generation.

### Registry/lifecycle-powered

- Diagnosis identity, metadata, onboarding, lifecycle, dictionary/playable/
  generatable state, and core publication governance.

### Simulated graph intelligence

- Text-overlap teaching coverage.
- Case reasoning/discriminator coverage inferred rather than explicitly linked.
- Frontend confidence/trust and clinical verdict wording.
- Unresolved differential warnings reconstructed from coverage-gap labels.
- Keyword-classified evidence type, strength, discriminator weight, escalation,
  and clinical category before human review.

### Reliability assessment

Reliable: lifecycle policy results, explicit review states, reviewed active
facts/relationships, mapping status, persisted annotations, education status,
validation runs with a known version, and database uniqueness constraints.

Moderately reliable: readiness checks, coverage counts, path dependency
warnings, active mimic comparisons, and case quality projections with explicit
annotations.

Noisy: candidate counts, broad evidence generation, text-overlap coverage,
heuristic clue elimination, duplicated warnings across projections, and
frontend “covered” shortcuts.

Clinically meaningful: reviewed A-vs-B discriminator summaries, evidence-backed
relationships, explicit clue eliminations, escalation annotations, and
reasoning-path constraints.

Editorial bookkeeping: statuses, queue grouping, lifecycle completeness,
candidate counts, timestamps, draft state, and generic coverage presence.

## Maturity scorecard

| Dimension | Score | Rationale |
|---|---:|---|
| Data model completeness | 4 | Strong specialized models cover identity, facts, evidence, teaching, reasoning and cases. Typed/FK gaps remain. |
| Clinical semantic clarity | 2 | Semantics are split across enums, payload strings and heuristics; symmetry/context are not explicit. |
| Review/governance maturity | 3 | Candidate/active workflows and senior gates exist, but provenance/review notes are inconsistent. |
| Coverage across diagnoses | 2 | Generation/backfill paths exist, but no repository-level census or enforced minimum graph coverage exists; QA seed coverage is not representative. |
| Case integration | 3 | Automatic extraction and rich case analysis exist; explicit coverage is still incomplete and heuristics dominate some boards. |
| Education integration | 3 | Published extraction and content coverage are functional; semantic coverage is often text-based. |
| Differential reasoning quality | 3 | Structured mappings, links, teaching relationships and paths are functional; target-specific evidence remains weakly enforced. |
| Editorial usefulness | 4 | Workspace and queues provide real operational value today. |
| Learner-facing readiness | 2 | Reviewed-only safe projection, calibrated truth semantics, and clinical validation are missing. |
| Maintainability | 2 | Parallel models/services and duplicated derivations create scale, drift and debugging risk. |

## Risk register

| Risk | Severity | Evidence / impact | Mitigation |
|---|---|---|---|
| Score-scale mismatch | Critical | Backend evidence strength is integer-like 1–4, discriminator weight 0–5, path readiness 0–100; frontend view models compare several values to 0–1 thresholds. Low-trust and weak-path logic can be wrong. | Define named scale types and normalize at API boundary; add contract tests. |
| Multiple competing sources of relationship truth | High | Graph facts, differential links, teaching relationships, evidence relationships and education prose can all describe the same distinction. | Canonical read/domain abstraction with precedence and provenance rules. |
| Generated evidence from insufficiently governed sources | High | Evidence collector scans broad case/rule/education sets and candidate teaching relationships without consistent published/active filtering. | Restrict source eligibility and record source status/version. |
| Untyped/stale references | High | Reasoning paths use JSON ID arrays; contradictory diagnosis IDs are JSON; differential support is a prefixed string. Registry merges cannot rely on FK cascades. | Typed join tables or validated reference objects plus integrity sweeps. |
| Self-comparisons | High | Generators skip some self-edges and frontend labels them, proving historical/input paths can still create them. They mislead generation and coverage. | Database/service invariant, cleanup query, regression tests. |
| Review note loss | Medium | Teaching relationship review accepts `note`, but no model/service persistence exists. | Add review event/history model or review-note field. |
| Misleading `RULES_OUT` language | High | Case prose may mean “less likely,” while relation name sounds absolute. | Rename semantic to `ARGUES_AGAINST` or add certainty/context. |
| Evidence node over-normalization | Medium | Text labels become global nodes through normalization and heuristics; clinically distinct contexts may collapse or duplicate. | Concept IDs, structured attributes and merge review. |
| Source-scoped candidate duplication | Medium | Candidate dedupe includes source/path; equivalent facts from multiple sources survive until fact promotion/merge. | Semantic duplicate queue and canonical concept fingerprint. |
| Active fact is not automatically learner-safe | High | Fact status only active/archived and lacks explicit clinical-review tier. | Separate editorial activation from learner-safe approval. |
| No graph-wide audit history | Medium | Current rows store latest reviewer/time; status transitions are not uniformly event-sourced. | Append-only review/provenance events. |
| Warning multiplication | Medium | Backend quality, coverage, knowledge, reasoning, case, content and publish projections can report the same issue. | Canonical issue IDs and source-to-presentation aggregation. |
| Heuristic case analysis over-trusted | High | `heuristic_v1` progression can drive blocker wording without clinical annotation. | Visually and logically separate inferred vs reviewed signals. |
| Public active-graph API ambiguity | Medium | Authenticated non-editor routes expose raw active facts, while active does not equal learner-approved. | Add learner-safe projection or tighten access. |

## Recommended architecture

### Keep specialized write models

Do not replace the current tables with one generic `Node`/`Edge` schema. The
review lifecycle of an evidence claim differs materially from a differential
mapping, teaching relationship, reasoning path, and case annotation.

### Add a canonical domain/read abstraction

Introduce a backend `DiagnosisKnowledgeGraphService` (domain service, not
necessarily a new table initially) that emits:

```text
DiagnosisKnowledgeGraph
  diagnosis
  concepts[]
  diagnosisRelationships[]
  evidenceAssertions[]
  teachingDistinctions[]
  reasoningPaths[]
  caseCoverage[]
  provenance[]
  reviewState
  learnerSafety
```

It should own scale normalization, symmetry rules, canonical issue IDs,
provenance precedence, review-state interpretation, and integrity validation.

### Sources of truth

- Diagnosis-to-diagnosis clinical/teaching relationships:
  `DiagnosisTeachingRelationship`, but only after typed support and review.
- Raw differential occurrence: case/education differential links.
- Evidence vocabulary: `EvidenceNode`.
- Diagnosis-evidence assertion: reviewed `DiagnosisEvidenceRelationship`.
- Teaching rule/discriminator contract: `DiagnosisTeachingRule` plus reviewed
  teaching relationship; do not infer the final rule solely from graph fact.
- Generation plan: active `ReasoningPath`, with typed dependency joins.
- Case coverage: explicit `CaseLearningGoalCoverage`, escalation and clue
  annotations; heuristic progression remains advisory metadata.
- Learner-facing content: published education and an explicit learner-safe graph
  projection containing reviewed, supported, non-deprecated assertions only.

### Review states

Use a shared lifecycle vocabulary while preserving model-specific transitions:

```text
GENERATED -> NEEDS_REVIEW -> EDITORIALLY_ACTIVE
                         -> REJECTED / DEPRECATED
EDITORIALLY_ACTIVE -> CLINICALLY_VALIDATED -> LEARNER_SAFE
```

Record append-only review events with reviewer, role, action, note, timestamp,
source version, and evidence snapshot/hash.

### Safe learner derivation

Learner output must require:

1. active registry identities;
2. non-self relationships;
3. clinically validated teaching/evidence edges;
4. explicit provenance and current source versions;
5. no blocker-level integrity issues;
6. calibrated language (`supports`, `argues against`, not absolute exclusion);
7. content review after generation.

## Phased implementation roadmap

### Phase 1 — Inventory and cleanup

- Goal: make current data measurable and internally consistent.
- Likely files: Prisma integrity scripts/migrations, graph services, workspace
  view-model tests, admin diagnostics.
- Output: graph census, self-edge/duplicate/orphan cleanup, scale contract.
- Tests: cross-layer score-scale tests; self-edge invariants; stale-ID audit.
- Risk: low–medium.
- Done: every active edge has valid nodes/support; scores have documented units;
  coverage dashboard reports model/status/diagnosis counts.

### Phase 2 — Canonical relationship semantics

- Goal: define one semantic contract across specialized stores.
- Likely files: graph enums/domain types, teaching/evidence services,
  `DiagnosisKnowledgeGraphService`, API types.
- Output: directionality, symmetry, certainty, context and edge precedence rules.
- Tests: semantic mapping matrix; symmetric projection; `RULES_OUT` language.
- Risk: medium–high.
- Done: every relationship maps unambiguously to the canonical domain model.

### Phase 3 — Provenance and review hardening

- Goal: make active knowledge auditable and learner-safety-capable.
- Likely files: Prisma schema/migration, review services/controllers, merge logic.
- Output: typed support joins, review event history, learner-safety state.
- Tests: review transition authorization, note persistence, merge reassignment,
  provenance snapshots.
- Risk: high due to migration/backfill.
- Done: no active assertion lacks provenance; all transitions are traceable.

### Phase 4 — Workspace signal cleanup

- Goal: make every warning singular, calibrated and explainable.
- Likely files: workspace backend projection, knowledge/diagnostic/case/content
  view models, review queue and publish checklist.
- Output: canonical issue IDs, reviewed-vs-inferred labels, reduced duplicates.
- Tests: fixture matrices for mature/weak diagnoses; no duplicate queue issues;
  exact source attribution.
- Risk: medium.
- Done: editors can identify the source and trust tier of every signal.

### Phase 5 — Generation/recommendation loop

- Goal: close the reviewed graph -> generation -> validation -> editorial
  learning loop.
- Likely files: reasoning context builder, case/education/rule generators,
  validation runs, accepted-repair learning.
- Output: generation uses only eligible reviewed context and records which edges
  shaped the draft.
- Tests: deterministic context snapshots, forbidden-pattern enforcement,
  accepted/rejected draft feedback behavior.
- Risk: high.
- Done: generated artifacts are reproducible from a versioned graph context.

### Phase 6 — Learner-facing graph experiences

- Goal: safely expose differential explanations and evidence reasoning.
- Likely files: learner API projection, game UI, education views, analytics.
- Output: reviewed “why A over B,” clue interpretation and evidence pathways.
- Tests: clinical fixture approval, language-safety tests, authorization,
  accessibility, outcome analytics.
- Risk: very high clinical/product risk.
- Done: only learner-safe reviewed assertions are exposed and monitored.

## Immediate next 10 fixes

1. Fix and test score scales across backend DTOs and frontend view models.
2. Add a read-only graph census/integrity endpoint or script with per-diagnosis
   coverage, status, self-edge, duplicate and stale-reference counts.
3. Block self-comparisons at database/service boundaries and clean existing rows.
4. Persist teaching relationship review notes; standardize review history.
5. Restrict evidence candidate sources to eligible case, education, rule and
   teaching-relationship states.
6. Replace `supportingDifferentialLinkId` strings with typed case/education
   support joins or a polymorphic support table.
7. Replace reasoning-path JSON ID arrays with validated joins or an integrity-
   checked typed reference layer.
8. Add explicit `inferred`, `editor_reviewed`, `clinically_validated`, and
   `learner_safe` trust distinctions.
9. Replace absolute `RULES_OUT` semantics with contextual certainty and target-
   specific evidence assertions.
10. Centralize canonical issue IDs so workspace/review/publish views do not
    multiply the same underlying problem.

## Files inspected

### Backend and schema

- `doctordle-backend/prisma/schema.prisma`
- graph/evidence/reasoning/differential migrations under `prisma/migrations`
- `prisma/seed/editorial-workspace-qa.seed.ts`
- `scripts/backfill-differential-mappings.ts`
- `scripts/backfill-differential-links.ts`
- `scripts/seed-diagnosis-teaching-rules.ts`
- `src/modules/diagnosis-graph/*`
- `src/modules/admin/admin.controller.ts`
- `src/modules/admin/diagnosis-editorial-workspace.service.ts`
- `src/modules/admin/diagnosis-workspace-quality.service.ts`
- `src/modules/admin/evidence-graph.service.ts`
- `src/modules/admin/evidence-coverage.service.ts`
- `src/modules/admin/diagnosis-teaching-relationship.service.ts`
- `src/modules/admin/reasoning-path.service.ts`
- `src/modules/admin/reasoning-draft-validation.service.ts`
- `src/modules/admin/teaching-unit-coverage.service.ts`
- `src/modules/admin/targeted-case-generation.service.ts`
- `src/modules/admin/case-review.service.ts`
- diagnosis-registry matching, candidate, lifecycle and merge services
- diagnosis-education generation, review and regeneration services
- case-generator reasoning and teaching-alignment paths

### Frontend

- `analytics-dashboard/src/api/admin.ts`
- `analytics-dashboard/src/api/admin.types.ts`
- `EditorialDiagnosisWorkspacePage.tsx`
- workspace workflow registry, navigation, page shell and review rail
- all seven workflow components and their board components
- `knowledgeGraphViewModel.ts`
- `diagnosticReasoningViewModel.ts`
- `caseReasoningViewModel.ts`
- `contentCoverageViewModel.ts`
- `editorialWorkspaceViewModel.ts`
- `editorialWorkflowViewModel.ts`
- graph/evidence/reasoning action registry modules
- legacy differential-map, cases, teaching, overview and integrity tabs
- related unit tests and implementation/QA documentation

## Validation and limitations

- This was a static code-path and schema audit.
- A local database census was attempted as a read-only validation step but did
  not return reliably during the audit window, so no unverified row counts are
  claimed here.
- Repository QA fixtures demonstrate the paths but are not evidence of global
  production diagnosis coverage.
- No backend, schema, runtime or frontend feature code was changed for this
  audit.
