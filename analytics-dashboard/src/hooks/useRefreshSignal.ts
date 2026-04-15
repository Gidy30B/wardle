import { useState } from 'react';

export function useRefreshSignal() {
  const [refreshSignal, setRefreshSignal] = useState(0);

  return {
    refreshSignal,
    // Include refreshSignal in fetch effect dependencies and call requestRefresh
    // after a successful mutation to keep page-local refresh behavior consistent.
    requestRefresh() {
      setRefreshSignal((currentSignal) => currentSignal + 1);
    },
  };
}
