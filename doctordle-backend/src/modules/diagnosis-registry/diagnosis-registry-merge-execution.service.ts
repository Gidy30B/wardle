import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  DiagnosisAliasKind,
  DiagnosisRegistryStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';
import { normalizeDiagnosisTerm } from './diagnosis-term-normalizer';
import {
  DiagnosisRegistryMergeAnalysisService,
  type RegistryMergeAnalysis,
} from './diagnosis-registry-merge-analysis.service';
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
