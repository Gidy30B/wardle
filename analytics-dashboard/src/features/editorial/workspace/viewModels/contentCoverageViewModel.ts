import type {
  DiagnosisEditorialWorkspace,
  JsonValue,
  WorkspaceSectionFailureSummary,
} from '../../../../api/admin.types.ts';
import type {
  CaseReasoningViewModel,
} from './caseReasoningViewModel.ts';
import type {
  DiagnosticComparison,
  DiagnosticDiscriminator,
  DiagnosticReasoningViewModel,
} from './diagnosticReasoningViewModel.ts';
import type {
  KnowledgeGraphViewModel,
  KnowledgeReviewItem,
  KnowledgeUnsupportedClaim,
} from './knowledgeGraphViewModel.ts';

export type ContentCoverageTone =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral';

export type ContentTeachingRiskSeverity = 'blocker' | 'warning' | 'info';

export type ContentTeachingRiskViewModel = {
  id: string;
  severity: ContentTeachingRiskSeverity;
  title: string;
  detail: string;
  targetBoard: 'education' | 'scoringSystems' | 'mnemonics' | 'recallPrompts';
  sourceId: string | null;
};

export type EducationCoverageCardViewModel = {
  id: string;
  educationVersion: number | null;
  section: string;
  label: string;
  status: string;
  tone: ContentCoverageTone;
  regenerationRecommended: boolean;
  score: number | null;
  coverageScore: number | null;
  warnings: string[];
  blockers: string[];
  unsupportedClaims: KnowledgeUnsupportedClaim[];
  reasoningCoverageCount: number;
  discriminatorCoverageCount: number;
};

export type ScoringSystemCardViewModel = {
  id: string;
  name: string;
  status: 'covered' | 'warning' | 'missing_support';
  tone: ContentCoverageTone;
  criteriaCount: number;
  hasMnemonic: boolean;
  recallPromptCount: number;
  caseCoverageCount: number;
  educationCoverage: string;
  issues: string[];
};

export type MnemonicCardViewModel = {
  id: string;
  mnemonic: string;
  associatedScoringSystem: string | null;
  educationSupported: boolean;
  recallSupported: boolean;
  caseSupported: boolean;
  tone: ContentCoverageTone;
  issues: string[];
};

export type RecallPromptCardViewModel = {
  id: string;
  prompt: string;
  linkedConcept: string | null;
  linkedDiscriminator: string | null;
  linkedDifferential: string | null;
  linkedScoringSystem: string | null;
  reasoningDepth:
    | 'definition_only'
    | 'diagnostic_reasoning'
    | 'discriminator_based'
    | 'differential_based';
  tone: ContentCoverageTone;
  issues: string[];
};

export type ContentCoverageRowViewModel = {
  id: string;
  label: string;
  kind: 'diagnostic_comparison' | 'discriminator' | 'case_reasoning';
  educationCovered: boolean;
  recallCovered: boolean;
  caseCovered: boolean;
  tone: ContentCoverageTone;
  gapReason: string | null;
};

export type ContentCoverageViewModel = {
  education: EducationCoverageCardViewModel[];
  scoringSystems: ScoringSystemCardViewModel[];
  mnemonics: MnemonicCardViewModel[];
  recallPrompts: RecallPromptCardViewModel[];
  coverage: ContentCoverageRowViewModel[];
  teachingRisks: ContentTeachingRiskViewModel[];
  blockers: ContentTeachingRiskViewModel[];
  reviewItems: KnowledgeReviewItem[];
};

type EducationSnapshot = {
  scoringSystems: EducationContentItem[];
  examPearls: EducationContentItem[];
  recallPrompts: EducationContentItem[];
  corpus: string;
};

type EducationContentItem = {
  id: string;
  title: string;
  text: string;
  raw: Record<string, unknown>;
};

export function buildContentCoverageViewModel(params: {
  workspace: DiagnosisEditorialWorkspace;
  knowledge: KnowledgeGraphViewModel;
  diagnosticReasoning: DiagnosticReasoningViewModel;
  caseReasoning: CaseReasoningViewModel;
}): ContentCoverageViewModel {
  const { workspace, knowledge, diagnosticReasoning, caseReasoning } = params;
  const snapshot = extractEducationSnapshot(workspace);
  const recallPrompts = buildRecallPrompts({
    snapshot,
    diagnosticReasoning,
  });
  const scoringSystems = buildScoringSystems({
    snapshot,
    caseReasoning,
    recallPrompts,
    workspace,
  });
  const mnemonics = buildMnemonics({
    snapshot,
    scoringSystems,
    recallPrompts,
    caseReasoning,
  });
  const coverage = buildContentCoverageRows({
    snapshot,
    diagnosticReasoning,
    caseReasoning,
    recallPrompts,
  });
  const education = buildEducationSections({
    workspace,
    knowledge,
    coverage,
  });
  const teachingRisks = buildContentTeachingRisks({
    knowledge,
    coverage,
    scoringSystems,
    mnemonics,
    recallPrompts,
  });

  return {
    education,
    scoringSystems,
    mnemonics,
    recallPrompts,
    coverage,
    teachingRisks,
    blockers: teachingRisks.filter((risk) => risk.severity === 'blocker'),
    reviewItems: buildContentReviewItems(teachingRisks),
  };
}

function buildEducationSections(params: {
  workspace: DiagnosisEditorialWorkspace;
  knowledge: KnowledgeGraphViewModel;
  coverage: ContentCoverageRowViewModel[];
}): EducationCoverageCardViewModel[] {
  const { workspace, knowledge, coverage } = params;
  const sectionHealth = workspace.education.sectionHealth;
  const sections =
    sectionHealth.length > 0
      ? sectionHealth
      : emptyEducationSectionHealth(workspace);

  return sections.map((section) => {
    const unsupportedClaims = knowledge.evidence.unsupportedClaims.filter(
      (claim) => normalizeText(claim.sectionType) === normalizeText(section.section),
    );
    const reasoningCoverageCount = coverage.filter(
      (row) => row.kind === 'diagnostic_comparison' && row.educationCovered,
    ).length;
    const discriminatorCoverageCount = coverage.filter(
      (row) => row.kind === 'discriminator' && row.educationCovered,
    ).length;
    const hasBlocker =
      section.blockers.length > 0 ||
      unsupportedClaims.some((claim) => claim.blocksPublication);
    const hasWarning = section.warnings.length > 0 || unsupportedClaims.length > 0;

    return {
      id: `education-section:${section.section}`,
      educationVersion: workspace.education.version,
      section: section.section,
      label: labelize(section.section),
      status: hasBlocker ? 'blocked' : hasWarning ? 'needs_review' : 'reviewable',
      tone: hasBlocker ? 'danger' : hasWarning ? 'warning' : 'success',
      regenerationRecommended: section.regenerationRecommended,
      score: section.score,
      coverageScore: section.coverageScore,
      warnings: section.warnings,
      blockers: section.blockers,
      unsupportedClaims,
      reasoningCoverageCount,
      discriminatorCoverageCount,
    };
  });
}

function emptyEducationSectionHealth(
  workspace: DiagnosisEditorialWorkspace,
): WorkspaceSectionFailureSummary[] {
  return [
    {
      section: 'findings',
      score: workspace.education.qualityScore,
      coverageScore: null,
      patternComplianceScore: null,
      blockers:
        workspace.education.status === 'missing'
          ? ['Education content is missing.']
          : workspace.education.blockers,
      warnings: workspace.education.warnings,
      regenerationRecommended: false,
      reason:
        workspace.education.status === 'missing'
          ? 'No education section health has been projected yet.'
          : null,
    },
  ];
}

function buildScoringSystems(params: {
  snapshot: EducationSnapshot;
  caseReasoning: CaseReasoningViewModel;
  recallPrompts: RecallPromptCardViewModel[];
  workspace: DiagnosisEditorialWorkspace;
}): ScoringSystemCardViewModel[] {
  const { snapshot, caseReasoning, recallPrompts, workspace } = params;

  return snapshot.scoringSystems.map((item) => {
    const name = item.title || firstLine(item.text) || 'Unnamed scoring system';
    const issues: string[] = [];
    const criteriaCount = countCriteria(item.raw);
    const hasMnemonic = Boolean(
      stringField(item.raw, ['mnemonic', 'memoryAid']) ||
        snapshot.examPearls.some((pearl) => textIncludes(pearl.text, name)),
    );
    const recallPromptCount = recallPrompts.filter((prompt) =>
      textIncludes(prompt.prompt, name),
    ).length;
    const caseCoverageCount = caseReasoning.cases.filter(
      (caseItem) =>
        textIncludes(caseItem.reasoningObjective, name) ||
        caseItem.linkedLearningGoals.some((goal) => textIncludes(goal, name)),
    ).length;

    if (!item.text || criteriaCount === 0) {
      issues.push('Missing criteria or explanation.');
    }
    if (recallPromptCount === 0) {
      issues.push('Missing recall support.');
    }
    if (caseCoverageCount === 0 && workspace.cases.summary.total > 0) {
      issues.push('Missing case support.');
    }

    return {
      id: item.id,
      name,
      status: issues.length ? 'warning' : 'covered',
      tone: issues.length ? 'warning' : 'success',
      criteriaCount,
      hasMnemonic,
      recallPromptCount,
      caseCoverageCount,
      educationCoverage: item.text ? 'present' : 'missing',
      issues,
    };
  });
}

function buildMnemonics(params: {
  snapshot: EducationSnapshot;
  scoringSystems: ScoringSystemCardViewModel[];
  recallPrompts: RecallPromptCardViewModel[];
  caseReasoning: CaseReasoningViewModel;
}): MnemonicCardViewModel[] {
  const { snapshot, scoringSystems, recallPrompts, caseReasoning } = params;
  const mnemonicItems = snapshot.examPearls.filter(
    (item) =>
      normalizeText(String(item.raw.type ?? '')).includes('mnemonic') ||
      textIncludes(item.title, 'mnemonic') ||
      textIncludes(item.text, 'mnemonic') ||
      looksLikeMnemonic(item.text),
  );

  return mnemonicItems.map((item) => {
    const associatedScoringSystem =
      scoringSystems.find((system) => textIncludes(item.text, system.name))
        ?.name ?? null;
    const recallSupported = recallPrompts.some((prompt) =>
      textIncludes(prompt.prompt, item.title || item.text),
    );
    const caseSupported = caseReasoning.cases.some(
      (caseItem) =>
        textIncludes(caseItem.reasoningObjective, item.title) ||
        caseItem.linkedLearningGoals.some((goal) => textIncludes(goal, item.title)),
    );
    const issues = [
      associatedScoringSystem ? null : 'Mnemonic is not linked to a scoring system.',
      recallSupported ? null : 'Mnemonic is not reinforced by recall prompts.',
      caseSupported ? null : 'Mnemonic is not reinforced by case reasoning.',
    ].filter((issue): issue is string => Boolean(issue));

    return {
      id: item.id,
      mnemonic: item.title || item.text,
      associatedScoringSystem,
      educationSupported: Boolean(item.text),
      recallSupported,
      caseSupported,
      tone: issues.length ? 'warning' : 'success',
      issues,
    };
  });
}

function buildRecallPrompts(params: {
  snapshot: EducationSnapshot;
  diagnosticReasoning: DiagnosticReasoningViewModel;
}): RecallPromptCardViewModel[] {
  const { snapshot, diagnosticReasoning } = params;

  return snapshot.recallPrompts.map((item) => {
    const prompt = item.text || item.title || 'Untitled recall prompt';
    const linkedDiscriminator =
      diagnosticReasoning.discriminatorMap.find((discriminator) =>
        textIncludes(prompt, discriminator.label),
      )?.label ?? null;
    const linkedDifferential =
      diagnosticReasoning.diagnosticComparisons.find((comparison) =>
        textIncludes(prompt, comparison.mimicName),
      )?.mimicName ?? null;
    const linkedScoringSystem =
      findKnownScoringSystemName(prompt) ??
      stringField(item.raw, ['scoringSystem', 'linkedScoringSystem']);
    const reasoningDepth = classifyRecallPrompt({
      prompt,
      linkedDiscriminator,
      linkedDifferential,
    });
    const issues =
      reasoningDepth === 'definition_only'
        ? ['Prompt tests definition recall but not diagnostic reasoning.']
        : [];

    return {
      id: item.id,
      prompt,
      linkedConcept: item.title || null,
      linkedDiscriminator,
      linkedDifferential,
      linkedScoringSystem,
      reasoningDepth,
      tone: issues.length ? 'warning' : 'success',
      issues,
    };
  });
}

function buildContentCoverageRows(params: {
  snapshot: EducationSnapshot;
  diagnosticReasoning: DiagnosticReasoningViewModel;
  caseReasoning: CaseReasoningViewModel;
  recallPrompts: RecallPromptCardViewModel[];
}): ContentCoverageRowViewModel[] {
  const { snapshot, diagnosticReasoning, caseReasoning, recallPrompts } = params;
  const comparisonRows = diagnosticReasoning.diagnosticComparisons.map((comparison) =>
    comparisonCoverageRow({ comparison, snapshot, caseReasoning, recallPrompts }),
  );
  const discriminatorRows = diagnosticReasoning.discriminatorMap.map(
    (discriminator) =>
      discriminatorCoverageRow({
        discriminator,
        snapshot,
        caseReasoning,
        recallPrompts,
      }),
  );
  const caseRows = caseReasoning.reasoningCoverage.map((row) => ({
    id: `content-case:${row.id}`,
    label: row.label,
    kind: 'case_reasoning' as const,
    educationCovered: row.educationCovered,
    recallCovered: recallPrompts.some((prompt) =>
      textIncludes(prompt.prompt, row.label),
    ),
    caseCovered: row.casesCovered,
    tone:
      !row.educationCovered || !row.casesCovered
        ? 'warning'
        : ('success' as ContentCoverageTone),
    gapReason:
      !row.educationCovered || !row.casesCovered
        ? row.gapReason ?? 'Case reasoning needs learner-facing content support.'
        : null,
  }));

  return [...comparisonRows, ...discriminatorRows, ...caseRows];
}

function comparisonCoverageRow(params: {
  comparison: DiagnosticComparison;
  snapshot: EducationSnapshot;
  caseReasoning: CaseReasoningViewModel;
  recallPrompts: RecallPromptCardViewModel[];
}): ContentCoverageRowViewModel {
  const { comparison, snapshot, caseReasoning, recallPrompts } = params;
  const educationCovered =
    textIncludes(snapshot.corpus, comparison.mimicName) ||
    comparison.discriminators.some((discriminator) =>
      textIncludes(snapshot.corpus, discriminator.label),
    );
  const recallCovered = recallPrompts.some(
    (prompt) =>
      prompt.linkedDifferential === comparison.mimicName ||
      comparison.discriminators.some(
        (discriminator) => prompt.linkedDiscriminator === discriminator.label,
      ),
  );
  const caseCovered = caseReasoning.reasoningCoverage.some(
    (row) => row.comparisonId === comparison.id && row.casesCovered,
  );
  const missing = [
    educationCovered ? null : 'education',
    recallCovered ? null : 'recall prompt',
    caseCovered ? null : 'case',
  ].filter((item): item is string => Boolean(item));

  return {
    id: `content-comparison:${comparison.id}`,
    label: `${comparison.targetDiagnosisName} vs ${comparison.mimicName}`,
    kind: 'diagnostic_comparison',
    educationCovered,
    recallCovered,
    caseCovered,
    tone: missing.length ? 'warning' : 'success',
    gapReason: missing.length
      ? `Missing ${missing.join(', ')} support for this diagnostic comparison.`
      : null,
  };
}

function discriminatorCoverageRow(params: {
  discriminator: DiagnosticDiscriminator;
  snapshot: EducationSnapshot;
  caseReasoning: CaseReasoningViewModel;
  recallPrompts: RecallPromptCardViewModel[];
}): ContentCoverageRowViewModel {
  const { discriminator, snapshot, caseReasoning, recallPrompts } = params;
  const educationCovered =
    textIncludes(snapshot.corpus, discriminator.label) ||
    textIncludes(snapshot.corpus, discriminator.mimicName);
  const recallCovered = recallPrompts.some(
    (prompt) => prompt.linkedDiscriminator === discriminator.label,
  );
  const caseCovered = caseReasoning.discriminatorCoverage.some(
    (row) => row.discriminatorId === discriminator.id && row.casesCovered,
  );

  return {
    id: `content-discriminator:${discriminator.id}`,
    label: `${discriminator.label} against ${discriminator.mimicName}`,
    kind: 'discriminator',
    educationCovered,
    recallCovered,
    caseCovered,
    tone: !educationCovered || !recallCovered || !caseCovered ? 'warning' : 'success',
    gapReason: !educationCovered
      ? `Education does not yet teach ${discriminator.label}.`
      : !recallCovered
        ? `Recall prompts do not test ${discriminator.label}.`
        : !caseCovered
          ? `Cases do not yet demonstrate ${discriminator.label}.`
          : null,
  };
}

function buildContentTeachingRisks(params: {
  knowledge: KnowledgeGraphViewModel;
  coverage: ContentCoverageRowViewModel[];
  scoringSystems: ScoringSystemCardViewModel[];
  mnemonics: MnemonicCardViewModel[];
  recallPrompts: RecallPromptCardViewModel[];
}): ContentTeachingRiskViewModel[] {
  const { knowledge, coverage, scoringSystems, mnemonics, recallPrompts } = params;
  const unsupportedClaimRisks = knowledge.evidence.unsupportedClaims.map((claim) => ({
    id: `unsupported-claim:${claim.id}`,
    severity: claim.blocksPublication ? 'blocker' as const : 'warning' as const,
    title: 'Unsupported education claim',
    detail: claim.claimText,
    targetBoard: 'education' as const,
    sourceId: claim.id,
  }));
  const coverageRisks = coverage
    .filter((row) => row.gapReason)
    .map((row) => ({
      id: `content-coverage:${row.id}`,
      severity: 'warning' as const,
      title:
        row.kind === 'diagnostic_comparison'
          ? 'Missing reasoning coverage in education'
          : row.kind === 'discriminator'
            ? 'Missing education support for discriminator'
            : 'Missing education support for case reasoning',
      detail: row.gapReason ?? 'Content coverage needs review.',
      targetBoard: 'education' as const,
      sourceId: row.id,
    }));
  const scoringRisks = scoringSystems.flatMap((system) =>
    system.issues.map((issue) => ({
      id: `scoring:${system.id}:${normalizeText(issue)}`,
      severity: 'warning' as const,
      title: issue.includes('case')
        ? 'Scoring system lacks case support'
        : issue.includes('recall')
          ? 'Scoring system lacks recall support'
          : 'Scoring system needs explanation',
      detail: `${system.name}: ${issue}`,
      targetBoard: 'scoringSystems' as const,
      sourceId: system.id,
    })),
  );
  const mnemonicRisks = mnemonics.flatMap((mnemonic) =>
    mnemonic.issues.map((issue) => ({
      id: `mnemonic:${mnemonic.id}:${normalizeText(issue)}`,
      severity: 'warning' as const,
      title: issue.includes('not linked') ? 'Orphaned mnemonic' : 'Mnemonic coverage gap',
      detail: `${mnemonic.mnemonic}: ${issue}`,
      targetBoard: 'mnemonics' as const,
      sourceId: mnemonic.id,
    })),
  );
  const recallRisks = recallPrompts
    .filter((prompt) => prompt.reasoningDepth === 'definition_only')
    .map((prompt) => ({
      id: `recall:${prompt.id}:definition-only`,
      severity: 'warning' as const,
      title: 'Definition-only recall prompt',
      detail: prompt.prompt,
      targetBoard: 'recallPrompts' as const,
      sourceId: prompt.id,
    }));

  return dedupeRisks([
    ...unsupportedClaimRisks,
    ...coverageRisks,
    ...scoringRisks,
    ...mnemonicRisks,
    ...recallRisks,
  ]);
}

function buildContentReviewItems(
  teachingRisks: ContentTeachingRiskViewModel[],
): KnowledgeReviewItem[] {
  return teachingRisks.map((risk) => ({
    id: `content-risk:${risk.id}`,
    kind: risk.title === 'Unsupported education claim' ? 'unsupported_claim' : 'coverage_gap',
    severity: risk.severity,
    title: risk.title,
    detail: risk.detail,
    targetWorkflow: 'content',
    targetBoard: risk.targetBoard,
    sourceId: risk.sourceId,
  }));
}

function extractEducationSnapshot(
  workspace: DiagnosisEditorialWorkspace,
): EducationSnapshot {
  const revisionWithOptionalSnapshot = workspace.revisions.latest as
    | ({ snapshot?: unknown } & Record<string, unknown>)
    | null;
  const snapshot = asRecord(revisionWithOptionalSnapshot?.snapshot);
  const scoringSystems = extractContentItems(
    snapshot?.scoringSystems,
    'scoring-system',
  );
  const examPearls = extractContentItems(snapshot?.examPearls, 'exam-pearl');
  const recallPrompts = extractContentItems(
    snapshot?.recallPrompts,
    'recall-prompt',
  );

  return {
    scoringSystems,
    examPearls,
    recallPrompts,
    corpus: [snapshot, scoringSystems, examPearls, recallPrompts]
      .map(stringifySearchable)
      .join(' '),
  };
}

function extractContentItems(
  value: JsonValue | unknown,
  prefix: string,
): EducationContentItem[] {
  if (Array.isArray(value)) {
    return value.map((item, index) => contentItemFromUnknown(item, prefix, index));
  }

  const record = asRecord(value);
  if (!record) return [];

  return Object.entries(record).map(([key, item], index) => {
    const parsed = contentItemFromUnknown(item, prefix, index);
    return {
      ...parsed,
      id: parsed.id === `${prefix}:${index}` ? `${prefix}:${key}` : parsed.id,
      title: parsed.title || labelize(key),
    };
  });
}

function contentItemFromUnknown(
  item: unknown,
  prefix: string,
  index: number,
): EducationContentItem {
  if (typeof item === 'string') {
    return {
      id: `${prefix}:${index}`,
      title: firstLine(item),
      text: item,
      raw: {},
    };
  }

  const record = asRecord(item) ?? {};
  const title =
    stringField(record, ['name', 'title', 'label', 'system', 'concept']) ??
    firstLine(stringifySearchable(record));
  const text =
    stringField(record, [
      'content',
      'explanation',
      'description',
      'prompt',
      'question',
      'whyItMatters',
    ]) ?? stringifySearchable(record);

  return {
    id: stringField(record, ['id', 'key']) ?? `${prefix}:${index}`,
    title,
    text,
    raw: record,
  };
}

function countCriteria(raw: Record<string, unknown>): number {
  const criteria = raw.criteria ?? raw.items ?? raw.rules ?? raw.components;
  if (Array.isArray(criteria)) return criteria.length;
  const record = asRecord(criteria);
  if (record) return Object.keys(record).length;
  return 0;
}

function classifyRecallPrompt(params: {
  prompt: string;
  linkedDiscriminator: string | null;
  linkedDifferential: string | null;
}): RecallPromptCardViewModel['reasoningDepth'] {
  const normalized = normalizeText(params.prompt);

  if (params.linkedDiscriminator || normalized.includes('distinguish')) {
    return 'discriminator_based';
  }
  if (
    params.linkedDifferential ||
    normalized.includes('differential') ||
    normalized.includes('mimic')
  ) {
    return 'differential_based';
  }
  if (
    normalized.includes('why') ||
    normalized.includes('most likely') ||
    normalized.includes('next best') ||
    normalized.includes('rules out')
  ) {
    return 'diagnostic_reasoning';
  }
  return 'definition_only';
}

function findKnownScoringSystemName(text: string): string | null {
  const known = [
    'CURB-65',
    'Wells',
    'Alvarado',
    'BISAP',
    'Ranson',
    'Child-Pugh',
    'MELD',
    'Rockall',
    'Centor',
    'McIsaac',
  ];
  return known.find((name) => textIncludes(text, name)) ?? null;
}

function stringField(
  record: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function stringifySearchable(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(stringifySearchable).join(' ');
  const record = asRecord(value);
  if (!record) return '';
  return Object.values(record).map(stringifySearchable).join(' ');
}

function firstLine(value: string): string {
  return value.split(/\r?\n/).find((line) => line.trim())?.trim() ?? '';
}

function looksLikeMnemonic(value: string): boolean {
  const words = value.split(/\s+/).filter(Boolean);
  return words.length <= 8 && /[A-Z]{2,}/.test(value);
}

function labelize(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function textIncludes(
  value: string | null | undefined,
  search: string | null | undefined,
): boolean {
  if (!value || !search) return false;
  return normalizeText(value).includes(normalizeText(search));
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function dedupeRisks(
  risks: ContentTeachingRiskViewModel[],
): ContentTeachingRiskViewModel[] {
  const seen = new Set<string>();
  return risks.filter((risk) => {
    if (seen.has(risk.id)) return false;
    seen.add(risk.id);
    return true;
  });
}
