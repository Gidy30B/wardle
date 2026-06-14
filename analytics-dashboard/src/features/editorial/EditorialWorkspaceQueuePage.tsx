import { useAuth } from '@clerk/clerk-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getCurriculumPlannerOverview,
  type CurriculumPlannerDiagnosis,
  type CurriculumPlannerFilters,
  type CurriculumPlannerOverview,
  type CurriculumPriorityTier,
} from '../../api/admin';
import { createApiClient } from '../../api/client';
import ErrorState from '../../components/ui/ErrorState';
import LoadingState from '../../components/ui/LoadingState';
import StatusBadge from '../../components/ui/StatusBadge';
import type { StatusBadgeTone } from '../../components/ui/statusBadgeMeta';
import { SpecialtyIcon } from '../specialties/specialty-icons';

type SortKey = 'priority' | 'name' | 'specialty';

const sortOptions: Array<{ value: SortKey; label: string }> = [
  { value: 'priority', label: 'Priority' },
  { value: 'name', label: 'Name' },
  { value: 'specialty', label: 'Specialty' },
];

export default function EditorialWorkspaceQueuePage() {
  const { getToken } = useAuth();
  const client = useMemo(() => createApiClient(getToken), [getToken]);
  const [filters, setFilters] = useState<CurriculumPlannerFilters>({
    priorityTier: '',
    track: '',
    playableOnly: false,
  });
  const [overview, setOverview] = useState<CurriculumPlannerOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('priority');

  useEffect(() => {
    let active = true;

    async function loadQueue() {
      try {
        setLoading(true);
        setError(null);
        const response = await getCurriculumPlannerOverview(client, filters);
        if (active) {
          setOverview(response);
        }
      } catch (loadError) {
        if (!active) return;
        setOverview(null);
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Failed to load workspace queue.',
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadQueue();

    return () => {
      active = false;
    };
  }, [client, filters]);

  const sorted = useMemo<CurriculumPlannerDiagnosis[]>(() => {
    const items = overview?.priorityDiagnoses ?? [];
    return [...items].sort((a, b) => {
      if (sort === 'name') return a.diagnosisName.localeCompare(b.diagnosisName);
      if (sort === 'specialty')
        return (a.specialty ?? '').localeCompare(b.specialty ?? '');
      return b.priorityScore - a.priorityScore;
    });
  }, [overview, sort]);

  if (loading && !overview) {
    return (
      <LoadingState
        title="Loading workspace queue"
        description="Fetching your editorial diagnosis queue."
      />
    );
  }

  if (error && !overview) {
    return <ErrorState title="Queue unavailable" message={error} />;
  }

  return (
    <div className="space-y-5">
      {error ? <ErrorState title="Refresh failed" message={error} /> : null}

      {/* Summary strip */}
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryMetric
          label="Diagnoses"
          value={overview?.summary.diagnosisCount}
          sub="in queue"
        />
        <SummaryMetric
          label="High priority"
          value={overview?.summary.highPriorityDiagnoses}
          sub="need attention"
          tone="warning"
        />
        <SummaryMetric
          label="Specialty risks"
          value={overview?.summary.specialtyRiskCount}
          sub="coverage gaps"
          tone={
            (overview?.summary.specialtyRiskCount ?? 0) > 0
              ? 'danger'
              : 'neutral'
          }
        />
      </div>

      {/* Filter + sort bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex-1">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Priority tier
          </span>
          <div className="mt-2 flex gap-2">
            {(['', 'high', 'medium', 'low'] as Array<
              CurriculumPriorityTier | ''
            >).map((tier) => (
              <button
                key={tier || 'all'}
                type="button"
                onClick={() =>
                  setFilters((prev) => ({ ...prev, priorityTier: tier }))
                }
                className={[
                  'rounded-lg px-3 py-1.5 text-sm font-semibold transition',
                  filters.priorityTier === tier
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-200 text-slate-600 hover:bg-slate-50',
                ].join(' ')}
              >
                {tier ? capitalize(tier) : 'All'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-shrink-0">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Sort by
          </span>
          <div className="mt-2 flex gap-2">
            {sortOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSort(opt.value)}
                className={[
                  'rounded-lg px-3 py-1.5 text-sm font-semibold transition',
                  sort === opt.value
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-200 text-slate-600 hover:bg-slate-50',
                ].join(' ')}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={filters.playableOnly ?? false}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, playableOnly: e.target.checked }))
            }
            className="rounded border-slate-300"
          />
          Playable only
        </label>
      </div>

      {/* Queue rows */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-base font-semibold text-slate-900">
              Editorial queue
            </p>
            <span className="text-sm text-slate-500">
              {sorted.length} diagnosis{sorted.length !== 1 ? 'es' : ''}
            </span>
          </div>
        </div>

        {loading ? (
          <p className="p-5 text-sm text-slate-600">Refreshing queue...</p>
        ) : sorted.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-base font-semibold text-slate-900">
              No diagnoses found
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Adjust the priority or playable filter.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {sorted.map((diagnosis) => (
              <QueueRow key={diagnosis.diagnosisRegistryId} diagnosis={diagnosis} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function QueueRow({ diagnosis }: { diagnosis: CurriculumPlannerDiagnosis }) {
  const score = Math.round(diagnosis.priorityScore * 100);
  const scoreTone: StatusBadgeTone =
    diagnosis.priorityTier === 'high'
      ? 'danger'
      : diagnosis.priorityTier === 'medium'
        ? 'warning'
        : 'neutral';

  return (
    <div className="grid gap-4 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_200px]">
      <div className="flex min-w-0 items-start gap-4">
        {/* Priority ring */}
        <div className="relative h-11 w-11 shrink-0">
          <svg viewBox="0 0 44 44" className="h-full w-full -rotate-90">
            <circle
              cx="22"
              cy="22"
              r="17"
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="3.5"
            />
            <circle
              cx="22"
              cy="22"
              r="17"
              fill="none"
              stroke={
                diagnosis.priorityTier === 'high'
                  ? '#f43f5e'
                  : diagnosis.priorityTier === 'medium'
                    ? '#f59e0b'
                    : '#94a3b8'
              }
              strokeWidth="3.5"
              strokeDasharray="106.8"
              strokeDashoffset={106.8 * (1 - diagnosis.priorityScore)}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center font-mono text-[10px] font-semibold text-slate-700">
            {score}
          </span>
        </div>

        {/* Name + meta */}
        <div className="min-w-0">
          <p className="text-base font-semibold text-slate-900 leading-snug">
            {diagnosis.diagnosisName}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {diagnosis.specialty ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs text-slate-600">
                <SpecialtyIcon
                  specialty={diagnosis.specialty}
                  className="h-3 w-3"
                />
                {formatLabel(diagnosis.specialty)}
              </span>
            ) : null}
            {diagnosis.track ? (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs text-slate-600">
                {formatLabel(diagnosis.track)}
              </span>
            ) : null}
            <StatusBadge
              status={capitalize(diagnosis.priorityTier)}
              tone={scoreTone}
            />
            {diagnosis.blockers.length > 0 ? (
              <StatusBadge
                status={`${diagnosis.blockers.length} blocker${diagnosis.blockers.length > 1 ? 's' : ''}`}
                tone="danger"
              />
            ) : null}
          </div>

          {/* Coverage + inventory */}
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
            {diagnosis.evidenceCoverage ? (
              <span>
                Coverage{' '}
                <span className="font-semibold text-slate-700">
                  {Math.round(diagnosis.evidenceCoverage.coverageScore * 100)}%
                </span>
              </span>
            ) : null}
            <span>
              Cases{' '}
              <span className="font-semibold text-slate-700">
                {diagnosis.inventory.playableCaseCount}/
                {diagnosis.inventory.caseCount}
              </span>{' '}
              playable
            </span>
          {diagnosis.inventory.overused ? (
              <StatusBadge status="Overused" tone="warning" />
            ) : null}
          </div>

          <StageTrack currentStage={stageFromDiagnosis(diagnosis)} />

          {/* First blocker reason */}
          {diagnosis.blockers.length > 0 ? (
            <p className="mt-2 text-xs font-semibold text-rose-700 leading-snug">
              {diagnosis.blockers[0]}
            </p>
          ) : diagnosis.priorityReasons.length > 0 ? (
            <p className="mt-2 text-xs text-slate-500 leading-snug">
              {diagnosis.priorityReasons[0]}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center sm:justify-end">
        <Link
          to={diagnosis.targetUrl}
          className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Open workspace
        </Link>
      </div>
    </div>
  );
}

function SummaryMetric({
  label,
  value,
  sub,
  tone = 'neutral',
}: {
  label: string;
  value: number | undefined;
  sub: string;
  tone?: StatusBadgeTone;
}) {
  const numClass =
    tone === 'danger'
      ? 'text-rose-600'
      : tone === 'warning'
        ? 'text-amber-600'
        : 'text-slate-900';

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className={`mt-2 text-3xl font-semibold ${numClass}`}>
        {value ?? '…'}
      </p>
      <p className="mt-1 text-sm text-slate-500">{sub}</p>
    </div>
  );
}

const STAGES = ['Curriculum', 'Brief', 'Education', 'Cases', 'Graph', 'Ready'];

function StageTrack({ currentStage }: { currentStage: string }) {
  const currentIdx = Math.max(0, STAGES.indexOf(currentStage));
  return (
    <div className="mt-2.5 flex items-center overflow-x-auto">
      {STAGES.map((stage, index) => {
        const done = index < currentIdx;
        const current = index === currentIdx;
        return (
          <div key={stage} className="flex items-center">
            {index > 0 ? (
              <div
                className={`h-px w-4 ${
                  done ? 'bg-[var(--color-teal)]' : 'bg-[var(--color-navy-border)]'
                }`}
              />
            ) : null}
            <div className="flex items-center gap-1">
              <div
                className={[
                  'h-[6px] w-[6px] rounded-full',
                  current
                    ? 'bg-slate-900 ring-1 ring-slate-900'
                    : done
                      ? 'bg-[var(--color-teal)]'
                      : 'bg-[var(--color-navy-border)]',
                ].join(' ')}
              />
              {current ? (
                <span className="whitespace-nowrap text-[9px] font-semibold text-slate-700">
                  {stage}
                </span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function stageFromDiagnosis(diagnosis: CurriculumPlannerDiagnosis) {
  const blockers = diagnosis.missingAreas.map((area) => area.toLowerCase());
  if (blockers.some((area) => area.includes('brief') || area.includes('objective'))) {
    return 'Brief';
  }
  if (blockers.some((area) => area.includes('education') || area.includes('teaching'))) {
    return 'Education';
  }
  if (diagnosis.inventory.needsPlayableInventory || blockers.some((area) => area.includes('case'))) {
    return 'Cases';
  }
  if (blockers.some((area) => area.includes('graph') || area.includes('evidence'))) {
    return 'Graph';
  }
  if (diagnosis.blockers.length) {
    return 'Curriculum';
  }
  return 'Ready';
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatLabel(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
