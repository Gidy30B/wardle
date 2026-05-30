import { Injectable } from '@nestjs/common';
import {
  DiagnosisGraphCandidateType,
  DiagnosisGraphSourceType,
  Prisma,
} from '@prisma/client';
import {
  buildGraphDedupeKey,
  compactGraphText,
  normalizeGraphText,
} from './diagnosis-graph-normalization';

export type DiagnosisGraphReasoningRelation =
  | 'MIMICS'
  | 'SUPPORTS'
  | 'RULES_OUT'
  | 'DISCRIMINATES_FROM'
  | 'CONFIRMS';

export type DiagnosisGraphCandidateDraft = {
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

type DifferentialAnalysisItem = {
  diagnosis?: unknown;
  whyPlausibleEarly?: unknown;
  ruledOutByClues?: unknown;
  finalReasonLessLikely?: unknown;
};

type RuledOutByClue = {
  clueOrder?: unknown;
  evidence?: unknown;
  reason?: unknown;
};

@Injectable()
export class GraphReasoningExtractorService {
  extractCaseDifferentialAnalysis(input: {
    diagnosisRegistryId: string;
    sourceId: string;
    sourceVersion?: number | null;
    explanation: unknown;
  }): DiagnosisGraphCandidateDraft[] {
    const explanation = this.asObject(input.explanation);
    return this.asArray(explanation.differentialAnalysis).flatMap(
      (item, itemIndex) =>
        this.extractDifferentialAnalysisItem({
          diagnosisRegistryId: input.diagnosisRegistryId,
          sourceId: input.sourceId,
          sourceVersion: input.sourceVersion ?? null,
          item: this.asObject(item) as DifferentialAnalysisItem,
          itemIndex,
        }),
    );
  }

  private extractDifferentialAnalysisItem(input: {
    diagnosisRegistryId: string;
    sourceId: string;
    sourceVersion: number | null;
    item: DifferentialAnalysisItem;
    itemIndex: number;
  }): DiagnosisGraphCandidateDraft[] {
    const targetDiagnosisText = compactGraphText(input.item.diagnosis);
    if (!targetDiagnosisText) {
      return [];
    }

    const candidates: DiagnosisGraphCandidateDraft[] = [
      this.buildReasoningCandidate({
        diagnosisRegistryId: input.diagnosisRegistryId,
        type: DiagnosisGraphCandidateType.MIMIC,
        sourceId: input.sourceId,
        sourceVersion: input.sourceVersion,
        sourcePath: `explanation.differentialAnalysis.${input.itemIndex}.diagnosis`,
        rawText: targetDiagnosisText,
        targetDiagnosisText,
        unresolvedTargetText: targetDiagnosisText,
        relation: 'MIMICS',
        rationale: 'Listed as a differential diagnosis in case analysis.',
        confidence: 0.8,
      }),
    ];

    const whyPlausibleEarly = compactGraphText(
      input.item.whyPlausibleEarly,
    );
    if (whyPlausibleEarly) {
      candidates.push(
        this.buildReasoningCandidate({
          diagnosisRegistryId: input.diagnosisRegistryId,
          type: DiagnosisGraphCandidateType.CASE_REASONING,
          sourceId: input.sourceId,
          sourceVersion: input.sourceVersion,
          sourcePath: `explanation.differentialAnalysis.${input.itemIndex}.whyPlausibleEarly`,
          rawText: whyPlausibleEarly,
          targetDiagnosisText,
          relation: 'SUPPORTS',
          finding: whyPlausibleEarly,
          evidence: whyPlausibleEarly,
          rationale: whyPlausibleEarly,
          confidence: 0.65,
        }),
      );
    }

    this.asArray(input.item.ruledOutByClues).forEach((entry, entryIndex) => {
      const ruledOut = this.asObject(entry) as RuledOutByClue;
      const evidence = compactGraphText(ruledOut.evidence);
      const rationale = compactGraphText(ruledOut.reason);
      const clueOrder =
        typeof ruledOut.clueOrder === 'number'
          ? ruledOut.clueOrder
          : undefined;
      if (!evidence || !rationale) {
        return;
      }

      const sourcePath =
        `explanation.differentialAnalysis.${input.itemIndex}` +
        `.ruledOutByClues.${entryIndex}`;
      candidates.push(
        this.buildReasoningCandidate({
          diagnosisRegistryId: input.diagnosisRegistryId,
          type: DiagnosisGraphCandidateType.CASE_REASONING,
          sourceId: input.sourceId,
          sourceVersion: input.sourceVersion,
          sourcePath,
          rawText: `${evidence} - ${rationale}`,
          targetDiagnosisText,
          relation: 'RULES_OUT',
          finding: evidence,
          evidence,
          rationale,
          clueOrder,
          confidence: 0.75,
        }),
        this.buildReasoningCandidate({
          diagnosisRegistryId: input.diagnosisRegistryId,
          type: DiagnosisGraphCandidateType.CASE_REASONING,
          sourceId: input.sourceId,
          sourceVersion: input.sourceVersion,
          sourcePath: `${sourcePath}.supports`,
          rawText: evidence,
          relation: 'SUPPORTS',
          finding: evidence,
          evidence,
          rationale:
            'Used in the case analysis as evidence favoring the source diagnosis over a mimic.',
          clueOrder,
          confidence: 0.55,
        }),
      );
    });

    const finalReasonLessLikely = compactGraphText(
      input.item.finalReasonLessLikely,
    );
    if (finalReasonLessLikely) {
      candidates.push(
        this.buildReasoningCandidate({
          diagnosisRegistryId: input.diagnosisRegistryId,
          type: DiagnosisGraphCandidateType.CASE_REASONING,
          sourceId: input.sourceId,
          sourceVersion: input.sourceVersion,
          sourcePath: `explanation.differentialAnalysis.${input.itemIndex}.finalReasonLessLikely`,
          rawText: finalReasonLessLikely,
          targetDiagnosisText,
          relation: 'DISCRIMINATES_FROM',
          rationale: finalReasonLessLikely,
          confidence: 0.7,
        }),
      );
    }

    return candidates;
  }

  private buildReasoningCandidate(input: {
    diagnosisRegistryId: string;
    type: DiagnosisGraphCandidateType;
    sourceId: string;
    sourceVersion: number | null;
    sourcePath: string;
    rawText: string;
    relation: DiagnosisGraphReasoningRelation;
    targetDiagnosisText?: string;
    unresolvedTargetText?: string;
    targetDiagnosisRegistryId?: string | null;
    finding?: string;
    evidence?: string;
    rationale: string;
    clueOrder?: number;
    confidence: number;
  }): DiagnosisGraphCandidateDraft {
    const normalizedText = normalizeGraphText(input.rawText);
    const unresolvedTargetText = input.unresolvedTargetText ?? null;
    const payload: Prisma.InputJsonObject = {
      relation: input.relation,
      sourceDiagnosisRegistryId: input.diagnosisRegistryId,
      targetDiagnosisRegistryId: input.targetDiagnosisRegistryId ?? undefined,
      targetDiagnosisText: input.targetDiagnosisText ?? undefined,
      finding: input.finding ?? input.rawText,
      evidence: input.evidence ?? input.rawText,
      rationale: input.rationale,
      clueOrder: input.clueOrder,
      source: 'case.differentialAnalysis',
      confidence: input.confidence,
    };

    return {
      diagnosisRegistryId: input.diagnosisRegistryId,
      type: input.type,
      sourceType: DiagnosisGraphSourceType.CASE,
      sourceId: input.sourceId,
      sourceVersion: input.sourceVersion,
      sourcePath: input.sourcePath,
      rawText: input.rawText,
      normalizedText,
      dedupeKey: buildGraphDedupeKey([
        input.diagnosisRegistryId,
        input.type,
        input.relation,
        DiagnosisGraphSourceType.CASE,
        input.sourceId,
        input.sourcePath,
        normalizedText,
        input.targetDiagnosisRegistryId ?? unresolvedTargetText ?? '',
      ]),
      payload,
      targetDiagnosisRegistryId: input.targetDiagnosisRegistryId ?? null,
      unresolvedTargetText,
      confidence: input.confidence,
    };
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
}
