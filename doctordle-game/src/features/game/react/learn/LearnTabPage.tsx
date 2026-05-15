import { useMemo, useState } from "react";
import type {
  LearnLibraryCase,
} from "../../game.types";

import type {
  DetailTab,
  LearnReviewState,
  LearnTabPageProps,
} from "./learn.types";
import { useLearnFilters } from "./hooks/useLearnFilters";
import { useLearnSummary } from "./hooks/useLearnSummary";
import { useRecallQueue } from "./hooks/useRecallQueue";
import { useReviewPersistence } from "./hooks/useReviewPersistence";
import { useSelectedLearnCase } from "./hooks/useSelectedLearnCase";
import {
  ArchiveControls,
  ArchiveEmptyState,
  CaseLibraryList,
  DesktopLearnHeader,
  MobileCaseArchive,
  MobileLearnHeader,
  MobileSpecialtyCasesScreen,
  MobileStatsBar,
} from "./archive";
import { InlineNotice } from "./archive/shared";
import { CaseDetail, MobileCaseDetail } from "./detail";
import { AdaptiveRecallQueueController } from "./recall/components";
import {
  buildAdaptiveRecallQueue,
  createEmptyLearnReviewState,
  filterLearnCases,
  getCaseSpecialty,
  getLearnReviewCaseKey,
  mergeLatestPlayedCase,
  titleCase,
} from "./domain/learnDomain";
// ─── Root page ────────────────────────────────────────────────────────────────

export default function LearnTabPage({
  explanation,
  latestResult,
  latestPlayedExplanation,
  latestPlayedResult,
  learnLibrary,
  libraryLoading,
  libraryError,
  roundViewModel,
}: LearnTabPageProps) {
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>("breakdown");
  const [studyQueueCaseIds, setStudyQueueCaseIds] = useState<string[] | null>(
    null,
  );
  const [studyQueueIndex, setStudyQueueIndex] = useState(0);
  const [reviewStateByCaseKey, setReviewStateByCaseKey] =
    useReviewPersistence();
  const [selectedMobileSpecialty, setSelectedMobileSpecialty] = useState<
    string | null
  >(null);

  const resetLearnSelection = () => {
    setSelectedCaseId(null);
    setActiveTab("breakdown");
    setStudyQueueCaseIds(null);
    setStudyQueueIndex(0);
    setSelectedMobileSpecialty(null);
  };
  const {
    filters,
    setShowArchiveFilters,
    showArchiveFilters,
    updateFilters,
  } = useLearnFilters(resetLearnSelection);

  const completedCases = useMemo(
    () =>
      mergeLatestPlayedCase({
        libraryCases: learnLibrary?.cases ?? [],
        explanation,
        latestResult,
        latestPlayedExplanation,
        latestPlayedResult,
        roundViewModel,
      }),
    [
      explanation,
      latestPlayedExplanation,
      latestPlayedResult,
      latestResult,
      learnLibrary,
      roundViewModel,
    ],
  );

  const filteredCases = useMemo(
    () => filterLearnCases(completedCases, filters),
    [completedCases, filters],
  );
  const { displayedSummary, filterOptions } = useLearnSummary({
    completedCases,
    filteredCases,
    filters,
    learnLibrary,
  });
  const { dueReviewCases, missedCases, studyQueueCases } = useRecallQueue({
    completedCases,
    reviewStateByCaseKey,
    setStudyQueueCaseIds,
    setStudyQueueIndex,
    studyQueueCaseIds,
    studyQueueIndex,
  });
  const selectedMobileSpecialtyCases = useMemo(
    () =>
      selectedMobileSpecialty
        ? completedCases.filter(
            (item) => getCaseSpecialty(item).key === selectedMobileSpecialty,
          )
        : [],
    [completedCases, selectedMobileSpecialty],
  );
  const selectedMobileSpecialtySummary = selectedMobileSpecialty
    ? (displayedSummary.specialties.find(
        (specialty) => specialty.key === selectedMobileSpecialty,
      ) ?? null)
    : null;

  const { activeCase, selectedCase } = useSelectedLearnCase({
    completedCases,
    filteredCases,
    selectedCaseId,
    setActiveTab,
    setSelectedCaseId,
    setStudyQueueCaseIds,
    setStudyQueueIndex,
  });

  const selectCase = (dailyCaseId: string) => {
    setStudyQueueCaseIds(null);
    setStudyQueueIndex(0);
    setSelectedCaseId(dailyCaseId);
    setSelectedMobileSpecialty(null);
    setActiveTab("breakdown");
  };

  const clearSelectedCase = () => {
    setSelectedCaseId(null);
    setActiveTab("breakdown");
    setStudyQueueCaseIds(null);
    setStudyQueueIndex(0);
  };

  const clearSelectedMobileSpecialty = () => {
    setSelectedMobileSpecialty(null);
    setSelectedCaseId(null);
    setActiveTab("breakdown");
  };

  const startDueReviewQueue = () => {
    if (!dueReviewCases.length) return;
    const queueCaseIds = buildAdaptiveRecallQueue(
      dueReviewCases,
      reviewStateByCaseKey,
    ).map((item) => item.dailyCaseId);
    setStudyQueueCaseIds(queueCaseIds);
    setStudyQueueIndex(0);
    setSelectedCaseId(null);
    setActiveTab("breakdown");
  };

  const exitStudyQueue = () => {
    setStudyQueueCaseIds(null);
    setStudyQueueIndex(0);
  };

  const updateReviewState = (
    item: LearnLibraryCase,
    updater: (current: LearnReviewState) => LearnReviewState,
  ) => {
    const key = getLearnReviewCaseKey(item);
    setReviewStateByCaseKey((current) => ({
      ...current,
      [key]: updater(current[key] ?? createEmptyLearnReviewState()),
    }));
  };

  return (
    <>
      {/* ── Mobile ── */}
      <main className="flex h-full min-h-0 w-full max-w-full flex-1 basis-0 flex-col overflow-x-hidden overflow-y-auto overscroll-contain bg-[var(--wardle-color-charcoal)] pb-8 lg:hidden">
        {studyQueueCaseIds && studyQueueCases.length > 0 ? (
          <AdaptiveRecallQueueController
            queue={studyQueueCases}
            reviewStateByCaseKey={reviewStateByCaseKey}
            studyQueueIndex={studyQueueIndex}
            onChangeIndex={setStudyQueueIndex}
            onExit={exitStudyQueue}
            onUpdateReviewState={updateReviewState}
          />
        ) : selectedMobileSpecialty ? (
          <MobileSpecialtyCasesScreen
            specialtyLabel={
              selectedMobileSpecialtySummary?.label ??
              titleCase(selectedMobileSpecialty)
            }
            cases={selectedMobileSpecialtyCases}
            dueReviewCount={
              dueReviewCases.filter(
                (item) =>
                  getCaseSpecialty(item).key === selectedMobileSpecialty,
              ).length
            }
            onBack={clearSelectedMobileSpecialty}
            onSelectCase={selectCase}
            onStartDueReviewQueue={() => {
              const dueCases = dueReviewCases.filter(
                (item) =>
                  getCaseSpecialty(item).key === selectedMobileSpecialty,
              );
              if (!dueCases.length) return;
              const queueCaseIds = buildAdaptiveRecallQueue(
                dueCases,
                reviewStateByCaseKey,
              ).map((item) => item.dailyCaseId);
              setStudyQueueCaseIds(queueCaseIds);
              setStudyQueueIndex(0);
              setSelectedCaseId(null);
              setSelectedMobileSpecialty(null);
              setActiveTab("breakdown");
            }}
          />
        ) : !selectedCase ? (
          <>
            <MobileLearnHeader />
            <MobileStatsBar
              summary={displayedSummary}
              loading={libraryLoading}
              error={libraryError}
            />
            <MobileCaseArchive
              cases={completedCases}
              completedCount={completedCases.length}
              summary={displayedSummary}
              missedCount={missedCases.length}
              dueReviewCount={dueReviewCases.length}
              dueReviewCases={dueReviewCases}
              onSelectSpecialty={setSelectedMobileSpecialty}
              onStartDueReviewQueue={startDueReviewQueue}
              loading={libraryLoading}
            />
          </>
        ) : (
          <MobileCaseDetail
            item={selectedCase}
            activeTab={activeTab}
            onChangeTab={setActiveTab}
            onBack={clearSelectedCase}
          />
        )}
      </main>

      {/* ── Desktop ── */}
      <main className="hidden h-full min-h-0 w-full max-w-full flex-1 basis-0 flex-col overflow-x-hidden overflow-y-auto overscroll-contain px-1 pb-6 pt-1 sm:px-2 lg:flex">
        <div className="min-w-0 max-w-full space-y-5 overflow-x-hidden">
          <DesktopLearnHeader summary={displayedSummary} />

          {libraryError ? (
            <InlineNotice tone="error" copy="Unable to load completed cases." />
          ) : null}
          {libraryLoading ? (
            <InlineNotice tone="muted" copy="Loading completed cases..." />
          ) : null}

          <ArchiveControls
            visibleCount={filteredCases.length}
            completedCount={completedCases.length}
            filterOptions={filterOptions}
            filters={filters}
            showAdvancedFilters={showArchiveFilters}
            onChangeFilters={updateFilters}
            onToggleAdvancedFilters={() => setShowArchiveFilters((v) => !v)}
          />

          {filteredCases.length > 0 ? (
            <div className="grid min-w-0 grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] gap-4">
              <CaseLibraryList
                cases={filteredCases}
                selectedCaseId={activeCase?.dailyCaseId ?? null}
                onSelectCase={selectCase}
              />
              <CaseDetail
                item={activeCase}
                activeTab={activeTab}
                onChangeTab={setActiveTab}
                onBack={clearSelectedCase}
              />
            </div>
          ) : (
            <ArchiveEmptyState
              completedCount={completedCases.length}
              loading={libraryLoading}
            />
          )}
        </div>
      </main>
    </>
  );
}

