import { DiagnosisRegistryStatus } from '@prisma/client';
import { DiagnosisRegistryMatcherService } from './diagnosis-registry-matcher.service';

function createMatcherFixture() {
  const prisma = {
    diagnosisRegistry: {
      findUnique: jest.fn(),
    },
  };

  return {
    prisma,
    service: new DiagnosisRegistryMatcherService(prisma as never),
  };
}

describe('DiagnosisRegistryMatcherService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not throw when the prisma dependency is unavailable', async () => {
    const service = new DiagnosisRegistryMatcherService(undefined as never);

    await expect(
      service.evaluateGameplayGuess({
        expectedDiagnosisRegistryId: 'registry-1',
        submittedDiagnosisRegistryId: 'registry-1',
        submittedGuessText: 'Asthma',
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        isCorrect: false,
        expectedDiagnosisUsable: false,
        resolution: expect.objectContaining({
          resolutionMethod: 'UNRESOLVED',
        }),
      }),
    );
  });

  it('resolves a selected usable diagnosis id directly', async () => {
    const fixture = createMatcherFixture();
    fixture.prisma.diagnosisRegistry.findUnique
      .mockResolvedValueOnce({
        id: 'registry-1',
        status: DiagnosisRegistryStatus.ACTIVE,
      })
      .mockResolvedValueOnce({
        id: 'registry-1',
        status: DiagnosisRegistryStatus.ACTIVE,
        displayLabel: 'Asthma',
      });

    const result = await fixture.service.evaluateGameplayGuess({
      expectedDiagnosisRegistryId: 'registry-1',
      submittedDiagnosisRegistryId: 'registry-1',
      submittedGuessText: 'Asthma attack',
    });

    expect(result.isCorrect).toBe(true);
    expect(result.evaluation.label).toBe('correct');
    expect(result.evaluation.retrievalMode).toBe('selected-id-only');
    expect(result.resolution).toEqual(
      expect.objectContaining({
        submittedDiagnosisRegistryId: 'registry-1',
        submittedGuessText: 'Asthma attack',
        resolvedDiagnosisRegistryId: 'registry-1',
        resolutionMethod: 'SELECTED_ID',
        isResolvable: true,
      }),
    );
  });

  it('does not resolve an invalid selected diagnosis id', async () => {
    const fixture = createMatcherFixture();
    fixture.prisma.diagnosisRegistry.findUnique
      .mockResolvedValueOnce({
        id: 'registry-1',
        status: DiagnosisRegistryStatus.ACTIVE,
      })
      .mockResolvedValueOnce(null);

    const result = await fixture.service.evaluateGameplayGuess({
      expectedDiagnosisRegistryId: 'registry-1',
      submittedDiagnosisRegistryId: 'missing',
      submittedGuessText: 'Asthma',
    });

    expect(result.isCorrect).toBe(false);
    expect(result.evaluation.label).toBe('wrong');
    expect(result.resolution).toEqual(
      expect.objectContaining({
        submittedDiagnosisRegistryId: 'missing',
        resolvedDiagnosisRegistryId: null,
        resolutionMethod: 'UNRESOLVED',
        resolutionReason: 'INVALID_SELECTED_ID',
      }),
    );
  });

  it('does not resolve a selected diagnosis in an unusable status', async () => {
    const fixture = createMatcherFixture();
    fixture.prisma.diagnosisRegistry.findUnique
      .mockResolvedValueOnce({
        id: 'registry-1',
        status: DiagnosisRegistryStatus.ACTIVE,
      })
      .mockResolvedValueOnce({
        id: 'registry-2',
        status: DiagnosisRegistryStatus.DRAFT,
        displayLabel: 'Asthma',
      });

    const result = await fixture.service.evaluateGameplayGuess({
      expectedDiagnosisRegistryId: 'registry-1',
      submittedDiagnosisRegistryId: 'registry-2',
    });

    expect(result.isCorrect).toBe(false);
    expect(result.resolution.resolutionReason).toBe('UNUSABLE_SELECTED_ID');
  });

  it('returns unresolved when no selected diagnosis id is provided', async () => {
    const fixture = createMatcherFixture();
    fixture.prisma.diagnosisRegistry.findUnique.mockResolvedValue({
      id: 'registry-1',
      status: DiagnosisRegistryStatus.ACTIVE,
    });

    const result = await fixture.service.evaluateGameplayGuess({
      expectedDiagnosisRegistryId: 'registry-1',
      submittedGuessText: 'Asthma',
    });

    expect(result.isCorrect).toBe(false);
    expect(result.resolution).toEqual(
      expect.objectContaining({
        submittedDiagnosisRegistryId: null,
        resolutionMethod: 'UNRESOLVED',
        resolutionReason: 'NO_SELECTED_ID',
      }),
    );
  });

  it('marks guesses wrong when the case has no linked registry diagnosis', async () => {
    const fixture = createMatcherFixture();
    fixture.prisma.diagnosisRegistry.findUnique.mockResolvedValueOnce({
      id: 'registry-1',
      status: DiagnosisRegistryStatus.ACTIVE,
      displayLabel: 'Asthma',
    });

    const result = await fixture.service.evaluateGameplayGuess({
      expectedDiagnosisRegistryId: null,
      submittedDiagnosisRegistryId: 'registry-1',
    });

    expect(result.isCorrect).toBe(false);
    expect(result.expectedDiagnosisUsable).toBe(false);
    expect(result.evaluation.signals.expectedDiagnosisUsable).toBe(false);
    expect(result.evaluation.signals.diagnosisResolutionReason).toBe(
      'EXPECTED_DIAGNOSIS_MISSING',
    );
  });

  it('marks guesses wrong when the case diagnosis is not usable', async () => {
    const fixture = createMatcherFixture();
    fixture.prisma.diagnosisRegistry.findUnique
      .mockResolvedValueOnce({
        id: 'registry-1',
        status: DiagnosisRegistryStatus.DEPRECATED,
      })
      .mockResolvedValueOnce({
        id: 'registry-1',
        status: DiagnosisRegistryStatus.ACTIVE,
        displayLabel: 'Asthma',
      });

    const result = await fixture.service.evaluateGameplayGuess({
      expectedDiagnosisRegistryId: 'registry-1',
      submittedDiagnosisRegistryId: 'registry-1',
    });

    expect(result.isCorrect).toBe(false);
    expect(result.evaluation.signals.diagnosisResolutionReason).toBe(
      'EXPECTED_DIAGNOSIS_UNUSABLE',
    );
  });
});
