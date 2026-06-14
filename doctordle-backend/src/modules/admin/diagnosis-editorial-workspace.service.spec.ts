import { NotFoundException } from '@nestjs/common';
import { CaseEditorialStatus } from '@prisma/client';
import { DiagnosisEditorialWorkspaceService } from './diagnosis-editorial-workspace.service';

describe('DiagnosisEditorialWorkspaceService', () => {
  const diagnosisRegistryId = 'diagnosis-1';
  const now = new Date('2026-06-01T12:00:00.000Z');
  let prisma: {
    diagnosisRegistry: { findUnique: jest.Mock };
    reasoningDraftValidationRun: { findMany: jest.Mock };
    caseLearningGoalCoverage: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      upsert: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    caseEscalationAnnotation: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      upsert: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    caseClueDiscriminatorAnnotation: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    caseClueRevisionDraft: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    aiDraftRevisionAudit: {
      findMany: jest.Mock;
      create: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    diagnosisEducation: { findUnique: jest.Mock; update: jest.Mock };
    case: { findFirst: jest.Mock; update: jest.Mock };
    caseRevision: { findFirst: jest.Mock; create: jest.Mock };
    caseClueProgressionAnalysis: { deleteMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let qualityService: { getSummary: jest.Mock };
  let coverageService: { getCoverage: jest.Mock };
  let teachingRulesService: { listRules: jest.Mock };
  let briefService: { getBrief: jest.Mock };
  let revisionAnalyzer: { listRevisions: jest.Mock };
  let caseQualityProjectionService: { buildProjection: jest.Mock };
  let graphCandidatesService: { listCandidates: jest.Mock };
  let service: DiagnosisEditorialWorkspaceService;

  beforeEach(() => {
    prisma = {
      diagnosisRegistry: {
        findUnique: jest.fn(),
      },
      reasoningDraftValidationRun: {
        findMany: jest.fn(),
      },
      caseLearningGoalCoverage: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      caseEscalationAnnotation: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      caseClueDiscriminatorAnnotation: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      caseClueRevisionDraft: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      aiDraftRevisionAudit: {
        findMany: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      diagnosisEducation: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      case: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      caseRevision: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      caseClueProgressionAnalysis: {
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prisma)),
    };
    qualityService = {
      getSummary: jest.fn(),
    };
    coverageService = {
      getCoverage: jest.fn(),
    };
    teachingRulesService = {
      listRules: jest.fn(),
    };
    briefService = {
      getBrief: jest.fn(),
    };
    revisionAnalyzer = {
      listRevisions: jest.fn(),
    };
    caseQualityProjectionService = {
      buildProjection: jest.fn().mockReturnValue({
        dimensions: {},
        warnings: [],
        blockers: [],
        sourceSummary: {
          hasValidationRun: false,
          hasValidationFindings: false,
          hasGenerationQuality: false,
          hasTeachingAlignment: false,
        },
      }),
    };
    graphCandidatesService = {
      listCandidates: jest.fn(),
    };
    service = new DiagnosisEditorialWorkspaceService(
      prisma as never,
      qualityService as never,
      coverageService as never,
      teachingRulesService as never,
      briefService as never,
      revisionAnalyzer as never,
      caseQualityProjectionService as never,
      graphCandidatesService as never,
    );

    prisma.diagnosisRegistry.findUnique.mockResolvedValue(registry());
    prisma.reasoningDraftValidationRun.findMany.mockResolvedValue([]);
    prisma.caseLearningGoalCoverage.findMany.mockResolvedValue([]);
    prisma.caseEscalationAnnotation.findMany.mockResolvedValue([]);
    prisma.caseClueDiscriminatorAnnotation.findMany.mockResolvedValue([]);
    prisma.caseClueDiscriminatorAnnotation.create.mockImplementation(({ data }) =>
      Promise.resolve({
        id: 'disc-1',
        ...data,
        reviewedAt: now,
        createdAt: now,
        updatedAt: now,
      }),
    );
    prisma.caseClueDiscriminatorAnnotation.update.mockImplementation(({ data }) =>
      Promise.resolve({
        id: 'disc-1',
        caseId: 'case-1',
        ...data,
        createdAt: now,
        updatedAt: now,
      }),
    );
    prisma.caseClueDiscriminatorAnnotation.delete.mockResolvedValue({ id: 'disc-1' });
    prisma.caseClueRevisionDraft.findUnique.mockResolvedValue(null);
    prisma.caseClueRevisionDraft.create.mockResolvedValue({ id: 'draft-1' });
    prisma.caseClueRevisionDraft.update.mockImplementation(({ data }) =>
      Promise.resolve({
        id: 'draft-1',
        caseId: 'case-1',
        sourceAuditId: 'audit-disc-1',
        clueOrder: 1,
        clueIndex: 1,
        originalClue: 'Original clue',
        revisedClue: data.revisedClue ?? 'Revised clue',
        addedClue: data.addedClue ?? null,
        rationale: data.rationale ?? null,
        expectedEffect: data.expectedEffect ?? null,
        status: data.status ?? 'PENDING_REVIEW',
        reviewerUserId: data.reviewerUserId ?? null,
        decisionAt: data.decisionAt ?? null,
        decisionByUserId: data.decisionByUserId ?? null,
        decisionNote: data.decisionNote ?? null,
        appliedAt: data.appliedAt ?? null,
        appliedByUserId: data.appliedByUserId ?? null,
        createdAt: now,
        updatedAt: now,
      }),
    );
    prisma.aiDraftRevisionAudit.findMany.mockResolvedValue([]);
    prisma.aiDraftRevisionAudit.create.mockResolvedValue({
      id: 'repair-1',
      reviewStatus: 'PENDING_REVIEW',
    });
    prisma.aiDraftRevisionAudit.findFirst.mockResolvedValue(null);
    prisma.aiDraftRevisionAudit.update.mockResolvedValue({
      id: 'audit-1',
      reviewStatus: 'ACCEPTED',
    });
    prisma.diagnosisEducation.findUnique.mockResolvedValue({
      id: 'education-1',
      editorialStatus: 'DRAFT',
      management: [],
    });
    prisma.diagnosisEducation.update.mockResolvedValue({ id: 'education-1' });
    prisma.case.findFirst.mockResolvedValue({ id: 'case-1' });
    prisma.case.update.mockResolvedValue(caseSnapshot());
    prisma.caseRevision.findFirst.mockResolvedValue({ revisionNumber: 1 });
    prisma.caseRevision.create.mockResolvedValue({ id: 'revision-2' });
    prisma.caseClueProgressionAnalysis.deleteMany.mockResolvedValue({ count: 1 });
    qualityService.getSummary.mockResolvedValue(summary());
    coverageService.getCoverage.mockResolvedValue(coverage());
    teachingRulesService.listRules.mockResolvedValue({
      diagnosisRegistryId,
      diagnosisName: 'Appendicitis',
      rules: [rule()],
    });
    briefService.getBrief.mockResolvedValue({
      diagnosisRegistryId,
      diagnosisName: 'Appendicitis',
      brief: brief(),
    });
    revisionAnalyzer.listRevisions.mockResolvedValue({
      diagnosisRegistryId,
      revisions: [revision()],
    });
    graphCandidatesService.listCandidates.mockResolvedValue([]);
  });

  it('returns a complete unified projection for a diagnosis with full workspace data', async () => {
    const result = await service.getFullWorkspace(diagnosisRegistryId);

    expect(result.diagnosis.displayLabel).toBe('Appendicitis');
    expect(result.lifecycle.ready).toBe('complete');
    expect(result.workspaceSummary.status).toBe('ready');
    expect(result.coverageMatrix).toEqual([
      expect.objectContaining({
        teachingRuleId: 'rule-1',
        stableKey: 'rule_key',
        fullCoverageStatus: 'covered',
      }),
    ]);
    expect(result.teachingRules.summary.active).toBe(1);
    expect(result.editorialBrief.activeForGeneration).toBe(true);
    expect(result.education.id).toBe('education-1');
    expect(result.cases.summary.usable).toBe(1);
    expect(result.graph.readiness).toBe('fact_ready');
    expect(result.maturityBreakdown).toEqual(
      expect.objectContaining({ overall: expect.any(Number) }),
    );
  });

  it('includes clue discriminator annotations and applies editorial override', async () => {
    prisma.diagnosisRegistry.findUnique.mockResolvedValue(
      registry({
        cases: [
          {
            id: 'case-1',
            title: 'Meal-timed epigastric pain',
            difficulty: 'medium',
            editorialStatus: CaseEditorialStatus.APPROVED,
            date: now,
            clues: [
              { type: 'history', value: 'Epigastric pain after meals.', order: 0 },
              {
                type: 'history',
                value: 'Delayed post-meal timing without reflux pattern.',
                order: 1,
              },
            ],
            differentials: ['GERD'],
            explanation: {},
            validationRuns: [],
            clueProgressionAnalyses: [],
            clueDiscriminatorAnnotations: [
              {
                id: 'disc-1',
                caseId: 'case-1',
                clueOrder: 2,
                clueIndex: 2,
                eliminatedDiagnosisId: null,
                eliminatedDiagnosisName: 'GERD',
                discriminator: 'Delayed post-meal timing separates from reflux-pattern disease',
                reasoning: 'Timing points away from reflux.',
                eliminationStrength: 'strong',
                educationalValue: 'high',
                reviewerUserId: 'editor-1',
                reviewedAt: now,
                createdAt: now,
                updatedAt: now,
              },
            ],
          },
        ],
      }),
    );

    const result = await service.getFullWorkspace(diagnosisRegistryId);
    const caseItem = result.cases.items[0];

    expect(caseItem.clueDiscriminatorAnnotations).toEqual([
      expect.objectContaining({
        id: 'disc-1',
        eliminatedDiagnosisName: 'GERD',
      }),
    ]);
    expect(caseItem.clueProgression.differentialElimination).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          mimicName: 'GERD',
          annotationSource: 'editorial',
          annotationId: 'disc-1',
          finalStatus: 'eliminated',
        }),
      ]),
    );
    expect(
      caseItem.clueProgression.explicitDiscriminatorAnnotationCount,
    ).toBe(1);
  });

  it('creates, updates, and deletes discriminator annotations', async () => {
    const created = await service.createDiscriminatorAnnotation(
      'case-1',
      {
        clueOrder: 2,
        eliminatedDiagnosisName: 'GERD',
        discriminator: 'Delayed post-meal timing',
        eliminationStrength: 'moderate',
        educationalValue: 'high',
      },
      'editor-1',
    );

    prisma.caseClueDiscriminatorAnnotation.findFirst.mockResolvedValue({
      id: 'disc-1',
      caseId: 'case-1',
      clueOrder: 2,
      clueIndex: null,
      eliminatedDiagnosisId: null,
      eliminatedDiagnosisName: 'GERD',
      discriminator: 'Delayed post-meal timing',
      reasoning: null,
      eliminationStrength: 'moderate',
      educationalValue: 'high',
      reviewerUserId: 'editor-1',
      reviewedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    const updated = await service.updateDiscriminatorAnnotation(
      'case-1',
      'disc-1',
      { discriminator: 'No reflux pattern' },
      'editor-2',
    );
    const deleted = await service.deleteDiscriminatorAnnotation(
      'case-1',
      'disc-1',
      'editor-2',
    );

    expect(created).toEqual(expect.objectContaining({ id: 'disc-1' }));
    expect(updated).toEqual(
      expect.objectContaining({ discriminator: 'No reflux pattern' }),
    );
    expect(deleted).toEqual({ deleted: true, id: 'disc-1' });
  });

  it('returns unsupported claims grouped by section', async () => {
    prisma.reasoningDraftValidationRun.findMany.mockResolvedValue([
      {
        id: 'run-1',
        artifactType: 'EDUCATION_SECTION',
        artifactId: 'education-1',
        trustTier: 'BLOCKED',
        validationStatus: 'FAILED',
        unsupportedClaimSignals: [
          {
            sectionId: 'management',
            sectionType: 'education',
            claimId: 'claim-1',
            claimText: 'Antibiotics always cure appendicitis',
            evidenceIds: ['evidence-1'],
          },
        ],
        createdAt: now,
      },
    ]);

    const result = await service.getFullWorkspace(diagnosisRegistryId);

    expect(result.unsupportedClaimsBySection).toEqual([
      expect.objectContaining({
        claimId: 'claim-1',
        sectionId: 'management',
        blocksPublication: true,
      }),
    ]);
    expect(result.editorialPrioritization.publicationRisk.score).toBeGreaterThan(0);
    expect(result.editorialPrioritization.highestImpactFixes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'repair_unsupported_claims',
          targetTab: 'education',
        }),
      ]),
    );
  });

  it('uses persisted case-to-learning-goal coverage when available', async () => {
    prisma.caseLearningGoalCoverage.findMany.mockResolvedValue([
      {
        caseId: 'case-1',
        case: { id: 'case-1', title: 'RLQ pain' },
        learningGoalId: 'goal-1',
        learningGoal: 'Distinguish appendicitis from ovarian torsion',
        coverageStrength: 85,
        coveredDiscriminators: ['migration'],
        missingDiscriminators: [],
        coveredMimics: ['torsion'],
        missingMimics: [],
        evidenceSource: 'editorial_annotation',
        updatedAt: now,
      },
    ]);

    const result = await service.getFullWorkspace(diagnosisRegistryId);

    expect(result.caseLearningGoalCoverage).toEqual([
      expect.objectContaining({
        caseId: 'case-1',
        learningGoalId: 'goal-1',
        coverageStrength: 85,
      }),
    ]);
    expect(result.learningGoalCoverage).toEqual([
      expect.objectContaining({
        learningGoalId: 'goal-1',
        coveredByCaseIds: ['case-1'],
        coveragePct: 85,
      }),
    ]);
  });

  it('uses explicit escalation annotations before inferred fallback', async () => {
    prisma.caseEscalationAnnotation.findMany.mockResolvedValue([
      {
        caseId: 'case-1',
        case: { id: 'case-1', title: 'RLQ pain' },
        escalationType: 'sepsis',
        covered: true,
        evidenceStrength: 90,
        reasoningPathId: null,
        notes: 'Explicitly reviewed',
        updatedAt: now,
      },
    ]);

    const result = await service.getFullWorkspace(diagnosisRegistryId);

    expect(result.caseEscalationCoverage).toEqual([
      expect.objectContaining({
        escalationType: 'sepsis',
        coverageSource: 'explicit',
        status: 'explicitly_covered',
      }),
    ]);
    expect(result.escalationCoverage.coversEscalation).toBe(true);
  });

  it('creates a draft audit entry for claim repair', async () => {
    prisma.reasoningDraftValidationRun.findMany.mockResolvedValue([
      {
        id: 'run-1',
        artifactType: 'EDUCATION_SECTION',
        artifactId: 'education-1',
        trustTier: 'BLOCKED',
        validationStatus: 'FAILED',
        unsupportedClaimSignals: [
          {
            sectionId: 'management',
            claimId: 'claim-1',
            claimText: 'Appendicitis always requires surgery',
            evidenceIds: ['evidence-1'],
          },
        ],
        createdAt: now,
      },
    ]);

    const result = await service.repairUnsupportedClaim({
      diagnosisRegistryId,
      claimId: 'claim-1',
      userId: 'admin-1',
    });

    expect(prisma.aiDraftRevisionAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actionType: 'repair_unsupported_claim',
          reviewStatus: 'PENDING_REVIEW',
          createdByUserId: 'admin-1',
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        repairId: 'repair-1',
        auditId: 'repair-1',
        targetClaimId: 'claim-1',
        targetSectionId: 'management',
        targetTab: 'education',
        originalClaim: 'Appendicitis always requires surgery',
        proposedClaim: expect.stringContaining('can'),
        reviewStatus: 'PENDING_REVIEW',
      }),
    );
  });

  it('accepts a draft repair and applies it only to a draft education artifact', async () => {
    prisma.aiDraftRevisionAudit.findFirst.mockResolvedValue({
      id: 'audit-1',
      diagnosisRegistryId,
      affectedArtifactType: 'EDUCATION_SECTION',
      affectedArtifactId: 'education-1',
      sourceIssue: { sectionId: 'management' },
      generatedOutput: {
        originalClaim: 'Appendicitis always requires surgery',
        proposedClaim: 'Appendicitis can require surgery.',
        evidenceIds: ['evidence-1'],
      },
    });

    await service.decideAiDraftRevision({
      diagnosisRegistryId,
      auditId: 'audit-1',
      decision: 'accept',
      userId: 'admin-1',
      note: 'Looks good',
    });

    expect(prisma.diagnosisEducation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'education-1' },
        data: expect.objectContaining({
          editorialStatus: 'DRAFT',
          management: expect.arrayContaining([
            expect.objectContaining({
              type: 'CLAIM_REPAIR',
              originalClaim: 'Appendicitis always requires surgery',
              acceptedClaim: 'Appendicitis can require surgery.',
              proposedClaim: 'Appendicitis can require surgery.',
              evidenceIds: ['evidence-1'],
              reviewerUserId: 'admin-1',
              sourceAuditId: 'audit-1',
            }),
          ]),
        }),
      }),
    );
    expect(prisma.aiDraftRevisionAudit.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reviewStatus: 'ACCEPTED',
          reviewerUserId: 'admin-1',
          reviewNote: 'Looks good',
        }),
      }),
    );
  });

  it('does not duplicate an accepted repair for the same audit', async () => {
    prisma.aiDraftRevisionAudit.findFirst.mockResolvedValue({
      id: 'audit-1',
      diagnosisRegistryId,
      affectedArtifactType: 'EDUCATION_SECTION',
      affectedArtifactId: 'education-1',
      sourceIssue: { sectionId: 'management' },
      generatedOutput: {
        originalClaim: 'Appendicitis always requires surgery',
        proposedClaim: 'Appendicitis can require surgery.',
        evidenceIds: ['evidence-1'],
      },
    });
    prisma.diagnosisEducation.findUnique.mockResolvedValue({
      id: 'education-1',
      editorialStatus: 'DRAFT',
      management: [
        {
          type: 'CLAIM_REPAIR',
          originalClaim: 'Appendicitis always requires surgery',
          acceptedClaim: 'Appendicitis can require surgery.',
          sourceAuditId: 'audit-1',
        },
      ],
    });

    await service.decideAiDraftRevision({
      diagnosisRegistryId,
      auditId: 'audit-1',
      decision: 'accept',
      userId: 'admin-1',
    });

    const updateArg = prisma.diagnosisEducation.update.mock.calls[0][0];
    expect(updateArg.data.management).toHaveLength(1);
  });

  it('does not apply accepted repairs to published education artifacts', async () => {
    prisma.aiDraftRevisionAudit.findFirst.mockResolvedValue({
      id: 'audit-1',
      diagnosisRegistryId,
      affectedArtifactType: 'EDUCATION_SECTION',
      affectedArtifactId: 'education-1',
      sourceIssue: { sectionId: 'management' },
      generatedOutput: {
        originalClaim: 'Appendicitis always requires surgery',
        proposedClaim: 'Appendicitis can require surgery.',
        evidenceIds: ['evidence-1'],
      },
    });
    prisma.diagnosisEducation.findUnique.mockResolvedValue({
      id: 'education-1',
      editorialStatus: 'PUBLISHED',
      management: [],
    });

    await expect(
      service.decideAiDraftRevision({
        diagnosisRegistryId,
        auditId: 'audit-1',
        decision: 'accept',
        userId: 'admin-1',
      }),
    ).rejects.toThrow('Accepted claim repairs can only update draft education artifacts');
    expect(prisma.diagnosisEducation.update).not.toHaveBeenCalled();
  });

  it('returns accepted repairs from draft education section payload', async () => {
    prisma.diagnosisRegistry.findUnique.mockResolvedValue(
      registry({
        education: {
          id: 'education-1',
          editorialStatus: 'DRAFT',
          version: 3,
          updatedAt: now,
          management: [
            {
              type: 'CLAIM_REPAIR',
              originalClaim: 'Appendicitis always requires surgery',
              acceptedClaim: 'Appendicitis can require surgery.',
              evidenceIds: ['evidence-1'],
              acceptedAt: now.toISOString(),
              reviewerUserId: 'admin-1',
              sourceAuditId: 'audit-1',
            },
          ],
        },
      }),
    );

    const result = await service.getFullWorkspace(diagnosisRegistryId);

    expect(result.education.acceptedRepairs).toEqual([
      expect.objectContaining({
        section: 'management',
        originalClaim: 'Appendicitis always requires surgery',
        acceptedClaim: 'Appendicitis can require surgery.',
        evidenceIds: ['evidence-1'],
        reviewerUserId: 'admin-1',
        sourceAuditId: 'audit-1',
      }),
    ]);
  });

  it('rejects a draft revision without applying output', async () => {
    prisma.aiDraftRevisionAudit.findFirst.mockResolvedValue({
      id: 'audit-1',
      diagnosisRegistryId,
      affectedArtifactType: 'EDUCATION_SECTION',
      affectedArtifactId: 'education-1',
      sourceIssue: {},
      generatedOutput: {},
    });

    await service.decideAiDraftRevision({
      diagnosisRegistryId,
      auditId: 'audit-1',
      decision: 'reject',
      userId: 'admin-1',
    });

    expect(prisma.diagnosisEducation.update).not.toHaveBeenCalled();
    expect(prisma.aiDraftRevisionAudit.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ reviewStatus: 'REJECTED' }),
      }),
    );
  });

  it('projects discriminator draft audits into review payloads', async () => {
    prisma.aiDraftRevisionAudit.findMany.mockResolvedValue([
      {
        id: 'audit-disc-1',
        caseId: 'case-1',
        actionType: 'generate_clue_revision_proposal',
        sourceIssue: {
          target: {
            diagnosisRegistryId,
            caseId: 'case-1',
            mimicName: 'GERD',
            discriminator: 'delayed post-meal timing without reflux',
            generationIntent: 'missing_discriminator_case',
            sourceClueOrder: 3,
          },
        },
        inputContext: {
          existingClue: 'Upper abdominal pain after meals.',
          desiredClueOrder: 3,
        },
        generatedOutput: {
          proposedClue:
            'Add positional reflux absence to separate GERD explicitly.',
          expectedProgressionEffect: 'GERD eliminated by clue 3.',
        },
        editorDecision: null,
        affectedArtifactType: 'CASE_CLUE_REVISION_PROPOSAL',
        affectedArtifactId: 'case-1',
        reviewStatus: 'PENDING_REVIEW',
        createdByUserId: 'admin-1',
        reviewerUserId: null,
        decisionAt: null,
        reviewNote: null,
        createdAt: now,
      },
    ]);

    const result = await service.getFullWorkspace(diagnosisRegistryId);

    expect(result.discriminatorDraftReviews).toEqual([
      expect.objectContaining({
        auditId: 'audit-disc-1',
        draftKind: 'clue_revision_proposal',
        generationIntent: 'missing_discriminator_case',
        mimicName: 'GERD',
        discriminator: 'delayed post-meal timing without reflux',
        reviewStatus: 'PENDING_REVIEW',
        discriminatorDraftReview: expect.objectContaining({
          reviewGuidance: expect.objectContaining({
            primaryQuestion: expect.stringContaining('clue revision'),
          }),
          proposedOutput: expect.objectContaining({
            clueRevision: expect.objectContaining({
              originalClue: 'Upper abdominal pain after meals.',
              expectedEffect: 'GERD eliminated by clue 3.',
            }),
          }),
        }),
      }),
    ]);
    expect(result.aiDraftAuditTrail[0]).toEqual(
      expect.objectContaining({
        draftKind: 'clue_revision_proposal',
        mimicName: 'GERD',
        discriminatorDraftReview: expect.any(Object),
      }),
    );
  });

  it('projects materialized clue revision drafts into cases and review rows', async () => {
    prisma.diagnosisRegistry.findUnique.mockResolvedValue(
      registry({
        cases: [
          {
            id: 'case-1',
            title: 'RLQ pain',
            difficulty: 'medium',
            editorialStatus: CaseEditorialStatus.DRAFT,
            date: now,
            clues: [],
            differentials: [],
            explanation: {},
            validationRuns: [],
            clueProgressionAnalyses: [],
            clueDiscriminatorAnnotations: [],
            clueRevisionDrafts: [
              {
                id: 'draft-1',
                caseId: 'case-1',
                sourceAuditId: 'audit-disc-1',
                clueOrder: 3,
                clueIndex: 2,
                originalClue: 'Upper abdominal pain after meals.',
                revisedClue:
                  'Pain migrates to the right iliac fossa with guarding.',
                addedClue: null,
                rationale: 'Make mimic separation explicit.',
                expectedEffect: 'GERD eliminated by clue 3.',
                status: 'PENDING_REVIEW',
                reviewerUserId: 'admin-1',
                createdAt: now,
                updatedAt: now,
              },
            ],
          },
        ],
      }),
    );
    prisma.aiDraftRevisionAudit.findMany.mockResolvedValue([
      {
        id: 'audit-disc-1',
        caseId: 'case-1',
        actionType: 'generate_clue_revision_proposal',
        sourceIssue: {
          target: {
            diagnosisRegistryId,
            caseId: 'case-1',
            mimicName: 'GERD',
            discriminator: 'migration',
            generationIntent: 'weak_clue_transition',
          },
        },
        inputContext: {},
        generatedOutput: {},
        editorDecision: 'accept',
        affectedArtifactType: 'CASE_CLUE_REVISION_PROPOSAL',
        affectedArtifactId: 'case-1',
        reviewStatus: 'ACCEPTED',
        createdByUserId: 'admin-1',
        reviewerUserId: 'admin-1',
        decisionAt: now,
        reviewNote: 'Materialized as draft case clue revision.',
        createdAt: now,
      },
    ]);

    const result = await service.getFullWorkspace(diagnosisRegistryId);

    expect(result.cases.items[0].clueRevisionDrafts).toEqual([
      expect.objectContaining({
        id: 'draft-1',
        sourceAuditId: 'audit-disc-1',
        revisedClue: 'Pain migrates to the right iliac fossa with guarding.',
        status: 'PENDING_REVIEW',
      }),
    ]);
    expect(result.materializedClueRevisionDrafts).toEqual([
      expect.objectContaining({ id: 'draft-1', caseId: 'case-1' }),
    ]);
    expect(result.discriminatorDraftReviews[0]).toEqual(
      expect.objectContaining({
        acceptedMaterializationStatus: 'materialized',
        revisionDraftId: 'draft-1',
      }),
    );
  });

  it('degrades malformed discriminator draft audit metadata safely', async () => {
    prisma.aiDraftRevisionAudit.findMany.mockResolvedValue([
      {
        id: 'audit-disc-bad',
        caseId: null,
        actionType: 'generate_clue_revision_proposal',
        sourceIssue: {},
        inputContext: {},
        generatedOutput: {},
        editorDecision: null,
        affectedArtifactType: 'CASE_CLUE_REVISION_PROPOSAL',
        affectedArtifactId: diagnosisRegistryId,
        reviewStatus: 'PENDING_REVIEW',
        createdByUserId: 'admin-1',
        reviewerUserId: null,
        decisionAt: null,
        reviewNote: null,
        createdAt: now,
      },
    ]);

    const result = await service.getFullWorkspace(diagnosisRegistryId);

    expect(result.discriminatorDraftReviews).toEqual([]);
    expect(result.aiDraftAuditTrail[0]).toEqual(
      expect.not.objectContaining({ discriminatorDraftReview: expect.anything() }),
    );
  });

  it('materializes accepted clue revision proposals for editable cases', async () => {
    prisma.aiDraftRevisionAudit.findFirst.mockResolvedValue({
      id: 'audit-disc-1',
      diagnosisRegistryId,
      caseId: 'case-1',
      actionType: 'generate_clue_revision_proposal',
      affectedArtifactType: 'CASE_CLUE_REVISION_PROPOSAL',
      affectedArtifactId: 'case-1',
      sourceIssue: {},
      inputContext: {},
      generatedOutput: {
        reviewPayload: {
          draftKind: 'clue_revision_proposal',
          generationIntent: 'weak_clue_transition',
          diagnosisRegistryId,
          caseId: 'case-1',
          sourceClueOrder: 3,
          sourceClueIndex: 2,
          mimicName: 'GERD',
          discriminator: 'migration to right iliac fossa',
          proposedOutput: {
            clueRevision: {
              originalClue: 'Upper abdominal pain after meals.',
              revisedClue:
                'Pain migrates to the right iliac fossa with localized guarding.',
              rationale: 'Make the discriminator explicit.',
              expectedEffect: 'GERD eliminated by clue 3.',
            },
          },
        },
      },
    });
    prisma.case.findFirst.mockResolvedValue({
      id: 'case-1',
      editorialStatus: CaseEditorialStatus.DRAFT,
    });

    const result = await service.decideAiDraftRevision({
      diagnosisRegistryId,
      auditId: 'audit-disc-1',
      decision: 'accept',
      userId: 'admin-1',
    });

    expect(prisma.diagnosisEducation.update).not.toHaveBeenCalled();
    expect(prisma.caseClueRevisionDraft.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          caseId: 'case-1',
          sourceAuditId: 'audit-disc-1',
          clueOrder: 3,
          clueIndex: 2,
          originalClue: 'Upper abdominal pain after meals.',
          revisedClue:
            'Pain migrates to the right iliac fossa with localized guarding.',
          rationale: 'Make the discriminator explicit.',
          expectedEffect: 'GERD eliminated by clue 3.',
          status: 'PENDING_REVIEW',
          reviewerUserId: 'admin-1',
        }),
      }),
    );
    expect(prisma.aiDraftRevisionAudit.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reviewStatus: 'ACCEPTED',
          reviewNote: 'Materialized as draft case clue revision.',
        }),
      }),
    );
    expect(result.materialization).toEqual(
      expect.objectContaining({
        materialized: true,
        status: 'materialized',
        revisionDraftId: 'draft-1',
      }),
    );
  });

  it('does not duplicate materialized clue revision drafts for repeated accepts', async () => {
    prisma.aiDraftRevisionAudit.findFirst.mockResolvedValue({
      id: 'audit-disc-1',
      diagnosisRegistryId,
      caseId: 'case-1',
      actionType: 'generate_clue_revision_proposal',
      affectedArtifactType: 'CASE_CLUE_REVISION_PROPOSAL',
      affectedArtifactId: 'case-1',
      sourceIssue: {},
      inputContext: {},
      generatedOutput: {
        reviewPayload: {
          draftKind: 'clue_revision_proposal',
          generationIntent: 'weak_clue_transition',
          diagnosisRegistryId,
          caseId: 'case-1',
          mimicName: 'GERD',
          discriminator: 'migration',
          proposedOutput: {
            clueRevision: { revisedClue: 'Migratory pain localizes.' },
          },
        },
      },
    });
    prisma.case.findFirst.mockResolvedValue({
      id: 'case-1',
      editorialStatus: CaseEditorialStatus.REVIEW,
    });
    prisma.caseClueRevisionDraft.findUnique.mockResolvedValue({ id: 'draft-1' });

    const result = await service.decideAiDraftRevision({
      diagnosisRegistryId,
      auditId: 'audit-disc-1',
      decision: 'accept',
      userId: 'admin-1',
    });

    expect(prisma.caseClueRevisionDraft.create).not.toHaveBeenCalled();
    expect(result.materialization).toEqual(
      expect.objectContaining({
        materialized: true,
        status: 'materialized',
        revisionDraftId: 'draft-1',
      }),
    );
  });

  it('keeps accepted clue proposals audit-only for published cases', async () => {
    prisma.aiDraftRevisionAudit.findFirst.mockResolvedValue({
      id: 'audit-disc-1',
      diagnosisRegistryId,
      caseId: 'case-1',
      actionType: 'generate_clue_revision_proposal',
      affectedArtifactType: 'CASE_CLUE_REVISION_PROPOSAL',
      affectedArtifactId: 'case-1',
      sourceIssue: {},
      inputContext: {},
      generatedOutput: {
        reviewPayload: {
          draftKind: 'clue_revision_proposal',
          generationIntent: 'weak_clue_transition',
          diagnosisRegistryId,
          caseId: 'case-1',
          mimicName: 'GERD',
          discriminator: 'migration',
          proposedOutput: {
            clueRevision: { revisedClue: 'Migratory pain localizes.' },
          },
        },
      },
    });
    prisma.case.findFirst.mockResolvedValue({
      id: 'case-1',
      editorialStatus: CaseEditorialStatus.PUBLISHED,
    });

    const result = await service.decideAiDraftRevision({
      diagnosisRegistryId,
      auditId: 'audit-disc-1',
      decision: 'accept',
      userId: 'admin-1',
    });

    expect(prisma.caseClueRevisionDraft.create).not.toHaveBeenCalled();
    expect(prisma.aiDraftRevisionAudit.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reviewStatus: 'ACCEPTED',
          reviewNote:
            'Accepted as proposal only; target case is not editable.',
        }),
      }),
    );
    expect(result.materialization).toEqual(
      expect.objectContaining({
        materialized: false,
        status: 'blocked_case_not_editable',
      }),
    );
  });

  it('keeps targeted discriminator case accepts audit-only', async () => {
    prisma.aiDraftRevisionAudit.findFirst.mockResolvedValue({
      id: 'audit-disc-case',
      diagnosisRegistryId,
      caseId: 'case-1',
      actionType: 'generate_targeted_discriminator_case',
      affectedArtifactType: 'TARGETED_DISCRIMINATOR_CASE_DRAFT',
      affectedArtifactId: 'case-1',
      sourceIssue: {},
      inputContext: {},
      generatedOutput: {
        reviewPayload: {
          draftKind: 'targeted_discriminator_case',
          generationIntent: 'weak_discriminator_case',
          diagnosisRegistryId,
          caseId: 'case-1',
          mimicName: 'GERD',
          discriminator: 'migration',
          proposedOutput: { title: 'Targeted draft' },
        },
      },
    });

    const result = await service.decideAiDraftRevision({
      diagnosisRegistryId,
      auditId: 'audit-disc-case',
      decision: 'accept',
      userId: 'admin-1',
    });

    expect(prisma.caseClueRevisionDraft.create).not.toHaveBeenCalled();
    expect(result.materialization).toEqual(
      expect.objectContaining({
        materialized: false,
        status: 'not_applicable',
      }),
    );
  });

  it('degrades malformed accepted clue proposals safely', async () => {
    prisma.aiDraftRevisionAudit.findFirst.mockResolvedValue({
      id: 'audit-disc-bad',
      diagnosisRegistryId,
      actionType: 'generate_clue_revision_proposal',
      affectedArtifactType: 'CASE_CLUE_REVISION_PROPOSAL',
      affectedArtifactId: 'case-1',
      sourceIssue: {},
      inputContext: {},
      generatedOutput: {},
    });

    const result = await service.decideAiDraftRevision({
      diagnosisRegistryId,
      auditId: 'audit-disc-bad',
      decision: 'accept',
      userId: 'admin-1',
    });

    expect(prisma.caseClueRevisionDraft.create).not.toHaveBeenCalled();
    expect(prisma.aiDraftRevisionAudit.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reviewStatus: 'ACCEPTED',
          reviewNote:
            'Accepted as proposal only; clue revision payload was incomplete.',
        }),
      }),
    );
    expect(result.materialization).toEqual(
      expect.objectContaining({
        materialized: false,
        status: 'accepted_audit_only',
        reason: 'malformed_review_payload',
      }),
    );
  });

  it('updates pending clue revision drafts', async () => {
    prisma.caseClueRevisionDraft.findUnique.mockResolvedValue(
      clueRevisionDraft({ status: 'PENDING_REVIEW' }),
    );

    const result = await service.updateClueRevisionDraft({
      draftId: 'draft-1',
      payload: {
        revisedClue: 'Pain now localizes to the right iliac fossa.',
        rationale: 'Clarifies discriminator timing.',
      },
      reviewerUserId: 'admin-1',
    });

    expect(prisma.caseClueRevisionDraft.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'draft-1' },
        data: expect.objectContaining({
          revisedClue: 'Pain now localizes to the right iliac fossa.',
          rationale: 'Clarifies discriminator timing.',
          reviewerUserId: 'admin-1',
        }),
      }),
    );
    const updateData = prisma.caseClueRevisionDraft.update.mock.calls[0][0].data;
    expect(updateData).not.toHaveProperty('addedClue');
    expect(updateData).not.toHaveProperty('expectedEffect');
    expect(result.canEdit).toBe(true);
  });

  it('blocks editing applied clue revision drafts', async () => {
    prisma.caseClueRevisionDraft.findUnique.mockResolvedValue(
      clueRevisionDraft({ status: 'APPLIED' }),
    );

    await expect(
      service.updateClueRevisionDraft({
        draftId: 'draft-1',
        payload: { revisedClue: 'Too late' },
        reviewerUserId: 'admin-1',
      }),
    ).rejects.toThrow('Only pending or needs-changes clue revision drafts can be edited');
  });

  it('approves pending clue revision drafts', async () => {
    prisma.caseClueRevisionDraft.findUnique.mockResolvedValue(
      clueRevisionDraft({ status: 'PENDING_REVIEW' }),
    );

    await service.approveClueRevisionDraft({
      draftId: 'draft-1',
      reviewerUserId: 'admin-1',
      note: 'Clinically sound',
    });

    expect(prisma.caseClueRevisionDraft.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'APPROVED',
          decisionByUserId: 'admin-1',
          decisionNote: 'Clinically sound',
        }),
      }),
    );
  });

  it('rejects, requests changes, and supersedes clue revision drafts', async () => {
    prisma.caseClueRevisionDraft.findUnique.mockResolvedValue(
      clueRevisionDraft({ status: 'PENDING_REVIEW' }),
    );

    await service.rejectClueRevisionDraft({
      draftId: 'draft-1',
      reviewerUserId: 'admin-1',
      note: 'Unsafe clue',
    });
    await service.requestChangesForClueRevisionDraft({
      draftId: 'draft-1',
      reviewerUserId: 'admin-1',
      note: 'Needs stronger timing',
    });
    prisma.caseClueRevisionDraft.findUnique.mockResolvedValue(
      clueRevisionDraft({ status: 'APPROVED' }),
    );
    await service.supersedeClueRevisionDraft({
      draftId: 'draft-1',
      reviewerUserId: 'admin-1',
      note: 'Newer draft exists',
    });

    expect(prisma.caseClueRevisionDraft.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'REJECTED' }),
      }),
    );
    expect(prisma.caseClueRevisionDraft.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'NEEDS_CHANGES' }),
      }),
    );
    expect(prisma.caseClueRevisionDraft.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'SUPERSEDED' }),
      }),
    );
  });

  it('applies approved clue revision drafts to editable case clue data', async () => {
    prisma.caseClueRevisionDraft.findUnique.mockResolvedValue(
      clueRevisionDraft({
        status: 'APPROVED',
        clueOrder: 1,
        revisedClue: 'RLQ guarding replaces generalized tenderness.',
        case: caseSnapshot({ editorialStatus: CaseEditorialStatus.DRAFT }),
      }),
    );

    const result = await service.applyApprovedClueRevisionDraft({
      draftId: 'draft-1',
      reviewerUserId: 'admin-1',
    });

    expect(prisma.case.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'case-1' },
        data: expect.objectContaining({
          clues: expect.arrayContaining([
            expect.objectContaining({
              value: 'RLQ guarding replaces generalized tenderness.',
            }),
          ]),
        }),
      }),
    );
    expect(prisma.caseRevision.create).toHaveBeenCalled();
    expect(prisma.caseClueProgressionAnalysis.deleteMany).toHaveBeenCalledWith({
      where: { caseId: 'case-1' },
    });
    expect(result.applied).toBe(true);
  });

  it('blocks applying approved drafts to published cases safely', async () => {
    prisma.caseClueRevisionDraft.findUnique.mockResolvedValue(
      clueRevisionDraft({
        status: 'APPROVED',
        case: caseSnapshot({ editorialStatus: CaseEditorialStatus.PUBLISHED }),
      }),
    );

    const result = await service.applyApprovedClueRevisionDraft({
      draftId: 'draft-1',
      reviewerUserId: 'admin-1',
    });

    expect(prisma.case.update).not.toHaveBeenCalled();
    expect(prisma.caseClueRevisionDraft.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'BLOCKED_CASE_NOT_EDITABLE',
          decisionNote: 'Target case is not editable.',
        }),
      }),
    );
    expect(result.applied).toBe(false);
    expect(result.reason).toBe('target_case_not_editable');
  });

  it('treats already-applied clue revision draft apply as idempotent', async () => {
    prisma.caseClueRevisionDraft.findUnique.mockResolvedValue(
      clueRevisionDraft({ status: 'APPLIED' }),
    );

    const result = await service.applyApprovedClueRevisionDraft({
      draftId: 'draft-1',
      reviewerUserId: 'admin-1',
    });

    expect(prisma.case.update).not.toHaveBeenCalled();
    expect(result.applied).toBe(true);
    expect(result.reason).toBe('already_applied');
  });

  it('blocks malformed clue revision drafts from applying', async () => {
    prisma.caseClueRevisionDraft.findUnique.mockResolvedValue(
      clueRevisionDraft({
        status: 'APPROVED',
        revisedClue: null,
        addedClue: null,
      }),
    );

    await expect(
      service.applyApprovedClueRevisionDraft({
        draftId: 'draft-1',
        reviewerUserId: 'admin-1',
      }),
    ).rejects.toThrow('Clue revision draft has no proposed clue text');
    expect(prisma.case.update).not.toHaveBeenCalled();
  });

  it('creates and audits learning-goal coverage annotations', async () => {
    prisma.caseLearningGoalCoverage.upsert = jest.fn().mockResolvedValue({
      id: 'coverage-1',
      caseId: 'case-1',
      case: { id: 'case-1', title: 'RLQ pain' },
      learningGoalId: 'goal-1',
      learningGoal: 'Distinguish appendicitis',
      coverageStrength: 80,
      coveredDiscriminators: ['migration'],
      missingDiscriminators: [],
      coveredMimics: [],
      missingMimics: ['torsion'],
      evidenceSource: 'editorial_annotation',
      updatedAt: now,
    });

    const result = await service.upsertCaseLearningGoalCoverage({
      diagnosisRegistryId,
      payload: {
        caseId: 'case-1',
        learningGoalId: 'goal-1',
        learningGoal: 'Distinguish appendicitis',
        coverageStrength: 80,
      },
      userId: 'admin-1',
    });

    expect(result.coverageStrength).toBe(80);
    expect(prisma.aiDraftRevisionAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actionType: 'create_case_learning_goal_coverage',
          reviewStatus: 'ACCEPTED',
        }),
      }),
    );
  });

  it('returns partial workspace and education action when teaching rules exist without education', async () => {
    prisma.diagnosisRegistry.findUnique.mockResolvedValue(
      registry({ education: null, cases: [] }),
    );
    qualityService.getSummary.mockResolvedValue(
      summary({
        overallWorkspaceStatus: 'insufficient_data',
        educationQuality: {
          status: 'missing',
          version: null,
          score: null,
          graphReadiness: null,
          blockerCount: 0,
          warningCount: 0,
        },
        caseQuality: {
          status: 'missing',
          totalCases: 0,
          usableCases: 0,
          blockerCount: 0,
          warningCount: 0,
          strongestCaseId: null,
        },
      }),
    );
    coverageService.getCoverage.mockResolvedValue(
      coverage({
        teachingUnits: [
          coverageUnit({
            educationCoverage: 'unknown',
            caseCoverage: { count: 0, status: 'missing' },
            graphCoverage: 'covered',
            status: 'partial',
          }),
        ],
      }),
    );

    const result = await service.getFullWorkspace(diagnosisRegistryId);

    expect(result.lifecycle.education).toBe('not_started');
    expect(result.coverageGaps).toEqual([
      expect.objectContaining({
        missingCases: true,
        targetTab: 'cases',
      }),
    ]);
    expect(result.recommendedActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'generate-education', enabled: true }),
      ]),
    );
  });

  it('shows case coverage gaps when education exists but cases are missing', async () => {
    prisma.diagnosisRegistry.findUnique.mockResolvedValue(registry({ cases: [] }));
    coverageService.getCoverage.mockResolvedValue(
      coverage({
        teachingUnits: [
          coverageUnit({
            caseCoverage: { count: 0, status: 'missing' },
            status: 'partial',
            recommendedAction: 'Generate aligned case',
          }),
        ],
      }),
    );

    const result = await service.getFullWorkspace(diagnosisRegistryId);

    expect(result.cases.summary.total).toBe(0);
    expect(result.coverageGaps[0]).toEqual(
      expect.objectContaining({
        missingCases: true,
        recommendedAction: 'Generate aligned case',
      }),
    );
    expect(result.recommendedActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'generate-targeted-case' }),
      ]),
    );
  });

  it('surfaces graph review action when candidates exist without active facts', async () => {
    prisma.diagnosisRegistry.findUnique.mockResolvedValue(
      registry({ graphFacts: [] }),
    );
    qualityService.getSummary.mockResolvedValue(
      summary({
        graphReadiness: {
          status: 'review_needed',
          candidateCount: 1,
          factCount: 0,
          reviewableCandidateCount: 1,
        },
      }),
    );
    graphCandidatesService.listCandidates.mockResolvedValue([
      {
        id: 'candidate-1',
        status: 'CANDIDATE',
        type: 'MIMIC',
        rawText: 'Ovarian torsion',
      },
    ]);

    const result = await service.getFullWorkspace(diagnosisRegistryId);

    expect(result.graph.readiness).toBe('review_needed');
    expect(result.graph.reviewableCandidateCount).toBe(1);
    expect(result.recommendedActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'review-graph-candidates' }),
      ]),
    );
  });

  it('returns a safe empty curriculum state when no teaching rules exist', async () => {
    teachingRulesService.listRules.mockResolvedValue({
      diagnosisRegistryId,
      diagnosisName: 'Appendicitis',
      rules: [],
    });
    coverageService.getCoverage.mockResolvedValue(coverage({ teachingUnits: [] }));

    const result = await service.getFullWorkspace(diagnosisRegistryId);

    expect(result.lifecycle.curriculum).toBe('not_started');
    expect(result.teachingRules.summary.total).toBe(0);
    expect(result.coverageMatrix).toEqual([]);
  });

  it('keeps partial data when an optional subsystem fails', async () => {
    graphCandidatesService.listCandidates.mockRejectedValue(new Error('graph offline'));

    const result = await service.getFullWorkspace(diagnosisRegistryId);

    expect(result.graph.candidates).toEqual([]);
    expect(result.workspaceSummary.warnings).toEqual(
      expect.arrayContaining([
        'Unable to load graph candidates: graph offline',
      ]),
    );
  });

  it('counts unresolved must-not-miss mimic confusion as a case blocker', async () => {
    prisma.diagnosisRegistry.findUnique.mockResolvedValue(
      registry({
        cases: [
          {
            id: 'case-1',
            title: 'Epigastric pain',
            difficulty: 'medium',
            editorialStatus: CaseEditorialStatus.APPROVED,
            date: now,
            clues: [
              { type: 'history', value: 'Burning epigastric pain.', order: 0 },
            ],
            differentials: ['Gastric cancer'],
            explanation: {},
            validationRuns: [],
            clueProgressionAnalyses: [
              {
                diagnosticStates: [],
                mimicCollapses: [],
                discriminatorEmergences: [],
                differentialElimination: [
                  {
                    mimicDiagnosisId: 'gastric-cancer',
                    mimicName: 'Gastric cancer',
                    relationshipType: 'IMPORTANT_EXCLUSION',
                    initialPlausibility: 'high',
                    finalStatus: 'persistent',
                    eliminationStrength: 'weak',
                    educationalValue: 'high',
                    prematureCollapseRisk: false,
                    remainingConfusionRisk: true,
                  },
                ],
                leadingDifferentials: [],
                remainingMimics: ['Gastric cancer'],
                discriminatorSignals: [],
                editorialSignals: [
                  'unresolved_mimic',
                  'missing_discriminator_case',
                  'persistent_confusion',
                ],
                likelyLockInClue: null,
                confidenceEstimate: 0.4,
                ambiguityScore: 0.7,
                prematureLeakFlag: false,
                unresolvedAmbiguityFlag: true,
                totalMimicsTracked: 1,
                eliminatedMimicCount: 0,
                unresolvedMimicCount: 0,
                persistentConfusionCount: 1,
                weakEliminationCount: 0,
                editorialNotes: 'Important mimic remains unresolved.',
                analysisVersion: 'heuristic_v1',
                generatedAt: now,
              },
            ],
          },
        ],
      }),
    );

    const result = await service.getFullWorkspace(diagnosisRegistryId);

    expect(result.cases.summary.blockerCount).toBeGreaterThanOrEqual(1);
    expect(result.cases.summary.progressionSignals).toEqual(
      expect.objectContaining({
        persistentConfusionCount: 1,
        missingDiscriminatorCaseCount: 1,
      }),
    );
    expect(result.editorialPrioritization.highestImpactFixes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'generate_discriminator_draft',
          targetTab: 'graph',
          severity: 'blocker',
        }),
      ]),
    );
  });

  it('throws not found when the diagnosis registry entry is missing', async () => {
    prisma.diagnosisRegistry.findUnique.mockResolvedValue(null);

    await expect(service.getFullWorkspace(diagnosisRegistryId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  function registry(overrides: Record<string, unknown> = {}) {
    return {
      id: diagnosisRegistryId,
      canonicalName: 'appendicitis',
      displayLabel: 'Appendicitis',
      specialty: 'Surgery',
      category: 'Acute abdomen',
      bodySystem: 'Gastrointestinal',
      difficultyBand: 'BASIC',
      aliases: [{ term: 'acute appendicitis' }],
      education: {
        id: 'education-1',
        editorialStatus: 'PUBLISHED',
        version: 2,
        updatedAt: now,
      },
      editorialBrief: brief(),
      cases: [
        {
          id: 'case-1',
          title: 'RLQ pain',
          difficulty: 'medium',
          editorialStatus: CaseEditorialStatus.APPROVED,
          date: now,
          clues: [
            { type: 'history', value: 'Migratory abdominal pain.', order: 0 },
            {
              type: 'exam',
              value: 'Right lower quadrant tenderness.',
              order: 1,
            },
          ],
          differentials: ['Ovarian torsion'],
          explanation: {},
          validationRuns: [],
          clueProgressionAnalyses: [],
        },
      ],
      graphFacts: [
        {
          id: 'fact-1',
          type: 'MIMIC',
          label: 'Ovarian torsion',
          targetDiagnosisRegistryId: 'target-1',
          updatedAt: now,
        },
      ],
      ...overrides,
    };
  }

  function caseSnapshot(overrides: Record<string, unknown> = {}) {
    return {
      id: 'case-1',
      editorialStatus: CaseEditorialStatus.DRAFT,
      title: 'RLQ pain',
      date: now,
      difficulty: 'medium',
      history: 'Progressive abdominal pain.',
      symptoms: ['abdominal pain'],
      labs: null,
      clues: [
        { type: 'history', value: 'Periumbilical pain.', order: 0 },
        { type: 'exam', value: 'Mild generalized tenderness.', order: 1 },
      ],
      explanation: {},
      differentials: ['GERD'],
      diagnosisId: null,
      diagnosisRegistryId,
      proposedDiagnosisText: 'Appendicitis',
      diagnosisMappingStatus: 'LINKED',
      diagnosisMappingMethod: 'REGISTRY_ID',
      diagnosisMappingConfidence: 1,
      diagnosisEditorialNote: null,
      ...overrides,
    };
  }

  function clueRevisionDraft(overrides: Record<string, unknown> = {}) {
    return {
      id: 'draft-1',
      caseId: 'case-1',
      sourceAuditId: 'audit-disc-1',
      clueOrder: 1,
      clueIndex: 1,
      originalClue: 'Mild generalized tenderness.',
      revisedClue: 'Right iliac fossa guarding emerges.',
      addedClue: null,
      rationale: 'Clarifies mimic separation.',
      expectedEffect: 'GERD eliminated by clue 2.',
      status: 'PENDING_REVIEW',
      reviewerUserId: null,
      decisionAt: null,
      decisionByUserId: null,
      decisionNote: null,
      appliedAt: null,
      appliedByUserId: null,
      createdAt: now,
      updatedAt: now,
      case: caseSnapshot(),
      ...overrides,
    };
  }

  function brief() {
    return {
      id: 'brief-1',
      status: 'ACTIVE',
      version: 3,
      summary: 'Teach appendicitis as a progressive RLQ pain pattern.',
      learningGoals: [
        'Distinguish appendicitis from ovarian torsion',
      ],
      updatedAt: now,
    };
  }

  function rule(overrides: Record<string, unknown> = {}) {
    return {
      id: 'rule-1',
      diagnosisRegistryId,
      stableKey: 'rule_key',
      title: 'Migratory RLQ pain',
      category: 'finding_concept',
      importance: 'critical',
      rationale: null,
      acceptableManifestations: [],
      requiredDifferentials: [],
      expectedEvidence: {},
      difficultyHints: {},
      avoidTooEarly: false,
      appliesToEducation: true,
      appliesToCaseGeneration: true,
      appliesToGraph: true,
      status: 'ACTIVE',
      source: 'EDITOR_CREATED',
      version: 1,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      ...overrides,
    };
  }

  function coverage(overrides: Record<string, unknown> = {}) {
    return {
      diagnosisRegistryId,
      diagnosisName: 'Appendicitis',
      teachingUnits: [coverageUnit()],
      ...overrides,
    };
  }

  function coverageUnit(overrides: Record<string, unknown> = {}) {
    return {
      id: 'rule_key',
      title: 'Migratory RLQ pain',
      source: 'persisted_teaching_rule',
      status: 'covered',
      educationCoverage: 'covered',
      caseCoverage: {
        count: 1,
        status: 'covered',
      },
      graphCoverage: 'covered',
      relatedSections: ['summary'],
      relatedCaseIds: ['case-1'],
      relatedGraphFactIds: ['fact-1'],
      warnings: [],
      recommendedAction: 'Ready',
      ...overrides,
    };
  }

  function revision(): Record<string, unknown> {
    return {
      id: 'revision-1',
      educationId: 'education-1',
      version: 2,
      editorialStatus: 'PUBLISHED',
      source: 'GENERATED',
      createdByUserId: null,
      createdAt: now.toISOString(),
      changedSections: ['management'],
      quality: {
        overallScore: 0.92,
        graphReadiness: 0.9,
        sectionScores: {},
        coverageScores: { overall: 0.95 },
        patternComplianceScores: {},
        warnings: [],
        blockers: [],
        coverageWarnings: [],
        sectionHealth: [],
        warningCount: 0,
        blockerCount: 0,
      },
    };
  }

  function summary(overrides: Record<string, unknown> = {}) {
    return {
      diagnosisRegistryId,
      diagnosisName: 'Appendicitis',
      overallWorkspaceStatus: 'ready',
      educationQuality: {
        status: 'published',
        version: 2,
        score: 0.92,
        graphReadiness: 0.9,
        blockerCount: 0,
        warningCount: 0,
      },
      caseQuality: {
        status: 'good',
        totalCases: 1,
        usableCases: 1,
        blockerCount: 0,
        warningCount: 0,
        strongestCaseId: 'case-1',
      },
      teachingCoverage: {
        overall: 0.95,
        scores: { overall: 0.95 },
        missingItems: [],
      },
      graphReadiness: {
        status: 'fact_ready',
        candidateCount: 0,
        factCount: 1,
        reviewableCandidateCount: 0,
      },
      editorialBrief: {
        status: 'ACTIVE',
        version: 3,
        activeForGeneration: true,
      },
      revisionTrend: {
        latestVersion: 2,
        previousVersion: 1,
        overallDelta: 0.1,
        graphReadinessDelta: 0.1,
        direction: 'improved',
      },
      sectionHealth: [],
      blockers: [],
      warnings: [],
      recommendedNextActions: [],
      ...overrides,
    };
  }
});
