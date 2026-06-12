import type {
  AiDraftDecisionAction,
  ClaimRepairResult,
  DiagnosisEditorialWorkspace,
} from '../../../api/admin';
import { useEffect, useMemo, useState } from 'react';
import StatusBadge from '../../../components/ui/StatusBadge';
import { CompactPanel, DraftAIActionsPanel } from './EditorialPrimitives';
import { formatDate, formatLabel } from './workspaceTransforms';

export function ClaimRepairPanel({
  claims,
  repairs,
  pendingAction,
  targetClaimId,
  targetSectionId,
  onRepairUnsupportedClaim,
  onClaimRepairDecision,
}: {
  claims: NonNullable<
    DiagnosisEditorialWorkspace['unsupportedClaimsBySection']
  >;
  repairs: Record<string, ClaimRepairResult>;
  pendingAction: string | null;
  targetClaimId: string | null;
  targetSectionId: string | null;
  onRepairUnsupportedClaim: (
    claim: NonNullable<
      DiagnosisEditorialWorkspace['unsupportedClaimsBySection']
    >[number],
  ) => void;
  onClaimRepairDecision: (
    claim: { sectionId: string; claimId: string },
    repair: ClaimRepairResult,
    action: AiDraftDecisionAction,
    note?: string,
  ) => void;
}) {
  const blockers = claims.filter((claim) => claim.blocksPublication).length;
  const targetKey = useMemo(() => {
    if (!targetClaimId && !targetSectionId) {
      return null;
    }
    const claim = claims.find((item) => {
      const claimMatches = !targetClaimId || item.claimId === targetClaimId;
      const sectionMatches = !targetSectionId || item.sectionId === targetSectionId;
      return claimMatches && sectionMatches;
    });
    return claim ? claimDomId(claim.sectionId, claim.claimId) : null;
  }, [claims, targetClaimId, targetSectionId]);
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!targetKey) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      setHighlightedKey(targetKey);
      document
        .getElementById(targetKey)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    const timeout = window.setTimeout(() => setHighlightedKey(null), 3500);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [targetKey]);

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
            <ClaimRepairCard
              key={`${claim.sectionId}-${claim.claimId}`}
              claim={claim}
              repair={repairs[claimRepairKey(claim.sectionId, claim.claimId)]}
              pendingAction={pendingAction}
              highlighted={
                highlightedKey === claimDomId(claim.sectionId, claim.claimId)
              }
              onRepairUnsupportedClaim={onRepairUnsupportedClaim}
              onClaimRepairDecision={onClaimRepairDecision}
            />
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

function ClaimRepairCard({
  claim,
  repair,
  pendingAction,
  highlighted,
  onRepairUnsupportedClaim,
  onClaimRepairDecision,
}: {
  claim: NonNullable<
    DiagnosisEditorialWorkspace['unsupportedClaimsBySection']
  >[number];
  repair: ClaimRepairResult | undefined;
  pendingAction: string | null;
  highlighted: boolean;
  onRepairUnsupportedClaim: (
    claim: NonNullable<
      DiagnosisEditorialWorkspace['unsupportedClaimsBySection']
    >[number],
  ) => void;
  onClaimRepairDecision: (
    claim: { sectionId: string; claimId: string },
    repair: ClaimRepairResult,
    action: AiDraftDecisionAction,
    note?: string,
  ) => void;
}) {
  const decisionDisabled =
    pendingAction !== null ||
    !repair ||
    repair.reviewStatus !== 'PENDING_REVIEW';

  return (
    <div
      id={claimDomId(claim.sectionId, claim.claimId)}
      className={[
        'rounded-lg border bg-white/5 p-3 transition',
        highlighted
          ? 'border-[var(--color-amber)] shadow-[0_0_0_2px_rgba(245,158,11,0.25)]'
          : 'border-[var(--color-navy-border)]',
      ].join(' ')}
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={formatLabel(claim.sectionType)} tone="neutral" />
        <StatusBadge
          status={claim.severity}
          tone={claim.blocksPublication ? 'danger' : 'warning'}
        />
        <span className="text-xs text-slate-500">
          {formatDate(claim.createdAt)}
        </span>
      </div>
      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        Original claim
      </p>
      <p className="mt-1 text-sm leading-6 text-slate-200">{claim.claimText}</p>
      {repair ? (
        <div className="mt-3 rounded-lg border border-[var(--color-teal)]/30 bg-[var(--color-teal)]/10 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status="draft repair" tone="info" />
            <StatusBadge
              status={formatLabel(repair.reviewStatus)}
              tone={repair.reviewStatus === 'ACCEPTED' ? 'success' : 'warning'}
            />
            <StatusBadge
              status={`${Math.round(repair.confidence * 100)}% confidence`}
              tone="neutral"
            />
          </div>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            Proposed repair
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-100">
            {repair.proposedClaim || 'No proposed repair text returned.'}
          </p>
          <details className="mt-2 rounded-md border border-[var(--color-navy-border)] bg-white/5 px-3 py-2">
            <summary className="cursor-pointer text-xs font-semibold text-slate-300">
              Evidence and audit details
            </summary>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Evidence used:{' '}
              {repair.evidenceIds.length
                ? repair.evidenceIds.join(', ')
                : 'none linked'}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Audit ID: {repair.auditId ?? repair.repairId ?? repair.revisionId}
            </p>
          </details>
          <div className="mt-3 grid gap-2 sm:grid-cols-4">
            <RepairDecisionButton
              label="Accept"
              disabled={decisionDisabled}
              onClick={() => onClaimRepairDecision(claim, repair, 'accept')}
            />
            <RepairDecisionButton
              label="Reject"
              disabled={decisionDisabled}
              onClick={() => onClaimRepairDecision(claim, repair, 'reject')}
            />
            <RepairDecisionButton
              label="Request changes"
              disabled={decisionDisabled}
              onClick={() =>
                onClaimRepairDecision(claim, repair, 'request-changes')
              }
            />
            <RepairDecisionButton
              label="Supersede"
              disabled={decisionDisabled}
              onClick={() => onClaimRepairDecision(claim, repair, 'supersede')}
            />
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--color-navy-border)] bg-white/4 px-3 py-2">
          <p className="text-xs leading-5 text-slate-500">
            No draft repair has been generated for this claim yet.
          </p>
          <button
            type="button"
            disabled={pendingAction !== null || !claim.repairableAutomatically}
            onClick={() => onRepairUnsupportedClaim(claim)}
            className="rounded-md border border-[var(--color-teal)]/40 px-2.5 py-1 text-xs font-semibold text-[var(--color-teal)] transition hover:bg-[var(--color-teal)]/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Repair claim
          </button>
        </div>
      )}
    </div>
  );
}

function RepairDecisionButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-md border border-[var(--color-navy-border)] px-2 py-1 text-xs font-semibold text-slate-200 transition hover:border-[var(--color-teal)]/50 hover:bg-[var(--color-teal)]/10 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {label}
    </button>
  );
}

function claimRepairKey(sectionId: string, claimId: string) {
  return `${sectionId}:${claimId}`;
}

function claimDomId(sectionId: string, claimId: string) {
  return `unsupported-claim-${encodeURIComponent(sectionId)}-${encodeURIComponent(claimId)}`;
}
