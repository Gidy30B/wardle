import { useAuth } from '@clerk/clerk-react';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getCurriculumPlannerOverview,
  type CurriculumPlannerFilters,
  type CurriculumPlannerOverview,
  type CurriculumPriorityTier,
} from '../../api/admin';
import { createApiClient } from '../../api/client';
import ErrorState from '../../components/ui/ErrorState';
import LoadingState from '../../components/ui/LoadingState';
import StatusBadge from '../../components/ui/StatusBadge';
import { SpecialtyIcon } from '../specialties/specialty-icons';

const priorityOptions: Array<{ value: CurriculumPriorityTier | ''; label: string }> = [
  { value: '', label: 'All priorities' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export default function CurriculumPlannerPage() {
  const { getToken } = useAuth();
  const client = useMemo(() => createApiClient(getToken), [getToken]);
  const [filters, setFilters] = useState<CurriculumPlannerFilters>({
    priorityTier: '',
    track: '',
    playableOnly: false,
  });
  const [overview, setOverview] = useState<CurriculumPlannerOverview | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadPlanner() {
      try {
        setLoading(true);
        setError(null);
        const response = await getCurriculumPlannerOverview(client, filters);
        if (active) {
          setOverview(response);
        }
      } catch (plannerError) {
        if (active) {
          setOverview(null);
          setError(
            plannerError instanceof Error
              ? plannerError.message
              : 'Failed to load curriculum planner.',
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadPlanner();

    return () => {
      active = false;
    };
  }, [client, filters]);

  if (loading && !overview) {
    return (
      <LoadingState
        title="Loading planner"
        description="Prioritizing editorial curriculum gaps."
      />
    );
  }

  if (error && !overview) {
    return <ErrorState title="Planner failed" message={error} />;
  }

  if (!overview) {
    return null;
  }

  return (
    <div className="space-y-5">
      {error ? <ErrorState title="Refresh failed" message={error} /> : null}

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[180px] flex-1">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Specialty
            </span>
            <input
              value={filters.specialty ?? ''}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  specialty: event.target.value,
                }))
              }
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              placeholder="All specialties"
            />
          </label>

          <label className="min-w-[160px]">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Priority
            </span>
            <select
              value={filters.priorityTier ?? ''}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  priorityTier: event.target.value as CurriculumPriorityTier,
                }))
              }
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            >
              {priorityOptions.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-[180px]">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Track
            </span>
            <select
              value={filters.track ?? ''}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  track: event.target.value,
                }))
              }
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            >
              <option value="">All tracks</option>
              {overview.tracks.map((track) => (
                <option key={track.track} value={track.track}>
                  {track.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={filters.playableOnly ?? false}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  playableOnly: event.target.checked,
                }))
              }
              className="h-4 w-4 rounded border-slate-300"
            />
            Playable only
          </label>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-4 xl:grid-cols-7">
        <Metric label="High priority" value={overview.summary.highPriorityDiagnoses} />
        <Metric label="Specialty risk" value={overview.summary.specialtyRiskCount} />
        <Metric label="Exhaustion risk" value={overview.summary.inventoryExhaustionRisk} />
        <Metric label="Onboarding stalls" value={overview.summary.onboardingBottlenecks} />
        <Metric label="Unresolved diffs" value={overview.summary.unresolvedDifferentialBacklog} />
        <Metric label="Diagnoses" value={overview.summary.diagnosisCount} />
        <Metric
          label="Evidence weak"
          value={
            overview.priorityDiagnoses.filter(
              (diagnosis) =>
                diagnosis.evidenceCoverage?.generationReadinessTier === 'weak',
            ).length
          }
        />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <SectionHeader
          title="Priority Diagnoses"
          subtitle={`${overview.priorityDiagnoses.length} ranked diagnoses`}
        />
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-[0.16em] text-slate-500">
              <tr>
                <th className="py-2 pr-4">Diagnosis</th>
                <th className="py-2 pr-4">Score</th>
                <th className="py-2 pr-4">Blockers</th>
                <th className="py-2 pr-4">Missing</th>
                <th className="py-2 pr-4">Evidence</th>
                <th className="py-2 pr-4">Specialty</th>
                <th className="py-2 pr-4">Track</th>
                <th className="py-2">Workspace</th>
              </tr>
            </thead>
            <tbody>
              {overview.priorityDiagnoses.map((diagnosis) => (
                <tr
                  key={diagnosis.diagnosisRegistryId}
                  className="border-b border-slate-100 align-top"
                >
                  <td className="py-3 pr-4">
                    <p className="font-semibold text-slate-900">
                      {diagnosis.diagnosisName}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {diagnosis.priorityReasons.slice(0, 2).join(' - ') ||
                        'No major priority drivers'}
                    </p>
                  </td>
                  <td className="py-3 pr-4">
                    <StatusBadge
                      status={`${diagnosis.priorityScore} ${diagnosis.priorityTier}`}
                      tone={diagnosis.priorityTier === 'high' ? 'danger' : 'info'}
                    />
                  </td>
                  <td className="max-w-[220px] py-3 pr-4 text-slate-700">
                    {diagnosis.blockers.join(', ') || 'None'}
                  </td>
                  <td className="max-w-[220px] py-3 pr-4 text-slate-700">
                    {diagnosis.missingAreas.join(', ') || 'None'}
                  </td>
                  <td className="py-3 pr-4">
                    {diagnosis.evidenceCoverage ? (
                      <StatusBadge
                        status={`${diagnosis.evidenceCoverage.generationReadinessScore} ${diagnosis.evidenceCoverage.generationReadinessTier}`}
                        tone={
                          diagnosis.evidenceCoverage.generationReadinessTier ===
                          'weak'
                            ? 'warning'
                            : 'info'
                        }
                      />
                    ) : (
                      <span className="text-slate-500">Unavailable</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-slate-700">
                    {diagnosis.specialty ? (
                      <span className="inline-flex items-center gap-2">
                        <SpecialtyIcon
                          specialty={diagnosis.specialty}
                          className="h-4 w-4 text-slate-500"
                        />
                        {diagnosis.specialty}
                      </span>
                    ) : (
                      'Unassigned'
                    )}
                  </td>
                  <td className="py-3 pr-4 text-slate-700">
                    {formatLabel(diagnosis.track)}
                  </td>
                  <td className="py-3">
                    <Link
                      to={diagnosis.targetUrl}
                      className="font-semibold text-slate-700 hover:text-slate-950"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <SectionHeader
            title="Curriculum Tracks"
            subtitle={`${overview.tracks.length} inferred tracks`}
          />
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {overview.tracks.map((track) => (
              <div
                key={track.track}
                className="rounded-lg border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {track.label}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-sm text-slate-500">
                      {track.specialties.map((specialty) => (
                        <span
                          key={specialty}
                          className="inline-flex items-center gap-1.5"
                        >
                          <SpecialtyIcon
                            specialty={specialty}
                            className="h-3.5 w-3.5"
                          />
                          {specialty}
                        </span>
                      ))}
                    </div>
                  </div>
                  <StatusBadge status={`${track.averagePriorityScore} avg`} />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <TinyMetric label="Diagnoses" value={track.diagnosisCount} />
                  <TinyMetric label="High" value={track.highPriorityCount} />
                  <TinyMetric label="Missing" value={track.missingAreas.length} />
                </div>
                <div className="mt-3 space-y-2">
                  {track.diagnoses.slice(0, 4).map((diagnosis) => (
                    <Link
                      key={diagnosis.diagnosisRegistryId}
                      to={diagnosis.targetUrl}
                      className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      <span className="font-medium text-slate-700">
                        {diagnosis.diagnosisName}
                      </span>
                      <span className="font-semibold text-slate-900">
                        {diagnosis.priorityScore}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <SectionHeader title="Inventory Planning" subtitle="Advisory depth" />
          <div className="mt-4 grid gap-3">
            <Metric
              label="Scheduled days"
              value={overview.inventoryPlanning.projectedExhaustion.scheduledDays}
              compact
            />
            <Metric
              label="Assignable cases"
              value={overview.inventoryPlanning.projectedExhaustion.assignableCases}
              compact
            />
            <Metric
              label="No-case diagnoses"
              value={overview.inventoryPlanning.noCaseDiagnoses.length}
              compact
            />
          </div>
          <div className="mt-4 space-y-2">
            {overview.inventoryPlanning.specialtiesAtRisk.slice(0, 5).map((item) => (
              <div
                key={item.specialty}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-slate-900">
                    <span className="inline-flex items-center gap-2">
                      <SpecialtyIcon
                        specialty={item.specialty}
                        className="h-4 w-4 text-slate-500"
                      />
                      {item.specialty}
                    </span>
                  </span>
                  <span className="text-slate-600">{item.riskScore}</span>
                </div>
                <p className="mt-1 text-slate-500">
                  {item.caseCount} cases, {item.weakDiagnosisCount} weak diagnoses
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="grid gap-5 xl:grid-cols-2">
        <PlannerPanel title="Editorial Dependencies">
          <div className="space-y-3">
            {overview.dependencyClusters.map((cluster, index) => (
              <div
                key={`${cluster.type}-${index}`}
                className="rounded-lg border border-slate-200 bg-slate-50 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {formatLabel(cluster.type)}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {cluster.reason}
                    </p>
                  </div>
                  <StatusBadge status={`${cluster.strength} links`} />
                </div>
                <p className="mt-2 text-sm text-slate-700">
                  {cluster.diagnosisNames.slice(0, 5).join(', ')}
                </p>
              </div>
            ))}
            {!overview.dependencyClusters.length ? (
              <EmptyText text="No dependency clusters for the current filters." />
            ) : null}
          </div>
        </PlannerPanel>

        <PlannerPanel title="Recommendations">
          <div className="space-y-3">
            {overview.recommendations.slice(0, 12).map((item) => (
              <Link
                key={item.diagnosisRegistryId}
                to={item.targetUrl}
                className="block rounded-lg border border-slate-200 bg-slate-50 p-3 transition hover:bg-white"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold text-slate-900">
                    {item.diagnosisName}
                  </p>
                  <span className="text-sm font-semibold text-slate-700">
                    {item.priorityScore}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  {item.recommendations.slice(0, 3).join(', ')}
                </p>
              </Link>
            ))}
            {!overview.recommendations.length ? (
              <EmptyText text="No recommendations for the current filters." />
            ) : null}
          </div>
        </PlannerPanel>
      </section>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <span className="text-sm text-slate-500">{subtitle}</span>
    </div>
  );
}

function PlannerPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <SectionHeader title={title} subtitle="Read-only planning signals" />
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Metric({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: number;
  compact?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className={`mt-2 font-semibold text-slate-900 ${compact ? 'text-2xl' : 'text-3xl'}`}>
        {value}
      </p>
    </div>
  );
}

function TinyMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-center">
      <p className="text-[11px] font-semibold uppercase text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function EmptyText({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
      {text}
    </div>
  );
}

function formatLabel(value: string) {
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
