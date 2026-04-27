import type { EditorialCaseListItem, EditorialQueueFilter } from '../../api/admin';
import StatusBadge from '../../components/ui/StatusBadge';
import {
  formatDateLabel,
  getDiagnosisWorkflowSummary,
  getCaseDisplaySummary,
  getQueueFocusedNextStep,
  isPublishReadyStatus,
} from './cases.helpers';

type CaseTableProps = {
  rows: EditorialCaseListItem[];
  selectedCaseId: string | null;
  queue: EditorialQueueFilter;
  onSelect: (row: EditorialCaseListItem) => void;
};

export default function CaseTable({
  rows,
  selectedCaseId,
  queue,
  onSelect,
}: CaseTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Case</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Diagnosis</th>
            <th className="px-4 py-3">Validation</th>
            <th className="px-4 py-3">Next step</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => {
            const isActive = row.id === selectedCaseId;
            const { latestValidation } = getCaseDisplaySummary(row);
            const nextStep = getQueueFocusedNextStep(row.editorialStatus, queue);
            const publishReady = isPublishReadyStatus(row.editorialStatus);
            const diagnosisSummary = getDiagnosisWorkflowSummary(row);
            const rowClassName = publishReady
              ? isActive
                ? 'bg-emerald-100'
                : 'bg-emerald-50 hover:bg-emerald-100'
              : isActive
                ? 'bg-slate-100'
                : 'hover:bg-slate-50';

            return (
              <tr
                key={row.id}
                className={rowClassName}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(row)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelect(row);
                  }
                }}
              >
                <td className="cursor-pointer px-4 py-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-900">{row.title}</p>
                      {publishReady ? (
                        <span className="rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                          Publish ready
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {row.diagnosis.name} - {row.difficulty} - {row.date}
                    </p>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  <StatusBadge status={row.editorialStatus} kind="editorial" />
                </td>
                <td className="px-4 py-3 text-slate-700">
                  <div className="space-y-1">
                    <StatusBadge status={diagnosisSummary.label} tone={diagnosisSummary.tone} />
                    <p className="text-xs text-slate-500">
                      {row.diagnosisRegistrySummary?.canonicalName ?? row.proposedDiagnosisText}
                    </p>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {latestValidation ? (
                    <div className="space-y-1">
                      <StatusBadge
                        status={latestValidation.outcome}
                        kind="validation"
                        tone={undefined}
                      />
                      <p className="text-xs text-slate-500">
                        {formatDateLabel(
                          latestValidation.completedAt ?? latestValidation.startedAt,
                        )}
                      </p>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500">No validation yet</span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  <div>
                    <p className="font-medium text-slate-900">{nextStep}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {queue === 'publish' && publishReady
                        ? 'Ready for publish-focused handling'
                        : `Revision ${row.currentRevision?.revisionNumber ?? '--'} - ${row.id}`}
                    </p>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
