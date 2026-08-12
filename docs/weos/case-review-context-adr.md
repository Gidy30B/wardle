# ADR: Canonical Case Review Context

Status: Draft implementation note for WEOS case-review-only slice.

## Purpose

The canonical Case Review Context is the backend-owned representation of the information required to make a governed case review or publication-readiness decision. It is not a frontend packet, dashboard view model, audit log, publication decision, or universal governance layer.

The context supports future immutable `CaseReviewContextSnapshot` records. PR 1 only assembles and hashes the context; it does not persist snapshots or integrate review workflows.

## Field Source Map

| Context area                                  | Backend source                                                                          |
| --------------------------------------------- | --------------------------------------------------------------------------------------- |
| `schemaVersion`                               | `CASE_REVIEW_CONTEXT_SCHEMA_VERSION` constant                                           |
| `assembledAt`                                 | assembler runtime clock; excluded from hash                                             |
| `purpose`                                     | assembler caller                                                                        |
| `reviewQuestion`                              | assembler caller or purpose-derived default                                             |
| `reviewIdentity`                              | `CaseReview` when supplied or latest case review                                        |
| `caseIdentity`                                | `Case`                                                                                  |
| `caseRevision`                                | exact `Case.currentRevision` where present                                              |
| `currentCaseState`                            | mutable `Case` editorial fields                                                         |
| `validation`                                  | latest `CaseValidationRun`                                                              |
| `diagnosisReadiness`                          | `getCaseDiagnosisPublishReadiness`                                                      |
| `clinicalContentAssessment.qualityProjection` | `CaseQualityProjectionService`                                                          |
| `clinicalContentAssessment.clueProgression`   | `CaseClueProgressionAnalysis`                                                           |
| `clinicalContentAssessment.playableClues`     | `CaseEligibilityPolicyService`                                                          |
| `reasoningState`                              | `ReasoningPath` rows for the linked diagnosis registry                                  |
| `differentialState.listed`                    | `Case.differentials`                                                                    |
| `differentialState.linked`                    | case differential links                                                                 |
| `differentialState.discriminatorAnnotations`  | `CaseClueDiscriminatorAnnotation`                                                       |
| `evidenceState`                               | `DiagnosisEvidenceRelationship` rows for the linked diagnosis registry                  |
| `teachingDependencies.rules`                  | `DiagnosisTeachingRule` rows for the linked diagnosis registry                          |
| `teachingDependencies.relationships`          | `DiagnosisTeachingRelationship` rows for the linked diagnosis registry                  |
| `aiProvenance`                                | `AiDraftRevisionAudit` rows affecting the case                                          |
| `clueRevisionDraftState`                      | `CaseClueRevisionDraft` rows for the case                                               |
| `blockers` and `warnings`                     | backend-derived governance issues                                                       |
| `publicationReadinessInputs`                  | approved state, diagnosis readiness, playable clues, validation, blocker/warning counts |
| `componentHashes`                             | SHA-256 hashes over canonicalized component payloads                                    |
| `contentHash`                                 | SHA-256 hash over canonicalized full context payload                                    |

## Immutable Versus Mutable Fields

Immutable references:

- Case id.
- Case review id when present.
- Current case revision id and revision number.
- Latest validation run id.
- Source ids for evidence, reasoning, teaching, AI audit, and clue draft rows.

Mutable snapshot context:

- Case editorial status.
- Approval fields.
- Diagnosis readiness.
- Validation outcome and validator version.
- Evidence/reasoning/teaching review states.
- AI review status.
- Clue draft application/review state.
- Blockers and warnings.

Derived assessments:

- Case quality projection.
- Playable clue readiness.
- Diagnosis readiness.
- Publication-readiness inputs.

UI-only presentation excluded:

- Display tone.
- Button labels.
- Dashboard next-action labels.
- Frontend surface identifiers.
- Marketing or explanatory copy.

## Hash Rules

Canonical hashing uses SHA-256 over a deterministic JSON representation.

Rules:

- Object keys are recursively sorted.
- `assembledAt` is excluded from hashed payloads.
- Dates are normalized to ISO-8601 strings.
- `undefined` object values are normalized to `null`.
- Meaningful ordered arrays retain order.
- Set-like arrays are sorted using canonical serialized item values.
- `schemaVersion` is included in component and content hashes.
- Source objects are not mutated during canonicalization.

Component hashes are generated for:

- Case revision.
- Validation.
- Diagnosis readiness.
- Evidence.
- Reasoning.
- Teaching dependencies.
- AI provenance.
- Clue revision drafts.
- Blockers.
- Warnings.

## Staleness Rules

The pure staleness comparison reports:

- `CASE_REVISION_CHANGED`
- `VALIDATION_CHANGED`
- `VALIDATION_FAILED`
- `VALIDATION_POLICY_CHANGED`
- `DIAGNOSIS_READINESS_CHANGED`
- `EVIDENCE_CHANGED`
- `REASONING_CHANGED`
- `TEACHING_DEPENDENCIES_CHANGED`
- `AI_PROVENANCE_CHANGED`
- `CLUE_DRAFT_STATE_CHANGED`
- `BLOCKERS_CHANGED`
- `WARNINGS_CHANGED`

PR 1 does not block workflow actions. Later PRs will use these reasons during transactional review submission and mark-ready decisions.

## Explicit Exclusions

This slice does not implement:

- Snapshot persistence.
- `CaseEditorialDecision`.
- `CaseReviewEvent`.
- Review workflow integration.
- Ready-to-publish integration.
- API contract changes.
- Dashboard changes.
- Scheduler changes.
- Diagnosis education governance.
- Universal governance records.
- Generic artifact references.
- Generic review packets.
- Publication decisions.

## Frontend Adaptation Guidance

The existing `caseReviewPacketViewModel` remains useful evidence of reviewer needs, but the backend context is canonical. Future dashboard work should consume backend context metadata and adapt it into presentation-specific labels, tones, and actions without feeding UI-only concepts back into governance snapshots.
