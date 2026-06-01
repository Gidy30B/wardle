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
      service: new DiagnosisGraphExtractionService(prisma as never, {
        resolve: jest.fn().mockImplementation(async ({ rawText }) => {
          const text = String(rawText).trim();
          const normalizedText = text.toLowerCase();
          const target = await prisma.diagnosisRegistry.findFirst({
            where: {
              active: true,
              id: { not: 'registry-1' },
              OR: [
                { displayLabel: { equals: text, mode: 'insensitive' } },
                { canonicalNormalized: normalizedText },
                { canonicalName: { equals: text, mode: 'insensitive' } },
                {
                  aliases: {
                    some: {
                      active: true,
                      normalizedTerm: normalizedText,
                    },
                  },
                },
              ],
            },
            select: { id: true },
          });
          return target
            ? {
                rawText,
                normalizedText,
                status: 'resolved',
                resolvedRegistryId: target.id,
                resolvedDisplayLabel: rawText,
                matchType: 'canonical',
                confidence: 1,
                suggestions: [],
              }
            : {
                rawText,
                normalizedText,
                status: 'unresolved',
                confidence: 0,
                suggestions: [],
              };
        }),
        toPayload: jest.fn((result) => ({
          registryResolution: result,
        })),
      } as never),
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
          editorialStatus: {
            in: [
              CaseEditorialStatus.APPROVED,
              CaseEditorialStatus.READY_TO_PUBLISH,
              CaseEditorialStatus.PUBLISHED,
            ],
          },
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

  it('extracts candidates from published cases', async () => {
    const { prisma, service } = buildService();
    prisma.case.findFirst.mockResolvedValue({
      id: 'case-published',
      diagnosisRegistryId: 'registry-1',
      editorialStatus: CaseEditorialStatus.PUBLISHED,
      currentRevision: { revisionNumber: 5 },
      clues: [{ type: 'exam', value: 'Right lower quadrant tenderness', order: 2 }],
      differentials: ['Renal colic'],
      explanation: {
        keyFindings: ['Migration of pain to the right lower quadrant'],
        reasoning: ['Localized peritoneal signs support appendicitis.'],
      },
    });
    prisma.diagnosisGraphCandidate.createMany.mockResolvedValue({ count: 4 });

    const result = await service.extractFromApprovedCase('case-published');

    expect(result.createdCount).toBe(4);
    expect(prisma.case.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'case-published',
          editorialStatus: {
            in: [
              CaseEditorialStatus.APPROVED,
              CaseEditorialStatus.READY_TO_PUBLISH,
              CaseEditorialStatus.PUBLISHED,
            ],
          },
        }) as unknown,
      }),
    );
  });

  it('does not extract draft or rejected cases', async () => {
    const { prisma, service } = buildService();
    prisma.case.findFirst.mockResolvedValue(null);

    await expect(service.extractFromApprovedCase('case-draft')).resolves.toEqual(
      expect.objectContaining({
        candidateCount: 0,
        createdCount: 0,
      }),
    );
    expect(prisma.case.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          editorialStatus: {
            in: [
              CaseEditorialStatus.APPROVED,
              CaseEditorialStatus.READY_TO_PUBLISH,
              CaseEditorialStatus.PUBLISHED,
            ],
          },
        }) as unknown,
      }),
    );
    expect(prisma.diagnosisGraphCandidate.createMany).not.toHaveBeenCalled();
  });

  it('extracts reasoning-edge candidates from case differential analysis', async () => {
    const { prisma, service } = buildService();
    prisma.case.findFirst.mockResolvedValue({
      id: 'case-1',
      diagnosisRegistryId: 'registry-1',
      editorialStatus: CaseEditorialStatus.APPROVED,
      currentRevision: { revisionNumber: 3 },
      clues: [],
      differentials: [],
      explanation: {
        keyFindings: [],
        reasoning: [],
        differentialAnalysis: [
          {
            diagnosis: 'Pulmonary embolism',
            whyPlausibleEarly:
              'Acute dyspnea and tachycardia can occur in pulmonary embolism.',
            ruledOutByClues: [
              {
                clueOrder: 4,
                evidence: 'Chest X-ray demonstrates lobar consolidation.',
                reason:
                  'Lobar consolidation favors pneumonia over pulmonary embolism.',
              },
            ],
            finalReasonLessLikely:
              'Positive sputum culture and focal consolidation favor pneumonia.',
          },
        ],
      },
    });

    await service.extractFromApprovedCase('case-1');

    expect(prisma.diagnosisGraphCandidate.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            type: DiagnosisGraphCandidateType.MIMIC,
            sourcePath: 'explanation.differentialAnalysis.0.diagnosis',
            rawText: 'Pulmonary embolism',
            unresolvedTargetText: 'Pulmonary embolism',
            payload: expect.objectContaining({
              relation: 'MIMICS',
              sourceDiagnosisRegistryId: 'registry-1',
              targetDiagnosisText: 'Pulmonary embolism',
              source: 'case.differentialAnalysis',
            }) as unknown,
          }),
          expect.objectContaining({
            type: DiagnosisGraphCandidateType.CASE_REASONING,
            sourcePath:
              'explanation.differentialAnalysis.0.whyPlausibleEarly',
            payload: expect.objectContaining({
              relation: 'SUPPORTS',
              targetDiagnosisText: 'Pulmonary embolism',
            }) as unknown,
          }),
          expect.objectContaining({
            type: DiagnosisGraphCandidateType.CASE_REASONING,
            sourcePath:
              'explanation.differentialAnalysis.0.ruledOutByClues.0',
            rawText:
              'Chest X-ray demonstrates lobar consolidation. - Lobar consolidation favors pneumonia over pulmonary embolism.',
            payload: expect.objectContaining({
              relation: 'RULES_OUT',
              evidence: 'Chest X-ray demonstrates lobar consolidation.',
              rationale:
                'Lobar consolidation favors pneumonia over pulmonary embolism.',
              clueOrder: 4,
            }) as unknown,
          }),
          expect.objectContaining({
            type: DiagnosisGraphCandidateType.CASE_REASONING,
            sourcePath:
              'explanation.differentialAnalysis.0.ruledOutByClues.0.supports',
            payload: expect.objectContaining({
              relation: 'SUPPORTS',
              evidence: 'Chest X-ray demonstrates lobar consolidation.',
              clueOrder: 4,
            }) as unknown,
          }),
          expect.objectContaining({
            type: DiagnosisGraphCandidateType.CASE_REASONING,
            sourcePath:
              'explanation.differentialAnalysis.0.finalReasonLessLikely',
            rawText:
              'Positive sputum culture and focal consolidation favor pneumonia.',
            payload: expect.objectContaining({
              relation: 'DISCRIMINATES_FROM',
              targetDiagnosisText: 'Pulmonary embolism',
            }) as unknown,
          }),
        ]) as unknown,
      }),
    );
  });

  it('extracts reasoning-edge candidates from published case differential analysis', async () => {
    const { prisma, service } = buildService();
    prisma.case.findFirst.mockResolvedValue({
      id: 'case-published',
      diagnosisRegistryId: 'registry-1',
      editorialStatus: CaseEditorialStatus.PUBLISHED,
      currentRevision: { revisionNumber: 6 },
      clues: [],
      differentials: [],
      explanation: {
        keyFindings: [],
        reasoning: [],
        differentialAnalysis: [
          {
            diagnosis: 'Renal colic',
            whyPlausibleEarly:
              'Right-sided abdominal pain can overlap with renal colic early.',
            ruledOutByClues: [
              {
                clueOrder: 4,
                evidence: 'CT abdomen shows an inflamed appendix.',
                reason:
                  'Appendiceal inflammation directly supports appendicitis over renal colic.',
              },
            ],
            finalReasonLessLikely:
              'No ureteral stone or hematuria pattern is present.',
          },
        ],
      },
    });

    await service.extractFromApprovedCase('case-published');

    expect(prisma.diagnosisGraphCandidate.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            type: DiagnosisGraphCandidateType.CASE_REASONING,
            sourcePath:
              'explanation.differentialAnalysis.0.ruledOutByClues.0',
            payload: expect.objectContaining({
              relation: 'RULES_OUT',
              evidence: 'CT abdomen shows an inflamed appendix.',
              rationale:
                'Appendiceal inflammation directly supports appendicitis over renal colic.',
              clueOrder: 4,
            }) as unknown,
          }),
          expect.objectContaining({
            type: DiagnosisGraphCandidateType.CASE_REASONING,
            sourcePath:
              'explanation.differentialAnalysis.0.finalReasonLessLikely',
            payload: expect.objectContaining({
              relation: 'DISCRIMINATES_FROM',
              targetDiagnosisText: 'Renal colic',
            }) as unknown,
          }),
        ]) as unknown,
      }),
    );
  });

  it('smoke extraction selects approved, ready-to-publish, and published cases only', async () => {
    const { prisma, service } = buildService();
    prisma.diagnosisRegistry.findMany.mockResolvedValue([
      {
        id: 'registry-1',
        displayLabel: 'Appendicitis',
        cases: [{ id: 'case-approved' }, { id: 'case-published' }],
        education: null,
      },
    ]);
    prisma.case.findFirst
      .mockResolvedValueOnce({
        id: 'case-approved',
        diagnosisRegistryId: 'registry-1',
        editorialStatus: CaseEditorialStatus.APPROVED,
        currentRevision: { revisionNumber: 1 },
        clues: [],
        differentials: [],
        explanation: { keyFindings: [], reasoning: [] },
      })
      .mockResolvedValueOnce({
        id: 'case-published',
        diagnosisRegistryId: 'registry-1',
        editorialStatus: CaseEditorialStatus.PUBLISHED,
        currentRevision: { revisionNumber: 2 },
        clues: [],
        differentials: [],
        explanation: { keyFindings: [], reasoning: [] },
      });

    const result = await service.runSmokeExtraction({
      diagnosisRegistryIds: ['registry-1'],
      includeEducation: false,
    });

    expect(prisma.diagnosisRegistry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['registry-1'] } },
        select: expect.objectContaining({
          cases: {
            where: {
              editorialStatus: {
                in: [
                  CaseEditorialStatus.APPROVED,
                  CaseEditorialStatus.READY_TO_PUBLISH,
                  CaseEditorialStatus.PUBLISHED,
                ],
              },
            },
            select: { id: true },
          },
        }) as unknown,
      }),
    );
    expect(result[0]).toEqual(
      expect.objectContaining({
        casesProcessed: 2,
        educationProcessed: 0,
      }),
    );
  });

  it('uses stable dedupe keys for differential analysis candidates', async () => {
    const { prisma, service } = buildService();
    const caseRecord = {
      id: 'case-1',
      diagnosisRegistryId: 'registry-1',
      editorialStatus: CaseEditorialStatus.APPROVED,
      currentRevision: { revisionNumber: 3 },
      clues: [],
      differentials: [],
      explanation: {
        keyFindings: [],
        reasoning: [],
        differentialAnalysis: [
          {
            diagnosis: 'Pulmonary embolism',
            ruledOutByClues: [
              {
                clueOrder: 4,
                evidence: 'Chest X-ray demonstrates lobar consolidation.',
                reason:
                  'Lobar consolidation favors pneumonia over pulmonary embolism.',
              },
            ],
          },
        ],
      },
    };
    prisma.case.findFirst.mockResolvedValue(caseRecord);

    await service.extractFromApprovedCase('case-1');
    const firstCall = prisma.diagnosisGraphCandidate.createMany.mock.calls[0][0]
      .data as Array<{ sourcePath: string; dedupeKey: string }>;

    await service.extractFromApprovedCase('case-1');
    const secondCall = prisma.diagnosisGraphCandidate.createMany.mock.calls[1][0]
      .data as Array<{ sourcePath: string; dedupeKey: string }>;

    expect(
      firstCall.find((candidate) =>
        candidate.sourcePath.endsWith('ruledOutByClues.0'),
      )?.dedupeKey,
    ).toBe(
      secondCall.find((candidate) =>
        candidate.sourcePath.endsWith('ruledOutByClues.0'),
      )?.dedupeKey,
    );
    expect(
      firstCall.find((candidate) =>
        candidate.sourcePath.endsWith('ruledOutByClues.0'),
      )?.dedupeKey,
    ).toContain('rules out');
  });

  it('does not crash when case differential analysis is missing', async () => {
    const { prisma, service } = buildService();
    prisma.case.findFirst.mockResolvedValue({
      id: 'case-1',
      diagnosisRegistryId: 'registry-1',
      editorialStatus: CaseEditorialStatus.APPROVED,
      currentRevision: { revisionNumber: 1 },
      clues: [],
      differentials: [],
      explanation: { keyFindings: [], reasoning: [] },
    });

    await expect(service.extractFromApprovedCase('case-1')).resolves.toEqual(
      expect.objectContaining({
        candidateCount: 0,
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
