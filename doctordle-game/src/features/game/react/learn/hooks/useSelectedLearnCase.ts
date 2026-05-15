import { useEffect, useMemo } from "react";
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
  const selectedCase = useMemo(
    () =>
      completedCases.find((item) => item.dailyCaseId === selectedCaseId) ??
      null,
    [completedCases, selectedCaseId],
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
      !filteredCases.some((item) => item.dailyCaseId === selectedCaseId)
    ) {
      setSelectedCaseId(null);
      setActiveTab("breakdown");
    }
  }, [
    filteredCases,
    selectedCaseId,
    setActiveTab,
    setSelectedCaseId,
    setStudyQueueCaseIds,
    setStudyQueueIndex,
  ]);

  return { activeCase, selectedCase };
}
