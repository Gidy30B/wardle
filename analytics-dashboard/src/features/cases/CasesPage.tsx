import { useAuth } from '@clerk/clerk-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  getEditorialCaseDetail,
  getEditorialCases,
  type CaseEditorialStatus,
  type EditorialCaseDetail,
  type EditorialCaseListItem,
  type EditorialCasesResponse,
  type EditorialQueueFilter,
} from '../../api/admin';
import { createApiClient } from '../../api/client';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import LoadingState from '../../components/ui/LoadingState';
import { useRefreshSignal } from '../../hooks/useRefreshSignal';
import CaseDetail from './CaseDetail';
import CasesPagination from './CasesPagination';
import CaseTable from './CaseTable';
import {
  editorialStatusOptions,
  getQueueHeading,
  pageSizeOptions,
  queueFilterOptions,
} from './cases.helpers';

type CasesLayoutMode = 'browse' | 'focus';

function buildCaseRowFromDetail(detail: EditorialCaseDetail): EditorialCaseListItem {
  return {
    id: detail.id,
    title: detail.title,
    date: detail.date,
    difficulty: detail.difficulty,
    editorialStatus: detail.editorialStatus,
    approvedAt: detail.approvedAt,
    approvedByUserId: detail.approvedByUserId,
    currentRevisionId: detail.currentRevisionId,
    diagnosis: detail.diagnosis,
    currentRevision: detail.currentRevision,
    validationRuns: detail.validationRuns,
    reviews: detail.reviews,
  };
}

function buildSelectedCasePlaceholder(caseId: string): EditorialCaseListItem {
  return {
    id: caseId,
    title: 'Selected case',
    date: 'Not recorded',
    difficulty: 'Not recorded',
    editorialStatus: null,
    approvedAt: null,
    approvedByUserId: null,
    currentRevisionId: null,
    diagnosis: {
      id: '',
      name: 'Loading case',
      system: null,
    },
    currentRevision: null,
    validationRuns: [],
    reviews: [],
  };
}

export default function CasesPage() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const { caseId: routeCaseId } = useParams<{ caseId?: string }>();
  const client = useMemo(() => createApiClient(getToken), [getToken]);
  const { refreshSignal, requestRefresh } = useRefreshSignal();
  const [rows, setRows] = useState<EditorialCaseListItem[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedCaseDetail, setSelectedCaseDetail] =
    useState<EditorialCaseDetail | null>(null);
  const [queue, setQueue] = useState<EditorialQueueFilter>('all');
  const [status, setStatus] = useState<CaseEditorialStatus | ''>('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] =
    useState<(typeof pageSizeOptions)[number]>(10);
  const [meta, setMeta] = useState<EditorialCasesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [layoutMode, setLayoutMode] = useState<CasesLayoutMode>('browse');

  useEffect(() => {
    if (routeCaseId !== undefined && routeCaseId !== selectedCaseId) {
      setSelectedCaseId(routeCaseId ?? null);
    }
  }, [routeCaseId, selectedCaseId]);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const response = await getEditorialCases(client, {
          queue,
          status: status || undefined,
          page,
          pageSize,
        });

        if (!active) {
          return;
        }

        setRows(response.items);
        setMeta(response);
        setSelectedCaseId((currentSelectedCaseId) => {
          const nextSelectedCaseId = (() => {
            if (routeCaseId) {
              return routeCaseId;
            }

            if (
              currentSelectedCaseId &&
              response.items.some((item) => item.id === currentSelectedCaseId)
            ) {
              return currentSelectedCaseId;
            }

            return response.items[0]?.id ?? null;
          })();

          if (!routeCaseId && nextSelectedCaseId) {
            navigate(`/cases/${nextSelectedCaseId}`, { replace: true });
          }

          return nextSelectedCaseId;
        });
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(
          loadError instanceof Error ? loadError.message : 'Failed to load case data',
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
  }, [client, navigate, page, pageSize, queue, refreshSignal, routeCaseId, status]);

  useEffect(() => {
    if (!selectedCaseId) {
      setSelectedCaseDetail(null);
      setDetailError(null);
      setDetailLoading(false);
      return;
    }

    let active = true;
    const caseId = selectedCaseId;

    async function loadDetail() {
      try {
        setDetailLoading(true);
        setDetailError(null);
        setSelectedCaseDetail(null);
        const response = await getEditorialCaseDetail(client, caseId);

        if (!active) {
          return;
        }

        setSelectedCaseDetail(response);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setSelectedCaseDetail(null);
        setDetailError(
          loadError instanceof Error
            ? loadError.message
            : 'Failed to load case detail',
        );
      } finally {
        if (active) {
          setDetailLoading(false);
        }
      }
    }

    void loadDetail();

    return () => {
      active = false;
    };
  }, [client, selectedCaseId, refreshSignal]);

  useEffect(() => {
    if (!selectedCaseId && layoutMode === 'focus') {
      setLayoutMode('browse');
    }
  }, [layoutMode, selectedCaseId]);

  const selectedCaseIndex = rows.findIndex((row) => row.id === selectedCaseId);
  const selectedCaseFromRows = selectedCaseIndex >= 0 ? rows[selectedCaseIndex] : null;
  const selectedCase =
    selectedCaseFromRows ??
    (selectedCaseDetail ? buildCaseRowFromDetail(selectedCaseDetail) : null) ??
    (selectedCaseId ? buildSelectedCasePlaceholder(selectedCaseId) : null);
  const previousCase = selectedCaseIndex > 0 ? rows[selectedCaseIndex - 1] : null;
  const nextCase =
    selectedCaseIndex >= 0 && selectedCaseIndex < rows.length - 1
      ? rows[selectedCaseIndex + 1]
      : null;
  const queueHeading = getQueueHeading(queue);
  const isFocusMode = layoutMode === 'focus' && Boolean(selectedCase);
  const activeQueueLabel =
    queueFilterOptions.find((option) => option.value === queue)?.label ?? queue;
  const activeStatusLabel = status
    ? editorialStatusOptions.find((option) => option.value === status)?.label ?? status
    : 'All statuses';
  const reviewContextLabel = selectedCaseIndex >= 0
    ? `${selectedCaseIndex + 1} of ${rows.length} on this page`
    : selectedCaseId
      ? 'Selected outside the current page'
      : null;

  function handleSelectCase(caseRow: EditorialCaseListItem) {
    setSelectedCaseId(caseRow.id);
    navigate(`/cases/${caseRow.id}`);
  }

  function handleToggleLayoutMode() {
    setLayoutMode((currentMode) => (currentMode === 'focus' ? 'browse' : 'focus'));
  }

  if (loading && !meta) {
    return (
      <LoadingState
        title="Loading cases"
        description="Fetching the current editorial queue."
      />
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Unable to load cases"
        message={error}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              {queueHeading.eyebrow}
            </p>
            <h2 className="mt-2 text-lg font-semibold text-slate-900">
              {queueHeading.title}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {queueHeading.description}
            </p>
          </div>

          <div className="flex flex-col gap-3 lg:items-end">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Queue
                </span>
                <select
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  value={queue}
                  onChange={(event) => {
                    setQueue(event.target.value as EditorialQueueFilter);
                    setPage(1);
                  }}
                >
                  {queueFilterOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Status
                </span>
                <select
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value as CaseEditorialStatus | '');
                    setPage(1);
                  }}
                >
                  <option value="">All statuses</option>
                  {editorialStatusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Page size
                </span>
                <select
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value) as (typeof pageSizeOptions)[number]);
                    setPage(1);
                  }}
                >
                  {pageSizeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option} per page
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <button
              type="button"
              onClick={handleToggleLayoutMode}
              disabled={!selectedCase}
              className={[
                'rounded-xl border px-4 py-2 text-sm font-semibold transition',
                'disabled:cursor-not-allowed disabled:opacity-60',
                isFocusMode
                  ? 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100',
              ].join(' ')}
            >
              {isFocusMode ? 'Back to queue view' : 'Focus selected case'}
            </button>
          </div>
        </div>
      </div>

      {queue === 'publish' ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">
            Publish focus
          </p>
          <p className="mt-2 text-sm text-emerald-900">
            The current queue is centered on cases closest to assignment. Ready-to-publish
            rows are highlighted in the list, and the selected case shows extra publish
            readiness context in the detail panel.
          </p>
        </div>
      ) : null}

      {rows.length === 0 && !selectedCaseId ? (
        <EmptyState
          title="No cases in this queue"
          description="Try a different queue or status filter to find editorial cases."
        />
      ) : (
        <div
          className={[
            'grid grid-cols-1 gap-6 transition-all duration-200',
            isFocusMode
              ? 'items-start'
              : 'items-start 2xl:grid-cols-[minmax(320px,0.95fr)_minmax(0,1.45fr)]',
          ].join(' ')}
        >
          {!isFocusMode ? (
            <div className="min-w-0 transition-all duration-200">
              {rows.length > 0 ? (
                <CaseTable
                  rows={rows}
                  selectedCaseId={selectedCaseId}
                  queue={queue}
                  onSelect={handleSelectCase}
                />
              ) : (
                <EmptyState
                  title="Selected case is outside this page"
                  description="Adjust filters or pagination to bring the selected case back into the current queue view."
                />
              )}
            </div>
          ) : null}

          <div className="min-w-0 space-y-4 transition-all duration-200">
            <div
              className={[
                'rounded-2xl border px-4 py-4 shadow-sm transition-all duration-200',
                isFocusMode
                  ? 'border-slate-900 bg-slate-900 text-white ring-1 ring-slate-900'
                  : 'border-slate-200 bg-white',
              ].join(' ')}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p
                    className={[
                      'text-xs font-semibold uppercase tracking-[0.24em]',
                      isFocusMode ? 'text-slate-300' : 'text-slate-500',
                    ].join(' ')}
                  >
                    {isFocusMode ? 'Focus mode' : 'Browse mode'}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <h3
                      className={[
                        'text-base font-semibold',
                        isFocusMode ? 'text-white' : 'text-slate-900',
                      ].join(' ')}
                    >
                      {selectedCase?.title ?? 'Select a case'}
                    </h3>
                    {reviewContextLabel ? (
                      <span
                        className={[
                          'rounded-full px-2.5 py-1 text-xs font-semibold',
                          isFocusMode
                            ? 'border border-slate-700 bg-slate-800 text-slate-100'
                            : 'border border-slate-200 bg-slate-50 text-slate-700',
                        ].join(' ')}
                      >
                        {reviewContextLabel}
                      </span>
                    ) : null}
                  </div>
                  <p
                    className={[
                      'mt-2 text-sm',
                      isFocusMode ? 'text-slate-200' : 'text-slate-500',
                    ].join(' ')}
                  >
                    {isFocusMode
                      ? 'Queue filters, page, and selection stay preserved while the case expands for focused review.'
                      : 'Keep the queue visible while you browse, then expand the selected detail when you need more room to review.'}
                  </p>
                  <p
                    className={[
                      'mt-2 text-xs',
                      isFocusMode ? 'text-slate-300' : 'text-slate-500',
                    ].join(' ')}
                  >
                    Queue: {activeQueueLabel} | Status: {activeStatusLabel} | Page {page} |{' '}
                    {pageSize} per page
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => previousCase && handleSelectCase(previousCase)}
                    disabled={!previousCase}
                    className={[
                      'rounded-xl border px-3 py-2 text-sm font-semibold transition',
                      'disabled:cursor-not-allowed disabled:opacity-60',
                      isFocusMode
                        ? 'border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-700'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100',
                    ].join(' ')}
                  >
                    Previous case
                  </button>
                  <button
                    type="button"
                    onClick={() => nextCase && handleSelectCase(nextCase)}
                    disabled={!nextCase}
                    className={[
                      'rounded-xl border px-3 py-2 text-sm font-semibold transition',
                      'disabled:cursor-not-allowed disabled:opacity-60',
                      isFocusMode
                        ? 'border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-700'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100',
                    ].join(' ')}
                  >
                    Next case
                  </button>
                  <button
                    type="button"
                    onClick={handleToggleLayoutMode}
                    disabled={!selectedCase}
                    className={[
                      'rounded-xl border px-4 py-2 text-sm font-semibold transition',
                      'disabled:cursor-not-allowed disabled:opacity-60',
                      isFocusMode
                        ? 'border-white/20 bg-white text-slate-900 hover:bg-slate-100'
                        : 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800',
                    ].join(' ')}
                  >
                    {isFocusMode ? 'Back to queue' : 'Expand detail'}
                  </button>
                </div>
              </div>
            </div>

            <CaseDetail
              row={selectedCase}
              detail={selectedCaseDetail}
              client={client}
              loading={detailLoading}
              error={detailError}
              refreshSignal={refreshSignal}
              onRequestRefresh={requestRefresh}
              queue={queue}
            />
          </div>
        </div>
      )}

      {meta ? (
        <CasesPagination
          page={meta.page}
          pageSize={meta.pageSize}
          total={meta.total}
          hasMore={meta.hasMore}
          onPageChange={setPage}
        />
      ) : null}
    </div>
  );
}
