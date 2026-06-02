import { useAuth } from '@clerk/clerk-react';
import { useEffect, useMemo, useState } from 'react';
import {
  getUnresolvedDifferentialMappings,
  resolveDifferentialMapping,
  type DifferentialMappingFilters,
  type DifferentialMappingReviewItem,
  type DifferentialMappingSuggestion,
  type DifferentialResolutionStatus,
} from '../../api/admin';
import { createApiClient } from '../../api/client';
import ErrorState from '../../components/ui/ErrorState';
import LoadingState from '../../components/ui/LoadingState';
import StatusBadge from '../../components/ui/StatusBadge';
import { useConsoleAccess } from '../../hooks/useConsoleAccess';

const statusOptions: Array<DifferentialResolutionStatus | ''> = [
  '',
  'AMBIGUOUS',
  'UNRESOLVED',
  'RESOLVED',
  'REJECTED',
];

export default function UnresolvedDifferentialsPage() {
  const { getToken } = useAuth();
  const access = useConsoleAccess();
  const client = useMemo(() => createApiClient(getToken), [getToken]);
  const [rows, setRows] = useState<DifferentialMappingReviewItem[]>([]);
  const [sourceType, setSourceType] =
    useState<DifferentialMappingFilters['sourceType']>();
  const [status, setStatus] = useState<DifferentialResolutionStatus | ''>('');
  const [diagnosisRegistryId, setDiagnosisRegistryId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const data = await getUnresolvedDifferentialMappings(client, {
        sourceType,
        diagnosisRegistryId: diagnosisRegistryId.trim() || undefined,
        status: status || undefined,
      });
      setRows(data);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load differential mappings.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  async function runAction(
    row: DifferentialMappingReviewItem,
    action: () => Promise<unknown>,
  ) {
    if (!access.canPublishEditorial) {
      setActionError('Requires senior editor');
      return;
    }

    try {
      setBusyId(row.id);
      setActionError(null);
      await action();
      await load();
    } catch (actionFailure) {
      setActionError(
        actionFailure instanceof Error
          ? actionFailure.message
          : 'Differential mapping action failed.',
      );
    } finally {
      setBusyId(null);
    }
  }

  function linkExisting(row: DifferentialMappingReviewItem) {
    const suggestion = getSuggestions(row)[0];
    const targetId = window.prompt(
      'Target diagnosis registry ID',
      suggestion?.diagnosisRegistryId ?? '',
    );
    if (!targetId) return;
    const reason = window.prompt('Review note', '') ?? undefined;
    void runAction(row, () =>
      resolveDifferentialMapping(client, row.id, {
        action: 'link_existing',
        targetDiagnosisRegistryId: targetId.trim(),
        reason: reason?.trim() || undefined,
      }),
    );
  }

  function addAlias(row: DifferentialMappingReviewItem) {
    const suggestion = getSuggestions(row)[0];
    const targetId = window.prompt(
      'Target diagnosis registry ID',
      suggestion?.diagnosisRegistryId ?? '',
    );
    if (!targetId) return;
    const aliasText = window.prompt('Alias text', row.rawText);
    if (!aliasText) return;
    const reason = window.prompt('Review note', '') ?? undefined;
    void runAction(row, () =>
      resolveDifferentialMapping(client, row.id, {
        action: 'add_alias_to_existing',
        targetDiagnosisRegistryId: targetId.trim(),
        aliasText: aliasText.trim(),
        reason: reason?.trim() || undefined,
      }),
    );
  }

  function reject(row: DifferentialMappingReviewItem) {
    const reason = window.prompt('Reject note', row.reviewNote ?? '');
    if (reason === null) return;
    void runAction(row, () =>
      resolveDifferentialMapping(client, row.id, {
        action: 'reject',
        reason: reason.trim() || undefined,
      }),
    );
  }

  if (access.status === 'loading') {
    return <LoadingState title="Checking editorial access" />;
  }

  if (!access.canAccessEditorial) {
    return (
      <ErrorState
        title="Editorial access required"
        message="Differential mapping review is available to editor, senior_editor, and admin roles."
      />
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-base font-semibold text-slate-900">
              Unresolved differentials
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Review legacy case and education differential text that could not
              be confidently linked to the diagnosis registry.
            </p>
          </div>
          <StatusBadge status={`${rows.length} mappings`} tone="info" />
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[160px_180px_minmax(220px,1fr)_auto]">
          <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Source
            <select
              value={sourceType ?? ''}
              onChange={(event) =>
                setSourceType(
                  event.target.value
                    ? (event.target.value as DifferentialMappingFilters['sourceType'])
                    : undefined,
                )
              }
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900"
            >
              <option value="">All</option>
              <option value="case">Case</option>
              <option value="education">Education</option>
            </select>
          </label>

          <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Status
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as DifferentialResolutionStatus | '')
              }
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900"
            >
              {statusOptions.map((option) => (
                <option key={option || 'default'} value={option}>
                  {option || 'Attention only'}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Context diagnosis ID
            <input
              value={diagnosisRegistryId}
              onChange={(event) => setDiagnosisRegistryId(event.target.value)}
              placeholder="Optional UUID"
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900"
            />
          </label>

          <button
            type="button"
            onClick={() => void load()}
            className="self-end rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Refresh
          </button>
        </div>
      </section>

      {actionError ? (
        <ErrorState title="Action failed" message={actionError} />
      ) : null}

      {loading ? (
        <LoadingState title="Loading differential mappings" />
      ) : error ? (
        <ErrorState title="Unable to load mappings" message={error} />
      ) : rows.length ? (
        <div className="space-y-3">
          {rows.map((row) => (
            <DifferentialMappingCard
              key={row.id}
              row={row}
              busy={busyId === row.id}
              canResolve={access.canPublishEditorial}
              onLink={() => linkExisting(row)}
              onAlias={() => addAlias(row)}
              onReject={() => reject(row)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
          No differential mappings match the current filters.
        </div>
      )}
    </div>
  );
}

function DifferentialMappingCard({
  row,
  busy,
  canResolve,
  onLink,
  onAlias,
  onReject,
}: {
  row: DifferentialMappingReviewItem;
  busy: boolean;
  canResolve: boolean;
  onLink: () => void;
  onAlias: () => void;
  onReject: () => void;
}) {
  const suggestions = getSuggestions(row);

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-900">{row.rawText}</h2>
            <StatusBadge status={row.status} />
            <StatusBadge status={formatSource(row.sourceType)} tone="neutral" />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {row.normalizedText}
            {row.confidence !== null
              ? ` · confidence ${(row.confidence * 100).toFixed(0)}%`
              : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onLink}
            disabled={!canResolve || busy}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Link existing
          </button>
          <button
            type="button"
            onClick={onAlias}
            disabled={!canResolve || busy}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add alias
          </button>
          <button
            type="button"
            onClick={onReject}
            disabled={!canResolve || busy}
            className="rounded-md border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      </div>

      <dl className="mt-4 grid gap-3 text-sm md:grid-cols-3">
        <InfoItem label="Context" value={row.contextDiagnosis?.displayLabel ?? 'Unknown'} />
        <InfoItem label="Source" value={row.sourceTitle} />
        <InfoItem
          label="Path"
          value={[
            row.sourcePath ?? 'unknown',
            row.revisionNumber ? `v${row.revisionNumber}` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        />
      </dl>

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Suggestions
        </p>
        {suggestions.length ? (
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {suggestions.map((suggestion) => (
              <div
                key={`${row.id}-${suggestion.diagnosisRegistryId}`}
                className="rounded-lg border border-slate-200 bg-slate-50 p-3"
              >
                <p className="text-sm font-semibold text-slate-900">
                  {suggestion.displayLabel}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {suggestion.matchType} ·{' '}
                  {(suggestion.confidence * 100).toFixed(0)}% ·{' '}
                  {suggestion.diagnosisRegistryId}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">
            No registry suggestions were captured.
          </p>
        )}
      </div>

      {!canResolve ? (
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-amber-600">
          Resolve actions require senior editor access.
        </p>
      ) : null}
    </article>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
      <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium text-slate-800">{value}</dd>
    </div>
  );
}

function getSuggestions(
  row: DifferentialMappingReviewItem,
): DifferentialMappingSuggestion[] {
  return Array.isArray(row.suggestions)
    ? (row.suggestions as unknown[]).filter(isSuggestion)
    : [];
}

function isSuggestion(value: unknown): value is DifferentialMappingSuggestion {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.diagnosisRegistryId === 'string' &&
    typeof record.displayLabel === 'string' &&
    typeof record.canonicalName === 'string' &&
    typeof record.matchType === 'string' &&
    typeof record.confidence === 'number'
  );
}

function formatSource(sourceType: string) {
  return sourceType.replace(/_/g, ' ');
}
