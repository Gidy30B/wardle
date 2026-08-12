# WEOS-OD-021: Document Authority and Supersession

## Document Control

- Decision ID: `WEOS-OD-021`
- Version: `0.1`
- Status: `Approved with conditions`
- Disposition: `APPROVED_WITH_CONDITIONS`
- Approval state: `APPROVED_WITH_CONDITIONS`
- Implementation authority: `GRANTED_FOR_STAGE_1_CONTRACTS_ONLY`
- Evidence baseline: `6f41136c21c9e854cbf231752d71939fab82bdac`
- Review date: `2026-07-29`

## Decision Question

What repository-visible process establishes authority, approval, protected-field change permission, conflict resolution and supersession across WEOS baseline, canonical metadata, generated specifications, reviewed drafts and runtime evidence?

## Why This Decision Is Blocking

Agents currently see baseline PDFs, generated implementation specifications, reviewed drafts, registers, runtime TypeScript metadata and service code. `docs/weos/authority/STATUS-AND-PRECEDENCE.md` says the catalogue records evidence and does not create a new approval hierarchy. Without explicit authority records, a newer file, a generated file or runtime code can be overread as superseding architecture.

## Scope

Document identity, version, approval evidence, supersession, conflict resolution, protected-field exception handling and agent-readable authority status for WEOS documents and metadata.

## Out of Scope

This decision does not approve any existing document, alter Phase 1 protected fields, regenerate generated specifications, change runtime behavior, define institutional approvers outside repository-visible evidence, or close any open decision.

## Current Repository Evidence

- `docs/weos/authority/STATUS-AND-PRECEDENCE.md` classifies baseline, generated, review and draft documents but does not create an approval hierarchy.
- `docs/weos/AGENT-START-HERE.md` warns that document existence does not imply formal approval.
- `docs/weos/phase-2-review/REVIEW-MANIFEST.md` records Phase 2 `REVIEW_REQUIRED` and `Phase 3 status: NOT STARTED`.
- `doctordle-backend/src/modules/editorial-governance/canonical-artifact-catalogue.ts` and its protected-field fixture preserve Phase 1 semantics but do not record future exception approvals.
- Approval and supersession persistence are `NOT_IMPLEMENTED` at this baseline.

## Canonical Constraints

- Generated status never implies authority.
- Review status never implies approval.
- Runtime code does not supersede architecture by existence.
- Protected-field changes need explicit approval evidence.
- Unresolved conflicts remain unresolved until repository-visible approval resolves them.

## Terminology

- Authority: repository-visible permission for a document or metadata source to control interpretation.
- Supersession: explicit replacement of one authoritative artifact/version by another.
- Protected-field exception: explicit permission to change a field marked protected by Phase 1 catalogue evidence.
- Generated documentation: synchronized output, not independent authority.

## Decision Drivers

- Agents need deterministic precedence without inference.
- Human reviewers need conflict visibility.
- Generators need to know which source controls.
- Protected-field changes need review evidence before implementation.
- Draft proposals must remain separate from approved architecture.

## Options Considered

### Option A - Fixed document-type hierarchy

A static hierarchy such as approved decision, approved canon, approved architecture, approved implementation specification, generated documentation, runtime evidence and drafts. This is simple, but file type alone is insufficient because generated Markdown can be current but unapproved, runtime behavior can be real but divergent, and a draft decision can be more specific without being authorized.

### Option B - Explicit approval and supersession records

Authority depends on explicit document identity, version, approval record, approver authority, superseded artifact/version, effective date, protected-field exception and rationale. This gives strong auditability but requires new process and persistence before enforcement.

### Option C - Review-board or exception-registry process

Protected changes require a change request, affected protected field, rationale, reviewer, approval record, supersession effect and downstream regeneration/revalidation obligations. This is strong for controlled changes but does not alone define every precedence case.

## Comparative Evaluation

| Criterion                 | Option A | Option B | Option C                   |
| ------------------------- | -------- | -------- | -------------------------- |
| Agent determinism         | Medium   | High     | High for protected changes |
| Auditability              | Low      | High     | High                       |
| Implementation complexity | Low      | Medium   | Medium                     |
| Handles generated docs    | Weak     | Strong   | Medium                     |
| Handles protected fields  | Weak     | Medium   | Strong                     |

## Recommended Direction for Human Architecture Review

Combine explicit approval/supersession records with a protected-field exception process. A fixed hierarchy may be used only as a fallback display aid when explicit records are absent; it must not resolve conflicts by itself.

This recommendation is not an approval, does not resolve the decision, and does not grant implementation authority.

## Selected Decision

WEOS adopts explicit repository-visible approval and supersession records as the basis of document authority.

Protected-field changes additionally require a structured exception process, impact assessment and independent review.

Document type, file format, generation status, modification date, review status, proximity to runtime code and runtime implementation do not establish authority or supersession.

Where no valid approval or supersession record exists, authority remains unresolved and governance-sensitive implementation must stop.

The initial implementation uses version-controlled machine-readable repository records. Database persistence may be considered later only when operational governance requirements justify it.

## Bootstrap Authority

The initial decision is approved by the Founding Architecture Authority. Bootstrap authority applies only to establishing the initial WEOS governance foundation.

Bootstrap authority does not automatically grant editorial, publication, clinical, institutional or operational authority. It must not be inferred from GitHub access, repository ownership, runtime role or administrator status.

Bootstrap authority expires when a permanent authority-assignment process approved under `WEOS-OD-022` becomes effective. Later authority assignments must be scoped, auditable and repository-visible.

## Rejected Options and Reasons

- Reject pure file-type hierarchy because it hides conflicts and treats form as authority.
- Reject ad hoc human notes without structured fields because agents cannot safely determine current authoritative versions.
- Reject runtime-code precedence because implementation evidence and architecture authority are separate.

## Consequences

### Positive

- Agents can determine current authoritative versions without inference.
- Reviewers can see unresolved conflicts and protected-field exceptions.
- Generated and runtime evidence keep their evidentiary role without silently controlling architecture.

### Negative

- Requires process design before automation.
- Adds review overhead for document changes.
- Requires migration/classification of existing baseline and generated artifacts.

### Risks

- Incomplete records could create false certainty.
- Poorly scoped approver authority could reintroduce ambiguity.
- Generated-document drift may be mistaken for supersession if obligations are not explicit.

### Compatibility Effects

- Existing Phase 2 documents remain draft/review-required.
- Baseline PDFs and generated specs are not superseded by this proposal.
- Compatibility maps remain interpretation evidence until approval records are added.

## Migration Prerequisites

- Inventory document IDs, versions, generated sources and protected fields.
- Classify existing documents only where evidence proves status.
- Do not invent historical approvals.
- Preserve unknown authority as `NOT_RECORDED`.

## Implementation Prerequisites

- Define approval-record and supersession-record contracts.
- Define protected-field exception contract.
- Define conformance checks that fail on ambiguous supersession claims.
- Define read model for agents.

## Data and Backfill Constraints

- Backfill only repository-visible facts.
- Unknown historical authority remains unknown.
- Generated docs carry source and generation version, not authority.
- Protected-field exceptions need explicit future approval records.

## Security and Authority Implications

- Prevents technical actors from using draft documents as implementation authorization.
- Requires approver authority to be scoped and auditable.
- Must support conflict-of-interest and emergency exception extensions later.

## Audit and Observability Requirements

- Record creation, supersession, protected-field exception and regeneration obligations.
- Log unresolved conflicts without treating logs as decisions.
- Provide reports for documents lacking approval or supersession evidence.

## Acceptance Criteria

- Generated status never implies authority.
- Review status never implies approval.
- Runtime code does not supersede architecture by existence.
- Protected-field changes require explicit approval evidence.
- Unresolved conflicts remain unresolved.
- Agents can determine the current authoritative version without inference.

## Unresolved Questions

- Who may approve document authority records?
- What reviewer class is required for protected-field exceptions?
- Which historical documents can ever be classified as approved from repository evidence alone?
- How are external institutional approvals represented?

## Dependencies

- Blocks `WEOS-OD-018` because decision envelopes must carry approval and supersession evidence.
- Relates to `WEOS-CAP-001` and `WEOS-GAP-001`.
- Must precede implementation of generated-document authority checks.

## Exact Implementation Sequence After Approval

1. Human reviewers select an authority and supersession model.
2. Define document identity, version, approval, supersession and exception schemas as TypeScript contracts.
3. Add conformance tests for draft/generated/reviewed authority boundaries.
4. Add additive persistence only after approval.
5. Build read-only authority reports.
6. Require explicit approval before any enforcement blocks writes.
7. Revalidate Phase 2 interpretation documents after records exist.

## Approval Record

- Decision status: `APPROVED_WITH_CONDITIONS`
- Approved option: `HYBRID_OPTION_B_AND_OPTION_C`
- Approver: `Gideon Lemasika Saningo`
- Approver role: `Founding Architecture Authority`
- Approval date: `2026-07-29`
- Approval evidence: `docs/weos/authority/records/document-approvals/WEOS-AUTH-APP-001.json`
- Conditions:
  - repository-native authority records are implemented first;
  - protected-field changes require enhanced review;
  - generated or runtime evidence never independently establishes authority;
  - unresolved conflicts block governance-sensitive implementation;
  - permanent authority assignment supersedes bootstrap authority;
  - Stage 1 does not authorize persistence or runtime enforcement.
- Implementation authorization: `GRANTED_FOR_STAGE_1_CONTRACTS_ONLY`
