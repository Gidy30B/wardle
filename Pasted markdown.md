# PHASE 1 — AUDIT

## 1.1 Backend Flow
- [game.controller.ts](</c:/Users/user/DxLab/doctordle-backend/src/modules/gameplay/game.controller.ts:95>) → `submitGuess()` → calls `GameSessionService.submitGuess(...)`.
- [game-session.service.ts](</c:/Users/user/DxLab/doctordle-backend/src/modules/gameplay/game-session.service.ts:27>) → `submitGuess()` → delegates to `SessionService.submitGuess(...)`.
- [session.service.ts](</c:/Users/user/DxLab/doctordle-backend/src/modules/gameplay/session.service.ts:106>) → `submitGuess()` → delegates to `submitDailyGuess(...)`.
- [session.service.ts](</c:/Users/user/DxLab/doctordle-backend/src/modules/gameplay/session.service.ts:322>) → `submitDailyGuess()` → loads `gameSession`, `case`, `case.diagnosis`, `attempts` via Prisma.
- [session.service.ts](</c:/Users/user/DxLab/doctordle-backend/src/modules/gameplay/session.service.ts:366>) → `normalize(input.guess)` for duplicate detection only.
- [session.service.ts](</c:/Users/user/DxLab/doctordle-backend/src/modules/gameplay/session.service.ts:369>) → `EvaluatorApiService.evaluateGuess(input.guess, session.case.diagnosis.name)`.
- [evaluator-api.service.ts](</c:/Users/user/DxLab/doctordle-backend/src/modules/diagnostics/services/evaluator-api.service.ts:9>) → `evaluateGuess()` → `EvaluatorEngineService.evaluate(...)`.
- [evaluator-engine.service.ts](</c:/Users/user/DxLab/doctordle-backend/src/modules/diagnostics/services/evaluator-engine.service.ts:14>) → `evaluate()` → selects `EvaluatorV1Service` or `EvaluatorV2Service` from `EVALUATOR_VERSION`.
- [evaluator-v2.service.ts](</c:/Users/user/DxLab/doctordle-backend/src/modules/diagnostics/v2/evaluator-v2.service.ts:22>) → `evaluate()` → `preprocess()` + retrieval + synonym + fuzzy + ontology + score mapping.
- [retrieval.service.ts](</c:/Users/user/DxLab/doctordle-backend/src/modules/diagnostics/services/retrieval.service.ts:37>) → `retrieveTopK()` → queries `DiagnosisEmbedding` and `Diagnosis`/`Synonym`.
- [session.service.ts](</c:/Users/user/DxLab/doctordle-backend/src/modules/gameplay/session.service.ts:495>) → `EvaluationService.computeGuessOutcome(...)`.
- [attempt.service.ts](</c:/Users/user/DxLab/doctordle-backend/src/modules/gameplay/attempt.service.ts:69>) → `recordAttemptInTransaction()` → persists `Attempt`.
- [schema.prisma](</c:/Users/user/DxLab/doctordle-backend/prisma/schema.prisma:243>) → `Attempt` table stores `guess`, `normalizedGuess`, `score`, `result`, `signals`, `evaluatorVersion`.

## 1.2 Matching Logic
- current matching type: additive score-based evaluator with multiple signals, then threshold-to-label mapping.
- exact?: yes; `normalizedGuess === normalizedAnswer` in [evaluator-v2.service.ts](</c:/Users/user/DxLab/doctordle-backend/src/modules/diagnostics/v2/evaluator-v2.service.ts:44>).
- fuzzy?: yes; Levenshtein similarity in [fuzzy.ts](</c:/Users/user/DxLab/doctordle-backend/src/modules/diagnostics/services/fuzzy.ts:1>).
- synonym?: yes, but only through hardcoded `SynonymService` map in [synonym.service.ts](</c:/Users/user/DxLab/doctordle-backend/src/modules/knowledge/synonym.service.ts:5>).
- embedding?: yes; retrieval over `DiagnosisEmbedding` in [retrieval.service.ts](</c:/Users/user/DxLab/doctordle-backend/src/modules/diagnostics/services/retrieval.service.ts:74>).
- current acceptance is not strict; `mapLabel(score)` can mark a guess `correct` from weighted score, not only canonical/alias equality, in [score.ts](</c:/Users/user/DxLab/doctordle-backend/src/modules/diagnostics/services/score.ts:34>).
- current answer source is only `session.case.diagnosis.name` in [session.service.ts](</c:/Users/user/DxLab/doctordle-backend/src/modules/gameplay/session.service.ts:369>).
- current fallback path is retrieval fallback mode when embeddings fail or return empty in [retrieval.service.ts](</c:/Users/user/DxLab/doctordle-backend/src/modules/diagnostics/services/retrieval.service.ts:69>) and [retrieval.service.ts](</c:/Users/user/DxLab/doctordle-backend/src/modules/diagnostics/services/retrieval.service.ts:97>).
- current LLM fallback is effectively inactive; `mockLlmDecision()` returns `null` in [llm-fallback.service.ts](</c:/Users/user/DxLab/doctordle-backend/src/modules/diagnostics/llm/llm-fallback.service.ts:49>).

## 1.3 Data Model
- diagnosis source: `Case.diagnosisId -> Diagnosis.id -> Diagnosis.name` in [schema.prisma](</c:/Users/user/DxLab/doctordle-backend/prisma/schema.prisma:83>) and [schema.prisma](</c:/Users/user/DxLab/doctordle-backend/prisma/schema.prisma:52>).
- synonym handling: structured DB `Synonym` exists in [schema.prisma](</c:/Users/user/DxLab/doctordle-backend/prisma/schema.prisma:74>), but strict equality uses only hardcoded aliases in [synonym.service.ts](</c:/Users/user/DxLab/doctordle-backend/src/modules/knowledge/synonym.service.ts:5>).
- explanation usage: editorial explanation is stored as JSON on `Case`/`CaseRevision` in [schema.prisma](</c:/Users/user/DxLab/doctordle-backend/prisma/schema.prisma:92>) and [schema.prisma](</c:/Users/user/DxLab/doctordle-backend/prisma/schema.prisma:127>); AI explanation is stored in `ExplanationContent` in [schema.prisma](</c:/Users/user/DxLab/doctordle-backend/prisma/schema.prisma:201>).
- explanation usage in matching: none; gameplay only fetches explanation after terminal result in [session.service.ts](</c:/Users/user/DxLab/doctordle-backend/src/modules/gameplay/session.service.ts:605>).
- natural registry anchor already exists: `Diagnosis` is the canonical structured entity and `Case`/`CaseRevision` already reference it.

## 1.4 Frontend Input
- owner: React owns canonical guess state in [useGameEngine.ts](</c:/Users/user/DxLab/doctordle-game/src/features/game/useGameEngine.ts:77>); Phaser receives it through `RoundViewModel` in [buildRoundViewModel.ts](</c:/Users/user/DxLab/doctordle-game/src/features/game/buildRoundViewModel.ts:125>) and [gameSessionBridge.ts](</c:/Users/user/DxLab/doctordle-game/src/features/game/phaser/gameSessionBridge.ts:1>).
- type: free-text string `guess` submitted via [game.api.ts](</c:/Users/user/DxLab/doctordle-game/src/features/game/game.api.ts:25>) with payload shape from [game.types.ts](</c:/Users/user/DxLab/doctordle-game/src/features/game/game.types.ts:1>).
- autocomplete: absent; no mounted text input or suggestion API exists in current gameplay flow.
- keyboard ownership: Phaser owns live custom keyboard and hardware keyboard in [CaseScene.ts](</c:/Users/user/DxLab/doctordle-game/src/features/game/phaser/case-scene/CaseScene.ts:325>) and [CaseScene.ts](</c:/Users/user/DxLab/doctordle-game/src/features/game/phaser/case-scene/CaseScene.ts:2526>).
- safe insertion point: extend `RoundViewModel`, `PhaserGameSessionSnapshot`, and typed intents; keep React as query/selection source of truth and Phaser as rendered suggestion surface.

## 1.5 Analytics
- captured: raw `Attempt.guess`, `normalizedGuess`, `result`, `score`, `signals`, `evaluatorVersion`, `clueIndexAtAttempt` in [schema.prisma](</c:/Users/user/DxLab/doctordle-backend/prisma/schema.prisma:243>).
- captured: top wrong guesses, accuracy per case, signal averages, fallback rate, attempts-over-time in [analytics.service.ts](</c:/Users/user/DxLab/doctordle-backend/src/modules/analytics/analytics.service.ts:23>).
- missing: accepted alias id, selected diagnosis id, selected alias id, search term source, unmatched aggregate table, normalized top-wrong reporting, near-miss telemetry by candidate diagnosis.

## 1.6 Critical Findings
- finding 1: acceptance is not deterministic; `correct` can come from additive fuzzy/embedding/ontology score instead of exact canonical-or-alias equality in [score.ts](</c:/Users/user/DxLab/doctordle-backend/src/modules/diagnostics/services/score.ts:22>).
- finding 2: DB synonyms already exist, but acceptance does not use them; only a tiny hardcoded alias map is consulted for exact synonym acceptance in [synonym.service.ts](</c:/Users/user/DxLab/doctordle-backend/src/modules/knowledge/synonym.service.ts:5>).
- finding 3: the answer passed into evaluation is only `diagnosis.name`; explanation, clues, and editorial metadata do not participate in acceptance or retrieval today in [session.service.ts](</c:/Users/user/DxLab/doctordle-backend/src/modules/gameplay/session.service.ts:369>) and [retrieval.service.ts](</c:/Users/user/DxLab/doctordle-backend/src/modules/diagnostics/services/retrieval.service.ts:101>).
- finding 4: retrieval fallback only scans a limited unsorted subset of diagnoses in [retrieval.service.ts](</c:/Users/user/DxLab/doctordle-backend/src/modules/diagnostics/services/retrieval.service.ts:170>), so candidate discovery degrades badly as catalog size grows.
- finding 5: analytics group wrong answers by raw `guess`, not `normalizedGuess`, so editorial curation input is fragmented in [analytics.service.ts](</c:/Users/user/DxLab/doctordle-backend/src/modules/analytics/analytics.service.ts:27>).
- finding 6: explanation text is available and validated editorially, but only as post-round content, not as controlled suggestion metadata in [case-review.service.ts](</c:/Users/user/DxLab/doctordle-backend/src/modules/admin/case-review.service.ts:134>) and [explanation.validator.ts](</c:/Users/user/DxLab/doctordle-backend/src/modules/case-validation/validators/explanation.validator.ts:49>).

## 1.7 Files To Modify (Later)
- [schema.prisma](</c:/Users/user/DxLab/doctordle-backend/prisma/schema.prisma:52>): add registry/alias/search/analytics fields and tables.
- [session.service.ts](</c:/Users/user/DxLab/doctordle-backend/src/modules/gameplay/session.service.ts:306>): switch gameplay acceptance to strict registry matching.
- [submit-game-guess.dto.ts](</c:/Users/user/DxLab/doctordle-backend/src/modules/gameplay/dto/submit-game-guess.dto.ts:3>): extend payload for diagnosis/alias selection.
- [evaluator-api.service.ts](</c:/Users/user/DxLab/doctordle-backend/src/modules/diagnostics/services/evaluator-api.service.ts:6>): orchestrate strict acceptance vs secondary similarity.
- [retrieval.service.ts](</c:/Users/user/DxLab/doctordle-backend/src/modules/diagnostics/services/retrieval.service.ts:37>): reuse for autocomplete retrieval only, not acceptance.
- [analytics.service.ts](</c:/Users/user/DxLab/doctordle-backend/src/modules/analytics/analytics.service.ts:23>): normalize top-wrong and expose unmatched registry analytics.
- [analytics.controller.ts](</c:/Users/user/DxLab/doctordle-backend/src/modules/analytics/analytics.controller.ts:4>): add new registry analytics endpoints if needed.
- [game.controller.ts](</c:/Users/user/DxLab/doctordle-backend/src/modules/gameplay/game.controller.ts:24>): add autocomplete endpoint under gameplay.
- [useGameEngine.ts](</c:/Users/user/DxLab/doctordle-game/src/features/game/useGameEngine.ts:66>): add query/selection/suggestion state in React.
- [game.api.ts](</c:/Users/user/DxLab/doctordle-game/src/features/game/game.api.ts:25>): add autocomplete fetch and new submit payload.
- [game.types.ts](</c:/Users/user/DxLab/doctordle-game/src/features/game/game.types.ts:1>): add suggestion and selection types.
- [round.types.ts](</c:/Users/user/DxLab/doctordle-game/src/features/game/round.types.ts:30>): extend Phaser snapshot contract.
- [buildRoundViewModel.ts](</c:/Users/user/DxLab/doctordle-game/src/features/game/buildRoundViewModel.ts:125>): project autocomplete state into the explicit view model.
- [GamePlaySection.tsx](</c:/Users/user/DxLab/doctordle-game/src/features/game/GamePlaySection.tsx:19>): add new typed intents for suggestion navigation/selection.
- [gameSessionBridge.ts](</c:/Users/user/DxLab/doctordle-game/src/features/game/phaser/gameSessionBridge.ts:6>): add typed suggestion intents.
- [CaseScene.ts](</c:/Users/user/DxLab/doctordle-game/src/features/game/phaser/case-scene/CaseScene.ts:187>): render autocomplete list in Phaser without moving state ownership.

---

# PHASE 2 — SCHEMA

## 2.1 New Models
- model: `DiagnosisAlias`.
- fields: `id`, `diagnosisId`, `term`, `normalizedTerm`, `kind`, `acceptedForMatch`, `rank`, `source`, `active`, `createdAt`, `updatedAt`.
- purpose: canonical accepted aliases, abbreviations, and search-only terms tied to an existing `Diagnosis`.
- model: `DiagnosisKeyword`.
- fields: `id`, `diagnosisId`, `term`, `normalizedTerm`, `source`, `weight`, `active`, `createdAt`, `updatedAt`.
- purpose: explanation-derived and editorial keyword index for autocomplete/ranking only.
- model: `DiagnosisRejectedGuess`.
- fields: `id`, `rawGuess`, `normalizedGuess`, `caseId`, `diagnosisId`, `count`, `lastResult`, `lastSeenAt`, `firstSeenAt`.
- purpose: aggregate unmatched/wrong inputs for editorial alias curation and ranking.
- model: `DiagnosisSelectionEvent`.
- fields: `id`, `sessionId`, `caseId`, `diagnosisId`, `aliasId`, `rawGuess`, `normalizedGuess`, `submittedVia`, `accepted`, `createdAt`.
- purpose: analytics-grade submission telemetry without overloading `Attempt`.

## 2.2 Changes To Existing Models
- model: `Diagnosis`.
- change: add `displayLabel String?` and `normalizedName String? @unique`.
- reason: make the existing `Diagnosis` the canonical registry root without breaking current relations.
- model: `Attempt`.
- change: add nullable `submittedDiagnosisId`, `submittedAliasId`, `acceptanceMode`, `selectionSource`.
- reason: preserve per-attempt traceability for hybrid rollout and audits.
- model: `Synonym`.
- change: keep unchanged for backward compatibility during migration.
- reason: avoid breaking retrieval and existing scripts while `DiagnosisAlias` is backfilled and adopted.
- model: `Case` and `CaseRevision`.
- change: no new foreign key in phase 1 rollout; continue using `diagnosisId`.
- reason: `Diagnosis` already anchors the registry safely, so no case-relational rewrite is needed.

## 2.3 Migration Plan
- step 1: add nullable fields and new tables only; do not remove `Synonym` or change existing relations.
- step 2: backfill `Diagnosis.normalizedName`, `DiagnosisAlias`, `DiagnosisKeyword` optional rows, and analytics scaffolding.
- step 3: ship strict matcher against `Diagnosis` + `DiagnosisAlias` while leaving old evaluator services intact behind a flag.
- step 4: deprecate direct `Synonym` acceptance usage only after backfill verification passes.

## 2.4 Safety
- risk: duplicate alias normalization can create ambiguous acceptance.
- mitigation: unique index on `(normalizedTerm, active)` scoped to one diagnosis via app validation plus migration-time duplicate checks.
- risk: changing case relations could cause broad regressions.
- mitigation: do not alter `Case.diagnosisId` ownership; treat `Diagnosis` as registry root.
- risk: mixed old/new synonym sources can drift.
- mitigation: make `DiagnosisAlias` the only acceptance source once flag is enabled; keep `Synonym` read-only until cleanup.

---

# PHASE 3 — BACKFILL

## 3.1 Data Sources
- source: `Diagnosis.name` from [schema.prisma](</c:/Users/user/DxLab/doctordle-backend/prisma/schema.prisma:52>).
- mapping: populate `Diagnosis.normalizedName` and create one canonical `DiagnosisAlias` row with `acceptedForMatch=true`.
- source: `Synonym.term` from [schema.prisma](</c:/Users/user/DxLab/doctordle-backend/prisma/schema.prisma:74>).
- mapping: create `DiagnosisAlias` rows; default `kind='accepted'`, `acceptedForMatch=true`.
- source: hardcoded aliases in [synonym.service.ts](</c:/Users/user/DxLab/doctordle-backend/src/modules/knowledge/synonym.service.ts:5>) and abbreviations in [preprocess.ts](</c:/Users/user/DxLab/doctordle-backend/src/modules/diagnostics/pipeline/preprocess.ts:3>).
- mapping: migrate these into `DiagnosisAlias` rows so acceptance no longer depends on code constants.
- source: `Case.explanation` / `CaseRevision.explanation` in [schema.prisma](</c:/Users/user/DxLab/doctordle-backend/prisma/schema.prisma:92>) and [schema.prisma](</c:/Users/user/DxLab/doctordle-backend/prisma/schema.prisma:127>).
- mapping: do not backfill accepted aliases from explanation; optional phase creates `DiagnosisKeyword` rows only after conservative extraction rules.

## 3.2 Backfill Logic
- step 1: iterate all `Diagnosis` rows and compute `normalizedName` using the existing normalization contract from [normalize.ts](</c:/Users/user/DxLab/doctordle-backend/src/modules/diagnostics/pipeline/normalize.ts:1>).
- step 2: create one canonical alias row per diagnosis from `Diagnosis.name`.
- step 3: migrate DB `Synonym` rows into `DiagnosisAlias`.
- step 4: migrate hardcoded synonym/abbreviation constants into `DiagnosisAlias` if their canonical diagnosis already exists.
- step 5: skip explanation-derived keywords in initial backfill unless the extracted token exactly matches an editorial allowlist; otherwise leave `DiagnosisKeyword` empty.
- step 6: rebuild diagnosis embeddings from canonical names plus accepted/searchable terms after alias backfill, using the existing script pattern in [embed-diagnoses.ts](</c:/Users/user/DxLab/doctordle-backend/scripts/embed-diagnoses.ts:24>).

## 3.3 Idempotency Strategy
- method: implement a dedicated backfill script with `upsert` keyed by `Diagnosis.id` + normalized alias term; no deletes in the first rollout.
- method: mark script rerunnable and only insert missing aliases/keywords; never mutate case linkage.
- method: log skipped duplicates and unresolved hardcoded alias targets for manual review.

## 3.4 Validation
- check 1: every `Diagnosis` has `normalizedName` and exactly one canonical alias row.
- check 2: every `Synonym` row has a matching `DiagnosisAlias` row.
- check 3: no `normalizedTerm` points to multiple active diagnoses.
- check 4: backfilled hardcoded aliases match the old `SynonymService` resolution set.
- check 5: embedding rebuild count equals canonical names + active accepted/search-only terms.

---

# PHASE 4 — STRICT MATCHER

## 4.1 Matcher Logic
- normalization: reuse current lowercase/trim/punctuation-strip contract from [normalize.ts](</c:/Users/user/DxLab/doctordle-backend/src/modules/diagnostics/pipeline/normalize.ts:1>); do not use fuzzy, embeddings, ontology, or explanation for acceptance.
- matching rules: accept only if normalized input equals `Diagnosis.normalizedName` or an active `DiagnosisAlias.normalizedTerm` with `acceptedForMatch=true`.
- matching rules: if strict match succeeds, result is `correct`.
- matching rules: if strict match fails, current evaluator may still compute `close` or `wrong`, but its label must be capped so it cannot become `correct`.
- matching rules: `DiagnosisKeyword` and search-only aliases are excluded from acceptance.

## 4.2 Integration Point
- file: [session.service.ts](</c:/Users/user/DxLab/doctordle-backend/src/modules/gameplay/session.service.ts:369>).
- function: `submitDailyGuess()`.
- file: [evaluator-api.service.ts](</c:/Users/user/DxLab/doctordle-backend/src/modules/diagnostics/services/evaluator-api.service.ts:6>).
- function: replace `evaluateGuess(guess, answer)` with a registry-aware call signature using `diagnosisId`, raw guess, and answer name for backward compatibility.
- file: new service under `doctordle-backend/src/modules/diagnostics/services/strict-diagnosis-matcher.service.ts`.
- function: `match({ diagnosisId, rawGuess })`.

## 4.3 Behavior Change
- before: gameplay passes raw text and the backend can return `correct` from weighted exact/synonym/fuzzy/embedding/ontology score against `diagnosis.name`.
- after: gameplay still passes raw text in hybrid mode, but `correct` is only returned by strict registry match against canonical/accepted aliases for the case diagnosis.
- before: DB `Synonym` is not part of direct acceptance.
- after: accepted alias rows are the direct acceptance source.
- before: explanation terms never help suggestions.
- after: explanation terms may help autocomplete only through `DiagnosisKeyword`, never acceptance.

## 4.4 Fallback Strategy
- flag: `STRICT_DIAGNOSIS_MATCHING`.
- behavior: `false` keeps current evaluator behavior for emergency rollback.
- behavior: `true` enables strict acceptance and caps legacy evaluator output to `close`/`wrong` when no strict match exists.
- behavior: retain the current evaluator service stack for similarity/feedback until autocomplete rollout is complete.

## 4.5 Safety
- risk: legitimate previously accepted guesses may turn from `correct` to `close`/`wrong`.
- mitigation: migrate hardcoded synonyms and DB synonyms first, run historical replay checks, and launch behind a flag.
- risk: alias ambiguity across diagnoses.
- mitigation: enforce unique active normalized alias ownership and reject ambiguous backfill rows.
- risk: gameplay scoring expectations tied to legacy `semanticScore`.
- mitigation: continue returning secondary evaluator feedback separately while decoupling it from acceptance.

---

# PHASE 5 — ANALYTICS

## 5.1 New Data Captured
- field: `submittedDiagnosisId`.
- purpose: identify which diagnosis the client selected during hybrid/selection-first submit.
- field: `submittedAliasId`.
- purpose: track which accepted alias or suggestion path was used.
- field: `acceptanceMode`.
- purpose: distinguish `strict_canonical`, `strict_alias`, `selection_exact`, `legacy_similarity_capped`.
- field: `selectionSource`.
- purpose: separate `typed`, `autocomplete_click`, `autocomplete_keyboard`, `selection_only`.
- field: `normalizedGuess`.
- purpose: aggregate unmatched answers without casing/punctuation fragmentation.
- field: `DiagnosisRejectedGuess.count`.
- purpose: rank editorial alias candidates and UX misses.

## 5.2 Changes
- analytics service: update [analytics.service.ts](</c:/Users/user/DxLab/doctordle-backend/src/modules/analytics/analytics.service.ts:23>) to group top wrong guesses by `normalizedGuess`, expose unmatched aggregates, and expose alias/selection usage.
- storage: keep `Attempt` as attempt-of-record; add `DiagnosisRejectedGuess` for aggregation and `DiagnosisSelectionEvent` for richer telemetry.
- storage: retain `Attempt.guess` raw string for auditability and UX replay.

## 5.3 Usage
- editorial: use normalized top rejections and rejected-guess counts to approve new aliases or search-only terms.
- system: use search-only frequent misses to improve autocomplete ranking without broadening acceptance.
- editorial: inspect explanation-derived keyword hits separately from accepted aliases.
- system: measure migration progress by percentage of submissions using `submittedDiagnosisId`.

---

# PHASE 6 — AUTOCOMPLETE API

## 6.1 Endpoint
- method: `GET`.
- path: `/game/diagnoses/autocomplete?q=<query>&limit=<n>`.

## 6.2 Query Logic
- search fields: `Diagnosis.displayLabel`, `Diagnosis.name`, active `DiagnosisAlias` rows, active `DiagnosisKeyword` rows.
- ranking: exact normalized prefix match first, accepted alias prefix second, display label prefix third, token overlap next, keyword weight last.
- ranking: if multiple rows point to the same diagnosis, collapse to one diagnosis suggestion.
- ranking: search-only terms and keywords can rank a diagnosis, but the returned item is always the canonical diagnosis entity.
- ranking: never return diagnoses outside the registry root; do not query arbitrary explanation text at request time.

## 6.3 Response Shape
- field: `diagnosisId`.
- type: `string`.
- field: `label`.
- type: `string`.
- field: `matchedTerm`.
- type: `string`.
- field: `matchKind`.
- type: `'canonical' | 'accepted_alias' | 'search_only' | 'keyword'`.
- field: `aliasId`.
- type: `string | null`.
- field: `acceptedForMatch`.
- type: `boolean`.
- field: `system`.
- type: `string | null`.

## 6.4 Safety
- why invalid suggestions cannot pass: endpoint returns canonical diagnosis records only, not free-form terms.
- why invalid suggestions cannot pass: backend acceptance still checks only canonical name or accepted alias for the case diagnosis.
- why invalid suggestions cannot pass: `search_only` and `keyword` suggestions can help discovery, but they are never marked accepted unless the selected diagnosis also matches the case diagnosis.

---

# PHASE 7 — FRONTEND

## 7.1 State Ownership
- React: query string, fetched suggestions, highlighted suggestion id/index, selected diagnosis id, selected alias id, submission payload.
- Phaser: diagnosis bar rendering, keyboard rendering, suggestion list rendering, pointer selection, keyboard navigation, visual focus, submit affordance.

## 7.2 Changes
- file: [useGameEngine.ts](</c:/Users/user/DxLab/doctordle-game/src/features/game/useGameEngine.ts:66>).
- change: add `query`, `suggestions`, `selectedDiagnosisId`, `selectedAliasId`, autocomplete request lifecycle, and hybrid submit payload assembly.
- file: [game.api.ts](</c:/Users/user/DxLab/doctordle-game/src/features/game/game.api.ts:25>).
- change: add `fetchDiagnosisAutocompleteApi()` and extend `submitGuessApi()` payload.
- file: [game.types.ts](</c:/Users/user/DxLab/doctordle-game/src/features/game/game.types.ts:1>).
- change: add suggestion and submission-selection types.
- file: [round.types.ts](</c:/Users/user/DxLab/doctordle-game/src/features/game/round.types.ts:30>).
- change: extend `RoundViewModel` with query/suggestion/selection state for Phaser.
- file: [buildRoundViewModel.ts](</c:/Users/user/DxLab/doctordle-game/src/features/game/buildRoundViewModel.ts:125>).
- change: build the explicit React → Phaser suggestion contract.
- file: [gameSessionBridge.ts](</c:/Users/user/DxLab/doctordle-game/src/features/game/phaser/gameSessionBridge.ts:6>).
- change: add typed intents like `onMoveSuggestion`, `onSelectSuggestion`, `onSpace`, `onClearSelection`.
- file: [GamePlaySection.tsx](</c:/Users/user/DxLab/doctordle-game/src/features/game/GamePlaySection.tsx:36>).
- change: map Phaser intents to React-owned query and selection state updates.
- file: [CaseScene.ts](</c:/Users/user/DxLab/doctordle-game/src/features/game/phaser/case-scene/CaseScene.ts:187>).
- change: render an autocomplete panel and selection state in Phaser; keep it visual-only.
- file: [roundLayers.ts](</c:/Users/user/DxLab/doctordle-game/src/features/game/phaser/roundLayers.ts:3>).
- change: add a `SuggestionPanelLayer` if the panel grows beyond the diagnosis bar safely.

## 7.3 UX Flow
1. Phaser keyboard and hardware keys update the query via typed intents; React updates canonical query state and requests suggestions.
2. React receives suggestions, stores canonical selection state, and pushes a typed suggestion list into `RoundViewModel`; Phaser renders and navigates it.
3. Submit uses `selectedDiagnosisId` first when present, includes raw query for analytics, and only allows selection-only mode once rollout reaches phase 8.

## 7.4 Safety
- risk: duplicate state between React and Phaser.
- mitigation: keep all canonical query/selection state in React and pass it down through `RoundViewModel` only.
- risk: DOM autocomplete accidentally competes with Phaser input.
- mitigation: do not introduce a visible DOM text field; keep Phaser as the only live round input surface.
- risk: suggestion rendering bloats the existing scene.
- mitigation: add a dedicated scene layer module instead of mixing search UI into unrelated layers.

---

# PHASE 8 — SUBMISSION MODEL

## 8.1 Final Payload
- fields: `sessionId`.
- fields: `guess`.
- fields: `diagnosisId?`.
- fields: `aliasId?`.
- fields: `selectionSource?`.

## 8.2 Behavior
- hybrid: submit raw `guess` plus optional `diagnosisId`/`aliasId`; backend accepts only strict canonical/accepted alias matches and logs all raw input.
- selection-first: UI requires a selected diagnosis for normal submit, but still sends `guess` for analytics and audit.
- backend behavior: if `diagnosisId` is supplied and equals the case diagnosis, return `correct`; if not, treat as invalid or wrong based on rollout mode, never fuzzy-correct it.
- backend behavior: if only raw `guess` is supplied, use strict canonical/accepted alias match only.

## 8.3 Rollout
- step 1: hybrid mode with autocomplete suggestions, optional selection, strict acceptance on backend, and analytics on unmatched guesses.
- step 2: selection-first mode behind a frontend flag once suggestion quality and alias coverage are validated.
- step 3: optional selection-only mode for supported clients after editorial alias coverage stabilizes.

---

# TEST PLAN

## Acceptance
- test: canonical diagnosis exact match after normalization.
- expected: `correct`.
- test: accepted alias match from `DiagnosisAlias`.
- expected: `correct`.
- test: abbreviation alias match from `DiagnosisAlias`.
- expected: `correct`.
- test: punctuation variation of canonical name.
- expected: `correct`.
- test: spacing variation of canonical name.
- expected: `correct`.
- test: descriptive phrase present only in `DiagnosisKeyword`.
- expected: not `correct`.
- test: related diagnosis with high ontology similarity.
- expected: never `correct` unless strict alias/canonical match exists.

## Safety
- test: two diagnoses cannot own the same active normalized alias.
- expected: migration or validation fails.
- test: explanation-derived keyword appears in autocomplete.
- expected: suggestion may appear, acceptance still fails unless selected diagnosis matches case diagnosis.
- test: legacy evaluator returns high score for non-matching diagnosis under strict flag.
- expected: final result capped at `close` or `wrong`, not `correct`.
- test: rollback flag off.
- expected: current evaluator behavior remains available for emergency revert.

## Autocomplete
- test: prefix query matches canonical diagnosis.
- expected: diagnosis returned first.
- test: query matches accepted alias.
- expected: canonical diagnosis returned with `matchKind='accepted_alias'`.
- test: query matches search-only term or keyword.
- expected: canonical diagnosis returned, `acceptedForMatch=false`.
- test: invalid arbitrary query.
- expected: empty result set or no selectable invalid term.
- test: mobile keyboard navigation in Phaser.
- expected: React selection state updates through typed intents only.

## Analytics
- test: wrong guesses aggregate by `normalizedGuess`.
- expected: casing and punctuation variants collapse into one bucket.
- test: selection submission logs `diagnosisId` and `aliasId`.
- expected: telemetry row written with `selectionSource`.
- test: unmatched free-text submit.
- expected: `DiagnosisRejectedGuess` count increments.
- test: accepted alias submit.
- expected: `Attempt.acceptanceMode='strict_alias'`.

---

# FINAL SUMMARY

## What Changed
- point 1: the safe implementation path is to turn the existing `Diagnosis` model into the registry root, then add alias/search/analytics tables around it instead of rewriting case relations.
- point 2: acceptance moves from additive fuzzy scoring to deterministic canonical-or-accepted-alias matching, while keeping retrieval/autocomplete/analytics separate.
- point 3: frontend integration can stay inside the current React → `RoundViewModel` → Phaser contract by keeping React as canonical query/selection owner and Phaser as the live input/rendering surface.

## Why This Is Safe
- reason 1: it preserves existing `Case.diagnosisId` and `CaseRevision.diagnosisId` ownership, so the gameplay/editorial core data model does not need a destructive rewrite.
- reason 2: it introduces strict matching behind a feature flag and keeps the current evaluator stack as a capped secondary signal and rollback path.
- reason 3: it respects the existing React/Phaser boundary in [useGameEngine.ts](</c:/Users/user/DxLab/doctordle-game/src/features/game/useGameEngine.ts:66>), [buildRoundViewModel.ts](</c:/Users/user/DxLab/doctordle-game/src/features/game/buildRoundViewModel.ts:125>), and [CaseScene.ts](</c:/Users/user/DxLab/doctordle-game/src/features/game/phaser/case-scene/CaseScene.ts:187>).

## Remaining Risks
- risk: historical “correct” answers produced by fuzzy/ontology weighting may be downgraded after strict mode.
- mitigation: backfill aliases first, run replay tests on historical guesses, and launch behind `STRICT_DIAGNOSIS_MATCHING`.
- risk: autocomplete quality may lag before enough search-only terms and keywords are curated.
- mitigation: keep hybrid submission mode first and use normalized rejected-guess analytics to drive editorial alias/search expansion.
- risk: duplicate synonym sources (`Synonym`, hardcoded map, new aliases) can drift during transition.
- mitigation: migrate hardcoded aliases into DB in phase 3 and make `DiagnosisAlias` the only acceptance source once strict mode is enabled.