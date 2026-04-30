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
  estimatedDifficulty?: 'easy' | 'medium' | 'hard';
  estimatedSolveClue?: number;
  specialty?: string | null;
  acuity?: 'low' | 'medium' | 'high' | null;
  hasLabs?: boolean;
  hasImaging?: boolean;
  hasVitals?: boolean;
  differentialCount?: number;
  qualityScore?: number;
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

export type {
  CaseClue,
  GenerationQualityMetadata,
  ValidationFindingIssue,
  ValidationIssueBuckets,
};
