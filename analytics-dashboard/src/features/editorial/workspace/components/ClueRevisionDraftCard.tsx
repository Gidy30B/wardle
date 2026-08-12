import StatusBadge from '../../../../components/ui/StatusBadge.tsx';
import { getSafeReviewActionIds } from '../actions/workspaceReviewActionPolicy.ts';
import type {
  WorkspaceActionAccess,
  WorkspaceActionRequestHandler,
} from '../actions/workspaceActionTypes.ts';
import type { KnowledgeClueRevisionDraft } from '../viewModels/knowledgeGraphViewModel.ts';
import { WorkspaceReviewActionButtons } from './WorkspaceReviewActionButtons.tsx';

type ClueRevisionDraftCardProps = {
  draft: KnowledgeClueRevisionDraft;
  actionAccess: WorkspaceActionAccess;
  pendingAction: string | null;
  onRunAction: WorkspaceActionRequestHandler;
};

export function ClueRevisionDraftCard({
  draft,
  actionAccess,
  pendingAction,
  onRunAction,
}: ClueRevisionDraftCardProps) {
  return (
    <article className="rounded-lg border border-[var(--color-navy-border)] bg-white/[0.03] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-100">
            Clue revision {draft.clueOrder === null ? '' : `#${draft.clueOrder}`}
          </p>
          <p className="mt-1 text-xs text-slate-400">Case {draft.caseId}</p>
        </div>
        <StatusBadge status={draft.status} tone="warning" />
      </div>

      <p className="mt-3 text-sm leading-6 text-slate-300">
        {draft.expectedEffect ?? draft.rationale ?? 'Draft needs editorial review.'}
      </p>

      <WorkspaceReviewActionButtons
        actionIds={getSafeReviewActionIds({
          kind: 'clueRevision',
          sourceId: draft.id,
          status: draft.status,
        })}
        access={actionAccess}
        payload={{ draftId: draft.id }}
        pendingAction={pendingAction}
        subjectId={draft.id}
        subjectLabel={`clue revision for case ${draft.caseId}`}
        onRunAction={onRunAction}
      />
    </article>
  );
}
