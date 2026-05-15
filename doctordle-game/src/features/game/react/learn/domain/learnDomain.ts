import type {
  ClinicalClue,
  GameExplanation,
  GameResult,
  LearnLibraryCase,
  LearnLibraryResponse,
} from "../../../game.types";
import type { RoundViewModel } from "../../../round.types";
import { LEARN_REVIEW_STORAGE_KEY } from "../learn.constants";
import type {
  LearnConfidence,
  LearnFilterOptions,
  LearnFilters,
  LearnPerformanceSummary,
  LearnReviewState,
  LearnReviewStateByCaseKey,
  RecallAnswerOption,
} from "../learn.types";

export type LearnCaseSpecialtyGroup = {
  specialty: { key: string; label: string };
  cases: LearnLibraryCase[];
};

export function groupLearnCasesBySpecialty(
  cases: LearnLibraryCase[],
): LearnCaseSpecialtyGroup[] {
  const groups = new Map<string, LearnCaseSpecialtyGroup>();

  cases.forEach((item) => {
    const specialty = getCaseSpecialty(item);
    if (!groups.has(specialty.key)) {
      groups.set(specialty.key, {
        specialty,
        cases: [],
      });
    }
    groups.get(specialty.key)!.cases.push(item);
  });

  return Array.from(groups.values()).sort((a, b) =>
    a.specialty.label.localeCompare(b.specialty.label),
  );
}

export function formatArchiveCaseLabel(item: LearnLibraryCase): string {
  // Take first 6–8 chars for readability
  return (
    item.displayLabel ??
    item.case?.displayLabel ??
    (item.casePublicNumber ? `Case ${item.casePublicNumber}` : null) ??
    (item.case?.publicNumber ? `Case ${item.case.publicNumber}` : null) ??
    `Daily Case ${item.case?.date || item.completedAt.slice(0, 10)} #${item.sequenceIndex}`
  );
}

export function buildRecallAnswerOptions(
  cases: LearnLibraryCase[],
  currentItem: LearnLibraryCase,
): RecallAnswerOption[] {
  const options = new Map<string, RecallAnswerOption>();
  const add = (item: LearnLibraryCase) => {
    const label = item.case.diagnosis || item.case.title;
    const id = getRecallDiagnosisOptionId(item);
    if (!label.trim() || options.has(id)) return;
    options.set(id, { id, label, aliases: buildRecallAliases(label) });
  };
  add(currentItem);
  cases.forEach(add);
  return Array.from(options.values()).sort((a, b) => {
    if (a.id === getRecallDiagnosisOptionId(currentItem)) return -1;
    if (b.id === getRecallDiagnosisOptionId(currentItem)) return 1;
    return a.label.localeCompare(b.label);
  });
}

export function filterRecallAnswerOptions(
  options: RecallAnswerOption[],
  query: string,
) {
  const normalized = normalizeRegistrySearchTerm(query);
  if (!normalized) return options.slice(0, 5);
  return options.filter((option) =>
    option.aliases.some(
      (alias) => alias.includes(normalized) || normalized.includes(alias),
    ),
  );
}

export function buildRecallAliases(label: string) {
  const normalized = normalizeRegistrySearchTerm(label);
  const pieces = normalized.split(" ").filter((part) => part.length >= 3);
  return Array.from(new Set([normalized, ...pieces]));
}

export function getRecallDiagnosisOptionId(item: LearnLibraryCase) {
  return normalizeRegistrySearchTerm(item.case.diagnosis || item.case.title);
}

export function isRecallTextMatch(answer: string, item: LearnLibraryCase) {
  const normalizedAnswer = normalizeRegistrySearchTerm(answer);
  const normalizedDiagnosis = getRecallDiagnosisOptionId(item);
  if (!normalizedAnswer || !normalizedDiagnosis) return false;
  return (
    normalizedDiagnosis.includes(normalizedAnswer) ||
    normalizedAnswer.includes(normalizedDiagnosis.split(" ")[0])
  );
}

export function normalizeRegistrySearchTerm(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getExplanationDifferentials(explanation: unknown) {
  const record = asRecord(explanation);
  const differentials = record?.differentials;
  return Array.isArray(differentials) ? differentials : [];
}

export function getDifferentialTitle(value: unknown): string {
  const directValue = getStringValue(value);
  if (directValue) return directValue;
  const record = asRecord(value);
  if (!record) return "Differential";
  return (
    getStringValue(record.dx) ??
    getStringValue(record.diagnosis) ??
    getStringValue(record.title) ??
    getStringValue(record.label) ??
    "Differential"
  );
}

export function getDifferentialReason(value: unknown) {
  const record = asRecord(value);
  if (!record) return null;
  return (
    getStringValue(record.why) ??
    getStringValue(record.reason) ??
    getStringValue(record.rationale) ??
    null
  );
}

export function splitReasoning(reasoning: string) {
  return reasoning
    .split(/\n{2,}|\n/)
    .map((step) => step.trim())
    .filter((step) => step.length > 0);
}

export function sortClues(clues: ClinicalClue[]) {
  return [...clues].sort((a, b) => a.order - b.order);
}

export function buildAttemptPips(result: LearnLibraryCase["playerResult"]) {
  return Array.from(
    { length: 6 },
    (_, index): "correct" | "used" | "missed" | "empty" => {
      if (index >= result.attemptsUsed) return "empty";
      if (result.solved && index === result.attemptsUsed - 1) return "correct";
      return result.solved ? "used" : "missed";
    },
  );
}

export function getMissedCases(cases: LearnLibraryCase[]) {
  return cases.filter((item) => !item.playerResult.solved);
}

export function getDueReviewCases(
  cases: LearnLibraryCase[],
  reviewStateByCaseKey: LearnReviewStateByCaseKey,
) {
  const now = Date.now();
  return cases.filter((item) => {
    const reviewState = reviewStateByCaseKey[getLearnReviewCaseKey(item)];

    // First-time users have no local review state yet. Treat every completed case
    // as due once so the recall card is useful instead of showing 0 forever.
    if (!reviewState?.lastReviewedAt && !reviewState?.confidence) return true;

    if (!reviewState?.nextReviewAt) return false;
    const nextReviewAt = Date.parse(reviewState.nextReviewAt);
    return Number.isFinite(nextReviewAt) && nextReviewAt <= now;
  });
}

export function buildAdaptiveRecallQueue(
  cases: LearnLibraryCase[],
  reviewStateByCaseKey: LearnReviewStateByCaseKey,
) {
  return [...cases].sort((a, b) => {
    const diff =
      getAdaptiveRecallPriority(b, reviewStateByCaseKey) -
      getAdaptiveRecallPriority(a, reviewStateByCaseKey);
    return diff !== 0 ? diff : getCaseDateValue(a) - getCaseDateValue(b);
  });
}

export function getAdaptiveRecallPriority(
  item: LearnLibraryCase,
  reviewStateByCaseKey: LearnReviewStateByCaseKey,
) {
  const reviewState = reviewStateByCaseKey[getLearnReviewCaseKey(item)];
  const due = isReviewDue(reviewState);
  const recallFailures = Math.max(
    0,
    (reviewState?.recallAttempts ?? 0) - (reviewState?.recallCorrect ?? 0),
  );

  let score = 0;
  if (!item.playerResult.solved) score += 700;
  if (due) score += 600;
  score += recallFailures * 90;
  if (reviewState?.confidence === "again") score += 520;
  if (reviewState?.confidence === "hard") score += 260;
  score += Math.min(6, item.playerResult.attemptsUsed) * 28;
  if (!reviewState?.lastReviewedAt) score += 120;
  if (reviewState?.confidence === "good") score -= 80;
  if (reviewState?.confidence === "easy") score -= 180;

  return score;
}

export function isReviewDue(reviewState: LearnReviewState | undefined) {
  if (!reviewState?.nextReviewAt) return false;
  const nextReviewAt = Date.parse(reviewState.nextReviewAt);
  return Number.isFinite(nextReviewAt) && nextReviewAt <= Date.now();
}

export function createEmptyLearnReviewState(): LearnReviewState {
  return { recallAttempts: 0, recallCorrect: 0 };
}

export function readLearnReviewState(): LearnReviewStateByCaseKey {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(LEARN_REVIEW_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return {};
    return Object.entries(
      parsed as Record<string, unknown>,
    ).reduce<LearnReviewStateByCaseKey>((acc, [key, value]) => {
      const state = asRecord(value);
      if (!state) return acc;
      acc[key] = {
        confidence: normalizeLearnConfidence(state.confidence),
        recallAttempts: getFiniteNumber(state.recallAttempts) ?? 0,
        recallCorrect: getFiniteNumber(state.recallCorrect) ?? 0,
        lastReviewedAt: getStringValue(state.lastReviewedAt) ?? undefined,
        nextReviewAt: getStringValue(state.nextReviewAt) ?? undefined,
        lastAnswer: getStringValue(state.lastAnswer) ?? undefined,
        lastSelectedDiagnosisId:
          getStringValue(state.lastSelectedDiagnosisId) ?? undefined,
        lastWasCorrect:
          typeof state.lastWasCorrect === "boolean"
            ? state.lastWasCorrect
            : undefined,
      };
      return acc;
    }, {});
  } catch {
    return {};
  }
}

export function writeLearnReviewState(
  reviewStateByCaseKey: LearnReviewStateByCaseKey,
) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      LEARN_REVIEW_STORAGE_KEY,
      JSON.stringify(reviewStateByCaseKey),
    );
  } catch {
    // best effort
  }
}

export function isLearnConfidence(value: unknown): value is LearnConfidence {
  return (
    value === "again" ||
    value === "hard" ||
    value === "good" ||
    value === "easy"
  );
}

export function normalizeLearnConfidence(value: unknown): LearnConfidence | undefined {
  if (isLearnConfidence(value)) return value;
  if (value === "partial") return "good";
  if (value === "solid") return "easy";
  return undefined;
}

export function getLearnReviewCaseKey(item: LearnLibraryCase) {
  return item.sessionId || item.dailyCaseId;
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function getCaseDateValue(item: LearnLibraryCase) {
  const value = Date.parse(item.completedAt || item.case.date || "");
  return Number.isFinite(value) ? value : 0;
}

export function formatStudyTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export function getLearnPerformanceSummary(
  learnLibrary: LearnLibraryResponse | null,
  fallbackCases: LearnLibraryCase[],
): LearnPerformanceSummary {
  return (
    readBackendPerformanceSummary(learnLibrary) ??
    deriveLearnPerformanceSummary(fallbackCases)
  );
}

export function readBackendPerformanceSummary(
  learnLibrary: LearnLibraryResponse | null,
): LearnPerformanceSummary | null {
  if (!learnLibrary || typeof learnLibrary !== "object") return null;
  const source = learnLibrary as LearnLibraryResponse & {
    performanceSummary?: unknown;
    performance?: unknown;
    metrics?: unknown;
  };
  const candidate =
    asRecord(source.performanceSummary) ??
    asRecord(source.performance) ??
    asRecord(source.metrics);
  if (!candidate) return null;
  const casesDone = getFiniteNumber(candidate.casesDone);
  if (casesDone === null) return null;
  const specialties = Array.isArray(candidate.specialties)
    ? candidate.specialties
        .map((item) => asRecord(item))
        .filter((item): item is Record<string, unknown> => item !== null)
        .map((item) => {
          const key =
            getStringValue(item.key) ??
            normalizeFilterKey(getStringValue(item.label) ?? "");
          const label = getStringValue(item.label) ?? titleCase(key);
          const specialtyCasesDone = getFiniteNumber(item.casesDone) ?? 0;
          return {
            key,
            label,
            casesDone: specialtyCasesDone,
            accuracyPct: normalizePercent(getFiniteNumber(item.accuracyPct)),
          };
        })
        .filter((item) => item.key.length > 0 && item.casesDone > 0)
    : [];
  return {
    accuracyPct: normalizePercent(getFiniteNumber(candidate.accuracyPct)),
    casesDone,
    averageCluesUsed: getFiniteNumber(candidate.averageCluesUsed),
    averageTimeSecs: getFiniteNumber(candidate.averageTimeSecs),
    specialties,
  };
}

export function deriveLearnPerformanceSummary(
  cases: LearnLibraryCase[],
): LearnPerformanceSummary {
  const casesDone = cases.length;
  const solvedCount = cases.filter((item) => item.playerResult.solved).length;
  const clueTotal = cases.reduce(
    (sum, item) => sum + item.playerResult.attemptsUsed,
    0,
  );
  const timedCases = cases.filter(
    (item) => item.playerResult.timeSecs !== null,
  );
  const timeTotal = timedCases.reduce(
    (sum, item) => sum + (item.playerResult.timeSecs ?? 0),
    0,
  );
  return {
    accuracyPct:
      casesDone > 0 ? Math.round((solvedCount / casesDone) * 100) : null,
    casesDone,
    averageCluesUsed:
      casesDone > 0 ? roundToOneDecimal(clueTotal / casesDone) : null,
    averageTimeSecs:
      timedCases.length > 0 ? Math.round(timeTotal / timedCases.length) : null,
    specialties: deriveSpecialtySummaries(cases),
  };
}

export function deriveSpecialtySummaries(cases: LearnLibraryCase[]) {
  const groups = new Map<
    string,
    { label: string; casesDone: number; solved: number }
  >();
  cases.forEach((item) => {
    const specialty = getCaseSpecialty(item);
    const existing = groups.get(specialty.key) ?? {
      label: specialty.label,
      casesDone: 0,
      solved: 0,
    };
    existing.casesDone += 1;
    existing.solved += item.playerResult.solved ? 1 : 0;
    groups.set(specialty.key, existing);
  });
  return Array.from(groups.entries())
    .map(([key, value]) => ({
      key,
      label: value.label,
      casesDone: value.casesDone,
      accuracyPct:
        value.casesDone > 0
          ? Math.round((value.solved / value.casesDone) * 100)
          : null,
    }))
    .sort(
      (a, b) => b.casesDone - a.casesDone || a.label.localeCompare(b.label),
    );
}

export function buildLearnFilterOptions(
  cases: LearnLibraryCase[],
): LearnFilterOptions {
  const specialties = deriveSpecialtySummaries(cases);
  const tracks = Array.from(new Set(cases.map((item) => item.track))).sort();
  const difficultyMap = new Map<string, { key: string; label: string }>();
  cases.forEach((item) => {
    const key = getCaseDifficultyKey(item);
    if (!difficultyMap.has(key))
      difficultyMap.set(key, { key, label: titleCase(key) });
  });
  const difficulties = Array.from(difficultyMap.values()).sort((a, b) =>
    a.label.localeCompare(b.label),
  );
  return { specialties, tracks, difficulties };
}

export function filterLearnCases(cases: LearnLibraryCase[], filters: LearnFilters) {
  return cases.filter((item) => {
    if (
      filters.specialty !== "all" &&
      getCaseSpecialty(item).key !== filters.specialty
    )
      return false;
    if (filters.track !== "all" && item.track !== filters.track) return false;
    if (filters.result === "solved" && !item.playerResult.solved) return false;
    if (filters.result === "missed" && item.playerResult.solved) return false;
    if (
      filters.difficulty !== "all" &&
      getCaseDifficultyKey(item) !== filters.difficulty
    )
      return false;
    return true;
  });
}

export function hasActiveFilters(filters: LearnFilters) {
  return (
    filters.specialty !== "all" ||
    filters.track !== "all" ||
    filters.result !== "all" ||
    filters.difficulty !== "all"
  );
}

export function getTotalActiveFilterCount(filters: LearnFilters) {
  return [
    filters.specialty !== "all",
    filters.track !== "all",
    filters.result !== "all",
    filters.difficulty !== "all",
  ].filter(Boolean).length;
}

export function getCaseSpecialty(item: LearnLibraryCase) {
  const caseRecord = item.case as LearnLibraryCase["case"] &
    Record<string, unknown>;
  const itemRecord = item as LearnLibraryCase & Record<string, unknown>;
  const rawLabel =
    getStringValue(caseRecord.specialty) ??
    getStringValue(caseRecord.category) ??
    getStringValue(itemRecord.specialty) ??
    getStringValue(itemRecord.category) ??
    "General Medicine";
  const rawKey =
    getStringValue(caseRecord.specialtyKey) ??
    getStringValue(caseRecord.categoryKey) ??
    getStringValue(itemRecord.specialtyKey) ??
    getStringValue(itemRecord.categoryKey) ??
    rawLabel;
  return { key: normalizeFilterKey(rawKey), label: rawLabel };
}

export function getCaseDifficultyKey(item: LearnLibraryCase) {
  return normalizeFilterKey(item.case.difficulty || "standard");
}

export function formatPercent(value: number | null) {
  return value === null ? "—" : `${Math.round(value)}%`;
}

export function formatAverageClues(value: number | null) {
  return value === null ? "—" : value.toFixed(value % 1 === 0 ? 0 : 1);
}

export function normalizeFilterKey(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized || "standard";
}

export function titleCase(value: string) {
  return value
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

export function roundToOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

export function normalizePercent(value: number | null) {
  if (value === null) return null;
  return Math.min(100, Math.max(0, value));
}

export function getFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function getStringValue(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function mergeLatestPlayedCase({
  libraryCases,
  latestPlayedExplanation,
  latestPlayedResult,
  explanation,
  latestResult,
  roundViewModel,
}: {
  libraryCases: LearnLibraryCase[];
  latestPlayedExplanation: GameExplanation | null;
  latestPlayedResult: GameResult | null;
  explanation: GameExplanation | null;
  latestResult: GameResult | null;
  roundViewModel: RoundViewModel;
}) {
  const latest = latestPlayedResult ?? latestResult;
  const latestExplanation =
    latestPlayedExplanation ?? explanation ?? latest?.explanation ?? null;
  const latestCase = latest?.case;

  if (!latest?.gameOver || !latestCase || !latestExplanation)
    return libraryCases;

  const alreadyPresent = libraryCases.some(
    (item) => item.case.id === latestCase.id,
  );
  if (alreadyPresent) return libraryCases;

  const attemptsUsed = latest.attemptsCount ?? latest.clueIndex + 1;
  const fallbackCase: LearnLibraryCase = {
    sessionId: "latest",
    dailyCaseId: latestCase.id,
    casePublicNumber: latestCase.casePublicNumber ?? null,
    displayLabel: latestCase.displayLabel ?? roundViewModel.caseDisplayLabel,
    trackDisplayLabel:
      latestCase.trackDisplayLabel ?? roundViewModel.caseTrackDisplayLabel,
    track: "DAILY",
    sequenceIndex: 1,
    completedAt: latest.completedAt ?? new Date().toISOString(),
    playerResult: {
      solved: latest.gameOverReason === "correct" || latest.isTerminalCorrect,
      attemptsUsed,
      timeSecs: roundViewModel.elapsedSeconds ?? null,
    },
    case: {
      id: latestCase.id,
      publicNumber: latestCase.casePublicNumber ?? null,
      displayLabel: latestCase.displayLabel ?? roundViewModel.caseDisplayLabel,
      trackDisplayLabel:
        latestCase.trackDisplayLabel ?? roundViewModel.caseTrackDisplayLabel,
      title: roundViewModel.caseId ?? "Completed case",
      diagnosis: "Completed case",
      date: "",
      difficulty: "",
      clues: latestCase.clues,
      explanation: latestExplanation,
    },
  };

  return [fallbackCase, ...libraryCases];
}



