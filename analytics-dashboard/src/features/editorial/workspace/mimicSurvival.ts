import type {
  CaseDifferentialElimination,
  DiagnosisEditorialWorkspace,
} from '../../../api/admin';
import type { StatusBadgeTone } from '../../../components/ui/statusBadgeMeta';

export type MimicSurvivalSummary = {
  total: number;
  eliminatedCount: number;
  unresolvedCount: number;
  persistentConfusionCount: number;
  weakEliminationCount: number;
  explicitSeparationCount: number;
  heuristicOnlyCount: number;
  earliestEliminatedAtClue: number | null;
  strongestDiscriminatorUsed: string | null;
  highRiskFlags: { prematureCollapse: boolean; remainingConfusion: boolean };
};

export type MimicSurvivalState =
  | 'separated'
  | 'weak_elimination'
  | 'unresolved'
  | 'case_needed';

const strengthRank: Record<string, number> = {
  strong: 2,
  moderate: 1,
  weak: 0,
};

export function normalizeComparableText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function matchesMimicTarget(
  item: CaseDifferentialElimination,
  label: string,
  targetDiagnosisId: string | null,
) {
  return (
    (targetDiagnosisId !== null && item.mimicDiagnosisId === targetDiagnosisId) ||
    normalizeComparableText(item.mimicName) === normalizeComparableText(label)
  );
}

export function buildMimicSurvivalSummary(
  workspace: DiagnosisEditorialWorkspace,
  label: string,
  targetDiagnosisId: string | null,
): MimicSurvivalSummary {
  const eliminations = workspace.cases.items.flatMap(
    (caseItem) => caseItem.clueProgression?.differentialElimination ?? [],
  );
  const matching = eliminations.filter((item) =>
    matchesMimicTarget(item, label, targetDiagnosisId),
  );

  const eliminated = matching.filter((item) => item.finalStatus === 'eliminated');
  const explicit = eliminated.filter(
    (item) => item.discriminatorUsed || item.eliminatedBy,
  );
  const heuristicOnly = eliminated.filter(
    (item) => !item.discriminatorUsed && !item.eliminatedBy,
  );
  const clueIndices = matching
    .map((item) => item.eliminatedAtClueIndex)
    .filter((value): value is number => typeof value === 'number');

  let strongestDiscriminatorUsed: string | null = null;
  let bestRank = -1;
  let bestClueIndex = Infinity;
  for (const item of eliminated) {
    if (!item.discriminatorUsed) continue;
    const rank = strengthRank[item.eliminationStrength] ?? -1;
    const clueIndex = item.eliminatedAtClueIndex ?? Infinity;
    if (
      rank > bestRank ||
      (rank === bestRank && clueIndex < bestClueIndex)
    ) {
      bestRank = rank;
      bestClueIndex = clueIndex;
      strongestDiscriminatorUsed = item.discriminatorUsed;
    }
  }

  return {
    total: matching.length,
    eliminatedCount: eliminated.length,
    unresolvedCount: matching.filter((item) => item.finalStatus === 'unresolved').length,
    persistentConfusionCount: matching.filter(
      (item) => item.finalStatus === 'persistent',
    ).length,
    weakEliminationCount: eliminated.filter(
      (item) => item.eliminationStrength === 'weak',
    ).length,
    explicitSeparationCount: explicit.length,
    heuristicOnlyCount: heuristicOnly.length,
    earliestEliminatedAtClue: clueIndices.length ? Math.min(...clueIndices) : null,
    strongestDiscriminatorUsed,
    highRiskFlags: {
      prematureCollapse: matching.some((item) => item.prematureCollapseRisk),
      remainingConfusion: matching.some((item) => item.remainingConfusionRisk),
    },
  };
}

export function mimicSurvivalState(
  summary: MimicSurvivalSummary,
  caseNeeded: boolean,
): MimicSurvivalState {
  if (summary.total === 0) {
    return caseNeeded ? 'case_needed' : 'unresolved';
  }
  if (summary.persistentConfusionCount > 0 || summary.unresolvedCount > 0) {
    return 'unresolved';
  }
  if (
    summary.weakEliminationCount > 0 &&
    summary.heuristicOnlyCount === summary.eliminatedCount
  ) {
    return 'weak_elimination';
  }
  if (summary.explicitSeparationCount > 0) {
    return 'separated';
  }
  return summary.eliminatedCount > 0 ? 'weak_elimination' : 'unresolved';
}

export function mimicSurvivalStateMeta(
  state: MimicSurvivalState,
): { label: string; tone: StatusBadgeTone } {
  if (state === 'separated') return { label: 'Separated', tone: 'success' };
  if (state === 'weak_elimination') return { label: 'Weak elimination', tone: 'warning' };
  if (state === 'case_needed') return { label: 'Case needed', tone: 'warning' };
  return { label: 'Unresolved', tone: 'danger' };
}
