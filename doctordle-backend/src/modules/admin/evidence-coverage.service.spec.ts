import {
  CaseEditorialStatus,
  ClinicalCategory,
  DiagnosisEditorialOnboardingStatus,
  DiagnosisEvidenceRelationshipType,
  DiagnosisGraphCandidateType,
  DiagnosisRegistryStatus,
  EvidenceType,
} from '@prisma/client';
import { EvidenceCoverageService } from './evidence-coverage.service';

const baseRelationship = {
  id: 'relationship-1',
  relationshipType: DiagnosisEvidenceRelationshipType.DISCRIMINATES,
  strength: 4,
  discriminatorWeight: 4,
  reasoningSummary: 'Free air separates perforated viscus from uncomplicated gastritis',
  contradictoryDiagnosisIds: ['registry-2'],
  supportingTeachingRelationshipId: 'teaching-relationship-1',
  supportingTeachingRuleId: 'rule-1',
  supportingCaseId: 'case-1',
  evidenceNode: {
    id: 'node-1',
    normalizedKey: 'free air under diaphragm',
    displayLabel: 'Free air under diaphragm',
    evidenceType: EvidenceType.IMAGING,
    clinicalCategory: ClinicalCategory.GI,
  },
};

function buildRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'registry-1',
    canonicalName: 'Perforated viscus',
    displayLabel: 'Perforated viscus',
    specialty: 'Surgery',
    bodySystem: 'Gastrointestinal',
    category: 'Emergency',
    onboardingStatus: DiagnosisEditorialOnboardingStatus.COMPLETE,
    status: DiagnosisRegistryStatus.ACTIVE,
    active: true,
    isPlayable: true,
    isGeneratable: true,
    education: {
      editorialStatus: 'PUBLISHED',
      summary: 'Free air under diaphragm suggests perforation.',
      clinicalPattern: null,
      keySymptoms: ['abdominal pain'],
      keySigns: ['peritonitis'],
      examPearls: [],
      investigations: ['upright chest x-ray shows free air under diaphragm'],
      differentials: [],
      management: ['urgent surgery'],
      complications: ['sepsis'],
      pitfalls: [],
      recallPrompts: [],
    },
    teachingRules: [
      {
        id: 'rule-1',
        title: 'Imaging discriminator',
        category: 'investigation_concept',
        rationale: 'Free air under diaphragm is a key discriminator.',
        acceptableManifestations: ['free air'],
        expectedEvidence: ['free air under diaphragm'],
        requiredDifferentials: ['gastritis'],
        appliesToCaseGeneration: true,
        appliesToGraph: true,
        status: 'APPROVED',
      },
    ],
    cases: [
      {
        id: 'case-1',
        title: 'Acute abdomen',
        history: 'Sudden abdominal pain.',
        symptoms: ['abdominal pain'],
        labs: null,
        clues: [
          {
            type: 'imaging',
            value: 'Free air under diaphragm on upright chest x-ray',
          },
        ],
        explanation: null,
        editorialStatus: CaseEditorialStatus.READY_TO_PUBLISH,
        dailyCases: [],
      },
    ],
    graphFacts: [
      {
        id: 'fact-1',
        type: DiagnosisGraphCandidateType.MIMIC,
        targetDiagnosisRegistryId: 'registry-2',
      },
    ],
    sourceTeachingRelationships: [
      {
        id: 'teaching-relationship-1',
        relationshipType: 'MIMIC',
        teachingPurpose: 'DISCRIMINATION',
        discriminatorSummary: 'Free air under diaphragm separates this diagnosis.',
        commonConfusionReason: null,
        learnerPitfall: null,
        targetDiagnosisRegistryId: 'registry-2',
      },
    ],
    caseDifferentialLinks: [{ diagnosisRegistryId: 'registry-2' }],
    educationDifferentialLinks: [{ diagnosisRegistryId: 'registry-3' }],
    evidenceRelationships: [baseRelationship],
    ...overrides,
  };
}

function buildPrisma(rows = [buildRow()]) {
  return {
    diagnosisRegistry: {
      findMany: jest.fn().mockResolvedValue(rows),
    },
  };
}

describe('EvidenceCoverageService', () => {
  it('scores evidence coverage across cases, education, rules, and teaching relationships', async () => {
    const prisma = buildPrisma();
    const service = new EvidenceCoverageService(prisma as never);

    const [result] = await service.getDiagnoses();

    expect(result.coverageScore).toBeGreaterThanOrEqual(60);
    expect(result.coverageBreakdown.caseEvidenceCoverage).toBe(100);
    expect(result.coverageBreakdown.educationEvidenceCoverage).toBe(100);
    expect(result.coverageBreakdown.ruleEvidenceCoverage).toBe(100);
    expect(result.coverageBreakdown.teachingRelationshipEvidenceCoverage).toBe(100);
  });

  it('detects missing graph, discriminator, and source coverage', async () => {
    const prisma = buildPrisma([
      buildRow({
        evidenceRelationships: [],
        cases: [],
        education: null,
        teachingRules: [],
        sourceTeachingRelationships: [],
        graphFacts: [],
      }),
    ]);
    const service = new EvidenceCoverageService(prisma as never);

    const [result] = await service.getDiagnoses();

    expect(result.coverageScore).toBe(0);
    expect(result.coverageWeaknesses).toEqual(
      expect.arrayContaining([
        'missing_evidence_graph',
        'missing_discriminator_evidence',
        'missing_imaging_discriminator',
        'missing_lab_discriminator',
      ]),
    );
    expect(result.generationReadinessTier).toBe('weak');
  });

  it('detects overused evidence and low diversity', async () => {
    const cases = ['case-1', 'case-2', 'case-3'].map((id) => ({
      id,
      title: id,
      history: 'Free air under diaphragm.',
      symptoms: [],
      labs: null,
      clues: [{ type: 'imaging', value: 'Free air under diaphragm' }],
      explanation: null,
      editorialStatus: CaseEditorialStatus.READY_TO_PUBLISH,
      dailyCases: [],
    }));
    const prisma = buildPrisma([buildRow({ cases })]);
    const service = new EvidenceCoverageService(prisma as never);

    const [result] = await service.getDiagnoses();

    expect(result.coverageWeaknesses).toContain('overused_evidence_pattern');
    expect(result.coverageWeaknesses).toContain('weak_evidence_diversity');
    expect(result.redundancy.overusedEvidence[0]).toEqual(
      expect.objectContaining({
        evidenceKey: 'free air under diaphragm',
        count: 3,
      }),
    );
  });

  it('filters by weakness and readiness tier', async () => {
    const prisma = buildPrisma([
      buildRow(),
      buildRow({
        id: 'registry-weak',
        displayLabel: 'Weak diagnosis',
        evidenceRelationships: [],
      }),
    ]);
    const service = new EvidenceCoverageService(prisma as never);

    const results = await service.getDiagnoses({
      evidenceWeakness: 'missing_evidence_graph',
      readinessTier: 'weak',
    });

    expect(results).toHaveLength(1);
    expect(results[0].diagnosisRegistryId).toBe('registry-weak');
  });

  it('summarizes generation readiness without executing generation', async () => {
    const prisma = buildPrisma([
      buildRow(),
      buildRow({ id: 'registry-weak', evidenceRelationships: [] }),
    ]);
    const service = new EvidenceCoverageService(prisma as never);

    const overview = await service.getOverview();

    expect(overview.summary.diagnosisCount).toBe(2);
    expect(overview.generationReadiness.caseGenerationReady).toBeGreaterThanOrEqual(0);
    expect(prisma.diagnosisRegistry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ active: true }),
      }),
    );
  });
});
