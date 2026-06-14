import { BadRequestException, Injectable } from '@nestjs/common';
import { DiagnosisRegistryStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';
import { CaseGeneratorService } from '../case-generator/case-generator.service';
import type { GenerateCaseInput } from '../case-generator/case-generator.types';
import { CaseReviewService } from './case-review.service';
import type {
  DiscriminatorGenerationIntent,
  TargetedDiscriminatorGenerationRequest,
} from './clue-progression-analysis.service';
import { ReasoningDraftValidationService } from './reasoning-draft-validation.service';
import { ReasoningPathService } from './reasoning-path.service';
import { TeachingRulesAdminService } from './teaching-rules-admin.service';

export type TargetedCaseDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

export type TargetedCaseGenerationPayload = {
  difficulty: TargetedCaseDifficulty;
  teachingUnitIds: string[];
  mimicDiagnosisIds?: string[];
  reasoningPathId?: string;
  clueRevealStrategy?: GenerateCaseInput['clueRevealStrategy'];
  discriminatorTarget?: TargetedDiscriminatorGenerationRequest;
};

export type TargetedDiscriminatorCasePayload = {
  target: TargetedDiscriminatorGenerationRequest;
  difficulty?: TargetedCaseDifficulty;
  teachingUnitIds?: string[];
  reasoningPathId?: string;
  clueRevealStrategy?: GenerateCaseInput['clueRevealStrategy'];
};

export type ClueRevisionProposalPayload = {
  target: TargetedDiscriminatorGenerationRequest;
  existingClue?: string;
  desiredClueOrder?: number;
};

@Injectable()
export class TargetedCaseGenerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly caseGenerator: CaseGeneratorService,
    private readonly caseReviewService: CaseReviewService,
    private readonly teachingRulesAdminService?: TeachingRulesAdminService,
    private readonly reasoningPathService?: ReasoningPathService,
    private readonly reasoningDraftValidationService?: ReasoningDraftValidationService,
  ) {}

  async generate(input: {
    diagnosisRegistryId: string;
    payload: TargetedCaseGenerationPayload;
  }) {
    const teachingUnitIds = this.validateTeachingUnitIds(
      input.payload.teachingUnitIds,
    );
    const mimicDiagnosisIds = this.validateMimicDiagnosisIds(
      input.payload.mimicDiagnosisIds,
    );
    await this.teachingRulesAdminService?.validateTeachingUnitIds(
      input.diagnosisRegistryId,
      teachingUnitIds,
    );
    const mimics = await this.resolveMimics(mimicDiagnosisIds);
    const reasoningPathContext = input.payload.reasoningPathId
      ? await this.reasoningPathService?.buildCaseGenerationContext(
          this.uuid(input.payload.reasoningPathId, 'reasoningPathId'),
        )
      : undefined;
    const result = await this.caseGenerator.generateBatch({
      count: 1,
      difficulty: input.payload.difficulty.toLowerCase(),
      registryFirst: true,
      diagnosisRegistryIds: [input.diagnosisRegistryId],
      targetedCase: {
        teachingUnitIds,
        mimics,
        reasoningPathContext,
        clueRevealStrategy: input.payload.clueRevealStrategy,
        discriminatorTarget: input.payload.discriminatorTarget,
      },
    });
    const created = result.results.find((item) => item.status === 'created');

    if (!created) {
      return {
        result,
        generatedCase: null,
        validation: null,
        qualityProjection: null,
      };
    }

    const generatedCase = await this.caseReviewService.getCaseDetail(
      created.caseId,
    );
    const draftValidation =
      await this.reasoningDraftValidationService?.runAfterGeneration({
        artifactType: 'CASE',
        artifactId: created.caseId,
      });

    return {
      result,
      generatedCase,
      validation: generatedCase.validationRuns?.[0] ?? null,
      draftValidation,
      qualityProjection: generatedCase.qualityProjection ?? null,
    };
  }

  async generateTargetedDiscriminatorCase(input: {
    diagnosisRegistryId: string;
    payload: TargetedDiscriminatorCasePayload;
    userId?: string | null;
  }) {
    const target = this.validateDiscriminatorTarget(
      input.payload?.target,
      input.diagnosisRegistryId,
    );
    const payload: TargetedCaseGenerationPayload = {
      difficulty: input.payload.difficulty ?? 'MEDIUM',
      teachingUnitIds: input.payload.teachingUnitIds ?? [],
      ...(target.mimicDiagnosisId
        ? { mimicDiagnosisIds: [target.mimicDiagnosisId] }
        : {}),
      ...(input.payload.reasoningPathId
        ? { reasoningPathId: input.payload.reasoningPathId }
        : {}),
      clueRevealStrategy:
        input.payload.clueRevealStrategy ??
        this.revealStrategyForIntent(target.generationIntent),
      discriminatorTarget: target,
    };
    const result = await this.generate({
      diagnosisRegistryId: input.diagnosisRegistryId,
      payload,
    });
    const reviewPayload = this.buildDiscriminatorReviewPayload({
      draftKind: 'targeted_discriminator_case',
      diagnosisRegistryId: input.diagnosisRegistryId,
      target,
      proposedOutput: {
        title: result.generatedCase?.title ?? undefined,
        caseDraft: result.generatedCase,
        clueProgressionRationale:
          'Generated case should keep the mimic plausible early, then separate it with the target discriminator.',
        expectedMimicElimination: target.mimicName,
        expectedLearnerTakeaway: target.discriminator,
      },
    });
    const audit = await this.prisma.aiDraftRevisionAudit.create({
      data: {
        diagnosisRegistryId: input.diagnosisRegistryId,
        caseId: result.generatedCase?.id ?? target.caseId ?? null,
        actionType: 'generate_targeted_discriminator_case',
        sourceIssue: this.toInputJson({
          source: 'targeted_generation_opportunity',
          target,
        }),
        inputContext: this.toInputJson({
          payload,
          intendedMimicElimination: target.mimicName,
          intendedClueTiming:
            target.sourceClueOrder ??
            (payload.clueRevealStrategy === 'late_discriminator' ? 3 : null),
        }),
        generatedOutput: this.toInputJson({
          result,
          discriminatorTarget: target,
          reviewPayload,
          intendedMimicElimination: target.mimicName,
          intendedClueTiming:
            target.sourceClueOrder ??
            (payload.clueRevealStrategy === 'late_discriminator' ? 3 : null),
          learnerConfusionAddressed: target.learnerRisk ?? null,
          editorialRationale: target.editorialReason ?? null,
        }),
        affectedArtifactType: 'TARGETED_DISCRIMINATOR_CASE_DRAFT',
        affectedArtifactId:
          result.generatedCase?.id ?? target.caseId ?? input.diagnosisRegistryId,
        reviewStatus: 'PENDING_REVIEW',
        createdByUserId: input.userId ?? null,
      },
    });

    return {
      action: 'generate_targeted_discriminator_case',
      publicationStatus: 'draft' as const,
      result,
      audit,
    };
  }

  async generateClueRevisionProposal(input: {
    diagnosisRegistryId: string;
    payload: ClueRevisionProposalPayload;
    userId?: string | null;
  }) {
    const target = this.validateDiscriminatorTarget(
      input.payload?.target,
      input.diagnosisRegistryId,
    );
    const desiredClueOrder =
      input.payload.desiredClueOrder ??
      target.sourceClueOrder ??
      target.sourceClueIndex ??
      3;
    const proposedClue = this.proposeClueRevision({
      target,
      existingClue: input.payload.existingClue,
      desiredClueOrder,
    });
    const reviewPayload = this.buildDiscriminatorReviewPayload({
      draftKind: 'clue_revision_proposal',
      diagnosisRegistryId: input.diagnosisRegistryId,
      target,
      proposedOutput: {
        clueRevision: {
          originalClue: input.payload.existingClue ?? undefined,
          revisedClue: input.payload.existingClue ? proposedClue : undefined,
          addedClue: input.payload.existingClue ? undefined : proposedClue,
          rationale:
            target.editorialReason ??
            'Repair the clue sequence with an explicit discriminator.',
          expectedEffect: `Strengthens explicit elimination of ${target.mimicName}.`,
        },
        clueProgressionRationale:
          'Revision should make the mimic collapse traceable at the target clue.',
        expectedMimicElimination: target.mimicName,
        expectedLearnerTakeaway: target.discriminator,
      },
    });
    const audit = await this.prisma.aiDraftRevisionAudit.create({
      data: {
        diagnosisRegistryId: input.diagnosisRegistryId,
        caseId: target.caseId ?? null,
        actionType: 'generate_clue_revision_proposal',
        sourceIssue: this.toInputJson({
          source: 'targeted_generation_opportunity',
          target,
        }),
        inputContext: this.toInputJson({
          existingClue: input.payload.existingClue ?? null,
          desiredClueOrder,
          discriminatorTarget: target,
        }),
        generatedOutput: this.toInputJson({
          proposedClue,
          replacementOrAdditionalClue: proposedClue,
          expectedProgressionEffect: `Strengthens explicit elimination of ${target.mimicName}.`,
          intendedMimicElimination: target.mimicName,
          intendedClueTiming: desiredClueOrder,
          learnerConfusionAddressed: target.learnerRisk ?? null,
          editorialRationale: target.editorialReason ?? null,
          discriminatorTarget: target,
          reviewPayload,
        }),
        affectedArtifactType: 'CASE_CLUE_REVISION_PROPOSAL',
        affectedArtifactId: target.caseId ?? input.diagnosisRegistryId,
        reviewStatus: 'PENDING_REVIEW',
        createdByUserId: input.userId ?? null,
      },
    });

    return {
      action: 'generate_clue_revision_proposal',
      publicationStatus: 'draft' as const,
      proposal: {
        proposedClue,
        desiredClueOrder,
        discriminatorTarget: target,
      },
      audit,
    };
  }

  private validateTeachingUnitIds(value: unknown): string[] {
    if (!Array.isArray(value)) {
      throw new BadRequestException('teachingUnitIds must be an array');
    }

    if (value.length > 6) {
      throw new BadRequestException('teachingUnitIds supports at most 6 items');
    }

    return [
      ...new Set(
        value
          .map((item) => {
            if (typeof item !== 'string') {
              throw new BadRequestException(
                'teachingUnitIds must contain strings',
              );
            }

            return item.trim();
          })
          .filter(Boolean),
      ),
    ];
  }

  private validateMimicDiagnosisIds(value: unknown): string[] {
    if (value === undefined) {
      return [];
    }

    if (!Array.isArray(value)) {
      throw new BadRequestException('mimicDiagnosisIds must be an array');
    }

    if (value.length > 5) {
      throw new BadRequestException('mimicDiagnosisIds supports at most 5 IDs');
    }

    return [...new Set(value.map((item) => this.uuid(item, 'mimicDiagnosisIds')))];
  }

  private async resolveMimics(mimicDiagnosisIds: string[]) {
    if (!mimicDiagnosisIds.length) {
      return [];
    }

    const rows = await this.prisma.diagnosisRegistry.findMany({
      where: {
        id: { in: mimicDiagnosisIds },
        active: true,
        status: DiagnosisRegistryStatus.ACTIVE,
      },
      select: {
        id: true,
        displayLabel: true,
        canonicalName: true,
      },
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    const missingIds = mimicDiagnosisIds.filter((id) => !byId.has(id));
    if (missingIds.length) {
      throw new BadRequestException(
        `Mimic diagnosis IDs are not active or do not exist: ${missingIds.join(', ')}`,
      );
    }

    return mimicDiagnosisIds.map((id) => {
      const row = byId.get(id)!;
      return {
        diagnosisRegistryId: row.id,
        diagnosis: row.displayLabel || row.canonicalName,
      };
    });
  }

  private validateDiscriminatorTarget(
    value: unknown,
    diagnosisRegistryId: string,
  ): TargetedDiscriminatorGenerationRequest {
    if (!value || typeof value !== 'object') {
      throw new BadRequestException('target is required');
    }
    const target = value as Partial<TargetedDiscriminatorGenerationRequest>;
    const intent = target.generationIntent;
    const allowedIntents: DiscriminatorGenerationIntent[] = [
      'missing_discriminator_case',
      'weak_discriminator_case',
      'persistent_confusion_case',
      'must_not_miss_separation',
      'late_lock_in_repair',
      'weak_clue_transition',
      'heuristic_only_repair',
    ];
    if (target.diagnosisRegistryId !== diagnosisRegistryId) {
      throw new BadRequestException(
        'target.diagnosisRegistryId must match the workspace diagnosis',
      );
    }
    if (!target.mimicName?.trim()) {
      throw new BadRequestException('target.mimicName is required');
    }
    if (!target.discriminator?.trim()) {
      throw new BadRequestException('target.discriminator is required');
    }
    if (!intent || !allowedIntents.includes(intent)) {
      throw new BadRequestException('target.generationIntent is invalid');
    }
    if (target.caseId) {
      this.uuid(target.caseId, 'target.caseId');
    }
    if (target.mimicDiagnosisId) {
      this.uuid(target.mimicDiagnosisId, 'target.mimicDiagnosisId');
    }
    if (target.sourceAnnotationId) {
      this.uuid(target.sourceAnnotationId, 'target.sourceAnnotationId');
    }
    return {
      ...target,
      diagnosisRegistryId,
      mimicName: target.mimicName.trim(),
      discriminator: target.discriminator.trim(),
      generationIntent: intent,
    };
  }

  private revealStrategyForIntent(
    intent: DiscriminatorGenerationIntent,
  ): GenerateCaseInput['clueRevealStrategy'] {
    if (intent === 'late_lock_in_repair' || intent === 'weak_clue_transition') {
      return 'progressive_narrowing';
    }
    return 'late_discriminator';
  }

  private proposeClueRevision(input: {
    target: TargetedDiscriminatorGenerationRequest;
    existingClue?: string;
    desiredClueOrder: number;
  }) {
    const existing = input.existingClue?.trim();
    const prefix = existing
      ? `Revise clue ${input.desiredClueOrder}: ${existing}`
      : `Add clue ${input.desiredClueOrder}`;
    return `${prefix} so it explicitly demonstrates ${input.target.discriminator}, separating ${input.target.mimicName} without giving away the final diagnosis abruptly.`;
  }

  private buildDiscriminatorReviewPayload(input: {
    draftKind: 'targeted_discriminator_case' | 'clue_revision_proposal';
    diagnosisRegistryId: string;
    target: TargetedDiscriminatorGenerationRequest;
    proposedOutput: {
      title?: string;
      caseDraft?: unknown;
      clueRevision?: {
        originalClue?: string;
        revisedClue?: string;
        addedClue?: string;
        rationale?: string;
        expectedEffect?: string;
      };
      clueProgressionRationale?: string;
      expectedMimicElimination?: string;
      expectedLearnerTakeaway?: string;
    };
  }) {
    return {
      draftKind: input.draftKind,
      generationIntent: input.target.generationIntent,
      diagnosisRegistryId: input.diagnosisRegistryId,
      caseId: input.target.caseId,
      sourceClueOrder: input.target.sourceClueOrder,
      sourceClueIndex: input.target.sourceClueIndex,
      mimicDiagnosisId: input.target.mimicDiagnosisId,
      mimicName: input.target.mimicName,
      discriminator: input.target.discriminator,
      learnerRisk: input.target.learnerRisk,
      editorialReason: input.target.editorialReason,
      proposedOutput: input.proposedOutput,
      reviewGuidance: this.buildDiscriminatorReviewGuidance(
        input.target.generationIntent,
        input.draftKind,
      ),
    };
  }

  private buildDiscriminatorReviewGuidance(
    intent: DiscriminatorGenerationIntent,
    draftKind: 'targeted_discriminator_case' | 'clue_revision_proposal',
  ) {
    const caseDraft = draftKind === 'targeted_discriminator_case';
    return {
      primaryQuestion: caseDraft
        ? 'Does this draft case safely teach the missing discriminator?'
        : 'Does this clue revision make mimic elimination explicit without leaking the answer?',
      acceptEffect: caseDraft
        ? 'Marks the case draft repair as accepted for editorial case drafting; it does not publish.'
        : 'Marks the clue revision proposal as accepted for editorial repair; it does not mutate published cases.',
      rejectEffect: 'Keeps the detected gap open and records that this draft should not be used.',
      requestChangesHint:
        'Name the missing clinical evidence, clue timing, or learner-confusion issue the next draft should fix.',
      safetyNotes: [
        'Draft-only output: no autonomous publishing.',
        'Editors must verify clinical accuracy and clue pacing before use.',
        intent === 'must_not_miss_separation'
          ? 'Must-not-miss separation requires extra senior review.'
          : 'Confirm the discriminator is specific enough to teach the intended distinction.',
      ],
    };
  }

  private toInputJson(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
  }

  private uuid(value: unknown, field: string): string {
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (typeof value !== 'string' || !uuidPattern.test(value)) {
      throw new BadRequestException(`${field} must contain only UUID strings`);
    }

    return value;
  }
}
