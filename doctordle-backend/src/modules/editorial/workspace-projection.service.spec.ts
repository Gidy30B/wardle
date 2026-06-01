import {
  CaseEditorialStatus,
  DiagnosisEducationSource,
  DiagnosisEducationStatus,
  DiagnosisGraphCandidateStatus,
  DiagnosisGraphCandidateType,
  DiagnosisGraphFactStatus,
} from '@prisma/client';
import { WorkspaceProjectionService } from './workspace-projection.service';

function buildService(registry: unknown) {
  const prisma = {
    diagnosisRegistry: {
      findUnique: jest.fn().mockResolvedValue(registry),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
    diagnosisEducation: {
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
    case: {
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
    diagnosisGraphCandidate: {
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
    diagnosisGraphFact: {
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
  };

  return {
    prisma,
    service: new WorkspaceProjectionService(prisma as never),
  };
}

describe('WorkspaceProjectionService', () => {
  it('returns missing education status when no education exists', async () => {
    const { service } = buildService(
      buildRegistry({
        education: null,
        cases: [],
        graphCandidates: [],
        graphFacts: [],
      }),
    );

    const projection = await service.getProjection('registry-1');

    expect(projection.education.status).toBe('missing');
    expect(projection.sourceSummary.hasEducation).toBe(false);
    expect(projection.readiness.missing).toContain('education');
    expect(projection.readiness.nextActions).toContain(
      'Generate education draft',
    );
  });

  it('includes a quality report for existing draft education', async () => {
    const { service } = buildService(
      buildRegistry({
        education: buildEducation(),
      }),
    );

    const projection = await service.getProjection('registry-1');

    expect(projection.education.status).toBe('draft');
    expect(projection.education.qualityReport?.scores).toEqual(
      expect.objectContaining({
        graphReadinessScore: expect.any(Number),
      }),
    );
    expect(projection.education.qualityReport?.sectionScores).toEqual(
      expect.objectContaining({
        differentials: expect.any(Number),
      }),
    );
    expect(projection.education.qualityReport?.coverageScores).toEqual(
      expect.objectContaining({
        overall: expect.any(Number),
      }),
    );
    expect(projection.education.qualityReport?.patternComplianceScores).toEqual(
      expect.objectContaining({
        overall: expect.any(Number),
      }),
    );
    expect(
      projection.education.qualityReport?.sectionFailureSummary,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          section: 'differentials',
          regenerationRecommended: expect.any(Boolean),
        }),
      ]),
    );
  });

  it('surfaces coverage warnings in the projection', async () => {
    const { service } = buildService(
      buildRegistry({
        education: buildEducation({
          differentials: [
            {
              mimic: 'Ectopic pregnancy',
              whyConfused:
                'Both can cause lower abdominal pain in relevant patients.',
              keySeparator:
                'Positive pregnancy testing favors ectopic pregnancy rather than appendicitis.',
              managementConsequence:
                'The distinction changes imaging and gynecology involvement.',
            },
          ],
        }),
      }),
    );

    const projection = await service.getProjection('registry-1');

    expect(projection.education.qualityReport?.warnings).toContain(
      'missing_required_differential',
    );
    expect(projection.education.qualityReport?.coverageWarnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'missing_required_differential',
          item: 'Gastroenteritis discriminator',
          section: 'differentials',
        }),
      ]),
    );
    expect(
      projection.education.qualityReport?.coverageScores?.differentials,
    ).toBeLessThan(1);
  });

  it('groups case counts by editorial status', async () => {
    const { service } = buildService(
      buildRegistry({
        cases: [
          buildCase({
            id: 'case-1',
            editorialStatus: CaseEditorialStatus.APPROVED,
          }),
          buildCase({
            id: 'case-2',
            editorialStatus: CaseEditorialStatus.PUBLISHED,
          }),
          buildCase({
            id: 'case-3',
            editorialStatus: CaseEditorialStatus.NEEDS_EDIT,
          }),
        ],
      }),
    );

    const projection = await service.getProjection('registry-1');

    expect(projection.cases.total).toBe(3);
    expect(projection.cases.byStatus).toEqual(
      expect.objectContaining({
        APPROVED: 1,
        PUBLISHED: 1,
        NEEDS_EDIT: 1,
      }),
    );
    expect(projection.sourceSummary.approvedCaseCount).toBe(2);
    expect(projection.sourceSummary.publishedCaseCount).toBe(1);
  });

  it('groups graph candidates by type and status', async () => {
    const { service } = buildService(
      buildRegistry({
        graphFacts: [],
        graphCandidates: [
          buildCandidate({
            type: DiagnosisGraphCandidateType.MIMIC,
            status: DiagnosisGraphCandidateStatus.CANDIDATE,
          }),
          buildCandidate({
            type: DiagnosisGraphCandidateType.MIMIC,
            status: DiagnosisGraphCandidateStatus.APPROVED,
          }),
          buildCandidate({
            type: DiagnosisGraphCandidateType.PITFALL,
            status: DiagnosisGraphCandidateStatus.REJECTED,
          }),
        ],
      }),
    );

    const projection = await service.getProjection('registry-1');

    expect(projection.graph.candidates.byType).toEqual(
      expect.objectContaining({
        MIMIC: 2,
        PITFALL: 1,
      }),
    );
    expect(projection.graph.candidates.byStatus).toEqual(
      expect.objectContaining({
        CANDIDATE: 1,
        APPROVED: 1,
        REJECTED: 1,
      }),
    );
    expect(projection.graph.readiness).toBe('review_needed');
  });

  it('sets readiness next actions from current workspace state', async () => {
    const { service } = buildService(
      buildRegistry({
        education: null,
        cases: [],
        graphCandidates: [],
        graphFacts: [],
      }),
    );

    const projection = await service.getProjection('registry-1');

    expect(projection.readiness.generationReady).toBe(true);
    expect(projection.readiness.educationReadyForReview).toBe(false);
    expect(projection.readiness.publishReady).toBe(false);
    expect(projection.readiness.graphReady).toBe(false);
    expect(projection.readiness.nextActions).toEqual(
      expect.arrayContaining([
        'Generate education draft',
        'Generate more cases',
        'Promote graph facts',
      ]),
    );
  });

  it('does not perform database writes', async () => {
    const { prisma, service } = buildService(buildRegistry());

    await service.getProjection('registry-1');

    expect(prisma.diagnosisRegistry.create).not.toHaveBeenCalled();
    expect(prisma.diagnosisRegistry.update).not.toHaveBeenCalled();
    expect(prisma.diagnosisEducation.create).not.toHaveBeenCalled();
    expect(prisma.diagnosisEducation.update).not.toHaveBeenCalled();
    expect(prisma.case.create).not.toHaveBeenCalled();
    expect(prisma.case.update).not.toHaveBeenCalled();
    expect(prisma.diagnosisGraphCandidate.create).not.toHaveBeenCalled();
    expect(prisma.diagnosisGraphCandidate.update).not.toHaveBeenCalled();
    expect(prisma.diagnosisGraphFact.create).not.toHaveBeenCalled();
    expect(prisma.diagnosisGraphFact.update).not.toHaveBeenCalled();
  });
});

function buildRegistry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'registry-1',
    displayLabel: 'Appendicitis',
    canonicalName: 'appendicitis',
    specialty: 'General Surgery',
    difficultyBand: 'BASIC',
    aliases: [{ term: 'Acute appendicitis' }],
    education: buildEducation(),
    cases: [buildCase()],
    graphCandidates: [buildCandidate()],
    graphFacts: [buildFact()],
    ...overrides,
  };
}

function buildEducation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'education-1',
    version: 1,
    editorialStatus: DiagnosisEducationStatus.DRAFT,
    source: DiagnosisEducationSource.MANUAL,
    updatedAt: new Date('2026-05-01T00:00:00.000Z'),
    summary: {
      definition: 'Appendicitis is acute inflammation of the appendix.',
      highYieldTakeaway:
        'Migratory focal pain and peritoneal signs drive diagnostic reasoning.',
    },
    clinicalPattern: [
      {
        id: 'illness-script',
        type: 'PATTERN_RECOGNITION',
        title: 'Illness script',
        content:
          'Migratory periumbilical pain to right lower quadrant tenderness favors appendicitis because visceral irritation localizes as parietal peritoneum becomes inflamed.',
        whyItMatters:
          'The tempo distinguishes appendicitis from diffuse gastroenteritis.',
      },
    ],
    keySymptoms: [
      {
        finding: 'Migratory periumbilical pain',
        whyItMatters:
          'Migration favors appendicitis over transient diffuse cramps.',
        diagnosticImpact: 'Raises suspicion for appendicitis.',
        discriminator: 'Diffuse diarrhea-predominant illness argues against it.',
      },
    ],
    keySigns: [
      {
        finding: 'McBurney point tenderness',
        whyItMatters:
          'McBurney tenderness supports local appendiceal irritation.',
        diagnosticImpact: 'Raises suspicion for appendicitis.',
        discriminator: 'Diffuse tenderness is less specific.',
      },
      {
        finding: 'Rovsing sign',
        whyItMatters:
          'Rovsing sign supports peritoneal irritation rather than uncomplicated gastroenteritis.',
        diagnosticImpact: 'Raises concern for appendicitis.',
        discriminator: 'Gastroenteritis is less likely to produce focal peritonism.',
      },
    ],
    examPearls: [
      {
        finding: 'Rovsing sign',
        mechanism:
          'Left lower quadrant palpation produces right lower quadrant pain because inflamed peritoneum is irritated.',
        diagnosticImpact:
          'Favors appendicitis over diffuse gastroenteritis when symptoms localize.',
        discriminator:
          'Diffuse gastroenteritis should not reproduce focal contralateral peritoneal pain.',
      },
      {
        finding: 'Psoas sign',
        mechanism:
          'Hip extension stretches the psoas and produces pain because a retrocecal appendix irritates the muscle.',
        diagnosticImpact:
          'Favors retrocecal appendicitis when anterior McBurney tenderness is muted.',
        discriminator: 'Renal colic does not follow this maneuver.',
      },
    ],
    scoringSystems: [
      {
        id: 'alvarado',
        name: 'Alvarado score',
        use: 'Structures appendicitis probability using MANTRELS features.',
        components: ['Migration', 'Anorexia', 'Nausea'],
        caution: 'Use alongside clinical judgment and imaging.',
      },
    ],
    investigations: [
      {
        test: 'CBC',
        expectedFinding: 'Neutrophilic leukocytosis.',
        interpretation:
          'Leukocytosis supports appendiceal inflammation with migratory focal pain.',
        limitation:
          'A normal early white blood cell count does not exclude appendicitis.',
      },
      {
        test: 'CT abdomen',
        expectedFinding: 'Appendiceal enlargement with periappendiceal inflammation.',
        interpretation:
          'Anatomy-specific inflammation supports appendicitis over renal colic.',
        limitation: 'Pregnancy status changes imaging choices.',
      },
      {
        test: 'Pregnancy test',
        expectedFinding: 'Positive or negative pregnancy status.',
        interpretation:
          'A positive result raises ectopic pregnancy concern before imaging.',
        limitation: 'A negative result does not exclude appendicitis.',
      },
    ],
    differentials: [
      {
        mimic: 'Gastroenteritis',
        whyConfused:
          'Both can cause abdominal pain, nausea, and vomiting early.',
        keySeparator:
          'Migratory focal right lower quadrant tenderness with peritonism favors appendicitis, whereas diffuse cramps with diarrhea favor gastroenteritis.',
        managementConsequence:
          'Peritoneal signs should prompt surgical evaluation rather than hydration-only management.',
      },
      {
        mimic: 'Renal colic',
        whyConfused: 'Both can present with severe right-sided abdominal pain.',
        keySeparator:
          'Flank-to-groin pain and hematuria favor renal colic, whereas McBurney tenderness and Rovsing sign favor appendicitis.',
        managementConsequence:
          'The distinction changes imaging, analgesia, and surgical urgency.',
      },
    ],
    management: [
      {
        action: 'Surgical consultation',
        indication:
          'Focal peritonism, supportive Alvarado score, or CT evidence.',
        rationale:
          'Early surgical assessment aligns diagnostic certainty with source control.',
        consequenceIfDelayed: 'Delay increases perforation risk.',
      },
      {
        action: 'NPO status and IV fluids',
        indication: 'Suspected appendicitis while awaiting operative planning.',
        rationale:
          'Stabilizes hydration and preserves readiness for operative care.',
        consequenceIfDelayed:
          'Poor preparation can slow definitive care if appendicitis is confirmed.',
      },
    ],
    complications: ['Perforation', 'Abscess'],
    pitfalls: [
      {
        trap: 'Normal early white blood cell count',
        whyMissed:
          'Clinicians may over-weight a normal CBC before markers rise.',
        consequence:
          'False reassurance delays reassessment and can increase perforation risk.',
        saferHeuristic:
          'Reassess evolving focal tenderness even when early labs are normal.',
      },
      {
        trap: 'Retrocecal appendix',
        whyMissed:
          'Anterior guarding may be muted when the appendix sits retrocecally.',
        consequence:
          'A limited exam can miss appendicitis and delay surgical review.',
        saferHeuristic:
          'Use psoas irritation and pain progression when McBurney tenderness is absent.',
      },
    ],
    recallPrompts: [
      {
        id: 'distinguish-gastroenteritis',
        type: 'DISTINGUISH',
        prompt:
          'What feature distinguishes gastroenteritis from appendicitis?',
        answer:
          'Migratory right lower quadrant peritonism favors appendicitis.',
        explanation:
          'This distinguishes gastroenteritis from appendicitis by localization.',
        linkedConcept: 'distinguish gastroenteritis from appendicitis',
        sourceSection: 'differentials',
        difficulty: 'INTERMEDIATE',
      },
      {
        id: 'normal-wbc',
        type: 'WHY_IT_MATTERS',
        prompt: 'Why does a normal early WBC not exclude appendicitis?',
        answer:
          'Early appendicitis can precede leukocytosis, so evolving focal signs still matter.',
        explanation:
          'This avoids false reassurance from a normal early WBC.',
        linkedConcept: 'normal early WBC does not exclude appendicitis',
        sourceSection: 'pitfalls',
        difficulty: 'INTERMEDIATE',
      },
    ],
    references: ['Educational source'],
    ...overrides,
  };
}

function buildCase(overrides: Record<string, unknown> = {}) {
  return {
    id: 'case-1',
    title: 'Migratory abdominal pain',
    editorialStatus: CaseEditorialStatus.APPROVED,
    difficulty: 'medium',
    date: new Date('2026-05-02T00:00:00.000Z'),
    ...overrides,
  };
}

function buildCandidate(overrides: Record<string, unknown> = {}) {
  return {
    id: 'candidate-1',
    type: DiagnosisGraphCandidateType.MIMIC,
    status: DiagnosisGraphCandidateStatus.CANDIDATE,
    promotedFactId: null,
    ...overrides,
  };
}

function buildFact(overrides: Record<string, unknown> = {}) {
  return {
    id: 'fact-1',
    type: DiagnosisGraphCandidateType.FINDING,
    status: DiagnosisGraphFactStatus.ACTIVE,
    ...overrides,
  };
}
