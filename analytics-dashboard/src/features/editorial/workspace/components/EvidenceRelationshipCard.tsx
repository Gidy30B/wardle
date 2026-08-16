import StatusBadge from '../../../../components/ui/StatusBadge';
import type { KnowledgeEvidenceRelationship } from '../viewModels/knowledgeGraphViewModel.ts';
import { getSafeReviewActionIds } from '../actions/workspaceReviewActionPolicy.ts';
import type {
  WorkspaceActionAccess,
  WorkspaceActionRequestHandler,
} from '../actions/workspaceActionTypes.ts';
import { WorkspaceReviewActionButtons } from './WorkspaceReviewActionButtons.tsx';

export function EvidenceRelationshipCard({
  relationship,
  actionAccess,
  pendingAction,
  onRunAction,
}: {
  relationship: KnowledgeEvidenceRelationship;
  actionAccess: WorkspaceActionAccess;
  pendingAction: string | null;
  onRunAction: WorkspaceActionRequestHandler;
}) {
  return (
    <article className="rounded-lg border border-[var(--color-navy-border)] bg-white/[0.03] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-100">
            {relationship.label}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            {relationship.relationshipType}
            {relationship.targetDiagnosisName
              ? ` · ${relationship.targetDiagnosisName}`
              : ''}
          </p>
        </div>
        <StatusBadge
          status={relationship.status}
          tone={relationship.isLowTrust ? 'warning' : 'info'}
        />
      </div>

      {relationship.reasoningSummary ? (
        <p className="mt-3 text-sm leading-6 text-slate-300">
          {relationship.reasoningSummary}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Metric label="Trust" value={relationship.trust} />
        <Metric label="Strength" value={relationship.strength.toFixed(2)} />
        <Metric
          label="Discriminator"
          value={relationship.discriminatorWeight.toFixed(2)}
        />
      </div>

      <WorkspaceReviewActionButtons
        actionIds={getSafeReviewActionIds({
          kind: 'evidenceRelationship',
          sourceId: relationship.id,
          status: relationship.status,
        })}
        access={actionAccess}
        payload={{ relationshipId: relationship.id }}
        pendingAction={pendingAction}
        subjectId={relationship.id}
        subjectLabel={relationship.label}
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
