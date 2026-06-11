import type {
  ClaimRepairResult,
  DiagnosisEditorialWorkspace,
} from '../../../api/admin';
import StatusBadge from '../../../components/ui/StatusBadge';
import { CompactPanel, DraftAIActionsPanel } from './EditorialPrimitives';
import { formatDate, formatLabel } from './workspaceTransforms';

export function ClaimRepairPanel({
  claims,
  latestRepair,
  pendingAction,
  onRepairUnsupportedClaim,
}: {
  claims: NonNullable<
    DiagnosisEditorialWorkspace['unsupportedClaimsBySection']
  >;
  latestRepair: ClaimRepairResult | null;
  pendingAction: string | null;
  onRepairUnsupportedClaim: (
    claim: NonNullable<
      DiagnosisEditorialWorkspace['unsupportedClaimsBySection']
    >[number],
  ) => void;
}) {
  const blockers = claims.filter((claim) => claim.blocksPublication).length;

  return (
    <CompactPanel title="Unsupported claims">
      {claims.length ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={`${claims.length} signals`} tone="warning" />
            <StatusBadge
              status={`${blockers} blockers`}
              tone={blockers ? 'danger' : 'success'}
            />
          </div>
          {claims.slice(0, 6).map((claim) => (
            <div
              key={`${claim.sectionId}-${claim.claimId}`}
              className="rounded-lg border border-[var(--color-navy-border)] bg-white/5 p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge
                  status={formatLabel(claim.sectionType)}
                  tone="neutral"
                />
                <StatusBadge
                  status={claim.severity}
                  tone={claim.blocksPublication ? 'danger' : 'warning'}
                />
                <span className="text-xs text-slate-500">
                  {formatDate(claim.createdAt)}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-200">
                {claim.claimText}
              </p>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Evidence IDs:{' '}
                {claim.evidenceIds.length
                  ? claim.evidenceIds.join(', ')
                  : 'none linked'}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-[var(--color-navy-border)] bg-white/5 p-3">
          <p className="text-sm font-semibold text-slate-100">
            No unsupported claim signals are currently attached.
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            Run draft validation after regeneration to keep section claims
            traceable to evidence before accepting new content.
          </p>
        </div>
      )}
      {latestRepair ? (
        <div className="rounded-lg border border-[var(--color-teal)]/30 bg-[var(--color-teal)]/10 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status="draft repair" tone="info" />
            <StatusBadge
              status={formatLabel(latestRepair.reviewStatus)}
              tone="warning"
            />
          </div>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            Proposed claim
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-100">
            {latestRepair.proposedClaim}
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Evidence used:{' '}
            {latestRepair.evidenceIds.length
              ? latestRepair.evidenceIds.join(', ')
              : 'none linked'}{' '}
            - Confidence {Math.round(latestRepair.confidence * 100)}%
          </p>
        </div>
      ) : null}
      <DraftAIActionsPanel
        actions={claims.slice(0, 4).map((claim) => ({
          id: `repair-${claim.claimId}`,
          label: 'Repair unsupported claim',
          detail: `${formatLabel(claim.sectionType)}: ${claim.claimText}`,
          disabled: pendingAction !== null || !claim.repairableAutomatically,
          onAction: () => onRepairUnsupportedClaim(claim),
        }))}
        empty="No unsupported claims need draft repair."
      />
    </CompactPanel>
  );
}
