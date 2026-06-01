import {
  DiagnosisEducationStatus,
  DiagnosisGraphCandidateStatus,
} from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';
import { DiagnosisCurriculumProviderService } from '../education/diagnosis-curriculum-provider.service';
import { EducationTeachingRulesService } from '../education/education-teaching-rules.service';
import { TeachingUnitCoverageService } from './teaching-unit-coverage.service';

describe('TeachingUnitCoverageService', () => {
  let prisma: { diagnosisRegistry: { findUnique: jest.Mock } };
  let service: TeachingUnitCoverageService;

  beforeEach(() => {
    prisma = { diagnosisRegistry: { findUnique: jest.fn() } };
    service = new TeachingUnitCoverageService(
      prisma as unknown as PrismaService,
      new DiagnosisCurriculumProviderService(),
    );
  });

  it('marks a teaching unit fully covered', async () => {
    prisma.diagnosisRegistry.findUnique.mockResolvedValue(
      registry({
        educationText: 'Migratory periumbilical pain localizes to the RLQ.',
        cases: [caseWithUnit('migratory_rlq_pain')],
        graphFacts: [{ id: 'fact-1', label: 'Migratory RLQ pain', normalizedLabel: 'migratory rlq pain', payload: null }],
      }),
    );

    const result = await service.getCoverage('registry-1');
    const unit = result.teachingUnits.find((item) => item.id === 'migratory_rlq_pain');

    expect(unit).toEqual(
      expect.objectContaining({
        source: 'legacy_teaching_rules',
        educationCoverage: 'covered',
        graphCoverage: 'covered',
        recommendedAction: 'Ready',
      }),
    );
    expect(unit?.caseCoverage.count).toBe(1);
  });

  it('uses the same teaching unit inventory as legacy teaching rules', async () => {
    prisma.diagnosisRegistry.findUnique.mockResolvedValue(
      registry({
        educationText: 'Generic abdominal pain education.',
        cases: [],
        graphFacts: [],
      }),
    );

    const result = await service.getCoverage('registry-1');
    const legacyIds =
      new EducationTeachingRulesService()
        .getRules({ canonicalName: 'appendicitis' })
        ?.teachingUnits.map((unit) => unit.id) ?? [];

    expect(result.teachingUnits.map((unit) => unit.id)).toEqual(legacyIds);
  });

  it('recommends education work when education coverage is missing', async () => {
    prisma.diagnosisRegistry.findUnique.mockResolvedValue(
      registry({
        educationText: 'Generic abdominal pain education.',
        cases: [caseWithUnit('migratory_rlq_pain')],
        graphFacts: [{ id: 'fact-1', label: 'Migratory RLQ pain', normalizedLabel: 'migratory rlq pain', payload: null }],
      }),
    );

    const unit = (await service.getCoverage('registry-1')).teachingUnits.find(
      (item) => item.id === 'migratory_rlq_pain',
    );

    expect(unit?.educationCoverage).toBe('missing');
    expect(unit?.recommendedAction).toBe('Add education pearl');
  });

  it('detects case-only coverage', async () => {
    prisma.diagnosisRegistry.findUnique.mockResolvedValue(
      registry({
        educationText: 'Generic abdominal pain education.',
        cases: [caseWithUnit('migratory_rlq_pain')],
        graphFacts: [],
      }),
    );

    const unit = (await service.getCoverage('registry-1')).teachingUnits.find(
      (item) => item.id === 'migratory_rlq_pain',
    );

    expect(unit?.caseCoverage.status).toBe('covered');
    expect(unit?.educationCoverage).toBe('missing');
    expect(unit?.graphCoverage).toBe('unknown');
  });

  it('detects graph-only coverage', async () => {
    prisma.diagnosisRegistry.findUnique.mockResolvedValue(
      registry({
        educationText: 'Generic abdominal pain education.',
        cases: [],
        graphFacts: [{ id: 'fact-1', label: 'Migratory RLQ pain', normalizedLabel: 'migratory rlq pain', payload: null }],
      }),
    );

    const unit = (await service.getCoverage('registry-1')).teachingUnits.find(
      (item) => item.id === 'migratory_rlq_pain',
    );

    expect(unit?.graphCoverage).toBe('covered');
    expect(unit?.caseCoverage.status).toBe('missing');
  });

  it('returns an empty fallback when no teaching rules exist', async () => {
    prisma.diagnosisRegistry.findUnique.mockResolvedValue({
      id: 'registry-2',
      canonicalName: 'rare unknown',
      displayLabel: 'Rare Unknown',
      aliases: [],
      education: null,
      cases: [],
      graphCandidates: [],
      graphFacts: [],
    });

    await expect(service.getCoverage('registry-2')).resolves.toEqual(
      expect.objectContaining({ teachingUnits: [] }),
    );
  });

  it('uses candidate coverage to recommend graph review sensibly', async () => {
    prisma.diagnosisRegistry.findUnique.mockResolvedValue(
      registry({
        educationText: 'Migratory periumbilical pain localizes to the RLQ.',
        cases: [caseWithUnit('migratory_rlq_pain')],
        graphCandidates: [
          {
            id: 'candidate-1',
            rawText: 'Migratory RLQ pain discriminator',
            normalizedText: 'migratory rlq pain discriminator',
            status: DiagnosisGraphCandidateStatus.CANDIDATE,
            payload: null,
          },
        ],
        graphFacts: [],
      }),
    );

    const unit = (await service.getCoverage('registry-1')).teachingUnits.find(
      (item) => item.id === 'migratory_rlq_pain',
    );

    expect(unit?.graphCoverage).toBe('covered');
    expect(unit?.relatedGraphFactIds).toContain('candidate-1');
  });

  it('reports persisted teaching rule source when provider returns persisted units', async () => {
    service = new TeachingUnitCoverageService(
      prisma as unknown as PrismaService,
      {
        getRules: jest.fn().mockResolvedValue({
          teachingUnits: [
            {
              id: 'persisted-unit',
              label: 'Persisted unit',
              category: 'recall_concept',
              importance: 'supporting',
              rationale: 'Persisted.',
              acceptableManifestations: ['persisted unit'],
              appliesToEducation: true,
              appliesToCaseGeneration: true,
              source: 'persisted_teaching_rule',
            },
          ],
        }),
      } as never,
    );
    prisma.diagnosisRegistry.findUnique.mockResolvedValue(
      registry({
        educationText: 'Persisted unit',
        cases: [],
        graphFacts: [],
      }),
    );

    const result = await service.getCoverage('registry-1');

    expect(result.teachingUnits[0].source).toBe('persisted_teaching_rule');
  });
});

function registry(input: {
  educationText: string;
  cases: unknown[];
  graphFacts: unknown[];
  graphCandidates?: unknown[];
}) {
  return {
    id: 'registry-1',
    canonicalName: 'appendicitis',
    displayLabel: 'Appendicitis',
    specialty: null,
    category: null,
    bodySystem: null,
    clinicalSetting: null,
    difficultyBand: null,
    aliases: [],
    education: {
      editorialStatus: DiagnosisEducationStatus.PUBLISHED,
      summary: { text: input.educationText },
      clinicalPattern: null,
      keySymptoms: null,
      keySigns: null,
      examPearls: null,
      scoringSystems: null,
      investigations: null,
      differentials: null,
      management: null,
      complications: null,
      pitfalls: null,
      recallPrompts: null,
    },
    cases: input.cases,
    graphCandidates: input.graphCandidates ?? [],
    graphFacts: input.graphFacts,
  };
}

function caseWithUnit(id: string) {
  return {
    id: 'case-1',
    explanation: {
      generationQuality: {
        teachingAlignment: {
          selectedUnits: [{ id, label: id, importance: 'critical', covered: true }],
        },
      },
    },
  };
}
