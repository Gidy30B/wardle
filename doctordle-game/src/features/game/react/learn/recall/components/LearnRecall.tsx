import { useMemo, useState, type ReactNode } from "react";
import { coerceStructuredExplanation } from "../../../../gameExplanation";
import type { ClinicalClue, LearnLibraryCase } from "../../../../game.types";
import type {
  LearnConfidence,
  LearnReviewState,
  LearnReviewStateByCaseKey,
  RecallAnswerOption,
} from "../../learn.types";
import {
  CLUE_TYPE_COPY,
  CLUE_TYPE_TEXT_TONES,
  CONFIDENCE_COPY,
  CONFIDENCE_REVIEW_DAYS,
} from "../../learn.constants";
import {
  addDays,
  buildRecallAnswerOptions,
  createEmptyLearnReviewState,
  filterRecallAnswerOptions,
  getDifferentialReason,
  getDifferentialTitle,
  getExplanationDifferentials,
  getLearnReviewCaseKey,
  getRecallDiagnosisOptionId,
  getCaseSpecialty,
  isRecallTextMatch,
  sortClues,
  splitReasoning,
} from "../../domain/learnDomain";
import { ReviewSection } from "../../detail/shared";
import {
  findExactDiagnosisSelection,
  searchDiagnosisAutocomplete,
  useDiagnosisDictionaryIndex,
} from "../../../../diagnosis";

export function AdaptiveRecallQueueController({
  queue,
  reviewStateByCaseKey,
  studyQueueIndex,
  onChangeIndex,
  onExit,
  onUpdateReviewState,
}: {
  queue: LearnLibraryCase[];
  reviewStateByCaseKey: LearnReviewStateByCaseKey;
  studyQueueIndex: number;
  onChangeIndex: (index: number) => void;
  onExit: () => void;
  onUpdateReviewState: (
    item: LearnLibraryCase,
    updater: (current: LearnReviewState) => LearnReviewState,
  ) => void;
}) {
  const item = queue[studyQueueIndex] ?? queue[0];
  const canGoPrevious = studyQueueIndex > 0;
  const canGoNext = studyQueueIndex < queue.length - 1;

  if (!item) return null;

  return (
    <div className="fixed inset-0 z-[2147483647] isolate flex h-[100dvh] min-h-0 w-screen min-w-0 flex-col overflow-hidden bg-[var(--wardle-color-charcoal)] lg:hidden">
      <DiagnosisRecallSurface
        key={item.dailyCaseId}
        item={item}
        allCases={queue}
        queueIndex={studyQueueIndex}
        queueSize={queue.length}
        reviewStateByCaseKey={reviewStateByCaseKey}
        reviewState={
          reviewStateByCaseKey[getLearnReviewCaseKey(item)] ??
          createEmptyLearnReviewState()
        }
        onExit={onExit}
        onPrevious={
          canGoPrevious ? () => onChangeIndex(studyQueueIndex - 1) : undefined
        }
        onNext={
          canGoNext ? () => onChangeIndex(studyQueueIndex + 1) : undefined
        }
        onUpdateReviewState={(updater) => onUpdateReviewState(item, updater)}
      />
    </div>
  );
}

// ─── DiagnosisRecallSurface ────────────────────────────────────────────────

export function DiagnosisRecallSurface({
  item,
  allCases,
  queueIndex,
  queueSize,
  reviewStateByCaseKey,
  reviewState,
  onExit,
  onPrevious,
  onNext,
  onUpdateReviewState,
}: {
  item: LearnLibraryCase;
  allCases: LearnLibraryCase[];
  queueIndex: number;
  queueSize: number;
  reviewStateByCaseKey: LearnReviewStateByCaseKey;
  reviewState: LearnReviewState;
  onExit: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onUpdateReviewState: (
    updater: (current: LearnReviewState) => LearnReviewState,
  ) => void;
}) {
  const [recallPhase, setRecallPhase] = useState<
    "question" | "answer" | "complete"
  >("question");
  const [visibleClueCount, setVisibleClueCount] = useState(1);
  const [query, setQuery] = useState("");
  const [selectedOption, setSelectedOption] =
    useState<RecallAnswerOption | null>(null);
  const [committedAnswer, setCommittedAnswer] = useState("");
  const [committedAnswerId, setCommittedAnswerId] = useState<
    string | undefined
  >(undefined);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [hasRatedCurrentCard, setHasRatedCurrentCard] = useState(false);
  const { index: diagnosisIndex, availability: diagnosisAvailability } =
    useDiagnosisDictionaryIndex();

  const fallbackAnswerOptions = useMemo(
    () => buildRecallAnswerOptions(allCases, item),
    [allCases, item],
  );
  const correctDiagnosisRegistryId = useMemo(
    () =>
      findExactDiagnosisSelection(
        diagnosisIndex,
        item.case.diagnosis || item.case.title,
      )?.diagnosisRegistryId,
    [diagnosisIndex, item.case.diagnosis, item.case.title],
  );
  const fallbackCorrectDiagnosisId = getRecallDiagnosisOptionId(item);
  const wasCorrect = committedAnswerId
    ? correctDiagnosisRegistryId
      ? committedAnswerId === correctDiagnosisRegistryId ||
        isRecallTextMatch(committedAnswer, item)
      : committedAnswerId === fallbackCorrectDiagnosisId ||
        isRecallTextMatch(committedAnswer, item)
    : isRecallTextMatch(committedAnswer, item);

  const sortedClues = useMemo(
    () => sortClues(item.case.clues),
    [item.case.clues],
  );
  const remainingClues = Math.max(0, sortedClues.length - visibleClueCount);
  const matchingOptions = useMemo(() => {
    const registryOptions = searchDiagnosisAutocomplete(
      diagnosisIndex,
      query,
      5,
    ).map((suggestion) => ({
      id: suggestion.diagnosisRegistryId,
      registryId: suggestion.diagnosisRegistryId,
      label: suggestion.displayLabel,
      aliases: [],
      matchKind: suggestion.matchKind,
    }));

    if (registryOptions.length > 0 || diagnosisAvailability === "ready") {
      return registryOptions;
    }

    return filterRecallAnswerOptions(fallbackAnswerOptions, query).slice(0, 5);
  }, [diagnosisAvailability, diagnosisIndex, fallbackAnswerOptions, query]);
  const committedLabel = selectedOption?.label ?? query.trim();

  const ratedCount = allCases.filter(
    (c) => reviewStateByCaseKey[getLearnReviewCaseKey(c)]?.confidence,
  ).length;
  const canAdvanceFromAnswer = recallPhase === "answer" && hasRatedCurrentCard;
  const isFinalCase = queueIndex >= queueSize - 1;

  const rateRecallConfidence = (confidence: LearnConfidence) => {
    const reviewedAt = new Date();
    const shouldCount = !hasRatedCurrentCard;
    setHasRatedCurrentCard(true);
    onUpdateReviewState((current) => ({
      ...current,
      confidence,
      recallAttempts: current.recallAttempts + (shouldCount ? 1 : 0),
      recallCorrect:
        current.recallCorrect + (shouldCount && wasCorrect ? 1 : 0),
      lastAnswer: committedAnswer,
      lastSelectedDiagnosisId: committedAnswerId,
      lastWasCorrect: wasCorrect,
      lastReviewedAt: reviewedAt.toISOString(),
      nextReviewAt: addDays(
        reviewedAt,
        CONFIDENCE_REVIEW_DAYS[confidence],
      ).toISOString(),
    }));
  };

  const handleCommitAnswer = () => {
    if (!committedLabel) return;
    setCommittedAnswer(committedLabel);
    setCommittedAnswerId(selectedOption?.id);
    setRecallPhase("answer");
  };

  const resetCard = () => {
    setRecallPhase("question");
    setVisibleClueCount(1);
    setQuery("");
    setSelectedOption(null);
    setCommittedAnswer("");
    setCommittedAnswerId(undefined);
    setHasRatedCurrentCard(false);
  };

  const goPrevious = () => {
    if (!onPrevious) return;
    resetCard();
    onPrevious();
  };

  const goNext = () => {
    if (!canAdvanceFromAnswer) return;
    if (onNext) {
      resetCard();
      onNext();
      return;
    }
    setRecallPhase("complete");
  };

  if (recallPhase === "complete") {
    return (
      <div className="relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-[#0e0f1a] px-4">
        <RecallCompletionScreen
          queue={allCases}
          reviewStateByCaseKey={reviewStateByCaseKey}
          onDone={onExit}
        />
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-[#0e0f1a]">
      <div className="shrink-0 border-b border-white/[0.07] bg-[#11121e] px-4 pb-3 pt-3.5">
        <div className="mb-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowExitConfirm(true)}
            aria-label="Exit recall"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-white/[0.1] bg-white/[0.04] font-bold text-white/40 transition hover:bg-white/[0.07] active:scale-[0.97]"
          >
            ×
          </button>
          <span className="min-w-0 flex-1 text-center font-brand-mono text-[10px] font-bold uppercase tracking-[0.18em] text-white/28">
            Adaptive recall
          </span>
          <span className="shrink-0 rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 font-brand-mono text-[9px] font-bold text-white/30">
            {ratedCount}/{queueSize}
          </span>
        </div>

        <RecallProgressTrack
          queue={allCases}
          queueIndex={queueIndex}
          queueSize={queueSize}
          reviewStateByCaseKey={reviewStateByCaseKey}
        />
      </div>

      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-5">
        {recallPhase === "question" ? (
          <RecallQuestionContent
            item={item}
            sortedClues={sortedClues}
            visibleClueCount={visibleClueCount}
          />
        ) : (
          <RecallAnswerCard
            key={`${item.dailyCaseId}-answer`}
            item={item}
            committedAnswer={committedAnswer}
            wasCorrect={wasCorrect}
            reviewState={reviewState}
            onRateConfidence={rateRecallConfidence}
          />
        )}
      </div>

      {recallPhase === "question" ? (
        <RecallAnswerComposer
          query={query}
          selectedOption={selectedOption}
          matchingOptions={matchingOptions}
          remainingClues={remainingClues}
          canCommit={Boolean(committedLabel)}
          onChangeQuery={(value) => {
            setQuery(value);
            setSelectedOption(null);
          }}
          onSelectOption={(option) => {
            setSelectedOption(option);
            setQuery(option.label);
          }}
          onRevealNextClue={() =>
            setVisibleClueCount((count) =>
              Math.min(count + 1, sortedClues.length),
            )
          }
          onCommit={handleCommitAnswer}
        />
      ) : (
        <RecallAnswerFooter
          canAdvance={canAdvanceFromAnswer}
          isFinal={isFinalCase}
          hasPrevious={Boolean(onPrevious)}
          onRetry={resetCard}
          onNext={goNext}
          onPrevious={goPrevious}
        />
      )}

      {showExitConfirm && (
        <div className="wardle-learn-fade absolute inset-0 z-50 flex items-end justify-center bg-black/60 px-5 pb-8">
          <div className="wardle-learn-slide-up w-full rounded-[22px] border border-white/[0.1] bg-[#1a1b2c] p-5">
            <p className="text-[15px] font-black text-white/90">
              Exit review queue?
            </p>
            <p className="mt-1.5 text-[13px] leading-[1.6] text-white/40">
              You've rated {ratedCount} of {queueSize} cases. Progress is saved
              automatically.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setShowExitConfirm(false)}
                className="rounded-[14px] border border-white/[0.08] bg-white/[0.04] py-3.5 text-[14px] font-bold text-white/50 transition active:scale-[0.98]"
              >
                Keep going
              </button>
              <button
                type="button"
                onClick={onExit}
                className="rounded-[14px] border border-[rgba(0,180,166,0.25)] bg-[rgba(0,180,166,0.12)] py-3.5 text-[14px] font-bold text-[var(--wardle-color-teal)] transition active:scale-[0.98]"
              >
                Exit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function RecallCompletionScreen({
  queue,
  reviewStateByCaseKey,
  onDone,
}: {
  queue: LearnLibraryCase[];
  reviewStateByCaseKey: LearnReviewStateByCaseKey;
  onDone: () => void;
}) {
  const counts = queue.reduce(
    (acc, item) => {
      const confidence =
        reviewStateByCaseKey[getLearnReviewCaseKey(item)]?.confidence;
      if (confidence) acc[confidence] += 1;
      return acc;
    },
    { again: 0, hard: 0, good: 0, easy: 0 } as Record<
      LearnConfidence,
      number
    >,
  );

  const reviewedCount = counts.again + counts.hard + counts.good + counts.easy;

  return (
    <section className="wardle-learn-slide-up flex min-h-full flex-col items-center justify-center px-1 py-8 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full border border-[rgba(0,180,166,0.28)] bg-[rgba(0,180,166,0.1)] font-brand-mono text-4xl font-black text-[var(--wardle-color-teal)]">
        ✓
      </div>
      <h2 className="mt-5 text-2xl font-black tracking-[-0.02em] text-white/92">
        Session done!
      </h2>
      <p className="mt-2 max-w-[280px] text-[13px] leading-6 text-white/46">
        You've reviewed {reviewedCount || queue.length} case
        {(reviewedCount || queue.length) === 1 ? "" : "s"} due today. Next
        sessions are scheduled based on your ratings.
      </p>

      <div className="mt-6 grid w-full grid-cols-2 gap-2">
        <RecallCompletionStat label="Easy" value={counts.easy} tone="blue" />
        <RecallCompletionStat label="Good" value={counts.good} tone="teal" />
        <RecallCompletionStat label="Hard" value={counts.hard} tone="amber" />
        <RecallCompletionStat label="Again" value={counts.again} tone="rose" />
      </div>

      <button
        type="button"
        onClick={onDone}
        className="mt-6 w-full rounded-[14px] bg-[var(--wardle-color-teal)] px-4 py-4 text-[15px] font-black text-white transition active:scale-[0.98]"
      >
        Back to Learn
      </button>
    </section>
  );
}

export function RecallCompletionStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "blue" | "teal" | "amber" | "rose";
}) {
  const toneClass =
    tone === "blue"
      ? "text-blue-300"
      : tone === "teal"
        ? "text-[var(--wardle-color-teal)]"
        : tone === "amber"
          ? "text-[var(--wardle-color-amber)]"
          : "text-rose-300";

  return (
    <div className="rounded-[14px] border border-white/[0.1] bg-[#1e2030] px-3 py-4">
      <div
        className={`font-brand-mono text-[22px] font-black leading-none ${toneClass}`}
      >
        {value}
      </div>
      <div className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-white/28">
        {label}
      </div>
    </div>
  );
}

export function RecallProgressTrack({
  queue,
  queueIndex,
  queueSize,
  reviewStateByCaseKey,
}: {
  queue: LearnLibraryCase[];
  queueIndex: number;
  queueSize: number;
  reviewStateByCaseKey: LearnReviewStateByCaseKey;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1">
      <div className="flex min-w-0 flex-1 items-center gap-[3px]">
        {queue.map((queueItem, index) => {
          const state = reviewStateByCaseKey[getLearnReviewCaseKey(queueItem)];
          const confidence = state?.confidence;
          const current = index === queueIndex;
          const tone = getRecallProgressTone(confidence);
          return (
            <span
              key={queueItem.dailyCaseId || queueItem.sessionId || index}
              className={`flex-1 rounded-full transition-all duration-300 ${
                current
                  ? "h-1.5 bg-[var(--wardle-color-teal)]"
                  : `h-1 ${tone}`
              }`}
            />
          );
        })}
      </div>
      <span className="ml-1.5 shrink-0 font-brand-mono text-[10px] text-white/28">
        {queueIndex + 1}/{queueSize}
      </span>
    </div>
  );
}

export function getRecallProgressTone(confidence: LearnConfidence | undefined) {
  if (confidence === "again") return "bg-rose-400/60";
  if (confidence === "hard") return "bg-[rgba(244,162,97,0.6)]";
  if (confidence === "good") return "bg-[rgba(0,180,166,0.5)]";
  if (confidence === "easy") return "bg-blue-400/60";
  return "bg-white/[0.08]";
}

export function RecallQuestionContent({
  item,
  sortedClues,
  visibleClueCount,
}: {
  item: LearnLibraryCase;
  sortedClues: ClinicalClue[];
  visibleClueCount: number;
}) {
  const visibleClues = sortedClues.slice(0, visibleClueCount);
  const specialty = getCaseSpecialty(item);

  return (
    <section className="wardle-learn-slide-up min-w-0 pb-2">
      <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
        <span className="font-brand-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--wardle-color-teal)]">
          {specialty.label}
        </span>
        <span className="shrink-0 rounded-full border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 font-brand-mono text-[9px] font-bold text-white/28">
          {visibleClueCount}/{sortedClues.length} clues
        </span>
      </div>

      <div className="mb-4">
        <h2 className="mt-1.5 text-[20px] font-black leading-tight tracking-[-0.02em] text-white/92">
          What's the diagnosis?
        </h2>
      </div>

      <div className="space-y-2">
        {visibleClues.map((clue, index) => (
          <RecallClueCard
            key={clue.id}
            clue={clue}
            index={index}
            active={index === visibleClues.length - 1}
          />
        ))}
        {sortedClues.slice(visibleClueCount).map((clue, lockedIndex) => {
          const typeCopy = CLUE_TYPE_COPY[clue.type];
          return (
            <div
              key={clue.id}
              className="flex min-w-0 items-center gap-3 rounded-[13px] border border-white/[0.05] bg-white/[0.01] px-3 py-2.5 opacity-30"
            >
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] border border-white/[0.1] bg-transparent font-brand-mono text-[9px] font-black text-white/20">
                {typeCopy.abbr}
              </div>
              <p className="min-w-0 text-[12px] italic text-white/30">
                Clue {visibleClueCount + lockedIndex + 1} — locked
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function RecallAnswerComposer({
  query,
  selectedOption,
  matchingOptions,
  remainingClues,
  canCommit,
  onChangeQuery,
  onSelectOption,
  onRevealNextClue,
  onCommit,
}: {
  query: string;
  selectedOption: RecallAnswerOption | null;
  matchingOptions: RecallAnswerOption[];
  remainingClues: number;
  canCommit: boolean;
  onChangeQuery: (value: string) => void;
  onSelectOption: (option: RecallAnswerOption) => void;
  onRevealNextClue: () => void;
  onCommit: () => void;
}) {
  const showOptions = query.trim().length > 0 && matchingOptions.length > 0;

  return (
    <div className="shrink-0 border-t border-[rgba(0,180,166,0.14)] bg-[#11121e]/95 px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3 shadow-[0_-18px_45px_rgba(0,0,0,0.28)] backdrop-blur">
      {remainingClues > 0 && (
        <button
          type="button"
          onClick={onRevealNextClue}
          className="mb-3 flex w-full items-center gap-3 rounded-[14px] border border-[rgba(244,162,97,0.18)] bg-[rgba(244,162,97,0.07)] px-3.5 py-2.5 text-left transition hover:bg-[rgba(244,162,97,0.1)] active:scale-[0.99]"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border border-[rgba(244,162,97,0.24)] bg-[rgba(244,162,97,0.1)] font-brand-mono text-[12px] font-black text-[var(--wardle-color-amber)]">
            +
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] font-black text-[var(--wardle-color-mint)]">
              Reveal next clue
            </span>
            <span className="font-brand-mono text-[10px] text-[rgba(244,162,97,0.58)]">
              {remainingClues} remaining
            </span>
          </span>
          <span className="text-[16px] text-[var(--wardle-color-amber)]/55">
            ›
          </span>
        </button>
      )}

      {showOptions && (
        <div className="mb-2 overflow-hidden rounded-[14px] border border-[rgba(0,180,166,0.16)] bg-[#191b2a]">
          {matchingOptions.map((option, index) => {
            const active = selectedOption?.id === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onSelectOption(option)}
                className={`flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left transition ${
                  index < matchingOptions.length - 1
                    ? "border-b border-white/[0.06]"
                    : ""
                } ${
                  active
                    ? "bg-[rgba(0,180,166,0.13)] text-[var(--wardle-color-mint)]"
                    : "text-white/56 hover:bg-white/[0.04]"
                }`}
              >
                <span className="min-w-0 truncate text-[13px] font-bold">
                  {option.label}
                </span>
                {active && (
                  <span className="shrink-0 rounded-full border border-[rgba(0,180,166,0.28)] bg-[rgba(0,180,166,0.12)] px-2 py-0.5 font-brand-mono text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--wardle-color-teal)]">
                    Selected
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div
        className={`flex h-[52px] items-stretch overflow-hidden rounded-[15px] border transition-colors ${
          canCommit
            ? "border-[rgba(0,180,166,0.34)] bg-[rgba(0,180,166,0.06)]"
            : "border-white/[0.09] bg-[#191b2a]"
        }`}
      >
        <input
          value={query}
          onChange={(event) => onChangeQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && canCommit) onCommit();
          }}
          placeholder="Enter diagnosis…"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent px-4 text-[14px] font-bold text-[var(--wardle-color-mint)] outline-none placeholder:text-white/24"
        />
        <div className="my-[10px] w-px shrink-0 bg-white/[0.09]" />
        <button
          type="button"
          onClick={onCommit}
          disabled={!canCommit}
          className={`shrink-0 px-5 text-[13px] font-black tracking-[0.01em] transition disabled:opacity-30 active:scale-[0.97] ${
            canCommit
              ? "bg-[var(--wardle-color-teal)] text-white"
              : "text-white/30"
          }`}
        >
          Submit
        </button>
      </div>

      <p className="mt-2 text-center font-brand-mono text-[10px] text-white/22">
        {canCommit
          ? "Submit locks your answer"
          : "Commit a diagnosis when ready"}
      </p>
    </div>
  );
}

function RecallAnswerFooter({
  canAdvance,
  isFinal,
  hasPrevious,
  onRetry,
  onNext,
  onPrevious,
}: {
  canAdvance: boolean;
  isFinal: boolean;
  hasPrevious: boolean;
  onRetry: () => void;
  onNext: () => void;
  onPrevious: () => void;
}) {
  return (
    <div className="shrink-0 border-t border-white/[0.08] bg-[#11121e] px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3">
      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={onRetry}
          className="flex h-[52px] shrink-0 items-center justify-center rounded-[14px] border border-white/[0.08] bg-white/[0.04] px-5 text-[13px] font-bold text-white/40 transition hover:bg-white/[0.07] active:scale-[0.98]"
        >
          Retry
        </button>

        <button
          type="button"
          onClick={onNext}
          disabled={!canAdvance}
          className={`flex h-[52px] flex-1 items-center justify-between gap-3 rounded-[14px] border px-4 transition active:scale-[0.98] ${
            canAdvance
              ? "border-[rgba(0,180,166,0.28)] bg-[rgba(0,180,166,0.12)] hover:bg-[rgba(0,180,166,0.16)]"
              : "border-white/[0.06] bg-white/[0.02]"
          }`}
        >
          <div className="min-w-0 text-left">
            <span
              className={`block text-[14px] font-black transition ${
                canAdvance ? "text-[var(--wardle-color-teal)]" : "text-white/24"
              }`}
            >
              {isFinal ? "Finish session" : "Next case"}
            </span>
            <span
              className={`block font-brand-mono text-[9px] uppercase tracking-[0.1em] transition ${
                canAdvance ? "text-[rgba(0,180,166,0.5)]" : "text-white/20"
              }`}
            >
              {canAdvance
                ? isFinal
                  ? "View session summary"
                  : "Continue review"
                : "Rate your recall below"}
            </span>
          </div>
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[15px] transition ${
              canAdvance
                ? "bg-[rgba(0,180,166,0.2)] text-[var(--wardle-color-teal)]"
                : "bg-white/[0.04] text-white/20"
            }`}
          >
            {canAdvance ? "›" : "·"}
          </span>
        </button>
      </div>

      {hasPrevious && (
        <button
          type="button"
          onClick={onPrevious}
          className="mt-2.5 w-full text-center font-brand-mono text-[10px] font-bold uppercase tracking-[0.12em] text-white/22 transition hover:text-white/40"
        >
          ← Previous case
        </button>
      )}
    </div>
  );
}

export function RecallClueCard({
  clue,
  index,
  active,
}: {
  clue: ClinicalClue;
  index: number;
  active: boolean;
}) {
  const typeCopy = CLUE_TYPE_COPY[clue.type];

  return (
    <div
      className={`flex min-w-0 gap-3 rounded-[13px] border px-3 py-3 transition-all ${
        active
          ? "wardle-learn-slide-up border-[rgba(0,180,166,0.22)] bg-[rgba(0,180,166,0.07)]"
          : "border-white/[0.07] bg-white/[0.025]"
      }`}
    >
      <div
        className={`mt-[1px] flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] border font-brand-mono text-[9px] font-black ${typeCopy.tone}`}
      >
        {typeCopy.abbr}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={`font-brand-mono text-[9px] font-bold uppercase tracking-[0.12em] ${
            active ? "text-[var(--wardle-color-teal)]/60" : "text-white/24"
          }`}
        >
          {typeCopy.label} · Clue {index + 1}
        </p>
        <p
          className={`mt-1 break-words text-[13px] leading-[1.55] ${
            active ? "text-white/84" : "text-white/46"
          }`}
        >
          {clue.value}
        </p>
      </div>
    </div>
  );
}

// ─── RecallAnswerCard ─────────────────────────────────────────────────────────

export function RecallAnswerCard({
  item,
  committedAnswer,
  wasCorrect,
  reviewState,
  onRateConfidence,
}: {
  item: LearnLibraryCase;
  committedAnswer: string;
  wasCorrect: boolean;
  reviewState: LearnReviewState;
  onRateConfidence: (confidence: LearnConfidence) => void;
}) {
  const explanation = coerceStructuredExplanation(item.case.explanation ?? {});
  const differentials = useMemo(
    () => getExplanationDifferentials(item.case.explanation),
    [item.case.explanation],
  );
  const sortedClues = useMemo(
    () => sortClues(item.case.clues),
    [item.case.clues],
  );
  const reasoningSteps = useMemo(
    () => splitReasoning(explanation?.reasoning ?? ""),
    [explanation?.reasoning],
  );

  const [showClues, setShowClues] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);
  const [showDifferentials, setShowDifferentials] = useState(false);
  return (
    <section className="wardle-learn-slide-up flex min-w-0 flex-col gap-4 pb-2">
      <div
        className={`flex items-center gap-3.5 rounded-[16px] border px-4 py-3.5 ${
          wasCorrect
            ? "border-[rgba(0,180,166,0.22)] bg-[rgba(0,180,166,0.08)]"
            : "border-rose-400/[0.22] bg-rose-400/[0.07]"
        }`}
      >
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[16px] font-black ${
            wasCorrect
              ? "bg-[rgba(0,180,166,0.18)] text-[var(--wardle-color-teal)]"
              : "bg-rose-400/[0.16] text-rose-300"
          }`}
        >
          {wasCorrect ? "✓" : "✗"}
        </span>
        <div className="min-w-0 flex-1">
          <p
            className={`font-brand-mono text-[10px] font-black uppercase tracking-[0.14em] ${
              wasCorrect ? "text-[var(--wardle-color-teal)]" : "text-rose-300"
            }`}
          >
            {wasCorrect ? "Correct" : "Incorrect"}
          </p>
          <p className="mt-0.5 truncate text-[13px] text-white/50">
            You answered:{" "}
            <span className="font-bold text-white/80">{committedAnswer}</span>
          </p>
        </div>
      </div>

      <div className="rounded-[18px] border border-[rgba(0,180,166,0.18)] bg-[rgba(0,180,166,0.06)] px-4 py-4">
        <p className="font-brand-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--wardle-color-teal)]/60">
          Diagnosis
        </p>
        <h2 className="mt-2 break-words text-2xl font-black leading-tight tracking-tight text-[var(--wardle-color-mint)]">
          {item.case.diagnosis || item.case.title}
        </h2>
        {explanation?.summary && (
          <p className="mt-3 border-t border-white/[0.06] pt-3 text-sm leading-6 text-white/56">
            {explanation.summary}
          </p>
        )}
      </div>

      {explanation?.keyFindings.length ? (
        <ReviewSection title="Key Findings" tone="teal">
          <div className="space-y-1.5">
            {explanation.keyFindings.map((finding) => (
              <div
                key={finding}
                className="flex min-w-0 gap-2.5 rounded-[10px] border border-white/[0.05] bg-white/[0.03] px-3 py-2.5"
              >
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--wardle-color-teal)]/60" />
                <span className="min-w-0 break-words text-sm leading-6 text-white/64">
                  {finding}
                </span>
              </div>
            ))}
          </div>
        </ReviewSection>
      ) : null}

      <RecallDisclosure
        label={`Clue trail · ${sortedClues.length} clues`}
        open={showClues}
        onToggle={() => setShowClues((value) => !value)}
      >
        <div className="flex flex-wrap gap-1.5">
          {sortedClues.map((clue, index) => {
            const typeCopy = CLUE_TYPE_COPY[clue.type];
            const wasUsed = index < item.playerResult.attemptsUsed;
            return (
              <span
                key={clue.id}
                className={`inline-flex max-w-full items-center gap-1.5 rounded-[8px] border px-2 py-1 text-[11px] ${
                  wasUsed
                    ? "border-white/[0.09] bg-white/[0.045] text-white/60"
                    : "border-white/[0.04] bg-white/[0.02] text-white/20"
                }`}
              >
                <span
                  className={`font-brand-mono text-[9px] font-black ${
                    wasUsed ? CLUE_TYPE_TEXT_TONES[clue.type] : "text-white/22"
                  }`}
                >
                  {typeCopy.abbr}
                </span>
                <span className="truncate">{clue.value}</span>
              </span>
            );
          })}
        </div>
      </RecallDisclosure>

      {reasoningSteps.length ? (
        <RecallDisclosure
          label={`Reasoning chain · ${reasoningSteps.length} steps`}
          open={showReasoning}
          onToggle={() => setShowReasoning((value) => !value)}
        >
          <div className="overflow-hidden rounded-[12px] border border-white/[0.05] bg-white/[0.025]">
            {reasoningSteps.map((step, index) => (
              <div
                key={`${index}-${step}`}
                className={`flex min-w-0 gap-3 px-3 py-3 ${
                  index < reasoningSteps.length - 1
                    ? "border-b border-white/[0.05]"
                    : ""
                }`}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] bg-[rgba(0,180,166,0.13)] font-brand-mono text-[9px] font-black text-[var(--wardle-color-teal)]">
                  {index + 1}
                </span>
                <p className="min-w-0 break-words text-xs leading-5 text-white/56">
                  {step}
                </p>
              </div>
            ))}
          </div>
        </RecallDisclosure>
      ) : null}

      {differentials.length ? (
        <RecallDisclosure
          label={`Why not · ${differentials.length} ruled out`}
          open={showDifferentials}
          onToggle={() => setShowDifferentials((value) => !value)}
        >
          <div className="space-y-1.5">
            {differentials.map((differential, index) => {
              const title = getDifferentialTitle(differential);
              const reason = getDifferentialReason(differential);
              return (
                <div
                  key={`${title}-${index}`}
                  className="rounded-[12px] border border-white/[0.05] bg-white/[0.025] px-3 py-2.5"
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <p className="min-w-0 break-words text-sm font-bold text-[var(--wardle-color-mint)]">
                      {title}
                    </p>
                    <span className="shrink-0 rounded-full border border-rose-400/[0.2] bg-rose-400/[0.08] px-2 py-0.5 font-brand-mono text-[9px] font-bold uppercase tracking-[0.1em] text-rose-300">
                      Ruled out
                    </span>
                  </div>
                  {reason && (
                    <p className="mt-1.5 break-words text-xs leading-5 text-white/40">
                      {reason}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </RecallDisclosure>
      ) : null}

      <RecallConfidenceRater
        reviewState={reviewState}
        onRate={onRateConfidence}
      />
    </section>
  );
}

export function RecallDisclosure({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between rounded-[11px] border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-left transition hover:bg-white/[0.05]"
      >
        <span className="text-xs font-bold text-white/44">{label}</span>
        <span
          className={`text-xs text-white/28 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
        >
          ›
        </span>
      </button>
      {open && <div className="wardle-learn-fade mt-1.5">{children}</div>}
    </div>
  );
}

// ─── RecallConfidenceRater (REFACTORED) ──────────────────────────────────────

export function RecallConfidenceRater({
  reviewState,
  onRate,
}: {
  reviewState: LearnReviewState;
  onRate: (confidence: LearnConfidence) => void;
}) {
  return (
    <div className="overflow-hidden rounded-[18px] border border-white/[0.08] bg-[#191b2a]">
      <div className="border-b border-white/[0.06] px-4 py-3">
        <p className="font-brand-mono text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">
          How well did you recall this?
        </p>
      </div>

      <div className="grid grid-cols-4 divide-x divide-white/[0.06] p-0">
        {(Object.keys(CONFIDENCE_COPY) as LearnConfidence[]).map(
          (confidence) => (
            <RecallConfidenceButton
              key={confidence}
              confidence={confidence}
              active={reviewState.confidence === confidence}
              onClick={() => onRate(confidence)}
            />
          ),
        )}
      </div>

      {reviewState.nextReviewAt && (
        <div className="wardle-learn-fade flex items-center justify-between border-t border-white/[0.06] px-4 py-2.5">
          <span className="font-brand-mono text-[10px] text-white/30">
            Due in
          </span>
          <span className="font-brand-mono text-[10px] font-bold text-white/60">
            {formatNextReviewDistance(reviewState.nextReviewAt)}
          </span>
        </div>
      )}
    </div>
  );
}

export function formatNextReviewDistance(nextReviewAt: string) {
  const targetTime = Date.parse(nextReviewAt);
  if (!Number.isFinite(targetTime)) return "scheduled";

  const remainingMs = targetTime - Date.now();
  if (remainingMs <= 0) return "now";

  const minutes = Math.ceil(remainingMs / 60000);
  const hours = Math.ceil(minutes / 60);
  const days = Math.ceil(hours / 24);

  if (hours >= 24) return `${days} ${days === 1 ? "day" : "days"}`;
  if (minutes >= 60) return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
}

// ─── RecallConfidenceButton (REFACTORED) ─────────────────────────────────────

export function RecallConfidenceButton({
  confidence,
  active,
  onClick,
}: {
  confidence: LearnConfidence;
  active: boolean;
  onClick: () => void;
}) {
  const copy = CONFIDENCE_COPY[confidence];

  const stripeColor =
    copy.tone === "rose"
      ? "bg-rose-400"
      : copy.tone === "amber"
        ? "bg-[var(--wardle-color-amber)]"
        : copy.tone === "blue"
          ? "bg-blue-400"
          : "bg-[var(--wardle-color-teal)]";

  const markerActive =
    copy.tone === "rose"
      ? "bg-rose-400/[0.18] text-rose-300"
      : copy.tone === "amber"
        ? "bg-[rgba(244,162,97,0.18)] text-[var(--wardle-color-amber)]"
        : copy.tone === "blue"
          ? "bg-blue-400/[0.18] text-blue-300"
          : "bg-[rgba(0,180,166,0.18)] text-[var(--wardle-color-teal)]";

  const labelActive =
    copy.tone === "rose"
      ? "text-rose-300"
      : copy.tone === "amber"
        ? "text-[var(--wardle-color-amber)]"
        : copy.tone === "blue"
          ? "text-blue-300"
          : "text-[var(--wardle-color-teal)]";

  const bgActive =
    copy.tone === "rose"
      ? "bg-rose-400/[0.06]"
      : copy.tone === "amber"
        ? "bg-[rgba(244,162,97,0.06)]"
        : copy.tone === "blue"
          ? "bg-blue-400/[0.06]"
          : "bg-[rgba(0,180,166,0.06)]";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex flex-col items-center gap-2 pb-4 pt-3.5 text-center transition active:scale-[0.97] ${
        active ? bgActive : "hover:bg-white/[0.03]"
      }`}
    >
      {active && (
        <span
          className={`absolute inset-x-0 top-0 h-[2.5px] rounded-b-sm ${stripeColor}`}
        />
      )}

      <span
        className={`flex h-8 w-8 items-center justify-center rounded-full font-brand-mono text-[14px] font-black transition ${
          active ? markerActive : "bg-white/[0.05] text-white/22"
        }`}
      >
        {copy.marker}
      </span>
      <span
        className={`block text-[12px] font-black leading-none transition ${
          active ? labelActive : "text-white/36"
        }`}
      >
        {copy.label}
      </span>
      <span
        className={`block px-1 font-brand-mono text-[9px] leading-[1.3] transition ${
          active ? "text-white/40" : "text-white/18"
        }`}
      >
        {copy.sublabel}
      </span>
    </button>
  );
}

// ─── Desktop header ───────────────────────────────────────────────────────────
