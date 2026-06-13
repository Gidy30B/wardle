import { useAuth } from '@clerk/clerk-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getDiagnosisRegistryOnboardingSummary,
  getDiagnosisRegistryLifecycleTelemetry,
  getEditorialInbox,
  normalizeDiagnosisRegistryLifecycle,
  searchDiagnosisRegistry,
  type DiagnosisEditorialOnboardingSummary,
  type RegistryLifecycleTelemetry,
  type DiagnosisRegistrySearchItem,
  type EditorialInboxItem,
  type EditorialInboxSummary,
} from '../../api/admin';
import { createApiClient } from '../../api/client';
import ErrorState from '../../components/ui/ErrorState';
import StatusBadge from '../../components/ui/StatusBadge';
import {
  useConsoleAccess,
  type ConsoleAccessState,
} from '../../hooks/useConsoleAccess';
import { SpecialtyIcon } from '../specialties/specialty-icons';

function greeting(displayName: string) {
  const hour = new Date().getHours();
  const salutation =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = displayName.split(' ')[0];
  return `${salutation}, ${firstName}.`;
}

export default function EditorialHomePage() {
  const access = useConsoleAccess();
  const { getToken } = useAuth();
  const client = useMemo(() => createApiClient(getToken), [getToken]);

  const [query, setQuery] = useState('');
  const [registryStatus, setRegistryStatus] =
    useState<DiagnosisRegistrySearchItem['status']>('ACTIVE');
  const [results, setResults] = useState<DiagnosisRegistrySearchItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [inboxSummary, setInboxSummary] = useState<EditorialInboxSummary | null>(null);
  const [priorityItems, setPriorityItems] = useState<EditorialInboxItem[]>([]);
  const [onboardingSummary, setOnboardingSummary] =
    useState<DiagnosisEditorialOnboardingSummary | null>(null);
  const [lifecycleTelemetry, setLifecycleTelemetry] =
    useState<RegistryLifecycleTelemetry | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [normalizingLifecycle, setNormalizingLifecycle] = useState(false);
  const [normalizationMessage, setNormalizationMessage] = useState<string | null>(
    null,
  );

  // Debounced diagnosis search
  useEffect(() => {
    let active = true;
    const trimmed = query.trim();

    if (trimmed.length < 2) {
      setResults([]);
      setSearching(false);
      setSearchError(null);
      setSearched(false);
      return;
    }

    async function runSearch() {
      try {
        setSearching(true);
        setSearchError(null);
        const response = await searchDiagnosisRegistry(client, {
          q: trimmed,
          limit: 12,
          status: registryStatus,
        });
        if (!active) return;
        setResults(response);
        setSearched(true);
      } catch (err) {
        if (!active) return;
        setResults([]);
        setSearched(true);
        setSearchError(
          err instanceof Error ? err.message : 'Search failed.',
        );
      } finally {
        if (active) setSearching(false);
      }
    }

    const id = window.setTimeout(() => void runSearch(), 250);
    return () => {
      active = false;
      window.clearTimeout(id);
    };
  }, [client, query, registryStatus]);

  // Load inbox summary + priority items + onboarding
  useEffect(() => {
    let active = true;
    if (!access.canAccessEditorial) return;

    async function loadSummary() {
      try {
        setSummaryError(null);
        const [inboxResponse, onboarding, lifecycle] = await Promise.all([
          getEditorialInbox(client, { severity: 'blocker', limit: 5 }),
          getDiagnosisRegistryOnboardingSummary(client),
          getDiagnosisRegistryLifecycleTelemetry(client),
        ]);
        if (!active) return;
        setInboxSummary(inboxResponse.summary);
        setPriorityItems(inboxResponse.items.slice(0, 4));
        setOnboardingSummary(onboarding);
        setLifecycleTelemetry(lifecycle);
      } catch (err) {
        if (!active) return;
        setSummaryError(
          err instanceof Error ? err.message : 'Failed to load queue summary.',
        );
      }
    }

    void loadSummary();
    return () => {
      active = false;
    };
  }, [access.canAccessEditorial, client]);

  async function runSafeLifecycleNormalization() {
    try {
      setNormalizingLifecycle(true);
      setNormalizationMessage(null);
      setSummaryError(null);
      const result = await normalizeDiagnosisRegistryLifecycle(client);
      const lifecycle = await getDiagnosisRegistryLifecycleTelemetry(client);
      setLifecycleTelemetry(lifecycle);
      setNormalizationMessage(
        `Safe normalization repaired ${result.repaired.length} row${result.repaired.length === 1 ? '' : 's'} and reported ${result.blockers.length} blocker${result.blockers.length === 1 ? '' : 's'}.`,
      );
    } catch (err) {
      setSummaryError(
        err instanceof Error
          ? err.message
          : 'Lifecycle normalization failed.',
      );
    } finally {
      setNormalizingLifecycle(false);
    }
  }

  if (!access.canAccessEditorial) {
    return <AccessDenied access={access} />;
  }

  return (
    <div className="space-y-5">
      {/* Greeting hero */}
      <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 text-white shadow-sm">
        <div className="p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
            Editorial
          </p>
          <h2 className="mt-3 font-serif text-[26px] font-light italic leading-tight">
            {greeting(access.displayName)}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            {(inboxSummary?.blockers ?? 0) > 0 ? (
              <>
                You have{' '}
                <span className="font-semibold text-rose-400">
                  {inboxSummary?.blockers} blocker
                  {(inboxSummary?.blockers ?? 0) !== 1 ? 's' : ''}
                </span>{' '}
                and{' '}
                <span className="font-semibold text-amber-400">
                  {inboxSummary?.urgent} urgent
                </span>{' '}
                items in your inbox.
              </>
            ) : (
              'Open a diagnosis to manage curriculum coverage, education, cases, and graph readiness.'
            )}
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <HeroMetric label="Total inbox" value={inboxSummary?.total} />
            <HeroMetric label="Blockers" value={inboxSummary?.blockers} />
            <HeroMetric label="Role" value={formatLabel(access.role)} isText />
          </div>
        </div>
      </section>

      {summaryError ? (
        <ErrorState title="Summary unavailable" message={summaryError} />
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <main className="space-y-5">
          {/* Priority actions */}
          {priorityItems.length > 0 ? (
            <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                <p className="text-base font-semibold text-slate-900">
                  Priority actions
                </p>
                <StatusBadge
                  status={`${priorityItems.length} blocker${priorityItems.length !== 1 ? 's' : ''}`}
                  tone="danger"
                />
              </div>
              <div className="divide-y divide-slate-100">
                {priorityItems.map((item, i) => (
                  <PriorityActionRow
                    key={item.id}
                    item={item}
                    last={i === priorityItems.length - 1}
                  />
                ))}
              </div>
              <div className="border-t border-slate-100 px-5 py-3">
                <Link
                  to="/editorial/inbox"
                  className="text-sm font-semibold text-slate-700 hover:text-slate-950"
                >
                  View all inbox items →
                </Link>
              </div>
            </section>
          ) : null}

          {/* Diagnosis search */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-base font-semibold text-slate-900">
                  Open by diagnosis
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Search canonical names, display labels, and accepted aliases.
                </p>
              </div>
              {searched ? (
                <StatusBadge status={`${results.length} results`} tone="info" />
              ) : null}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_180px]">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Diagnosis finder
                </span>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search appendicitis, asthma, pulmonary embolism..."
                  className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-base text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Registry status
                </span>
                <select
                  value={registryStatus}
                  onChange={(event) =>
                    setRegistryStatus(
                      event.target.value as DiagnosisRegistrySearchItem['status'],
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                >
                  {['ACTIVE', 'DRAFT', 'HIDDEN', 'DEPRECATED'].map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {searchError ? (
              <div className="mt-4">
                <ErrorState title="Search failed" message={searchError} />
              </div>
            ) : null}

            <DiagnosisSearchResults
              query={query}
              results={results}
              searching={searching}
              searched={searched}
            />
          </section>

          {/* Onboarding */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-base font-semibold text-slate-900">
              Registry onboarding
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Newly created diagnoses and missing editorial assets.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <OnboardingMetric
                label="New diagnoses"
                value={onboardingSummary?.newlyCreatedDiagnoses}
                helper="Created from candidates"
              />
              <OnboardingMetric
                label="Missing rules"
                value={onboardingSummary?.diagnosesMissingRules}
                helper="Need curriculum start"
              />
              <OnboardingMetric
                label="Missing education"
                value={onboardingSummary?.diagnosesMissingEducation}
                helper="Need education draft"
              />
              <OnboardingMetric
                label="Ready for review"
                value={onboardingSummary?.readyForReviewDiagnoses}
                helper="Awaiting senior check"
              />
            </div>
          </section>

          <RegistryLifecycleHealthCard
            telemetry={lifecycleTelemetry}
            busy={normalizingLifecycle}
            message={normalizationMessage}
            onViewDraftRows={() => setRegistryStatus('DRAFT')}
            onNormalize={() => void runSafeLifecycleNormalization()}
          />
        </main>

        {/* Sidebar: quick links */}
        <aside className="space-y-5">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">Quick links</p>
            <div className="mt-3 space-y-2">
              {quickLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="block rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 transition hover:bg-white"
                >
                  <p className="text-sm font-semibold text-slate-900">
                    {link.label}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {link.description}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PriorityActionRow({
  item,
  last,
}: {
  item: EditorialInboxItem;
  last: boolean;
}) {
  return (
    <div
      className={[
        'flex items-start gap-4 px-5 py-4',
        !last ? 'border-b border-slate-100' : '',
      ].join(' ')}
    >
      <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-rose-500" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900 leading-snug">
          {item.title}
        </p>
        <p className="mt-0.5 text-sm text-slate-500 leading-snug">
          {item.subtitle}
        </p>
        {item.diagnosisLabel ? (
          <p className="mt-1 text-xs text-slate-400">{item.diagnosisLabel}</p>
        ) : null}
      </div>
      <Link
        to={item.targetUrl}
        className="shrink-0 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-slate-800"
      >
        Open
      </Link>
    </div>
  );
}

function DiagnosisSearchResults({
  query,
  results,
  searching,
  searched,
}: {
  query: string;
  results: DiagnosisRegistrySearchItem[];
  searching: boolean;
  searched: boolean;
}) {
  const trimmed = query.trim();

  if (trimmed.length < 2) {
    return (
      <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
        Enter at least two characters to find a diagnosis workspace.
      </div>
    );
  }

  if (searching && !results.length) {
    return (
      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
        Searching diagnosis registry…
      </div>
    );
  }

  if (searched && !results.length) {
    return (
      <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5">
        <p className="text-sm font-semibold text-slate-900">
          No matching diagnosis found
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Try another canonical name or alias.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-2">
      {results.map((result) => (
        <Link
          key={result.id}
          to={`/editorial/diagnoses/${result.id}`}
          className="block rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:border-slate-300 hover:bg-white"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-base font-semibold text-slate-900">
                {result.canonicalName}
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-sm text-slate-600">
                {result.specialty ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1">
                    <SpecialtyIcon
                      specialty={result.specialty}
                      className="h-3.5 w-3.5"
                    />
                    {formatLabel(result.specialty)}
                  </span>
                ) : null}
                {[result.bodySystem, result.category, result.difficultyBand]
                  .filter(Boolean)
                  .map((item) => (
                    <span
                      key={String(item)}
                      className="rounded-full border border-slate-200 bg-white px-2.5 py-1"
                    >
                      {formatLabel(String(item))}
                    </span>
                  ))}
              </div>
            </div>
            <StatusBadge status={result.status} />
          </div>
          {result.status !== 'ACTIVE' || !result.isPlayable ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {result.status === 'DRAFT' ? (
                <StatusBadge status="Candidate-created / draft" tone="warning" />
              ) : null}
              {result.status !== 'ACTIVE' ? (
                <StatusBadge status="Not dictionary active" tone="warning" />
              ) : null}
              {result.status === 'ACTIVE' && !result.isPlayable ? (
                <StatusBadge status="Dictionary active, not playable" tone="warning" />
              ) : null}
            </div>
          ) : null}
          {result.aliasPreview.length ? (
            <p className="mt-2 text-sm text-slate-500">
              Aliases: {result.aliasPreview.join(', ')}
            </p>
          ) : null}
        </Link>
      ))}
    </div>
  );
}

function HeroMetric({
  label,
  value,
  isText = false,
}: {
  label: string;
  value: string | number | undefined;
  isText?: boolean;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </p>
      <p
        className={[
          'mt-1 font-semibold text-white',
          isText ? 'text-sm' : 'text-2xl',
        ].join(' ')}
      >
        {value ?? '…'}
      </p>
    </div>
  );
}

function OnboardingMetric({
  label,
  value,
  helper,
}: {
  label: string;
  value: number | undefined;
  helper: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">
        {value ?? '…'}
      </p>
      <p className="mt-1 text-sm text-slate-500">{helper}</p>
    </div>
  );
}

function RegistryLifecycleHealthCard({
  telemetry,
  busy,
  message,
  onViewDraftRows,
  onNormalize,
}: {
  telemetry: RegistryLifecycleTelemetry | null;
  busy: boolean;
  message: string | null;
  onViewDraftRows: () => void;
  onNormalize: () => void;
}) {
  const summary = telemetry?.summary;
  const warningActive = Boolean(
    summary &&
      (summary.driftCount > 0 ||
        summary.missingMetadataCount > 0 ||
        (telemetry?.drift.playableButNotDictionaryVisible.length ?? 0) > 0 ||
        (telemetry?.drift.generatableButNotPlayable.length ?? 0) > 0),
  );

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-base font-semibold text-slate-900">
            Registry Lifecycle Health
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Detect flag drift before it reaches dictionary, autocomplete, or gameplay.
          </p>
        </div>
        <StatusBadge
          status={warningActive ? 'Needs attention' : 'Healthy'}
          tone={warningActive ? 'warning' : 'success'}
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <OnboardingMetric
          label="Total diagnoses"
          value={summary?.totalRegistryRows}
          helper="Registry rows"
        />
        <OnboardingMetric
          label="Dictionary visible"
          value={summary?.dictionaryVisibleRows}
          helper="ACTIVE + active"
        />
        <OnboardingMetric
          label="Playable"
          value={summary?.playableRows}
          helper="Visible + playable"
        />
        <OnboardingMetric
          label="Generatable"
          value={summary?.generatableRows}
          helper="Playable + generation"
        />
        <OnboardingMetric
          label="Draft"
          value={summary?.draftRows}
          helper="Not dictionary active"
        />
        <OnboardingMetric
          label="Drift"
          value={summary?.driftCount}
          helper="Invalid flag states"
        />
        <OnboardingMetric
          label="Blocked"
          value={summary?.activationBlockedCount}
          helper="Need editor review"
        />
        <OnboardingMetric
          label="Missing metadata"
          value={summary?.missingMetadataCount}
          helper="Activation blocker"
        />
      </div>

      {message ? (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          {message}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onViewDraftRows}
          className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          View draft registry rows
        </button>
        <details className="rounded-md border border-amber-200 px-3 py-2 text-sm font-semibold text-amber-700">
          <summary className="cursor-pointer">View lifecycle drift</summary>
          <LifecycleRowList
            rows={[
              ...(telemetry?.drift.draftButActive ?? []),
              ...(telemetry?.drift.draftButPlayable ?? []),
              ...(telemetry?.drift.draftButGeneratable ?? []),
              ...(telemetry?.drift.activeButInactive ?? []),
              ...(telemetry?.drift.generatableButNotPlayable ?? []),
              ...(telemetry?.drift.playableButNotDictionaryVisible ?? []),
            ]}
          />
        </details>
        <details className="rounded-md border border-amber-200 px-3 py-2 text-sm font-semibold text-amber-700">
          <summary className="cursor-pointer">View activation blockers</summary>
          <LifecycleRowList
            rows={telemetry?.blockers.activationBlocked ?? []}
          />
        </details>
        <Link
          to="/editorial/registry-candidates"
          className="rounded-md border border-amber-200 px-3 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-50"
        >
          Registry candidates
        </Link>
        <button
          type="button"
          onClick={onNormalize}
          disabled={busy || !telemetry}
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? 'Normalizing...' : 'Run safe normalization'}
        </button>
      </div>

      {telemetry && summary?.driftCount ? (
        <div className="mt-4 grid gap-2 text-sm md:grid-cols-2">
          <LifecycleWarning
            label="Playable but not dictionary-visible"
            count={telemetry.drift.playableButNotDictionaryVisible.length}
          />
          <LifecycleWarning
            label="Generatable but not playable"
            count={telemetry.drift.generatableButNotPlayable.length}
          />
          <LifecycleWarning
            label="Draft but active"
            count={telemetry.drift.draftButActive.length}
          />
          <LifecycleWarning
            label="Active but inactive"
            count={telemetry.drift.activeButInactive.length}
          />
        </div>
      ) : null}
    </section>
  );
}

function LifecycleRowList({
  rows,
}: {
  rows: RegistryLifecycleTelemetry['drift']['draftButActive'];
}) {
  const uniqueRows = Array.from(new Map(rows.map((row) => [row.id, row])).values());

  if (!uniqueRows.length) {
    return <p className="mt-2 text-sm font-normal text-slate-500">No rows.</p>;
  }

  return (
    <ul className="mt-2 max-h-56 space-y-2 overflow-y-auto text-sm font-normal text-slate-700">
      {uniqueRows.slice(0, 20).map((row) => (
        <li key={row.id}>
          <Link
            to={`/editorial/diagnoses/${row.id}`}
            className="underline hover:text-slate-950"
          >
            {row.displayLabel || row.canonicalName}
          </Link>{' '}
          <span className="text-slate-500">
            {row.status} / active {String(row.active)} / playable{' '}
            {String(row.isPlayable)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function LifecycleWarning({ label, count }: { label: string; count: number }) {
  if (!count) {
    return null;
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
      <span className="font-semibold">{count}</span> {label}
    </div>
  );
}

function AccessDenied({ access }: { access: ConsoleAccessState }) {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <section className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
          Access Restricted
        </p>
        <h2 className="mt-2 text-xl font-semibold text-slate-900">
          Editorial access required
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Current role: <span className="font-semibold">{access.role}</span>.
          Editorial workspaces are available to editor, senior_editor, and admin
          roles.
        </p>
      </section>
    </div>
  );
}

// ─── Static data ──────────────────────────────────────────────────────────────

const quickLinks = [
  {
    to: '/editorial/workspace',
    label: 'Workspace Queue',
    description: 'Prioritised list of diagnoses with coverage scores.',
  },
  {
    to: '/editorial/inbox',
    label: 'Review Inbox',
    description: 'Unified read-first queue across editorial work.',
  },
  {
    to: '/editorial/coverage',
    label: 'Coverage Dashboard',
    description: 'Review curriculum coverage across diagnoses and specialties.',
  },
  {
    to: '/editorial/planner',
    label: 'Curriculum Planner',
    description: 'Prioritize editorial roadmap work from coverage gaps.',
  },
  {
    to: '/editorial/differentials',
    label: 'Unresolved differentials',
    description: 'Resolve case differential text into registry links.',
  },
  {
    to: '/editorial/registry-candidates',
    label: 'Registry candidates',
    description: 'Review proposed registry entries before creation.',
  },
];

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatLabel(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
