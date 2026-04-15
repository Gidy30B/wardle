import type { PublishResultsSummary } from '../../api/admin';
import { formatLabel } from '../cases/cases.helpers';
import DashboardSection from './DashboardSection';
import DashboardStatTile from './DashboardStatTile';

type PublishHealthPanelProps = {
  summary: PublishResultsSummary;
};

type AssignmentSummaryProps = {
  title: string;
  description: string;
  accepted: number;
  rejected: number;
  rejectedByEditorialStatus: Record<string, number>;
  extraStat?: {
    label: string;
    value: number;
  };
};

function AssignmentSummary({
  title,
  description,
  accepted,
  rejected,
  rejectedByEditorialStatus,
  extraStat,
}: AssignmentSummaryProps) {
  const rejectionBreakdown = Object.entries(rejectedByEditorialStatus).sort(
    ([left], [right]) => left.localeCompare(right),
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div>
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <DashboardStatTile
          label="Accepted"
          value={accepted}
          hint="Assignments that met publish eligibility."
          tone="success"
        />
        <DashboardStatTile
          label="Rejected"
          value={rejected}
          hint="Assignments blocked by editorial state."
          tone="danger"
        />
      </div>

      {extraStat ? (
        <div className="mt-3">
          <DashboardStatTile
            label={extraStat.label}
            value={extraStat.value}
            hint="Lazy selections that found no eligible case."
            tone="warning"
          />
        </div>
      ) : null}

      <div className="mt-4 rounded-2xl border border-white bg-white p-4">
        <p className="text-sm font-semibold text-slate-700">
          Rejection breakdown by editorial status
        </p>

        {rejectionBreakdown.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            No assignment rejections have been recorded.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {rejectionBreakdown.map(([status, count]) => (
                <div
                  key={status}
                  className="flex items-center justify-between text-sm text-slate-600"
                >
                  <span>{formatLabel(status)}</span>
                  <span className="font-semibold text-slate-900">{count}</span>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PublishHealthPanel({ summary }: PublishHealthPanelProps) {
  return (
    <DashboardSection
      eyebrow="Publish"
      title="Publish supply and assignment health"
      description="Track whether the system has enough eligible cases and how assignment decisions are trending."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <DashboardStatTile
          label="Approved pool"
          value={summary.currentEligiblePool.approvedCases}
          hint="Cases currently approved for assignment."
          tone="success"
        />
        <DashboardStatTile
          label="Ready pool"
          value={summary.currentEligiblePool.readyToPublishCases}
          hint="Cases staged for publishing."
          tone="info"
        />
        <DashboardStatTile
          label="Ready transitions"
          value={summary.metrics.readyToPublishTransitions}
          hint="Transitions into ready-to-publish."
          tone="default"
        />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <AssignmentSummary
          title="Explicit assignment"
          description="Manual or scheduled assignment attempts that target a specific case."
          accepted={summary.metrics.explicit.accepted}
          rejected={summary.metrics.explicit.rejected}
          rejectedByEditorialStatus={
            summary.metrics.explicit.rejectedByEditorialStatus
          }
        />
        <AssignmentSummary
          title="Lazy selection"
          description="Fallback selection attempts that pick the next eligible case automatically."
          accepted={summary.metrics.lazy.accepted}
          rejected={summary.metrics.lazy.rejected}
          rejectedByEditorialStatus={summary.metrics.lazy.rejectedByEditorialStatus}
          extraStat={{
            label: 'No eligible case misses',
            value: summary.metrics.lazy.noEligibleCaseMisses,
          }}
        />
      </div>
    </DashboardSection>
  );
}
