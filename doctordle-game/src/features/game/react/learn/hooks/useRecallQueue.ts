import { useEffect, useMemo } from "react";
import type { LearnLibraryCase } from "../../../game.types";
import type { LearnReviewStateByCaseKey } from "../learn.types";
import { getDueReviewCases, getMissedCases } from "../recall/domain/recallQueue";

export function useRecallQueue({
  completedCases,
  reviewStateByCaseKey,
  setStudyQueueCaseIds,
  setStudyQueueIndex,
  studyQueueCaseIds,
  studyQueueIndex,
}: {
  completedCases: LearnLibraryCase[];
  reviewStateByCaseKey: LearnReviewStateByCaseKey;
  setStudyQueueCaseIds: (ids: string[] | null) => void;
  setStudyQueueIndex: (index: number) => void;
  studyQueueCaseIds: string[] | null;
  studyQueueIndex: number;
}) {
  const missedCases = useMemo(
    () => getMissedCases(completedCases),
    [completedCases],
  );
  const dueReviewCases = useMemo(
    () => getDueReviewCases(completedCases, reviewStateByCaseKey),
    [completedCases, reviewStateByCaseKey],
  );
  const studyQueueCases = useMemo(() => {
    if (!studyQueueCaseIds) return [];
    const caseById = new Map(
      completedCases.map((item) => [item.dailyCaseId, item]),
    );
    return studyQueueCaseIds
      .map((id) => caseById.get(id))
      .filter((item): item is LearnLibraryCase => item !== undefined);
  }, [completedCases, studyQueueCaseIds]);

  useEffect(() => {
    if (!studyQueueCaseIds) return;
    if (!studyQueueCases.length) {
      setStudyQueueCaseIds(null);
      setStudyQueueIndex(0);
      return;
    }
    if (studyQueueIndex >= studyQueueCases.length) {
      setStudyQueueIndex(Math.max(0, studyQueueCases.length - 1));
    }
  }, [
    setStudyQueueCaseIds,
    setStudyQueueIndex,
    studyQueueCaseIds,
    studyQueueCases.length,
    studyQueueIndex,
  ]);

  return { dueReviewCases, missedCases, studyQueueCases };
}
