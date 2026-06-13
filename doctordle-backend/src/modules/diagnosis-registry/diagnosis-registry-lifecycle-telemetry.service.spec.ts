import {
  DiagnosisEditorialOnboardingStatus,
  DiagnosisRegistryStatus,
} from '@prisma/client';
import { DiagnosisRegistryLifecycleTelemetryService } from './diagnosis-registry-lifecycle-telemetry.service';

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'registry-1',
    displayLabel: 'Asthma',
    canonicalName: 'Asthma',
    canonicalNormalized: 'asthma',
    status: DiagnosisRegistryStatus.ACTIVE,
    active: true,
    isPlayable: true,
    isGeneratable: false,
    onboardingStatus: DiagnosisEditorialOnboardingStatus.COMPLETE,
    specialty: 'Pulmonology',
    bodySystem: 'Respiratory',
    category: 'Obstructive',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    notes: null,
    isDescriptive: false,
    isCompositional: false,
    createdRegistryCandidates: [],
    aliases: [],
    ...overrides,
  };
}

function buildService(updateResult = row()) {
  const prisma = {
    diagnosisRegistry: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue(updateResult),
    },
  };

  return {
    prisma,
    service: new DiagnosisRegistryLifecycleTelemetryService(prisma as never),
  };
}

describe('DiagnosisRegistryLifecycleTelemetryService', () => {
  it('counts dictionary-visible, playable, and generatable rows', () => {
    const { service } = buildService();

    const result = service.buildTelemetry([
      row({ id: 'active-playable', isGeneratable: false }),
      row({ id: 'active-generatable', canonicalNormalized: 'dka', isGeneratable: true }),
      row({
        id: 'draft',
        canonicalNormalized: 'draft',
        status: DiagnosisRegistryStatus.DRAFT,
        active: false,
        isPlayable: false,
      }),
    ] as never);

    expect(result.summary.dictionaryVisibleRows).toBe(2);
    expect(result.summary.playableRows).toBe(2);
    expect(result.summary.generatableRows).toBe(1);
    expect(result.summary.draftRows).toBe(1);
  });

  it('detects lifecycle drift categories', () => {
    const { service } = buildService();

    const result = service.buildTelemetry([
      row({
        id: 'draft-active',
        canonicalNormalized: 'draft active',
        status: DiagnosisRegistryStatus.DRAFT,
        active: true,
        isPlayable: true,
        isGeneratable: true,
      }),
      row({
        id: 'generated-not-playable',
        canonicalNormalized: 'generated not playable',
        isPlayable: false,
        isGeneratable: true,
      }),
      row({
        id: 'active-inactive',
        canonicalNormalized: 'active inactive',
        status: DiagnosisRegistryStatus.ACTIVE,
        active: false,
        isPlayable: true,
      }),
    ] as never);

    expect(result.drift.draftButActive).toHaveLength(1);
    expect(result.drift.draftButPlayable).toHaveLength(1);
    expect(result.drift.draftButGeneratable).toHaveLength(1);
    expect(result.drift.generatableButNotPlayable).toHaveLength(1);
    expect(result.drift.playableButNotDictionaryVisible).toHaveLength(2);
    expect(result.drift.activeButInactive).toHaveLength(1);
  });

  it('repairs draft flag drift without promoting to active', async () => {
    const updated = row({
      status: DiagnosisRegistryStatus.DRAFT,
      active: false,
      isPlayable: false,
      isGeneratable: false,
    });
    const { prisma, service } = buildService(updated);

    const result = await service.normalizeRows([
      row({
        status: DiagnosisRegistryStatus.DRAFT,
        active: true,
        isPlayable: true,
        isGeneratable: true,
      }),
    ] as never);

    expect(prisma.diagnosisRegistry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          active: false,
          isPlayable: false,
          isGeneratable: false,
        },
      }),
    );
    expect(result.repaired[0]).toMatchObject({
      status: DiagnosisRegistryStatus.DRAFT,
      active: false,
      isPlayable: false,
      isGeneratable: false,
    });
  });

  it('repairs generatable without playable by disabling generation only', async () => {
    const { prisma, service } = buildService(
      row({ isPlayable: false, isGeneratable: false }),
    );

    await service.normalizeRows([
      row({ isPlayable: false, isGeneratable: true }),
    ] as never);

    expect(prisma.diagnosisRegistry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          isGeneratable: false,
        },
      }),
    );
  });

  it('reports active but inactive rows as blockers and does not repair them', async () => {
    const { prisma, service } = buildService();

    const result = await service.normalizeRows([
      row({ status: DiagnosisRegistryStatus.ACTIVE, active: false }),
    ] as never);

    expect(result.blockers).toHaveLength(1);
    expect(prisma.diagnosisRegistry.update).not.toHaveBeenCalled();
  });
});
