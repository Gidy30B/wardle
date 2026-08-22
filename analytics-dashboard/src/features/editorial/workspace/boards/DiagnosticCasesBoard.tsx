import { CompactPanel } from '../EditorialPrimitives.tsx';
import { BoardEmptyState } from '../components/BoardEmptyState.tsx';
import { BoardVerdict } from '../components/BoardVerdict.tsx';
import { CaseReasoningCard } from '../components/CaseReasoningCard.tsx';
import { ClinicalCaseDraftReviewPacket } from '../components/ClinicalCaseDraftReviewPacket.tsx';
import { ClueRevisionDraftCard } from '../components/ClueRevisionDraftCard.tsx';
import type {
  WorkspaceActionAccess,
  WorkspaceActionRequestHandler,
} from '../actions/workspaceActionTypes.ts';
import type { DiagnosticCasesBoardViewModel } from '../viewModels/editorialWorkflowViewModel.ts';

export function DiagnosticCasesBoard({
  board,
  actionAccess,
  pendingAction,
  onRunAction,
}: {
  board: DiagnosticCasesBoardViewModel;
  actionAccess: WorkspaceActionAccess;
  pendingAction: string | null;
  onRunAction: WorkspaceActionRequestHandler;
}) {
  return (
    <div className="space-y-4">
      <BoardVerdict
        eyebrow={board.label}
        question={board.question}
        verdict={board.verdict}
        detail="Each case must demonstrate its diagnostic reasoning objective."
        tone={board.tone}
      />

      <CompactPanel title="Clinical case inventory">
        {board.cases.length ? (
          <div className="space-y-3">
            {board.cases.map((caseItem) => (
              <CaseReasoningCard key={caseItem.id} caseItem={caseItem} />
            ))}
          </div>
        ) : (
          <BoardEmptyState
            title="No clinical cases projected"
            detail="Clinical case coverage will appear once cases are assigned to this diagnosis."
          />
        )}
      </CompactPanel>

      <CompactPanel
        title="Clinical Case Draft review packets"
        subtitle="Draft review is separate from controlled application into CaseRevision #1."
      >
        {board.clinicalCaseDraftPackets.length ? (
          <div className="space-y-3">
            {board.clinicalCaseDraftPackets.map((packet) => (
              <ClinicalCaseDraftReviewPacket
                key={packet.id}
                packet={packet}
                actionAccess={actionAccess}
                pendingAction={pendingAction}
                onRunAction={onRunAction}
              />
            ))}
          </div>
        ) : (
          <BoardEmptyState
            title="No Clinical Case Drafts"
            detail="Generated Clinical Case Drafts will appear here before they become governed Cases."
          />
        )}
      </CompactPanel>

      {board.clueRevisionDrafts.length ? (
        <CompactPanel
          title="Pending clue revision drafts"
          subtitle="Review decisions only — applying a revision remains deferred."
        >
          <div className="space-y-3">
            {board.clueRevisionDrafts.map((draft) => (
              <ClueRevisionDraftCard
                key={draft.id}
                draft={draft}
                actionAccess={actionAccess}
                pendingAction={pendingAction}
                onRunAction={onRunAction}
              />
            ))}
          </div>
        </CompactPanel>
      ) : null}
    </div>
  );
}
