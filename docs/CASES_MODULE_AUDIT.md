# Cases Module Audit

Date: 2026-04-12

## 1. System Map

Case lives in Prisma, is surfaced through two backend read paths, and only reaches the live game through the gameplay API, not the /cases API.

DB -> API -> AI -> Queue -> Worker -> WS -> Frontend

- DB: schema.prisma (line 1)
   - Case stores history and symptoms[] as the current clue source of truth.
   - ExplanationContent stores one explanation per caseId.
   - DailyCase maps one date to one case.
- Case creation: cases.service.ts (line 1)
   - CreateCaseDto -> Prisma case.create/upsert -> optional assignDailyCase() -> scheduleCaseContent(caseId, { source: 'case_created' })
- Gameplay read path: session.service.ts (line 1)
   - startGame() gets today's case, derives clueIndex, then builds a visible case payload by slicing symptoms.
   - submitGuess() records attempts, computes next clue index, returns updated visible case, and asks AI for explanation only when gameOver.
- AI orchestration: ai-content.service.ts (line 1)
   - Hints are prewarmed on case creation.
   - Explanations are only enqueued/read when a specific user requests them.
- Queue/worker: queue.service.ts (line 1) -> ai.processor.ts (line 1)
   - queue: ai-content
   - job: explanation:generate
   - dedup key is now (caseId, userId)
- Realtime: game.gateway.ts (line 1)
   - Worker publishes Redis envelope.
   - Gateway subscribes and emits game.v1.explanation.ready to room user.id.
- Frontend: ws-client.ts (line 1) -> useGameSession.ts (line 1)
   - WS event becomes EXPLANATION_READY.
   - Hook updates result.explanation only if the case matches and gameOver is already true.

## 2. Current Data Contract

The system has more than one live case contract.

### DB Case

- id: String
- title: String
- date: DateTime
- difficulty: String
- history: String
- symptoms: String[]
- labs: Json?
- diagnosisId: String
- relations: diagnosis, dailyCases, hints, explanations, attempts, sessions

### Explanation Storage

- table: ExplanationContent
- fields: id, caseId @unique, content: String, version: String = "ai:v1", timestamps
- no per-user explanation row, no real versioned lookup, no history table

### Real Backend Response Shapes Today

```ts
// /cases/today and internal case reads
{
   id: string
   title: string
   date: string
   difficulty: 'easy' | 'medium' | 'hard'
   history: string
   symptoms: string[]
   diagnosis: string
}

// POST /game/start
{
   sessionId: string
   dailyCaseId: string
   clueIndex: number
   attemptsCount: number
   case: {
      id: string
      difficulty: string
      date: string
      history: string
      symptoms: string[] // sliced to visible clues only
   }
}

// POST /game/guess normal path
{
   result: 'correct' | 'close' | 'wrong'
   score: number
   attemptsCount: number
   semanticScore?: number
   clueIndex: number
   isTerminalCorrect: boolean
   case?: {
      id: string
      difficulty: string
      date: string
      history: string
      symptoms: string[] // sliced to visible clues only
   }
   gameOver?: boolean
   gameOverReason?: 'correct' | 'clues_exhausted' | null
   explanation?: null | { status: 'processing' } | { status: 'ready'; content: string }
   rewardStatus?: 'processing'
   feedback?: {
      signals?: Record<string, unknown>
      evaluatorVersion: string
      retrievalMode: string
   }
}
```

### Important Reality

- explanation is not embedded in /cases/today.
- gameplay case payload does not include title, diagnosis, or labs.
- frontend types allow structured explanations, but backend only returns a string today.

## 3. Explanation Flow

Where mock vs real originates:

- Explanation request starts in gameplay, not case creation.
- submitGuess() calls aiContentService.getExplanation(caseId, userId) only when gameOver.
- AIContentService.getExplanation()
   - If cached/DB explanation exists: returns { status: 'ready', content } immediately.
   - Else: enqueues explanation:generate and returns { status: 'processing' }.
- QueueService.enqueueExplanation()
   - queue: ai-content
   - payload: { caseId, userId }
   - job id: explanation_${caseId}_${userId}
- AiProcessor.processExplanationJob()
   - If DB row already exists: fetches with explanationService.getExplanation(caseId) and still publishes WS to that user.
   - Else: calls materializeExplanation(caseId), then publishes WS.
- ExplanationService.materializeExplanation()
   - checks Redis cache ai:explanation:${caseId}
   - checks ExplanationContent
   - if absent, calls generateExplanation(caseId)
   - current generateExplanation() returns Mock explanation for case ${caseId}
   - fallback text using history + symptoms + diagnosis only runs if generateExplanation() throws, which it currently does not
   - stores the final string in ExplanationContent and Redis cache
- WS delivery
   - Redis envelope: { type: 'game.v1.explanation.ready', userId, payload: { caseId, content } }
   - socket payload to browser: event game.v1.explanation.ready, data { caseId, content }
- Frontend consumption
   - RESULT_RECEIVED comes from API.
   - EXPLANATION_READY comes only from WS.
   - WS overwrites result.explanation only for the active case and only after gameOver.

## 4. Root Problems

1. There is no single canonical case contract.
    - CRUD case reads, gameplay case payloads, session state, and frontend types all differ.

2. Clues are implicit, not modeled.
    - The real clue system is history always visible plus symptoms.slice(0, clueIndex). There is no typed clues[] source of truth.

3. Explanation shape is inconsistent across layers.
    - Backend stores/emits a plain string, but the frontend explanation page is written for structured content like diagnosis, summary, and reasoning.

4. The AI explanation path is effectively mock-backed.
    - The primary generator returns a mock string, so the richer fallback path is mostly dormant and real model output is not part of the current explanation lifecycle.

5. Caching and delivery semantics are split.
    - Explanation content is cached per case, delivery is queued per (caseId, userId), and the table has a version field that is not used in reads or cache keys. That is workable, but it is easy to reuse stale content without noticing.

## 5. Migration Readiness Score

LOW

Why:

- adding clues: Json to Prisma is easy.
- making it the real source of truth is not.
- current gameplay, scoring, attempt auditing, explanation generation, and frontend rendering all still assume history + symptoms[].
- the explanation contract is already drifting, which raises refactor risk.

## 6. Blockers Before Refactor

1. Decide the canonical runtime case shape.
    - Today the app has at least three: admin case, gameplay case, and explanation page expectations.

2. Decide whether history and symptoms[] remain first-class fields or become derived compatibility fields from clues.

3. Define the explanation contract.
    - It needs to be either plain text everywhere or structured everywhere; it is currently both.

4. Replace implicit clue progression logic.
    - EvaluationService, attempt auditing, and XP logic all currently key off symptoms.length and clue index math.

5. Clarify explanation caching/versioning policy.
    - ExplanationContent.version exists, but the live pipeline ignores it and caches only by caseId.

6. Clarify pre-generation behavior.
    - Case creation currently schedules hints, but not explanations, because scheduleCaseContent() only enqueues explanations when userId is present.

The biggest takeaway is that the system already behaves like a clue engine, but the clues are encoded indirectly in history, symptoms[], and clueIndex math rather than a structured clues[] model.
