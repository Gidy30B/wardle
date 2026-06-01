import { NotFoundException } from '@nestjs/common';
import {
  DiagnosisEducationSource,
  DiagnosisEducationStatus,
} from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';
import { EducationRevisionQualityAnalyzer } from './education-revision-quality-analyzer.service';

describe('EducationRevisionQualityAnalyzer', () => {
  let prisma: { diagnosisRegistry: { findUnique: jest.Mock } };
  let analyzer: EducationRevisionQualityAnalyzer;

  beforeEach(() => {
    prisma = {
      diagnosisRegistry: {
        findUnique: jest.fn(),
      },
    };
    analyzer = new EducationRevisionQualityAnalyzer(prisma as unknown as PrismaService);
  });

  it('includes quality summary when listing revisions', async () => {
    prisma.diagnosisRegistry.findUnique.mockResolvedValue(
      registryWithRevisions([
        revision(2, buildDraft()),
        revision(1, buildDraft({ differentials: [weakDifferential()] })),
      ]),
    );

    const result = await analyzer.listRevisions('diagnosis-1');

    expect(result.revisions).toHaveLength(2);
    expect(result.revisions[0]).toEqual(
      expect.objectContaining({
        version: 2,
        quality: expect.objectContaining({
          overallScore: expect.any(Number),
          graphReadiness: expect.any(Number),
          sectionScores: expect.objectContaining({
            differentials: expect.any(Number),
          }),
          coverageScores: expect.objectContaining({
            overall: expect.any(Number),
          }),
          patternComplianceScores: expect.any(Object),
          sectionHealth: expect.any(Array),
          warningCount: expect.any(Number),
          blockerCount: expect.any(Number),
        }),
      }),
    );
  });

  it('returns analyzer output for a single revision', async () => {
    prisma.diagnosisRegistry.findUnique.mockResolvedValue(
      registryWithRevisions([revision(1, buildDraft())]),
    );

    const result = await analyzer.getRevision('diagnosis-1', 1);

    expect(result.version).toBe(1);
    expect(result.quality.blockers).toEqual(expect.any(Array));
    expect(result.quality.sectionHealth).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ section: 'differentials' }),
      ]),
    );
  });

  it('compares revisions and detects blocker removal', async () => {
    prisma.diagnosisRegistry.findUnique.mockResolvedValue(
      registryWithRevisions([
        revision(2, buildDraft()),
        revision(1, buildDraft({ differentials: [weakDifferential()] })),
      ]),
    );

    const result = await analyzer.compareRevisions('diagnosis-1', 1, 2);

    expect(result.blockerChanges.removed).toContain(
      'no_comparative_differentials',
    );
    expect(result.summary.improvements).toEqual(
      expect.arrayContaining([
        'Blocker removed: no_comparative_differentials',
      ]),
    );
  });

  it('compares revisions and detects section regression', async () => {
    prisma.diagnosisRegistry.findUnique.mockResolvedValue(
      registryWithRevisions([
        revision(2, buildDraft({ investigations: [weakInvestigation()] })),
        revision(1, buildDraft()),
      ]),
    );

    const result = await analyzer.compareRevisions('diagnosis-1', 1, 2);

    expect(result.sectionChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          section: 'investigations',
          direction: 'regressed',
        }),
      ]),
    );
    expect(result.summary.regressions).toEqual(
      expect.arrayContaining(['investigations regressed']),
    );
  });

  it('returns an empty revision list when education is missing', async () => {
    prisma.diagnosisRegistry.findUnique.mockResolvedValue({
      id: 'diagnosis-1',
      canonicalName: 'appendicitis',
      displayLabel: 'Appendicitis',
      aliases: [],
      education: null,
    });

    await expect(analyzer.listRevisions('diagnosis-1')).resolves.toEqual({
      diagnosisRegistryId: 'diagnosis-1',
      revisions: [],
    });
  });

  it('throws a safe not found error for a missing revision', async () => {
    prisma.diagnosisRegistry.findUnique.mockResolvedValue(
      registryWithRevisions([revision(1, buildDraft())]),
    );

    await expect(analyzer.getRevision('diagnosis-1', 99)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

function registryWithRevisions(revisions: ReturnType<typeof revision>[]) {
  return {
    id: 'diagnosis-1',
    canonicalName: 'appendicitis',
    displayLabel: 'Appendicitis',
    specialty: null,
    category: null,
    bodySystem: null,
    clinicalSetting: null,
    difficultyBand: null,
    aliases: [],
    education: {
      id: 'education-1',
      revisions,
    },
  };
}

function revision(version: number, snapshot: Record<string, unknown>) {
  return {
    id: `revision-${version}`,
    educationId: 'education-1',
    version,
    snapshot,
    editorialStatus: DiagnosisEducationStatus.NEEDS_REVIEW,
    source: DiagnosisEducationSource.AI_ASSISTED,
    createdByUserId: 'user-1',
    createdAt: new Date(`2026-01-0${version}T00:00:00.000Z`),
  };
}

function weakDifferential() {
  return {
    id: 'weak-mimic',
    type: 'HIGH_YIELD_DISCRIMINATOR',
    title: 'Gastroenteritis',
    content: 'Gastroenteritis can cause abdominal pain and vomiting.',
    whyItMatters: 'It is a common alternative diagnosis.',
  };
}

function weakInvestigation() {
  return {
    id: 'weak-cbc',
    type: 'INVESTIGATION',
    title: 'CBC',
    content: 'CBC can help evaluate the patient.',
    whyItMatters: 'It is useful.',
  };
}

function buildDraft(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Appendicitis',
    summary: {
      definition: 'Acute appendiceal inflammation.',
      highYieldTakeaway:
        'Migratory pain and peritoneal irritation distinguish appendicitis from mimics.',
    },
    clinicalPattern: [
      {
        id: 'pattern',
        type: 'PATTERN_RECOGNITION',
        title: 'Migratory pain pattern',
        content:
          'Migratory periumbilical pain to right lower quadrant tenderness favors appendicitis rather than diffuse gastroenteritis.',
        whyItMatters:
          'Progressive localization raises probability of appendiceal inflammation.',
      },
    ],
    keySymptoms: [
      {
        finding: 'Migratory abdominal pain',
        whyItMatters:
          'Migration favors appendicitis over transient diffuse cramps.',
        diagnosticImpact: 'Raises suspicion for appendicitis.',
        discriminator: 'Localizing trajectory rather than diffuse symptoms.',
      },
    ],
    keySigns: [
      {
        finding: 'McBurney point tenderness',
        whyItMatters:
          'Focal tenderness supports appendiceal irritation over gastroenteritis.',
        diagnosticImpact: 'Raises concern for appendicitis.',
        discriminator: 'Focal RLQ tenderness rather than diffuse tenderness.',
      },
    ],
    examPearls: [
      {
        id: 'rovsing',
        type: 'EXAM',
        title: 'Rovsing sign',
        content:
          'Left-sided palpation can reproduce right lower quadrant pain because peritoneal irritation is transmitted to the inflamed appendix.',
        whyItMatters:
          'A positive maneuver favors peritoneal irritation over nonspecific abdominal pain.',
        discriminator:
          'Reproduced focal pain rather than generalized discomfort.',
      },
    ],
    scoringSystems: [],
    investigations: [
      {
        id: 'ct',
        type: 'INVESTIGATION',
        title: 'CT abdomen',
        content:
          'CT showing an enlarged appendix with periappendiceal fat stranding confirms focal inflammation and argues against renal colic.',
        whyItMatters:
          'Positive imaging supports operative planning; negative imaging lowers probability when the exam is equivocal.',
        managementImplication:
          'Use CT when diagnostic uncertainty persists or complications are suspected.',
      },
    ],
    differentials: [
      {
        id: 'gastroenteritis',
        type: 'HIGH_YIELD_DISCRIMINATOR',
        title: 'Gastroenteritis',
        content:
          'Gastroenteritis overlaps with vomiting and abdominal pain, unlike appendicitis which progressively localizes to RLQ tenderness.',
        whyItMatters:
          'Both can start nonspecifically, so explicit contrast prevents anchoring.',
        discriminator:
          'Diffuse diarrhea-predominant illness rather than migratory RLQ pain.',
        managementImplication:
          'Escalate imaging or surgical review when localization or peritonism appears.',
      },
    ],
    management: [
      {
        id: 'surgery',
        type: 'MANAGEMENT',
        title: 'Surgical consultation',
        content:
          'Consult surgery when appendicitis is suspected with focal RLQ tenderness, peritonism, or supportive imaging.',
        whyItMatters:
          'Early consultation reduces delay when definitive operative care is likely.',
        managementImplication:
          'Keep the patient NPO, give IV fluids and analgesia, and coordinate antibiotics if complicated disease is suspected.',
        escalationImplication:
          'Delayed escalation increases perforation risk.',
      },
    ],
    complications: ['Perforation and abscess can follow delayed diagnosis.'],
    pitfalls: [
      {
        id: 'normal-wbc',
        type: 'PITFALL',
        title: 'Normal early WBC',
        content:
          'A normal early white blood cell count can falsely reassure before inflammatory markers peak.',
        whyItMatters:
          'The trap delays reassessment and increases missed perforation risk.',
        trapAvoided:
          'Reassess trajectory and exam localization instead of ruling out disease from one early normal result.',
      },
    ],
    recallPrompts: [
      {
        id: 'migration',
        type: 'WHY_IT_MATTERS',
        prompt:
          'Why does pain migration favor appendicitis rather than gastroenteritis?',
        answer:
          'Migration reflects visceral irritation localizing to parietal peritoneal inflammation.',
        explanation:
          'The trajectory distinguishes evolving focal disease from diffuse self-limited illness.',
        linkedConcept: 'migratory pain',
        sourceSection: 'clinicalPattern',
        difficulty: 'INTERMEDIATE',
      },
    ],
    references: ['Internal editorial draft'],
    ...overrides,
  };
}
