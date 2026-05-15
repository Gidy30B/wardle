import { useEffect, useState } from "react";
import {
  readLearnReviewState,
  writeLearnReviewState,
} from "../storage/learnReviewStorage";
import type { LearnReviewStateByCaseKey } from "../learn.types";

export function useReviewPersistence() {
  const [reviewStateByCaseKey, setReviewStateByCaseKey] =
    useState<LearnReviewStateByCaseKey>(readLearnReviewState);

  useEffect(() => {
    writeLearnReviewState(reviewStateByCaseKey);
  }, [reviewStateByCaseKey]);

  return [reviewStateByCaseKey, setReviewStateByCaseKey] as const;
}
