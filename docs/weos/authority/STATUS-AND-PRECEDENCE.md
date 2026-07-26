# WEOS Status and Precedence

This catalogue records evidence already present in the repository. It does not
create a new approval hierarchy.

## Verification Metadata

- Last verified commit: `4e4b65ce1704304b3eb69b888b51265f51af0731`
- Last verified date: `2026-07-26`
- Verification scope:
  - file presence,
  - document-stated statuses,
  - generation sources,
  - review dispositions,
  - overlap and supersession evidence.
- Not verified:
  - institutional approval outside the repository,
  - undocumented human decisions,
  - authority changes not committed to the repository.

## Classification Concepts

This catalogue separates document form from governance state:

- Document type describes what kind of artifact the file appears to be.
- Governance status records repository-visible control, review or lifecycle
  state.
- Approval state records whether approval is explicitly proven, not inferred.
- Source type distinguishes editable source, generated output, compiled output,
  register, manifest or runtime metadata source.

A catalogue row may contain more than one governance label because package
control, document maturity and review disposition are not yet represented as
separate repository fields. These labels must be interpreted independently and
must not be treated as interchangeable lifecycle or approval states.

`CONTROLLED_BASELINE` means that the documentation package is organised,
versioned and registered as a baseline. It does not mean that its contents are
formally approved, institutionally binding or superior to later reviewed
implementation specifications.

Generated implementation specifications must remain synchronized with their
code metadata sources. Synchronization proves consistency between generated
documentation and implementation metadata. It does not grant the metadata higher
governance authority or resolve conflicts with WEOS Architecture, Canon or open
decisions.

## Document Catalogue

| Path                                                                   | ID                                                          | Title                                       | Document type                | Governance status              | Approval state        | Source type                                                                       | Current stated status                                                                              | Overlap                                                            | Apparent use                                                                          | Supersession evidence                                                | Unresolved authority questions                                                                                              |
| ---------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------- | ---------------------------- | ------------------------------ | --------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `docs/weos/WEOS-IMP-001-current-to-canonical-mapping.md`               | `WEOS-IMP-001`                                              | Current-to-Canonical Implementation Mapping | Implementation specification | `REVIEWED_DRAFT`               | `APPROVAL_NOT_PROVEN` | Markdown implementation specification                                             | `Draft - Reviewed` in Document Control                                                             | Overlaps Phase 2 generated specs and baseline canon                | Reviewed implementation evidence for Phase 1 mappings, not formal institutional canon | No explicit supersession marker found                                | Whether reviewed draft has higher precedence than baseline PDFs is not stated                                               |
| `docs/weos/WEOS-IMP-001-divergence-register.md`                        | Implied `WEOS-IMP-001` companion                            | Divergence register                         | Divergence register          | `REVIEWED_DRAFT`               | `APPROVAL_NOT_PROVEN` | Markdown implementation register                                                  | Rows carry open statuses such as `OPEN`; Phase 1 accepted base referenced by review manifest       | Overlaps open decisions and Phase 2 gap docs                       | Evidence register for divergences; does not resolve them                              | No explicit supersession marker found                                | Whether entries remain open after later commits must be checked row-by-row                                                  |
| `docs/weos/WEOS-IMP-002-lifecycle-transition-specification.md`         | `WEOS-IMP-002`                                              | Lifecycle and Transition Specification      | Implementation specification | `DRAFT`, `REVIEW_REQUIRED`     | `REVIEW_REQUIRED`     | Generated Markdown from `doctordle-backend/scripts/generate-weos-phase-2-docs.js` | `Status: Draft`; `Disposition: REVIEW_REQUIRED`                                                    | Overlaps canonical lifecycles/transitions source files             | Generated implementation specification for current metadata                           | Review manifest states Phase 2 disposition remains `REVIEW_REQUIRED` | Not formally approved; generated output should match source metadata                                                        |
| `docs/weos/WEOS-IMP-003-editorial-action-decision-catalogue.md`        | `WEOS-IMP-003`                                              | Editorial Action and Decision Catalogue     | Implementation specification | `DRAFT`, `REVIEW_REQUIRED`     | `REVIEW_REQUIRED`     | Generated Markdown from canonical action metadata                                 | `Status: Draft`; `Disposition: REVIEW_REQUIRED`                                                    | Overlaps `canonical-actions.ts` and runtime action implementations | Generated catalogue for canonical action interpretation                               | No supersession marker; docs check exists                            | Does not by itself prove runtime implementation                                                                             |
| `docs/weos/WEOS-IMP-004-legacy-status-crosswalk.md`                    | `WEOS-IMP-004`                                              | Legacy Status Crosswalk                     | Implementation specification | `DRAFT`, `REVIEW_REQUIRED`     | `REVIEW_REQUIRED`     | Generated Markdown from crosswalk metadata                                        | `Status: Draft`; `Disposition: REVIEW_REQUIRED`                                                    | Overlaps runtime status enums and string fields                    | Mapping aid; explicitly distinguishes semantic and record-migration safety            | No supersession marker found                                         | Live-data evidence remains required before migration                                                                        |
| `docs/weos/WEOS-IMP-005-phase-2-open-decisions.md`                     | `WEOS-IMP-005`                                              | Phase 2 Open Decisions                      | Decision register            | `DRAFT`, `REVIEW_REQUIRED`     | `REVIEW_REQUIRED`     | Markdown decision register                                                        | `Status: Draft`; `Disposition: REVIEW_REQUIRED`                                                    | Overlaps all Phase 2 implementation gaps                           | Strong evidence for unresolved decisions because it explicitly says they remain open  | States no unsupported architecture question is silently resolved     | Who can close each decision is not defined here                                                                             |
| `docs/weos/phase-2-review/REVIEW-MANIFEST.md`                          | None                                                        | WEOS Phase 2 Review Manifest                | Review manifest              | `REVIEW_REQUIRED`              | `REVIEW_REQUIRED`     | Markdown review note                                                              | `Disposition: REVIEW_REQUIRED`; `Phase 3 status: NOT STARTED`                                      | Overlaps generated docs and commit evidence                        | Review bundle manifest for Phase 2, not canonical architecture                        | Records accepted Phase 1 base and protected fixture                  | Whether review checklist items are completed is not stated                                                                  |
| `docs/weos/phase-2-review/REVIEW-CHECKLIST.md`                         | None                                                        | WEOS Phase 2 Review Checklist               | Review checklist             | `REVIEW_REQUIRED`              | `REVIEW_REQUIRED`     | Markdown review checklist                                                         | Checklist items unchecked                                                                          | Overlaps open decisions and conformance docs                       | Reviewer aid only                                                                     | No supersession marker found                                         | Completion/approval state is not proven                                                                                     |
| `docs/weos/phase-2-review/CONTRACT-INVENTORY.md`                       | None                                                        | WEOS Phase 2 Contract Inventory             | Contract inventory           | `REVIEW_REQUIRED`              | `REVIEW_REQUIRED`     | Markdown inventory                                                                | Inventory counts and key lists                                                                     | Overlaps source metadata                                           | Index into current canonical metadata                                                 | No supersession marker found                                         | Counts must be regenerated/rechecked after metadata changes                                                                 |
| `docs/weos/case-review-context-adr.md`                                 | None                                                        | Case review context ADR                     | ADR                          | `DRAFT`                        | `APPROVAL_NOT_PROVEN` | Markdown ADR                                                                      | `Status: Draft implementation note for WEOS case-review-only slice`                                | Overlaps case review governance records and context snapshots      | Narrow implementation note for case-review slice                                      | No supersession marker found                                         | Whether ADR is approved is not stated                                                                                       |
| `docs/weos/WEOS_Documentation_Baseline_0.2/README.md`                  | Baseline 0.2 package                                        | WEOS Documentation Baseline 0.2             | Baseline package             | `CONTROLLED_BASELINE`, `DRAFT` | `NOT_APPROVED`        | Package README                                                                    | "Structurally complete working documentation baseline, not yet an approved institutional baseline" | Overlaps Architecture/Canon PDFs and implementation specs          | Baseline package index, but not approved institutional baseline                       | No repository evidence that it supersedes implementation specs       | Editable/compiled source of truth is unresolved                                                                             |
| `docs/weos/WEOS_Documentation_Baseline_0.2/WEOS_Document_Register.csv` | Multiple `WEOS-ARCH-*`, `WEOS-CANON-*`, `WEOS-GOV-PLAN-001` | Document register                           | Document register            | `CONTROLLED_BASELINE`, `DRAFT` | `APPROVAL_NOT_PROVEN` | CSV register                                                                      | Register rows include `Draft complete` and `Draft for approval`                                    | Overlaps PDFs and DOCX sources                                     | Best available status register for baseline package                                   | No explicit supersession of implementation specs                     | "Uncontrolled source" meaning requires human clarification                                                                  |
| `docs/weos/WEOS_Documentation_Baseline_0.2/01_Architecture/*.pdf`      | `WEOS-ARCH-001` to `WEOS-ARCH-009`                          | Architecture Parts I-IX                     | Architecture document        | `CONTROLLED_BASELINE`, `DRAFT` | `APPROVAL_NOT_PROVEN` | Compiled PDF publication output                                                   | Register says most are `Draft complete`; Part VIII is `Draft for approval`                         | Overlaps implementation specs and workspace docs                   | Architecture background; do not treat as editable Markdown authority                  | No explicit supersession marker found                                | PDF text was not edited; exact clause precedence unresolved                                                                 |
| `docs/weos/WEOS_Documentation_Baseline_0.2/02_Editorial_Canon/*.pdf`   | `WEOS-CANON-001` to `WEOS-CANON-007`                        | Editorial Canon Parts I-VII                 | Editorial Canon              | `CONTROLLED_BASELINE`, `DRAFT` | `APPROVAL_NOT_PROVEN` | Compiled PDF publication output                                                   | Register says mixed `Draft complete` and `Draft for approval`                                      | Overlaps canonical metadata and glossary terms                     | Canon background; not proof of current runtime behavior                               | No explicit supersession marker found                                | Whether PDFs or generated implementation specs control conflicts is unresolved                                              |
| `docs/weos/WEOS_Documentation_Baseline_0.2/04_Editable_Sources/*.docx` | Several baseline docs                                       | Editable sources                            | Editable source              | `DRAFT`, `UNKNOWN`             | `UNKNOWN`             | DOCX sources                                                                      | README says editable sources for newly authored or updated documents                               | Overlaps PDFs                                                      | Editable only where explicitly identified by baseline package                         | No supersession marker found                                         | The presence of an editable DOCX source does not prove that it governs the corresponding compiled PDF or other WEOS source. |

## Conflict Handling Rule

When two WEOS sources conflict:

1. Do not select a winner based on file format, modification date, generated
   status or proximity to runtime code.
2. Check `WEOS-IMP-005-phase-2-open-decisions.md` and
   `WEOS-IMP-001-divergence-register.md`.
3. Determine whether an explicit approved decision or supersession record
   exists.
4. If no approved resolution exists, mark the interpretation as unresolved.
5. Record the conflict in `docs/weos/gaps/IMPLEMENTATION-GAPS.md`.
6. Do not perform an irreversible, publication-sensitive,
   governance-sensitive or destructive change based on the unresolved issue.
7. Obtain explicit human architecture disposition when the conflict blocks
   implementation.

## Precedence Summary

Repository evidence establishes document status, source type and review
disposition. It does not yet establish a complete binding authority hierarchy.

- `CONTROLLED_BASELINE` describes a versioned and organised documentation
  package. It does not imply formal institutional approval.
- `REVIEWED_DRAFT` indicates that review has occurred, but does not imply final
  approval unless an explicit approval record exists.
- `REVIEW_REQUIRED` means the document or contract must not be treated as
  settled authority.
- Generated implementation specifications must remain synchronized with their
  code metadata sources. Synchronization proves consistency between generated
  documentation and implementation metadata; it does not make the metadata a
  higher governance authority.
- Runtime code describes current implementation. It does not automatically
  resolve conflicts with WEOS Architecture, Canon or open decisions.
- Open decisions in `WEOS-IMP-005` must not be resolved through agent
  inference.
- Where no explicit approval, supersession or resolution record exists, the
  affected interpretation remains unresolved.
