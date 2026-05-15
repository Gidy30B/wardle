import { CONFIDENCE_REVIEW_DAYS, LEARN_REVIEW_STORAGE_KEY } from "./learn.constants";
import type { LearnConfidence, LearnReviewStateByCaseKey } from "./learn.types";

export const learnTypeContracts = {
  confidenceReviewDays: CONFIDENCE_REVIEW_DAYS satisfies Record<
    LearnConfidence,
    number
  >,
  emptyReviewStateByCaseKey: {} satisfies LearnReviewStateByCaseKey,
  reviewStorageKey: LEARN_REVIEW_STORAGE_KEY satisfies "wardle.learn.review.v1",
};
