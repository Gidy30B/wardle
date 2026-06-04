import {
  CaseEditorialStatus,
  DiagnosisMappingStatus,
  DiagnosisRegistryStatus,
} from '@prisma/client';
import { CaseEligibilityPolicyService } from '../cases/case-eligibility-policy.service';
import { CaseInventoryHealthService } from './case-inventory-health.service';

describe('CaseInventoryHealthService', () => {
  it('reports invalid clue cases and scheduler eligible counts', async () => {
    const prisma = {
      case: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'case-valid',
            title: 'Valid',
            editorialStatus: CaseEditorialStatus.APPROVED,
            diagnosisRegistryId: 'registry-1',
            diagnosisMappingStatus: DiagnosisMappingStatus.MATCHED,
            clues: [{ type: 'history', value: 'Pain', order: 0 }],
            explanation: { summary: 'Valid' },
            diagnosisRegistry: {
              status: DiagnosisRegistryStatus.ACTIVE,
              active: true,
              isPlayable: true,
              isGeneratable: true,
            },
            dailyCases: [],
          },
          {
            id: 'case-invalid',
            title: 'Invalid',
            editorialStatus: CaseEditorialStatus.READY_TO_PUBLISH,
            diagnosisRegistryId: 'registry-2',
            diagnosisMappingStatus: DiagnosisMappingStatus.MATCHED,
            clues: [{ type: 'mystery', value: 'Pain', order: 0 }],
            explanation: { summary: 'Invalid' },
            diagnosisRegistry: {
              status: DiagnosisRegistryStatus.ACTIVE,
              active: true,
              isPlayable: true,
              isGeneratable: true,
            },
            dailyCases: [],
          },
        ]),
      },
    };
    const service = new CaseInventoryHealthService(
      prisma as never,
      new CaseEligibilityPolicyService(),
    );

    const result = await service.getInventoryHealth();

    expect(result.totalCases).toBe(2);
    expect(result.byEditorialStatus).toEqual({
      APPROVED: 1,
      READY_TO_PUBLISH: 1,
    });
    expect(result.schedulerEligibleCount).toBe(1);
    expect(result.invalidClueCases).toEqual([
      expect.objectContaining({
        caseId: 'case-invalid',
        reasons: ['invalid_clue_type', 'no_playable_clues'],
        invalidClueTypes: ['mystery'],
      }),
    ]);
  });
});
