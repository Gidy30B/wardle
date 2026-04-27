import { CaseSource } from '@prisma/client';
import { CaseRevisionService } from './case-revision.service';

describe('CaseRevisionService', () => {
  function createFixture() {
    const editorialMetrics = {
      recordRevisionCreated: jest.fn(),
    };
    const diagnosisRegistryLinkService = {
      resolveForWrite: jest.fn().mockResolvedValue({
        diagnosisId: 'diagnosis-1',
        diagnosisName: 'Asthma',
        diagnosisRegistryId: 'registry-1',
      }),
    };

    return {
      editorialMetrics,
      diagnosisRegistryLinkService,
      service: new CaseRevisionService(
        editorialMetrics as never,
        diagnosisRegistryLinkService as never,
      ),
    };
  }

  it('repairs missing case registry linkage while building a snapshot', async () => {
    const fixture = createFixture();
    const tx: any = {
      case: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'case-1',
          title: 'Asthma case',
          date: new Date('2026-04-20T00:00:00.000Z'),
          difficulty: 'medium',
          history: 'Wheezing',
          symptoms: ['wheezing'],
          labs: null,
          clues: [],
          explanation: {},
          differentials: [],
          diagnosisId: 'diagnosis-1',
          diagnosisRegistryId: null,
          proposedDiagnosisText: 'Asthma',
          diagnosisMappingStatus: 'MATCHED',
          diagnosisMappingMethod: 'LEGACY_BACKFILL',
          diagnosisMappingConfidence: 1,
          diagnosisEditorialNote: null,
        }),
        update: jest.fn().mockResolvedValue(undefined),
      },
    };

    const snapshot = await fixture.service.getCurrentCaseSnapshotInTransaction(
      tx,
      'case-1',
    );

    expect(fixture.diagnosisRegistryLinkService.resolveForWrite).toHaveBeenCalledWith(
      {
        diagnosisId: 'diagnosis-1',
        diagnosisRegistryId: null,
      },
      tx,
    );
    expect(tx.case.update).toHaveBeenCalledWith({
      where: { id: 'case-1' },
      data: {
        diagnosisRegistryId: 'registry-1',
      },
    });
    expect(snapshot.diagnosisRegistryId).toBe('registry-1');
    expect(snapshot.proposedDiagnosisText).toBe('Asthma');
    expect(snapshot.diagnosisMappingStatus).toBe('MATCHED');
  });

  it('persists diagnosisRegistryId into new revisions', async () => {
    const fixture = createFixture();
    const tx: any = {
      caseRevision: {
        findFirst: jest.fn().mockResolvedValue({
          revisionNumber: 2,
        }),
        create: jest.fn().mockResolvedValue(undefined),
      },
      case: {
        update: jest.fn().mockResolvedValue(undefined),
      },
    };

    await fixture.service.createRevisionFromSnapshotInTransaction(tx, {
      caseId: 'case-1',
      source: CaseSource.ADMIN_EDIT,
      snapshot: {
        caseId: 'case-1',
        title: 'Asthma case',
        date: new Date('2026-04-20T00:00:00.000Z'),
        difficulty: 'medium',
        history: 'Wheezing',
        symptoms: ['wheezing'],
        labs: null,
        clues: [],
        explanation: {},
        differentials: [],
        diagnosisId: 'diagnosis-1',
        diagnosisRegistryId: 'registry-1',
        proposedDiagnosisText: 'Asthma',
        diagnosisMappingStatus: 'MATCHED',
        diagnosisMappingMethod: 'LEGACY_BACKFILL',
        diagnosisMappingConfidence: 1,
        diagnosisEditorialNote: null,
      },
    });

    expect(tx.caseRevision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          diagnosisId: 'diagnosis-1',
          diagnosisRegistryId: 'registry-1',
          proposedDiagnosisText: 'Asthma',
          diagnosisMappingStatus: 'MATCHED',
          diagnosisMappingMethod: 'LEGACY_BACKFILL',
          diagnosisMappingConfidence: 1,
          diagnosisEditorialNote: null,
        }),
      }),
    );
  });
});
