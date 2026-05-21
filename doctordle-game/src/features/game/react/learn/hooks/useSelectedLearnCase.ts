import { useCallback, useEffect, useMemo } from "react";
import type { LearnLibraryCase } from "../../../game.types";
import type { DetailTab } from "../learn.types";

export function useSelectedLearnCase({
  completedCases,
  filteredCases,
  selectedCaseId,
  setActiveTab,
  setSelectedCaseId,
  setStudyQueueCaseIds,
  setStudyQueueIndex,
}: {
  completedCases: LearnLibraryCase[];
  filteredCases: LearnLibraryCase[];
  selectedCaseId: string | null;
  setActiveTab: (tab: DetailTab) => void;
  setSelectedCaseId: (id: string | null) => void;
  setStudyQueueCaseIds: (ids: string[] | null) => void;
  setStudyQueueIndex: (index: number) => void;
}) {
  const matchesSelectedCase = useCallback(
    (item: LearnLibraryCase) =>
      item.dailyCaseId === selectedCaseId || item.case.id === selectedCaseId,
    [selectedCaseId],
  );

  const selectedCase = useMemo(
    () => completedCases.find(matchesSelectedCase) ?? null,
    [completedCases, matchesSelectedCase],
  );
  const activeCase = selectedCase ?? filteredCases[0] ?? null;

  useEffect(() => {
    if (!filteredCases.length) {
      setSelectedCaseId(null);
      setStudyQueueCaseIds(null);
      setStudyQueueIndex(0);
      return;
    }
    if (
      selectedCaseId &&
      !filteredCases.some(matchesSelectedCase)
    ) {
      setSelectedCaseId(null);
      setActiveTab("breakdown");
    }
  }, [
    filteredCases,
    matchesSelectedCase,
    selectedCaseId,
    setActiveTab,
    setSelectedCaseId,
    setStudyQueueCaseIds,
    setStudyQueueIndex,
  ]);

  return { activeCase, selectedCase };
}
