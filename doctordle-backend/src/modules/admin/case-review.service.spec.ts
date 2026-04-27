import {
  CaseEditorialStatus,
  CaseSource,
  DiagnosisMappingMethod,
  DiagnosisMappingStatus,
  ValidationOutcome,
} from '@prisma/client';
import { CaseReviewService } from './case-review.service';

describe('CaseReviewService', () => {
  function createFixture() {
    const prisma: any = {
      case: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      caseRevision: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      caseValidationRun: {
        create: jest.fn(),
      },
      $transaction: jest.fn(async (handler: ((tx: any) => unknown) | unknown[]) => {
        if (Array.isArray(handler)) {
          return Promise.all(handler);
        }

        return handler(prisma);
      }),
    };

    const caseRevisionService = {
      getCurrentCaseSnapshotInTransaction: jest.fn().mockResolvedValue({
        caseId: 'case-1',
        title: 'Case title',
        date: new Date('2026-04-20T00:00:00.000Z'),
        difficulty: 'medium',
        history: 'History',
        symptoms: ['cough'],
        labs: null,
        clues: [],
        explanation: {},
        differentials: [],
        diagnosisId: 'diagnosis-1',
        diagnosisRegistryId: 'registry-1',
        proposedDiagnosisText: 'Asthma',
        diagnosisMappingStatus: DiagnosisMappingStatus.MATCHED,
        diagnosisMappingMethod: DiagnosisMappingMethod.EDITOR_SELECTED,
        diagnosisMappingConfidence: 1,
        diagnosisEditorialNote: 'Reviewed by editor',
      }),
      createRevisionFromSnapshotInTransaction: jest.fn().mockResolvedValue({
        revisionId: 'revision-new',
        revisionNumber: 4,
        snapshot: {
          caseId: 'case-1',
        },
      }),
    };
    const caseValidationService = {
      validateSnapshot: jest.fn().mockReturnValue({
        outcome: ValidationOutcome.PASSED,
        validatorVersion: 'shadow:v1',
      }),
      buildExecutionErrorReport: jest.fn(),
      buildPersistencePayload: jest.fn().mockReturnValue({
        summary: { summary: true },
        findings: { findings: true },
      }),
    };
    const editorialMetrics = {
      recordValidationResult: jest.fn(),
      recordReviewOutcome: jest.fn(),
      recordReadyToPublishTransition: jest.fn(),
      snapshot: jest.fn().mockReturnValue({
        assignments: {
          explicit: {
            accepted: 0,
            rejected: 0,
            rejectedByEditorialStatus: {},
          },
          lazy: {
            accepted: 0,
            rejected: 0,
            rejectedByEditorialStatus: {},
            noEligibleCaseMisses: 0,
          },
          readyToPublishTransitions: 0,
        },
      }),
    };
    const diagnosisRegistryLinkService = {
      resolveForWrite: jest.fn().mockResolvedValue({
        diagnosisId: 'diagnosis-1',
        diagnosisName: 'Asthma',
        diagnosisRegistryId: 'registry-1',
      }),
    };
    const diagnosisRegistryEditorialService = {
      search: jest.fn(),
      createDiagnosis: jest.fn(),
      addAlias: jest.fn(),
      getLinkableDiagnosisRegistry: jest.fn().mockResolvedValue({
        diagnosisId: 'diagnosis-1',
        diagnosisRegistryId: 'registry-1',
        registry: {
          id: 'registry-1',
          canonicalName: 'Asthma',
          status: 'ACTIVE',
          category: 'Pulmonology',
          specialty: null,
          searchPriority: 0,
          aliasPreview: [],
        },
      }),
    };

    return {
      prisma,
      caseRevisionService,
      caseValidationService,
      editorialMetrics,
      diagnosisRegistryLinkService,
      diagnosisRegistryEditorialService,
      service: new CaseReviewService(
        prisma as never,
        caseRevisionService as never,
        caseValidationService as never,
        editorialMetrics as never,
        diagnosisRegistryLinkService as never,
        diagnosisRegistryEditorialService as never,
      ),
    };
  }

  it('exposes diagnosis review fields and readiness on case detail payloads', async () => {
    const fixture = createFixture();
    fixture.prisma.case.findUnique.mockResolvedValue({
      id: 'case-1',
      title: 'Case title',
      date: new Date('2026-04-20T00:00:00.000Z'),
      difficulty: 'medium',
      history: 'History',
      symptoms: ['wheezing'],
      labs: null,
      clues: [],
      explanation: {},
      differentials: [],
      diagnosisId: 'diagnosis-1',
      diagnosisRegistryId: 'registry-1',
      proposedDiagnosisText: 'Acute asthma',
      diagnosisMappingStatus: DiagnosisMappingStatus.MATCHED,
      diagnosisMappingMethod: DiagnosisMappingMethod.EDITOR_SELECTED,
      diagnosisMappingConfidence: 1,
      diagnosisEditorialNote: 'Confirmed with registry',
      editorialStatus: CaseEditorialStatus.REVIEW,
      approvedAt: null,
      approvedByUserId: null,
      currentRevisionId: 'revision-3',
      diagnosis: {
        id: 'diagnosis-1',
        name: 'Asthma',
        system: 'legacy',
      },
      diagnosisRegistry: {
        id: 'registry-1',
        canonicalName: 'Asthma',
        status: 'ACTIVE',
        category: 'Pulmonology',
        specialty: null,
      },
      currentRevision: null,
      validationRuns: [],
      reviews: [],
    });

    const detail = await fixture.service.getCaseDetail('case-1');

    expect(detail).toEqual(
      expect.objectContaining({
        proposedDiagnosisText: 'Acute asthma',
        diagnosisRegistryId: 'registry-1',
        diagnosisMappingStatus: DiagnosisMappingStatus.MATCHED,
        diagnosisMappingMethod: DiagnosisMappingMethod.EDITOR_SELECTED,
        diagnosisMappingConfidence: 1,
        diagnosisEditorialNote: 'Confirmed with registry',
        diagnosisRegistrySummary: {
          id: 'registry-1',
          canonicalName: 'Asthma',
          status: 'ACTIVE',
          category: 'Pulmonology',
          specialty: null,
        },
        diagnosisPublishReadiness: {
          ready: true,
        },
      }),
    );
  });

  it('links an existing diagnosis to a case and preserves diagnosis provenance', async () => {
    const fixture = createFixture();
    fixture.prisma.case.findUnique
      .mockResolvedValueOnce({
        id: 'case-1',
        editorialStatus: CaseEditorialStatus.REVIEW,
        proposedDiagnosisText: 'Acute asthma',
        diagnosisEditorialNote: 'Prior note',
      })
      .mockResolvedValueOnce({
        id: 'case-1',
        title: 'Case title',
        date: new Date('2026-04-20T00:00:00.000Z'),
        difficulty: 'medium',
        history: 'History',
        symptoms: ['cough'],
        labs: null,
        clues: [],
        explanation: {},
        differentials: [],
        diagnosisId: 'diagnosis-1',
        diagnosisRegistryId: 'registry-1',
        proposedDiagnosisText: 'Acute asthma',
        diagnosisMappingStatus: DiagnosisMappingStatus.MATCHED,
        diagnosisMappingMethod: DiagnosisMappingMethod.EDITOR_SELECTED,
        diagnosisMappingConfidence: 1,
        diagnosisEditorialNote: 'Linked by editor',
        editorialStatus: CaseEditorialStatus.VALIDATED,
        approvedAt: null,
        approvedByUserId: null,
        currentRevisionId: 'revision-new',
        diagnosis: {
          id: 'diagnosis-1',
          name: 'Asthma',
          system: 'legacy',
        },
        diagnosisRegistry: {
          id: 'registry-1',
          canonicalName: 'Asthma',
          status: 'ACTIVE',
          category: 'Pulmonology',
          specialty: null,
        },
        currentRevision: null,
        validationRuns: [],
        reviews: [],
      });
    fixture.prisma.case.update
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ id: 'case-1' });
    fixture.prisma.caseValidationRun.create.mockResolvedValue({
      id: 'validation-1',
      revisionId: 'revision-new',
      outcome: ValidationOutcome.PASSED,
      validatorVersion: 'shadow:v1',
      summary: { summary: true },
      findings: { findings: true },
      startedAt: new Date('2026-04-20T00:00:00.000Z'),
      completedAt: new Date('2026-04-20T00:00:01.000Z'),
    });

    const result = await fixture.service.linkDiagnosisToCase('case-1', 'user-1', {
      diagnosisRegistryId: 'registry-1',
      diagnosisEditorialNote: 'Linked by editor',
    });

    expect(
      fixture.diagnosisRegistryEditorialService.getLinkableDiagnosisRegistry,
    ).toHaveBeenCalledWith('registry-1', fixture.prisma);
    expect(fixture.prisma.case.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: 'case-1' },
        data: expect.objectContaining({
          diagnosisId: 'diagnosis-1',
          diagnosisRegistryId: 'registry-1',
          proposedDiagnosisText: 'Acute asthma',
          diagnosisMappingStatus: DiagnosisMappingStatus.MATCHED,
          diagnosisMappingMethod: DiagnosisMappingMethod.EDITOR_SELECTED,
          diagnosisMappingConfidence: 1,
          diagnosisEditorialNote: 'Linked by editor',
        }),
      }),
    );
    expect(
      fixture.caseRevisionService.createRevisionFromSnapshotInTransaction,
    ).toHaveBeenCalledWith(
      fixture.prisma,
      expect.objectContaining({
        source: CaseSource.ADMIN_EDIT,
        createdByUserId: 'user-1',
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        diagnosisRegistryId: 'registry-1',
        proposedDiagnosisText: 'Acute asthma',
        diagnosisMappingMethod: DiagnosisMappingMethod.EDITOR_SELECTED,
      }),
    );
  });

  it('creates a diagnosis and links it with manual-created mapping metadata', async () => {
    const fixture = createFixture();
    fixture.diagnosisRegistryEditorialService.createDiagnosis.mockResolvedValue({
      diagnosisId: 'diagnosis-9',
      diagnosisRegistryId: 'registry-9',
      mappingMethod: DiagnosisMappingMethod.MANUAL_CREATED,
      registry: {
        id: 'registry-9',
        canonicalName: 'Granulomatosis with polyangiitis',
        status: 'ACTIVE',
        category: 'Rheumatology',
        specialty: null,
        searchPriority: 0,
        aliasPreview: ['Wegener granulomatosis'],
      },
    });
    fixture.diagnosisRegistryEditorialService.getLinkableDiagnosisRegistry.mockResolvedValue({
      diagnosisId: 'diagnosis-9',
      diagnosisRegistryId: 'registry-9',
      registry: {
        id: 'registry-9',
        canonicalName: 'Granulomatosis with polyangiitis',
        status: 'ACTIVE',
        category: 'Rheumatology',
        specialty: null,
        searchPriority: 0,
        aliasPreview: ['Wegener granulomatosis'],
      },
    });
    fixture.prisma.case.findUnique
      .mockResolvedValueOnce({
        id: 'case-1',
        editorialStatus: CaseEditorialStatus.NEEDS_EDIT,
        proposedDiagnosisText: 'Wegener granulomatosis',
        diagnosisEditorialNote: null,
      })
      .mockResolvedValueOnce({
        id: 'case-1',
        title: 'Case title',
        date: new Date('2026-04-20T00:00:00.000Z'),
        difficulty: 'medium',
        history: 'History',
        symptoms: ['epistaxis'],
        labs: null,
        clues: [],
        explanation: {},
        differentials: [],
        diagnosisId: 'diagnosis-9',
        diagnosisRegistryId: 'registry-9',
        proposedDiagnosisText: 'Wegener granulomatosis',
        diagnosisMappingStatus: DiagnosisMappingStatus.MATCHED,
        diagnosisMappingMethod: DiagnosisMappingMethod.MANUAL_CREATED,
        diagnosisMappingConfidence: 1,
        diagnosisEditorialNote: 'Created while reviewing case',
        editorialStatus: CaseEditorialStatus.VALIDATED,
        approvedAt: null,
        approvedByUserId: null,
        currentRevisionId: 'revision-new',
        diagnosis: {
          id: 'diagnosis-9',
          name: 'Granulomatosis with polyangiitis',
          system: 'legacy',
        },
        diagnosisRegistry: {
          id: 'registry-9',
          canonicalName: 'Granulomatosis with polyangiitis',
          status: 'ACTIVE',
          category: 'Rheumatology',
          specialty: null,
        },
        currentRevision: null,
        validationRuns: [],
        reviews: [],
      });
    fixture.prisma.case.update
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ id: 'case-1' });
    fixture.prisma.caseValidationRun.create.mockResolvedValue({
      id: 'validation-1',
      revisionId: 'revision-new',
      outcome: ValidationOutcome.PASSED,
      validatorVersion: 'shadow:v1',
      summary: { summary: true },
      findings: { findings: true },
      startedAt: new Date('2026-04-20T00:00:00.000Z'),
      completedAt: new Date('2026-04-20T00:00:01.000Z'),
    });

    const result = await fixture.service.createAndLinkDiagnosis('case-1', 'user-1', {
      canonicalName: 'Granulomatosis with polyangiitis',
      aliases: ['Wegener granulomatosis'],
      category: 'Rheumatology',
      diagnosisEditorialNote: 'Created while reviewing case',
    });

    expect(
      fixture.diagnosisRegistryEditorialService.createDiagnosis,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        canonicalName: 'Granulomatosis with polyangiitis',
        aliases: ['Wegener granulomatosis'],
        category: 'Rheumatology',
      }),
      fixture.prisma,
    );
    expect(fixture.prisma.case.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          diagnosisMappingMethod: DiagnosisMappingMethod.MANUAL_CREATED,
          diagnosisRegistryId: 'registry-9',
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        diagnosisRegistryId: 'registry-9',
        diagnosisMappingMethod: DiagnosisMappingMethod.MANUAL_CREATED,
      }),
    );
  });

  it('restoring a revision keeps diagnosis and diagnosisRegistry linkage synchronized', async () => {
    const fixture = createFixture();
    fixture.prisma.case.findUnique.mockResolvedValueOnce({
      id: 'case-1',
      editorialStatus: CaseEditorialStatus.REVIEW,
    });
    fixture.prisma.caseRevision.findFirst.mockResolvedValue({
      id: 'revision-old',
      revisionNumber: 3,
      title: 'Restored case',
      date: new Date('2026-04-20T00:00:00.000Z'),
      difficulty: 'medium',
      history: 'History',
      symptoms: ['cough'],
      labs: null,
      clues: [],
      explanation: {},
      differentials: [],
      diagnosisId: 'diagnosis-1',
      diagnosisRegistryId: null,
      proposedDiagnosisText: 'Asthma',
      diagnosisMappingStatus: DiagnosisMappingStatus.MATCHED,
      diagnosisMappingMethod: DiagnosisMappingMethod.LEGACY_BACKFILL,
      diagnosisMappingConfidence: 1,
      diagnosisEditorialNote: null,
    });
    fixture.prisma.case.update
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({
        id: 'case-1',
        editorialStatus: CaseEditorialStatus.VALIDATED,
        approvedAt: null,
        approvedByUserId: null,
        currentRevisionId: 'revision-new',
      });
    fixture.prisma.caseValidationRun.create.mockResolvedValue({
      id: 'validation-1',
      outcome: ValidationOutcome.PASSED,
      validatorVersion: 'shadow:v1',
      startedAt: new Date('2026-04-20T00:00:00.000Z'),
      completedAt: new Date('2026-04-20T00:00:01.000Z'),
    });

    await fixture.service.restoreRevision('case-1', 'revision-old', 'user-1');

    expect(fixture.diagnosisRegistryLinkService.resolveForWrite).toHaveBeenCalledWith(
      {
        diagnosisId: 'diagnosis-1',
        diagnosisRegistryId: null,
      },
      fixture.prisma,
    );
    expect(fixture.prisma.case.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: 'case-1' },
        data: expect.objectContaining({
          diagnosisId: 'diagnosis-1',
          diagnosisRegistryId: 'registry-1',
          proposedDiagnosisText: 'Asthma',
          diagnosisMappingStatus: DiagnosisMappingStatus.MATCHED,
          diagnosisMappingMethod: DiagnosisMappingMethod.LEGACY_BACKFILL,
          diagnosisMappingConfidence: 1,
          diagnosisEditorialNote: null,
        }),
      }),
    );
  });

  it('marks an approved diagnosis-ready case as ready to publish', async () => {
    const fixture = createFixture();
    fixture.prisma.case.findUnique.mockResolvedValue({
      id: 'case-1',
      editorialStatus: CaseEditorialStatus.APPROVED,
      approvedAt: new Date('2026-04-20T00:00:00.000Z'),
      approvedByUserId: 'reviewer-1',
      diagnosisRegistryId: 'registry-1',
      diagnosisMappingStatus: DiagnosisMappingStatus.MATCHED,
      diagnosisRegistry: {
        status: 'ACTIVE',
      },
    });
    fixture.prisma.case.update.mockResolvedValue({
      id: 'case-1',
      editorialStatus: CaseEditorialStatus.READY_TO_PUBLISH,
      approvedAt: new Date('2026-04-20T00:00:00.000Z'),
      approvedByUserId: 'reviewer-1',
      currentRevisionId: 'revision-1',
    });

    const result = await fixture.service.markReadyToPublish('case-1');

    expect(result.editorialStatus).toBe(CaseEditorialStatus.READY_TO_PUBLISH);
    expect(fixture.prisma.case.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'case-1' },
        data: {
          editorialStatus: CaseEditorialStatus.READY_TO_PUBLISH,
        },
      }),
    );
  });

  it('blocks ready-to-publish when diagnosis readiness is unresolved', async () => {
    const fixture = createFixture();
    fixture.prisma.case.findUnique.mockResolvedValue({
      id: 'case-1',
      editorialStatus: CaseEditorialStatus.APPROVED,
      approvedAt: new Date('2026-04-20T00:00:00.000Z'),
      approvedByUserId: 'reviewer-1',
      diagnosisRegistryId: null,
      diagnosisMappingStatus: DiagnosisMappingStatus.UNRESOLVED,
      diagnosisRegistry: null,
    });

    await expect(fixture.service.markReadyToPublish('case-1')).rejects.toThrow(
      'Case diagnosis is not ready for publish: missing_registry_link',
    );
    expect(fixture.prisma.case.update).not.toHaveBeenCalled();
  });
});
