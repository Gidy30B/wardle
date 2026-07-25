import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  WEOS_ALIGNMENT_CLASSIFICATIONS,
  WEOS_GOVERNANCE_SEVERITIES,
} from './canonical-concepts';
import {
  WEOS_ARTIFACT_TYPES,
  WEOS_CANONICAL_ARTIFACT_CATALOGUE,
  WEOS_CANONICAL_ARTIFACT_CATALOGUE_ENTRIES,
} from './canonical-artifact-catalogue';

describe('WEOS canonical artifact catalogue', () => {
  it('has exactly one catalogue entry for every artifact type', () => {
    const artifactTypes = Object.values(WEOS_ARTIFACT_TYPES);

    expect(WEOS_CANONICAL_ARTIFACT_CATALOGUE_ENTRIES).toHaveLength(
      artifactTypes.length,
    );
    expect(Object.keys(WEOS_CANONICAL_ARTIFACT_CATALOGUE).sort()).toEqual(
      artifactTypes.sort(),
    );
  });

  it('declares alignment and current implementation support for every entry', () => {
    const alignments = Object.values(WEOS_ALIGNMENT_CLASSIFICATIONS);
    const severities = Object.values(WEOS_GOVERNANCE_SEVERITIES);
    const support = [
      'IMPLEMENTED',
      'PARTIALLY_IMPLEMENTED',
      'NOT_IMPLEMENTED',
      'UNKNOWN',
    ];

    for (const entry of WEOS_CANONICAL_ARTIFACT_CATALOGUE_ENTRIES) {
      expect(entry.canonicalPurpose.trim().length).toBeGreaterThan(0);
      expect(alignments).toContain(entry.currentAlignmentClassification);
      expect(severities).toContain(entry.severity);
      expect(support).toContain(entry.currentImplementationSupport);
    }
  });

  it('rejects combined or unrecognized severity values', () => {
    const severities = Object.values(WEOS_GOVERNANCE_SEVERITIES);

    expect(severities).not.toContain('MODERATE/HIGH');
    expect(severities).not.toContain('SEVERE');

    for (const entry of WEOS_CANONICAL_ARTIFACT_CATALOGUE_ENTRIES) {
      expect(entry.severity).not.toContain('/');
      expect(entry.severity).not.toContain(',');
    }
  });

  it('keeps missing artifacts from claiming a current Prisma model', () => {
    const missing = WEOS_CANONICAL_ARTIFACT_CATALOGUE_ENTRIES.filter(
      (entry) => entry.currentImplementationSupport === 'NOT_IMPLEMENTED',
    );

    expect(missing.length).toBeGreaterThan(0);
    for (const entry of missing) {
      expect(entry.currentImplementationModel).toBeNull();
      expect(entry.currentPrismaModels).toHaveLength(0);
    }
  });

  it('requires versioned implemented artifacts to name their current revision model or carrier', () => {
    for (const entry of WEOS_CANONICAL_ARTIFACT_CATALOGUE_ENTRIES) {
      if (
        entry.versioned &&
        entry.currentImplementationSupport !== 'NOT_IMPLEMENTED'
      ) {
        expect(entry.currentRevisionModels.length).toBeGreaterThan(0);
      }
    }
  });

  it('keeps CaseReviewContextSnapshot distinct from decisions and generic Governance Records', () => {
    const snapshot = WEOS_CANONICAL_ARTIFACT_CATALOGUE.REVIEW_PACKET_SNAPSHOT;

    expect(snapshot.currentPrismaModels).toContain('CaseReviewContextSnapshot');
    expect(snapshot.canonicalType).not.toBe(
      WEOS_ARTIFACT_TYPES.EDITORIAL_DECISION,
    );
    expect(snapshot.canonicalType).not.toBe(
      WEOS_ARTIFACT_TYPES.GOVERNANCE_RECORD,
    );
    expect(snapshot.candidateGovernedClassification).toBe('ASSESSMENT_RECORD');
  });

  it('keeps Validation Result distinct from Editorial Assessment and Editorial Decision', () => {
    expect(WEOS_ARTIFACT_TYPES.VALIDATION_RESULT).not.toBe(
      WEOS_ARTIFACT_TYPES.EDITORIAL_ASSESSMENT,
    );
    expect(WEOS_ARTIFACT_TYPES.VALIDATION_RESULT).not.toBe(
      WEOS_ARTIFACT_TYPES.EDITORIAL_DECISION,
    );
    expect(
      WEOS_CANONICAL_ARTIFACT_CATALOGUE.VALIDATION_RESULT
        .candidateGovernedClassification,
    ).toBe('ASSESSMENT_RECORD');
    expect(
      WEOS_CANONICAL_ARTIFACT_CATALOGUE.VALIDATION_RESULT.decisionRequirement,
    ).toBe('NOT_APPLICABLE');
  });

  it('keeps Validation Result distinct from every structured Editorial Assessment family', () => {
    for (const assessmentType of [
      WEOS_ARTIFACT_TYPES.CLINICAL_ASSESSMENT,
      WEOS_ARTIFACT_TYPES.EDUCATIONAL_ASSESSMENT,
      WEOS_ARTIFACT_TYPES.REASONING_ASSESSMENT,
      WEOS_ARTIFACT_TYPES.EVIDENCE_ASSESSMENT,
      WEOS_ARTIFACT_TYPES.SAFETY_ASSESSMENT,
      WEOS_ARTIFACT_TYPES.PUBLICATION_READINESS_ASSESSMENT,
    ]) {
      expect(WEOS_ARTIFACT_TYPES.VALIDATION_RESULT).not.toBe(assessmentType);
    }
  });

  it('keeps Editorial Review, Editorial Assessment, and Editorial Decision distinct', () => {
    expect(
      new Set([
        WEOS_ARTIFACT_TYPES.EDITORIAL_REVIEW,
        WEOS_ARTIFACT_TYPES.EDITORIAL_ASSESSMENT,
        WEOS_ARTIFACT_TYPES.EDITORIAL_DECISION,
      ]).size,
    ).toBe(3);
  });

  it('keeps Learning Goal Coverage distinct from Learning Goal', () => {
    expect(WEOS_ARTIFACT_TYPES.LEARNING_GOAL_COVERAGE_ASSESSMENT).not.toBe(
      WEOS_ARTIFACT_TYPES.LEARNING_GOAL,
    );
    expect(
      WEOS_CANONICAL_ARTIFACT_CATALOGUE.LEARNING_GOAL_COVERAGE_ASSESSMENT
        .currentPrismaModels,
    ).toContain('CaseLearningGoalCoverage');
  });

  it('represents missing structured assessment families without Prisma model claims', () => {
    for (const key of [
      'CLINICAL_ASSESSMENT',
      'EDUCATIONAL_ASSESSMENT',
      'REASONING_ASSESSMENT',
      'EVIDENCE_ASSESSMENT',
      'SAFETY_ASSESSMENT',
      'PUBLICATION_READINESS_ASSESSMENT',
    ] as const) {
      const entry = WEOS_CANONICAL_ARTIFACT_CATALOGUE[key];

      expect(entry.currentAlignmentClassification).toBe('MISSING');
      expect(entry.severity).toBe('HIGH');
      expect(entry.verificationConfidence).toBe('CONFIRMED');
      expect(entry.currentImplementationSupport).toBe('NOT_IMPLEMENTED');
      expect(entry.currentPrismaModels).toHaveLength(0);
    }
  });

  it('keeps Teaching Relationship as its own canonical artifact', () => {
    const relationship =
      WEOS_CANONICAL_ARTIFACT_CATALOGUE.TEACHING_RELATIONSHIP;

    expect(relationship.currentPrismaModels).toContain(
      'DiagnosisTeachingRelationship',
    );
    expect(relationship.currentAlignmentClassification).toBe(
      'PARTIALLY_ALIGNED',
    );
    expect(relationship.severity).toBe('MODERATE');
  });

  it('keeps Evidence Node distinct from Evidence Source', () => {
    expect(WEOS_ARTIFACT_TYPES.EVIDENCE_NODE).not.toBe(
      WEOS_ARTIFACT_TYPES.EVIDENCE_SOURCE,
    );
    expect(
      WEOS_CANONICAL_ARTIFACT_CATALOGUE.EVIDENCE_SOURCE
        .currentImplementationSupport,
    ).toBe('NOT_IMPLEMENTED');
  });

  it('keeps Claim-Support Link distinct from Reference List', () => {
    expect(WEOS_ARTIFACT_TYPES.CLAIM_SUPPORT_LINK).not.toBe(
      WEOS_ARTIFACT_TYPES.REFERENCE_LIST,
    );
    expect(
      WEOS_CANONICAL_ARTIFACT_CATALOGUE.CLAIM_SUPPORT_LINK
        .currentImplementationSupport,
    ).toBe('NOT_IMPLEMENTED');
  });

  it('keeps Evidence Assessment distinct from Evidence Source', () => {
    expect(WEOS_ARTIFACT_TYPES.EVIDENCE_ASSESSMENT).not.toBe(
      WEOS_ARTIFACT_TYPES.EVIDENCE_SOURCE,
    );
    expect(
      WEOS_CANONICAL_ARTIFACT_CATALOGUE.EVIDENCE_ASSESSMENT
        .candidateGovernedClassification,
    ).toBe('ASSESSMENT_RECORD');
  });

  it('keeps Audit Event distinct from Governance Record', () => {
    expect(WEOS_ARTIFACT_TYPES.AUDIT_EVENT).not.toBe(
      WEOS_ARTIFACT_TYPES.GOVERNANCE_RECORD,
    );
    expect(
      WEOS_CANONICAL_ARTIFACT_CATALOGUE.AUDIT_EVENT
        .candidateGovernedClassification,
    ).toBe('AUDIT_RECORD');
  });

  it('keeps registry activation distinct from editorial completeness', () => {
    expect(WEOS_ARTIFACT_TYPES.REGISTRY_ACTIVATION_STATE).not.toBe(
      WEOS_ARTIFACT_TYPES.DIAGNOSIS_ONBOARDING_PROGRESS,
    );
  });

  it('keeps playability permission distinct from playability readiness', () => {
    expect(WEOS_ARTIFACT_TYPES.DIAGNOSIS_OPERATIONAL_PERMISSION).not.toBe(
      WEOS_ARTIFACT_TYPES.READINESS_ASSESSMENT,
    );
    expect(
      WEOS_CANONICAL_ARTIFACT_CATALOGUE.DIAGNOSIS_OPERATIONAL_PERMISSION
        .candidateGovernedClassification,
    ).toBe('OPERATIONAL_RECORD');
  });

  it('keeps generatability permission distinct from generation readiness', () => {
    expect(WEOS_ARTIFACT_TYPES.DIAGNOSIS_OPERATIONAL_PERMISSION).not.toBe(
      WEOS_ARTIFACT_TYPES.DIAGNOSIS_OPERATION_READINESS,
    );
  });

  it('keeps onboarding progress distinct from readiness', () => {
    expect(WEOS_ARTIFACT_TYPES.DIAGNOSIS_ONBOARDING_PROGRESS).not.toBe(
      WEOS_ARTIFACT_TYPES.DIAGNOSIS_OPERATION_READINESS,
    );
  });

  it('keeps Publication Decision distinct from Publication Schedule', () => {
    expect(WEOS_ARTIFACT_TYPES.PUBLICATION_DECISION).not.toBe(
      WEOS_ARTIFACT_TYPES.PUBLICATION_SCHEDULE,
    );
  });

  it('keeps Publication Readiness Assessment distinct from Publication Decision', () => {
    expect(WEOS_ARTIFACT_TYPES.PUBLICATION_READINESS_ASSESSMENT).not.toBe(
      WEOS_ARTIFACT_TYPES.PUBLICATION_DECISION,
    );
    expect(
      WEOS_CANONICAL_ARTIFACT_CATALOGUE.PUBLICATION_READINESS_ASSESSMENT
        .currentImplementationSupport,
    ).toBe('NOT_IMPLEMENTED');
  });

  it('keeps Publication Assessment distinct from Publication Schedule', () => {
    expect(WEOS_ARTIFACT_TYPES.PUBLICATION_ASSESSMENT).not.toBe(
      WEOS_ARTIFACT_TYPES.PUBLICATION_SCHEDULE,
    );
    expect(
      WEOS_CANONICAL_ARTIFACT_CATALOGUE.PUBLICATION_ASSESSMENT
        .currentImplementationSupport,
    ).toBe('NOT_IMPLEMENTED');
  });

  it('keeps Publication History distinct from Publication Decision', () => {
    expect(WEOS_ARTIFACT_TYPES.PUBLICATION_HISTORY).not.toBe(
      WEOS_ARTIFACT_TYPES.PUBLICATION_DECISION,
    );
  });

  it('keeps Published Artifact Version distinct from mutable artifact identity', () => {
    expect(WEOS_ARTIFACT_TYPES.PUBLISHED_ARTIFACT_VERSION).not.toBe(
      WEOS_ARTIFACT_TYPES.CLINICAL_CASE,
    );
    expect(
      WEOS_CANONICAL_ARTIFACT_CATALOGUE.PUBLISHED_ARTIFACT_VERSION
        .currentImplementationSupport,
    ).toBe('NOT_IMPLEMENTED');
  });

  it('keeps Learner Exposure Reference distinct from Publication Decision', () => {
    expect(WEOS_ARTIFACT_TYPES.LEARNER_EXPOSURE_REFERENCE).not.toBe(
      WEOS_ARTIFACT_TYPES.PUBLICATION_DECISION,
    );
  });

  it('keeps AI Draft distinct from AI Draft Acceptance', () => {
    expect(WEOS_ARTIFACT_TYPES.AI_DRAFT).not.toBe(
      WEOS_ARTIFACT_TYPES.AI_DRAFT_ACCEPTANCE,
    );
  });

  it('keeps AI Draft acceptance from implying Controlled Application', () => {
    expect(WEOS_ARTIFACT_TYPES.AI_DRAFT_ACCEPTANCE).not.toBe(
      WEOS_ARTIFACT_TYPES.CONTROLLED_APPLICATION_RECORD,
    );
    expect(
      WEOS_CANONICAL_ARTIFACT_CATALOGUE.AI_DRAFT_ACCEPTANCE.approvalRequirement,
    ).toBe('NOT_REQUIRED');
  });

  it('keeps Clue Revision Draft distinct from Controlled Application', () => {
    expect(WEOS_ARTIFACT_TYPES.CLUE_REVISION_DRAFT).not.toBe(
      WEOS_ARTIFACT_TYPES.CONTROLLED_APPLICATION_RECORD,
    );
  });

  it('keeps Controlled Application from implying approval', () => {
    expect(
      WEOS_CANONICAL_ARTIFACT_CATALOGUE.CONTROLLED_APPLICATION_RECORD
        .approvalRequirement,
    ).toBe('NOT_REQUIRED');
  });

  it('keeps approval from implying publication', () => {
    expect(WEOS_ARTIFACT_TYPES.EDITORIAL_DECISION).not.toBe(
      WEOS_ARTIFACT_TYPES.PUBLICATION_DECISION,
    );
  });

  it('represents Material Change Determination without treating it as approval or publication', () => {
    const materialChange =
      WEOS_CANONICAL_ARTIFACT_CATALOGUE.MATERIAL_CHANGE_DETERMINATION;

    expect(materialChange).toBeDefined();
    expect(materialChange.currentAlignmentClassification).toBe(
      'PARTIALLY_ALIGNED',
    );
    expect(WEOS_ARTIFACT_TYPES.MATERIAL_CHANGE_DETERMINATION).not.toBe(
      WEOS_ARTIFACT_TYPES.EDITORIAL_DECISION,
    );
    expect(WEOS_ARTIFACT_TYPES.MATERIAL_CHANGE_DETERMINATION).not.toBe(
      WEOS_ARTIFACT_TYPES.PUBLICATION_DECISION,
    );
  });

  it('represents maintenance artifacts even when currently missing', () => {
    for (const key of [
      'MAINTENANCE_ASSESSMENT',
      'REVALIDATION_OBLIGATION',
      'REVIEW_DUE_DATE',
    ] as const) {
      expect(WEOS_CANONICAL_ARTIFACT_CATALOGUE[key]).toBeDefined();
      expect(
        WEOS_CANONICAL_ARTIFACT_CATALOGUE[key].currentImplementationSupport,
      ).toBe('NOT_IMPLEMENTED');
    }
  });

  it('does not assign ALIGNED solely because a current model exists', () => {
    const aligned = WEOS_CANONICAL_ARTIFACT_CATALOGUE_ENTRIES.filter(
      (entry) => entry.currentAlignmentClassification === 'ALIGNED',
    );

    expect(aligned).toHaveLength(0);
  });

  it('keeps candidate artifacts from claiming automatic authority', () => {
    const candidateEntries = WEOS_CANONICAL_ARTIFACT_CATALOGUE_ENTRIES.filter(
      (entry) =>
        entry.candidateGovernedClassification === 'CANDIDATE_KNOWLEDGE',
    );

    expect(candidateEntries.length).toBeGreaterThan(0);
    for (const entry of candidateEntries) {
      expect(entry.approvalRequirement).not.toBe('NOT_REQUIRED');
      expect(entry.candidateGovernedClassification).not.toBe(
        'GOVERNED_KNOWLEDGE',
      );
    }
  });

  it('does not contain duplicate canonical keys', () => {
    const keys = WEOS_CANONICAL_ARTIFACT_CATALOGUE_ENTRIES.map(
      (entry) => entry.canonicalType,
    );

    expect(new Set(keys).size).toBe(keys.length);
  });

  it('does not describe Case aggregate divergence as row mutability alone', () => {
    const caseEntry = WEOS_CANONICAL_ARTIFACT_CATALOGUE.CLINICAL_CASE;
    const divergenceText = caseEntry.knownDivergences.join(' ');

    expect(divergenceText).toContain(
      'independently mutable source used by governance',
    );
    expect(divergenceText).not.toMatch(/divergent solely because/i);
  });

  it('does not base Clinical Clue divergence solely on JSON storage', () => {
    const clueEntry = WEOS_CANONICAL_ARTIFACT_CATALOGUE.CLINICAL_CLUE;
    const divergenceText = clueEntry.knownDivergences.join(' ');

    expect(divergenceText).toContain('JSON storage is not itself the issue');
    expect(divergenceText).toContain('revision-aware clue keys');
  });

  it('keeps limited repository absence claims scoped in WEOS docs', () => {
    const docs = [
      join(
        process.cwd(),
        '..',
        'docs',
        'weos',
        'WEOS-IMP-001-current-to-canonical-mapping.md',
      ),
      join(
        process.cwd(),
        '..',
        'docs',
        'weos',
        'WEOS-IMP-001-divergence-register.md',
      ),
    ]
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n');

    expect(docs).not.toContain('No first-class model found');
    expect(docs).not.toContain('No first-class models found');
    expect(docs).not.toContain('no first-class source model found');
    expect(docs).toContain(
      'Repository absence does not prove absence from external operational/manual governance processes.',
    );
  });
});
