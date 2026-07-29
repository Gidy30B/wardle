const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const docsRoot = path.join(root, 'docs', 'weos');
const distRoot = path.resolve(
  __dirname,
  '..',
  'dist',
  'modules',
  'editorial-governance',
);

const actions = require(path.join(distRoot, 'canonical-actions.js'));
const lifecycles = require(path.join(distRoot, 'canonical-lifecycles.js'));
const transitions = require(path.join(distRoot, 'canonical-transitions.js'));
const preconditions = require(
  path.join(distRoot, 'canonical-preconditions.js'),
);
const invalidation = require(path.join(distRoot, 'canonical-invalidation.js'));
const crosswalk = require(path.join(distRoot, 'legacy-status-crosswalk.js'));

function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value).replaceAll('|', '\\|').replaceAll('\n', '<br>');
}

function list(values) {
  return values && values.length ? values.map(esc).join(', ') : '';
}

function table(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(esc).join(' | ')} |`),
  ].join('\n');
}

const actionRows = actions.WEOS_CANONICAL_ACTIONS.map((item) => [
  item.key,
  item.label,
  item.meaning,
  item.category,
  list(item.subjectArtifactTypes),
  list(item.targetRevisionTypes),
  list(item.producesArtifactTypes),
  list(item.producesRecordKinds),
  list(item.changesStandingOfArtifactTypes),
  item.createsContent,
  item.changesContent,
  item.createsRevision,
  item.requiresVersionTarget,
  item.createsValidationResult,
  item.createsAssessment,
  item.requiresDecision,
  item.decisionOutcome,
  item.createsGovernanceRecord,
  item.governanceRecordType,
  item.auditRecordType,
  item.createsOperationalEffect,
  item.mayAffectLearnerExposure,
  item.mayInvalidatePriorStanding,
  item.currentImplementationSupport,
  list(item.currentImplementationSymbols),
  item.abstract ? 'abstract' : item.composite ? 'composite' : list(item.notes),
]);

function decisionClassification(item) {
  if (item.abstract) return 'abstract decision family';
  if (item.composite) return 'composite workflow containing decision steps';
  if (item.decisionOutcome) return 'action produces a decision outcome';
  return 'action requires a separate prior decision';
}

const decisionRows = actions.WEOS_CANONICAL_ACTIONS.filter(
  (item) => item.requiresDecision,
).map((item) => [
  item.key,
  item.category,
  decisionClassification(item),
  list(item.subjectArtifactTypes),
  list(item.targetRevisionTypes),
  item.requiresVersionTarget,
  item.decisionOutcome,
  item.governanceRecordType,
  'Phase 2 identifies authority requirement; Phase 5 assigns authority.',
  'Required for governed decisions.',
  item.createsOperationalEffect
    ? 'Operational effect recorded'
    : list(item.changesStandingOfArtifactTypes) ||
      'Lifecycle or standing effect',
]);

const lifecycleRows = lifecycles.WEOS_CANONICAL_LIFECYCLES.flatMap((family) =>
  family.states.map((state) => [
    family.lifecycleFamily,
    family.artifactType,
    family.meaning,
    state.key,
    state.stateClass,
    state.permitsContentMutation,
    state.terminal,
    state.currentlyImplemented,
    list(family.currentImplementationModels),
  ]),
);

const transitionRows = transitions.WEOS_CANONICAL_TRANSITIONS.map((item) => {
  const action = actions.WEOS_CANONICAL_ACTION_BY_KEY[item.action];
  return [
    item.key,
    item.artifactType,
    item.fromState,
    item.action,
    item.toState,
    list(item.requiredPreconditions),
    action?.requiresVersionTarget,
    action?.requiresDecision,
    action?.governanceRecordType ?? list(action?.producesRecordKinds ?? []),
    action?.createsOperationalEffect,
    action?.mayAffectLearnerExposure,
    item.standingImpacts
      .map((impact) => `${impact.standing}:${impact.effect}`)
      .join(', '),
    action?.currentImplementationSupport,
  ];
});

const preconditionRows = preconditions.WEOS_PRECONDITION_CATALOGUE.map(
  (item) => [
    item.key,
    item.category,
    item.meaning,
    list(item.requiredEvidence),
    'Conceptual in Phase 2; enforcement requires schema, commands, authority, and live-data audit.',
  ],
);

const crosswalkRows = crosswalk.WEOS_LEGACY_STATUS_CROSSWALK.map((item) => [
  item.sourcePath,
  item.sourceEnumOrField,
  item.sourceValue,
  item.sourceArtifactType,
  item.legacyDimension,
  item.canonicalInterpretations
    .map((target) =>
      [
        target.canonicalConcept,
        target.targetArtifactType,
        target.lifecycleFamily,
        target.lifecycleState,
        target.validationOutcome,
        target.validationStanding,
        target.meaning,
      ]
        .filter(Boolean)
        .join(':'),
    )
    .join('<br>'),
  item.verificationConfidence,
  item.exhaustiveSourceVocabulary,
  item.semanticMappingSafe,
  item.recordMigrationSafe,
  item.ambiguity,
  list(item.requiredLiveDataQueries),
  item.recommendedMigrationTreatment,
  list(item.requiredConformanceTests),
]);

const write = (file, content) =>
  fs.writeFileSync(path.join(docsRoot, file), `${content.trim()}\n`);

write(
  'WEOS-IMP-002-lifecycle-transition-specification.md',
  `
# WEOS-IMP-002: Lifecycle and Transition Specification

## Document Control

- Document ID: \`WEOS-IMP-002\`
- Title: \`Lifecycle and Transition Specification\`
- Version: \`0.1\`
- Status: \`Draft\`
- Implementation phase: \`Phase 2\`
- Disposition: \`REVIEW_REQUIRED\`

## 6.1 Purpose and Scope

This document defines contracts only. No runtime enforcement, Prisma schema work, migration, permission change, publication behavior change, scheduling change, or learner-facing behavior change is authorised.

## 6.2 Relationship to Phase 1

This document extends the accepted Phase 1 mapping and divergence register. It preserves the compatibility-projection principle and immutable historical-record principle: historical records stay valid, while new revisions do not inherit standing without proof.

## 6.3 Canonical Distinctions

Lifecycle versus readiness; lifecycle versus operational permission; identity versus revision; Validation Result versus Assessment; Assessment versus Review; Review versus Decision; acceptance versus Controlled Application; approval versus publication; publication versus schedule; schedule versus release; release versus learner exposure; stale versus superseded; cancelled versus revoked; withdrawn versus archived; historical decision preservation versus non-inheritance by new revisions; Review Packet Snapshot is source context, not Governance Record; Technical actor is not authority; Historical validity is preserved even when standing is not inherited.

## 6.4 Lifecycle Family Catalogue

Complete table generated from \`WEOS_CANONICAL_LIFECYCLES\`.

${table(['Lifecycle', 'Artifact', 'Purpose', 'State', 'State class', 'Content mutation', 'Terminal', 'Implemented', 'Legacy/status relationship'], lifecycleRows)}

## 6.5 Transition Catalogue

Complete table generated from \`WEOS_CANONICAL_TRANSITIONS\` and action metadata.

${table(['Transition', 'Artifact', 'From', 'Action', 'To', 'Preconditions', 'Version target', 'Decision required', 'Governance record', 'Operational effect', 'Learner exposure effect', 'Standing impacts', 'Implementation support'], transitionRows)}

Diagnosis remapping is not represented as an ordinary lifecycle transition. \`REMAP_DIAGNOSIS_REFERENCE\` is a governed identity operation requiring source and target identities, affected-reference inventory, authority, rationale, conflict/collision checks, dependency-impact assessment, idempotency, transaction, and optimistic concurrency where applicable.

Publication withdrawal targets \`PUBLISHED_ARTIFACT_VERSION: PUBLISHED -> WITHDRAWN\`. The original Publication Decision remains historically authorised. Withdrawal creates a Withdrawal Record, preserves Publication History, cancels future schedules where applicable, and ends or revokes active learner exposure.

\`REQUIRE_REVISION\` changes review/revision standing but does not perform material content edits; material standing impacts occur when content is edited, a new revision is created, a component is replaced, an accepted draft is applied, or a dependency changes.

## 6.6 Preconditions

${table(['Precondition', 'Category', 'Meaning', 'Required evidence', 'Phase 2 treatment'], preconditionRows)}

## 6.7 Standing Impacts and Material Change

${table(
  ['Rule', 'Trigger kind', 'Actions', 'Impacts', 'Historical records'],
  Object.values(invalidation.WEOS_INVALIDATION_RULES).map((rule) => [
    rule.trigger,
    rule.triggerKind,
    list(rule.causedByActions ?? []),
    rule.impacts
      .map(
        (impact) => `${impact.standing}:${impact.effect}:${impact.appliesTo}`,
      )
      .join(', '),
    rule.preservesHistoricalRecords,
  ]),
)}

## 6.8 Compatibility Projections

\`Case.editorialStatus\`, \`Case.approvedAt\`, \`Case.approvedByUserId\`, \`Case.publishedAt\`, \`DiagnosisEducation.editorialStatus\`, \`DiagnosisEducation.reviewedAt\`, and \`DiagnosisEducation.publishedAt\` remain compatibility projections until governed command handlers or derived projections own them.

## 6.9 Current Implementation Support

The tables above include implementation support via action/lifecycle metadata. Missing or partial items remain REVIEW_REQUIRED.

## 6.10 Phase 3 Preparation

Minimum Governance Record structure: artifact type, artifact id, exact revision id when applicable, governance question, actor id, authority exercised, findings, rationale, outcome, effect, prior state, resulting state, obligations, timestamp, Review/Assessment/Validation Result/Review Packet references. Phase 3 must identify transaction, idempotency, optimistic concurrency, direct-write routing, compatibility projection synchronization, backfill sources, nullable revision links, required indexes, live-data queries, and unresolved decisions before schema work.
`,
);

write(
  'WEOS-IMP-003-editorial-action-decision-catalogue.md',
  `
# WEOS-IMP-003: Editorial Action and Decision Catalogue

## Document Control

- Document ID: \`WEOS-IMP-003\`
- Title: \`Editorial Action and Decision Catalogue\`
- Version: \`0.1\`
- Status: \`Draft\`
- Disposition: \`REVIEW_REQUIRED\`

## 7.1 Conceptual Distinctions

An action is something done. Validation records rule/system output. Assessment records structured evaluation. Review is workflow. Decision records an outcome under authority. Controlled Application applies an accepted candidate and is not approval. Operational effect changes permissions, schedule, release, or exposure. Audit Event records that something happened. Governance Record records why, under whose authority, and with what effect.

## 7.2 Action Categories

Executive action index only; the complete controlled catalogue is in 7.3.

${table(
  ['Category', 'Actions'],
  Object.values(actions.WEOS_ACTION_CATEGORIES).map((category) => [
    category,
    list(
      actions.WEOS_CANONICAL_ACTIONS.filter(
        (item) => item.category === category,
      ).map((item) => item.key),
    ),
  ]),
)}

## 7.3 Complete Action Catalogue

Complete table generated from \`WEOS_CANONICAL_ACTIONS\`.

\`Subject artifacts\` identifies what an action operates on. \`Target revision types\` identifies exact revisions required by the action. \`Produced artifacts\` and \`Produced record kinds\` identify newly created artifacts or records. \`Changes standing of artifact types\` identifies existing artifacts whose lifecycle, standing, visibility, operational permission, or publication status changes. \`applicableArtifactTypes\` remains legacy broad compatibility/discovery metadata and is not the authoritative action contract.

${table(['Action key', 'Label', 'Meaning', 'Category', 'Subject artifacts', 'Target revision types', 'Produced artifacts', 'Produced record kinds', 'Changes standing of artifact types', 'Creates content', 'Changes content', 'Creates revision', 'Requires version target', 'Creates Validation Result', 'Creates Assessment', 'Requires Decision', 'Decision outcome', 'Creates Governance Record', 'Governance Record type', 'Audit Record type', 'Creates operational effect', 'May affect learner exposure', 'Standing impacts', 'Implementation support', 'Implementation symbols', 'Notes'], actionRows)}

## 7.4 Complete Decision Catalogue

Every action with \`requiresDecision: true\` appears here. Action category is distinct from decision requirement, decision outcome, and decision record produced.

${table(['Action key', 'Action category', 'Decision classification', 'Subject artifacts', 'Target revision types', 'Version target', 'Decision outcome', 'Decision record produced', 'Required authority', 'Required rationale', 'Resulting effect'], decisionRows)}

## 7.5 Governance Record Implications

\`REQUEST_CHANGES\` is review communication or recommendation and does not necessarily create an Editorial Decision. \`REQUIRE_REVISION\` is a governed decision that changes standing, creates an Editorial Decision, and records rationale, authority, and obligations. Projection writes such as marking an evidence source withdrawn are implementation effects, not peer canonical governance actions.

## 7.6 Authority Note

Phase 2 identifies actions requiring authority but does not assign roles or enforce authority. Technical actors are not authority.

## 7.7 Current Divergences

Current service operations may combine several canonical actions. This document does not change runtime behavior.
`,
);

write(
  'WEOS-IMP-004-legacy-status-crosswalk.md',
  `
# WEOS-IMP-004: Legacy Status Crosswalk

## Document Control

- Document ID: \`WEOS-IMP-004\`
- Title: \`Legacy Status Crosswalk\`
- Version: \`0.1\`
- Status: \`Draft\`
- Disposition: \`REVIEW_REQUIRED\`

## 8.1 Purpose

This crosswalk interprets legacy projections without declaring them canonical records.

## 8.2 Crosswalk Rules

One legacy status may span several canonical dimensions. Ambiguous statuses are unsafe for automatic record migration. Exact revision linkage cannot be invented. Approval and publication provenance cannot be inferred from timestamps alone. Historical data may require \`UNKNOWN\` or \`LEGACY\` classification. Semantic mapping safety is distinct from record migration safety.

## 8.3 Complete Status Tables

Complete table generated from \`WEOS_LEGACY_STATUS_CROSSWALK\`.

${table(['Source path', 'Source field/enum', 'Value', 'Source artifact', 'Legacy dimension', 'Canonical interpretations', 'Confidence', 'Exhaustive', 'Semantic safe', 'Record migration safe', 'Ambiguity', 'Required data query', 'Migration treatment', 'Conformance test'], crosswalkRows)}

## 8.4 Unsafe Migration Summary

All current entries are unsafe for automatic record migration. Some entries are semantically clear, but no entry may create complete canonical records without live evidence. Legacy \`PUBLISHED\` does not produce an authorised Publication Decision without exact revision, prior valid approval, actor, authority, timestamp, and decision provenance. \`VALIDATED\` is not approval. \`READY_TO_PUBLISH\` is not approval. \`PUBLISHED\` is not immutable exposure.

## 8.5 Live-Data Queries Required

Required query descriptions include current revision linkage, approval-to-revision evidence, publication timestamp consistency, published cases lacking approved revision, \`DailyCase\` records lacking immutable exposure target, legacy reviews without revision, validation runs without revision, education revision/publication linkage, accepted AI drafts not applied, clue drafts applied without resulting revision, and unknown production string statuses.
`,
);

write(
  'WEOS-IMP-005-phase-2-open-decisions.md',
  fs.readFileSync(
    path.join(docsRoot, 'WEOS-IMP-005-phase-2-open-decisions.md'),
    'utf8',
  ),
);
