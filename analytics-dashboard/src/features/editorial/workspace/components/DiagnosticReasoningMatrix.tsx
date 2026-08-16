import type { DiagnosticComparison } from '../viewModels/diagnosticReasoningViewModel.ts';
import { BoardEmptyState } from './BoardEmptyState.tsx';
import { MimicComparisonCard } from './MimicComparisonCard.tsx';

export function DiagnosticReasoningMatrix({
  comparisons,
}: {
  comparisons: DiagnosticComparison[];
}) {
  if (!comparisons.length) {
    return (
      <BoardEmptyState
        title="No diagnostic comparisons yet"
        detail="The reasoning layer has not projected why the target diagnosis beats its mimics."
      />
    );
  }

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {comparisons.map((comparison) => (
        <MimicComparisonCard
          key={comparison.id}
          comparison={comparison}
        />
      ))}
    </div>
  );
}
