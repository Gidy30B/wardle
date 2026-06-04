import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  DiagnosisRegistryCandidateStatus,
  DiagnosisRegistryStatus,
} from '@prisma/client';
import { DiagnosisRegistryMergeAnalysisService } from './diagnosis-registry-merge-analysis.service';

function registry(id: string, overrides: Record<string, unknown> = {}) {
  const label = id === 'source' ? 'Asthma Variant' : 'Asthma';
  return {
    id,
    canonicalName: label,
    canonicalNormalized: label.toLowerCase(),
    displayLabel: label,
    status: DiagnosisRegistryStatus.ACTIVE,
    active: true,
    isPlayable: true,
    isGeneratable: false,
    onboardingStatus: 'COMPLETE',
    aliases: [],
    ...overrides,
  };
}

function buildPrisma(source = registry('source'), target = registry('target')) {
  const prisma = {
    diagnosisRegistry: {
      findUnique: jest
        .fn()
        .mockImplementation(({ where }: { where: { id: string } }) => {
          if (where.id === 'source') return Promise.resolve(source);
          if (where.id === 'target') return Promise.resolve(target);
          return Promise.resolve(null);
        }),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
      delete: jest.fn(),
    },
    diagnosisAlias: {
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn().mockResolvedValue([]),
    },
    diagnosisTeachingRule: {
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn().mockResolvedValue([]),
    },
    diagnosisEditorialBrief: { count: jest.fn().mockResolvedValue(1) },
    diagnosisEducation: { count: jest.fn().mockResolvedValue(1) },
    case: {
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn().mockResolvedValue([]),
    },
    caseRevision: { count: jest.fn().mockResolvedValue(1) },
    caseDifferentialMapping: { count: jest.fn().mockResolvedValue(0) },
    educationDifferentialMapping: { count: jest.fn().mockResolvedValue(0) },
    caseDifferentialLink: { count: jest.fn().mockResolvedValue(0) },
    educationDifferentialLink: { count: jest.fn().mockResolvedValue(0) },
    diagnosisGraphFact: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
    diagnosisGraphCandidate: { count: jest.fn().mockResolvedValue(0) },
    diagnosisRegistryCandidate: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
    },
    attempt: { count: jest.fn().mockResolvedValue(0) },
  };
  return prisma;
}

function lifecycle() {
  return {
    isEditorialVisible: jest.fn().mockReturnValue(true),
    isDictionaryVisible: jest.fn().mockReturnValue(true),
    isPlayable: jest.fn().mockReturnValue(true),
    isGeneratable: jest.fn().mockReturnValue(false),
    getLifecycle: jest.fn().mockResolvedValue({
      duplicateRisk: {
        registryCanonicalMatches: 0,
        registryAliasMatches: 0,
        pendingCandidateConflicts: 0,
      },
    }),
  };
}

describe('DiagnosisRegistryMergeAnalysisService', () => {
  it('blocks same-diagnosis analysis', async () => {
    const service = new DiagnosisRegistryMergeAnalysisService(
      buildPrisma() as never,
      lifecycle() as never,
    );

    await expect(service.analyzeMerge('source', 'source')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('blocks nonexistent diagnoses', async () => {
    const service = new DiagnosisRegistryMergeAnalysisService(
      buildPrisma() as never,
      lifecycle() as never,
    );

    await expect(service.analyzeMerge('source', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('detects alias collisions and blocks unsafe dry-run', async () => {
    const prisma = buildPrisma(
      registry('source', {
        canonicalName: 'DKA',
        canonicalNormalized: 'dka',
        aliases: [{ id: 'a1', term: 'Diabetic ketoacidosis', normalizedTerm: 'diabetic ketoacidosis', active: true, acceptedForMatch: true }],
      }),
      registry('target', {
        canonicalName: 'Diabetic Ketoacidosis',
        canonicalNormalized: 'diabetic ketoacidosis',
        aliases: [{ id: 'a2', term: 'DKA', normalizedTerm: 'dka', active: true, acceptedForMatch: true }],
      }),
    );
    const service = new DiagnosisRegistryMergeAnalysisService(
      prisma as never,
      lifecycle() as never,
    );

    const result = await service.analyzeMerge('source', 'target');

    expect(result.allowed).toBe(false);
    expect(result.severity).toBe('BLOCKED');
    expect(result.conflicts.aliases.length).toBeGreaterThan(0);
    expect(prisma.diagnosisRegistry.update).not.toHaveBeenCalled();
    expect(prisma.diagnosisRegistry.delete).not.toHaveBeenCalled();
  });

  it('detects teaching rule, graph, duplicate case, and lifecycle conflicts', async () => {
    const prisma = buildPrisma();
    prisma.diagnosisTeachingRule.findMany.mockResolvedValue([
      { diagnosisRegistryId: 'source', stableKey: 'wheeze', title: 'Wheeze' },
      { diagnosisRegistryId: 'target', stableKey: 'wheeze', title: 'Wheeze target' },
    ]);
    prisma.diagnosisGraphFact.findMany.mockResolvedValue([
      { diagnosisRegistryId: 'source', type: 'FINDING', normalizedLabel: 'wheeze', targetDiagnosisRegistryId: null, label: 'Wheeze' },
      { diagnosisRegistryId: 'target', type: 'FINDING', normalizedLabel: 'wheeze', targetDiagnosisRegistryId: null, label: 'Wheeze target' },
    ]);
    prisma.case.findMany.mockResolvedValue([
      { diagnosisRegistryId: 'source', id: 'case-1', title: 'Asthma case' },
      { diagnosisRegistryId: 'target', id: 'case-2', title: 'Asthma case' },
    ]);
    prisma.caseDifferentialMapping.count.mockImplementation(
      ({ where }: { where?: { resolvedDiagnosisRegistryId?: string } }) =>
        Promise.resolve(where?.resolvedDiagnosisRegistryId === 'source' ? 1 : 0),
    );

    const result = await new DiagnosisRegistryMergeAnalysisService(
      prisma as never,
      lifecycle() as never,
    ).analyzeMerge('source', 'target');

    expect(result.conflicts.teachingRules).toHaveLength(1);
    expect(result.conflicts.graph).toHaveLength(1);
    expect(result.conflicts.duplicateCases).toHaveLength(1);
    expect(result.conflicts.lifecycle).toEqual(
      expect.arrayContaining([
        'Source has unresolved or ambiguous differential mappings',
      ]),
    );
    expect(result.severity).toBe('HIGH');
  });

  it('returns low severity when no conflicts exist', async () => {
    const prisma = buildPrisma();
    prisma.diagnosisAlias.count.mockResolvedValue(0);
    prisma.diagnosisTeachingRule.count.mockResolvedValue(0);
    prisma.diagnosisEditorialBrief.count.mockResolvedValue(0);
    prisma.diagnosisEducation.count.mockResolvedValue(0);
    prisma.case.count.mockResolvedValue(0);
    prisma.caseRevision.count.mockResolvedValue(0);

    const result = await new DiagnosisRegistryMergeAnalysisService(
      prisma as never,
      lifecycle() as never,
    ).analyzeMerge('source', 'target');

    expect(result.allowed).toBe(true);
    expect(result.severity).toBe('LOW');
    expect(result.readiness.score).toBe(100);
  });

  it('returns merge-related candidate and alias suggestions', async () => {
    const prisma = buildPrisma();
    prisma.diagnosisRegistryCandidate.findMany.mockResolvedValue([
      {
        id: 'candidate-1',
        proposedCanonicalName: 'Asthma',
        status: DiagnosisRegistryCandidateStatus.CANDIDATE,
        sourceRawText: 'asthma',
      },
    ]);
    prisma.diagnosisRegistry.findMany.mockResolvedValue([
      {
        id: 'target',
        canonicalName: 'Asthma',
        displayLabel: 'Asthma',
        status: DiagnosisRegistryStatus.ACTIVE,
      },
    ]);
    prisma.diagnosisAlias.findMany.mockResolvedValue([
      {
        diagnosisRegistryId: 'target',
        term: 'Reactive airway disease',
        normalizedTerm: 'reactive airway disease',
        diagnosis: { displayLabel: 'Asthma' },
      },
    ]);

    const related = await new DiagnosisRegistryMergeAnalysisService(
      prisma as never,
      lifecycle() as never,
    ).getMergeRelated('source');

    expect(related.candidateConflicts).toHaveLength(1);
    expect(related.potentialDuplicateSuggestions).toHaveLength(1);
    expect(related.aliasSimilarityMatches).toHaveLength(1);
  });
});
