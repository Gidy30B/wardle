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
import type { StatusBadgeTone } from '../../components/ui/statusBadgeMeta';
import { SpecialtyIcon } from '../specialties/specialty-icons';
import {
  buildEditorialQueues,
  diagnosisQueueIds,
  sortDiagnosesByEditorialPriority,
} from './coverageQueues';
import { buildUnsupportedClaimDeepLink } from './workspace/workspaceDeepLinks';

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
  const [activeQueue, setActiveQueue] = useState<string>('all');
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

  const sortedWeakDiagnoses = sortDiagnosesByEditorialPriority(
    overview.weakDiagnoses,
  );
  const queues = buildEditorialQueues(sortedWeakDiagnoses);
  const filteredWeakDiagnoses =
    activeQueue === 'all'
      ? sortedWeakDiagnoses
      : sortedWeakDiagnoses.filter((diagnosis) =>
          diagnosisQueueIds(diagnosis).includes(activeQueue),
        );
  const operationsSummary = buildOperationsSummary(
    overview,
    inventoryHealth,
    sortedWeakDiagnoses,
  );

  return (
    <div className="space-y-5 text-slate-100">
      {error ? <ErrorState title="Refresh failed" message={error} /> : null}

      <section className="editorial-panel rounded-lg p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[180px] flex-1">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
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
              className="mt-2 w-full rounded-lg border border-[var(--color-navy-border)] bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-[var(--color-teal)] focus:ring-2 focus:ring-[var(--color-teal)]/20"
              placeholder="All specialties"
            />
          </label>

          <label className="min-w-[180px]">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
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
              className="mt-2 w-full rounded-lg border border-[var(--color-navy-border)] bg-[var(--color-navy-mid)] px-3 py-2 text-sm text-slate-100 outline-none focus:border-[var(--color-teal)] focus:ring-2 focus:ring-[var(--color-teal)]/20"
            >
              {weaknessOptions.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex h-10 items-center gap-2 rounded-lg border border-[var(--color-navy-border)] bg-white/5 px-3 text-sm font-semibold text-slate-300">
            <input
              type="checkbox"
              checked={filters.playableOnly ?? false}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  playableOnly: event.target.checked,
                }))
              }
              className="h-4 w-4 rounded border-[var(--color-navy-border)] bg-[var(--color-navy-mid)] accent-[var(--color-teal)]"
            />
            Playable only
          </label>
        </div>
      </section>

      <section className="editorial-panel rounded-lg p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="editorial-eyebrow">Coverage operations</p>
            <h1 className="mt-1 text-xl font-semibold text-slate-100">
              Editorial coverage cockpit
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Queue health, publication risk, unsupported claims, and inventory
              readiness.
            </p>
          </div>
          <StatusBadge
            status={operationsSummary.inventoryRiskLabel}
            tone={operationsSummary.inventoryRisk ? 'warning' : 'success'}
          />
        </div>
        <div className="mt-4 grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {operationsSummary.items.map((item) => (
            <OperationsMetric key={item.label} {...item} />
          ))}
        </div>
      </section>

      <section className="editorial-panel rounded-lg p-4 shadow-sm">
        <SectionHeader
          title="Editorial Queues"
          subtitle="Risk-focused slices for operational triage"
        />
        <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <QueueButton
            active={activeQueue === 'all'}
            label="All weak diagnoses"
            count={overview.weakDiagnoses.length}
            tone="neutral"
            description="Everything currently in the editorial worklist."
            onClick={() => setActiveQueue('all')}
          />
          {queues.map((queue) => (
            <QueueButton
              key={queue.id}
              active={activeQueue === queue.id}
              label={queue.label}
              count={queue.count}
              tone={queue.tone}
              description={queue.description}
              onClick={() => setActiveQueue(queue.id)}
            />
          ))}
        </div>
      </section>

      <details className="group editorial-panel rounded-lg p-4 shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <SectionHeader
            title="Specialty Coverage"
            subtitle={`${overview.specialties.length} specialty groups`}
          />
          <span className="text-xs font-semibold text-slate-500 group-open:hidden">
            Open
          </span>
        </summary>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {overview.specialties.map((item) => (
            <SpecialtyCoverageRow key={item.specialty} item={item} />
          ))}
        </div>
      </details>

      <details className="group editorial-panel rounded-lg p-4 shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <SectionHeader title="Inventory Forecast" subtitle="Daily queue depth" />
          <span className="text-xs font-semibold text-slate-500 group-open:hidden">
            Open
          </span>
        </summary>
        <div className="mt-4">
          <InventoryRiskBanner overview={overview} inventoryHealth={inventoryHealth} />
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
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
            <div className="mt-4 rounded-lg border border-[var(--color-navy-border)] bg-white/5 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
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
                <p className="mt-3 rounded-lg border border-[var(--color-amber)]/30 bg-[var(--color-amber)]/10 px-3 py-2 text-sm font-medium text-[var(--color-amber)]">
                  Inventory exhaustion risk: fewer than seven assignable cases.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </details>

      <section className="editorial-panel rounded-lg p-4 shadow-sm">
        <SectionHeader
          title="Weak Diagnoses"
          subtitle={`${filteredWeakDiagnoses.length} shown`}
        />
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {filteredWeakDiagnoses.map((diagnosis) => {
            const triage =
              diagnosis.editorialTriage ?? diagnosis.editorialPrioritization;
            const targetUrl = targetUrlWithTab(
              diagnosis.targetUrl,
              triage?.targetTab,
            );
            const firstUnsupportedClaim =
              diagnosis.unsupportedClaims?.unsupportedClaimSignalsPreview[0] ??
              null;
            const firstClaimUrl = firstUnsupportedClaim
              ? buildUnsupportedClaimDeepLink({
                  targetUrl: diagnosis.targetUrl,
                  claimId: firstUnsupportedClaim.claimId,
                  sectionId: firstUnsupportedClaim.sectionId,
                  targetTab: firstUnsupportedClaim.targetTab,
                })
              : null;

            return (
              <article
                key={diagnosis.diagnosisRegistryId}
                className="rounded-lg border border-[var(--color-navy-border)] bg-white/5 p-4 transition hover:border-[var(--color-teal)]/40 hover:bg-white/10"
              >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link
                    to={diagnosis.targetUrl}
                    className="font-semibold text-slate-100 hover:text-[var(--color-teal)]"
                  >
                    {diagnosis.diagnosisName}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-slate-400">
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
                <div className="flex flex-wrap justify-end gap-2">
                  {triage?.editorialPriority ? (
                    <StatusBadge
                      status={`${triage.editorialPriority.score} ${formatLabel(
                        triage.editorialPriority.tier,
                      )}`}
                      tone={riskTone(triage.editorialPriority.tier)}
                    />
                  ) : null}
                  {triage?.publicationRisk ? (
                    <StatusBadge
                      status={`Pub ${formatLabel(triage.publicationRisk.tier)}`}
                      tone={riskTone(triage.publicationRisk.tier)}
                    />
                  ) : null}
                  <StatusBadge status={diagnosis.lifecycleState} />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {diagnosisQueueIds(diagnosis).slice(0, 4).map((queueId) => (
                  <span
                    key={queueId}
                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${queueChipClass(queueId)}`}
                  >
                    {formatLabel(queueId)}
                  </span>
                ))}
                {diagnosis.weaknesses.slice(0, 5).map((weakness) => (
                  <span
                    key={weakness}
                    className="rounded-full border border-[var(--color-navy-border)] bg-white/5 px-2.5 py-1 text-xs font-semibold text-slate-300"
                  >
                    {formatLabel(weakness)}
                  </span>
                ))}
              </div>
              {triage?.recommendedNextAction ? (
                <div className="mt-3 rounded-lg border border-[var(--color-navy-border)] bg-[var(--color-navy-mid)]/70 px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Next action
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-100">
                    {triage.recommendedNextAction}
                  </p>
                  {triage.triageReasons?.length ? (
                    <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-400">
                      {triage.triageReasons.slice(0, 2).map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
              {diagnosis.unsupportedClaims?.unsupportedClaimCount ? (
                <div className="mt-3 rounded-lg border border-[var(--color-rose)]/30 bg-[var(--color-rose)]/10 px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-rose-100">
                      Unsupported claims
                    </p>
                    <StatusBadge
                      status={`${diagnosis.unsupportedClaims.unsupportedClaimCount} signal${
                        diagnosis.unsupportedClaims.unsupportedClaimCount === 1
                          ? ''
                          : 's'
                      }`}
                      tone={
                        diagnosis.unsupportedClaims.blockingUnsupportedClaimCount
                          ? 'danger'
                          : 'warning'
                      }
                    />
                  </div>
                  <p className="mt-1 text-xs leading-5 text-rose-200">
                    {diagnosis.unsupportedClaims.blockingUnsupportedClaimCount
                      ? `${diagnosis.unsupportedClaims.blockingUnsupportedClaimCount} block publication.`
                      : 'Needs editor verification before readiness review.'}
                    {diagnosis.unsupportedClaims.unsupportedClaimSectionTypes
                      .length
                      ? ` Sections: ${diagnosis.unsupportedClaims.unsupportedClaimSectionTypes
                          .map(formatLabel)
                          .join(', ')}.`
                      : ''}
                  </p>
                  {diagnosis.unsupportedClaims.unsupportedClaimSignalsPreview
                    .length ? (
                    <div className="mt-2 space-y-1">
                      {diagnosis.unsupportedClaims.unsupportedClaimSignalsPreview
                        .slice(0, 2)
                        .map((claim) => (
                          <Link
                            key={`${claim.sectionId ?? claim.sectionType}-${claim.claimId ?? claim.claimText}`}
                            to={buildUnsupportedClaimDeepLink({
                              targetUrl: diagnosis.targetUrl,
                              claimId: claim.claimId,
                              sectionId: claim.sectionId,
                              targetTab: claim.targetTab,
                            })}
                            className="block rounded-md border border-[var(--color-rose)]/25 bg-white/5 px-2 py-1.5 text-xs leading-5 text-rose-100 transition hover:border-[var(--color-rose)]/50 hover:bg-white/10"
                          >
                            <span className="font-semibold">
                              {formatLabel(claim.sectionType)}
                            </span>
                            {': '}
                            {claim.claimText}
                          </Link>
                        ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  to={diagnosis.targetUrl}
                  className="rounded-md border border-[var(--color-navy-border)] bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-[var(--color-teal)]/40 hover:bg-[var(--color-teal)]/10"
                >
                  Open workspace
                </Link>
                <Link
                  to={targetUrl}
                  className="rounded-md border border-[var(--color-teal)]/30 bg-[var(--color-teal)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--color-teal)] transition hover:bg-[var(--color-teal)]/15"
                >
                  Open target tab
                </Link>
                {firstClaimUrl ? (
                  <Link
                    to={firstClaimUrl}
                    className="rounded-md border border-[var(--color-rose)]/30 bg-[var(--color-rose)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--color-rose)] transition hover:bg-[var(--color-rose)]/15"
                  >
                    Repair claim
                  </Link>
                ) : null}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                <TinyMetric label="Rules" value={diagnosis.teaching.activeRuleCount} />
                <TinyMetric label="Cases" value={diagnosis.inventory.playableCaseCount} />
                <TinyMetric label="Diffs" value={diagnosis.differentials.linkedDifferentialCount} />
                <TinyMetric label="Graph" value={diagnosis.graph.relationshipCount} />
              </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="grid min-w-0 gap-5 sm:grid-cols-2 xl:grid-cols-4">
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

      <section className="editorial-panel rounded-lg p-4 shadow-sm">
        <SectionHeader
          title="Evidence Readiness"
          subtitle="Reasoning coverage and generation prerequisites"
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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

      <section className="editorial-panel rounded-lg p-4 shadow-sm">
        <SectionHeader title="Planning Hooks" subtitle="Advisory metadata only" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
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

function buildOperationsSummary(
  overview: EditorialCoverageOverview,
  inventoryHealth: CaseInventoryHealth | null,
  diagnoses: EditorialCoverageOverview['weakDiagnoses'],
) {
  const highPublicationRisk = diagnoses.filter((diagnosis) =>
    diagnosisQueueIds(diagnosis).includes('high_publication_risk'),
  ).length;
  const sparseDiagnoses = diagnoses.filter((diagnosis) =>
    diagnosisQueueIds(diagnosis).includes('sparse_diagnosis'),
  ).length;
  const unsupportedClaims = diagnoses.reduce(
    (total, diagnosis) =>
      total + (diagnosis.unsupportedClaims?.unsupportedClaimCount ?? 0),
    0,
  );
  const assignableCases =
    inventoryHealth?.schedulerEligibleCount ??
    overview.inventory.inventoryExhaustionForecast.assignableCases;
  const exhaustionDays =
    overview.inventory.inventoryExhaustionForecast.estimatedExhaustionDays;
  const inventoryRisk = assignableCases < 7 || exhaustionDays < 7;

  return {
    inventoryRisk,
    inventoryRiskLabel: inventoryRisk ? 'Inventory risk' : 'Inventory stable',
    items: [
      {
        label: 'Weak diagnoses',
        value: diagnoses.length,
        detail: 'Need editorial attention',
        tone: diagnoses.length ? 'warning' : 'success',
      },
      {
        label: 'High pub risk',
        value: highPublicationRisk,
        detail: 'Blockers or readiness failures',
        tone: highPublicationRisk ? 'danger' : 'success',
      },
      {
        label: 'Unsupported claims',
        value: unsupportedClaims,
        detail: 'Claim repair candidates',
        tone: unsupportedClaims ? 'danger' : 'success',
      },
      {
        label: 'Sparse diagnoses',
        value: sparseDiagnoses,
        detail: 'Low editorial coverage',
        tone: sparseDiagnoses ? 'warning' : 'success',
      },
      {
        label: 'Assignable cases',
        value: assignableCases,
        detail: `${exhaustionDays} day${exhaustionDays === 1 ? '' : 's'} to exhaustion`,
        tone: inventoryRisk ? 'warning' : 'success',
      },
    ] satisfies Array<{
      label: string;
      value: number;
      detail: string;
      tone: StatusBadgeTone;
    }>,
  };
}

function OperationsMetric({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: number;
  detail: string;
  tone: StatusBadgeTone;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-navy-border)] bg-white/5 px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          {label}
        </p>
        <StatusBadge status={String(value)} tone={tone} />
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  );
}

function InventoryRiskBanner({
  overview,
  inventoryHealth,
}: {
  overview: EditorialCoverageOverview;
  inventoryHealth: CaseInventoryHealth | null;
}) {
  const assignableCases =
    inventoryHealth?.schedulerEligibleCount ??
    overview.inventory.inventoryExhaustionForecast.assignableCases;
  const exhaustionDays =
    overview.inventory.inventoryExhaustionForecast.estimatedExhaustionDays;
  const risk = assignableCases < 7 || exhaustionDays < 7;

  return (
    <div
      className={[
        'rounded-lg border px-3 py-2',
        risk
          ? 'border-[var(--color-amber)]/30 bg-[var(--color-amber)]/10'
          : 'border-[var(--color-green)]/25 bg-[var(--color-green)]/10',
      ].join(' ')}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-100">
          {risk ? 'Inventory needs attention' : 'Inventory coverage is stable'}
        </p>
        <StatusBadge
          status={`${assignableCases} assignable`}
          tone={risk ? 'warning' : 'success'}
        />
      </div>
      <p className="mt-1 text-xs leading-5 text-slate-400">
        {exhaustionDays} estimated exhaustion day
        {exhaustionDays === 1 ? '' : 's'} with{' '}
        {overview.inventory.inventoryExhaustionForecast.scheduledDays} scheduled
        day{overview.inventory.inventoryExhaustionForecast.scheduledDays === 1 ? '' : 's'}.
      </p>
    </div>
  );
}

function SpecialtyCoverageRow({
  item,
}: {
  item: EditorialCoverageOverview['specialties'][number];
}) {
  return (
    <article className="rounded-lg border border-[var(--color-navy-border)] bg-white/5 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-100">
            <SpecialtyIcon
              specialty={item.specialty}
              className="h-4 w-4 text-[var(--color-teal)]"
            />
            {item.specialty}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {item.playableDiagnosisCount}/{item.diagnosisCount} playable
            diagnoses
          </p>
        </div>
        <StatusBadge
          status={`${item.unresolvedDifferentialCount} unresolved`}
          tone={item.unresolvedDifferentialCount ? 'warning' : 'success'}
        />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <TinyMetric label="Cases" value={item.caseCount} />
        <TinyMetric label="Education" value={item.educationCoveragePercent} />
        <TinyMetric label="Graph" value={item.graphCoveragePercent} />
        <TinyMetric label="Diffs" value={item.unresolvedDifferentialCount} />
      </div>
    </article>
  );
}

function riskTone(tier: string): StatusBadgeTone {
  if (tier === 'critical' || tier === 'high') return 'danger';
  if (tier === 'medium') return 'warning';
  if (tier === 'low') return 'success';
  return 'neutral';
}

function queueChipClass(queueId: string) {
  if (
    queueId === 'high_publication_risk' ||
    queueId === 'unsupported_claims' ||
    queueId === 'escalation_coverage_gaps'
  ) {
    return 'border-[var(--color-rose)]/30 bg-[var(--color-rose)]/10 text-[var(--color-rose)]';
  }
  if (queueId === 'needs_review') {
    return 'border-[var(--color-teal)]/30 bg-[var(--color-teal)]/10 text-[var(--color-teal)]';
  }
  return 'border-[var(--color-amber)]/30 bg-[var(--color-amber)]/10 text-[var(--color-amber)]';
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-base font-semibold text-slate-100">{title}</h2>
      <span className="text-sm text-slate-400">{subtitle}</span>
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
    <div className="rounded-lg border border-[var(--color-navy-border)] bg-white/5 px-4 py-3 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
        {label}
      </p>
      <p
        className={`mt-2 font-semibold text-slate-100 ${
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
    <div className="rounded-lg border border-[var(--color-navy-border)] bg-white/5 px-2 py-2">
      <p className="text-[11px] font-semibold uppercase text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-100">{value}</p>
    </div>
  );
}

function QueueButton({
  active,
  label,
  count,
  tone,
  description,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  tone: 'danger' | 'warning' | 'neutral';
  description?: string;
  onClick: () => void;
}) {
  const toneClass =
    tone === 'danger'
      ? 'border-[var(--color-rose)]/35 bg-[var(--color-rose)]/10 text-rose-100'
      : tone === 'warning'
        ? 'border-[var(--color-amber)]/35 bg-[var(--color-amber)]/10 text-amber-100'
        : 'border-[var(--color-navy-border)] bg-white/5 text-slate-100';

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-lg border px-4 py-3 text-left transition hover:-translate-y-0.5 hover:bg-white/10',
        toneClass,
        active ? 'ring-2 ring-[var(--color-teal)]/35' : '',
      ].join(' ')}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="text-sm font-semibold">{label}</span>
        <span className="rounded-full border border-current/20 px-2 py-0.5 text-xs font-semibold">
          {count}
        </span>
      </span>
      {description ? (
        <span className="mt-2 block text-xs leading-5 opacity-75">
          {description}
        </span>
      ) : null}
    </button>
  );
}

function HealthRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-400">{label}</span>
      <span className="font-semibold text-slate-100">{value}</span>
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
    <section className="editorial-panel rounded-lg p-4 shadow-sm">
      <SectionHeader title={title} subtitle="" />
      <div className="mt-4 space-y-3">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex items-center justify-between border-b border-[var(--color-navy-border)] pb-2 text-sm"
          >
            <span className="text-slate-400">{label}</span>
            <span className="font-semibold text-slate-100">{value}</span>
          </div>
        ))}
      </div>
      <Link
        to={link}
        className="mt-4 inline-flex text-sm font-semibold text-[var(--color-teal)] hover:text-slate-100"
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

function targetUrlWithTab(targetUrl: string, targetTab: string | undefined) {
  if (!targetTab || targetTab === 'overview') {
    return targetUrl;
  }
  return `${targetUrl}?tab=${encodeURIComponent(targetTab)}`;
}
