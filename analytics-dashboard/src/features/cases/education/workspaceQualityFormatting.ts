import type { WorkspaceCoverageWarning } from '../../../api/admin';

const warningLabels: Record<string, string> = {
  missing_required_differential: 'Missing required differential',
  missing_required_pitfall: 'Missing required pitfall',
  missing_required_exam_mechanism: 'Missing exam mechanism',
  missing_required_investigation: 'Missing required investigation',
  missing_required_management_anchor: 'Missing management anchor',
  missing_required_recall_concept: 'Missing recall concept',
  missing_expected_named_signs: 'Missing expected named signs',
  missing_expected_scoring_systems: 'Missing expected scoring systems',
  missing_expected_investigations: 'Missing expected investigations',
  missing_expected_mimics: 'Missing expected mimics',
  missing_expected_pitfalls: 'Missing expected pitfalls',
  missing_expected_management_anchors: 'Missing management anchors',
  low_graph_readiness: 'Low graph readiness',
  weak_atomic_finding_quality: 'Weak atomic finding quality',
  weak_comparative_differential_quality: 'Weak differential comparison',
  weak_investigation_interpretation: 'Weak investigation interpretation',
  weak_pitfall_specificity: 'Weak pitfall specificity',
  weak_management_anchor_usefulness: 'Weak management anchor usefulness',
  weak_recall_reasoning_quality: 'Weak recall reasoning quality',
  generic_filler_detected: 'Generic filler detected',
};

const scoreLabels: Record<string, string> = {
  clinicalSpecificityScore: 'Clinical specificity',
  atomicityScore: 'Atomicity',
  differentialReasoningScore: 'Differentials',
  investigationInterpretationScore: 'Investigations',
  pitfallQualityScore: 'Pitfalls',
  managementAnchorScore: 'Management',
  recallReasoningScore: 'Recall',
  graphReadinessScore: 'Graph readiness',
  differentials: 'Differentials',
  investigations: 'Investigations',
  examPearls: 'Exam pearls',
  pitfalls: 'Pitfalls',
  management: 'Management',
  recallPrompts: 'Recall prompts',
  findings: 'Findings',
  examMechanisms: 'Exam mechanisms',
  managementAnchors: 'Management anchors',
  recallConcepts: 'Recall concepts',
  overall: 'Overall',
};

const sectionLabels: Record<string, string> = {
  differentials: 'Differentials',
  pitfalls: 'Pitfalls',
  investigations: 'Investigations',
  examPearls: 'Exam pearls',
  management: 'Management',
  recallPrompts: 'Recall prompts',
};

export function formatWorkspaceWarning(
  warning: string | WorkspaceCoverageWarning,
): string {
  if (typeof warning === 'string') {
    return warningLabels[warning] ?? humanizeCode(warning);
  }

  const label = warningLabels[warning.code] ?? humanizeCode(warning.code);
  return warning.item ? `${label}: ${titleCase(warning.item)}` : label;
}

export function formatScoreLabel(key: string): string {
  return scoreLabels[key] ?? humanizeCode(key);
}

export function formatSectionLabel(section: string): string {
  return sectionLabels[section] ?? humanizeCode(section);
}

export function formatScore(value: number | undefined): string {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 'n/a';
  }

  return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
}

export function scoreTone(value: number | undefined) {
  if (typeof value !== 'number') {
    return 'border-slate-200 bg-white text-slate-700';
  }

  if (value >= 0.85) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  }

  if (value >= 0.7) {
    return 'border-amber-200 bg-amber-50 text-amber-900';
  }

  return 'border-rose-200 bg-rose-50 text-rose-800';
}

export function dedupeWarnings<T extends string | WorkspaceCoverageWarning>(
  warnings: T[],
): T[] {
  const seen = new Set<string>();
  const deduped: T[] = [];

  for (const warning of warnings) {
    const key =
      typeof warning === 'string'
        ? warning
        : [warning.code, warning.section ?? '', warning.item ?? ''].join(':');
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(warning);
  }

  return deduped;
}

function humanizeCode(code: string): string {
  return code
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (letter) => letter.toUpperCase());
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.slice(0, 1).toUpperCase() + word.slice(1))
    .join(' ');
}
