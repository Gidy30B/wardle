import { CaseEditorialStatus, CaseSource } from '@prisma/client';
import { CaseRevisionService } from './case-revision.service';
import type { CaseRevisionSnapshot } from './case-validation.types';

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

  function revisionSnapshot(
    overrides: Partial<CaseRevisionSnapshot> = {},
  ): CaseRevisionSnapshot {
    return {
      caseId: 'case-1',
      title: 'Asthma case',
      date: new Date('2026-04-20T00:00:00.000Z'),
      difficulty: 'medium',
      history: 'Wheezing',
      symptoms: ['wheezing'],
      labs: null,
      clues: [{ key: 'clue-1', type: 'history', value: 'Wheeze' }],
      explanation: {},
      differentials: [],
      diagnosisId: 'diagnosis-1',
      diagnosisRegistryId: 'registry-1',
      proposedDiagnosisText: 'Asthma',
      diagnosisMappingStatus: 'MATCHED',
      diagnosisMappingMethod: 'EDITOR_SELECTED',
      diagnosisMappingConfidence: 1,
      diagnosisEditorialNote: null,
      ...overrides,
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

  it('creates an APP-007 revision with lineage, content hash, idempotency, and approval reset', async () => {
    const fixture = createFixture();
    const tx: any = {
      case: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'case-1',
          currentRevisionId: 'revision-1',
          editorialStatus: CaseEditorialStatus.APPROVED,
          dailyCases: [],
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      caseRevision: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({
            id: 'revision-1',
            clues: [{ key: 'clue-1', type: 'history', value: 'Wheeze' }],
          })
          .mockResolvedValueOnce({ revisionNumber: 1 }),
        create: jest.fn().mockResolvedValue(undefined),
      },
      caseRevisionCreationCommand: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(undefined),
        update: jest.fn().mockResolvedValue(undefined),
      },
    };

    const result = await fixture.service.createCaseRevisionCommandInTransaction(
      tx,
      {
        caseId: 'case-1',
        expectedRevisionId: 'revision-1',
        commandIdempotencyKey: 'create-revision-1',
        snapshot: revisionSnapshot({ title: 'Updated asthma case' }),
        source: CaseSource.ADMIN_EDIT,
        createdByUserId: 'user-1',
        changeReason: 'Correct diagnosis mapping',
        changeSummary: 'Updated diagnosis material',
        editorialStatusAfterProjection: CaseEditorialStatus.VALIDATED,
      },
    );

    expect(result.contentHash).toEqual(expect.any(String));
    expect(tx.caseRevision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          contentHash: result.contentHash,
          createdFromRevisionId: 'revision-1',
          changeReason: 'Correct diagnosis mapping',
          changeSummary: 'Updated diagnosis material',
          title: 'Updated asthma case',
        }),
      }),
    );
    expect(tx.case.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'case-1', currentRevisionId: 'revision-1' },
        data: expect.objectContaining({
          currentRevisionId: result.revisionId,
          approvedAt: null,
          approvedByUserId: null,
          editorialStatus: CaseEditorialStatus.VALIDATED,
        }),
      }),
    );
    expect(tx.caseRevisionCreationCommand.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { commandIdempotencyKey: 'create-revision-1' },
        data: expect.objectContaining({
          status: 'SUCCESS',
          resultRevisionId: result.revisionId,
        }),
      }),
    );
  });

  it('rejects stale expected revisions before mutation', async () => {
    const fixture = createFixture();
    const tx: any = {
      case: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'case-1',
          currentRevisionId: 'revision-2',
          editorialStatus: CaseEditorialStatus.VALIDATED,
          dailyCases: [],
        }),
      },
      caseRevision: { create: jest.fn() },
      caseRevisionCreationCommand: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };

    await expect(
      fixture.service.createCaseRevisionCommandInTransaction(tx, {
        caseId: 'case-1',
        expectedRevisionId: 'revision-1',
        commandIdempotencyKey: 'stale',
        snapshot: revisionSnapshot(),
        source: CaseSource.ADMIN_EDIT,
        changeReason: 'reason',
        changeSummary: 'summary',
      }),
    ).rejects.toThrow('Stale CREATE_CASE_REVISION');
    expect(tx.caseRevision.create).not.toHaveBeenCalled();
  });

  it('replays equivalent idempotent retries after current revision advanced', async () => {
    const fixture = createFixture();
    const snapshot = revisionSnapshot();
    const input = {
      caseId: 'case-1',
      expectedRevisionId: 'revision-1',
      commandIdempotencyKey: 'retry',
      snapshot,
      source: CaseSource.ADMIN_EDIT,
      changeReason: 'reason',
      changeSummary: 'summary',
    } as const;
    const commandFingerprint =
      fixture.service.buildCreateCaseRevisionCommandFingerprint(input);
    const tx: any = {
      case: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'case-1',
          currentRevisionId: 'revision-2',
          editorialStatus: CaseEditorialStatus.VALIDATED,
          dailyCases: [],
        }),
      },
      caseRevision: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'revision-2',
          revisionNumber: 2,
          contentHash: 'content-hash',
          ...snapshot,
          clues: [{ key: 'generated-key', type: 'history', value: 'Wheeze' }],
        }),
        create: jest.fn(),
      },
      caseRevisionCreationCommand: {
        findUnique: jest.fn().mockResolvedValue({
          commandFingerprint,
          resultRevisionId: 'revision-2',
          status: 'SUCCESS',
        }),
        create: jest.fn(),
      },
    };

    const replay = await fixture.service.createCaseRevisionCommandInTransaction(
      tx,
      input,
    );

    expect(replay.revisionId).toBe('revision-2');
    expect(replay.snapshot.clues).toEqual([
      { key: 'generated-key', type: 'history', value: 'Wheeze' },
    ]);
    expect(tx.caseRevision.create).not.toHaveBeenCalled();
  });

  it('rejects the same idempotency key with a different fingerprint', async () => {
    const fixture = createFixture();
    const input = {
      caseId: 'case-1',
      expectedRevisionId: 'revision-1',
      commandIdempotencyKey: 'retry',
      snapshot: revisionSnapshot(),
      source: CaseSource.ADMIN_EDIT,
      changeReason: 'reason',
      changeSummary: 'summary',
    } as const;
    const tx: any = {
      case: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'case-1',
          currentRevisionId: 'revision-2',
          editorialStatus: CaseEditorialStatus.VALIDATED,
          dailyCases: [],
        }),
      },
      caseRevision: { create: jest.fn() },
      caseRevisionCreationCommand: {
        findUnique: jest.fn().mockResolvedValue({
          commandFingerprint: 'different',
          resultRevisionId: 'revision-2',
          status: 'SUCCESS',
        }),
      },
    };

    await expect(
      fixture.service.createCaseRevisionCommandInTransaction(tx, input),
    ).rejects.toThrow('idempotency key conflicts');
    expect(tx.caseRevision.create).not.toHaveBeenCalled();
  });

  it('keeps command fingerprint deterministic for keyless new clues', () => {
    const fixture = createFixture();
    const input = {
      caseId: 'case-1',
      expectedRevisionId: 'revision-1',
      commandIdempotencyKey: 'keyless',
      snapshot: revisionSnapshot({
        clues: [{ type: 'exam', value: 'Prolonged expiratory phase' }],
      }),
      source: CaseSource.ADMIN_EDIT,
      changeReason: 'reason',
      changeSummary: 'summary',
    } as const;

    expect(
      fixture.service.buildCreateCaseRevisionCommandFingerprint(input),
    ).toBe(fixture.service.buildCreateCaseRevisionCommandFingerprint(input));
  });

  it('blocks scheduled or learner-exposable cases', async () => {
    const fixture = createFixture();
    const tx: any = {
      case: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'case-1',
          currentRevisionId: 'revision-1',
          editorialStatus: CaseEditorialStatus.VALIDATED,
          dailyCases: [{ id: 'daily-1' }],
        }),
      },
      caseRevision: { create: jest.fn() },
      caseRevisionCreationCommand: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };

    await expect(
      fixture.service.createCaseRevisionCommandInTransaction(tx, {
        caseId: 'case-1',
        expectedRevisionId: 'revision-1',
        commandIdempotencyKey: 'scheduled',
        snapshot: revisionSnapshot(),
        source: CaseSource.ADMIN_EDIT,
        changeReason: 'reason',
        changeSummary: 'summary',
      }),
    ).rejects.toThrow('blocked for scheduled or learner-exposable cases');
    expect(tx.caseRevision.create).not.toHaveBeenCalled();
  });
});
