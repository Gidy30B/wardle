import { BadRequestException, Injectable } from '@nestjs/common';
import { DiagnosisRegistryStatus } from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';
import { CaseGeneratorService } from '../case-generator/case-generator.service';
import type { GenerateCaseInput } from '../case-generator/case-generator.types';
import { CaseReviewService } from './case-review.service';
import { TeachingRulesAdminService } from './teaching-rules-admin.service';

export type TargetedCaseDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

export type TargetedCaseGenerationPayload = {
  difficulty: TargetedCaseDifficulty;
  teachingUnitIds: string[];
  mimicDiagnosisIds?: string[];
  clueRevealStrategy?: GenerateCaseInput['clueRevealStrategy'];
};

@Injectable()
export class TargetedCaseGenerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly caseGenerator: CaseGeneratorService,
    private readonly caseReviewService: CaseReviewService,
    private readonly teachingRulesAdminService?: TeachingRulesAdminService,
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
    const result = await this.caseGenerator.generateBatch({
      count: 1,
      difficulty: input.payload.difficulty.toLowerCase(),
      registryFirst: true,
      diagnosisRegistryIds: [input.diagnosisRegistryId],
      targetedCase: {
        teachingUnitIds,
        mimics,
        clueRevealStrategy: input.payload.clueRevealStrategy,
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

    return {
      result,
      generatedCase,
      validation: generatedCase.validationRuns?.[0] ?? null,
      qualityProjection: generatedCase.qualityProjection ?? null,
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

  private uuid(value: unknown, field: string): string {
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (typeof value !== 'string' || !uuidPattern.test(value)) {
      throw new BadRequestException(`${field} must contain only UUID strings`);
    }

    return value;
  }
}
