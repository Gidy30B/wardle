/// <reference types="node" />

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMimicSurvivalSummary,
  matchesMimicTarget,
  mimicSurvivalState,
  normalizeComparableText,
} from './mimicSurvival.ts';
import type { CaseDifferentialElimination, DiagnosisEditorialWorkspace } from '../../../api/admin';

function elimination(
  overrides: Partial<CaseDifferentialElimination> = {},
): CaseDifferentialElimination {
  return {
    mimicName: 'Pulmonary embolism',
    mimicDiagnosisId: 'dx-pe',
    initialPlausibility: 'medium',
    finalStatus: 'eliminated',
    eliminationStrength: 'moderate',
    educationalValue: 'medium',
    prematureCollapseRisk: false,
    remainingConfusionRisk: false,
    ...overrides,
  };
}

function workspaceWith(eliminations: CaseDifferentialElimination[]): DiagnosisEditorialWorkspace {
  return {
    cases: {
      items: [
        {
          clueProgression: {
            differentialElimination: eliminations,
          },
        },
      ],
    },
  } as unknown as DiagnosisEditorialWorkspace;
}

describe('buildMimicSurvivalSummary', () => {
  it('degrades to zeroed summary when no cases reference this mimic', () => {
    const workspace = workspaceWith([]);
    const summary = buildMimicSurvivalSummary(workspace, 'Pulmonary embolism', 'dx-pe');

    assert.equal(summary.total, 0);
    assert.equal(summary.eliminatedCount, 0);
    assert.equal(summary.unresolvedCount, 0);
    assert.equal(summary.persistentConfusionCount, 0);
    assert.equal(summary.weakEliminationCount, 0);
    assert.equal(summary.explicitSeparationCount, 0);
    assert.equal(summary.heuristicOnlyCount, 0);
    assert.equal(summary.earliestEliminatedAtClue, null);
    assert.equal(summary.strongestDiscriminatorUsed, null);
    assert.deepEqual(summary.highRiskFlags, {
      prematureCollapse: false,
      remainingConfusion: false,
    });
  });

  it('splits explicit vs heuristic-only eliminations', () => {
    const workspace = workspaceWith([
      elimination({
        discriminatorUsed: 'D-dimer negative',
        eliminationStrength: 'strong',
        eliminatedAtClueIndex: 3,
      }),
      elimination({
        eliminatedBy: 'CT angiogram',
        eliminationStrength: 'moderate',
        eliminatedAtClueIndex: 5,
      }),
      elimination({
        eliminationStrength: 'moderate',
      }),
    ]);

    const summary = buildMimicSurvivalSummary(workspace, 'Pulmonary embolism', 'dx-pe');

    assert.equal(summary.explicitSeparationCount, 2);
    assert.equal(summary.heuristicOnlyCount, 1);
  });

  it('picks the earliest eliminatedAtClueIndex, ignoring undefined values', () => {
    const workspace = workspaceWith([
      elimination({ eliminatedAtClueIndex: 5 }),
      elimination({ eliminatedAtClueIndex: undefined }),
      elimination({ eliminatedAtClueIndex: 2 }),
    ]);

    const summary = buildMimicSurvivalSummary(workspace, 'Pulmonary embolism', 'dx-pe');

    assert.equal(summary.earliestEliminatedAtClue, 2);
  });

  it('prefers strong discriminators, then breaks ties by earliest clue', () => {
    const strongVsModerate = workspaceWith([
      elimination({
        discriminatorUsed: 'moderate-disc',
        eliminationStrength: 'moderate',
        eliminatedAtClueIndex: 1,
      }),
      elimination({
        discriminatorUsed: 'strong-disc',
        eliminationStrength: 'strong',
        eliminatedAtClueIndex: 5,
      }),
    ]);
    assert.equal(
      buildMimicSurvivalSummary(strongVsModerate, 'Pulmonary embolism', 'dx-pe')
        .strongestDiscriminatorUsed,
      'strong-disc',
    );

    const strongTie = workspaceWith([
      elimination({
        discriminatorUsed: 'later-strong',
        eliminationStrength: 'strong',
        eliminatedAtClueIndex: 4,
      }),
      elimination({
        discriminatorUsed: 'earlier-strong',
        eliminationStrength: 'strong',
        eliminatedAtClueIndex: 2,
      }),
    ]);
    assert.equal(
      buildMimicSurvivalSummary(strongTie, 'Pulmonary embolism', 'dx-pe')
        .strongestDiscriminatorUsed,
      'earlier-strong',
    );
  });

  it('counts unresolved, persistent, and weak-elimination cases', () => {
    const workspace = workspaceWith([
      elimination({ finalStatus: 'unresolved', eliminationStrength: 'moderate' }),
      elimination({ finalStatus: 'persistent', eliminationStrength: 'moderate' }),
      elimination({ finalStatus: 'eliminated', eliminationStrength: 'weak' }),
    ]);

    const summary = buildMimicSurvivalSummary(workspace, 'Pulmonary embolism', 'dx-pe');

    assert.equal(summary.unresolvedCount, 1);
    assert.equal(summary.persistentConfusionCount, 1);
    assert.equal(summary.weakEliminationCount, 1);
  });

  it('flags high-risk states only when at least one matching case sets them', () => {
    const risky = workspaceWith([
      elimination({ prematureCollapseRisk: true }),
      elimination({ remainingConfusionRisk: true }),
    ]);
    assert.deepEqual(buildMimicSurvivalSummary(risky, 'Pulmonary embolism', 'dx-pe').highRiskFlags, {
      prematureCollapse: true,
      remainingConfusion: true,
    });

    const safe = workspaceWith([elimination()]);
    assert.deepEqual(buildMimicSurvivalSummary(safe, 'Pulmonary embolism', 'dx-pe').highRiskFlags, {
      prematureCollapse: false,
      remainingConfusion: false,
    });
  });
});

describe('matchesMimicTarget / normalizeComparableText', () => {
  it('matches by mimicDiagnosisId when the target id is provided and equal', () => {
    const item = elimination({ mimicDiagnosisId: 'dx-pe', mimicName: 'Something else' });
    assert.equal(matchesMimicTarget(item, 'Pulmonary embolism', 'dx-pe'), true);
  });

  it('falls back to a normalized-name match when ids differ or are absent', () => {
    const item = elimination({ mimicDiagnosisId: undefined, mimicName: 'pulmonary-embolism' });
    assert.equal(matchesMimicTarget(item, 'Pulmonary Embolism', null), true);
    assert.equal(
      normalizeComparableText('Pulmonary Embolism'),
      normalizeComparableText('pulmonary-embolism'),
    );
  });
});

describe('mimicSurvivalState', () => {
  const zeroSummary = {
    total: 0,
    eliminatedCount: 0,
    unresolvedCount: 0,
    persistentConfusionCount: 0,
    weakEliminationCount: 0,
    explicitSeparationCount: 0,
    heuristicOnlyCount: 0,
    earliestEliminatedAtClue: null,
    strongestDiscriminatorUsed: null,
    highRiskFlags: { prematureCollapse: false, remainingConfusion: false },
  };

  it('reports case_needed when there is no case data and a case is needed', () => {
    assert.equal(mimicSurvivalState(zeroSummary, true), 'case_needed');
  });

  it('reports unresolved when there is no case data and no case is needed', () => {
    assert.equal(mimicSurvivalState(zeroSummary, false), 'unresolved');
  });

  it('reports unresolved when any case leaves the mimic unresolved, even if others eliminate it', () => {
    const summary = {
      ...zeroSummary,
      total: 2,
      eliminatedCount: 1,
      unresolvedCount: 1,
      explicitSeparationCount: 1,
    };
    assert.equal(mimicSurvivalState(summary, false), 'unresolved');
  });

  it('reports weak_elimination when all eliminations are heuristic-only and weak', () => {
    const summary = {
      ...zeroSummary,
      total: 1,
      eliminatedCount: 1,
      weakEliminationCount: 1,
      heuristicOnlyCount: 1,
    };
    assert.equal(mimicSurvivalState(summary, false), 'weak_elimination');
  });

  it('reports separated when at least one case explicitly separates the mimic', () => {
    const summary = {
      ...zeroSummary,
      total: 1,
      eliminatedCount: 1,
      explicitSeparationCount: 1,
    };
    assert.equal(mimicSurvivalState(summary, false), 'separated');
  });
});
