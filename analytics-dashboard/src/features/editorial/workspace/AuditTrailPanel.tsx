import type {
  AiDraftDecisionAction,
  DiagnosisEditorialWorkspace,
} from '../../../api/admin';
import StatusBadge from '../../../components/ui/StatusBadge';
import type { StatusBadgeTone } from '../../../components/ui/statusBadgeMeta';
import { CompactPanel } from './EditorialPrimitives';
import { formatDate, formatLabel } from './workspaceTransforms';

export function AuditTrailPanel({
  audits,
  onDecision,
}: {
  audits: NonNullable<DiagnosisEditorialWorkspace['aiDraftAuditTrail']>;
  onDecision: (
    auditId: string,
    action: AiDraftDecisionAction,
    note?: string,
  ) => void;
}) {
  const pendingCount = audits.filter(isPendingAudit).length;
  return (
    <CompactPanel
      title="Draft audit trail"
      subtitle="AI draft actions, editor decisions, and coverage annotations."
      action={
        audits.length ? (
          <StatusBadge
            status={`${pendingCount} pending`}
            tone={pendingCount ? 'warning' : 'success'}
          />
        ) : null
      }
    >
      {audits.length ? (
        <div className="space-y-2">
          {audits.slice(0, 4).map((audit) => (
            <div
              key={audit.id}
              className="rounded-lg border border-[var(--color-navy-border)] bg-white/5 p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={formatLabel(audit.actionType)} tone="info" />
                <StatusBadge
                  status={formatLabel(audit.reviewStatus)}
                  tone={draftAuditTone(audit.reviewStatus)}
                />
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-400">
                Draft created for {formatLabel(audit.affectedArtifactType)} and
                {audit.reviewStatus === 'PENDING_REVIEW' ||
                audit.reviewStatus === 'REVIEW_REQUIRED'
                  ? ' awaiting editor review.'
                  : ` marked ${formatLabel(audit.reviewStatus)}.`}
              </p>
              {audit.reviewNote ? (
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Note: {audit.reviewNote}
                </p>
              ) : null}
              {audit.decisionAt ? (
                <p className="mt-1 text-xs text-slate-500">
                  Decided {formatDate(audit.decisionAt)}
                </p>
              ) : null}
              <p className="mt-1 text-xs text-slate-500">
                {formatDate(audit.createdAt)}
              </p>
              {isPendingAudit(audit) ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <AuditDecisionButton
                    label="Accept"
                    onClick={() => onDecision(audit.id, 'accept')}
                  />
                  <AuditDecisionButton
                    label="Reject"
                    onClick={() => onDecision(audit.id, 'reject')}
                  />
                  <AuditDecisionButton
                    label="Changes"
                    onClick={() =>
                      onDecision(audit.id, 'request-changes', 'Needs changes.')
                    }
                  />
                  <AuditDecisionButton
                    label="Supersede"
                    onClick={() =>
                      onDecision(
                        audit.id,
                        'supersede',
                        'Superseded by newer draft.',
                      )
                    }
                  />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm leading-6 text-slate-500">
          Draft actions will appear here after generation or repair workflows
          create review-required output.
        </p>
      )}
    </CompactPanel>
  );
}

function isPendingAudit(
  audit: NonNullable<DiagnosisEditorialWorkspace['aiDraftAuditTrail']>[number],
) {
  return (
    audit.reviewStatus === 'PENDING_REVIEW' ||
    audit.reviewStatus === 'REVIEW_REQUIRED'
  );
}

function draftAuditTone(status: string): StatusBadgeTone {
  if (status === 'ACCEPTED') return 'success';
  if (status === 'REJECTED') return 'danger';
  if (status === 'NEEDS_CHANGES' || status === 'PENDING_REVIEW') {
    return 'warning';
  }
  if (status === 'SUPERSEDED') return 'neutral';
  return 'info';
}

function AuditDecisionButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="editorial-action px-2 py-1"
    >
      {label}
    </button>
  );
}
