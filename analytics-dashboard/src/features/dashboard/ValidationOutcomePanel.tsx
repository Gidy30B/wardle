import type { CaseSource, ValidationOutcome, ValidationOutcomeSummary } from '../../api/admin';
import EmptyState from '../../components/ui/EmptyState';
import StatusBadge from '../../components/ui/StatusBadge';
import { formatLabel } from '../cases/cases.helpers';
import DashboardSection from './DashboardSection';
import DashboardStatTile from './DashboardStatTile';

type ValidationOutcomePanelProps = {
  summary: ValidationOutcomeSummary;
};

const sourceOrder: CaseSource[] = ['GENERATED', 'ADMIN_EDIT', 'MANUAL', 'RESTORED'];
const outcomeOrder: ValidationOutcome[] = ['PASSED', 'FAILED', 'ERROR'];

export default function ValidationOutcomePanel({
  summary,
}: ValidationOutcomePanelProps) {
  const totals = sourceOrder.reduce(
    (aggregate, source) => {
      const sourceSummary = summary[source];

      return {
        PASSED: aggregate.PASSED + sourceSummary.PASSED,
        FAILED: aggregate.FAILED + sourceSummary.FAILED,
        ERROR: aggregate.ERROR + sourceSummary.ERROR,
      };
    },
    { PASSED: 0, FAILED: 0, ERROR: 0 },
  );

  const totalRuns = totals.PASSED + totals.FAILED + totals.ERROR;

  return (
    <DashboardSection
      eyebrow="Validation"
      title="Validation run health"
      description="Spot whether automated checks are passing cleanly or piling up errors."
    >
      {totalRuns === 0 ? (
        <EmptyState
          title="No validation runs yet"
          description="Validation outcomes will appear here after generated or editorial cases are checked."
        />
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <DashboardStatTile
              label="Total runs"
              value={totalRuns}
              hint="All recorded validation attempts."
            />
            <DashboardStatTile
              label="Passed"
              value={totals.PASSED}
              hint="Runs that completed without issues."
              tone="success"
            />
            <DashboardStatTile
              label="Failed"
              value={totals.FAILED}
              hint="Runs that found validation issues."
              tone="danger"
            />
            <DashboardStatTile
              label="Errored"
              value={totals.ERROR}
              hint="Runs that did not complete successfully."
              tone="warning"
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {sourceOrder.map((source) => {
              const sourceSummary = summary[source];
              const sourceTotal =
                sourceSummary.PASSED + sourceSummary.FAILED + sourceSummary.ERROR;

              return (
                <div
                  key={source}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">
                        {formatLabel(source)}
                      </h3>
                      <p className="text-sm text-slate-500">
                        {sourceTotal} recorded validation runs.
                      </p>
                    </div>
                    <span className="text-2xl font-semibold text-slate-900">
                      {sourceTotal}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    {outcomeOrder.map((outcome) => (
                      <div
                        key={outcome}
                        className="flex min-w-[140px] items-center justify-between rounded-xl border border-white bg-white px-3 py-2"
                      >
                        <StatusBadge status={outcome} kind="validation" />
                        <span className="text-sm font-semibold text-slate-900">
                          {sourceSummary[outcome]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </DashboardSection>
  );
}
