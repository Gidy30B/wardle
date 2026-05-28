import {
  CaseEditorialStatus,
  DiagnosisEducationStatus,
  DiagnosisGraphCandidateType,
  DiagnosisGraphSourceType,
} from '@prisma/client';
import { DiagnosisGraphExtractionService } from './diagnosis-graph-extraction.service';

describe('DiagnosisGraphExtractionService', () => {
  const buildService = () => {
    const prisma = {
      case: {
        findFirst: jest.fn(),
      },
      diagnosisEducation: {
        findFirst: jest.fn(),
      },
      diagnosisRegistry: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn(),
      },
      diagnosisGraphCandidate: {
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    return {
      prisma,
      service: new DiagnosisGraphExtractionService(prisma as never),
    };
  };

  it('extracts candidates from approved cases', async () => {
    const { prisma, service } = buildService();
    prisma.case.findFirst.mockResolvedValue({
      id: 'case-1',
      diagnosisRegistryId: 'registry-1',
      editorialStatus: CaseEditorialStatus.APPROVED,
      currentRevision: { revisionNumber: 3 },
      clues: [
        { type: 'history', value: 'Nocturnal cough after exercise', order: 0 },
        { type: 'lab', value: 'FEV1 improves by 15%', order: 1 },
      ],
      differentials: ['COPD'],
      explanation: {
        keyFindings: ['Bronchodilator response'],
        reasoning: ['Reversible obstruction supports asthma.'],
      },
    });
    prisma.diagnosisGraphCandidate.createMany.mockResolvedValue({ count: 5 });

    const result = await service.extractFromApprovedCase('case-1');

    expect(result.createdCount).toBe(5);
    expect(result.duplicatesSkippedCount).toBe(0);
    expect(prisma.case.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'case-1',
          editorialStatus: CaseEditorialStatus.APPROVED,
        }) as unknown,
      }),
    );
    expect(prisma.diagnosisGraphCandidate.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skipDuplicates: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            type: DiagnosisGraphCandidateType.FINDING,
            sourceType: DiagnosisGraphSourceType.CASE,
            sourcePath: 'clues.0',
            rawText: 'Nocturnal cough after exercise',
            dedupeKey: expect.any(String),
          }),
          expect.objectContaining({
            type: DiagnosisGraphCandidateType.INVESTIGATION,
            sourcePath: 'clues.1',
            rawText: 'FEV1 improves by 15%',
          }),
          expect.objectContaining({
            type: DiagnosisGraphCandidateType.MIMIC,
            sourcePath: 'differentials.0',
            rawText: 'COPD',
          }),
          expect.objectContaining({
            type: DiagnosisGraphCandidateType.CASE_REASONING,
            sourcePath: 'explanation.reasoning.0',
          }),
        ]) as unknown,
      }),
    );
  });

  it('extracts candidates from published diagnosis education with mixed JSON shapes', async () => {
    const { prisma, service } = buildService();
    prisma.diagnosisEducation.findFirst.mockResolvedValue({
      id: 'education-1',
      diagnosisRegistryId: 'registry-1',
      editorialStatus: DiagnosisEducationStatus.PUBLISHED,
      version: 4,
      keySymptoms: [{ finding: 'Episodic wheeze' }],
      keySigns: ['Diffuse expiratory wheeze'],
      examPearls: [
        { type: 'PITFALL', content: 'Do not assume normal oxygen excludes asthma.' },
      ],
      investigations: [{ test: 'Spirometry with bronchodilator response' }],
      differentials: [{ diagnosis: 'Vocal cord dysfunction' }],
      management: [{ step: 'Use a severity-based controller framework' }],
      complications: ['Status asthmaticus'],
      pitfalls: [{ pitfall: 'Over-relying on a single normal peak flow' }],
      recallPrompts: [{ prompt: 'What confirms reversible obstruction?' }],
    });
    prisma.diagnosisGraphCandidate.createMany.mockResolvedValue({ count: 8 });

    const result = await service.extractFromPublishedEducation('education-1');

    expect(result.createdCount).toBe(8);
    expect(prisma.diagnosisGraphCandidate.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skipDuplicates: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            type: DiagnosisGraphCandidateType.FINDING,
            sourceType: DiagnosisGraphSourceType.DIAGNOSIS_EDUCATION,
            sourcePath: 'keySymptoms.0',
            rawText: 'Episodic wheeze',
          }),
          expect.objectContaining({
            type: DiagnosisGraphCandidateType.PITFALL,
            sourcePath: 'examPearls.0',
          }),
          expect.objectContaining({
            type: DiagnosisGraphCandidateType.RECALL_PROMPT,
            sourcePath: 'recallPrompts.0',
          }),
        ]) as unknown,
      }),
    );
  });

  it('uses createMany skipDuplicates for duplicate prevention', async () => {
    const { prisma, service } = buildService();
    prisma.case.findFirst.mockResolvedValue({
      id: 'case-1',
      diagnosisRegistryId: 'registry-1',
      currentRevision: { revisionNumber: 1 },
      clues: [{ type: 'history', value: 'Repeated clue', order: 0 }],
      differentials: [],
      explanation: { keyFindings: [], reasoning: [] },
    });

    await service.extractFromApprovedCase('case-1');

    expect(prisma.diagnosisGraphCandidate.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skipDuplicates: true,
      }),
    );
  });

  it('resolves mimic candidates by display label', async () => {
    const { prisma, service } = buildService();
    prisma.case.findFirst.mockResolvedValue({
      id: 'case-1',
      diagnosisRegistryId: 'registry-1',
      currentRevision: { revisionNumber: 1 },
      clues: [],
      differentials: ['Heart Failure'],
      explanation: { keyFindings: [], reasoning: [] },
    });
    prisma.diagnosisRegistry.findFirst.mockResolvedValue({ id: 'registry-2' });

    await service.extractFromApprovedCase('case-1');

    expect(prisma.diagnosisRegistry.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { not: 'registry-1' },
          OR: expect.arrayContaining([
            { displayLabel: { equals: 'Heart Failure', mode: 'insensitive' } },
          ]) as unknown,
        }) as unknown,
      }),
    );
    expect(prisma.diagnosisGraphCandidate.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            targetDiagnosisRegistryId: 'registry-2',
            unresolvedTargetText: null,
          }),
        ]) as unknown,
      }),
    );
  });

  it('resolves mimic candidates by canonical name', async () => {
    const { prisma, service } = buildService();
    prisma.case.findFirst.mockResolvedValue({
      id: 'case-1',
      diagnosisRegistryId: 'registry-1',
      currentRevision: { revisionNumber: 1 },
      clues: [],
      differentials: ['Chronic obstructive pulmonary disease'],
      explanation: { keyFindings: [], reasoning: [] },
    });
    prisma.diagnosisRegistry.findFirst.mockResolvedValue({ id: 'registry-2' });

    await service.extractFromApprovedCase('case-1');

    expect(prisma.diagnosisRegistry.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            {
              canonicalName: {
                equals: 'Chronic obstructive pulmonary disease',
                mode: 'insensitive',
              },
            },
          ]) as unknown,
        }) as unknown,
      }),
    );
  });

  it('resolves mimic candidates by active alias and excludes inactive aliases', async () => {
    const { prisma, service } = buildService();
    prisma.case.findFirst.mockResolvedValue({
      id: 'case-1',
      diagnosisRegistryId: 'registry-1',
      currentRevision: { revisionNumber: 1 },
      clues: [],
      differentials: ['COPD'],
      explanation: { keyFindings: [], reasoning: [] },
    });
    prisma.diagnosisRegistry.findFirst.mockResolvedValue({ id: 'registry-2' });

    await service.extractFromApprovedCase('case-1');

    expect(prisma.diagnosisRegistry.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            {
              aliases: {
                some: {
                  active: true,
                  normalizedTerm: 'copd',
                },
              },
            },
          ]) as unknown,
        }) as unknown,
      }),
    );
  });

  it('does not self-link mimic candidates', async () => {
    const { prisma, service } = buildService();
    prisma.case.findFirst.mockResolvedValue({
      id: 'case-1',
      diagnosisRegistryId: 'registry-1',
      currentRevision: { revisionNumber: 1 },
      clues: [],
      differentials: ['Asthma'],
      explanation: { keyFindings: [], reasoning: [] },
    });

    await service.extractFromApprovedCase('case-1');

    expect(prisma.diagnosisRegistry.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { not: 'registry-1' },
        }) as unknown,
      }),
    );
  });

  it('keeps unresolvedTargetText when a mimic cannot be resolved', async () => {
    const { prisma, service } = buildService();
    prisma.case.findFirst.mockResolvedValue({
      id: 'case-1',
      diagnosisRegistryId: 'registry-1',
      currentRevision: { revisionNumber: 1 },
      clues: [],
      differentials: ['Rare mimic text'],
      explanation: { keyFindings: [], reasoning: [] },
    });

    await service.extractFromApprovedCase('case-1');

    expect(prisma.diagnosisGraphCandidate.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            targetDiagnosisRegistryId: null,
            unresolvedTargetText: 'Rare mimic text',
          }),
        ]) as unknown,
      }),
    );
  });
});
