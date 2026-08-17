# WEOS Pilot-Ready Technical Implementation Plan

**Proposed repository path:** `docs/weos/implementation/WEOS-PILOT-TECHNICAL-IMPLEMENTATION-PLAN.md`
**Document type:** Implementation Plan
**Status:** Draft for approval
**Version:** 0.1
**Date:** 6 August 2026
**Owner:** Wardle / DxLabs
**Implementation method:** Human-governed delivery using Codex as a bounded implementation agent

---

## 1. Purpose

This document defines the technical implementation programme required to move the Wardle Editorial Operating System (WEOS) from its current partially aligned implementation into a pilot-ready governed editorial platform.

The plan is designed for implementation with Codex. It divides the work into small, reviewable, testable packages that preserve WEOS authority, prevent invented semantics, and prioritise the trust-critical path required for institutional pilots.

The primary objective is to establish a complete governed vertical slice for learner-facing clinical cases:

```text
Diagnosis
→ Case Revision
→ Review Packet
→ Clinical and Educational Assessments
→ Approval Decision
→ Publication Readiness
→ Publication Decision
→ Published Case Version
→ Schedule
→ Learner Exposure
→ Preserved Governance History
```

This plan does not attempt to implement every future WEOS capability before pilot launch. It prioritises the minimum enterprise-grade guarantees required for safe institutional use.

---

## 2. Pilot-Ready Technical Outcome

The implementation is considered pilot-ready when Wardle can prove that:

1. every learner-facing case has a stable identity and an exact immutable revision;
2. every approval applies to a specific case revision;
3. every publication applies to an approved revision;
4. every scheduled case points to a published version rather than a mutable case record;
5. every learner attempt preserves the exact published version used;
6. editorial authority is explicit and scoped rather than inferred from technical access;
7. stale governed commands fail safely;
8. every material decision preserves actor, authority, rationale, artifact version, effect, and remaining obligations;
9. AI output remains candidate knowledge until accepted and applied through a controlled operation;
10. published content can be withdrawn or superseded without erasing history;
11. routine governance can be completed through the editorial workspace without database intervention;
12. conformance tests prove that runtime behaviour respects the approved WEOS architecture and Canon.

---

## 3. Implementation Principles

### 3.1 Codex is an implementation agent, not an editorial authority

Codex may inspect, draft code, refactor, write tests, and document implementation. It must not resolve open governance decisions or redefine the meaning of WEOS artifacts.

### 3.2 Implement one invariant per work package

Each Codex task should make one clearly defined statement true, with tests proving that result.

### 3.3 Add canonical structures before removing legacy structures

The implementation should initially add governance records, authority assignments, publication versions, and expected-version commands without immediately deleting compatibility fields.

### 3.4 Preserve uncertainty

Legacy data must not be assigned fabricated approvals, reviewers, rationales, publication decisions, or artifact versions.

### 3.5 Separate editorial concepts

The implementation must not collapse:

- validation;
- assessment;
- readiness;
- approval;
- publication;
- scheduling;
- learner exposure;
- withdrawal;
- supersession.

### 3.6 Governed actions are transactional

Authority checks, stale-version checks, governance records, lifecycle effects, and compatibility projections should commit atomically.

### 3.7 Learner exposure must be immutable

Once a learner-facing version is published and scheduled, changes to the editable case must not change the exposed content.

---

## 4. Delivery Estimate

### One engineer using Codex carefully

- Governance and immutable publication core: 10–12 weeks
- Editorial workspace and migration: 4–6 weeks
- Pilot hardening: 2–3 weeks
- Total technical stream: approximately 16–20 weeks

### Two engineers using Codex on separated streams

- Backend governance and publication stream
- Frontend workspace and conformance stream
- Total technical stream: approximately 11–15 weeks

Clinical review, pilot inventory development, partner onboarding, and research planning run in parallel and are not included in the technical estimate.

---

## 5. Branch and Pull Request Strategy

### Integration branch

```text
weos/pilot-ready-integration
```

### Work-package branches

```text
weos/00-head-audit
weos/01-authority-decisions
weos/02-characterization-tests
weos/03-governance-schema
weos/04-governance-core
weos/05-authority-engine
weos/06-expected-version
weos/07-case-revision-hardening
weos/08-governed-case-review
weos/09-publication-version
weos/10-gameplay-cutover
weos/11-governance-backfill
weos/12-readiness-engine
weos/13-workspace-api
weos/14-workspace-ui
weos/15-ai-controlled-application
weos/16-pilot-hardening
```

### Pull request rules

Each branch must:

- begin from the latest integration branch;
- implement one bounded conceptual change;
- include automated tests;
- avoid unrelated refactors or formatting changes;
- document persistence and migration implications;
- update the implementation mapping or divergence register;
- receive human review before merge;
- avoid committing automatically unless explicitly instructed.

---

## 6. Technical Dependency Sequence

```text
Current HEAD audit
        ↓
Approved architecture decisions
        ↓
Characterization tests
        ↓
Additive governance schema
        ↓
Governance record core
        ├───────────────┐
        ↓               ↓
Authority engine    Expected-version contract
        └───────┬───────┘
                ↓
Case revision hardening
                ↓
Governed case review
                ↓
Operation-specific readiness
                ↓
Revision-targeted publication
                ↓
Daily Case and gameplay cutover
                ↓
Migration and backfill
                ↓
Workspace API
                ↓
Workspace UI
                ↓
Controlled AI application
                ↓
Pilot hardening and conformance
```

The workspace frontend may begin against agreed mock contracts, but it must not establish independent lifecycle semantics.

---

# 7. Work Packages

## WEOS-TECH-001 — Current HEAD Audit

**Branch:** `weos/00-head-audit`
**Estimate:** 2–3 days
**Runtime changes:** None

### Objective

Reconcile the current repository with the existing WEOS implementation mapping before any runtime change.

### Required inspection

Review:

```text
docs/weos/AGENT-START-HERE.md
docs/weos/authority/STATUS-AND-PRECEDENCE.md
docs/weos/WEOS-IMP-001-current-to-canonical-mapping.md
docs/weos/WEOS-IMP-001-divergence-register.md
docs/weos/WEOS-IMP-005-phase-2-open-decisions.md
docs/weos/gaps/IMPLEMENTATION-GAPS.md
```

Inspect at minimum:

```text
doctordle-backend/prisma/schema.prisma
doctordle-backend/src/auth/roles.ts
doctordle-backend/src/auth/editorial.guard.ts
doctordle-backend/src/modules/admin/
doctordle-backend/src/modules/editorial/
doctordle-backend/src/modules/gameplay/daily-cases.service.ts
doctordle-backend/src/modules/education/
doctordle-backend/src/modules/diagnosis-graph/
analytics-dashboard/src/
```

### Tasks

Inventory every code path that can mutate:

- Case;
- CaseRevision;
- case approval fields;
- case publication fields;
- DailyCase;
- DiagnosisEducation;
- graph candidates and graph facts;
- teaching rules;
- reasoning paths;
- diagnosis operational permissions.

### Outputs

```text
docs/weos/implementation/CURRENT-HEAD-AUDIT.md
docs/weos/implementation/GOVERNED-MUTATION-INVENTORY.md
docs/weos/implementation/LEARNER-EXPOSURE-READ-PATH.md
```

### Acceptance criteria

- Every case approval and publication write path is identified.
- Every learner-facing case read path is identified.
- Direct Prisma writes are distinguished from service-level commands.
- Differences from the existing implementation mapping are recorded.
- No runtime or database changes are introduced.

---

## WEOS-TECH-002 — Governance Architecture Decisions

**Branch:** `weos/01-authority-decisions`
**Estimate:** 3–5 days
**Runtime changes:** None

### Objective

Close the decisions that must be authoritative before Codex may implement governance behaviour.

### Required ADRs

#### ADR-001 — Governance record architecture

Recommended decision:

> Use a generic governance-record envelope with record-type-specific validated payloads.

#### ADR-002 — Scoped editorial authority

Recommended decision:

> Runtime roles grant technical access to request operations. Scoped editorial authority determines whether the governed decision may be executed.

#### ADR-003 — Expected-version commands

Recommended decision:

> Every governed mutation includes the expected artifact version or revision and fails with a conflict when stale.

#### ADR-004 — Compatibility projections

Recommended decision:

> Legacy status and timestamp fields remain temporarily available but are written only as projections of canonical governed decisions.

#### ADR-005 — Revision-targeted publication

Recommended decision:

> Publication targets an exact approved revision. Scheduling and learner exposure target the resulting published version.

#### ADR-006 — Controlled AI application

Recommended decision:

> Accepting an AI draft and applying it are separate governed operations. Application creates a new artifact revision.

### Outputs

```text
docs/weos/adr/ADR-001-governance-record-envelope.md
docs/weos/adr/ADR-002-scoped-editorial-authority.md
docs/weos/adr/ADR-003-expected-version-commands.md
docs/weos/adr/ADR-004-compatibility-projections.md
docs/weos/adr/ADR-005-revision-targeted-publication.md
docs/weos/adr/ADR-006-controlled-ai-application.md
```

### Exit gate

No schema or runtime implementation begins until these ADRs are approved.

---

## WEOS-TECH-003 — Characterization Tests

**Branch:** `weos/02-characterization-tests`
**Estimate:** 4–6 days

### Objective

Capture current behaviour before modifying approval, publication, scheduling, gameplay, authority, and AI application paths.

### Required tests

- case revision creation;
- case approval;
- request changes;
- rejection;
- ready-to-publish and publication transitions;
- DailyCase assignment;
- gameplay case loading;
- editing after approval;
- editing after scheduling;
- role-guard behaviour;
- graph candidate approval;
- AI draft acceptance and application;
- Diagnosis Education approval and publication.

### Required negative characterization

Determine whether the current system permits:

- publication without an exact revision;
- scheduling a mutable case;
- material editing without a new revision;
- learner exposure changing after publication;
- publication based only on a broad technical role;
- stale writes overwriting newer changes.

### Acceptance criteria

- Existing behaviour is reproducibly captured.
- Critical paths have integration tests.
- Unsafe legacy behaviour is clearly marked as characterization behaviour.
- CI runs the tests consistently.

---

## WEOS-TECH-004 — Additive Governance Schema

**Branch:** `weos/03-governance-schema`
**Estimate:** 5–8 days

### Objective

Add canonical persistence without removing legacy compatibility fields.

### Required models

#### EditorialAuthorityAssignment

Minimum fields:

```text
id
userId
authorityType
scopeType
scopeId
status
grantedByUserId
grantRationale
validFrom
validUntil
revokedAt
revokedByUserId
createdAt
updatedAt
```

Initial authority types:

```text
CASE_CLINICAL_REVIEW
CASE_EDUCATIONAL_REVIEW
CASE_APPROVAL
PUBLICATION_AUTHORIZATION
PUBLICATION_WITHDRAWAL
AI_DRAFT_APPLICATION
EMERGENCY_WITHDRAWAL
```

#### GovernanceRecord

Minimum common envelope:

```text
id
recordType
artifactType
artifactId
artifactRevisionId
diagnosisRegistryId
governanceQuestion
actorUserId
actorRoleSnapshot
authorityAssignmentId
outcome
rationale
findings
sourceContext
effect
remainingObligations
previousRecordId
createdAt
decidedAt
effectiveAt
```

#### EditorialAssessment

Initial assessment families:

```text
CLINICAL
EDUCATIONAL
REASONING
VALIDATION
PUBLICATION
READINESS
```

#### ControlledApplicationRecord

Minimum fields:

```text
id
sourceDraftType
sourceDraftId
targetArtifactType
targetArtifactId
baseRevisionId
resultingRevisionId
acceptedByUserId
appliedByUserId
authorityAssignmentId
applicationRationale
applicationStatus
createdAt
appliedAt
```

#### PublicationDecision

Minimum fields:

```text
id
artifactType
artifactId
artifactRevisionId
decisionType
authorityAssignmentId
actorUserId
rationale
effectiveAt
createdAt
```

#### PublishedCaseVersion

Minimum fields:

```text
id
caseId
caseRevisionId
publicationDecisionId
contentHash
publishedSnapshot
status
publishedAt
withdrawnAt
supersededById
createdAt
```

### Migration rules

- additive migration only;
- no fabricated historical records;
- no destructive status conversion;
- canonical links may initially be nullable;
- include indexes for artifact, revision, actor, authority, record type, and decision time;
- prevent duplicate effective publication decisions.

### Acceptance criteria

- Migration works against empty and populated databases.
- Existing application behaviour continues.
- Existing cases remain playable before cutover.
- New structures support exact case revision targeting.

---

## WEOS-TECH-005 — Governance Record Core

**Branch:** `weos/04-governance-core`
**Estimate:** 4–6 days

### Components

```text
GovernanceRecordService
GovernanceRecordRepository
GovernanceRecordQueryService
GovernancePayloadValidator
GovernanceEffectProjector
```

### Responsibilities

- validate artifact and revision identity;
- validate record-type payloads;
- capture actor and authority snapshots;
- preserve rationale and source context;
- preserve effects and remaining obligations;
- link related and correcting records;
- prohibit silent mutation of completed governance records;
- expose artifact governance history.

### Initial read APIs

```text
GET /admin/governance/artifacts/:artifactType/:artifactId/history
GET /admin/governance/records/:recordId
```

### Acceptance criteria

- Records are version-specific.
- Completed records are immutable.
- Corrections preserve original records.
- Actor, authority, and rationale are enforced where required.
- Typed payload validation is tested.

---

## WEOS-TECH-006 — Scoped Authority Engine

**Branch:** `weos/05-authority-engine`
**Estimate:** 4–6 days

### Components

```text
EditorialAuthorityService
AuthorityAssignmentRepository
AuthorityPolicyEvaluator
RequireEditorialAuthorityGuard
```

### Authority inputs

```text
actor
requested action
artifact type
artifact ID
diagnosis ID
specialty
institution
risk level
current artifact state
```

### Initial scope types

```text
GLOBAL
DIAGNOSIS
SPECIALTY
```

### Rules

- route permission and editorial authority are independent requirements;
- author self-approval is blocked where they would be the sole approver;
- publication requires publication authority;
- withdrawal requires publication or emergency-withdrawal authority;
- revoked or expired assignments fail;
- authority used is persisted with the decision;
- admin status does not automatically establish clinical or publication authority.

### Acceptance criteria

- Unassigned editors are denied governed decisions.
- Authority is enforced within scope.
- Out-of-scope actions fail.
- Expired authority fails.
- Case approval and publication authority remain separate.

---

## WEOS-TECH-007 — Expected-Version Command Contract

**Branch:** `weos/06-expected-version`
**Estimate:** 3–5 days

### Objective

Create one shared optimistic-concurrency contract for governed mutations.

### Recommended command shape

```ts
type GovernedCommand<TPayload> = {
  action: CanonicalEditorialAction;
  artifactType: EditorialArtifactType;
  artifactId: string;
  expectedRevisionId?: string;
  expectedVersion?: number;
  idempotencyKey: string;
  rationale: string;
  payload: TPayload;
};
```

### Components

```text
GovernedCommandExecutor
ArtifactVersionResolver
GovernedTransactionRunner
IdempotencyRepository
```

### Required behaviour

- compare expected and current revision;
- reject stale commands with HTTP 409;
- include current revision in conflict response;
- enforce authority and transitions inside the transaction;
- persist decision and projection changes atomically;
- prevent duplicate execution through idempotency.

### Acceptance criteria

Two reviewers cannot silently act on different revisions through racing requests.

---

## WEOS-TECH-008 — Case Revision Hardening

**Branch:** `weos/07-case-revision-hardening`
**Estimate:** 6–8 days

### Invariant

> Material case content changes only by creating a new Case Revision.

### Required revision snapshot

- title;
- presentation;
- clues;
- clue order;
- explanation;
- differentials;
- diagnosis relationship;
- difficulty;
- educational purpose;
- learning-goal references;
- source and generation context.

### Additional fields

```text
contentHash
createdFromRevisionId
changeSummary
changeReason
materialChange
```

### Stable clue identity

Every clue should contain a revision-local stable key:

```json
{
  "key": "clue-history-001",
  "type": "history",
  "content": "...",
  "breakdown": "..."
}
```

### Required command

```text
CREATE_CASE_REVISION
```

### Revision effects

A new material revision must:

- invalidate current validation standing where applicable;
- preserve prior decisions against the prior revision;
- remove publication readiness for the new revision;
- preserve previous publication history;
- require renewed review and publication for the new revision.

### Acceptance criteria

- Material edits always create a new revision.
- Old approval remains attached only to the old revision.
- Content hash changes after material edits.
- Stable clue keys remain traceable.
- Previous learner attempts remain interpretable.

---

## WEOS-TECH-009 — Governed Case Review

**Branch:** `weos/08-governed-case-review`
**Estimate:** 7–10 days

### Commands

```text
REQUEST_CASE_REVIEW
BEGIN_CASE_REVIEW
SUBMIT_CLINICAL_ASSESSMENT
SUBMIT_EDUCATIONAL_ASSESSMENT
REQUEST_CASE_CHANGES
APPROVE_CASE_REVISION
REJECT_CASE_REVISION
DEFER_CASE_DECISION
```

### Review packet snapshot

Capture:

- case revision ID;
- content hash;
- diagnosis context;
- Editorial Brief version;
- Learning Goals;
- Teaching Rules;
- reasoning path version where relevant;
- validation results;
- active mimics;
- discriminators;
- case purpose;
- reviewer assignment;
- component hashes.

### Approval requirements

- exact current revision;
- required validation passed;
- satisfactory clinical assessment;
- satisfactory educational or reasoning assessment;
- no open blocker;
- required authority;
- required rationale;
- no sole author self-approval;
- non-stale review packet.

### Compatibility projections

After approval, legacy fields may temporarily project:

```text
Case.editorialStatus = APPROVED
Case.approvedAt = decision time
Case.approvedByUserId = actor
```

They must not remain independently writable sources of authority.

### Acceptance criteria

- Approval applies to an exact revision.
- Stale review context prevents approval.
- Request changes preserves findings and obligations.
- New revisions do not inherit approval.
- Governance history reconstructs the complete review.

---

## WEOS-TECH-010 — Operation-Specific Readiness Engine

**Branch:** `weos/12-readiness-engine`
**Estimate:** 5–7 days

### Readiness operations

```text
CASE_REVIEW_READINESS
CASE_APPROVAL_READINESS
CASE_PUBLICATION_READINESS
CASE_SCHEDULING_READINESS
CASE_WITHDRAWAL_READINESS
AI_APPLICATION_READINESS
```

### Result shape

```ts
type ReadinessResult = {
  operation: ReadinessOperation;
  ready: boolean;
  evaluatedRevisionId: string;
  blockers: ReadinessIssue[];
  warnings: ReadinessIssue[];
  dependencies: ReadinessDependency[];
  evaluatedAt: string;
  expiresAt?: string;
};
```

### Every issue must state

- failed requirement;
- why it matters;
- operation prevented;
- resolution action;
- related artifact.

### Rules

- readiness is computed rather than assigned;
- readiness is not approval;
- warnings remain distinct from blockers;
- results target exact revisions;
- stale validation becomes a blocker where required by policy.

### Initial endpoint

```text
GET /admin/editorial/cases/:caseId/revisions/:revisionId/readiness/:operation
```

---

## WEOS-TECH-011 — Revision-Targeted Publication

**Branch:** `weos/09-publication-version`
**Estimate:** 7–10 days

### Commands

```text
ASSESS_CASE_PUBLICATION
AUTHORIZE_CASE_PUBLICATION
WITHDRAW_CASE_PUBLICATION
SUPERSEDE_CASE_PUBLICATION
```

### Required flow

```text
Approved Case Revision
        ↓
Publication Readiness
        ↓
Publication Decision
        ↓
Published Case Version
```

### Publication requirements

- exact approved revision;
- approval remains applicable;
- publication readiness passes;
- valid publication authority;
- no unresolved blocker;
- idempotency;
- frozen snapshot and content hash;
- no conflicting active publication where policy prohibits it.

### Withdrawal requirements

Withdrawal must:

- create a withdrawal decision;
- stop future learner exposure;
- prevent new sessions from beginning;
- preserve historical attempts and schedules;
- permit a controlled replacement.

### Supersession requirements

```text
Old Published Case Version
        ↓ supersededBy
New Published Case Version
```

Previous publications must never be deleted to simulate replacement.

---

## WEOS-TECH-012 — Daily Case and Gameplay Cutover

**Branch:** `weos/10-gameplay-cutover`
**Estimate:** 5–8 days

### Database change

Add:

```text
DailyCase.publishedCaseVersionId
```

`caseId` may remain temporarily for compatibility during migration.

### Scheduler rules

The scheduler may select only:

- active published versions;
- non-withdrawn versions;
- non-superseded versions where applicable;
- playable diagnoses;
- valid scheduling windows;
- non-duplicate assignments.

### Gameplay read path

```text
DailyCase
  → PublishedCaseVersion
  → frozen published snapshot
```

Gameplay must not load learner-facing content from the mutable Case record.

### Learner attempt provenance

Persist at minimum:

```text
caseId
caseRevisionId
publishedCaseVersionId
```

### Feature flag

```text
WEOS_PUBLISHED_VERSION_READ_PATH
```

### Acceptance criteria

- Editing current case content does not change a scheduled publication.
- Withdrawn versions cannot begin new sessions.
- Completed attempts remain historically interpretable.
- Approved but unpublished revisions cannot be scheduled.
- Scheduler cannot select withdrawn publications.

---

## WEOS-TECH-013 — Governance Backfill and Historical Classification

**Branch:** `weos/11-governance-backfill`
**Estimate:** 7–10 days

### Classification states

```text
PROVEN_EXACT_REVISION
SAFELY_INFERABLE_REVISION
UNRESOLVED_REVISION
NOT_APPLICABLE
```

### Process

1. Generate a read-only report.
2. Compare mutable case content hashes with revision snapshots.
3. Identify matching revisions.
4. Backfill only proven or safely inferable relationships.
5. Preserve unresolved records explicitly.
6. Exclude unresolved cases from automated future scheduling.
7. Create a manual-review queue.

### Prohibited fabrication

Do not invent:

- reviewer decisions;
- rationales;
- authority assignments;
- publication dates;
- approval-to-revision relationships.

### Scripts

```text
scripts/weos/audit-case-revision-links.ts
scripts/weos/classify-publication-history.ts
scripts/weos/backfill-published-case-versions.ts
scripts/weos/verify-publication-backfill.ts
```

Each script should support:

```text
--dry-run
--case-id
--limit
--output
```

### Acceptance criteria

- Dry runs are deterministic.
- Scripts are rerunnable.
- Duplicate published versions are prevented.
- Unresolved history remains visible.
- Every pilot case has an exact version before release.

---

## WEOS-TECH-014 — Editorial Workspace API

**Branch:** `weos/13-workspace-api`
**Estimate:** 6–8 days

### Read models

```text
EditorialDashboardViewModel
EditorialQueueViewModel
CaseReviewPacketViewModel
PublicationPacketViewModel
GovernanceHistoryViewModel
```

### Queue categories

- revisions awaiting review;
- review in progress;
- revisions requiring changes;
- approval-ready revisions;
- approved revisions awaiting publication assessment;
- publication-ready revisions;
- scheduled versions;
- withdrawn versions requiring replacement;
- unresolved migration records.

### Server-derived actions

```ts
availableActions: Array<{
  action: CanonicalEditorialAction;
  allowed: boolean;
  reason?: string;
  requiredAuthority?: string;
  blockers?: ReadinessIssue[];
}>;
```

The frontend must not infer action safety from runtime role alone.

### Initial endpoints

```text
GET  /admin/editorial/queue
GET  /admin/editorial/cases/:caseId/revisions/:revisionId/review-packet
POST /admin/editorial/cases/:caseId/revisions/:revisionId/actions/request-review
POST /admin/editorial/cases/:caseId/revisions/:revisionId/actions/approve
POST /admin/editorial/cases/:caseId/revisions/:revisionId/actions/request-changes
POST /admin/editorial/cases/:caseId/revisions/:revisionId/actions/publish
POST /admin/editorial/publications/:publicationId/actions/withdraw
```

Controllers should remain thin and delegate to canonical command handlers.

---

## WEOS-TECH-015 — Editorial Workspace Frontend

**Branch:** `weos/14-workspace-ui`
**Estimate:** 8–12 days

### Pilot-critical surfaces

#### Editorial queue

Display:

- priority;
- diagnosis;
- artifact;
- exact revision;
- current task;
- assigned reviewer;
- blockers;
- age;
- available action.

#### Review packet

Display:

- case content;
- clue sequence;
- diagnosis context;
- Learning Goals;
- Teaching Rules;
- mimics and discriminators;
- validation findings;
- clinical assessment;
- educational assessment;
- governance history;
- decision panel.

#### Publication packet

Display:

- approved revision;
- comparison with current publication;
- readiness;
- blockers and warnings;
- publication rationale;
- scheduled exposure;
- authority used.

#### Governance history

Display:

- actor;
- authority;
- exact revision;
- decision;
- rationale;
- effect;
- remaining obligations;
- date.

### Required UI behaviour

- send the expected revision with every governed action;
- handle HTTP 409 stale-version responses;
- force refresh after conflicts;
- require rationale where policy requires it;
- never enable actions based only on user role;
- show blockers separately from warnings;
- display the exact revision under review;
- require confirmation for publication and withdrawal.

### Required Playwright tests

- approve an exact revision;
- reject a stale approval request;
- prevent sole author self-approval;
- prevent publication without authority;
- permit publication with valid authority;
- preserve published content after a new draft revision;
- remove future exposure after withdrawal;
- display governance history.

---

## WEOS-TECH-016 — Controlled AI Application

**Branch:** `weos/15-ai-controlled-application`
**Estimate:** 6–9 days

### Required lifecycle

```text
Generation
    ↓
Candidate Draft
    ↓
Validation
    ↓
Human Review
    ↓
Accepted / Rejected / Revision Requested
    ↓
Controlled Application
    ↓
New Case Revision
```

### Tasks

- inventory every AI apply path;
- remove or block direct mutation paths;
- preserve model and generator provenance;
- preserve source context;
- require exact base revision;
- require application authority;
- create a new revision;
- link the application to the resulting revision;
- validate the resulting revision;
- prevent inherited approval.

### Commands

```text
ACCEPT_AI_DRAFT
REJECT_AI_DRAFT
REQUEST_AI_DRAFT_CHANGES
APPLY_ACCEPTED_AI_DRAFT
```

### Acceptance criteria

- Accepted does not mean applied.
- Applied does not mean approved.
- Stale-base application fails.
- Resulting revision is traceable to the source AI draft.
- Model provenance remains reconstructable.

---

## WEOS-TECH-017 — Pilot Hardening and Conformance

**Branch:** `weos/16-pilot-hardening`
**Estimate:** 8–12 days

### Security

- enforce authority in domain services, not only controllers;
- review every administrative endpoint;
- prevent mass assignment;
- restrict emergency withdrawal;
- log denied governed actions;
- protect reviewer rationale and sensitive notes.

### Observability

Add metrics:

```text
governed_command_success_total
governed_command_conflict_total
governed_command_denied_total
publication_created_total
publication_withdrawn_total
projection_drift_total
unresolved_revision_link_total
review_cycle_duration
editorial_queue_age
```

### Conformance checks

Create a scheduled or manual conformance job verifying:

- compatibility statuses agree with canonical decisions;
- approval projections target the current approved revision;
- publication projections agree with active published versions;
- every scheduled case targets an active published version;
- withdrawn versions are not newly exposable;
- every applied AI draft has a resulting revision;
- every pilot attempt identifies its publication version.

### Recovery and operational rehearsal

- test database restoration;
- test migration rollback strategy;
- test feature-flag rollback;
- rehearse emergency withdrawal;
- rehearse replacement of a scheduled case;
- document incident escalation.

### Required release documents

```text
docs/weos/pilot/PILOT-TECHNICAL-READINESS.md
docs/weos/pilot/PILOT-CUTOVER-RUNBOOK.md
docs/weos/pilot/EMERGENCY-WITHDRAWAL-RUNBOOK.md
docs/weos/pilot/PUBLICATION-CONFORMANCE-REPORT.md
docs/weos/pilot/KNOWN-LIMITATIONS.md
```

### Final release blockers

The pilot release must fail when:

- any pilot case lacks an exact revision;
- any pilot publication lacks a publication decision;
- any scheduled case points only to mutable Case content;
- publication authority is inferred only from runtime role;
- any governed command can silently overwrite a newer revision;
- any pilot AI content was applied without a controlled application record;
- any pilot learner attempt cannot identify its published version.

---

# 8. Sprint Plan

## Sprint 1 — Authority and Safety Baseline

- WEOS-TECH-001 Current HEAD Audit
- WEOS-TECH-002 Governance ADRs
- begin WEOS-TECH-003 Characterization Tests

## Sprint 2 — Persistence Foundation

- complete characterization tests
- WEOS-TECH-004 Additive Governance Schema
- validate migrations

## Sprint 3 — Governance Execution

- WEOS-TECH-005 Governance Record Core
- WEOS-TECH-006 Scoped Authority Engine

## Sprint 4 — Concurrency and Revisions

- WEOS-TECH-007 Expected-Version Contract
- WEOS-TECH-008 Case Revision Hardening

## Sprint 5 — Review Governance

- WEOS-TECH-009 Governed Case Review
- review-packet snapshots
- clinical and educational assessments

## Sprint 6 — Readiness and Publication

- WEOS-TECH-010 Readiness Engine
- WEOS-TECH-011 Revision-Targeted Publication

## Sprint 7 — Learner Exposure

- WEOS-TECH-012 Daily Case and Gameplay Cutover
- attempt provenance
- feature-flag rollout

## Sprint 8 — Backfill and Workspace API

- WEOS-TECH-013 Historical Classification and Backfill
- WEOS-TECH-014 Workspace API

## Sprint 9 — Workspace Frontend

- WEOS-TECH-015 Workspace UI
- stale-conflict handling
- Playwright governance flows

## Sprint 10 — AI and Pilot Hardening

- WEOS-TECH-016 Controlled AI Application
- WEOS-TECH-017 Pilot Hardening and Conformance

---

# 9. Pilot Technical Readiness Gates

## Gate A — Authority and Documentation

- approved implementation ADRs exist;
- authoritative implementation baseline is named;
- open decisions affecting the pilot are closed;
- role and authority mapping is enforced;
- implementation divergences are recorded.

## Gate B — Version Integrity

- every pilot case has an exact revision;
- every review targets an exact revision;
- every approval targets an exact revision;
- every publication targets an approved revision;
- scheduling targets a published version;
- learner attempts preserve the version used.

## Gate C — Governance History

For every pilot case, the system can reconstruct:

- origin;
- AI contribution where applicable;
- revision reviewed;
- assessments performed;
- reviewer identity and authority;
- approval rationale;
- publication authority;
- exact learner-facing version.

## Gate D — Editorial Operations

- routine governance requires no database intervention;
- queues and assignments operate correctly;
- stale commands are rejected;
- permissions are enforced server-side;
- publication and withdrawal are rehearsed;
- support and escalation are documented.

## Gate E — Production Safety

- conformance checks pass;
- unresolved historical records are excluded from pilot scheduling;
- feature-flag rollback is tested;
- emergency withdrawal is tested;
- production observability is active;
- restore procedures are verified.

---

# 10. Deferred Capabilities

The following capabilities remain important but should not block the first institutional pilot:

- immutable Diagnosis Education publication;
- complete graph candidate-to-fact redesign;
- full evidence-source and claim-support governance;
- Teaching Rule revision architecture;
- Reasoning Path revision architecture;
- generic artifact publication beyond cases;
- multi-institution authority and tenancy;
- curriculum-governance workflows;
- automated evidence surveillance;
- advanced adaptive learning;
- full Editorial Intelligence prioritisation;
- broad knowledge APIs.

These should enter the Institutional WEOS v1 roadmap after the case trust path is stable.

---

# 11. Standard Codex Work-Package Prompt

```text
You are implementing one bounded WEOS work package in the Wardle repository.

Work package:
[ID and title]

Authority and context:
1. Read docs/weos/AGENT-START-HERE.md.
2. Read docs/weos/authority/STATUS-AND-PRECEDENCE.md.
3. Read the relevant approved ADRs and implementation specifications.
4. Treat draft, generated, review-required, and open-decision documents as non-authoritative unless an approved decision explicitly permits implementation.

Scope:
[Exact capability to implement]

Required invariant:
[One sentence stating what must become true]

Permitted files:
[List expected directories or files]

Prohibited changes:
- Do not change learner-facing behaviour outside this package.
- Do not resolve open governance decisions.
- Do not perform destructive migrations.
- Do not infer editorial authority from technical access.
- Do not collapse approval, readiness, publication, and exposure into one status.
- Do not fabricate historical governance records.
- Do not modify unrelated files.

Implementation requirements:
[Specific tasks]

Testing requirements:
[Unit, integration, and end-to-end tests]

Documentation requirements:
- Update the implementation mapping or divergence register.
- Record migration implications.
- Record any remaining gaps.
- Do not mark the capability aligned unless all required guarantees are proven.

Before editing:
1. Inspect the current implementation.
2. Summarise existing behaviour.
3. List the files you will change.
4. Identify any conflict with approved architecture.
5. Stop without implementation if a blocking decision remains unresolved.

After editing:
1. Run type checks.
2. Run relevant tests.
3. Run linting.
4. Show changed files.
5. Summarise behaviour before and after.
6. List remaining risks.
7. Do not commit.
```

---

# 12. Definition of Technical Completion

The pilot-ready implementation is complete when the following statement is true:

> Wardle can create, revise, validate, clinically and educationally review, approve, publish, schedule, expose, withdraw, supersede, and audit a clinical case through explicit human authority, exact immutable revisions, transactional governed commands, explainable readiness, preserved provenance, and learner-attempt version traceability.

Completion must be demonstrated through:

- passing unit tests;
- passing integration tests;
- passing Playwright governance flows;
- successful migration dry runs;
- zero unresolved pilot publication links;
- successful emergency-withdrawal rehearsal;
- a signed pilot technical readiness report;
- an approved known-limitations record.

---

## Closing Principle

The technical goal is not to add more editorial screens or more status fields.

It is to establish one authoritative trust path through which candidate clinical knowledge becomes an exact governed revision, receives explicit human decisions, becomes a frozen learner-facing publication, and remains explainable throughout its lifetime.

Codex should accelerate implementation of that path. It must never replace the authority that defines it.
