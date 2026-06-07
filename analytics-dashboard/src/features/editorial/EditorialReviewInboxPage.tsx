import { useAuth } from '@clerk/clerk-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getEditorialInbox,
  type EditorialInboxItem,
  type EditorialInboxResponse,
  type EditorialInboxSeverity,
} from '../../api/admin';
import { createApiClient } from '../../api/client';
import ErrorState from '../../components/ui/ErrorState';
import StatusBadge from '../../components/ui/StatusBadge';
import type { StatusBadgeTone } from '../../components/ui/statusBadgeMeta';

type SeverityFilter = EditorialInboxSeverity | '';

const severityFilters: Array<{ value: SeverityFilter; label: string }> = [
  { value: '', label: 'All' },
  { value: 'blocker', label: 'Blockers' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Low' },
];

export default function EditorialReviewInboxPage() {
  const { getToken } = useAuth();
  const client = useMemo(() => createApiClient(getToken), [getToken]);
  const [severity, setSeverity] = useState<SeverityFilter>('');
  const [specialty, setSpecialty] = useState('');
  const [response, setResponse] = useState<EditorialInboxResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadInbox() {
      try {
        setLoading(true);
        setError(null);
        const result = await getEditorialInbox(client, {
          severity,
          specialty: specialty.trim() || undefined,
          limit: 150,
        });
        if (active) setResponse(result);
      } catch (loadError) {
        if (!active) return;
        setResponse(null);
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Failed to load editorial inbox.',
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadInbox();
    return () => {
      active = false;
    };
  }, [client, severity, specialty]);

  const items = response?.items ?? [];
  const summary = response?.summary;

  return (
    <div className="space-y-5">
      <div>
        <Link
          to="/editorial"
          className="text-sm font-semibold text-slate-600 hover:text-slate-900"
        >
          ‹ Back to editorial
        </Link>
        <h1 className="mt-2 text-[26px] font-semibold text-slate-950 leading-tight">
          Review Inbox
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Unified read-first queue for editorial review surfaces.
        </p>
      </div>

      {error ? <ErrorState title="Inbox unavailable" message={error} /> : null}

      {/* Summary metrics */}
      <div className="grid gap-3 sm:grid-cols-4">
        <SummaryCard label="Total" value={summary?.total} />
        <SummaryCard label="Blockers" value={summary?.blockers} tone="danger" />
        <SummaryCard label="Urgent" value={summary?.urgent} tone="warning" />
        <SummaryCard label="Needs review" value={summary?.needsReview} tone="info" />
      </div>

      {/* Severity tab filter + specialty input */}
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {severityFilters.map((filter) => (
            <button
              key={filter.value || 'all'}
              type="button"
              onClick={() => setSeverity(filter.value)}
              className={[
                'rounded-lg px-4 py-2 text-sm font-semibold transition',
                severity === filter.value
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900',
              ].join(' ')}
            >
              {filter.label}
              {summary && filter.value === 'blocker'
                ? ` · ${summary.blockers}`
                : summary && filter.value === 'urgent'
                  ? ` · ${summary.urgent}`
                  : filter.value === ''
                    ? ` · ${summary?.total ?? '…'}`
                    : ''}
            </button>
          ))}
        </div>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Filter by specialty
          </span>
          <input
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
            className="mt-2 w-full max-w-xs rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            placeholder="Cardiology, Respiratory…"
          />
        </label>
      </div>

      {/* Items list */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <p className="text-base font-semibold text-slate-900">Review items</p>
          <span className="text-sm text-slate-500">
            {loading ? '…' : `${items.length} item${items.length !== 1 ? 's' : ''}`}
          </span>
        </div>

        {loading ? (
          <p className="p-6 text-sm text-slate-600">Loading inbox…</p>
        ) : items.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {items.map((item) => (
              <InboxRow key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="p-10 text-center">
            <p className="text-base font-semibold text-slate-900">
              No review items found
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Adjust filters or check back when new items enter a reviewable
              state.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InboxRow({ item }: { item: EditorialInboxItem }) {
  const urgencyDot =
    item.severity === 'blocker'
      ? 'bg-rose-500'
      : item.severity === 'urgent'
        ? 'bg-amber-500'
        : 'bg-slate-300';

  return (
    <div className="grid gap-4 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_160px]">
      <div className="flex min-w-0 items-start gap-3">
        {/* Urgency dot */}
        <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${urgencyDot}`} />

        <div className="min-w-0">
          {/* Badges row */}
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              status={formatLabel(item.type)}
              tone="info"
            />
            <StatusBadge
              status={formatLabel(item.severity)}
              tone={severityTone(item.severity)}
            />
            <StatusBadge status={item.status} />
          </div>

          {/* Title + subtitle */}
          <p className="mt-2 text-base font-semibold text-slate-950 leading-snug">
            {item.title}
          </p>
          <p className="mt-0.5 text-sm text-slate-600 leading-snug">
            {item.subtitle}
          </p>

          {/* Diagnosis + specialty + action */}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
            {item.diagnosisLabel ? (
              <span className="font-medium text-slate-700">
                {item.diagnosisLabel}
              </span>
            ) : null}
            {item.specialty ? <span>{item.specialty}</span> : null}
            <span className="italic">{item.recommendedAction}</span>
          </div>

          {/* Blocker reason */}
          {item.blockerReason ? (
            <p className="mt-2 text-sm font-semibold text-rose-700">
              {item.blockerReason}
            </p>
          ) : null}
        </div>
      </div>

      {/* Action */}
      <div className="flex items-center sm:justify-end">
        <Link
          to={item.targetUrl}
          className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Open
        </Link>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: number | undefined;
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
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          {label}
        </p>
        <StatusBadge status={tone} tone={tone} />
      </div>
      <p className={`mt-3 text-3xl font-semibold ${numClass}`}>
        {value ?? '…'}
      </p>
    </div>
  );
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function severityTone(severity: EditorialInboxSeverity): StatusBadgeTone {
  if (severity === 'blocker') return 'danger';
  if (severity === 'urgent') return 'warning';
  if (severity === 'normal') return 'info';
  return 'neutral';
}

function formatLabel(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
