import { useAuth } from '@clerk/clerk-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getEditorialInbox,
  type EditorialInboxItem,
  type EditorialInboxItemType,
  type EditorialInboxResponse,
  type EditorialInboxSeverity,
} from '../../api/admin';
import { createApiClient } from '../../api/client';
import ErrorState from '../../components/ui/ErrorState';
import StatusBadge from '../../components/ui/StatusBadge';
import type { StatusBadgeTone } from '../../components/ui/statusBadgeMeta';

const typeOptions: Array<EditorialInboxItemType | ''> = [
  '',
  'teachingRules',
  'briefs',
  'education',
  'cases',
  'graphCandidates',
  'differentials',
  'registryCandidates',
  'onboarding',
  'mergeRisks',
];

const severityOptions: Array<EditorialInboxSeverity | ''> = [
  '',
  'blocker',
  'urgent',
  'normal',
  'low',
];

export default function EditorialReviewInboxPage() {
  const { getToken } = useAuth();
  const client = useMemo(() => createApiClient(getToken), [getToken]);
  const [type, setType] = useState<EditorialInboxItemType | ''>('');
  const [severity, setSeverity] = useState<EditorialInboxSeverity | ''>('');
  const [status, setStatus] = useState('');
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
          type,
          severity,
          status: status.trim() || undefined,
          specialty: specialty.trim() || undefined,
          limit: 150,
        });
        if (active) {
          setResponse(result);
        }
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
  }, [client, severity, specialty, status, type]);

  return (
    <div className="space-y-5">
      <div>
        <Link to="/editorial" className="text-sm font-semibold text-slate-600 hover:text-slate-900">
          Back to editorial
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">
          Review Inbox
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Unified read-first queue for existing editorial review surfaces.
        </p>
      </div>

      {error ? <ErrorState title="Inbox unavailable" message={error} /> : null}

      <section className="grid gap-3 md:grid-cols-4">
        <SummaryCard label="Total" value={response?.summary.total} />
        <SummaryCard label="Blockers" value={response?.summary.blockers} tone="danger" />
        <SummaryCard label="Urgent" value={response?.summary.urgent} tone="warning" />
        <SummaryCard label="Needs review" value={response?.summary.needsReview} tone="info" />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-4">
          <FilterSelect
            label="Type"
            value={type}
            onChange={(value) => setType(value as EditorialInboxItemType | '')}
            options={typeOptions}
          />
          <FilterSelect
            label="Severity"
            value={severity}
            onChange={(value) =>
              setSeverity(value as EditorialInboxSeverity | '')
            }
            options={severityOptions}
          />
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Status
            </span>
            <input
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="NEEDS_REVIEW"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Specialty
            </span>
            <input
              value={specialty}
              onChange={(event) => setSpecialty(event.target.value)}
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Cardiology"
            />
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <p className="text-base font-semibold text-slate-900">
            Review items
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Open links route to the existing review pages. No inline actions are
            performed here.
          </p>
        </div>
        {loading ? (
          <p className="p-5 text-sm text-slate-600">Loading inbox...</p>
        ) : response?.items.length ? (
          <div className="divide-y divide-slate-100">
            {response.items.map((item) => (
              <InboxRow key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="p-8 text-center">
            <p className="text-base font-semibold text-slate-900">
              No review items found
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Adjust filters or come back when new editorial work enters a
              reviewable state.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone = 'info',
}: {
  label: string;
  value: number | undefined;
  tone?: StatusBadgeTone;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          {label}
        </p>
        <StatusBadge status={tone} tone={tone} />
      </div>
      <p className="mt-3 text-3xl font-semibold text-slate-950">
        {value ?? '...'}
      </p>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      >
        {options.map((option) => (
          <option key={option || 'all'} value={option}>
            {option ? formatLabel(option) : 'All'}
          </option>
        ))}
      </select>
    </label>
  );
}

function InboxRow({ item }: { item: EditorialInboxItem }) {
  return (
    <div className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_180px]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={formatLabel(item.type)} tone="info" />
          <StatusBadge
            status={formatLabel(item.severity)}
            tone={severityTone(item.severity)}
          />
          <StatusBadge status={item.status} />
        </div>
        <p className="mt-3 text-base font-semibold text-slate-950">
          {item.title}
        </p>
        <p className="mt-1 text-sm text-slate-600">{item.subtitle}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm text-slate-500">
          {item.diagnosisLabel ? (
            <span>{item.diagnosisLabel}</span>
          ) : null}
          {item.specialty ? <span>{item.specialty}</span> : null}
          <span>{item.recommendedAction}</span>
        </div>
        {item.blockerReason ? (
          <p className="mt-2 text-sm font-semibold text-rose-700">
            {item.blockerReason}
          </p>
        ) : null}
      </div>
      <div className="flex items-center lg:justify-end">
        <Link
          to={item.targetUrl}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          Open
        </Link>
      </div>
    </div>
  );
}

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
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
