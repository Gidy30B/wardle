import type { AccuracyPoint } from '../../api/admin';

type CaseTableProps = {
  rows: AccuracyPoint[];
  selectedCaseId: string | null;
  onSelect: (row: AccuracyPoint) => void;
};

export default function CaseTable({
  rows,
  selectedCaseId,
  onSelect,
}: CaseTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-100">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Case ID</th>
            <th className="px-4 py-3">Accuracy</th>
            <th className="px-4 py-3">Attempts</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => {
            const isActive = row.caseId === selectedCaseId;

            return (
              <tr
                key={row.caseId}
                className={isActive ? 'bg-slate-100' : 'hover:bg-slate-50'}
                onClick={() => onSelect(row)}
              >
                <td className="cursor-pointer px-4 py-3 font-medium text-slate-900">
                  {row.caseId}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {(row.accuracy * 100).toFixed(2)}%
                </td>
                <td className="px-4 py-3 text-slate-700">{row.attempts}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
