type CaseClue = {
  type: string;
  value: string;
  order: number;
};

type ValidationFindingIssue = {
  validator: string;
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  path?: string;
};

type GenerationQualityMetadata = {
  version?: string;
  critiqueScore?: number;
  critiquePassed?: boolean;
  critiqueIssues: string[];
  critiqueRecommendations: string[];
  differentialRuleOutScore?: number;
  differentialPlausibilityScore?: number;
  differentialDiscriminationScore?: number;
  clinicalEdgeValidityScore?: number;
  invalidReasoningEdges: InvalidReasoningEdge[];
  educationalValueScore?: number;
  graphConsistencyScore?: number;
  estimatedDifficulty?: 'easy' | 'medium' | 'hard';
  estimatedSolveClue?: number;
  specialty?: string | null;
  acuity?: 'low' | 'medium' | 'high' | null;
  hasLabs?: boolean;
  hasImaging?: boolean;
  hasVitals?: boolean;
  differentialCount?: number;
  qualityScore?: number;
  teachingAlignment?: TeachingAlignmentMetadata;
};

type TeachingAlignmentMetadata = {
  selectedUnits: Array<{
    id: string;
    label: string;
    importance: string;
    covered: boolean;
    matchedManifestations: string[];
    firstClueIndex?: number;
    evidence: string[];
  }>;
  revealTiming: {
    earliestCoreRevealClue?: number;
    giveawayTooEarly: boolean;
    issues: string[];
  };
  mimicPersistence: {
    earlyMimicsPresent: string[];
    mimicsStillPlausibleUntilClue?: number;
    issues: string[];
  };
  playability: {
    score: number;
    difficultyFit: 'too_easy' | 'fits' | 'too_hard' | 'unclear';
    issues: string[];
  };
  warnings: string[];
};

type InvalidReasoningEdge = {
  differential: string;
  clueOrder: number;
  evidence: string;
  claimedEffect: 'weakens' | 'rules_out';
  verdict: 'valid' | 'weak_or_neutral' | 'backwards' | 'unsupported';
  issue: string;
};

type ValidationIssueBuckets = {
  blockers: ValidationFindingIssue[];
  warnings: ValidationFindingIssue[];
  infos: ValidationFindingIssue[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

export function parseCaseClues(value: unknown): CaseClue[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const parsed: CaseClue[] = [];

  for (const item of value) {
    const candidate = asRecord(item);

    if (
      !candidate ||
      typeof candidate.type !== 'string' ||
      typeof candidate.value !== 'string' ||
      typeof candidate.order !== 'number'
    ) {
      return [];
    }

    parsed.push({
      type: candidate.type,
      value: candidate.value.trim(),
      order: candidate.order,
    });
  }

  return parsed.sort((left, right) => left.order - right.order);
}

export function parseValidationFindingIssues(
  value: unknown,
): ValidationFindingIssue[] {
  const candidate = asRecord(value);

  if (!candidate || !Array.isArray(candidate.issues)) {
    return [];
  }

  const parsed: ValidationFindingIssue[] = [];

  for (const issue of candidate.issues) {
    const item = asRecord(issue);

    if (
      !item ||
      typeof item.validator !== 'string' ||
      typeof item.severity !== 'string' ||
      typeof item.code !== 'string' ||
      typeof item.message !== 'string'
    ) {
      continue;
    }

    if (
      item.severity !== 'error' &&
      item.severity !== 'warning' &&
      item.severity !== 'info'
    ) {
      continue;
    }

    parsed.push({
      validator: item.validator,
      severity: item.severity,
      code: item.code,
      message: item.message,
      path: typeof item.path === 'string' ? item.path : undefined,
    });
  }

  return parsed;
}

export function parseGenerationQuality(
  explanation: unknown,
): GenerationQualityMetadata | null {
  const candidate = asRecord(explanation);
  const quality = asRecord(candidate?.generationQuality);

  if (!quality) {
    return null;
  }

  return {
    version: typeof quality.version === 'string' ? quality.version : undefined,
    critiqueScore:
      typeof quality.critiqueScore === 'number'
        ? quality.critiqueScore
        : undefined,
    critiquePassed:
      typeof quality.critiquePassed === 'boolean'
        ? quality.critiquePassed
        : undefined,
    critiqueIssues: parseStringArray(quality.critiqueIssues),
    critiqueRecommendations: parseStringArray(quality.critiqueRecommendations),
    differentialRuleOutScore:
      typeof quality.differentialRuleOutScore === 'number'
        ? quality.differentialRuleOutScore
        : undefined,
    differentialPlausibilityScore:
      typeof quality.differentialPlausibilityScore === 'number'
        ? quality.differentialPlausibilityScore
        : undefined,
    differentialDiscriminationScore:
      typeof quality.differentialDiscriminationScore === 'number'
        ? quality.differentialDiscriminationScore
        : undefined,
    clinicalEdgeValidityScore:
      typeof quality.clinicalEdgeValidityScore === 'number'
        ? quality.clinicalEdgeValidityScore
        : undefined,
    invalidReasoningEdges: parseInvalidReasoningEdges(
      quality.invalidReasoningEdges,
    ),
    educationalValueScore:
      typeof quality.educationalValueScore === 'number'
        ? quality.educationalValueScore
        : undefined,
    graphConsistencyScore:
      typeof quality.graphConsistencyScore === 'number'
        ? quality.graphConsistencyScore
        : undefined,
    estimatedDifficulty: parseDifficulty(quality.estimatedDifficulty),
    estimatedSolveClue:
      typeof quality.estimatedSolveClue === 'number'
        ? quality.estimatedSolveClue
        : undefined,
    specialty:
      typeof quality.specialty === 'string'
        ? quality.specialty
        : quality.specialty === null
          ? null
          : undefined,
    acuity: parseAcuity(quality.acuity),
    hasLabs: typeof quality.hasLabs === 'boolean' ? quality.hasLabs : undefined,
    hasImaging:
      typeof quality.hasImaging === 'boolean' ? quality.hasImaging : undefined,
    hasVitals:
      typeof quality.hasVitals === 'boolean' ? quality.hasVitals : undefined,
    differentialCount:
      typeof quality.differentialCount === 'number'
        ? quality.differentialCount
        : undefined,
    qualityScore:
      typeof quality.qualityScore === 'number' ? quality.qualityScore : undefined,
    teachingAlignment: parseTeachingAlignment(quality.teachingAlignment),
  };
}

export function getValidationIssueBuckets(
  issues: ValidationFindingIssue[],
): ValidationIssueBuckets {
  return {
    blockers: issues.filter((issue) => issue.severity === 'error'),
    warnings: issues.filter((issue) => issue.severity === 'warning'),
    infos: issues.filter((issue) => issue.severity === 'info'),
  };
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === 'string');
}

function parseInvalidReasoningEdges(value: unknown): InvalidReasoningEdge[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const parsed: InvalidReasoningEdge[] = [];
  for (const item of value) {
    const candidate = asRecord(item);
    if (
      !candidate ||
      typeof candidate.differential !== 'string' ||
      typeof candidate.clueOrder !== 'number' ||
      typeof candidate.evidence !== 'string' ||
      typeof candidate.claimedEffect !== 'string' ||
      typeof candidate.verdict !== 'string' ||
      typeof candidate.issue !== 'string'
    ) {
      continue;
    }

    if (
      candidate.claimedEffect !== 'weakens' &&
      candidate.claimedEffect !== 'rules_out'
    ) {
      continue;
    }

    if (
      candidate.verdict !== 'valid' &&
      candidate.verdict !== 'weak_or_neutral' &&
      candidate.verdict !== 'backwards' &&
      candidate.verdict !== 'unsupported'
    ) {
      continue;
    }

    parsed.push({
      differential: candidate.differential,
      clueOrder: candidate.clueOrder,
      evidence: candidate.evidence,
      claimedEffect: candidate.claimedEffect,
      verdict: candidate.verdict,
      issue: candidate.issue,
    });
  }

  return parsed;
}

function parseTeachingAlignment(value: unknown): TeachingAlignmentMetadata | undefined {
  const candidate = asRecord(value);
  if (!candidate) {
    return undefined;
  }

  const playability = asRecord(candidate.playability);
  if (!playability || typeof playability.score !== 'number') {
    return undefined;
  }

  const revealTiming = asRecord(candidate.revealTiming);
  const mimicPersistence = asRecord(candidate.mimicPersistence);

  return {
    selectedUnits: parseTeachingAlignmentUnits(candidate.selectedUnits),
    revealTiming: {
      earliestCoreRevealClue:
        revealTiming && typeof revealTiming.earliestCoreRevealClue === 'number'
          ? revealTiming.earliestCoreRevealClue
          : undefined,
      giveawayTooEarly:
        revealTiming && typeof revealTiming.giveawayTooEarly === 'boolean'
          ? revealTiming.giveawayTooEarly
          : false,
      issues: parseStringArray(revealTiming?.issues),
    },
    mimicPersistence: {
      earlyMimicsPresent: parseStringArray(mimicPersistence?.earlyMimicsPresent),
      mimicsStillPlausibleUntilClue:
        mimicPersistence &&
        typeof mimicPersistence.mimicsStillPlausibleUntilClue === 'number'
          ? mimicPersistence.mimicsStillPlausibleUntilClue
          : undefined,
      issues: parseStringArray(mimicPersistence?.issues),
    },
    playability: {
      score: playability.score,
      difficultyFit: parseDifficultyFit(playability.difficultyFit),
      issues: parseStringArray(playability.issues),
    },
    warnings: parseStringArray(candidate.warnings),
  };
}

function parseTeachingAlignmentUnits(
  value: unknown,
): TeachingAlignmentMetadata['selectedUnits'] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    const candidate = asRecord(item);
    if (
      !candidate ||
      typeof candidate.id !== 'string' ||
      typeof candidate.label !== 'string' ||
      typeof candidate.covered !== 'boolean'
    ) {
      return [];
    }

    return [
      {
        id: candidate.id,
        label: candidate.label,
        importance:
          typeof candidate.importance === 'string'
            ? candidate.importance
            : 'unknown',
        covered: candidate.covered,
        matchedManifestations: parseStringArray(candidate.matchedManifestations),
        firstClueIndex:
          typeof candidate.firstClueIndex === 'number'
            ? candidate.firstClueIndex
            : undefined,
        evidence: parseStringArray(candidate.evidence),
      },
    ];
  });
}

function parseDifficulty(
  value: unknown,
): GenerationQualityMetadata['estimatedDifficulty'] {
  return value === 'easy' || value === 'medium' || value === 'hard'
    ? value
    : undefined;
}

function parseAcuity(value: unknown): GenerationQualityMetadata['acuity'] {
  return value === 'low' || value === 'medium' || value === 'high'
    ? value
    : value === null
      ? null
      : undefined;
}

function parseDifficultyFit(
  value: unknown,
): TeachingAlignmentMetadata['playability']['difficultyFit'] {
  return value === 'too_easy' ||
    value === 'fits' ||
    value === 'too_hard' ||
    value === 'unclear'
    ? value
    : 'unclear';
}

export type {
  CaseClue,
  GenerationQualityMetadata,
  InvalidReasoningEdge,
  TeachingAlignmentMetadata,
  ValidationFindingIssue,
  ValidationIssueBuckets,
};
