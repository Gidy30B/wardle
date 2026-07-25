import {
  WEOS_ALIGNMENT_CLASSIFICATIONS,
  WEOS_GOVERNANCE_SEVERITIES,
  WEOS_IMPLEMENTATION_SUPPORT,
} from './canonical-concepts';
import {
  WEOS_ARTIFACT_TYPES,
  WEOS_CANONICAL_ARTIFACT_CATALOGUE,
  WEOS_CANONICAL_ARTIFACT_CATALOGUE_ENTRIES,
  WEOS_KNOWLEDGE_STANDINGS,
  WEOS_RECORD_KINDS,
  WEOS_VERSIONING_MODES,
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

  it('uses canonical shared taxonomies instead of local duplicate values', () => {
    const alignments = Object.values(WEOS_ALIGNMENT_CLASSIFICATIONS);
    const severities = Object.values(WEOS_GOVERNANCE_SEVERITIES);
    const support = Object.values(WEOS_IMPLEMENTATION_SUPPORT);
    const versioningModes = Object.values(WEOS_VERSIONING_MODES);
    const knowledgeStandings = Object.values(WEOS_KNOWLEDGE_STANDINGS);
    const recordKinds = Object.values(WEOS_RECORD_KINDS);

    for (const entry of WEOS_CANONICAL_ARTIFACT_CATALOGUE_ENTRIES) {
      expect(entry.canonicalPurpose.trim().length).toBeGreaterThan(0);
      expect(alignments).toContain(entry.currentAlignmentClassification);
      expect(severities).toContain(entry.severity);
      expect(support).toContain(entry.currentImplementationSupport);
      expect(versioningModes).toContain(entry.versioningMode);
      expect(knowledgeStandings).toContain(entry.knowledgeStanding);
      expect(recordKinds).toContain(entry.recordKind);
    }
  });

  it('keeps implemented revision models separate from revision carriers and symbols', () => {
    const revisioned = WEOS_CANONICAL_ARTIFACT_CATALOGUE_ENTRIES.filter(
      (entry) =>
        entry.versioningMode === WEOS_VERSIONING_MODES.REVISIONED_ARTIFACT &&
        entry.currentImplementationSupport !==
          WEOS_IMPLEMENTATION_SUPPORT.NOT_IMPLEMENTED,
    );

    expect(revisioned.length).toBeGreaterThan(0);
    for (const entry of revisioned) {
      expect(
        entry.currentRevisionModels.length +
          entry.currentRevisionCarriers.length,
      ).toBeGreaterThan(0);
      for (const model of entry.currentPrismaModels) {
        expect(model).not.toContain('.');
        expect(model).not.toContain('/');
      }
      for (const model of entry.currentRevisionModels) {
        expect(model).not.toContain('.');
        expect(model).not.toContain('/');
      }
    }
  });

  it('keeps source context, review, validation, projection, and audit records distinct', () => {
    expect(
      WEOS_CANONICAL_ARTIFACT_CATALOGUE.REVIEW_PACKET_SNAPSHOT.recordKind,
    ).toBe(WEOS_RECORD_KINDS.SOURCE_CONTEXT_RECORD);
    expect(WEOS_CANONICAL_ARTIFACT_CATALOGUE.EDITORIAL_REVIEW.recordKind).toBe(
      WEOS_RECORD_KINDS.REVIEW_RECORD,
    );
    expect(WEOS_CANONICAL_ARTIFACT_CATALOGUE.VALIDATION_RESULT.recordKind).toBe(
      WEOS_RECORD_KINDS.VALIDATION_RECORD,
    );
    expect(
      WEOS_CANONICAL_ARTIFACT_CATALOGUE.PUBLICATION_HISTORY.recordKind,
    ).toBe(WEOS_RECORD_KINDS.PROJECTION);
    expect(WEOS_CANONICAL_ARTIFACT_CATALOGUE.RELEASE_EVENT.recordKind).toBe(
      WEOS_RECORD_KINDS.AUDIT_EVENT,
    );
  });

  it('classifies candidate knowledge without implying governed approval', () => {
    const candidateEntries = WEOS_CANONICAL_ARTIFACT_CATALOGUE_ENTRIES.filter(
      (entry) => entry.knowledgeStanding === WEOS_KNOWLEDGE_STANDINGS.CANDIDATE,
    );

    expect(candidateEntries.length).toBeGreaterThan(0);
    for (const entry of candidateEntries) {
      expect(entry.recordKind).toBe(WEOS_RECORD_KINDS.KNOWLEDGE_ARTIFACT);
      expect(entry.knowledgeStanding).not.toBe(
        WEOS_KNOWLEDGE_STANDINGS.GOVERNED,
      );
    }
  });

  it('keeps version-targeted records from being revisioned artifacts', () => {
    const versionTargetedRecords =
      WEOS_CANONICAL_ARTIFACT_CATALOGUE_ENTRIES.filter(
        (entry) =>
          entry.versioningMode ===
          WEOS_VERSIONING_MODES.VERSION_TARGETED_RECORD,
      );

    expect(versionTargetedRecords.length).toBeGreaterThan(0);
    for (const entry of versionTargetedRecords) {
      expect(entry.versioningMode).not.toBe(
        WEOS_VERSIONING_MODES.REVISIONED_ARTIFACT,
      );
    }
  });

  it('keeps triggers, obligations, and technical governance artifacts out of decision semantics', () => {
    for (const key of [
      'EVIDENCE_REFRESH_TRIGGER',
      'GUIDELINE_CHANGE_TRIGGER',
    ] as const) {
      expect(WEOS_CANONICAL_ARTIFACT_CATALOGUE[key].recordKind).toBe(
        WEOS_RECORD_KINDS.TRIGGER,
      );
      expect(
        WEOS_CANONICAL_ARTIFACT_CATALOGUE[key].decisionRequirement,
      ).not.toBe('REQUIRED');
    }

    for (const key of ['REVIEW_DUE_DATE', 'REVALIDATION_OBLIGATION'] as const) {
      expect(WEOS_CANONICAL_ARTIFACT_CATALOGUE[key].recordKind).toBe(
        WEOS_RECORD_KINDS.OBLIGATION,
      );
      expect(
        WEOS_CANONICAL_ARTIFACT_CATALOGUE[key].decisionRequirement,
      ).not.toBe('REQUIRED');
    }
  });

  it('preserves corrected divergence statements for Case and clue identity', () => {
    expect(
      WEOS_CANONICAL_ARTIFACT_CATALOGUE.CLINICAL_CASE.knownDivergences.join(
        ' ',
      ),
    ).toContain('independently mutable source used by governance');
    expect(
      WEOS_CANONICAL_ARTIFACT_CATALOGUE.CLINICAL_CLUE.knownDivergences.join(
        ' ',
      ),
    ).toContain('JSON storage is not itself the issue');
  });
});
