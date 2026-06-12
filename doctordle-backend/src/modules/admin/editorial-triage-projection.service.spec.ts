import { EditorialTriageProjectionService } from './editorial-triage-projection.service';

describe('EditorialTriageProjectionService', () => {
  let service: EditorialTriageProjectionService;

  beforeEach(() => {
    service = new EditorialTriageProjectionService();
  });

  it('prioritizes unsupported claims', () => {
    const result = service.project({
      unsupportedClaimCount: 2,
      unsupportedClaimBlockerCount: 1,
      totalCases: 1,
      usableCases: 1,
      evidenceCoverageScore: 80,
    });

    expect(queueIds(result)).toContain('unsupported_claims');
    expect(result.highestImpactFixes[0]).toEqual(
      expect.objectContaining({
        id: 'repair_unsupported_claims',
        targetTab: 'education',
      }),
    );
    expect(result.publicationRisk.score).toBeGreaterThan(0);
  });

  it('surfaces escalation gaps', () => {
    const result = service.project({
      escalationMissing: true,
      totalCases: 1,
      usableCases: 1,
      evidenceCoverageScore: 80,
    });

    expect(queueIds(result)).toContain('escalation_coverage_gaps');
    expect(result.recommendedNextAction).toBe('Resolve escalation gap');
    expect(result.targetTab).toBe('graph');
  });

  it('flags sparse diagnoses', () => {
    const result = service.project({
      totalCases: 0,
      usableCases: 0,
      hasEducation: false,
      activeTeachingRuleCount: 0,
      graphRelationshipCount: 0,
    });

    expect(queueIds(result)).toContain('sparse_diagnosis');
    expect(result.highestImpactFixes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'create_usable_case' }),
      ]),
    );
  });

  it('flags draft-heavy diagnoses', () => {
    const result = service.project({
      pendingDraftCount: 2,
      lowTrustDraftCount: 1,
      totalCases: 1,
      usableCases: 1,
    });

    expect(queueIds(result)).toEqual(
      expect.arrayContaining(['needs_review', 'draft_heavy']),
    );
  });

  it('flags weak discriminator coverage', () => {
    const result = service.project({
      totalDifferentials: 3,
      resolvedDifferentials: 1,
      discriminatorRuleCount: 0,
      totalCases: 1,
      usableCases: 1,
    });

    expect(queueIds(result)).toContain('weak_discriminator_coverage');
    expect(result.highestImpactFixes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'strengthen_differential_coverage',
          targetTab: 'graph',
        }),
      ]),
    );
  });

  it('keeps mixed-risk diagnoses explainable and ordered by impact', () => {
    const result = service.project({
      workspaceBlockerCount: 1,
      unsupportedClaimCount: 1,
      unsupportedClaimBlockerCount: 1,
      escalationMissing: true,
      totalDifferentials: 4,
      resolvedDifferentials: 1,
      discriminatorRuleCount: 0,
      totalCases: 0,
      usableCases: 0,
      blockedDraftCount: 1,
      pendingDraftCount: 1,
      evidenceCoverageScore: 20,
      maturityOverall: 0.2,
      lifecyclePlayable: false,
    });

    expect(result.editorialPriority.tier).toMatch(/high|critical/);
    expect(queueIds(result)).toEqual(
      expect.arrayContaining([
        'needs_review',
        'high_publication_risk',
        'weak_discriminator_coverage',
        'unsupported_claims',
        'sparse_diagnosis',
        'draft_heavy',
        'escalation_coverage_gaps',
      ]),
    );
    expect(result.triageReasons.length).toBeGreaterThan(1);
    expect(result.recommendedNextAction).toBe('Repair unsupported claims');
  });
});

function queueIds(
  result: ReturnType<EditorialTriageProjectionService['project']>,
) {
  return result.workflowQueues.map((queue) => queue.id);
}
