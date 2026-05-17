import { Logger } from '@nestjs/common';
import { GenerationPlannerService } from './generation-planner.service';

describe('GenerationPlannerService', () => {
  const buildService = () => {
    const candidates = [
      {
        diagnosisRegistryId: 'registry-1',
        legacyDiagnosisId: 'diagnosis-1',
        displayLabel: 'Asthma',
        canonicalName: 'asthma',
        acceptedAliases: ['Reactive airway disease'],
        specialty: 'Pulmonology',
        category: 'Obstructive',
        bodySystem: 'Respiratory',
        difficultyBand: 'INTERMEDIATE',
        existingCaseCount: 0,
        lastGeneratedAt: null,
        recentUsePenaltyApplied: false,
      },
      {
        diagnosisRegistryId: 'registry-1',
        legacyDiagnosisId: 'diagnosis-1',
        displayLabel: 'Asthma duplicate',
        canonicalName: 'asthma',
        acceptedAliases: ['Reactive airway disease'],
        specialty: 'Pulmonology',
        category: 'Obstructive',
        bodySystem: 'Respiratory',
        difficultyBand: 'INTERMEDIATE',
        existingCaseCount: 0,
        lastGeneratedAt: null,
        recentUsePenaltyApplied: false,
      },
      {
        diagnosisRegistryId: 'registry-2',
        legacyDiagnosisId: 'diagnosis-2',
        displayLabel: 'Appendicitis',
        canonicalName: 'appendicitis',
        acceptedAliases: [],
        specialty: 'General Surgery',
        category: 'Inflammatory',
        bodySystem: 'Gastrointestinal',
        difficultyBand: 'BASIC',
        existingCaseCount: 2,
        lastGeneratedAt: new Date('2026-05-10T00:00:00.000Z'),
        recentUsePenaltyApplied: true,
      },
    ];
    const diagnosisSelectionService = {
      selectDiagnosisCandidates: jest.fn().mockResolvedValue({
        candidates,
        candidateCount: 3,
        unusedCandidateCount: 2,
        repeatedCandidateCount: 1,
        selectedUnusedCount: 0,
        selectedRepeatCount: 0,
        repeatReason: null,
        existingCaseCountByDiagnosis: {
          'registry-1': 0,
          'registry-2': 2,
        },
        recentUsePenaltyApplied: true,
      }),
    };
    const generationDeduplicationService = {
      createRegistryReservation: jest.fn(() => new Set<string>()),
      reserveRegistryDiagnosis: jest.fn(
        ({
          registryId,
          reservedRegistryIds,
        }: {
          registryId: string;
          reservedRegistryIds: Set<string>;
        }) => {
          if (reservedRegistryIds.has(registryId)) {
            return false;
          }

          reservedRegistryIds.add(registryId);
          return true;
        },
      ),
    };

    return {
      diagnosisSelectionService,
      generationDeduplicationService,
      service: new GenerationPlannerService(
        diagnosisSelectionService as never,
        generationDeduplicationService as never,
      ),
    };
  };

  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('plans unique registry diagnoses in shadow mode and records duplicates', async () => {
    const { diagnosisSelectionService, service } = buildService();

    const result = await service.createShadowPlan({
      batchId: 'batch-1',
      options: {
        count: 3,
        track: 'Pulmonology',
        bodySystem: 'Respiratory',
        difficulty: 'medium',
      },
    });

    expect(
      diagnosisSelectionService.selectDiagnosisCandidates,
    ).toHaveBeenCalledWith({
      count: 3,
      specialty: 'Pulmonology',
      bodySystem: 'Respiratory',
      difficulty: 'medium',
    });
    expect(result).toEqual([
      expect.objectContaining({
        index: 0,
        selectionStatus: 'selected',
        duplicatePrevented: false,
        diagnosis: expect.objectContaining({
          diagnosisRegistryId: 'registry-1',
        }) as unknown,
      }),
      expect.objectContaining({
        index: 1,
        selectionStatus: 'selected',
        duplicatePrevented: true,
        repeatReason: 'unused_candidates_insufficient',
        existingCaseCount: 2,
        recentUsePenaltyApplied: true,
        diagnosis: expect.objectContaining({
          diagnosisRegistryId: 'registry-2',
        }) as unknown,
        diagnostics: expect.objectContaining({
          candidateCount: 3,
          unusedCandidateCount: 2,
          repeatedCandidateCount: 1,
          selectedUnusedCount: 1,
          selectedRepeatCount: 1,
          repeatReason: 'unused_candidates_insufficient',
          recentUsePenaltyApplied: true,
        }) as unknown,
      }),
      expect.objectContaining({
        index: 2,
        selectionStatus: 'unavailable',
        duplicatePrevented: false,
        diagnosis: null,
        diagnostics: expect.objectContaining({
          selectedRepeatCount: 1,
        }) as unknown,
      }),
    ]);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('case.generate.planner_selected'),
    );
  });

  it('compares AI answer drift against the planned diagnosis', () => {
    const { service } = buildService();

    const result = service.compareAnswerToPlannedDiagnosis({
      slot: {
        batchId: 'batch-1',
        index: 0,
        duplicatePrevented: false,
        selectionStatus: 'selected',
        diagnosis: {
          diagnosisRegistryId: 'registry-1',
          legacyDiagnosisId: 'diagnosis-1',
          displayLabel: 'Pulmonary Embolism',
          canonicalName: 'pulmonary embolism',
          acceptedAliases: ['PE'],
          specialty: 'Pulmonology',
          category: 'Vascular',
          bodySystem: 'Respiratory',
          difficultyBand: 'INTERMEDIATE',
          existingCaseCount: 0,
          lastGeneratedAt: null,
          recentUsePenaltyApplied: false,
        },
        repeatReason: null,
        existingCaseCount: 0,
        recentUsePenaltyApplied: false,
        diagnostics: {
          candidateCount: 1,
          unusedCandidateCount: 1,
          repeatedCandidateCount: 0,
          selectedUnusedCount: 1,
          selectedRepeatCount: 0,
          repeatReason: null,
          existingCaseCountByDiagnosis: {
            'registry-1': 0,
          },
          recentUsePenaltyApplied: false,
        },
      },
      aiAnswer: 'Asthma',
    });

    expect(result.comparison).toEqual({
      aiAnswer: 'Asthma',
      normalizedAiAnswer: 'asthma',
      normalizedPlannerDiagnosis: 'pulmonary embolism',
      matchesPlanner: false,
    });
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('case.generate.planner_drift'),
    );
  });
});
