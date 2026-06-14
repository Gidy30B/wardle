import type {
  DiagnosisEditorialWorkspace,
  WorkspaceCoverageGap,
  WorkspaceCoverageMatrixRow,
  WorkspaceReadinessItem,
} from '../../../api/admin';
import StatusBadge from '../../../components/ui/StatusBadge';
import {
  ChipOverflowRow,
  CompactPanel,
  EditorialRow,
  EditorialEmptyState,
} from './EditorialPrimitives';
import {
  coverageCompositeStatus,
  formatLabel,
  severityRank,
} from './workspaceTransforms';
import type { WorkspaceTab } from './workspaceTypes';

export function CoverageScoreCard({
  workspace,
}: {
  workspace: DiagnosisEditorialWorkspace;
}) {
  const counts = workspace.coverageMatrix.reduce(
    (acc, row) => {
      acc[row.fullCoverageStatus] = (acc[row.fullCoverageStatus] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  const total = workspace.coverageMatrix.length;
  const covered = counts.covered ?? 0;

  return (
    <CompactPanel title="Coverage control">
      <div className="rounded-lg border border-slate-900 bg-slate-950 p-4 text-white">
        <p className="text-sm font-semibold text-slate-300">Full coverage</p>
        <p className="mt-2 text-3xl font-semibold">
          {total ? `${covered}/${total}` : '0/0'}
        </p>
        <p className="mt-1 text-sm text-slate-400">
          {total
            ? `${Math.round((covered / total) * 100)}% of teaching rules fully covered`
            : 'No teaching rules are available yet.'}
        </p>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <CoverageCount label="Partial" value={counts.partial ?? 0} />
        <CoverageCount label="Missing" value={counts.missing ?? 0} />
        <CoverageCount label="Unknown" value={counts.unknown ?? 0} />
      </div>
    </CompactPanel>
  );
}

function CoverageCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[var(--color-navy-border)] bg-white/4 px-3 py-2">
      <p className="text-sm font-semibold text-slate-100">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
    </div>
  );
}

export function ReadinessBreakdownCard({
  items,
  onTabChange,
}: {
  items: WorkspaceReadinessItem[];
  onTabChange: (tab: WorkspaceTab) => void;
}) {
  const sortedItems = [...items].sort(
    (left, right) => severityRank(left.severity) - severityRank(right.severity),
  );

  return (
    <CompactPanel title="Readiness breakdown">
      {sortedItems.length ? (
        <div className="space-y-2">
          {sortedItems.slice(0, 12).map((item, index) => (
            <button
              key={`${item.actionId}-${index}`}
              type="button"
              onClick={() => onTabChange(item.targetTab)}
              className={[
                'w-full rounded-lg border px-3 py-2 text-left text-sm transition hover:bg-white/10',
                item.severity === 'blocker'
                  ? 'border-[var(--color-rose)]/35 bg-[var(--color-rose)]/10 text-rose-100'
                  : item.severity === 'warning'
                    ? 'border-[var(--color-amber)]/35 bg-[var(--color-amber)]/10 text-amber-100'
                    : 'border-[var(--color-navy-border)] bg-white/5 text-slate-300',
              ].join(' ')}
            >
              <span className="mr-2 inline-flex min-w-20 justify-center rounded-full border border-current/20 px-2 py-0.5 text-xs font-semibold uppercase">
                {formatLabel(item.severity)}
              </span>
              <span className="font-semibold">{formatLabel(item.source)}:</span>
              <span className="ml-1">{item.message}</span>
              <span className="ml-2 text-xs opacity-75">
                {formatLabel(item.targetTab)}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">No readiness issues reported.</p>
      )}
    </CompactPanel>
  );
}

export function CoverageMatrixCard({
  rows,
  selectedRow,
  onRowSelect,
}: {
  rows: WorkspaceCoverageMatrixRow[];
  selectedRow: WorkspaceCoverageMatrixRow | null;
  onRowSelect: (row: WorkspaceCoverageMatrixRow) => void;
}) {
  if (!rows.length) {
    return (
      <CompactPanel
        title="Coverage matrix"
        subtitle="Education, case, and graph support for teaching rules."
      >
        <EditorialEmptyState
          title="No coverage rows yet"
          description="Approve teaching rules or seed legacy rules so the workspace can track education, case, and graph coverage."
        />
      </CompactPanel>
    );
  }

  return (
    <CompactPanel
      title="Coverage matrix"
      subtitle="Curriculum coverage across education, cases, and graph support."
    >
      <div className="space-y-2">
        {rows.map((row) => {
          const selected =
            selectedRow?.stableKey === row.stableKey ||
            selectedRow?.teachingRuleId === row.teachingRuleId;
          const compositeStatus = coverageCompositeStatus(row);

          return (
            <button
              key={`${row.stableKey}-${row.teachingRuleId ?? 'legacy'}`}
              type="button"
              onClick={() => onRowSelect(row)}
              className={[
                'block w-full text-left',
                selected
                  ? 'rounded-lg ring-1 ring-[var(--color-teal)]/45'
                  : '',
              ].join(' ')}
            >
              <EditorialRow
                title={row.title}
                subtitle={`${formatLabel(row.category)} - ${formatLabel(
                  row.importance,
                )}`}
                tone={compositeStatus.tone}
                meta={
                  <ChipOverflowRow
                    items={[
                      {
                        id: 'education',
                        label: `Education ${formatLabel(row.educationCoverage)}`,
                        tone:
                          row.educationCoverage === 'covered'
                            ? 'success'
                            : row.educationCoverage === 'missing'
                              ? 'danger'
                              : 'warning',
                      },
                      {
                        id: 'cases',
                        label: `Cases ${formatLabel(row.caseCoverage)}`,
                        tone:
                          row.caseCoverage === 'covered'
                            ? 'success'
                            : row.caseCoverage === 'missing'
                              ? 'danger'
                              : 'warning',
                      },
                      {
                        id: 'graph',
                        label: `Graph ${formatLabel(row.graphCoverage)}`,
                        tone:
                          row.graphCoverage === 'covered'
                            ? 'success'
                            : row.graphCoverage === 'missing'
                              ? 'danger'
                              : 'warning',
                      },
                    ]}
                  />
                }
                action={
                  <StatusBadge
                    status={compositeStatus.label}
                    tone={compositeStatus.tone}
                  />
                }
              >
                <p className="text-xs leading-5 text-slate-500">
                  {row.recommendedAction}
                </p>
              </EditorialRow>
            </button>
          );
        })}
      </div>
    </CompactPanel>
  );
}

export function CoverageGapsCard({
  gaps,
  onGapSelect,
}: {
  gaps: WorkspaceCoverageGap[];
  onGapSelect: (gap: WorkspaceCoverageGap) => void;
}) {
  return (
    <CompactPanel
      title="Coverage gaps"
      subtitle="Trace missing education, cases, or graph support to the right tab."
    >
      {gaps.length ? (
        <div className="grid gap-2 md:grid-cols-2">
          {gaps.slice(0, 10).map((gap, index) => (
            <button
              key={`${gap.teachingRuleId ?? gap.title}-${index}`}
              type="button"
              onClick={() => onGapSelect(gap)}
              className={[
                'rounded-lg px-3 py-2 text-left ring-1 transition hover:bg-white/10',
                gap.severity === 'blocker'
                  ? 'bg-[var(--color-rose)]/10 ring-[var(--color-rose)]/35'
                  : 'bg-[var(--color-amber)]/10 ring-[var(--color-amber)]/35',
              ].join(' ')}
            >
              <p className="text-sm font-semibold text-slate-100">{gap.title}</p>
              <p className="mt-1 text-xs text-slate-400">
                {gap.recommendedAction}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                {[
                  gap.missingEducation ? 'education' : null,
                  gap.missingCases ? 'cases' : null,
                  gap.missingGraph ? 'graph' : null,
                ]
                  .filter(Boolean)
                  .join(', ')}
              </p>
              <span className="mt-2 inline-flex text-xs font-semibold text-[var(--color-teal)]">
                Open {formatLabel(gap.targetTab)}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <EditorialEmptyState
          title="No coverage gaps reported"
          description="Current coverage signals do not show missing education, case, or graph support."
        />
      )}
    </CompactPanel>
  );
}
