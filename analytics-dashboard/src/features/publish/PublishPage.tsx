import { useAuth } from '@clerk/clerk-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getEditorialCases,
  getPublishResultsSummary,
  type EditorialCaseListItem,
  type PublishResultsSummary,
} from '../../api/admin';
import { createApiClient } from '../../api/client';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import LoadingState from '../../components/ui/LoadingState';
import CaseTable from '../cases/CaseTable';
import { formatLabel } from '../cases/cases.helpers';
import PublishHealthPanel from '../dashboard/PublishHealthPanel';

type PublishCaseGroupProps = {
  title: string;
  description: string;
  rows: EditorialCaseListItem[];
  onSelect: (row: EditorialCaseListItem) => void;
  emptyTitle: string;
  emptyDescription: string;
};

function PublishCaseGroup({
  title,
  description,
  rows,
  onSelect,
  emptyTitle,
  emptyDescription,
}: PublishCaseGroupProps) {
  return (
    <section className="space-y-3">
      <div className="max-w-3xl">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>

      {rows.length > 0 ? (
        <CaseTable
          rows={rows}
          selectedCaseId={null}
          queue="publish"
          onSelect={onSelect}
        />
      ) : (
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
        />
      )}
    </section>
  );
}

function combineRejectedByStatus(summary: PublishResultsSummary) {
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

  return [...totals.entries()].sort((left, right) => right[1] - left[1]);
}

export default function PublishPage() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const client = useMemo(() => createApiClient(getToken), [getToken]);
  const [summary, setSummary] = useState<PublishResultsSummary | null>(null);
  const [publishReadyCases, setPublishReadyCases] = useState<EditorialCaseListItem[]>(
    [],
  );
  const [publishedCases, setPublishedCases] = useState<EditorialCaseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const [summaryResponse, publishReadyResponse, publishedResponse] =
          await Promise.all([
            getPublishResultsSummary(client),
            getEditorialCases(client, {
              status: 'READY_TO_PUBLISH',
              page: 1,
              pageSize: 6,
            }),
            getEditorialCases(client, {
              status: 'PUBLISHED',
              page: 1,
              pageSize: 6,
            }),
          ]);

        if (!active) {
          return;
        }

        setSummary(summaryResponse);
        setPublishReadyCases(publishReadyResponse.items);
        setPublishedCases(publishedResponse.items);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Failed to load publish health',
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
        title="Loading publish health"
        description="Fetching publish readiness and assignment visibility."
      />
    );
  }

  if (error || !summary) {
    return (
      <ErrorState
        title="Unable to load publish health"
        message={error ?? 'Publish data is unavailable right now.'}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
          Publish operations
        </p>
        <h2 className="mt-1 text-xl font-semibold text-slate-900">
          Publish readiness and assignment health
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Use this view to monitor supply, readiness, and assignment outcomes without
          leaving the publish workflow.
        </p>
      </div>

      <PublishHealthPanel summary={summary} />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <PublishCaseGroup
          title="Publish-ready cases"
          description="These cases are already staged for distribution. Open one in the editorial workspace only when you need to inspect or adjust the underlying case."
          rows={publishReadyCases}
          onSelect={(row) => navigate(`/cases/${row.id}`)}
          emptyTitle="No publish-ready cases"
          emptyDescription="Nothing is currently staged for publishing."
        />

        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="max-w-3xl">
            <h3 className="text-base font-semibold text-slate-900">
              Distribution blockers
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              This list stays grounded in publish assignment rejections from backend metrics instead of guessing which cases are blocked client-side.
            </p>
          </div>

          {combineRejectedByStatus(summary).length > 0 ? (
            <div className="mt-4 space-y-2">
              {combineRejectedByStatus(summary).map(([status, count]) => (
                <div
                  key={status}
                  className="flex items-center justify-between rounded-xl border border-white bg-white px-3 py-3 text-sm text-slate-600"
                >
                  <span>{formatLabel(status)}</span>
                  <span className="font-semibold text-slate-900">{count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              No publish assignment blockers have been recorded.
            </p>
          )}
        </section>
      </section>

      <PublishCaseGroup
        title="Published cases"
        description="Published cases stay visible here as distribution output. Selecting a row opens the case in `/cases` for editorial inspection rather than adding actions to this page."
        rows={publishedCases}
        onSelect={(row) => navigate(`/cases/${row.id}`)}
        emptyTitle="No published cases available"
        emptyDescription="The current API surface does not show any published cases right now."
      />
    </div>
  );
}
