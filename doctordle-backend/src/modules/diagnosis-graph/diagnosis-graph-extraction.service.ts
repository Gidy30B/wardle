import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CaseEditorialStatus,
  DiagnosisEducationStatus,
  DiagnosisGraphCandidateType,
  DiagnosisGraphSourceType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';
import { normalizeDiagnosisTerm } from '../diagnosis-registry/diagnosis-term-normalizer';
import {
  buildGraphDedupeKey,
  compactGraphText,
  normalizeGraphText,
} from './diagnosis-graph-normalization';

type CandidateDraft = {
  diagnosisRegistryId: string;
  type: DiagnosisGraphCandidateType;
  sourceType: DiagnosisGraphSourceType;
  sourceId: string;
  sourceVersion?: number | null;
  sourcePath: string;
  rawText: string;
  normalizedText: string;
  dedupeKey: string;
  payload?: Prisma.InputJsonValue;
  targetDiagnosisRegistryId?: string | null;
  unresolvedTargetText?: string | null;
  confidence?: number | null;
};

export type DiagnosisGraphExtractionSummary = {
  sourceType: DiagnosisGraphSourceType;
  sourceId: string;
  diagnosisRegistryId: string | null;
  candidateCount: number;
  createdCount: number;
  duplicatesSkippedCount: number;
  byType: Partial<Record<DiagnosisGraphCandidateType, number>>;
};

export type DiagnosisGraphSmokeSummary = {
  diagnosisRegistryId: string;
  displayLabel: string;
  casesProcessed: number;
  educationProcessed: number;
  candidatesCreated: number;
  duplicatesSkipped: number;
  byType: Partial<Record<DiagnosisGraphCandidateType, number>>;
};

type ClinicalClue = {
  type?: unknown;
  value?: unknown;
  order?: unknown;
};

@Injectable()
export class DiagnosisGraphExtractionService {
  private readonly logger = new Logger(DiagnosisGraphExtractionService.name);

  constructor(private readonly prisma: PrismaService) {}

  async extractFromApprovedCase(
    caseId: string,
  ): Promise<DiagnosisGraphExtractionSummary> {
    const caseRecord = await this.prisma.case.findFirst({
      where: {
        id: caseId,
        editorialStatus: CaseEditorialStatus.APPROVED,
        diagnosisRegistryId: { not: null },
      },
      select: {
        id: true,
        diagnosisRegistryId: true,
        clues: true,
        differentials: true,
        explanation: true,
        currentRevision: {
          select: {
            revisionNumber: true,
          },
        },
      },
    });

    if (!caseRecord?.diagnosisRegistryId) {
      return this.emptySummary(DiagnosisGraphSourceType.CASE, caseId);
    }

    const candidates: CandidateDraft[] = [];
    const sourceVersion = caseRecord.currentRevision?.revisionNumber ?? null;
    const clues = this.asArray(caseRecord.clues);

    clues.forEach((clue, index) => {
      const value = this.asObject(clue) as ClinicalClue;
      const rawText = compactGraphText(value.value);
      const clueType = compactGraphText(value.type);
      if (!rawText || !clueType) {
        return;
      }

      const type =
        clueType === 'lab' || clueType === 'imaging'
          ? DiagnosisGraphCandidateType.INVESTIGATION
          : DiagnosisGraphCandidateType.FINDING;
      candidates.push(
        this.buildCandidate({
          diagnosisRegistryId: caseRecord.diagnosisRegistryId!,
          type,
          sourceType: DiagnosisGraphSourceType.CASE,
          sourceId: caseRecord.id,
          sourceVersion,
          sourcePath: `clues.${index}`,
          rawText,
          payload: this.toPayload({ clue }),
        }),
      );
    });

    caseRecord.differentials.forEach((differential, index) => {
      const rawText = compactGraphText(differential);
      if (!rawText) {
        return;
      }

      candidates.push(
        this.buildCandidate({
          diagnosisRegistryId: caseRecord.diagnosisRegistryId!,
          type: DiagnosisGraphCandidateType.MIMIC,
          sourceType: DiagnosisGraphSourceType.CASE,
          sourceId: caseRecord.id,
          sourceVersion,
          sourcePath: `differentials.${index}`,
          rawText,
          unresolvedTargetText: rawText,
        }),
      );
    });

    const explanation = this.asObject(caseRecord.explanation);
    this.asArray(explanation.keyFindings).forEach((finding, index) => {
      const rawText = compactGraphText(finding);
      if (!rawText) {
        return;
      }

      candidates.push(
        this.buildCandidate({
          diagnosisRegistryId: caseRecord.diagnosisRegistryId!,
          type: DiagnosisGraphCandidateType.FINDING,
          sourceType: DiagnosisGraphSourceType.CASE,
          sourceId: caseRecord.id,
          sourceVersion,
          sourcePath: `explanation.keyFindings.${index}`,
          rawText,
        }),
      );
    });

    this.asArray(explanation.reasoning).forEach((reason, index) => {
      const rawText = compactGraphText(reason);
      if (!rawText) {
        return;
      }

      candidates.push(
        this.buildCandidate({
          diagnosisRegistryId: caseRecord.diagnosisRegistryId!,
          type: DiagnosisGraphCandidateType.CASE_REASONING,
          sourceType: DiagnosisGraphSourceType.CASE,
          sourceId: caseRecord.id,
          sourceVersion,
          sourcePath: `explanation.reasoning.${index}`,
          rawText,
        }),
      );
    });

    return this.persistCandidates({
      sourceType: DiagnosisGraphSourceType.CASE,
      sourceId: caseRecord.id,
      diagnosisRegistryId: caseRecord.diagnosisRegistryId,
      candidates: await this.resolveMimicTargets(candidates),
    });
  }

  async extractFromPublishedEducation(
    educationId: string,
  ): Promise<DiagnosisGraphExtractionSummary> {
    const education = await this.prisma.diagnosisEducation.findFirst({
      where: {
        id: educationId,
        editorialStatus: DiagnosisEducationStatus.PUBLISHED,
      },
      select: {
        id: true,
        diagnosisRegistryId: true,
        version: true,
        keySymptoms: true,
        keySigns: true,
        examPearls: true,
        investigations: true,
        differentials: true,
        management: true,
        complications: true,
        pitfalls: true,
        recallPrompts: true,
      },
    });

    if (!education) {
      return this.emptySummary(
        DiagnosisGraphSourceType.DIAGNOSIS_EDUCATION,
        educationId,
      );
    }

    const candidates: CandidateDraft[] = [];
    const pushEducationArray = (
      field: keyof typeof education,
      type: DiagnosisGraphCandidateType,
      textKeys: string[],
    ) => {
      this.asArray(education[field]).forEach((item, index) => {
        const rawText = this.extractText(item, textKeys);
        if (!rawText) {
          return;
        }

        candidates.push(
          this.buildCandidate({
            diagnosisRegistryId: education.diagnosisRegistryId,
            type,
            sourceType: DiagnosisGraphSourceType.DIAGNOSIS_EDUCATION,
            sourceId: education.id,
            sourceVersion: education.version,
            sourcePath: `${field}.${index}`,
            rawText,
            payload: this.toPayload({ item }),
            unresolvedTargetText:
              type === DiagnosisGraphCandidateType.MIMIC
                ? this.extractText(item, ['diagnosis', 'title', 'label']) ??
                  rawText
                : null,
          }),
        );
      });
    };

    pushEducationArray('keySymptoms', DiagnosisGraphCandidateType.FINDING, [
      'finding',
      'content',
      'label',
      'title',
    ]);
    pushEducationArray('keySigns', DiagnosisGraphCandidateType.FINDING, [
      'finding',
      'content',
      'label',
      'title',
    ]);

    this.asArray(education.examPearls).forEach((item, index) => {
      const itemObject = this.asObject(item);
      const pearlType = compactGraphText(itemObject.type);
      const rawText = this.extractText(item, [
        'content',
        'finding',
        'label',
        'title',
        'explanation',
        'pitfall',
      ]);
      if (!rawText) {
        return;
      }

      candidates.push(
        this.buildCandidate({
          diagnosisRegistryId: education.diagnosisRegistryId,
          type:
            pearlType === 'PITFALL'
              ? DiagnosisGraphCandidateType.PITFALL
              : DiagnosisGraphCandidateType.FINDING,
          sourceType: DiagnosisGraphSourceType.DIAGNOSIS_EDUCATION,
          sourceId: education.id,
          sourceVersion: education.version,
          sourcePath: `examPearls.${index}`,
          rawText,
          payload: this.toPayload({ item }),
        }),
      );
    });

    pushEducationArray('investigations', DiagnosisGraphCandidateType.INVESTIGATION, [
      'test',
      'content',
      'title',
      'significance',
      'interpretation',
    ]);
    pushEducationArray('differentials', DiagnosisGraphCandidateType.MIMIC, [
      'diagnosis',
      'title',
      'content',
      'distinguishingPoint',
      'keySeparator',
    ]);
    pushEducationArray('management', DiagnosisGraphCandidateType.MANAGEMENT, [
      'step',
      'content',
      'title',
      'rationale',
    ]);
    pushEducationArray('complications', DiagnosisGraphCandidateType.COMPLICATION, [
      'complication',
      'content',
      'title',
      'label',
    ]);
    pushEducationArray('pitfalls', DiagnosisGraphCandidateType.PITFALL, [
      'pitfall',
      'content',
      'title',
      'trapAvoided',
      'saferHeuristic',
    ]);
    pushEducationArray('recallPrompts', DiagnosisGraphCandidateType.RECALL_PROMPT, [
      'prompt',
      'linkedConcept',
      'answer',
    ]);

    return this.persistCandidates({
      sourceType: DiagnosisGraphSourceType.DIAGNOSIS_EDUCATION,
      sourceId: education.id,
      diagnosisRegistryId: education.diagnosisRegistryId,
      candidates: await this.resolveMimicTargets(candidates),
    });
  }

  async runSmokeExtraction(input: {
    diagnosisRegistryIds: string[];
    includeCases?: boolean;
    includeEducation?: boolean;
  }): Promise<DiagnosisGraphSmokeSummary[]> {
    const ids = [...new Set(input.diagnosisRegistryIds.map((id) => id.trim()))]
      .filter((id) => id.length > 0);

    if (!ids.length) {
      throw new BadRequestException('diagnosisRegistryIds is required');
    }

    const includeCases = input.includeCases ?? true;
    const includeEducation = input.includeEducation ?? true;

    const registries = await this.prisma.diagnosisRegistry.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        displayLabel: true,
        cases: includeCases
          ? {
              where: { editorialStatus: CaseEditorialStatus.APPROVED },
              select: { id: true },
            }
          : false,
        education: includeEducation
          ? {
              where: { editorialStatus: DiagnosisEducationStatus.PUBLISHED },
              select: { id: true },
            }
          : false,
      },
    });

    if (registries.length !== ids.length) {
      const found = new Set(registries.map((registry) => registry.id));
      const missing = ids.filter((id) => !found.has(id));
      throw new NotFoundException(
        `Diagnosis registry entries not found: ${missing.join(', ')}`,
      );
    }

    const summaries: DiagnosisGraphSmokeSummary[] = [];
    for (const registry of registries) {
      const caseRows = Array.isArray(registry.cases) ? registry.cases : [];
      const educationRow = registry.education;
      const sourceSummaries: DiagnosisGraphExtractionSummary[] = [];

      for (const caseRow of caseRows) {
        sourceSummaries.push(await this.extractFromApprovedCase(caseRow.id));
      }

      if (educationRow) {
        sourceSummaries.push(
          await this.extractFromPublishedEducation(educationRow.id),
        );
      }

      summaries.push({
        diagnosisRegistryId: registry.id,
        displayLabel: registry.displayLabel,
        casesProcessed: caseRows.length,
        educationProcessed: educationRow ? 1 : 0,
        candidatesCreated: sourceSummaries.reduce(
          (sum, summary) => sum + summary.createdCount,
          0,
        ),
        duplicatesSkipped: sourceSummaries.reduce(
          (sum, summary) => sum + summary.duplicatesSkippedCount,
          0,
        ),
        byType: this.mergeByType(sourceSummaries.map((summary) => summary.byType)),
      });
    }

    return summaries;
  }

  private buildCandidate(
    input: Omit<CandidateDraft, 'normalizedText' | 'dedupeKey'>,
  ): CandidateDraft {
    const normalizedText = normalizeGraphText(input.rawText);
    const unresolvedTargetText = input.unresolvedTargetText ?? null;
    return {
      ...input,
      normalizedText,
      dedupeKey: buildGraphDedupeKey([
        input.diagnosisRegistryId,
        input.type,
        input.sourceType,
        input.sourceId,
        input.sourcePath,
        normalizedText,
        input.targetDiagnosisRegistryId ?? unresolvedTargetText ?? '',
      ]),
      confidence: input.confidence ?? null,
      targetDiagnosisRegistryId: input.targetDiagnosisRegistryId ?? null,
      unresolvedTargetText,
    };
  }

  private async resolveMimicTargets(
    candidates: CandidateDraft[],
  ): Promise<CandidateDraft[]> {
    const resolved: CandidateDraft[] = [];

    for (const candidate of candidates) {
      if (
        candidate.type !== DiagnosisGraphCandidateType.MIMIC ||
        !candidate.unresolvedTargetText
      ) {
        resolved.push(candidate);
        continue;
      }

      const target = await this.findDiagnosisRegistryByText(
        candidate.diagnosisRegistryId,
        candidate.unresolvedTargetText,
      );
      const unresolvedTargetText = target ? null : candidate.unresolvedTargetText;
      resolved.push({
        ...candidate,
        targetDiagnosisRegistryId: target?.id ?? null,
        unresolvedTargetText,
        dedupeKey: buildGraphDedupeKey([
          candidate.diagnosisRegistryId,
          candidate.type,
          candidate.sourceType,
          candidate.sourceId,
          candidate.sourcePath,
          candidate.normalizedText,
          target?.id ?? unresolvedTargetText ?? '',
        ]),
      });
    }

    return resolved;
  }

  private async findDiagnosisRegistryByText(
    sourceDiagnosisRegistryId: string,
    text: string,
  ): Promise<{ id: string } | null> {
    const normalized = normalizeDiagnosisTerm(text);
    if (!normalized) {
      return null;
    }

    return this.prisma.diagnosisRegistry.findFirst({
      where: {
        active: true,
        id: { not: sourceDiagnosisRegistryId },
        OR: [
          { displayLabel: { equals: text.trim(), mode: 'insensitive' } },
          { canonicalNormalized: normalized },
          { canonicalName: { equals: text.trim(), mode: 'insensitive' } },
          {
            aliases: {
              some: {
                active: true,
                normalizedTerm: normalized,
              },
            },
          },
        ],
      },
      select: { id: true },
    });
  }

  private async persistCandidates(input: {
    sourceType: DiagnosisGraphSourceType;
    sourceId: string;
    diagnosisRegistryId: string;
    candidates: CandidateDraft[];
  }): Promise<DiagnosisGraphExtractionSummary> {
    const data = input.candidates.filter((candidate) => candidate.normalizedText);
    const byType = this.countByType(data);
    if (!data.length) {
      const summary = {
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        diagnosisRegistryId: input.diagnosisRegistryId,
        candidateCount: 0,
        createdCount: 0,
        duplicatesSkippedCount: 0,
        byType,
      };
      this.logCompleted(summary);
      return summary;
    }

    try {
      const result = await this.prisma.diagnosisGraphCandidate.createMany({
        data,
        skipDuplicates: true,
      });
      const summary = {
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        diagnosisRegistryId: input.diagnosisRegistryId,
        candidateCount: data.length,
        createdCount: result.count,
        duplicatesSkippedCount: data.length - result.count,
        byType,
      };
      this.logCompleted(summary);
      return summary;
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'diagnosis_graph.extraction.failed',
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          diagnosisRegistryId: input.diagnosisRegistryId,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      throw error;
    }
  }

  private emptySummary(
    sourceType: DiagnosisGraphSourceType,
    sourceId: string,
  ): DiagnosisGraphExtractionSummary {
    return {
      sourceType,
      sourceId,
      diagnosisRegistryId: null,
      candidateCount: 0,
      createdCount: 0,
      duplicatesSkippedCount: 0,
      byType: {},
    };
  }

  private countByType(
    candidates: CandidateDraft[],
  ): Partial<Record<DiagnosisGraphCandidateType, number>> {
    return candidates.reduce<Partial<Record<DiagnosisGraphCandidateType, number>>>(
      (counts, candidate) => {
        counts[candidate.type] = (counts[candidate.type] ?? 0) + 1;
        return counts;
      },
      {},
    );
  }

  private mergeByType(
    values: Array<Partial<Record<DiagnosisGraphCandidateType, number>>>,
  ): Partial<Record<DiagnosisGraphCandidateType, number>> {
    return values.reduce<Partial<Record<DiagnosisGraphCandidateType, number>>>(
      (merged, current) => {
        for (const [type, count] of Object.entries(current)) {
          merged[type as DiagnosisGraphCandidateType] =
            (merged[type as DiagnosisGraphCandidateType] ?? 0) + count;
        }
        return merged;
      },
      {},
    );
  }

  private logCompleted(summary: DiagnosisGraphExtractionSummary): void {
    this.logger.log(
      JSON.stringify({
        event: 'diagnosis_graph.extraction.completed',
        sourceType: summary.sourceType,
        sourceId: summary.sourceId,
        diagnosisRegistryId: summary.diagnosisRegistryId,
        candidateCount: summary.candidateCount,
        createdCount: summary.createdCount,
        duplicatesSkippedCount: summary.duplicatesSkippedCount,
        byType: summary.byType,
      }),
    );
  }

  private extractText(value: unknown, keys: string[]): string | null {
    const direct = compactGraphText(value);
    if (direct) {
      return direct;
    }

    const object = this.asObject(value);
    for (const key of keys) {
      const found = compactGraphText(object[key]);
      if (found) {
        return found;
      }
    }

    return null;
  }

  private asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private asObject(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }

  private toPayload(value: unknown): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
  }
}
