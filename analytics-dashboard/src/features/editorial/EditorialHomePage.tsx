import { useAuth } from '@clerk/clerk-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  searchDiagnosisRegistry,
  type DiagnosisRegistrySearchItem,
} from '../../api/admin';
import { createApiClient } from '../../api/client';
import ErrorState from '../../components/ui/ErrorState';
import StatusBadge from '../../components/ui/StatusBadge';
import {
  useConsoleAccess,
  type ConsoleAccessState,
} from '../../hooks/useConsoleAccess';

const quickLinks = [
  {
    to: '/cases',
    label: 'Browse cases',
    description: 'Review individual generated cases and diagnosis links.',
  },
  {
    to: '/editorial/differentials',
    label: 'Unresolved differentials',
    description: 'Resolve case and education differential text into registry links.',
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
              Queue-level diagnosis coverage metrics will appear here once the
              editorial home has a dedicated aggregate read model.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <QueuePlaceholder
                title="Coverage attention"
                description="Use diagnosis search to inspect blockers and coverage gaps."
              />
              <QueuePlaceholder
                title="Readiness attention"
                description="Open workspaces to review lifecycle and graph readiness."
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
                {[
                  result.specialty,
                  result.bodySystem,
                  result.category,
                  result.difficultyBand,
                ]
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
              <StatusBadge status={formatLabel(result.matchSource)} tone="info" />
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

function QueuePlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
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
