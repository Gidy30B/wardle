import StatusBadge from '../../../../components/ui/StatusBadge';
import type { KnowledgeReasoningPath } from '../viewModels/knowledgeGraphViewModel.ts';
import { getSafeReviewActionIds } from '../actions/workspaceReviewActionPolicy.ts';
import type {
  WorkspaceActionAccess,
  WorkspaceActionRequestHandler,
} from '../actions/workspaceActionTypes.ts';
import { WorkspaceReviewActionButtons } from './WorkspaceReviewActionButtons.tsx';

export function ReasoningPathCard({
  path,
  actionAccess,
  pendingAction,
  onRunAction,
}: {
  path: KnowledgeReasoningPath;
  actionAccess: WorkspaceActionAccess;
  pendingAction: string | null;
  onRunAction: WorkspaceActionRequestHandler;
}) {
  return (
    <article className="rounded-lg border border-[var(--color-navy-border)] bg-white/[0.03] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-100">{path.title}</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            {path.generationPurpose} · {path.reasoningGoal}
          </p>
        </div>
        <StatusBadge
          status={path.readinessTier}
          tone={path.isWeak ? 'warning' : path.isGenerationReady ? 'success' : 'info'}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Metric label="Score" value={path.readinessScore.toFixed(2)} />
        <Metric label="Evidence" value={String(path.supportingEvidenceRelationshipIds.length)} />
        <Metric label="Teaching links" value={String(path.supportingTeachingRelationshipIds.length)} />
      </div>

      {path.requiredTeachingPoints.length ? (
        <p className="mt-3 text-xs leading-5 text-slate-400">
          {path.requiredTeachingPoints[0]}
        </p>
      ) : null}

      <WorkspaceReviewActionButtons
        actionIds={getSafeReviewActionIds({
          kind: 'reasoningPath',
          sourceId: path.id,
          status: path.status,
        })}
        access={actionAccess}
        payload={{ reasoningPathId: path.id }}
        pendingAction={pendingAction}
        subjectId={path.id}
        subjectLabel={path.title}
        onRunAction={onRunAction}
      />
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-slate-400">
      {label}: {value}
    </span>
  );
}
