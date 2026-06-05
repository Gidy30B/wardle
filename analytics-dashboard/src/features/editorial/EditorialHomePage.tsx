import { useAuth } from '@clerk/clerk-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getDiagnosisRegistryOnboardingSummary,
  getEditorialInbox,
  searchDiagnosisRegistry,
  type DiagnosisEditorialOnboardingSummary,
  type EditorialInboxSummary,
  type DiagnosisRegistrySearchItem,
} from '../../api/admin';
import { createApiClient } from '../../api/client';
import ErrorState from '../../components/ui/ErrorState';
import StatusBadge from '../../components/ui/StatusBadge';
import {
  useConsoleAccess,
  type ConsoleAccessState,
} from '../../hooks/useConsoleAccess';
import { SpecialtyIcon } from '../specialties/specialty-icons';

const quickLinks = [
  {
    to: '/editorial/inbox',
    label: 'Review Inbox',
    description: 'See the unified read-first queue across editorial work.',
  },
  {
    to: '/cases',
    label: 'Browse cases',
    description: 'Review individual generated cases and diagnosis links.',
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
    description:
      'Resolve case and education differential text into registry links.',
  },
  {
    to: '/editorial/registry-candidates',
    label: 'Registry candidates',
    description: 'Review candidate diagnosis registry entries before creation.',
  },
  {
    to: '/editorial/registry-merge',
    label: 'Registry merge analysis',
    description: 'Dry-run duplicate registry merge impact and conflicts.',
  },
  {
    to: '/diagnosis-graph/candidates',
    label: 'Graph candidates',
    description: 'Promote or reject extracted diagnosis graph candidates.',
  },
  {
    to: '/generate',
    label: 'Generate cases',
    description: 'Create registry-targeted case batches for review.',
    adminOnly: true,
  },
  {
    to: '/publish',
    label: 'Publish queue',
    description: 'Check case readiness and publishing health.',
  },
];

export default function EditorialHomePage() {
  const access = useConsoleAccess();
  const { getToken } = useAuth();
  const client = useMemo(() => createApiClient(getToken), [getToken]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DiagnosisRegistrySearchItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inboxSummary, setInboxSummary] =
    useState<EditorialInboxSummary | null>(null);
  const [queueSummaryError, setQueueSummaryError] = useState<string | null>(
    null,
  );
  const [onboardingSummary, setOnboardingSummary] =
    useState<DiagnosisEditorialOnboardingSummary | null>(null);

  useEffect(() => {
    let active = true;
    const trimmedQuery = query.trim();

    if (trimmedQuery.length < 2) {
      setResults([]);
      setSearching(false);
      setError(null);
      setSearched(false);
      return;
    }

    async function runSearch() {
      try {
        setSearching(true);
        setError(null);
        const response = await searchDiagnosisRegistry(client, {
          q: trimmedQuery,
          limit: 12,
          status: 'ACTIVE',
        });

        if (!active) {
          return;
        }

        setResults(response);
        setSearched(true);
      } catch (searchError) {
        if (!active) {
          return;
        }

        setResults([]);
        setSearched(true);
        setError(
          searchError instanceof Error
            ? searchError.message
            : 'Failed to search diagnosis registry.',
        );
      } finally {
        if (active) {
          setSearching(false);
        }
      }
    }

    const timeoutId = window.setTimeout(() => {
      void runSearch();
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [client, query]);

  useEffect(() => {
    let active = true;

    if (!access.canAccessEditorial) {
      return;
    }

    async function loadQueueSummary() {
      try {
        setQueueSummaryError(null);
        const [inbox, onboarding] = await Promise.all([
          getEditorialInbox(client, { limit: 1 }),
          getDiagnosisRegistryOnboardingSummary(client),
        ]);
        if (active) {
          setInboxSummary(inbox.summary);
          setOnboardingSummary(onboarding);
        }
      } catch (summaryError) {
        if (!active) {
          return;
        }
        setInboxSummary(null);
        setOnboardingSummary(null);
        setQueueSummaryError(
          summaryError instanceof Error
            ? summaryError.message
            : 'Failed to load queue summary.',
        );
      }
    }

    void loadQueueSummary();

    return () => {
      active = false;
    };
  }, [access.canAccessEditorial, client]);

  if (!access.canAccessEditorial) {
    return <AccessDenied access={access} />;
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 text-white shadow-sm">
        <div className="p-5">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
              Editorial
            </p>
            <h2 className="mt-2 text-2xl font-semibold">
              Diagnosis workspace home
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Open a diagnosis workspace to manage curriculum coverage,
              education, case alignment, and graph readiness from one place.
            </p>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <HeaderMetric label="Primary flow" value="Open by diagnosis" />
            <HeaderMetric label="Read model" value="Unified workspace" />
            <HeaderMetric label="Access" value={formatLabel(access.role)} />
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <main className="space-y-5">
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
              <StatusBadge status={`${results.length} results`} tone="info" />
            </div>

            <label className="mt-4 block">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Diagnosis finder
              </span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search appendicitis, asthma, pulmonary embolism..."
                className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-base text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </label>

            {error ? (
              <div className="mt-4">
                <ErrorState title="Search failed" message={error} />
              </div>
            ) : null}

            <DiagnosisSearchResults
              query={query}
              results={results}
              searching={searching}
              searched={searched}
            />
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-base font-semibold text-slate-900">
              Review queues
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Unified counts across cases, education, graph, registry, and
              differential review surfaces.
            </p>
            {queueSummaryError ? (
              <div className="mt-4">
                <ErrorState
                  title="Queue summary failed"
                  message={queueSummaryError}
                />
              </div>
            ) : null}
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <QueueMetric
                label="Total inbox"
                value={inboxSummary?.total}
                helper="Current reviewable items"
              />
              <QueueMetric
                label="Blockers"
                value={inboxSummary?.blockers}
                helper="Identity or merge risks"
              />
              <QueueMetric
                label="Urgent"
                value={inboxSummary?.urgent}
                helper="Ready for review action"
              />
            </div>
            <div className="mt-4">
              <Link
                to="/editorial/inbox"
                className="text-sm font-semibold text-slate-700 hover:text-slate-950"
              >
                Open Review Inbox
              </Link>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-base font-semibold text-slate-900">
              Registry onboarding
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Newly created draft diagnoses and missing editorial assets.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <QueueMetric
                label="New diagnoses"
                value={onboardingSummary?.newlyCreatedDiagnoses}
                helper="Created from candidates"
              />
              <QueueMetric
                label="Missing rules"
                value={onboardingSummary?.diagnosesMissingRules}
                helper="Need curriculum start"
              />
              <QueueMetric
                label="Missing education"
                value={onboardingSummary?.diagnosesMissingEducation}
                helper="Need education draft"
              />
              <QueueMetric
                label="Ready review"
                value={onboardingSummary?.readyForReviewDiagnoses}
                helper="Awaiting senior check"
              />
            </div>
          </section>
        </main>

        <aside className="space-y-5">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">Quick links</p>
            <div className="mt-3 space-y-2">
              {quickLinks
                .filter((link) => !link.adminOnly || access.canAccessAdminOps)
                .map((link) => (
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

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">
              Helpful empty state
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              If a diagnosis does not appear, link a case to an existing
              registry entry or create a registry diagnosis from CaseDetail.
            </p>
          </section>
        </aside>
      </div>
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
  const trimmedQuery = query.trim();

  if (trimmedQuery.length < 2) {
    return (
      <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
        Enter at least two characters to find a diagnosis workspace.
      </div>
    );
  }

  if (searching && !results.length) {
    return (
      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
        Searching diagnosis registry...
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
          Try another canonical name or alias. New registry entries can still be
          created from the diagnosis review section of a case.
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
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={result.status} />
              <StatusBadge
                status={formatLabel(result.matchSource)}
                tone="info"
              />
            </div>
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-3">
            <ResultMetric label="Workspace" value="Open" />
            <ResultMetric label="Education" value="Check workspace" />
            <ResultMetric label="Coverage" value="Check matrix" />
          </div>

          {result.aliasPreview.length ? (
            <p className="mt-3 text-sm text-slate-500">
              Aliases: {result.aliasPreview.join(', ')}
            </p>
          ) : null}
        </Link>
      ))}
    </div>
  );
}

function HeaderMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function ResultMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function QueueMetric({
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
        {value ?? '...'}
      </p>
      <p className="mt-1 text-sm text-slate-500">{helper}</p>
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

function formatLabel(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
