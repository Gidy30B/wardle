import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  DiagnosisEvidenceRelationshipStatus,
  EvidenceNodeStatus,
  Prisma,
  ReasoningDraftArtifactType,
  ReasoningDraftTrustTier,
  ReasoningDraftValidationStatus,
} from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';

export type ReasoningDraftValidationInput = {
  artifactType: ReasoningDraftArtifactType | keyof typeof ReasoningDraftArtifactType | string;
  artifactId?: string;
  diagnosisRegistryId?: string;
  payload?: unknown;
  generationMetadata?: unknown;
};

type DraftArtifact = {
  artifactType: ReasoningDraftArtifactType;
  artifactId: string;
  diagnosisRegistryId: string;
  payload: unknown;
  text: string;
  metadata: Record<string, unknown>;
};

type ValidationSignal = {
  code: string;
  message: string;
  severity?: 'warning' | 'blocker';
};

const VALIDATOR_VERSION = 'reasoning-draft:v1';
const ABSOLUTE_LANGUAGE = /\b(always|never|pathognomonic|diagnostic of|rules out|rules in|definitive|guarantees)\b/i;
const GUIDELINE_LANGUAGE = /\b(guideline|recommended by|standard of care|must be treated|first-line|gold standard)\b/i;
const EPIDEMIOLOGY_LANGUAGE = /\b(prevalence|incidence|mortality|most common|rarely|commonly affects)\b/i;
const MANAGEMENT_LANGUAGE = /\b(treat|therapy|antibiotic|steroid|surgery|operation|resuscitation|discharge|admit|refer)\b/i;
const TEST_PERFORMANCE_LANGUAGE = /\b(sensitivity|specificity|positive predictive|negative predictive|likelihood ratio)\b/i;
const GENERIC_DISCRIMINATOR_LANGUAGE = /\b(key clue|important finding|clinical picture|classic presentation|consider this)\b/i;

@Injectable()
export class ReasoningDraftValidationService {
  private readonly logger = new Logger(ReasoningDraftValidationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async listRuns(query: {
    artifactType?: string;
    diagnosisRegistryId?: string;
    trustTier?: string;
    validationStatus?: string;
    limit?: number;
  } = {}) {
    const rows = await this.prisma.reasoningDraftValidationRun.findMany({
      where: {
        ...(query.artifactType
          ? { artifactType: this.artifactType(query.artifactType) }
          : {}),
        ...(query.diagnosisRegistryId
          ? { diagnosisRegistryId: query.diagnosisRegistryId }
          : {}),
        ...(query.trustTier
          ? { trustTier: query.trustTier as ReasoningDraftTrustTier }
          : {}),
        ...(query.validationStatus
          ? {
              validationStatus:
                query.validationStatus as ReasoningDraftValidationStatus,
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(query.limit ?? 100, 1), 250),
    });
    return rows.map((row) => this.toDto(row));
  }

  async runForArtifact(input: ReasoningDraftValidationInput) {
    const artifactType = this.artifactType(input.artifactType);
    if (!input.artifactId) {
      throw new BadRequestException('artifactId is required');
    }
    this.log('reasoning_draft.validation.started', {
      artifactType,
      artifactId: input.artifactId,
    });
    try {
      const artifact = await this.loadArtifact({
        artifactType,
        artifactId: input.artifactId,
      });
      const result = await this.validateAndPersist(artifact);
      if (result.trustTier === ReasoningDraftTrustTier.LOW_TRUST) {
        this.log('reasoning_draft.validation.low_trust', {
          artifactType,
          artifactId: input.artifactId,
          trustScore: result.trustScore,
        });
      }
      if (result.trustTier === ReasoningDraftTrustTier.BLOCKED) {
        this.log('reasoning_draft.validation.blocked', {
          artifactType,
          artifactId: input.artifactId,
          trustScore: result.trustScore,
          blockers: result.blockers,
        });
      }
      return result;
    } catch (error) {
      this.log('reasoning_draft.validation.failed', {
        artifactType,
        artifactId: input.artifactId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async runAfterGeneration(input: ReasoningDraftValidationInput) {
    try {
      if (!input.artifactId) return null;
      return await this.runForArtifact(input);
    } catch (error) {
      this.log('reasoning_draft.validation.failed', {
        artifactType: input.artifactType,
        artifactId: input.artifactId ?? null,
        nonBlocking: true,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  async validateRaw(input: ReasoningDraftValidationInput) {
    const artifactType = this.artifactType(input.artifactType);
    if (!input.payload || !input.diagnosisRegistryId) {
      throw new BadRequestException(
        'payload and diagnosisRegistryId are required for raw validation',
      );
    }
    return this.validateDraft({
      artifactType,
      artifactId: input.artifactId ?? 'raw-draft',
      diagnosisRegistryId: input.diagnosisRegistryId,
      payload: input.payload,
      text: this.stringify(input.payload),
      metadata: this.asRecord(input.generationMetadata),
    });
  }

  private async validateAndPersist(artifact: DraftArtifact) {
    const validation = await this.validateDraft(artifact);
    const row = await this.prisma.reasoningDraftValidationRun.create({
      data: {
        artifactType: artifact.artifactType,
        artifactId: artifact.artifactId,
        diagnosisRegistryId: artifact.diagnosisRegistryId,
        reasoningPathId: validation.reasoningPathId,
        trustScore: validation.trustScore,
        trustTier: validation.trustTier,
        validationStatus: validation.validationStatus,
        blockers: validation.blockers as Prisma.InputJsonValue,
        warnings: validation.warnings as Prisma.InputJsonValue,
        strengths: validation.strengths as Prisma.InputJsonValue,
        hallucinationRiskSignals:
          validation.hallucinationRiskSignals as Prisma.InputJsonValue,
        reasoningCoverage:
          validation.reasoningCoverage as Prisma.InputJsonValue,
        evidenceCoverage: validation.evidenceCoverage as Prisma.InputJsonValue,
        discriminatorCoverage:
          validation.discriminatorCoverage as Prisma.InputJsonValue,
        unsupportedClaimSignals:
          validation.unsupportedClaimSignals as Prisma.InputJsonValue,
        recommendations: validation.recommendations as Prisma.InputJsonValue,
        validatorVersion: VALIDATOR_VERSION,
      },
    });
    const dto = this.toDto(row);
    this.log('reasoning_draft.validation.completed', {
      artifactType: artifact.artifactType,
      artifactId: artifact.artifactId,
      diagnosisRegistryId: artifact.diagnosisRegistryId,
      reasoningPathId: dto.reasoningPathId,
      trustScore: dto.trustScore,
      trustTier: dto.trustTier,
      validationStatus: dto.validationStatus,
    });
    return dto;
  }

  private async validateDraft(artifact: DraftArtifact) {
    const metadata = artifact.metadata;
    const constrained = metadata.constrained === true;
    const reasoningPathId = this.stringValue(metadata.reasoningPathId);
    const requiredTeachingPoints = this.stringList(metadata.requiredTeachingPoints);
    const discriminatorEvidenceUsed = this.stringList(
      metadata.discriminatorEvidenceUsed,
    );
    const coverageGapsAddressed = this.stringList(
      metadata.coverageGapsAddressed,
    );
    const sourceEvidenceRelationshipIds = this.stringList(
      metadata.sourceEvidenceRelationshipIds,
    );
    const contradictoryDiagnosisIds = this.stringList(
      metadata.contradictoryDiagnosisIds,
    );
    const text = this.normalizeText(artifact.text);
    const blockers: ValidationSignal[] = [];
    const warnings: ValidationSignal[] = [];
    const strengths: ValidationSignal[] = [];
    const hallucinationRiskSignals: ValidationSignal[] = [];
    const unsupportedClaimSignals: ValidationSignal[] = [];

    const activeEvidence = await this.prisma.diagnosisEvidenceRelationship.findMany({
      where: {
        diagnosisRegistryId: artifact.diagnosisRegistryId,
        status: DiagnosisEvidenceRelationshipStatus.ACTIVE,
        evidenceNode: {
          status: { notIn: [EvidenceNodeStatus.REJECTED, EvidenceNodeStatus.DEPRECATED] },
        },
      },
      include: { evidenceNode: true },
    });
    const activeEvidenceIds = new Set(activeEvidence.map((item) => item.id));
    const activeEvidenceLabels = activeEvidence.map(
      (item) => item.evidenceNode.displayLabel,
    );
    const representedEvidenceLabels = activeEvidenceLabels.filter((label) =>
      this.containsText(text, label),
    );
    const representedEvidenceTypes = new Set(
      activeEvidence
        .filter((item) => representedEvidenceLabels.includes(item.evidenceNode.displayLabel))
        .map((item) => item.evidenceNode.evidenceType),
    );
    const missingSourceEvidenceIds = sourceEvidenceRelationshipIds.filter(
      (id) => !activeEvidenceIds.has(id),
    );
    const representedTeachingPoints = requiredTeachingPoints.filter((point) =>
      this.containsText(text, point),
    );
    const representedDiscriminatorEvidence = discriminatorEvidenceUsed.filter(
      (evidence) => this.containsText(text, evidence),
    );
    const addressedContradictoryDiagnoses = contradictoryDiagnosisIds.filter((id) =>
      text.includes(this.normalizeText(id)),
    );

    if (constrained && !reasoningPathId) {
      blockers.push({
        code: 'missing_reasoning_path_id',
        message: 'Constrained draft is missing reasoningPathId.',
        severity: 'blocker',
      });
    }
    if (!constrained) {
      warnings.push({
        code: 'unconstrained_draft',
        message: 'Draft was generated without an active reasoning path.',
      });
    }
    if (requiredTeachingPoints.length && !representedTeachingPoints.length) {
      blockers.push({
        code: 'missing_required_teaching_points',
        message: 'Draft does not represent any required teaching point.',
        severity: 'blocker',
      });
    }
    if (
      discriminatorEvidenceUsed.length &&
      !representedDiscriminatorEvidence.length
    ) {
      blockers.push({
        code: 'missing_discriminator_evidence',
        message: 'Draft does not represent expected discriminator evidence.',
        severity: 'blocker',
      });
    }
    if (sourceEvidenceRelationshipIds.length && missingSourceEvidenceIds.length) {
      warnings.push({
        code: 'missing_active_source_evidence',
        message: 'Some source evidence relationships are no longer active.',
      });
    }
    if (!representedEvidenceLabels.length) {
      warnings.push({
        code: 'no_active_evidence_overlap',
        message: 'Draft text does not overlap with active evidence labels.',
      });
    }
    if (representedEvidenceTypes.size < 2 && activeEvidence.length >= 3) {
      warnings.push({
        code: 'weak_evidence_diversity',
        message: 'Draft evidence overlap is narrow for this diagnosis.',
      });
    }
    if (!this.hasDiscriminatorLanguage(text, discriminatorEvidenceUsed)) {
      warnings.push({
        code: 'absent_or_generic_discriminator',
        message: 'Draft lacks a specific discriminator signal.',
      });
    }
    if (coverageGapsAddressed.length && !this.anyTextMatch(text, coverageGapsAddressed)) {
      warnings.push({
        code: 'declared_gap_not_addressed',
        message: 'Draft metadata declares a coverage gap that is not represented in text.',
      });
    }
    if (
      contradictoryDiagnosisIds.length &&
      artifact.artifactType !== ReasoningDraftArtifactType.CASE &&
      !addressedContradictoryDiagnoses.length
    ) {
      warnings.push({
        code: 'contradictory_diagnoses_not_addressed',
        message: 'Expected contrast diagnoses were not explicitly addressed.',
      });
    }

    this.detectRiskLanguage(artifact.text, hallucinationRiskSignals, unsupportedClaimSignals);

    if (representedTeachingPoints.length) {
      strengths.push({
        code: 'required_teaching_points_represented',
        message: `${representedTeachingPoints.length} required teaching point(s) represented.`,
      });
    }
    if (representedDiscriminatorEvidence.length) {
      strengths.push({
        code: 'discriminator_evidence_represented',
        message: `${representedDiscriminatorEvidence.length} discriminator evidence signal(s) represented.`,
      });
    }
    if (representedEvidenceLabels.length) {
      strengths.push({
        code: 'active_evidence_overlap',
        message: `${representedEvidenceLabels.length} active evidence label(s) represented.`,
      });
    }

    const reasoningCoverage = {
      constrained,
      reasoningPathId,
      requiredTeachingPointCount: requiredTeachingPoints.length,
      representedTeachingPointCount: representedTeachingPoints.length,
      coverageGapsDeclared: coverageGapsAddressed,
      coverageGapsRepresented: coverageGapsAddressed.filter((gap) =>
        this.containsText(text, gap),
      ),
    };
    const evidenceCoverage = {
      sourceEvidenceRelationshipCount: sourceEvidenceRelationshipIds.length,
      missingActiveSourceEvidenceIds: missingSourceEvidenceIds,
      activeEvidenceOverlapCount: representedEvidenceLabels.length,
      representedEvidenceLabels: representedEvidenceLabels.slice(0, 12),
      representedEvidenceTypes: [...representedEvidenceTypes],
    };
    const discriminatorCoverage = {
      expectedDiscriminatorCount: discriminatorEvidenceUsed.length,
      representedDiscriminatorCount: representedDiscriminatorEvidence.length,
      representedDiscriminatorEvidence,
      contradictoryDiagnosisCount: contradictoryDiagnosisIds.length,
      addressedContradictoryDiagnosisCount: addressedContradictoryDiagnoses.length,
    };

    const trustScore = this.trustScore({
      constrained,
      blockers,
      warnings,
      hallucinationRiskSignals,
      unsupportedClaimSignals,
      strengths,
    });
    const trustTier = this.trustTier(trustScore, blockers);
    const validationStatus =
      trustTier === ReasoningDraftTrustTier.BLOCKED
        ? ReasoningDraftValidationStatus.FAILED
        : trustTier === ReasoningDraftTrustTier.HIGH_TRUST
          ? ReasoningDraftValidationStatus.PASSED
          : ReasoningDraftValidationStatus.NEEDS_REVIEW;

    return {
      artifactType: artifact.artifactType,
      artifactId: artifact.artifactId,
      diagnosisRegistryId: artifact.diagnosisRegistryId,
      reasoningPathId,
      trustScore,
      trustTier,
      validationStatus,
      blockers,
      warnings,
      strengths,
      hallucinationRiskSignals,
      reasoningCoverage,
      evidenceCoverage,
      discriminatorCoverage,
      unsupportedClaimSignals,
      recommendations: this.recommendations({
        trustTier,
        constrained,
        blockers,
        warnings,
        hallucinationRiskSignals,
      }),
      validatorVersion: VALIDATOR_VERSION,
    };
  }

  private async loadArtifact(input: {
    artifactType: ReasoningDraftArtifactType;
    artifactId: string;
  }): Promise<DraftArtifact> {
    if (input.artifactType === ReasoningDraftArtifactType.CASE) {
      const row = await this.prisma.case.findUnique({
        where: { id: input.artifactId },
        select: {
          id: true,
          diagnosisRegistryId: true,
          history: true,
          symptoms: true,
          clues: true,
          differentials: true,
          explanation: true,
        },
      });
      if (!row || !row.diagnosisRegistryId) {
        throw new NotFoundException('Case artifact not found or not registry-linked');
      }
      const quality = this.asRecord(this.asRecord(row.explanation)?.generationQuality);
      const trace = this.asRecord(quality.reasoningPathTrace);
      const governance = this.asRecord(quality.generationGovernance);
      return {
        artifactType: input.artifactType,
        artifactId: row.id,
        diagnosisRegistryId: row.diagnosisRegistryId,
        payload: row,
        text: this.stringify(row),
        metadata: {
          ...governance,
          constrained: governance.constrained === true,
          reasoningPathId: this.stringValue(trace.reasoningPathId),
          reasoningGoal: this.stringValue(trace.reasoningGoal),
          requiredTeachingPoints: this.stringList(
            this.asRecord(trace.constraints).requiredTeachingPoints,
          ),
          sourceEvidenceRelationshipIds: this.stringList(
            trace.supportingEvidenceRelationshipIds,
          ),
          discriminatorEvidenceUsed: this.stringList(
            trace.discriminatorEvidenceNodeIds,
          ),
          coverageGapsAddressed: this.stringList(quality.reasoningQualityWarnings),
        },
      };
    }

    if (input.artifactType === ReasoningDraftArtifactType.TEACHING_RULE) {
      const row = await this.prisma.diagnosisTeachingRule.findUnique({
        where: { id: input.artifactId },
      });
      if (!row) throw new NotFoundException('Teaching rule artifact not found');
      return {
        artifactType: input.artifactType,
        artifactId: row.id,
        diagnosisRegistryId: row.diagnosisRegistryId,
        payload: row,
        text: this.stringify({
          title: row.title,
          rationale: row.rationale,
          acceptableManifestations: row.acceptableManifestations,
          requiredDifferentials: row.requiredDifferentials,
          expectedEvidence: row.expectedEvidence,
        }),
        metadata: this.extractGeneratedBecause(row.difficultyHints),
      };
    }

    const row = await this.prisma.diagnosisEducation.findUnique({
      where: { id: input.artifactId },
    });
    if (!row) throw new NotFoundException('Education artifact not found');
    return {
      artifactType: input.artifactType,
      artifactId: row.id,
      diagnosisRegistryId: row.diagnosisRegistryId,
      payload: row,
      text: this.stringify(row),
      metadata: this.extractGeneratedBecause(row.references),
    };
  }

  private extractGeneratedBecause(value: unknown): Record<string, unknown> {
    const record = this.asRecord(value);
    const nested = this.asRecord(record.generatedBecause);
    if (Object.keys(nested).length) return nested;
    if (Array.isArray(value)) {
      for (const item of [...value].reverse()) {
        const generatedBecause = this.asRecord(this.asRecord(item).generatedBecause);
        if (Object.keys(generatedBecause).length) return generatedBecause;
      }
    }
    return {};
  }

  private artifactType(value: unknown): ReasoningDraftArtifactType {
    if (typeof value !== 'string') {
      throw new BadRequestException('artifactType is required');
    }
    const normalized = value.trim().toUpperCase();
    if (normalized in ReasoningDraftArtifactType) {
      return ReasoningDraftArtifactType[
        normalized as keyof typeof ReasoningDraftArtifactType
      ];
    }
    throw new BadRequestException(`Unsupported artifactType: ${value}`);
  }

  private trustScore(input: {
    constrained: boolean;
    blockers: ValidationSignal[];
    warnings: ValidationSignal[];
    hallucinationRiskSignals: ValidationSignal[];
    unsupportedClaimSignals: ValidationSignal[];
    strengths: ValidationSignal[];
  }) {
    const base = input.constrained ? 78 : 58;
    const score =
      base +
      input.strengths.length * 5 -
      input.blockers.length * 25 -
      input.warnings.length * 7 -
      input.hallucinationRiskSignals.length * 6 -
      input.unsupportedClaimSignals.length * 8;
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private trustTier(score: number, blockers: ValidationSignal[]) {
    if (blockers.length || score < 45) return ReasoningDraftTrustTier.BLOCKED;
    if (score < 65) return ReasoningDraftTrustTier.LOW_TRUST;
    if (score < 85) return ReasoningDraftTrustTier.REVIEW_REQUIRED;
    return ReasoningDraftTrustTier.HIGH_TRUST;
  }

  private recommendations(input: {
    trustTier: ReasoningDraftTrustTier;
    constrained: boolean;
    blockers: ValidationSignal[];
    warnings: ValidationSignal[];
    hallucinationRiskSignals: ValidationSignal[];
  }) {
    const recommendations: string[] = [];
    if (!input.constrained) {
      recommendations.push('Regenerate with an active reasoning path before senior review.');
    }
    if (input.blockers.length) {
      recommendations.push('Resolve blockers or regenerate before marking ready.');
    }
    if (input.hallucinationRiskSignals.length) {
      recommendations.push('Review absolute, guideline, management, or test-performance claims against structured evidence.');
    }
    if (input.trustTier === ReasoningDraftTrustTier.LOW_TRUST) {
      recommendations.push('Senior review recommended before approval.');
    }
    if (input.trustTier === ReasoningDraftTrustTier.BLOCKED) {
      recommendations.push('Do not publish until manually overridden or regenerated.');
    }
    if (!recommendations.length && input.warnings.length) {
      recommendations.push('Editor review should confirm advisory warnings.');
    }
    if (!recommendations.length) {
      recommendations.push('Draft is suitable for routine editorial review.');
    }
    return recommendations;
  }

  private detectRiskLanguage(
    text: string,
    hallucinationRiskSignals: ValidationSignal[],
    unsupportedClaimSignals: ValidationSignal[],
  ) {
    const checks: Array<[RegExp, string, string, ValidationSignal[]]> = [
      [ABSOLUTE_LANGUAGE, 'absolute_language', 'Absolute diagnostic language needs structured support.', hallucinationRiskSignals],
      [GUIDELINE_LANGUAGE, 'unsupported_guideline_claim', 'Guideline or standard-of-care language requires editor verification.', unsupportedClaimSignals],
      [EPIDEMIOLOGY_LANGUAGE, 'unsupported_epidemiology_claim', 'Epidemiology claim requires structured support.', unsupportedClaimSignals],
      [MANAGEMENT_LANGUAGE, 'unsupported_management_claim', 'Management claim requires editor verification.', unsupportedClaimSignals],
      [TEST_PERFORMANCE_LANGUAGE, 'unsupported_test_performance_claim', 'Test-performance claim requires structured support.', unsupportedClaimSignals],
    ];
    for (const [pattern, code, message, target] of checks) {
      if (pattern.test(text)) target.push({ code, message });
    }
  }

  private hasDiscriminatorLanguage(text: string, expected: string[]) {
    if (expected.some((item) => this.containsText(text, item))) return true;
    if (GENERIC_DISCRIMINATOR_LANGUAGE.test(text)) return false;
    return /\b(distinguish|differentiat|separat|contrast|rather than|unlike|points away|rules out)\b/i.test(text);
  }

  private anyTextMatch(text: string, values: string[]) {
    return values.some((value) => this.containsText(text, value));
  }

  private containsText(normalizedText: string, value: string) {
    const normalizedValue = this.normalizeText(value);
    if (!normalizedText || !normalizedValue) return false;
    if (normalizedText.includes(normalizedValue)) return true;
    const tokens = normalizedValue.split(' ').filter((token) => token.length >= 4);
    if (!tokens.length) return false;
    const overlap = tokens.filter((token) => normalizedText.includes(token)).length;
    return overlap / tokens.length >= 0.6;
  }

  private stringify(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  private normalizeText(value: unknown): string {
    return this.stringify(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private stringValue(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private stringList(value: unknown): string[] {
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : [];
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private toDto(row: {
    id: string;
    artifactType: ReasoningDraftArtifactType;
    artifactId: string;
    diagnosisRegistryId: string;
    reasoningPathId: string | null;
    trustScore: number;
    trustTier: ReasoningDraftTrustTier;
    validationStatus: ReasoningDraftValidationStatus;
    blockers: Prisma.JsonValue;
    warnings: Prisma.JsonValue;
    strengths: Prisma.JsonValue;
    hallucinationRiskSignals: Prisma.JsonValue;
    reasoningCoverage: Prisma.JsonValue;
    evidenceCoverage: Prisma.JsonValue;
    discriminatorCoverage: Prisma.JsonValue;
    unsupportedClaimSignals: Prisma.JsonValue;
    recommendations: Prisma.JsonValue;
    validatorVersion: string;
    createdAt: Date;
  }) {
    return {
      ...row,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private log(event: string, payload: Record<string, unknown>) {
    this.logger.log(JSON.stringify({ event, ...payload }));
  }
}
