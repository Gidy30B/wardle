import { CompactPanel } from '../EditorialPrimitives.tsx';
import { BoardEmptyState } from '../components/BoardEmptyState.tsx';
import { BoardVerdict } from '../components/BoardVerdict.tsx';
import { EvidenceRelationshipCard } from '../components/EvidenceRelationshipCard.tsx';
import type { EvidenceBoardViewModel } from '../viewModels/editorialWorkflowViewModel.ts';
import type {
  WorkspaceActionAccess,
  WorkspaceActionRequestHandler,
} from '../actions/workspaceActionTypes.ts';

export function EvidenceBoard({
  board,
  actionAccess,
  pendingAction,
  onRunAction,
}: {
  board: EvidenceBoardViewModel;
  actionAccess: WorkspaceActionAccess;
  pendingAction: string | null;
  onRunAction: WorkspaceActionRequestHandler;
}) {
  const relationships = [
    ...board.activeRelationships,
    ...board.candidateRelationships,
    ...board.lowTrustRelationships.filter(
      (lowTrust) =>
        !board.activeRelationships.some((item) => item.id === lowTrust.id) &&
        !board.candidateRelationships.some((item) => item.id === lowTrust.id),
    ),
  ];

  return (
    <div className="space-y-4">
      <BoardVerdict
        eyebrow={board.label}
        question={board.question}
        verdict={board.verdict}
        detail={`Coverage tier: ${board.coverage.tier ?? 'not scored'}; ${board.unsupportedClaims.length} unsupported claim(s).`}
        tone={board.tone}
      />

      <CompactPanel title="Evidence relationships" subtitle="Evidence grounds diagnostic claims; not the primary teaching focus.">
        {relationships.length ? (
          <div className="space-y-3">
            {relationships.map((relationship) => (
              <EvidenceRelationshipCard
                key={relationship.id}
                relationship={relationship}
                actionAccess={actionAccess}
                pendingAction={pendingAction}
                onRunAction={onRunAction}
              />
            ))}
          </div>
        ) : (
          <BoardEmptyState
            title="No evidence support projected"
            detail="Evidence relationships will appear once the knowledge layer projects evidence support."
          />
        )}
      </CompactPanel>
    </div>
  );
}
