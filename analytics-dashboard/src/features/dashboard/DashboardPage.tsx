import { useAuth } from '@clerk/clerk-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getEditorialStatusSummary,
  getPublishResultsSummary,
  getValidationOutcomeSummary,
  type EditorialStatusSummary,
  type PublishResultsSummary,
  type ValidationOutcomeSummary,
} from '../../api/admin';
import { createApiClient } from '../../api/client';
import ErrorState from '../../components/ui/ErrorState';
import LoadingState from '../../components/ui/LoadingState';
import EditorialStatusPanel from './EditorialStatusPanel';
import ValidationOutcomePanel from './ValidationOutcomePanel';

function getTopPublishBlocker(summary: PublishResultsSummary) {
  const totals = new Map<string, number>();

  for (const [status, count] of Object.entries(
    summary.metrics.explicit.rejectedByEditorialStatus,
  )) {
    totals.set(status, (totals.get(status) ?? 0) + count);
  }

  for (const [status, count] of Object.entries(
    summary.metrics.lazy.rejectedByEditorialStatus,
  )) {
    totals.set(status, (totals.get(status) ?? 0) + count);
  }

  const topEntry = [...totals.entries()].sort((left, right) => right[1] - left[1])[0];

  if (!topEntry) {
    return null;
  }

  return {
    status: topEntry[0].toLowerCase().split('_').join(' '),
    count: topEntry[1],
  };
}

function CompactPublishSummary({
  summary,
}: {
  summary: PublishResultsSummary;
}) {
  const topBlocker = getTopPublishBlocker(summary);

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
            Publish snapshot
          </p>
          <h3 className="mt-2 text-base font-semibold text-slate-900">
            Distribution readiness at a glance
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Keep overview-level awareness here, then move into the dedicated publish
            surface for queue inspection.
          </p>
        </div>

        <Link
          to="/publish"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
        >
          Open publish workflow
        </Link>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-white bg-white px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Ready pool
          </p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {summary.currentEligiblePool.readyToPublishCases}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Cases staged for distribution.
          </p>
        </div>

        <div className="rounded-xl border border-white bg-white px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Approved pool
          </p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {summary.currentEligiblePool.approvedCases}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Cases close to publish readiness.
          </p>
        </div>

        <div className="rounded-xl border border-white bg-white px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Main blocker
          </p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {topBlocker ? topBlocker.count : 0}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {topBlocker
              ? `${topBlocker.status} is currently the biggest assignment blocker.`
              : 'No assignment blockers have been recorded.'}
          </p>
        </div>
      </div>
    </section>
  );
}

export default function DashboardPage() {
  const { getToken } = useAuth();
  const client = useMemo(() => createApiClient(getToken), [getToken]);
  const [editorialSummary, setEditorialSummary] =
    useState<EditorialStatusSummary | null>(null);
  const [validationSummary, setValidationSummary] =
    useState<ValidationOutcomeSummary | null>(null);
  const [publishSummary, setPublishSummary] =
    useState<PublishResultsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [
          editorialStatusResponse,
          validationOutcomeResponse,
          publishResultsResponse,
        ] = await Promise.all([
          getEditorialStatusSummary(client),
          getValidationOutcomeSummary(client),
          getPublishResultsSummary(client),
        ]);

        if (!active) {
          return;
        }

        setEditorialSummary(editorialStatusResponse);
        setValidationSummary(validationOutcomeResponse);
        setPublishSummary(publishResultsResponse);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Failed to load dashboard data',
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [client]);

  if (loading) {
    return (
      <LoadingState
        title="Loading dashboard"
        description="Gathering the latest operational overview."
      />
    );
  }

  if (
    error ||
    !editorialSummary ||
    !validationSummary ||
    !publishSummary
  ) {
    return (
      <ErrorState
        title="Unable to load dashboard"
        message={error ?? 'Dashboard data is unavailable right now.'}
      />
    );
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
            Editorial operations
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-900">
            Queue movement and publish readiness
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Prioritize what needs review, what is blocked on edits, and what is ready to
            move forward without leaving the main operational dashboard.
          </p>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <EditorialStatusPanel summary={editorialSummary} />
          <CompactPublishSummary summary={publishSummary} />
        </div>
      </section>

      <section className="space-y-4">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
            System health
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-900">
            Validation stability across case sources
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Check whether validation is passing cleanly and where failures or runtime
            errors are accumulating.
          </p>
        </div>

        <ValidationOutcomePanel summary={validationSummary} />
      </section>
    </div>
  );
}
