import { CaseEditorialStatus, DiagnosisRegistryStatus } from '@prisma/client';
import { CaseEligibilityPolicyService } from './case-eligibility-policy.service';

describe('CaseEligibilityPolicyService', () => {
  const service = new CaseEligibilityPolicyService();

  it('treats APPROVED and READY_TO_PUBLISH as scheduler assignable', () => {
    expect(
      service.isAssignableEditorialStatus(CaseEditorialStatus.APPROVED),
    ).toBe(true);
    expect(
      service.isAssignableEditorialStatus(
        CaseEditorialStatus.READY_TO_PUBLISH,
      ),
    ).toBe(true);
    expect(
      service.isAssignableEditorialStatus(CaseEditorialStatus.PUBLISHED),
    ).toBe(false);
  });

  it('normalizes legacy investigation endoscopy clues to imaging', () => {
    const result = service.validatePlayableClues(
      [
        {
          order: 0,
          type: 'investigation',
          value: 'Upper gastrointestinal endoscopy demonstrates an ulcer.',
        },
      ],
      { caseId: 'case-pud' },
    );

    expect(result.valid).toBe(true);
    expect(result.playableClueCount).toBe(1);
    expect(result.clues[0]).toMatchObject({
      id: 'case-pud-0',
      type: 'imaging',
      order: 0,
    });
  });

  it('rejects malformed clues and invalid clue types', () => {
    expect(service.validatePlayableClues([])).toMatchObject({
      valid: false,
      reasons: ['no_playable_clues'],
    });

    expect(
      service.validatePlayableClues([
        { order: 0, type: 'unknown', value: 'Something happened.' },
      ]),
    ).toMatchObject({
      valid: false,
      invalidClueTypes: ['unknown'],
    });
  });

  it('checks registry active and playable requirements', () => {
    expect(
      service.isRegistryPlayable({
        status: DiagnosisRegistryStatus.ACTIVE,
        active: true,
        isPlayable: true,
      }),
    ).toBe(true);

    expect(
      service.isRegistryPlayable({
        status: DiagnosisRegistryStatus.DRAFT,
        active: true,
        isPlayable: true,
      }),
    ).toBe(false);
  });
});
