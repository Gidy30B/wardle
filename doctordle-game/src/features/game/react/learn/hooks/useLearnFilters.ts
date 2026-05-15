import { useState } from "react";
import { ALL_FILTERS } from "../learn.constants";
import type { LearnFilters } from "../learn.types";

export function useLearnFilters(onChangeFilters: () => void) {
  const [filters, setFilters] = useState<LearnFilters>(ALL_FILTERS);
  const [showArchiveFilters, setShowArchiveFilters] = useState(false);

  const updateFilters = (nextFilters: LearnFilters) => {
    setFilters(nextFilters);
    onChangeFilters();
  };

  return {
    filters,
    setShowArchiveFilters,
    showArchiveFilters,
    updateFilters,
  };
}
