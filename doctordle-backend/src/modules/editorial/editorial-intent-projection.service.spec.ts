import {
  CaseEditorialStatus,
  DiagnosisEducationSource,
  DiagnosisEducationStatus,
  DiagnosisGraphCandidateStatus,
  DiagnosisGraphCandidateType,
  DiagnosisGraphFactStatus,
} from '@prisma/client';
import { EditorialIntentProjectionService } from './editorial-intent-projection.service';

function buildRegistry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'registry-1',
    displayLabel: 'Appendicitis',
    canonicalName: 'appendicitis',
    specialty: 'General Surgery',
    category: 'Inflammatory',
    bodySystem: 'Gastrointestinal',
    clinicalSetting: 'EMERGENCY',
    difficultyBand: 'BASIC',
    preferredClueTypes: ['exam', 'lab'],
    excludedClueTypes: ['answer-revealing imaging too early'],
    notes: 'Teach migratory pain and peritoneal irritation.',
    aliases: [{ id: 'alias-1', term: 'Acute appendicitis' }],
    education: null,
    cases: [],
    graphFacts: [],
    graphCandidates: [],
    ...overrides,
  };
}

function buildService(registry: Record<string, unknown>) {
  const prisma = {
    diagnosisRegistry: {
      findUnique: jest.fn().mockResolvedValue(registry),
    },
  };
  return {
    prisma,
    service: new EditorialIntentProjectionService(prisma as never),
  };
}

describe('EditorialIntentProjectionService', () => {
  it('builds projection from registry and rule pack only', async () => {
    const { service } = buildService(buildRegistry());

    const projection = await service.build('registry-1');

    expect(projection.diagnosis).toEqual(
      expect.objectContaining({
        id: 'registry-1',
        displayLabel: 'Appendicitis',
        aliases: ['Acute appendicitis'],
      }),
    );
    expect(projection.requiredSigns).toEqual(
      expect.arrayContaining(['McBurney point tenderness', 'Rovsing sign']),
    );
    expect(projection.requiredScoringSystems).toContain('Alvarado score');
    expect(projection.requiredMimics).toContain('gastroenteritis');
    expect(projection.completeness).toEqual(
      expect.objectContaining({
        hasRules: true,
        hasEducation: false,
        hasCases: false,
        hasGraphFacts: false,
        missing: expect.arrayContaining([
          'published_education',
          'approved_or_published_cases',
          'graph_facts',
        ]),
      }),
    );
  });

  it('enriches projection from existing published education', async () => {
    const { service } = buildService(
      buildRegistry({
        education: {
          id: 'education-1',
          editorialStatus: DiagnosisEducationStatus.PUBLISHED,
          source: DiagnosisEducationSource.MANUAL,
          summary: {
            highYieldTakeaway: 'Pain migration localizes inflammation.',
          },
          clinicalPattern: [{ pattern: 'Migration to right lower quadrant' }],
          keySymptoms: [{ finding: 'Anorexia' }],
          keySigns: [{ finding: 'McBurney point tenderness' }],
          examPearls: [{ title: 'Rovsing sign' }],
          scoringSystems: [{ name: 'AIR score' }],
          investigations: [{ title: 'CT abdomen', whyItMatters: 'Shows appendiceal inflammation.' }],
          differentials: [
            {
              diagnosis: 'Gastroenteritis',
              discriminator: 'Unlike gastroenteritis, focal peritonism favors appendicitis.',
            },
          ],
          management: [{ title: 'Surgical consultation' }],
          pitfalls: [{ title: 'Retrocecal appendix' }],
          recallPrompts: [{ prompt: 'Why can retrocecal appendicitis mislead?' }],
        },
      }),
    );

    const projection = await service.build('registry-1');

    expect(projection.completeness.hasEducation).toBe(true);
    expect(projection.learningGoals).toContain(
      'Pain migration localizes inflammation.',
    );
    expect(projection.requiredSymptoms).toContain('Anorexia');
    expect(projection.requiredInvestigations).toContain('CT abdomen');
    expect(projection.keyDiscriminators).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetDiagnosis: 'Gastroenteritis',
        }),
      ]),
    );
  });

  it('enriches projection from approved and published cases', async () => {
    const { service } = buildService(
      buildRegistry({
        cases: [
          {
            id: 'case-1',
            editorialStatus: CaseEditorialStatus.APPROVED,
            difficulty: 'medium',
            clues: [
              { type: 'history', value: 'Periumbilical pain migrated to RLQ' },
              { type: 'exam', value: 'Rovsing sign is present' },
              { type: 'lab', value: 'Mild leukocytosis' },
              { type: 'imaging', value: 'SHOULD_NOT_USE_FOURTH_CLUE' },
            ],
            differentials: ['Gastroenteritis', 'renal colic'],
            explanation: {
              keyFindings: ['Localized peritoneal irritation'],
              differentialAnalysis: [
                {
                  diagnosis: 'Gastroenteritis',
                  finalReasonLessLikely:
                    'Localized peritoneal signs argue against gastroenteritis.',
                },
              ],
            },
          },
        ],
      }),
    );

    const projection = await service.build('registry-1');

    expect(projection.completeness.hasCases).toBe(true);
    expect(projection.requiredFindings).toContain(
      'Periumbilical pain migrated to RLQ',
    );
    expect(projection.requiredFindings).not.toContain(
      'SHOULD_NOT_USE_FOURTH_CLUE',
    );
    expect(projection.requiredMimics).toContain('renal colic');
    expect(projection.difficultyGuidance.targetDifficulty).toBe('medium');
  });

  it('dedupes repeated mimics and findings', async () => {
    const { service } = buildService(
      buildRegistry({
        cases: [
          {
            id: 'case-1',
            editorialStatus: CaseEditorialStatus.PUBLISHED,
            clues: [{ value: 'Rovsing sign' }],
            differentials: ['Gastroenteritis', 'gastroenteritis'],
            explanation: { keyFindings: ['Rovsing sign'] },
          },
        ],
      }),
    );

    const projection = await service.build('registry-1');

    expect(
      projection.requiredMimics.filter(
        (item) => item.toLowerCase() === 'gastroenteritis',
      ),
    ).toHaveLength(1);
    expect(
      projection.requiredFindings.filter(
        (item) => item.toLowerCase() === 'rovsing sign',
      ),
    ).toHaveLength(1);
  });

  it('preserves provenance', async () => {
    const { service } = buildService(buildRegistry());

    const projection = await service.build('registry-1');

    expect(projection.provenance).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceType: 'rules',
          sourcePath: 'expectedNamedSigns',
          label: 'McBurney point tenderness',
        }),
        expect.objectContaining({
          sourceType: 'registry',
          sourceId: 'registry-1',
          sourcePath: 'notes',
        }),
      ]),
    );
  });

  it('uses promoted facts and approved candidates as graph sources', async () => {
    const { service } = buildService(
      buildRegistry({
        graphFacts: [
          {
            id: 'fact-1',
            type: DiagnosisGraphCandidateType.MIMIC,
            label: 'Ovarian torsion',
            status: DiagnosisGraphFactStatus.ACTIVE,
            targetDiagnosisRegistry: { displayLabel: 'Ovarian torsion' },
          },
        ],
        graphCandidates: [
          {
            id: 'candidate-1',
            type: DiagnosisGraphCandidateType.PITFALL,
            rawText: 'Normal early WBC',
            normalizedText: 'normal early wbc',
            status: DiagnosisGraphCandidateStatus.APPROVED,
            sourcePath: 'education.pitfalls[0]',
          },
        ],
      }),
    );

    const projection = await service.build('registry-1');

    expect(projection.completeness.hasGraphFacts).toBe(true);
    expect(projection.requiredMimics).toContain('ovarian torsion');
    expect(projection.pitfallsToTeach).toContain('Normal early WBC');
  });
});
