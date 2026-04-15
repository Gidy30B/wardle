import type { CaseEditorialStatus, EditorialStatusSummary } from '../../api/admin';
import StatusBadge from '../../components/ui/StatusBadge';
import DashboardSection from './DashboardSection';
import DashboardStatTile from './DashboardStatTile';

type EditorialStatusPanelProps = {
  summary: EditorialStatusSummary;
};

const editorialStatusOrder: CaseEditorialStatus[] = [
  'DRAFT',
  'VALIDATING',
  'VALIDATED',
  'REVIEW',
  'NEEDS_EDIT',
  'APPROVED',
  'READY_TO_PUBLISH',
  'PUBLISHED',
  'REJECTED',
];

export default function EditorialStatusPanel({
  summary,
}: EditorialStatusPanelProps) {
  return (
    <DashboardSection
      eyebrow="Editorial"
      title="Editorial status overview"
      description="See where cases are waiting, blocked, or ready for the next step."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DashboardStatTile
          label="Tracked cases"
          value={summary.totalCases}
          hint="Cases with editorial metadata in the system."
          tone="default"
        />
        <DashboardStatTile
          label="In review"
          value={summary.counts.REVIEW}
          hint="Cases currently waiting on editorial decisions."
          tone="warning"
        />
        <DashboardStatTile
          label="Needs edit"
          value={summary.counts.NEEDS_EDIT}
          hint="Cases blocked on changes before approval."
          tone="danger"
        />
        <DashboardStatTile
          label="Ready to publish"
          value={summary.counts.READY_TO_PUBLISH}
          hint="Cases already cleared for the publish queue."
          tone="success"
        />
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {editorialStatusOrder.map((status) => (
          <div
            key={status}
            className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
          >
            <StatusBadge status={status} kind="editorial" />
            <span className="text-lg font-semibold text-slate-900">
              {summary.counts[status]}
            </span>
          </div>
        ))}

        <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <StatusBadge status="Unassigned" />
          <span className="text-lg font-semibold text-slate-900">
            {summary.nullStatusCount}
          </span>
        </div>
      </div>
    </DashboardSection>
  );
}
