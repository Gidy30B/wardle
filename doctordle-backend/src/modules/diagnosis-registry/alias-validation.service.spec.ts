import { BadRequestException } from '@nestjs/common';
import { DiagnosisAliasKind } from '@prisma/client';
import {
  AliasValidationService,
  assertAliasValidWithClient,
} from './alias-validation.service';

function fixture() {
  const prisma = {
    diagnosisRegistry: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'target-1',
        displayLabel: 'Asthma',
        canonicalNormalized: 'asthma',
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    diagnosisAlias: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };

  return {
    prisma,
    service: new AliasValidationService(prisma as never),
  };
}

describe('AliasValidationService', () => {
  it('blocks canonical name collisions', async () => {
    const { prisma, service } = fixture();
    prisma.diagnosisRegistry.findMany.mockResolvedValue([
      {
        id: 'registry-2',
        canonicalName: 'Chronic Obstructive Pulmonary Disease',
        canonicalNormalized: 'chronic obstructive pulmonary disease',
        displayLabel: 'COPD',
      },
    ]);

    await expect(
      service.validateAlias({
        aliasText: 'Chronic obstructive pulmonary disease',
        targetDiagnosisRegistryId: 'target-1',
      }),
    ).resolves.toMatchObject({
      valid: false,
      conflicts: [
        {
          type: 'canonical_name',
          diagnosisRegistryId: 'registry-2',
        },
      ],
    });
  });

  it('blocks display label collisions', async () => {
    const { prisma, service } = fixture();
    prisma.diagnosisRegistry.findMany.mockResolvedValue([
      {
        id: 'registry-2',
        canonicalName: 'Chronic Obstructive Pulmonary Disease',
        canonicalNormalized: 'chronic obstructive pulmonary disease',
        displayLabel: 'COPD',
      },
    ]);

    await expect(
      service.validateAlias({
        aliasText: 'COPD',
        targetDiagnosisRegistryId: 'target-1',
      }),
    ).resolves.toMatchObject({
      valid: false,
      conflicts: [
        {
          type: 'display_label',
          diagnosisRegistryId: 'registry-2',
        },
      ],
    });
  });

  it('blocks accepted alias collisions', async () => {
    const { prisma, service } = fixture();
    prisma.diagnosisAlias.findMany.mockResolvedValue([
      {
        id: 'alias-2',
        diagnosisRegistryId: 'registry-2',
        term: 'RAD',
        normalizedTerm: 'rad',
        kind: DiagnosisAliasKind.ACCEPTED,
        acceptedForMatch: true,
        diagnosis: { id: 'registry-2', displayLabel: 'Reactive Airways' },
      },
    ]);

    await expect(
      service.validateAlias({
        aliasText: 'RAD',
        targetDiagnosisRegistryId: 'target-1',
      }),
    ).resolves.toMatchObject({
      valid: false,
      conflicts: [
        {
          type: 'accepted_alias',
          diagnosisRegistryId: 'registry-2',
        },
      ],
    });
  });

  it('warns and blocks silent search-only promotion', async () => {
    const { prisma, service } = fixture();
    prisma.diagnosisAlias.findMany.mockResolvedValue([
      {
        id: 'alias-1',
        diagnosisRegistryId: 'target-1',
        term: 'RAD',
        normalizedTerm: 'rad',
        kind: DiagnosisAliasKind.SEARCH_ONLY,
        acceptedForMatch: false,
        diagnosis: { id: 'target-1', displayLabel: 'Asthma' },
      },
    ]);

    await expect(
      service.validateAlias({
        aliasText: 'RAD',
        targetDiagnosisRegistryId: 'target-1',
        acceptedForMatch: true,
      }),
    ).resolves.toMatchObject({
      valid: false,
      conflicts: [{ type: 'registry_duplicate' }],
      warnings: [expect.stringContaining('search-only alias')],
    });
  });

  it('blocks self duplicates by default', async () => {
    const { prisma, service } = fixture();
    prisma.diagnosisAlias.findMany.mockResolvedValue([
      {
        id: 'alias-1',
        diagnosisRegistryId: 'target-1',
        term: 'Reactive airway disease',
        normalizedTerm: 'reactive airway disease',
        kind: DiagnosisAliasKind.ACCEPTED,
        acceptedForMatch: true,
        diagnosis: { id: 'target-1', displayLabel: 'Asthma' },
      },
    ]);

    await expect(
      service.validateAlias({
        aliasText: 'Reactive airway disease',
        targetDiagnosisRegistryId: 'target-1',
      }),
    ).resolves.toMatchObject({
      valid: false,
      conflicts: [{ type: 'registry_duplicate' }],
    });
  });

  it('allows valid aliases and exposes normalized text', async () => {
    const { service } = fixture();

    await expect(
      service.validateAlias({
        aliasText: '  Reactive-Airway Disease  ',
        targetDiagnosisRegistryId: 'target-1',
      }),
    ).resolves.toEqual({
      valid: true,
      normalizedAlias: 'reactive airway disease',
      conflicts: [],
      warnings: [],
    });
  });

  it('throws detailed conflict responses for workflow callers', async () => {
    const { prisma } = fixture();
    prisma.diagnosisRegistry.findMany.mockResolvedValue([
      {
        id: 'registry-2',
        canonicalName: 'COPD',
        canonicalNormalized: 'copd',
        displayLabel: 'COPD',
      },
    ]);

    await expect(
      assertAliasValidWithClient(prisma as never, {
        aliasText: 'COPD',
        targetDiagnosisRegistryId: 'target-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
