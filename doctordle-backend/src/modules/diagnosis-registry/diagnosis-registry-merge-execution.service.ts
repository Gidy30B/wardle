import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  DiagnosisAliasKind,
  DiagnosisEditorialOnboardingStatus,
  DiagnosisRegistryStatus,
  DiagnosisTeachingRelationshipStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';
import { normalizeDiagnosisTerm } from './diagnosis-term-normalizer';
import {
  DiagnosisRegistryMergeAnalysisService,
  type RegistryMergeAnalysis,
} from './diagnosis-registry-merge-analysis.service';
import {
  DiagnosisRegistryLifecyclePolicyService,
  type DiagnosisRegistryLifecycleReport,
} from './diagnosis-registry-lifecycle-policy.service';
import { validateAliasWithClient } from './alias-validation.service';

export type ExecuteRegistryMergeInput = {
  sourceDiagnosisRegistryId: string;
  targetDiagnosisRegistryId: string;
  performedByUserId: string;
  reason?: string;
  expectedAnalysisHash?: string;
};

export type RegistryMergeExecutionResult = {
  mergeLogId: string;
  analysisHash: string;
  sourceDiagnosisRegistryId: string;
  targetDiagnosisRegistryId: string;
  sourceStatus: DiagnosisRegistryStatus;
  reassignmentSummary: ReassignmentSummary;
};

export type CompleteDuplicateKeeperInput = {
  keeperRegistryId: string;
  sourceDraftRegistryId: string;
  performedByUserId: string;
  metadata: DuplicateKeeperMetadataInput;
  aliases?: Array<{
    term: string;
    acceptedForMatch?: boolean;
    kind?: DiagnosisAliasKind;
  }>;
  reason?: string;
};

export type DuplicateKeeperMetadataInput = {
  category?: string | null;
  specialty?: string | null;
  subspecialty?: string | null;
  bodySystem?: string | null;
  organSystem?: string | null;
  difficultyBand?: string | null;
  rarityBand?: string | null;
  clinicalSetting?: string | null;
  ageGroup?: string | null;
  urgencyLevel?: string | null;
  preferredClueTypes?: string[] | null;
  excludedClueTypes?: string[] | null;
  isPlayable?: boolean;
  isGeneratable?: boolean;
};

export type CompleteDuplicateKeeperResult = RegistryMergeExecutionResult & {
  action: 'COMPLETE_DUPLICATE_KEEPER';
  keeperRegistryId: string;
  lifecycle: DiagnosisRegistryLifecycleReport;
};

type ReassignmentSummary = {
  aliasesMoved: number;
  aliasesSkipped: Array<{ aliasId?: string; term: string; reason: string }>;
  aliasesCreated: number;
  referencesReassigned: Record<string, number>;
  referencesSkipped: Record<string, number>;
};

const INITIAL_SUMMARY: ReassignmentSummary = {
  aliasesMoved: 0,
  aliasesSkipped: [],
  aliasesCreated: 0,
  referencesReassigned: {},
  referencesSkipped: {},
};

@Injectable()
export class DiagnosisRegistryMergeExecutionService {
  private readonly logger = new Logger(
    DiagnosisRegistryMergeExecutionService.name,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly mergeAnalysis: DiagnosisRegistryMergeAnalysisService,
    private readonly lifecyclePolicy: DiagnosisRegistryLifecyclePolicyService,
  ) {}

  async executeMerge(
    input: ExecuteRegistryMergeInput,
  ): Promise<RegistryMergeExecutionResult> {
    this.logger.log({
      event: 'diagnosis.merge.started',
      sourceDiagnosisRegistryId: input.sourceDiagnosisRegistryId,
      targetDiagnosisRegistryId: input.targetDiagnosisRegistryId,
      performedByUserId: input.performedByUserId,
    });

    const analysis = await this.mergeAnalysis.analyzeMerge(
      input.sourceDiagnosisRegistryId,
      input.targetDiagnosisRegistryId,
    );
    if (input.expectedAnalysisHash && input.expectedAnalysisHash !== analysis.analysisHash) {
      this.logBlocked(input, 'analysis_hash_changed');
      throw new BadRequestException('Merge analysis changed; rerun analysis first');
    }
    if (!analysis.allowed || analysis.severity === 'BLOCKED' || analysis.blockers.length) {
      this.logBlocked(input, 'analysis_blocked');
      throw new BadRequestException('Merge analysis has unresolved blockers');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const summary: ReassignmentSummary = {
        aliasesMoved: 0,
        aliasesSkipped: [],
        aliasesCreated: 0,
        referencesReassigned: {},
        referencesSkipped: {},
      };

      await this.reassignAliases(tx, analysis, summary);
      await this.reassignOneToOneModels(tx, analysis, summary);
      await this.reassignSimpleReferences(tx, analysis, summary);
      await this.reassignDifferentialLinks(tx, analysis, summary);
      await this.reassignGraphRows(tx, analysis, summary);
      await this.reassignTeachingRelationships(tx, analysis, summary);
      await this.reassignAttempts(tx, analysis, summary);

      await tx.diagnosisRegistry.update({
        where: { id: analysis.source.id },
        data: {
          status: DiagnosisRegistryStatus.DEPRECATED,
          active: false,
          isPlayable: false,
          isGeneratable: false,
        },
        select: { id: true },
      });

      const log = await tx.diagnosisRegistryMergeLog.create({
        data: {
          sourceDiagnosisRegistryId: analysis.source.id,
          targetDiagnosisRegistryId: analysis.target.id,
          reason: input.reason?.trim() || null,
          analysisSnapshot: analysis as unknown as Prisma.InputJsonValue,
          reassignmentSummary: summary as unknown as Prisma.InputJsonValue,
          performedByUserId: input.performedByUserId,
        },
        select: { id: true },
      });

      return {
        mergeLogId: log.id,
        analysisHash: analysis.analysisHash,
        sourceDiagnosisRegistryId: analysis.source.id,
        targetDiagnosisRegistryId: analysis.target.id,
        sourceStatus: DiagnosisRegistryStatus.DEPRECATED,
        reassignmentSummary: summary,
      };
    });

    this.logger.log({
      event: 'diagnosis.merge.completed',
      sourceDiagnosisRegistryId: input.sourceDiagnosisRegistryId,
      targetDiagnosisRegistryId: input.targetDiagnosisRegistryId,
      mergeLogId: result.mergeLogId,
      referencesReassigned: result.reassignmentSummary.referencesReassigned,
      aliasesMoved: result.reassignmentSummary.aliasesMoved,
      aliasesSkipped: result.reassignmentSummary.aliasesSkipped.length,
    });

    return result;
  }

  async completeDuplicateKeeper(
    input: CompleteDuplicateKeeperInput,
  ): Promise<CompleteDuplicateKeeperResult> {
    if (input.keeperRegistryId === input.sourceDraftRegistryId) {
      throw new BadRequestException('Keeper and source draft must differ');
    }

    const analysis = await this.mergeAnalysis.analyzeMerge(
      input.sourceDraftRegistryId,
      input.keeperRegistryId,
    );
    if (analysis.severity === 'BLOCKED' && analysis.blockers.length) {
      throw new BadRequestException({
        message: 'Duplicate keeper completion is blocked by merge analysis',
        blockers: analysis.blockers,
        warnings: analysis.warnings,
      });
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const summary: ReassignmentSummary = {
        aliasesMoved: 0,
        aliasesSkipped: [],
        aliasesCreated: 0,
        referencesReassigned: {},
        referencesSkipped: {},
      };

      await tx.diagnosisRegistry.update({
        where: { id: analysis.target.id },
        data: this.buildKeeperMetadataUpdate(input.metadata),
        select: { id: true },
      });
      await this.createReviewedAliases(tx, analysis, input.aliases ?? [], summary);
      await this.reassignAliases(tx, analysis, summary);
      await this.reassignOneToOneModels(tx, analysis, summary);
      await this.reassignSimpleReferences(tx, analysis, summary);
      await this.reassignDifferentialLinks(tx, analysis, summary);
      await this.reassignGraphRows(tx, analysis, summary);
      await this.reassignTeachingRelationships(tx, analysis, summary);
      await this.reassignAttempts(tx, analysis, summary);

      await tx.diagnosisRegistry.update({
        where: { id: analysis.source.id },
        data: {
          status: DiagnosisRegistryStatus.DEPRECATED,
          active: false,
          isPlayable: false,
          isGeneratable: false,
          notes: this.buildDeprecatedSourceNote(input),
        },
        select: { id: true },
      });

      const log = await tx.diagnosisRegistryMergeLog.create({
        data: {
          sourceDiagnosisRegistryId: analysis.source.id,
          targetDiagnosisRegistryId: analysis.target.id,
          reason:
            input.reason?.trim() ||
            'COMPLETE_DUPLICATE_KEEPER: completed existing duplicate registry and deprecated source draft',
          analysisSnapshot: analysis as unknown as Prisma.InputJsonValue,
          reassignmentSummary: summary as unknown as Prisma.InputJsonValue,
          performedByUserId: input.performedByUserId,
        },
        select: { id: true },
      });

      return {
        mergeLogId: log.id,
        analysisHash: analysis.analysisHash,
        sourceDiagnosisRegistryId: analysis.source.id,
        targetDiagnosisRegistryId: analysis.target.id,
        sourceStatus: DiagnosisRegistryStatus.DEPRECATED,
        reassignmentSummary: summary,
      };
    });

    const lifecycle = await this.lifecyclePolicy.getLifecycle(input.keeperRegistryId);
    if (
      lifecycle.duplicateRisk.registryAliasMatches > 0 ||
      lifecycle.duplicateRisk.registryCanonicalMatches > 0
    ) {
      this.logger.warn({
        event: 'diagnosis.merge.complete_duplicate_keeper.duplicate_risk_remaining',
        keeperRegistryId: input.keeperRegistryId,
        sourceDraftRegistryId: input.sourceDraftRegistryId,
        duplicateRisk: lifecycle.duplicateRisk,
      });
    }

    this.logger.log({
      event: 'diagnosis.merge.complete_duplicate_keeper.completed',
      keeperRegistryId: input.keeperRegistryId,
      sourceDraftRegistryId: input.sourceDraftRegistryId,
      performedByUserId: input.performedByUserId,
      mergeLogId: result.mergeLogId,
    });

    return {
      action: 'COMPLETE_DUPLICATE_KEEPER',
      keeperRegistryId: input.keeperRegistryId,
      lifecycle,
      ...result,
    };
  }

  private buildKeeperMetadataUpdate(
    metadata: DuplicateKeeperMetadataInput,
  ): Prisma.DiagnosisRegistryUpdateInput {
    const data: Prisma.DiagnosisRegistryUpdateInput = {};
    this.assignString(data, 'category', metadata.category);
    this.assignString(data, 'specialty', metadata.specialty);
    this.assignString(data, 'subspecialty', metadata.subspecialty);
    this.assignString(data, 'bodySystem', metadata.bodySystem);
    this.assignString(data, 'organSystem', metadata.organSystem);
    this.assignValue(data, 'difficultyBand', metadata.difficultyBand);
    this.assignValue(data, 'rarityBand', metadata.rarityBand);
    this.assignValue(data, 'clinicalSetting', metadata.clinicalSetting);
    this.assignValue(data, 'ageGroup', metadata.ageGroup);
    this.assignValue(data, 'urgencyLevel', metadata.urgencyLevel);
    this.assignJson(data, 'preferredClueTypes', metadata.preferredClueTypes);
    this.assignJson(data, 'excludedClueTypes', metadata.excludedClueTypes);
    this.assignValue(data, 'isPlayable', metadata.isPlayable);
    this.assignValue(data, 'isGeneratable', metadata.isGeneratable);
    if (
      metadata.specialty ||
      metadata.category ||
      metadata.bodySystem ||
      metadata.organSystem
    ) {
      data.onboardingStatus = DiagnosisEditorialOnboardingStatus.READY_FOR_REVIEW;
    }
    return data;
  }

  private async createReviewedAliases(
    tx: Prisma.TransactionClient,
    analysis: RegistryMergeAnalysis,
    aliases: NonNullable<CompleteDuplicateKeeperInput['aliases']>,
    summary: ReassignmentSummary,
  ) {
    for (const alias of aliases) {
      const term = alias.term.trim();
      const normalizedTerm = normalizeDiagnosisTerm(term);
      if (!term || !normalizedTerm) {
        continue;
      }
      if (normalizedTerm === analysis.target.canonicalNormalized) {
        this.skipAlias(term, 'target already represents alias canonical', summary);
        continue;
      }
      const existing = await tx.diagnosisAlias.findUnique({
        where: {
          diagnosisRegistryId_normalizedTerm: {
            diagnosisRegistryId: analysis.target.id,
            normalizedTerm,
          },
        },
        select: { id: true },
      });
      if (existing) {
        this.skipAlias(term, 'target already has this alias', summary);
        continue;
      }
      const validation = await validateAliasWithClient(tx, {
        aliasText: term,
        targetDiagnosisRegistryId: analysis.target.id,
        acceptedForMatch: alias.acceptedForMatch ?? true,
        ignoredDiagnosisRegistryIds: [analysis.source.id],
        allowTargetCanonicalAlias: false,
      });
      if (!validation.valid) {
        this.skipAlias(term, 'alias validation failed', summary);
        continue;
      }
      await tx.diagnosisAlias.create({
        data: {
          diagnosisRegistryId: analysis.target.id,
          term,
          normalizedTerm,
          kind: alias.kind ?? this.aliasKindFor(term),
          acceptedForMatch: alias.acceptedForMatch ?? true,
          active: true,
          rank: 900,
          source: 'complete-duplicate-keeper',
        },
        select: { id: true },
      });
      summary.aliasesCreated += 1;
    }
  }

  private buildDeprecatedSourceNote(input: CompleteDuplicateKeeperInput): string {
    const reason = input.reason?.trim();
    return [
      'Deprecated by COMPLETE_DUPLICATE_KEEPER workflow.',
      `Merged into keeper registry ${input.keeperRegistryId}.`,
      reason ? `Reason: ${reason}` : null,
    ]
      .filter((item): item is string => Boolean(item))
      .join(' ');
  }

  private aliasKindFor(term: string): DiagnosisAliasKind {
    return term.length <= 8 && term === term.toUpperCase()
      ? DiagnosisAliasKind.ABBREVIATION
      : DiagnosisAliasKind.ACCEPTED;
  }

  private assignString(
    data: Prisma.DiagnosisRegistryUpdateInput,
    field: keyof Prisma.DiagnosisRegistryUpdateInput,
    value: string | null | undefined,
  ) {
    if (value !== undefined) {
      (data as Record<string, unknown>)[String(field)] = value?.trim() || null;
    }
  }

  private assignValue(
    data: Prisma.DiagnosisRegistryUpdateInput,
    field: keyof Prisma.DiagnosisRegistryUpdateInput,
    value: unknown,
  ) {
    if (value !== undefined) {
      data[field] = value as never;
    }
  }

  private assignJson(
    data: Prisma.DiagnosisRegistryUpdateInput,
    field: keyof Prisma.DiagnosisRegistryUpdateInput,
    value: string[] | null | undefined,
  ) {
    if (value !== undefined) {
      data[field] = value as never;
    }
  }

  private async reassignAliases(
    tx: Prisma.TransactionClient,
    analysis: RegistryMergeAnalysis,
    summary: ReassignmentSummary,
  ) {
    await this.createAliasIfSafe(tx, analysis.source.canonicalName, analysis, summary);

    const sourceAliases = await tx.diagnosisAlias.findMany({
      where: { diagnosisRegistryId: analysis.source.id },
      orderBy: [{ rank: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        term: true,
        normalizedTerm: true,
        acceptedForMatch: true,
      },
    });

    for (const alias of sourceAliases) {
      const duplicate = await tx.diagnosisAlias.findUnique({
        where: {
          diagnosisRegistryId_normalizedTerm: {
            diagnosisRegistryId: analysis.target.id,
            normalizedTerm: alias.normalizedTerm,
          },
        },
        select: { id: true },
      });
      if (duplicate) {
        this.skipAlias(alias.term, 'target already has this alias', summary, alias.id);
        continue;
      }

      const validation = await validateAliasWithClient(tx, {
        aliasText: alias.term,
        targetDiagnosisRegistryId: analysis.target.id,
        acceptedForMatch: alias.acceptedForMatch,
        ignoreAliasId: alias.id,
        allowTargetCanonicalAlias: false,
      });
      if (!validation.valid) {
        this.skipAlias(alias.term, 'alias validation failed', summary, alias.id);
        continue;
      }

      await tx.diagnosisAlias.update({
        where: { id: alias.id },
        data: {
          diagnosisRegistryId: analysis.target.id,
          source: 'registry-merge',
        },
      });
      summary.aliasesMoved += 1;
    }
  }

  private async createAliasIfSafe(
    tx: Prisma.TransactionClient,
    term: string,
    analysis: RegistryMergeAnalysis,
    summary: ReassignmentSummary,
  ) {
    const normalizedTerm = normalizeDiagnosisTerm(term);
    const existing = await tx.diagnosisAlias.findUnique({
      where: {
        diagnosisRegistryId_normalizedTerm: {
          diagnosisRegistryId: analysis.target.id,
          normalizedTerm,
        },
      },
      select: { id: true },
    });
    if (existing || normalizedTerm === analysis.target.canonicalNormalized) {
      this.skipAlias(term, 'target already represents source canonical', summary);
      return;
    }

    const validation = await validateAliasWithClient(tx, {
      aliasText: term,
      targetDiagnosisRegistryId: analysis.target.id,
      acceptedForMatch: true,
      allowTargetCanonicalAlias: false,
    });
    if (!validation.valid) {
      this.skipAlias(term, 'source canonical alias validation failed', summary);
      return;
    }

    await tx.diagnosisAlias.create({
      data: {
        diagnosisRegistryId: analysis.target.id,
        term,
        normalizedTerm,
        kind: DiagnosisAliasKind.ACCEPTED,
        acceptedForMatch: true,
        active: true,
        rank: 1000,
        source: 'registry-merge',
      },
      select: { id: true },
    });
    summary.aliasesCreated += 1;
  }

  private async reassignOneToOneModels(
    tx: Prisma.TransactionClient,
    analysis: RegistryMergeAnalysis,
    summary: ReassignmentSummary,
  ) {
    const education = await tx.diagnosisEducation.updateMany({
      where: {
        diagnosisRegistryId: analysis.source.id,
      },
      data: { diagnosisRegistryId: analysis.target.id },
    });
    this.record(summary, 'diagnosisEducation', education.count);

    const editorialBrief = await tx.diagnosisEditorialBrief.updateMany({
      where: {
        diagnosisRegistryId: analysis.source.id,
      },
      data: { diagnosisRegistryId: analysis.target.id },
    });
    this.record(summary, 'diagnosisEditorialBrief', editorialBrief.count);
  }

  private async reassignSimpleReferences(
    tx: Prisma.TransactionClient,
    analysis: RegistryMergeAnalysis,
    summary: ReassignmentSummary,
  ) {
    const updates = [
      ['diagnosisTeachingRule', tx.diagnosisTeachingRule.updateMany({
        where: { diagnosisRegistryId: analysis.source.id },
        data: { diagnosisRegistryId: analysis.target.id },
      })],
      ['case', tx.case.updateMany({
        where: { diagnosisRegistryId: analysis.source.id },
        data: { diagnosisRegistryId: analysis.target.id },
      })],
      ['caseRevision', tx.caseRevision.updateMany({
        where: { diagnosisRegistryId: analysis.source.id },
        data: { diagnosisRegistryId: analysis.target.id },
      })],
      ['caseDifferentialMapping', tx.caseDifferentialMapping.updateMany({
        where: { resolvedDiagnosisRegistryId: analysis.source.id },
        data: { resolvedDiagnosisRegistryId: analysis.target.id },
      })],
      ['educationDifferentialMappingContext', tx.educationDifferentialMapping.updateMany({
        where: { diagnosisRegistryId: analysis.source.id },
        data: { diagnosisRegistryId: analysis.target.id },
      })],
      ['educationDifferentialMappingResolved', tx.educationDifferentialMapping.updateMany({
        where: { resolvedDiagnosisRegistryId: analysis.source.id },
        data: { resolvedDiagnosisRegistryId: analysis.target.id },
      })],
      ['registryCandidateContext', tx.diagnosisRegistryCandidate.updateMany({
        where: { contextDiagnosisRegistryId: analysis.source.id },
        data: { contextDiagnosisRegistryId: analysis.target.id },
      })],
      ['registryCandidateCreated', tx.diagnosisRegistryCandidate.updateMany({
        where: { createdRegistryId: analysis.source.id },
        data: { createdRegistryId: analysis.target.id },
      })],
    ] as const;

    for (const [key, operation] of updates) {
      const result = await operation;
      this.record(summary, key, result.count);
    }
  }

  private async reassignDifferentialLinks(
    tx: Prisma.TransactionClient,
    analysis: RegistryMergeAnalysis,
    summary: ReassignmentSummary,
  ) {
    await this.reassignCaseDifferentialLinks(tx, analysis, summary);
    await this.reassignEducationDifferentialLinks(tx, analysis, summary);
  }

  private async reassignCaseDifferentialLinks(
    tx: Prisma.TransactionClient,
    analysis: RegistryMergeAnalysis,
    summary: ReassignmentSummary,
  ) {
    const links = await tx.caseDifferentialLink.findMany({
      where: { diagnosisRegistryId: analysis.source.id },
      select: { id: true, caseId: true, caseRevisionId: true },
    });
    for (const link of links) {
      const duplicate = await tx.caseDifferentialLink.findFirst({
        where: {
          caseId: link.caseId,
          caseRevisionId: link.caseRevisionId,
          diagnosisRegistryId: analysis.target.id,
        },
        select: { id: true },
      });
      if (duplicate) {
        this.skip(summary, 'caseDifferentialLink');
        continue;
      }
      await tx.caseDifferentialLink.update({
        where: { id: link.id },
        data: { diagnosisRegistryId: analysis.target.id },
      });
      this.record(summary, 'caseDifferentialLink', 1);
    }
  }

  private async reassignEducationDifferentialLinks(
    tx: Prisma.TransactionClient,
    analysis: RegistryMergeAnalysis,
    summary: ReassignmentSummary,
  ) {
    const links = await tx.educationDifferentialLink.findMany({
      where: { diagnosisRegistryId: analysis.source.id },
      select: { id: true, educationId: true, educationRevisionId: true },
    });
    for (const link of links) {
      const duplicate = await tx.educationDifferentialLink.findFirst({
        where: {
          educationId: link.educationId,
          educationRevisionId: link.educationRevisionId,
          diagnosisRegistryId: analysis.target.id,
        },
        select: { id: true },
      });
      if (duplicate) {
        this.skip(summary, 'educationDifferentialLink');
        continue;
      }
      await tx.educationDifferentialLink.update({
        where: { id: link.id },
        data: { diagnosisRegistryId: analysis.target.id },
      });
      this.record(summary, 'educationDifferentialLink', 1);
    }
  }

  private async reassignGraphRows(
    tx: Prisma.TransactionClient,
    analysis: RegistryMergeAnalysis,
    summary: ReassignmentSummary,
  ) {
    const facts = await tx.diagnosisGraphFact.updateMany({
      where: { diagnosisRegistryId: analysis.source.id },
      data: { diagnosisRegistryId: analysis.target.id },
    });
    this.record(summary, 'diagnosisGraphFact', facts.count);

    const targetedFacts = await tx.diagnosisGraphFact.updateMany({
      where: { targetDiagnosisRegistryId: analysis.source.id },
      data: { targetDiagnosisRegistryId: analysis.target.id },
    });
    this.record(summary, 'diagnosisGraphFactTarget', targetedFacts.count);

    const candidates = await tx.diagnosisGraphCandidate.findMany({
      where: { diagnosisRegistryId: analysis.source.id },
      select: {
        id: true,
        type: true,
        sourceType: true,
        sourceId: true,
        sourcePath: true,
        normalizedText: true,
      },
    });
    for (const candidate of candidates) {
      const duplicate = await tx.diagnosisGraphCandidate.findFirst({
        where: {
          diagnosisRegistryId: analysis.target.id,
          type: candidate.type,
          sourceType: candidate.sourceType,
          sourceId: candidate.sourceId,
          sourcePath: candidate.sourcePath,
          normalizedText: candidate.normalizedText,
        },
        select: { id: true },
      });
      if (duplicate) {
        this.skip(summary, 'diagnosisGraphCandidate');
        continue;
      }
      await tx.diagnosisGraphCandidate.update({
        where: { id: candidate.id },
        data: { diagnosisRegistryId: analysis.target.id },
      });
      this.record(summary, 'diagnosisGraphCandidate', 1);
    }

    const targetedCandidates = await tx.diagnosisGraphCandidate.updateMany({
      where: { targetDiagnosisRegistryId: analysis.source.id },
      data: { targetDiagnosisRegistryId: analysis.target.id },
    });
    this.record(
      summary,
      'diagnosisGraphCandidateTarget',
      targetedCandidates.count,
    );
  }

  private async reassignTeachingRelationships(
    tx: Prisma.TransactionClient,
    analysis: RegistryMergeAnalysis,
    summary: ReassignmentSummary,
  ) {
    const relationships = await tx.diagnosisTeachingRelationship.findMany({
      where: {
        OR: [
          { sourceDiagnosisRegistryId: analysis.source.id },
          { targetDiagnosisRegistryId: analysis.source.id },
        ],
      },
      select: {
        id: true,
        sourceDiagnosisRegistryId: true,
        targetDiagnosisRegistryId: true,
        relationshipType: true,
        teachingPurpose: true,
      },
    });

    for (const relationship of relationships) {
      const nextSourceId =
        relationship.sourceDiagnosisRegistryId === analysis.source.id
          ? analysis.target.id
          : relationship.sourceDiagnosisRegistryId;
      const nextTargetId =
        relationship.targetDiagnosisRegistryId === analysis.source.id
          ? analysis.target.id
          : relationship.targetDiagnosisRegistryId;

      if (nextSourceId === nextTargetId) {
        await tx.diagnosisTeachingRelationship.update({
          where: { id: relationship.id },
          data: { status: DiagnosisTeachingRelationshipStatus.DEPRECATED },
        });
        this.skip(summary, 'diagnosisTeachingRelationship');
        continue;
      }

      const duplicate = await tx.diagnosisTeachingRelationship.findFirst({
        where: {
          id: { not: relationship.id },
          sourceDiagnosisRegistryId: nextSourceId,
          targetDiagnosisRegistryId: nextTargetId,
          relationshipType: relationship.relationshipType,
          teachingPurpose: relationship.teachingPurpose,
        },
        select: { id: true },
      });
      if (duplicate) {
        await tx.diagnosisTeachingRelationship.update({
          where: { id: relationship.id },
          data: { status: DiagnosisTeachingRelationshipStatus.DEPRECATED },
        });
        this.skip(summary, 'diagnosisTeachingRelationship');
        continue;
      }

      await tx.diagnosisTeachingRelationship.update({
        where: { id: relationship.id },
        data: {
          sourceDiagnosisRegistryId: nextSourceId,
          targetDiagnosisRegistryId: nextTargetId,
        },
      });
      this.record(summary, 'diagnosisTeachingRelationship', 1);
    }
  }

  private async reassignAttempts(
    tx: Prisma.TransactionClient,
    analysis: RegistryMergeAnalysis,
    summary: ReassignmentSummary,
  ) {
    const selected = await tx.attempt.updateMany({
      where: { selectedDiagnosisId: analysis.source.id },
      data: { selectedDiagnosisId: analysis.target.id },
    });
    this.record(summary, 'attemptSelectedDiagnosis', selected.count);

    const strict = await tx.attempt.updateMany({
      where: { strictMatchedDiagnosisId: analysis.source.id },
      data: { strictMatchedDiagnosisId: analysis.target.id },
    });
    this.record(summary, 'attemptStrictMatchedDiagnosis', strict.count);
  }

  private record(summary: ReassignmentSummary, key: string, count: number) {
    summary.referencesReassigned[key] =
      (summary.referencesReassigned[key] ?? 0) + count;
    if (count > 0) {
      this.logger.log({
        event: 'diagnosis.merge.reference_reassigned',
        referenceType: key,
        count,
      });
    }
  }

  private skip(summary: ReassignmentSummary, key: string) {
    summary.referencesSkipped[key] = (summary.referencesSkipped[key] ?? 0) + 1;
  }

  private skipAlias(
    term: string,
    reason: string,
    summary: ReassignmentSummary,
    aliasId?: string,
  ) {
    summary.aliasesSkipped.push({ aliasId, term, reason });
    this.logger.warn({
      event: 'diagnosis.merge.alias_skipped',
      aliasId,
      term,
      reason,
    });
  }

  private logBlocked(input: ExecuteRegistryMergeInput, reason: string) {
    this.logger.warn({
      event: 'diagnosis.merge.blocked',
      sourceDiagnosisRegistryId: input.sourceDiagnosisRegistryId,
      targetDiagnosisRegistryId: input.targetDiagnosisRegistryId,
      performedByUserId: input.performedByUserId,
      reason,
    });
  }
}
