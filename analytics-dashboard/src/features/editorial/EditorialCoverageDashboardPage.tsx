import { useAuth } from '@clerk/clerk-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getCaseInventoryHealth,
  getEditorialCoverageOverview,
  type CaseInventoryHealth,
  type EditorialCoverageFilters,
  type EditorialCoverageOverview,
  type EditorialCoverageWeakness,
} from '../../api/admin';
import { createApiClient } from '../../api/client';
import ErrorState from '../../components/ui/ErrorState';
import LoadingState from '../../components/ui/LoadingState';
import StatusBadge from '../../components/ui/StatusBadge';
import { SpecialtyIcon } from '../specialties/specialty-icons';

const weaknessOptions: Array<{
  value: EditorialCoverageWeakness | '';
  label: string;
}> = [
  { value: '', label: 'All weaknesses' },
  { value: 'missing_teaching_rules', label: 'No teaching rules' },
  { value: 'weak_teaching_rules', label: 'Weak teaching density' },
  { value: 'missing_required_differentials', label: 'No required diffs' },
  { value: 'weak_differential_breadth', label: 'Weak diffs' },
  { value: 'unresolved_differentials', label: 'Unresolved diffs' },
  { value: 'missing_playable_cases', label: 'No playable cases' },
  { value: 'missing_graph_coverage', label: 'No graph coverage' },
  { value: 'stalled_onboarding', label: 'Stalled onboarding' },
  { value: 'duplicate_risk', label: 'Duplicate risk' },
  { value: 'merge_risk', label: 'Merge risk' },
];

export default function EditorialCoverageDashboardPage() {
  const { getToken } = useAuth();
  const client = useMemo(() => createApiClient(getToken), [getToken]);
  const [filters, setFilters] = useState<EditorialCoverageFilters>({
    coverageWeakness: '',
    lifecycleState: '',
    onboardingState: '',
    playableOnly: false,
  });
  const [overview, setOverview] = useState<EditorialCoverageOverview | null>(
    null,
  );
  const [inventoryHealth, setInventoryHealth] =
    useState<CaseInventoryHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadCoverage() {
      try {
        setLoading(true);
        setError(null);
        const [response, health] = await Promise.all([
          getEditorialCoverageOverview(client, filters),
          getCaseInventoryHealth(client),
        ]);
        if (active) {
          setOverview(response);
          setInventoryHealth(health);
        }
      } catch (coverageError) {
        if (active) {
          setOverview(null);
          setInventoryHealth(null);
          setError(
            coverageError instanceof Error
              ? coverageError.message
              : 'Failed to load coverage dashboard.',
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadCoverage();

    return () => {
      active = false;
    };
  }, [client, filters]);

  if (loading && !overview) {
    return (
      <LoadingState
        title="Loading coverage"
        description="Collecting editorial coverage signals."
      />
    );
  }

  if (error && !overview) {
    return <ErrorState title="Coverage failed" message={error} />;
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

          <label className="min-w-[180px]">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Weakness
            </span>
            <select
              value={filters.coverageWeakness ?? ''}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  coverageWeakness: event.target
                    .value as EditorialCoverageWeakness,
                }))
              }
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            >
              {weaknessOptions.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
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

      <section className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
        <Metric label="Playable diagnoses" value={overview.globalSummary.playableDiagnoses} />
        <Metric label="Playable cases" value={overview.globalSummary.playableCases} />
        <Metric label="Unresolved diffs" value={overview.globalSummary.unresolvedDifferentials} />
        <Metric label="Onboarding backlog" value={overview.globalSummary.onboardingBacklog} />
        <Metric label="Graph backlog" value={overview.globalSummary.graphBacklog} />
        <Metric label="Inventory days" value={overview.globalSummary.inventoryDaysRemaining} />
        <Metric
          label="Evidence score"
          value={overview.evidenceCoverageReadiness.averageCoverageScore}
        />
        <Metric
          label="Readiness score"
          value={overview.evidenceCoverageReadiness.averageGenerationReadinessScore}
        />
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.8fr)]">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <SectionHeader
            title="Specialty Coverage"
            subtitle={`${overview.specialties.length} specialty groups`}
          />
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-[0.16em] text-slate-500">
                <tr>
                  <th className="py-2 pr-4">Specialty</th>
                  <th className="py-2 pr-4">Diagnoses</th>
                  <th className="py-2 pr-4">Playable</th>
                  <th className="py-2 pr-4">Cases</th>
                  <th className="py-2 pr-4">Education</th>
                  <th className="py-2 pr-4">Graph</th>
                  <th className="py-2">Unresolved</th>
                </tr>
              </thead>
              <tbody>
                {overview.specialties.map((item) => (
                  <tr key={item.specialty} className="border-b border-slate-100">
                    <td className="py-3 pr-4 font-semibold text-slate-900">
                      <span className="inline-flex items-center gap-2">
                        <SpecialtyIcon
                          specialty={item.specialty}
                          className="h-4 w-4 text-slate-500"
                        />
                        {item.specialty}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-slate-700">
                      {item.diagnosisCount}
                    </td>
                    <td className="py-3 pr-4 text-slate-700">
                      {item.playableDiagnosisCount}
                    </td>
                    <td className="py-3 pr-4 text-slate-700">{item.caseCount}</td>
                    <td className="py-3 pr-4 text-slate-700">
                      {item.educationCoveragePercent}%
                    </td>
                    <td className="py-3 pr-4 text-slate-700">
                      {item.graphCoveragePercent}%
                    </td>
                    <td className="py-3 text-slate-700">
                      {item.unresolvedDifferentialCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <SectionHeader title="Inventory Forecast" subtitle="Daily queue depth" />
          <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <Metric
              label="Scheduled days"
              value={overview.inventory.inventoryExhaustionForecast.scheduledDays}
              compact
            />
            <Metric
              label="Assignable cases"
              value={overview.inventory.inventoryExhaustionForecast.assignableCases}
              compact
            />
            <Metric
              label="Estimated exhaustion"
              value={overview.inventory.inventoryExhaustionForecast.estimatedExhaustionDays}
              compact
            />
          </div>
          {inventoryHealth ? (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Inventory health
              </p>
              <div className="mt-3 grid gap-2 text-sm">
                <HealthRow
                  label="Assignable cases"
                  value={inventoryHealth.schedulerEligibleCount}
                />
                <HealthRow
                  label="Playable diagnoses"
                  value={inventoryHealth.registry.playableCount}
                />
                <HealthRow
                  label="Scheduled cases"
                  value={inventoryHealth.alreadyScheduledCount}
                />
                <HealthRow
                  label="Scheduled days"
                  value={overview.inventory.scheduledDaysRemaining}
                />
              </div>
              {inventoryHealth.schedulerEligibleCount < 7 ? (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
                  Inventory exhaustion risk: fewer than seven assignable cases.
                </p>
              ) : null}
            </div>
          ) : null}
        </section>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <SectionHeader
          title="Weak Diagnoses"
          subtitle={`${overview.weakDiagnoses.length} shown`}
        />
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {overview.weakDiagnoses.map((diagnosis) => (
            <Link
              key={diagnosis.diagnosisRegistryId}
              to={diagnosis.targetUrl}
              className="rounded-lg border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-300 hover:bg-white"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">
                    {diagnosis.diagnosisName}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-slate-500">
                    {diagnosis.specialty ? (
                      <span className="inline-flex items-center gap-1.5">
                        <SpecialtyIcon
                          specialty={diagnosis.specialty}
                          className="h-3.5 w-3.5"
                        />
                        {diagnosis.specialty}
                      </span>
                    ) : null}
                    {diagnosis.specialty && diagnosis.bodySystem ? <span>-</span> : null}
                    {diagnosis.bodySystem ? <span>{diagnosis.bodySystem}</span> : null}
                    {!diagnosis.specialty && !diagnosis.bodySystem ? (
                      <span>Unassigned</span>
                    ) : null}
                  </div>
                </div>
                <StatusBadge status={diagnosis.lifecycleState} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {diagnosis.weaknesses.slice(0, 5).map((weakness) => (
                  <span
                    key={weakness}
                    className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600"
                  >
                    {formatLabel(weakness)}
                  </span>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                <TinyMetric label="Rules" value={diagnosis.teaching.activeRuleCount} />
                <TinyMetric label="Cases" value={diagnosis.inventory.playableCaseCount} />
                <TinyMetric label="Diffs" value={diagnosis.differentials.linkedDifferentialCount} />
                <TinyMetric label="Graph" value={diagnosis.graph.relationshipCount} />
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-4">
        <CoveragePanel
          title="Differential Coverage"
          rows={[
            ['Unresolved mappings', overview.differentialCoverage.unresolvedDifferentials],
            ['Ambiguous mappings', overview.differentialCoverage.ambiguousMappings],
            ['Weak breadth', overview.differentialCoverage.diagnosesWithWeakDifferentialBreadth],
            ['One-way relationships', overview.differentialCoverage.oneWayDifferentialRelationships],
          ]}
          link="/editorial/differentials"
        />
        <CoveragePanel
          title="Graph Coverage"
          rows={[
            ['No graph facts', overview.graphCoverage.diagnosesWithoutGraphFacts],
            ['Weak mimics', overview.graphCoverage.weakMimicRelationships],
            ['Pending candidates', overview.graphCoverage.graphCandidatesPendingReview],
            ['Active teaching relationships', overview.graphCoverage.activeTeachingRelationships],
            ['Graph facts without teaching', overview.graphCoverage.graphFactsWithoutTeachingRelationships],
            ['Differential links without teaching', overview.graphCoverage.differentialLinksWithoutTeachingRelationships],
            ['Weak teaching graph', overview.graphCoverage.diagnosesWithWeakTeachingGraphCoverage],
            ['Relationship density', overview.graphCoverage.graphRelationshipDensity],
          ]}
          link="/diagnosis-graph/candidates"
        />
        <CoveragePanel
          title="Teaching Coverage"
          rows={[
            ['Missing rules', overview.teachingCoverage.diagnosesMissingTeachingRules],
            ['Weak density', overview.teachingCoverage.weakTeachingRuleDensity],
            ['Rules without diffs', overview.teachingCoverage.rulesWithoutRequiredDifferentials],
            ['No discriminator teaching', overview.teachingCoverage.diagnosesLackingDiscriminatorTeaching],
          ]}
          link="/editorial"
        />
        <CoveragePanel
          title="Evidence Graph"
          rows={[
            ['Evidence nodes', overview.evidenceGraphCoverage.evidenceNodeCount],
            ['Active evidence', overview.evidenceGraphCoverage.activeEvidenceRelationships],
            ['No discriminators', overview.evidenceGraphCoverage.diagnosesLackingDiscriminatorEvidence],
            ['Weak diversity', overview.evidenceGraphCoverage.weakEvidenceDiversity],
            ['Overused patterns', overview.evidenceGraphCoverage.overusedEvidencePatterns],
            ['Coverage gaps', overview.evidenceGraphCoverage.evidenceCoverageGaps],
          ]}
          link="/editorial/coverage"
        />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <SectionHeader
          title="Evidence Readiness"
          subtitle="Reasoning coverage and generation prerequisites"
        />
        <div className="mt-4 grid gap-3 md:grid-cols-5">
          <Metric
            label="Ready"
            value={overview.evidenceCoverageReadiness.readyDiagnoses}
            compact
          />
          <Metric
            label="Partial"
            value={overview.evidenceCoverageReadiness.partialDiagnoses}
            compact
          />
          <Metric
            label="Weak"
            value={overview.evidenceCoverageReadiness.weakDiagnoses}
            compact
          />
          <Metric
            label="Missing gaps"
            value={overview.evidenceCoverageReadiness.missingEvidenceGaps}
            compact
          />
          <Metric
            label="Overused"
            value={overview.evidenceCoverageReadiness.overusedEvidencePatterns}
            compact
          />
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <SectionHeader title="Planning Hooks" subtitle="Advisory metadata only" />
        <div className="mt-4 grid gap-3 md:grid-cols-6">
          <Metric
            label="Teaching suggestions"
            value={overview.recommendations.recommendedTeachingRuleGeneration}
            compact
          />
          <Metric
            label="Differential expansion"
            value={overview.recommendations.recommendedDifferentialExpansion}
            compact
          />
          <Metric
            label="Graph expansion"
            value={overview.recommendations.recommendedGraphExpansion}
            compact
          />
          <Metric
            label="Teaching relationships"
            value={overview.recommendations.recommendedTeachingRelationshipActivation}
            compact
          />
          <Metric
            label="Evidence graph"
            value={overview.recommendations.recommendedEvidenceGraphExpansion}
            compact
          />
          <Metric
            label="Case generation"
            value={overview.recommendations.recommendedCaseGeneration}
            compact
          />
        </div>
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
      <p
        className={`mt-2 font-semibold text-slate-900 ${
          compact ? 'text-2xl' : 'text-3xl'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function TinyMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-2 py-2">
      <p className="text-[11px] font-semibold uppercase text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function HealthRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-600">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}

function CoveragePanel({
  title,
  rows,
  link,
}: {
  title: string;
  rows: Array<[string, number]>;
  link: string;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <SectionHeader title={title} subtitle="" />
      <div className="mt-4 space-y-3">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex items-center justify-between border-b border-slate-100 pb-2 text-sm"
          >
            <span className="text-slate-600">{label}</span>
            <span className="font-semibold text-slate-900">{value}</span>
          </div>
        ))}
      </div>
      <Link
        to={link}
        className="mt-4 inline-flex text-sm font-semibold text-slate-700 hover:text-slate-950"
      >
        Open related queue
      </Link>
    </section>
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
