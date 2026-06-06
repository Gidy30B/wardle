import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CaseEditorialStatus,
  DiagnosisEditorialOnboardingStatus,
  DiagnosisEducationStatus,
  DiagnosisEvidenceRelationshipStatus,
  DiagnosisEvidenceRelationshipType,
  DiagnosisGraphCandidateType,
  DiagnosisGraphFactStatus,
  DiagnosisRegistryStatus,
  DiagnosisTeachingRelationshipStatus,
  EvidenceNodeStatus,
  EvidenceType,
  Prisma,
  ReasoningPathStatus,
  ReasoningDraftTrustTier,
} from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';

export type EvidenceReadinessTier = 'ready' | 'partial' | 'weak';

export type EvidenceCoverageQuery = {
  specialty?: string;
  evidenceWeakness?: string;
  readinessTier?: EvidenceReadinessTier | string;
  playableOnly?: boolean;
  onboardingStatus?: string;
};

export type EvidenceCoverageWeakness =
  | 'missing_evidence_graph'
  | 'missing_discriminator_evidence'
  | 'weak_evidence_diversity'
  | 'missing_case_evidence'
  | 'missing_education_evidence'
  | 'missing_rule_evidence'
  | 'missing_teaching_relationship_evidence'
  | 'overused_evidence_pattern'
  | 'missing_imaging_discriminator'
  | 'missing_lab_discriminator'
  | 'weak_escalation_evidence'
  | 'weak_complication_evidence'
  | 'missing_management_contrast'
  | 'missing_reasoning_path_coverage'
  | 'weak_reasoning_diversity'
  | 'missing_constrained_teaching_rule_generation'
  | 'missing_constrained_education_generation'
  | 'unconstrained_educational_draft'
  | 'low_trust_generated_draft'
  | 'blocked_generated_draft'
  | 'hallucination_risk_generated_draft';

type CoverageRow = Awaited<
  ReturnType<EvidenceCoverageService['loadRows']>
>[number];

type RelationshipRow = CoverageRow['evidenceRelationships'][number];

type CoverageSignals = {
  activeRelationships: RelationshipRow[];
  discriminatorRelationships: RelationshipRow[];
  evidenceTypes: Set<EvidenceType>;
  caseCoveredIds: Set<string>;
  educationCoveredIds: Set<string>;
  ruleCoveredIds: Set<string>;
  teachingRelationshipCoveredIds: Set<string>;
  activeReasoningPathCount: number;
  reasoningPathGoalDiversity: number;
  constrainedTeachingRuleCount: number;
  constrainedEducationGenerationCount: number;
  unconstrainedEducationGenerationCount: number;
  lowTrustDraftCount: number;
  blockedDraftCount: number;
  hallucinationRiskDraftCount: number;
  overusedPatterns: Array<{ evidenceKey: string; count: number; reason: string }>;
  weaknesses: EvidenceCoverageWeakness[];
};

const ACTIVE_RULE_STATUSES = new Set(['APPROVED', 'ACTIVE', 'PUBLISHED']);
const ACTIVE_CASE_STATUSES = new Set<CaseEditorialStatus>([
  CaseEditorialStatus.APPROVED,
  CaseEditorialStatus.READY_TO_PUBLISH,
  CaseEditorialStatus.PUBLISHED,
]);

@Injectable()
export class EvidenceCoverageService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(query: EvidenceCoverageQuery = {}) {
    const diagnoses = await this.getDiagnoses(query);
    const byType = this.countEvidenceTypes(diagnoses);
    const weakDiagnoses = diagnoses
      .filter((diagnosis) => diagnosis.coverageWeaknesses.length)
      .slice(0, 50);

    return {
      generatedAt: new Date().toISOString(),
      filters: this.normalizeQuery(query),
      summary: {
        diagnosisCount: diagnoses.length,
        averageCoverageScore: average(
          diagnoses.map((diagnosis) => diagnosis.coverageScore),
        ),
        averageGenerationReadinessScore: average(
          diagnoses.map((diagnosis) => diagnosis.generationReadinessScore),
        ),
        readyDiagnoses: diagnoses.filter(
          (diagnosis) => diagnosis.generationReadinessTier === 'ready',
        ).length,
        partialDiagnoses: diagnoses.filter(
          (diagnosis) => diagnosis.generationReadinessTier === 'partial',
        ).length,
        weakDiagnoses: diagnoses.filter(
          (diagnosis) => diagnosis.generationReadinessTier === 'weak',
        ).length,
        diagnosesLackingDiscriminatorEvidence: diagnoses.filter((diagnosis) =>
          diagnosis.coverageWeaknesses.includes(
            'missing_discriminator_evidence',
          ),
        ).length,
        diagnosesWithWeakEvidenceDiversity: diagnoses.filter((diagnosis) =>
          diagnosis.coverageWeaknesses.includes('weak_evidence_diversity'),
        ).length,
        overusedEvidencePatterns: diagnoses.reduce(
          (total, diagnosis) => total + diagnosis.redundancy.overusedEvidence.length,
          0,
        ),
        missingEvidenceGaps: diagnoses.reduce(
          (total, diagnosis) => total + diagnosis.missingEvidence.length,
          0,
        ),
      },
      evidenceTypeDistribution: byType,
      weakDiagnoses,
      generationReadiness: {
        caseGenerationReady: diagnoses.filter(
          (diagnosis) => diagnosis.generationReadiness.caseGeneration.tier === 'ready',
        ).length,
        teachingRuleGenerationReady: diagnoses.filter(
          (diagnosis) =>
            diagnosis.generationReadiness.teachingRuleGeneration.tier === 'ready',
        ).length,
        discriminatorGenerationReady: diagnoses.filter(
          (diagnosis) =>
            diagnosis.generationReadiness.discriminatorGeneration.tier === 'ready',
        ).length,
        differentialGenerationReady: diagnoses.filter(
          (diagnosis) =>
            diagnosis.generationReadiness.differentialGeneration.tier === 'ready',
        ).length,
      },
    };
  }

  async getDiagnoses(query: EvidenceCoverageQuery = {}) {
    const normalized = this.normalizeQuery(query);
    const rows = await this.loadRows(normalized);
    return rows
      .map((row) => this.toCoverage(row))
      .filter((diagnosis) => this.matchesFilters(diagnosis, normalized))
      .sort(
        (left, right) =>
          left.coverageScore - right.coverageScore ||
          left.diagnosisName.localeCompare(right.diagnosisName),
      );
  }

  async getDiagnosis(diagnosisRegistryId: string) {
    const row = (
      await this.loadRows({
        diagnosisRegistryId,
      } as EvidenceCoverageQuery & { diagnosisRegistryId: string })
    )[0];
    if (!row) {
      throw new NotFoundException('Diagnosis registry entry not found');
    }
    return this.toCoverage(row);
  }

  async loadRows(
    query: EvidenceCoverageQuery & { diagnosisRegistryId?: string },
  ) {
    return this.prisma.diagnosisRegistry.findMany({
      where: {
        ...(query.diagnosisRegistryId ? { id: query.diagnosisRegistryId } : {}),
        ...(query.specialty ? { specialty: query.specialty } : {}),
        ...(query.onboardingStatus
          ? {
              onboardingStatus:
                query.onboardingStatus as DiagnosisEditorialOnboardingStatus,
            }
          : {}),
        active: true,
      },
      select: {
        id: true,
        canonicalName: true,
        displayLabel: true,
        specialty: true,
        bodySystem: true,
        category: true,
        onboardingStatus: true,
        status: true,
        active: true,
        isPlayable: true,
        isGeneratable: true,
        education: {
          select: {
            editorialStatus: true,
            summary: true,
            clinicalPattern: true,
            keySymptoms: true,
            keySigns: true,
            examPearls: true,
            investigations: true,
            differentials: true,
            management: true,
            complications: true,
            pitfalls: true,
            recallPrompts: true,
            references: true,
          },
        },
        teachingRules: {
          select: {
            id: true,
            title: true,
            category: true,
            rationale: true,
            acceptableManifestations: true,
            expectedEvidence: true,
            difficultyHints: true,
            requiredDifferentials: true,
            appliesToCaseGeneration: true,
            appliesToGraph: true,
            status: true,
          },
        },
        cases: {
          select: {
            id: true,
            title: true,
            history: true,
            symptoms: true,
            labs: true,
            clues: true,
            explanation: true,
            editorialStatus: true,
            dailyCases: { select: { id: true } },
          },
        },
        graphFacts: {
          where: { status: DiagnosisGraphFactStatus.ACTIVE },
          select: { id: true, type: true, targetDiagnosisRegistryId: true },
        },
        sourceTeachingRelationships: {
          where: { status: DiagnosisTeachingRelationshipStatus.ACTIVE },
          select: {
            id: true,
            relationshipType: true,
            teachingPurpose: true,
            discriminatorSummary: true,
            commonConfusionReason: true,
            learnerPitfall: true,
            targetDiagnosisRegistryId: true,
          },
        },
        caseDifferentialLinks: {
          select: { diagnosisRegistryId: true },
        },
        educationDifferentialLinks: {
          select: { diagnosisRegistryId: true },
        },
        evidenceRelationships: {
          where: {
            status: DiagnosisEvidenceRelationshipStatus.ACTIVE,
            evidenceNode: {
              status: { notIn: [EvidenceNodeStatus.REJECTED, EvidenceNodeStatus.DEPRECATED] },
            },
          },
          select: {
            id: true,
            relationshipType: true,
            strength: true,
            discriminatorWeight: true,
            reasoningSummary: true,
            contradictoryDiagnosisIds: true,
            supportingTeachingRelationshipId: true,
            supportingTeachingRuleId: true,
            supportingCaseId: true,
            evidenceNode: {
              select: {
                id: true,
                normalizedKey: true,
                displayLabel: true,
                evidenceType: true,
                clinicalCategory: true,
              },
            },
          },
        },
        reasoningPaths: {
          where: { status: ReasoningPathStatus.ACTIVE },
          select: {
            id: true,
            reasoningGoal: true,
            generationPurpose: true,
            readinessScore: true,
          },
        },
        reasoningDraftValidationRuns: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            trustTier: true,
            hallucinationRiskSignals: true,
            unsupportedClaimSignals: true,
          },
        },
      },
      take: 500,
    });
  }

  private toCoverage(row: CoverageRow) {
    const signals = this.coverageSignals(row);
    const activeReasoningPaths = this.activeReasoningPaths(row);
    const reasoningPathGoalDiversity = new Set(
      activeReasoningPaths.map((path) => path.reasoningGoal),
    ).size;
    const coverageScore = this.coverageScore(row, signals);
    const generationReadiness = this.generationReadiness(row, signals);
    const readinessScores = Object.values(generationReadiness).map(
      (item) => item.score,
    );
    const generationReadinessScore = average(readinessScores);

    return {
      diagnosisRegistryId: row.id,
      diagnosisName: row.displayLabel || row.canonicalName,
      canonicalName: row.canonicalName,
      specialty: row.specialty,
      bodySystem: row.bodySystem,
      category: row.category,
      onboardingStatus: row.onboardingStatus,
      lifecycle: {
        active: row.active,
        playable: row.status === DiagnosisRegistryStatus.ACTIVE && row.isPlayable,
        generatable:
          row.status === DiagnosisRegistryStatus.ACTIVE &&
          row.isPlayable &&
          row.isGeneratable,
        status: row.status,
      },
      coverageScore,
      coverageBreakdown: {
        evidenceNodeCount: signals.activeRelationships.length,
        activeReasoningPathCount: activeReasoningPaths.length,
        reasoningPathGoalDiversity,
        constrainedTeachingRuleCount: signals.constrainedTeachingRuleCount,
        constrainedEducationGenerationCount:
          signals.constrainedEducationGenerationCount,
        unconstrainedEducationGenerationCount:
          signals.unconstrainedEducationGenerationCount,
        lowTrustDraftCount: signals.lowTrustDraftCount,
        blockedDraftCount: signals.blockedDraftCount,
        hallucinationRiskDraftCount: signals.hallucinationRiskDraftCount,
        discriminatorEvidenceCount: signals.discriminatorRelationships.length,
        evidenceDiversityCount: signals.evidenceTypes.size,
        teachingRelationshipEvidenceCoverage: percent(
          signals.teachingRelationshipCoveredIds.size,
          signals.activeRelationships.length,
        ),
        caseEvidenceCoverage: percent(
          signals.caseCoveredIds.size,
          signals.activeRelationships.length,
        ),
        educationEvidenceCoverage: percent(
          signals.educationCoveredIds.size,
          signals.activeRelationships.length,
        ),
        ruleEvidenceCoverage: percent(
          signals.ruleCoveredIds.size,
          signals.activeRelationships.length,
        ),
      },
      coverageWeaknesses: signals.weaknesses,
      evidenceByType: [...signals.evidenceTypes].reduce<Record<string, number>>(
        (acc, type) => {
          acc[type] = signals.activeRelationships.filter(
            (relationship) => relationship.evidenceNode.evidenceType === type,
          ).length;
          return acc;
        },
        {},
      ),
      missingEvidence: this.missingEvidence(row, signals),
      redundancy: {
        overusedEvidence: signals.overusedPatterns,
        lowDiversity: signals.weaknesses.includes('weak_evidence_diversity'),
        repeatedDiscriminators: this.repeatedDiscriminators(signals),
        shallowReasoningPatterns: signals.activeRelationships
          .filter(
            (relationship) =>
              !relationship.reasoningSummary ||
              relationship.reasoningSummary.trim().length < 24 ||
              relationship.strength <= 1,
          )
          .map((relationship) => relationship.evidenceNode.displayLabel),
      },
      generationReadiness,
      generationReadinessScore,
      generationReadinessTier: this.readinessTier(generationReadinessScore),
      generationReadinessReasons: this.unique(
        Object.values(generationReadiness).flatMap((item) => item.reasons),
      ),
      generationHooks: {
        suggestedEvidenceExpansion: signals.weaknesses.some((weakness) =>
          [
            'missing_evidence_graph',
            'weak_evidence_diversity',
            'missing_case_evidence',
            'missing_education_evidence',
          ].includes(weakness),
        ),
        suggestedDiscriminatorCoverage: signals.discriminatorRelationships.length < 2,
        suggestedReasoningPathCoverage:
          activeReasoningPaths.length === 0 || reasoningPathGoalDiversity < 2,
        suggestedEducationalConstraintCoverage:
          signals.constrainedTeachingRuleCount === 0 ||
          signals.constrainedEducationGenerationCount === 0 ||
          signals.unconstrainedEducationGenerationCount > 0,
        suggestedDraftValidationReview:
          signals.lowTrustDraftCount > 0 ||
          signals.blockedDraftCount > 0 ||
          signals.hallucinationRiskDraftCount > 0,
        suggestedGenerationPrerequisites: this.generationPrerequisites(
          row,
          signals,
        ),
      },
      targetUrl: `/editorial/diagnoses/${row.id}`,
    };
  }

  private coverageSignals(row: CoverageRow): CoverageSignals {
    const activeReasoningPaths = this.activeReasoningPaths(row);
    const reasoningPathGoalDiversity = new Set(
      activeReasoningPaths.map((path) => path.reasoningGoal),
    ).size;
    const activeRelationships = row.evidenceRelationships;
    const constrainedTeachingRuleCount = row.teachingRules.filter((rule) =>
      this.generatedBecause(rule.difficultyHints)?.constrained === true,
    ).length;
    const educationGenerationMetadata = this.educationGeneratedBecause(
      row.education?.references,
    );
    const constrainedEducationGenerationCount =
      educationGenerationMetadata.filter((item) => item.constrained === true).length;
    const unconstrainedEducationGenerationCount =
      educationGenerationMetadata.filter((item) => item.constrained === false).length;
    const validationRuns = row.reasoningDraftValidationRuns ?? [];
    const lowTrustDraftCount = validationRuns.filter(
      (run) => run.trustTier === ReasoningDraftTrustTier.LOW_TRUST,
    ).length;
    const blockedDraftCount = validationRuns.filter(
      (run) => run.trustTier === ReasoningDraftTrustTier.BLOCKED,
    ).length;
    const hallucinationRiskDraftCount = validationRuns.filter(
      (run) =>
        this.asArray(run.hallucinationRiskSignals).length > 0 ||
        this.asArray(run.unsupportedClaimSignals).length > 0,
    ).length;
    const discriminatorRelationships = activeRelationships.filter(
      (relationship) =>
        relationship.relationshipType ===
          DiagnosisEvidenceRelationshipType.DISCRIMINATES ||
        relationship.discriminatorWeight >= 3,
    );
    const evidenceTypes = new Set(
      activeRelationships.map(
        (relationship) => relationship.evidenceNode.evidenceType,
      ),
    );
    const caseTexts = row.cases.map((caseRecord) => ({
      id: caseRecord.id,
      text: this.normalizeSearchText(caseRecord),
      active: caseRecord.editorialStatus
        ? ACTIVE_CASE_STATUSES.has(caseRecord.editorialStatus)
        : false,
    }));
    const educationText = this.normalizeSearchText(row.education);
    const rules = row.teachingRules.filter((rule) =>
      ACTIVE_RULE_STATUSES.has(rule.status),
    );
    const ruleTexts = rules.map((rule) => ({
      id: rule.id,
      text: this.normalizeSearchText(rule),
    }));
    const teachingRelationshipTexts = row.sourceTeachingRelationships.map(
      (relationship) => ({
        id: relationship.id,
        text: this.normalizeSearchText(relationship),
      }),
    );
    const caseCoveredIds = new Set<string>();
    const educationCoveredIds = new Set<string>();
    const ruleCoveredIds = new Set<string>();
    const teachingRelationshipCoveredIds = new Set<string>();
    const casePatternCounts = new Map<string, Set<string>>();

    for (const relationship of activeRelationships) {
      const key = relationship.evidenceNode.normalizedKey;
      const label = relationship.evidenceNode.displayLabel;
      for (const caseText of caseTexts) {
        if (
          relationship.supportingCaseId === caseText.id ||
          this.containsEvidence(caseText.text, key, label)
        ) {
          caseCoveredIds.add(relationship.id);
          const caseIds = casePatternCounts.get(key) ?? new Set<string>();
          caseIds.add(caseText.id);
          casePatternCounts.set(key, caseIds);
        }
      }
      if (this.containsEvidence(educationText, key, label)) {
        educationCoveredIds.add(relationship.id);
      }
      for (const rule of ruleTexts) {
        if (
          relationship.supportingTeachingRuleId === rule.id ||
          this.containsEvidence(rule.text, key, label)
        ) {
          ruleCoveredIds.add(relationship.id);
        }
      }
      for (const teachingRelationship of teachingRelationshipTexts) {
        if (
          relationship.supportingTeachingRelationshipId ===
            teachingRelationship.id ||
          this.containsEvidence(teachingRelationship.text, key, label)
        ) {
          teachingRelationshipCoveredIds.add(relationship.id);
        }
      }
    }

    const overusedPatterns = [...casePatternCounts.entries()]
      .filter(([, caseIds]) => caseIds.size >= 3)
      .map(([evidenceKey, caseIds]) => ({
        evidenceKey,
        count: caseIds.size,
        reason: 'Same evidence appears across three or more cases',
      }));
    const weaknesses = this.coverageWeaknesses({
      activeRelationships,
      discriminatorRelationships,
      evidenceTypes,
      caseCoveredIds,
      educationCoveredIds,
      ruleCoveredIds,
      teachingRelationshipCoveredIds,
      activeReasoningPathCount: activeReasoningPaths.length,
      reasoningPathGoalDiversity,
      constrainedTeachingRuleCount,
      constrainedEducationGenerationCount,
      unconstrainedEducationGenerationCount,
      lowTrustDraftCount,
      blockedDraftCount,
      hallucinationRiskDraftCount,
      overusedPatterns,
    });

    return {
      activeRelationships,
      discriminatorRelationships,
      evidenceTypes,
      caseCoveredIds,
      educationCoveredIds,
      ruleCoveredIds,
      teachingRelationshipCoveredIds,
      activeReasoningPathCount: activeReasoningPaths.length,
      reasoningPathGoalDiversity,
      constrainedTeachingRuleCount,
      constrainedEducationGenerationCount,
      unconstrainedEducationGenerationCount,
      lowTrustDraftCount,
      blockedDraftCount,
      hallucinationRiskDraftCount,
      overusedPatterns,
      weaknesses,
    };
  }

  private activeReasoningPaths(row: CoverageRow) {
    return row.reasoningPaths ?? [];
  }

  private coverageWeaknesses(input: {
    activeRelationships: RelationshipRow[];
    discriminatorRelationships: RelationshipRow[];
    evidenceTypes: Set<EvidenceType>;
    caseCoveredIds: Set<string>;
    educationCoveredIds: Set<string>;
    ruleCoveredIds: Set<string>;
    teachingRelationshipCoveredIds: Set<string>;
    activeReasoningPathCount: number;
    reasoningPathGoalDiversity: number;
    constrainedTeachingRuleCount: number;
    constrainedEducationGenerationCount: number;
    unconstrainedEducationGenerationCount: number;
    lowTrustDraftCount: number;
    blockedDraftCount: number;
    hallucinationRiskDraftCount: number;
    overusedPatterns: Array<{ evidenceKey: string; count: number; reason: string }>;
  }): EvidenceCoverageWeakness[] {
    return [
      input.activeRelationships.length === 0 ? 'missing_evidence_graph' : null,
      input.discriminatorRelationships.length === 0
        ? 'missing_discriminator_evidence'
        : null,
      input.activeRelationships.length > 0 && input.evidenceTypes.size < 3
        ? 'weak_evidence_diversity'
        : null,
      input.activeRelationships.length > 0 && input.caseCoveredIds.size === 0
        ? 'missing_case_evidence'
        : null,
      input.activeRelationships.length > 0 && input.educationCoveredIds.size === 0
        ? 'missing_education_evidence'
        : null,
      input.activeRelationships.length > 0 && input.ruleCoveredIds.size === 0
        ? 'missing_rule_evidence'
        : null,
      input.activeRelationships.length > 0 &&
      input.teachingRelationshipCoveredIds.size === 0
        ? 'missing_teaching_relationship_evidence'
        : null,
      input.overusedPatterns.length > 0 ? 'overused_evidence_pattern' : null,
      this.hasDiscriminatorType(input.discriminatorRelationships, EvidenceType.IMAGING)
        ? null
        : 'missing_imaging_discriminator',
      this.hasDiscriminatorType(input.discriminatorRelationships, EvidenceType.LAB)
        ? null
        : 'missing_lab_discriminator',
      input.activeRelationships.some(
        (relationship) =>
          relationship.relationshipType ===
          DiagnosisEvidenceRelationshipType.ESCALATES,
      )
        ? null
        : 'weak_escalation_evidence',
      input.activeRelationships.some(
        (relationship) =>
          relationship.relationshipType ===
            DiagnosisEvidenceRelationshipType.COMPLICATION_SIGNAL ||
          relationship.evidenceNode.evidenceType === EvidenceType.COMPLICATION,
      )
        ? null
        : 'weak_complication_evidence',
      input.activeRelationships.some(
        (relationship) =>
          relationship.relationshipType ===
            DiagnosisEvidenceRelationshipType.MANAGEMENT_SIGNAL ||
          relationship.evidenceNode.evidenceType === EvidenceType.MANAGEMENT,
      )
        ? null
        : 'missing_management_contrast',
      input.activeReasoningPathCount === 0
        ? 'missing_reasoning_path_coverage'
        : null,
      input.activeReasoningPathCount > 0 && input.reasoningPathGoalDiversity < 2
        ? 'weak_reasoning_diversity'
        : null,
      input.constrainedTeachingRuleCount === 0
        ? 'missing_constrained_teaching_rule_generation'
        : null,
      input.constrainedEducationGenerationCount === 0
        ? 'missing_constrained_education_generation'
        : null,
      input.unconstrainedEducationGenerationCount > 0
        ? 'unconstrained_educational_draft'
        : null,
      input.lowTrustDraftCount > 0 ? 'low_trust_generated_draft' : null,
      input.blockedDraftCount > 0 ? 'blocked_generated_draft' : null,
      input.hallucinationRiskDraftCount > 0
        ? 'hallucination_risk_generated_draft'
        : null,
    ].filter((item): item is EvidenceCoverageWeakness => Boolean(item));
  }

  private coverageScore(row: CoverageRow, signals: CoverageSignals) {
    if (signals.activeRelationships.length === 0) return 0;
    const score =
      percent(signals.activeRelationships.length, 6) * 0.15 +
      percent(signals.discriminatorRelationships.length, 2) * 0.2 +
      percent(signals.evidenceTypes.size, 4) * 0.15 +
      percent(signals.caseCoveredIds.size, signals.activeRelationships.length) *
        0.15 +
      percent(
        signals.educationCoveredIds.size,
        signals.activeRelationships.length,
      ) *
        0.12 +
      percent(signals.ruleCoveredIds.size, signals.activeRelationships.length) *
        0.12 +
      percent(
        signals.teachingRelationshipCoveredIds.size,
        Math.min(signals.activeRelationships.length, 3),
      ) *
        0.11;
    const lifecyclePenalty =
      row.status === DiagnosisRegistryStatus.ACTIVE && row.active ? 0 : 10;
    return clamp(Math.round(score - lifecyclePenalty), 0, 100);
  }

  private generationReadiness(row: CoverageRow, signals: CoverageSignals) {
    const playableCases = row.cases.filter((caseRecord) =>
      caseRecord.editorialStatus
        ? ACTIVE_CASE_STATUSES.has(caseRecord.editorialStatus)
        : false,
    );
    const differentialCount = new Set([
      ...row.caseDifferentialLinks.map((link) => link.diagnosisRegistryId),
      ...row.educationDifferentialLinks.map((link) => link.diagnosisRegistryId),
      ...signals.discriminatorRelationships.flatMap((relationship) =>
        this.jsonStringArray(relationship.contradictoryDiagnosisIds),
      ),
    ]).size;
    const activeRules = row.teachingRules.filter((rule) =>
      ACTIVE_RULE_STATUSES.has(rule.status),
    );

    return {
      caseGeneration: this.scoreReadiness([
        [signals.activeRelationships.length >= 4, 25, 'At least four active evidence relationships'],
        [signals.discriminatorRelationships.length >= 2, 25, 'At least two discriminator evidence relationships'],
        [signals.evidenceTypes.size >= 3, 20, 'Evidence spans at least three types'],
        [playableCases.length > 0, 15, 'Existing playable case validates case pattern'],
        [signals.caseCoveredIds.size > 0, 15, 'Evidence is surfaced in cases'],
      ]),
      teachingRuleGeneration: this.scoreReadiness([
        [signals.activeRelationships.length >= 3, 25, 'Active graph evidence available'],
        [activeRules.length > 0, 20, 'Existing teaching rules available'],
        [signals.ruleCoveredIds.size > 0, 25, 'Evidence appears in teaching rules'],
        [signals.educationCoveredIds.size > 0, 15, 'Evidence appears in education'],
        [signals.discriminatorRelationships.length > 0, 15, 'Discriminator evidence available'],
      ]),
      discriminatorGeneration: this.scoreReadiness([
        [signals.discriminatorRelationships.length >= 2, 35, 'Multiple discriminator evidence relationships'],
        [differentialCount >= 2, 25, 'Differential breadth supports contrast'],
        [this.hasDiscriminatorType(signals.discriminatorRelationships, EvidenceType.LAB), 15, 'Lab discriminator available'],
        [this.hasDiscriminatorType(signals.discriminatorRelationships, EvidenceType.IMAGING), 15, 'Imaging discriminator available'],
        [row.sourceTeachingRelationships.length > 0, 10, 'Teaching relationships support contrast'],
      ]),
      differentialGeneration: this.scoreReadiness([
        [differentialCount >= 3, 30, 'At least three differential anchors'],
        [row.graphFacts.length > 0, 20, 'Graph facts support differential reasoning'],
        [row.sourceTeachingRelationships.length > 0, 20, 'Teaching relationships are active'],
        [signals.discriminatorRelationships.length > 0, 20, 'Discriminator evidence can separate mimics'],
        [signals.teachingRelationshipCoveredIds.size > 0, 10, 'Relationship evidence is explicitly taught'],
      ]),
    };
  }

  private scoreReadiness(
    factors: Array<[boolean, number, string]>,
  ): { score: number; tier: EvidenceReadinessTier; reasons: string[] } {
    const score = factors.reduce(
      (total, [condition, weight]) => total + (condition ? weight : 0),
      0,
    );
    const missing = factors
      .filter(([condition]) => !condition)
      .map(([, , reason]) => reason);
    return {
      score,
      tier: this.readinessTier(score),
      reasons: missing,
    };
  }

  private missingEvidence(
    row: CoverageRow,
    signals: CoverageSignals,
  ): Array<{ type: EvidenceCoverageWeakness; label: string }> {
    const labels: Record<EvidenceCoverageWeakness, string> = {
      missing_evidence_graph: 'No active evidence graph',
      missing_discriminator_evidence: 'No discriminator evidence',
      weak_evidence_diversity: 'Increase evidence diversity',
      missing_case_evidence: 'Surface evidence in playable cases',
      missing_education_evidence: 'Surface evidence in education',
      missing_rule_evidence: 'Link evidence to teaching rules',
      missing_teaching_relationship_evidence:
        'Link evidence to teaching relationships',
      overused_evidence_pattern: 'Reduce repeated evidence patterns',
      missing_imaging_discriminator: 'Expand imaging discriminator evidence',
      missing_lab_discriminator: 'Expand lab discriminator evidence',
      weak_escalation_evidence: 'Add escalation evidence',
      weak_complication_evidence: 'Add complication evidence',
      missing_management_contrast: 'Add management contrast evidence',
      missing_reasoning_path_coverage: 'Activate at least one reasoning path',
      weak_reasoning_diversity: 'Add reasoning paths with more varied goals',
      missing_constrained_teaching_rule_generation:
        'Generate teaching rules from active reasoning paths',
      missing_constrained_education_generation:
        'Generate education from active reasoning paths',
      unconstrained_educational_draft:
        'Review unconstrained education generation metadata',
      low_trust_generated_draft:
        'Senior review low-trust generated drafts',
      blocked_generated_draft:
        'Regenerate or manually override blocked generated drafts',
      hallucination_risk_generated_draft:
        'Review unsupported claim and hallucination-risk signals',
    };
    return signals.weaknesses
      .filter((weakness) => {
        if (
          weakness === 'missing_teaching_relationship_evidence' &&
          row.sourceTeachingRelationships.length === 0
        ) {
          return false;
        }
        return true;
      })
      .map((weakness) => ({ type: weakness, label: labels[weakness] }));
  }

  private generationPrerequisites(
    row: CoverageRow,
    signals: CoverageSignals,
  ): string[] {
    return [
      row.status !== DiagnosisRegistryStatus.ACTIVE ? 'Activate diagnosis lifecycle' : null,
      signals.activeRelationships.length < 4 ? 'Review active evidence relationships' : null,
      signals.discriminatorRelationships.length < 2
        ? 'Add discriminator evidence'
        : null,
      signals.evidenceTypes.size < 3 ? 'Increase evidence diversity' : null,
      signals.caseCoveredIds.size === 0 ? 'Validate evidence against cases' : null,
      row.graphFacts.length === 0 ? 'Add graph facts for reasoning support' : null,
      row.sourceTeachingRelationships.length === 0
        ? 'Activate teaching relationships'
        : null,
    ].filter((item): item is string => Boolean(item));
  }

  private repeatedDiscriminators(signals: CoverageSignals) {
    const byKey = new Map<string, number>();
    for (const relationship of signals.discriminatorRelationships) {
      const key = relationship.evidenceNode.normalizedKey;
      byKey.set(key, (byKey.get(key) ?? 0) + 1);
    }
    return [...byKey.entries()]
      .filter(([, count]) => count > 1)
      .map(([evidenceKey, count]) => ({ evidenceKey, count }));
  }

  private matchesFilters(
    diagnosis: ReturnType<EvidenceCoverageService['toCoverage']>,
    query: EvidenceCoverageQuery,
  ) {
    if (query.playableOnly && !diagnosis.lifecycle.playable) return false;
    if (
      query.evidenceWeakness &&
      !diagnosis.coverageWeaknesses.includes(
        query.evidenceWeakness as EvidenceCoverageWeakness,
      )
    ) {
      return false;
    }
    if (
      query.readinessTier &&
      diagnosis.generationReadinessTier !== query.readinessTier
    ) {
      return false;
    }
    return true;
  }

  private normalizeQuery(
    query: EvidenceCoverageQuery = {},
  ): EvidenceCoverageQuery {
    return {
      specialty: query.specialty?.trim() || undefined,
      evidenceWeakness: query.evidenceWeakness?.trim() || undefined,
      readinessTier: query.readinessTier?.trim() || undefined,
      onboardingStatus: query.onboardingStatus?.trim() || undefined,
      playableOnly: query.playableOnly === true,
    };
  }

  private countEvidenceTypes(
    diagnoses: Array<ReturnType<EvidenceCoverageService['toCoverage']>>,
  ) {
    const counts: Record<string, number> = {};
    for (const diagnosis of diagnoses) {
      for (const [type, count] of Object.entries(diagnosis.evidenceByType)) {
        counts[type] = (counts[type] ?? 0) + count;
      }
    }
    return counts;
  }

  private hasDiscriminatorType(
    relationships: RelationshipRow[],
    evidenceType: EvidenceType,
  ) {
    return relationships.some(
      (relationship) => relationship.evidenceNode.evidenceType === evidenceType,
    );
  }

  private readinessTier(score: number): EvidenceReadinessTier {
    if (score >= 75) return 'ready';
    if (score >= 45) return 'partial';
    return 'weak';
  }

  private containsEvidence(text: string, key: string, label: string) {
    if (!text) return false;
    const normalizedKey = normalizeText(key);
    const normalizedLabel = normalizeText(label);
    if (normalizedKey.length >= 4 && text.includes(normalizedKey)) return true;
    if (normalizedLabel.length >= 4 && text.includes(normalizedLabel)) return true;
    const tokens = normalizedLabel.split(' ').filter((token) => token.length >= 4);
    return tokens.length >= 2 && tokens.every((token) => text.includes(token));
  }

  private normalizeSearchText(value: unknown): string {
    return normalizeText(this.extractStrings(value).join(' '));
  }

  private extractStrings(value: unknown): string[] {
    if (!value) return [];
    if (typeof value === 'string') return [value];
    if (typeof value === 'number' || typeof value === 'boolean') {
      return [String(value)];
    }
    if (Array.isArray(value)) {
      return value.flatMap((item) => this.extractStrings(item));
    }
    if (value instanceof Date) return [];
    if (typeof value !== 'object') return [];
    return Object.values(value as Record<string, unknown>).flatMap((item) =>
      this.extractStrings(item),
    );
  }

  private jsonStringArray(value: Prisma.JsonValue | null): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === 'string');
  }

  private asArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private generatedBecause(value: Prisma.JsonValue | null) {
    const record = this.jsonObject(value);
    return this.jsonObject(record?.generatedBecause);
  }

  private educationGeneratedBecause(value: Prisma.JsonValue | null | undefined) {
    if (!value || !Array.isArray(value)) return [];
    return value
      .map((item) => this.jsonObject(this.jsonObject(item)?.generatedBecause))
      .filter((item): item is Record<string, Prisma.JsonValue> => Boolean(item));
  }

  private jsonObject(value: unknown): Record<string, Prisma.JsonValue> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, Prisma.JsonValue>)
      : null;
  }

  private unique(values: string[]) {
    return [...new Set(values)];
  }
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function percent(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return clamp(Math.round((numerator / denominator) * 100), 0, 100);
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
