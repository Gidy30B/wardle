# Wardle Case Generation Quality Upgrade Plan

## Purpose

Move case generation from generic AI case creation to a clinically safe, diagnosis-registry-aware, differential-driven pipeline.

The product now depends heavily on case quality. The goal is to make generated cases:

- clinically accurate
- internally consistent
- progressively solvable
- difficult for the right reasons
- safe for human editorial review
- compatible with the diagnosis registry and gameplay loop

This plan is based on the uploaded `CaseGeneratorService` shape, which currently uses:

- OpenAI structured output via Zod
- `generatedCaseSchema`
- `generateCase()`
- `validateCase()`
- `normalizeCase()`
- `saveCase()`
- `CaseValidationOrchestrator`
- `DiagnosisRegistryLinkService`

---

# Current Observed Weaknesses

## 1. Schema is too shallow

Current generated case shape appears to include:

```ts
{
  clues: ClinicalClue[]
  answer: string
  differentials: string[]
  explanation: {
    diagnosis: string
    summary: string
    reasoning: string[]
    keyFindings: string[]
  }
}
```

This is good as a starting point, but it does not force the model to prove:

- why each clue exists
- which differentials each clue eliminates
- whether clues are redundant
- expected solve point
- danger of ambiguity
- clinical consistency
- lab realism
- difficulty level

## 2. Validation checks structure more than clinical quality

Current `validateCase()` checks things like:

- schema validity
- minimum clue count
- non-empty values
- duplicate clue text
- answer exists
- explanation exists

That prevents broken payloads, but not weak clinical cases.

## 3. Clue progression is not strongly enforced

A great Wardle case needs a clue ladder:

| Clue | Purpose |
|---|---|
| 1 | broad but relevant |
| 2 | adds direction |
| 3 | introduces key discriminator |
| 4 | narrows strongly |
| 5 | near diagnostic |
| 6 | confirmatory |

Current schema does not require this.

## 4. Differentials are not used as generation constraints

Differentials should not be decoration. They should actively shape the case.

Each clue should answer:

```txt
Which differential does this make less likely?
Which differential remains plausible?
Why does this clue move the player closer to the answer?
```

## 5. No explicit quality score

Generated cases should receive machine-readable review metadata before reaching human editors.

Example:

```ts
quality: {
  clinicalAccuracyScore: number
  clueProgressionScore: number
  differentialQualityScore: number
  ambiguityScore: number
  estimatedSolveClue: number
  publishRisk: 'low' | 'medium' | 'high'
}
```

---

# Target Architecture

Replace simple generation with a staged pipeline:

```txt
Input request
  ↓
Diagnosis selection / constraints
  ↓
Differential set generation
  ↓
Progressive clue ladder generation
  ↓
Structured explanation generation
  ↓
Self-critique validation
  ↓
Clinical consistency validation
  ↓
Difficulty scoring
  ↓
Registry linking
  ↓
Save as draft
  ↓
Human editorial review
```

---

# Phase 1 — Strengthen the Generated Case Schema

Update the structured output schema to support clinical quality metadata.

## Add clue-level reasoning

Each clue should include:

```ts
const clinicalClueSchema = z.object({
  type: clueTypeSchema,
  value: z.string(),
  order: z.number().int(),
  purpose: z.enum([
    'broad_context',
    'directional',
    'discriminator',
    'strong_narrowing',
    'near_diagnostic',
    'confirmatory',
  ]),
  newInformation: z.string(),
  supportsDiagnosisBecause: z.string(),
  differentiatesFrom: z.array(z.string()),
  estimatedDiagnosticWeight: z.enum(['low', 'medium', 'high']),
})
```

## Add differential metadata

```ts
const differentialSchema = z.object({
  diagnosis: z.string(),
  whyPlausibleEarly: z.string(),
  keyFeatureAgainst: z.string(),
})
```

## Add quality metadata

```ts
const generatedCaseQualitySchema = z.object({
  estimatedDifficulty: z.enum(['easy', 'medium', 'hard']),
  estimatedSolveClue: z.number().int().min(1).max(6),
  ambiguityScore: z.number().min(0).max(1),
  clinicalAccuracyRisk: z.enum(['low', 'medium', 'high']),
  clueProgressionScore: z.number().min(0).max(1),
  differentialQualityScore: z.number().min(0).max(1),
  redFlags: z.array(z.string()),
})
```

## Target generated case schema

```ts
const generatedCaseSchema = z.object({
  clues: z.array(clinicalClueSchema).length(6),
  answer: z.string(),
  differentials: z.array(differentialSchema).min(3).max(5),
  explanation: z.object({
    diagnosis: z.string(),
    summary: z.string(),
    reasoning: z.array(z.string()),
    keyFindings: z.array(z.string()),
    whyNotDifferentials: z.array(
      z.object({
        diagnosis: z.string(),
        reason: z.string(),
      }),
    ),
  }),
  quality: generatedCaseQualitySchema,
})
```

Migration note:

If existing database fields cannot store these directly yet, preserve the current persisted shape and store expanded metadata inside existing structured explanation JSON where appropriate.

---

# Phase 2 — Replace the Prompt With a Differential-First Prompt

Current system prompt is too generic:

```txt
You generate clinically accurate USMLE-style training cases and must return valid JSON only.
```

Replace with a stricter system prompt:

```txt
You are a senior clinician and medical education case writer creating diagnostic reasoning cases for a Wordle-like medical game.

Your task is not to create trivia. Your task is to create clinically accurate, progressively revealed cases where each clue adds new diagnostic information.

You must reason using plausible differentials first, then build a clue ladder that gradually separates the correct diagnosis from those differentials.

The case must be realistic, internally consistent, and appropriate for clinical education.

Return valid JSON only matching the provided schema.
```

## User prompt template

```md
Generate one Wardle diagnostic reasoning case.

## Constraints

- Exactly 6 clues.
- One correct diagnosis.
- 3–5 plausible differentials.
- The diagnosis should not be obvious from clue 1 alone.
- The case should usually become solvable around clue 4 or 5.
- Clue 6 should be strongly confirmatory.
- No duplicate clues.
- No clue should merely restate a previous clue.
- Labs and imaging must be physiologically realistic.
- If uncertain about a lab value, omit the exact value or use a broad clinically realistic description.
- Avoid rare zebras unless explicitly requested.
- Avoid unsafe or misleading clinical claims.

## Clue Ladder

Clue 1: broad context
Clue 2: directional symptom or risk factor
Clue 3: key discriminator begins
Clue 4: strong narrowing feature
Clue 5: near-diagnostic feature
Clue 6: confirmatory test/finding

## Differential Rules

For each differential:
- explain why it is plausible early
- explain what later clue argues against it

## Difficulty

Target difficulty: {{difficulty}}
Track: {{track}}
Specialty: {{specialty}}
Avoid recently used answers: {{recentAnswers}}

## Output

Return only valid JSON matching the schema.
```

---

# Phase 3 — Add Quality Gates in `validateCase()`

Extend `validateCase()` beyond schema checks.

## Required checks

### 1. Exactly 6 clues

Current code allows at least 3. Change to exactly 6 for gameplay consistency.

```ts
if (generatedCase.clues.length !== 6) {
  throw new BadRequestException('Generated case must include exactly 6 clues')
}
```

### 2. Sequential clue order

Require orders 1–6 exactly.

```ts
const orders = generatedCase.clues.map((clue) => clue.order).sort()
const expected = [1, 2, 3, 4, 5, 6]
```

### 3. Required clue types

Recommended minimum:

- at least 1 history
- at least 1 symptom or exam
- at least 1 lab/imaging/exam discriminator

Do not require imaging for all cases.

### 4. Differential count

Require 3–5 differentials.

### 5. Answer not duplicated in clue 1

Reject cases where clue 1 directly names or nearly names the answer.

Example checks:

```ts
if (clueOne.value.toLowerCase().includes(answer.toLowerCase())) reject
```

### 6. Explanation diagnosis matches answer

Normalize both and compare.

### 7. Quality thresholds

Reject or flag if:

```txt
clinicalAccuracyRisk = high
clueProgressionScore < 0.7
differentialQualityScore < 0.7
estimatedSolveClue < 3
```

---

# Phase 4 — Add a Second LLM Validation Pass

Generation alone is not enough.

Add a second method:

```ts
async critiqueGeneratedCase(generatedCase: GeneratedCase): Promise<CaseGenerationCritique>
```

The critique should assess:

- Is the diagnosis correct?
- Are clues clinically consistent?
- Are any findings contradictory?
- Are labs plausible?
- Is the diagnosis too obvious too early?
- Are differentials plausible?
- Is there a safer or more precise final answer?

## Critique schema

```ts
const caseGenerationCritiqueSchema = z.object({
  accept: z.boolean(),
  clinicalAccuracyScore: z.number().min(0).max(1),
  clueProgressionScore: z.number().min(0).max(1),
  differentialQualityScore: z.number().min(0).max(1),
  ambiguityScore: z.number().min(0).max(1),
  estimatedSolveClue: z.number().int().min(1).max(6),
  issues: z.array(
    z.object({
      severity: z.enum(['minor', 'major', 'critical']),
      message: z.string(),
      affectedClueOrder: z.number().int().min(1).max(6).nullable(),
    }),
  ),
  recommendedFixes: z.array(z.string()),
})
```

## Acceptance rule

Auto-save only if:

```txt
accept = true
clinicalAccuracyScore >= 0.85
clueProgressionScore >= 0.75
no critical issues
```

Otherwise save as draft with validation failure metadata or reject before save depending on existing editorial workflow.

---

# Phase 5 — Add Deterministic Heuristic Validators

Do not rely only on the LLM.

Add deterministic checks for:

## Duplicate / near-duplicate clues

Normalize each clue:

- lowercase
- remove punctuation
- remove common stopwords
- compare token overlap

Flag if overlap is too high.

## Clue answer leakage

Reject if early clues include:

- exact answer
- accepted alias
- abbreviation alias

Use `DiagnosisRegistryLinkService` or registry alias data if available.

## Weak differentials

Reject if differentials include:

- same as answer
- duplicates
- empty strings
- overly broad categories like “infection”, “cancer”, “pain”

## Unrealistic structure

Flag if:

- all clues are symptoms
- no objective clue by clue 5 or 6
- final clue is vague
- first clue is confirmatory

---

# Phase 6 — Integrate Diagnosis Registry Earlier

Current `saveCase()` links after generation. Improve quality by using registry before generation.

## Preferred flow

1. Select or receive target diagnosis.
2. Resolve diagnosis against registry.
3. Provide canonical diagnosis and aliases to the generator.
4. Tell generator not to reveal exact aliases in early clues.
5. Save with registry mapping fields.

## Prompt addition

```md
Correct diagnosis canonical name: {{canonicalDiagnosis}}
Known aliases: {{aliases}}

Do not include the canonical diagnosis or aliases in clue 1–5.
Only the explanation may name the diagnosis directly.
```

---

# Phase 7 — Add Case Difficulty and Gameplay Metadata

Store or expose metadata useful for publishing and balancing.

Recommended metadata:

```ts
{
  estimatedDifficulty: 'easy' | 'medium' | 'hard'
  estimatedSolveClue: number
  specialty: string | null
  ageBand: string | null
  acuity: 'low' | 'medium' | 'high'
  hasLabs: boolean
  hasImaging: boolean
  differentialCount: number
  qualityScore: number
}
```

This lets you balance daily cases:

- avoid too many rare diseases
- avoid consecutive same specialties
- avoid too many easy cases
- tune premium tracks

---

# Phase 8 — Improve Batch Generation

For batch generation, prevent answer duplication and specialty clustering.

## Add batch constraints

- avoid duplicate answers
- avoid same specialty more than N times per batch
- mix difficulties
- reject low-quality cases immediately
- retry generation with critique feedback

## Retry strategy

```txt
Generate case
  ↓
Validate schema
  ↓
Run deterministic validation
  ↓
Run LLM critique
  ↓
If fail and retries remain, regenerate with critique feedback
  ↓
Save only if accepted
```

Max retries: 2–3 per case.

---

# Phase 9 — Human Editorial Review Improvements

The admin/editorial UI should show quality evidence, not just final case text.

Show:

- estimated difficulty
- expected solve clue
- differentials
- clue-by-clue purpose
- validator issues
- clinical risk score
- why each differential was rejected

This helps human reviewers work faster and catch mistakes.

---

# Phase 10 — Implementation Order for Codex

## Step 1

Refactor schemas only. Do not change DB yet unless required.

## Step 2

Update prompt construction in `buildPrompt()`.

## Step 3

Expand `validateCase()` deterministic checks.

## Step 4

Add LLM critique method.

## Step 5

Integrate critique into `generateCase()` or batch generation flow behind an option flag:

```ts
validateWithCritique?: boolean
```

Default can be true for production generation and false for tests if needed.

## Step 6

Preserve save compatibility with existing database fields.

## Step 7

Add tests for:

- exactly 6 clues required
- duplicate clue rejection
- answer leakage rejection
- poor differential rejection
- critique rejection
- accepted case save path

---

# Codex Implementation Prompt

Use this prompt for the actual implementation.

```md
# Codex Prompt — Upgrade Case Generation Quality Pipeline

You are working in the Wardle/DxLab backend.

Improve the clinical quality of generated cases in `CaseGeneratorService` without breaking the existing editorial save flow.

## Goals

Upgrade generation from simple JSON case generation to a differential-first, clue-ladder-based, validation-driven pipeline.

The product depends on clinically accurate cases, so prioritize:

- clinical consistency
- progressive clue reveal
- plausible differentials
- no answer leakage
- no duplicate clues
- difficulty estimation
- human-editor-friendly metadata

## Starting file

Begin with:

```txt
doctordle-backend/src/modules/case-generator/case-generator.service.ts
```

Also inspect:

```txt
doctordle-backend/src/modules/case-generator/case-generator.types.ts
doctordle-backend/src/modules/case-validation/**
doctordle-backend/src/modules/diagnosis-registry/**
doctordle-backend/prisma/schema.prisma
```

## Hard constraints

- Do not break existing generated case save behavior.
- Do not remove `CaseValidationOrchestrator` integration.
- Do not remove diagnosis registry linking.
- Do not require DB migrations unless absolutely necessary.
- If extra metadata cannot be stored in dedicated columns, store it inside existing explanation/structured JSON fields.
- Do not publish generated cases directly.
- Generated cases must remain drafts/reviewable by humans.
- Do not change gameplay logic.
- Do not change leaderboard, timer, XP, or reward logic.

## Phase 1 — Expand Generated Case Schema

Add richer structured output fields:

- clue purpose
- clue new information
- why clue supports diagnosis
- which differentials it helps separate
- clue diagnostic weight
- differential metadata
- quality metadata
- why-not-differentials explanation

Keep compatibility with existing `GeneratedCase` type or update the type safely.

## Phase 2 — Improve Prompt

Replace generic prompt language with a strict differential-first medical education prompt.

The prompt must enforce:

- exactly 6 clues
- clue 1 broad but relevant
- clue 2 directional
- clue 3 discriminator begins
- clue 4 strong narrowing
- clue 5 near diagnostic
- clue 6 confirmatory
- 3–5 plausible differentials
- no duplicate clues
- no direct answer leakage in early clues
- realistic labs/imaging
- internally consistent timeline

## Phase 3 — Strengthen Deterministic Validation

Update `validateCase()` to reject:

- not exactly 6 clues
- non-sequential clue order
- duplicate or near-duplicate clues
- empty answer
- fewer than 3 differentials
- duplicate differentials
- answer appearing in clue 1–5
- explanation diagnosis not matching answer
- weak quality metadata where available

Label any inferred clinical checks carefully.

## Phase 4 — Add LLM Critique Pass

Add a method:

```ts
critiqueGeneratedCase(generatedCase: GeneratedCase): Promise<CaseGenerationCritique>
```

The critique should return:

- accept boolean
- clinical accuracy score
- clue progression score
- differential quality score
- ambiguity score
- estimated solve clue
- issues with severity
- recommended fixes

Use structured output with Zod.

Reject cases with:

- critical issues
- clinical accuracy score below 0.85
- clue progression score below 0.75

## Phase 5 — Batch Retry Logic

In batch generation, when a case fails deterministic or critique validation:

- retry up to 2 times
- include the critique feedback in the next prompt if practical
- do not save rejected cases unless existing editorial workflow expects failed drafts

## Phase 6 — Tests

Add/update tests for:

- exactly 6 clues required
- non-sequential orders rejected
- duplicate clues rejected
- answer leakage rejected
- duplicate differentials rejected
- critique rejection path
- accepted generation path
- save path remains compatible

## Verification

Run:

```bash
cd doctordle-backend
npm test -- case-generator --runInBand
npx tsc --noEmit
```

If scripts differ, inspect `package.json` and run closest equivalents.

## Final report

Return:

```md
# Case Generation Quality Upgrade Report

## Files Changed
## Schema Changes
## Prompt Changes
## Validation Changes
## Critique Pass
## Batch Retry Behavior
## Tests
## Verification
## Follow-ups
```
```

---

# Recommended Product Direction

Do not chase unlimited case generation first.

First build a smaller set of excellent cases:

```txt
100 excellent cases > 2,000 mediocre cases
```

Suggested quality target before scaling:

- 50 general medicine cases
- 25 emergency/acute cases
- 25 pediatrics/OBGYN/psych mixed cases
- all with human review
- all with expected solve clue
- all linked to registry
- all tested in gameplay

Once quality is reliable, scale generation by specialty tracks.
