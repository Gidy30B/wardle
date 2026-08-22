import StatusBadge from '../../../../components/ui/StatusBadge';
import type { CaseReasoningCardViewModel } from '../viewModels/caseReasoningViewModel.ts';
import { toneToBadge } from './BoardVerdict.tsx';
import { CaseTeachingRiskCard } from './CaseTeachingRiskCard.tsx';

export function CaseReasoningCard({
  caseItem,
}: {
  caseItem: CaseReasoningCardViewModel;
}) {
  return (
    <article className="rounded-lg border border-[var(--color-navy-border)] bg-white/[0.03] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-100">
            {caseItem.title}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            {caseItem.status} · {caseItem.difficulty}
          </p>
        </div>
        <StatusBadge
          status={caseItem.quality}
          tone={toneToBadge(caseItem.tone)}
        />
      </div>

      <p className="mt-3 text-sm leading-6 text-slate-300">
        {caseItem.reasoningObjective}
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Metric label="Goals" value={caseItem.linkedLearningGoals.length} />
        <Metric label="Discriminators" value={caseItem.linkedDiscriminators.length} />
        <Metric label="Comparisons" value={caseItem.linkedComparisonIds.length} />
        <Metric label="Confidence" value={caseItem.reasoningConfidence} />
      </div>

      {caseItem.revisionGovernance ? (
        <div className="mt-3 grid gap-2 border-t border-white/10 pt-3 sm:grid-cols-2">
          <GovernanceMetric
            label="Revision"
            value={
              caseItem.revisionGovernance.currentRevision
                ? `#${caseItem.revisionGovernance.currentRevision.revisionNumber}`
                : 'missing'
            }
          />
          <GovernanceMetric
            label="APP-006"
            value={
              caseItem.revisionGovernance.app006Approval.approved
                ? 'approved'
                : caseItem.revisionGovernance.review.activeReviewId
                  ? 'in review'
                  : 'needs review'
            }
          />
          <GovernanceMetric
            label="APP-008A"
            value={
              caseItem.revisionGovernance.publication.authorized
                ? 'authorized'
                : (caseItem.revisionGovernance.publication.readiness?.result ??
                  'not ready')
            }
          />
          <GovernanceMetric
            label="APP-008B"
            value={
              caseItem.revisionGovernance.scheduling.scheduled
                ? `${caseItem.revisionGovernance.scheduling.dailyCases.length} binding(s)`
                : 'unscheduled'
            }
          />
        </div>
      ) : null}

      {caseItem.teachingRisks.length ? (
        <div className="mt-3 space-y-2">
          {caseItem.teachingRisks.slice(0, 2).map((risk) => (
            <CaseTeachingRiskCard key={risk.id} risk={risk} />
          ))}
        </div>
      ) : null}
    </article>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-slate-400">
      {label}: {value}
    </span>
  );
}

function GovernanceMetric({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 truncate text-xs font-semibold text-slate-200">
        {value}
      </p>
    </div>
  );
}
