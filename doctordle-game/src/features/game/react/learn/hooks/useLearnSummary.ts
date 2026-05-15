import { useMemo } from "react";
import type { LearnLibraryCase, LearnLibraryResponse } from "../../../game.types";
import type { LearnFilters } from "../learn.types";
import {
  buildLearnFilterOptions,
  deriveLearnPerformanceSummary,
  getLearnPerformanceSummary,
  hasActiveFilters,
} from "../domain/learnSummary";

export function useLearnSummary({
  completedCases,
  filteredCases,
  filters,
  learnLibrary,
}: {
  completedCases: LearnLibraryCase[];
  filteredCases: LearnLibraryCase[];
  filters: LearnFilters;
  learnLibrary: LearnLibraryResponse | null;
}) {
  const filterOptions = useMemo(
    () => buildLearnFilterOptions(completedCases),
    [completedCases],
  );
  const unfilteredSummary = useMemo(
    () => getLearnPerformanceSummary(learnLibrary, completedCases),
    [completedCases, learnLibrary],
  );
  const displayedSummary = useMemo(
    () =>
      hasActiveFilters(filters)
        ? deriveLearnPerformanceSummary(filteredCases)
        : unfilteredSummary,
    [filteredCases, filters, unfilteredSummary],
  );

  return { displayedSummary, filterOptions, unfilteredSummary };
}
