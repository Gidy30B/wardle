import { Injectable } from '@nestjs/common';
import {
  CaseEditorialStatus,
  DiagnosisRegistryStatus,
  type Prisma,
} from '@prisma/client';
import { PrismaService } from '../../core/db/prisma.service';
import { CaseEligibilityPolicyService } from '../cases/case-eligibility-policy.service';

type InventoryCaseRow = {
  id: string;
  title: string;
  editorialStatus: CaseEditorialStatus | null;
  diagnosisRegistryId: string | null;
  diagnosisMappingStatus: string;
  clues: Prisma.JsonValue | null;
  explanation: Prisma.JsonValue | null;
  diagnosisRegistry: {
    status: DiagnosisRegistryStatus;
    active: boolean;
    isPlayable: boolean;
    isGeneratable: boolean;
  } | null;
  dailyCases: Array<{ id: string }>;
};

@Injectable()
export class CaseInventoryHealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly caseEligibilityPolicy: CaseEligibilityPolicyService,
  ) {}

  async getInventoryHealth() {
    const cases = await this.prisma.case.findMany({
      select: {
        id: true,
        title: true,
        editorialStatus: true,
        diagnosisRegistryId: true,
        diagnosisMappingStatus: true,
        clues: true,
        explanation: true,
        diagnosisRegistry: {
          select: {
            status: true,
            active: true,
            isPlayable: true,
            isGeneratable: true,
          },
        },
        dailyCases: {
          select: {
            id: true,
          },
        },
      },
    });

    const byEditorialStatus: Record<string, number> = {};
    let registryActiveCount = 0;
    let registryPlayableCount = 0;
    let registryGeneratableCount = 0;
    let validPlayableClueCount = 0;
    let schedulerEligibleCount = 0;
    let alreadyScheduledCount = 0;
    const invalidClueCases: Array<{
      caseId: string;
      title: string;
      editorialStatus: string | null;
      playableClueCount: number;
      reasons: string[];
      invalidClueTypes: string[];
    }> = [];

    for (const row of cases as InventoryCaseRow[]) {
      const statusKey = row.editorialStatus ?? 'NULL';
      byEditorialStatus[statusKey] = (byEditorialStatus[statusKey] ?? 0) + 1;

      if (row.diagnosisRegistry?.active && row.diagnosisRegistry.status === 'ACTIVE') {
        registryActiveCount += 1;
      }

      if (this.caseEligibilityPolicy.isRegistryPlayable(row.diagnosisRegistry)) {
        registryPlayableCount += 1;
      }

      if (
        row.diagnosisRegistry?.active &&
        row.diagnosisRegistry.status === 'ACTIVE' &&
        row.diagnosisRegistry.isGeneratable
      ) {
        registryGeneratableCount += 1;
      }

      if (row.dailyCases.length > 0) {
        alreadyScheduledCount += 1;
      }

      const clueValidation = this.caseEligibilityPolicy.validatePlayableClues(
        row.clues,
        { caseId: row.id },
      );

      if (clueValidation.valid) {
        validPlayableClueCount += 1;
      } else {
        invalidClueCases.push({
          caseId: row.id,
          title: row.title,
          editorialStatus: row.editorialStatus ?? null,
          playableClueCount: clueValidation.playableClueCount,
          reasons: clueValidation.reasons,
          invalidClueTypes: clueValidation.invalidClueTypes,
        });
      }

      if (
        row.dailyCases.length === 0 &&
        this.caseEligibilityPolicy.isAssignableEditorialStatus(
          row.editorialStatus,
        ) &&
        clueValidation.valid &&
        row.diagnosisRegistryId &&
        row.diagnosisMappingStatus === 'MATCHED' &&
        this.caseEligibilityPolicy.isRegistryPlayable(row.diagnosisRegistry) &&
        row.explanation !== null &&
        row.explanation !== undefined
      ) {
        schedulerEligibleCount += 1;
      }
    }

    return {
      totalCases: cases.length,
      byEditorialStatus,
      registry: {
        activeCount: registryActiveCount,
        playableCount: registryPlayableCount,
        generatableCount: registryGeneratableCount,
      },
      validPlayableClueCount,
      schedulerEligibleCount,
      alreadyScheduledCount,
      invalidClueCases,
    };
  }
}
