import { useAuth } from '@clerk/clerk-react';
import { useEffect, useMemo, useState } from 'react';
import {
  approveDiagnosisGraphCandidate,
  getDiagnosisGraphCandidates,
  getUnresolvedMimicCandidates,
  mergeDiagnosisGraphCandidate,
  rejectDiagnosisGraphCandidate,
  resolveMimicCandidate,
  type DiagnosisGraphCandidate,
  type DiagnosisGraphResolutionSuggestion,
  type DiagnosisGraphCandidateStatus,
  type DiagnosisGraphCandidateType,
  type DiagnosisGraphSourceType,
  type UnresolvedMimicCandidate,
} from '../../api/admin';
import { createApiClient } from '../../api/client';
import ErrorState from '../../components/ui/ErrorState';
import LoadingState from '../../components/ui/LoadingState';
import StatusBadge from '../../components/ui/StatusBadge';
import { useConsoleAccess } from '../../hooks/useConsoleAccess';

const typeOptions: DiagnosisGraphCandidateType[] = [
  'FINDING',
  'INVESTIGATION',
  'MIMIC',
  'PITFALL',
  'MANAGEMENT',
  'COMPLICATION',
  'RECALL_PROMPT',
  'CASE_REASONING',
];

const statusOptions: DiagnosisGraphCandidateStatus[] = [
  'CANDIDATE',
  'APPROVED',
  'REJECTED',
  'MERGED',
];

const sourceTypeOptions: DiagnosisGraphSourceType[] = [
  'CASE',
  'DIAGNOSIS_EDUCATION',
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function isUnresolvedMimic(candidate: DiagnosisGraphCandidate) {
  return candidate.type === 'MIMIC' && !candidate.targetDiagnosisRegistryId;
}

export default function DiagnosisGraphCandidatesPage() {
  const { getToken } = useAuth();
  const access = useConsoleAccess();
  const client = useMemo(() => createApiClient(getToken), [getToken]);
  const [rows, setRows] = useState<DiagnosisGraphCandidate[]>([]);
  const [unresolvedMimics, setUnresolvedMimics] = useState<
    UnresolvedMimicCandidate[]
  >([]);
  const [diagnosisRegistryId, setDiagnosisRegistryId] = useState('');
  const [type, setType] = useState<DiagnosisGraphCandidateType | ''>('');
  const [status, setStatus] = useState<DiagnosisGraphCandidateStatus | ''>(
    'CANDIDATE',
  );
  const [sourceType, setSourceType] = useState<DiagnosisGraphSourceType | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resolvingCandidate, setResolvingCandidate] =
    useState<DiagnosisGraphCandidate | null>(null);
  const [resolveTargetId, setResolveTargetId] = useState('');
  const [resolveAliasText, setResolveAliasText] = useState('');
  const [resolveReason, setResolveReason] = useState('');
  const canReviewCandidates = access.canPublishEditorial;
  const seniorDisabledReason = 'Requires senior editor';
  const unresolvedById = useMemo(
    () => new Map(unresolvedMimics.map((candidate) => [candidate.id, candidate])),
    [unresolvedMimics],
  );

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const [data, unresolved] = await Promise.all([
        getDiagnosisGraphCandidates(client, {
          diagnosisRegistryId: diagnosisRegistryId || undefined,
          type: type || undefined,
          status: status || undefined,
          sourceType: sourceType || undefined,
        }),
        getUnresolvedMimicCandidates(client),
      ]);
      setRows(data);
      setUnresolvedMimics(unresolved);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load graph candidates',
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
    candidateId: string,
    action: () => Promise<unknown>,
  ) {
    try {
      setBusyId(candidateId);
      setActionError(null);
      await action();
      await load();
    } catch (actionFailure) {
      setActionError(
        actionFailure instanceof Error
          ? actionFailure.message
          : 'Candidate action failed',
      );
    } finally {
      setBusyId(null);
    }
  }

  function rejectCandidate(candidate: DiagnosisGraphCandidate) {
    if (!canReviewCandidates) {
      setActionError(seniorDisabledReason);
      return;
    }

    const note = window.prompt('Reject note', candidate.reviewNote ?? '');
    if (note === null) {
      return;
    }

    void runAction(candidate.id, () =>
      rejectDiagnosisGraphCandidate(client, candidate.id, { note }),
    );
  }

  function mergeCandidate(candidate: DiagnosisGraphCandidate) {
    if (!canReviewCandidates) {
      setActionError(seniorDisabledReason);
      return;
    }

    const target = window.prompt(
      'Target candidate ID or fact ID. Prefix fact IDs with fact:',
    );
    if (!target) {
      return;
    }
    const note = window.prompt('Merge note', '') ?? undefined;
    const trimmed = target.trim();

    void runAction(candidate.id, () =>
      mergeDiagnosisGraphCandidate(client, candidate.id, {
        ...(trimmed.startsWith('fact:')
          ? { targetFactId: trimmed.slice('fact:'.length).trim() }
          : { targetCandidateId: trimmed }),
        note,
      }),
    );
  }

  function openResolve(candidate: DiagnosisGraphCandidate) {
    if (!canReviewCandidates) {
      setActionError(seniorDisabledReason);
      return;
    }

    const firstSuggestion = unresolvedById.get(candidate.id)?.suggestions[0];
    setResolvingCandidate(candidate);
    setResolveTargetId(firstSuggestion?.diagnosisRegistryId ?? '');
    setResolveAliasText(candidate.unresolvedTargetText ?? candidate.rawText);
    setResolveReason('');
  }

  async function submitResolve(action: 'link_existing' | 'add_alias_to_existing') {
    if (!resolvingCandidate) {
      return;
    }

    await runAction(resolvingCandidate.id, () =>
      resolveMimicCandidate(client, resolvingCandidate.id, {
        action,
        targetDiagnosisRegistryId: resolveTargetId.trim(),
        aliasText:
          action === 'add_alias_to_existing'
            ? resolveAliasText.trim()
            : undefined,
        reason: resolveReason.trim() || undefined,
      }),
    );
    setResolvingCandidate(null);
  }

  async function rejectResolvingCandidate() {
    if (!resolvingCandidate) {
      return;
    }

    await runAction(resolvingCandidate.id, () =>
      resolveMimicCandidate(client, resolvingCandidate.id, {
        action: 'reject',
        reason: resolveReason.trim() || undefined,
      }),
    );
    setResolvingCandidate(null);
  }

  const resolvingSuggestions: DiagnosisGraphResolutionSuggestion[] =
    resolvingCandidate
      ? (unresolvedById.get(resolvingCandidate.id)?.suggestions ?? [])
      : [];

  if (access.status === 'loading') {
    return <LoadingState title="Checking editorial access" />;
  }

  if (!access.canAccessEditorial) {
    return (
      <ErrorState
        title="Editorial access required"
        message="Graph candidate review is available to editor, senior_editor, and admin roles."
      />
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_160px_160px_190px_auto]">
          <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Diagnosis Registry ID
            <input
              value={diagnosisRegistryId}
              onChange={(event) => setDiagnosisRegistryId(event.target.value)}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900"
              placeholder="UUID"
            />
          </label>
          <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Type
            <select
              value={type}
              onChange={(event) =>
                setType(event.target.value as DiagnosisGraphCandidateType | '')
              }
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm font-normal text-slate-900"
            >
              <option value="">All</option>
              {typeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Status
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as DiagnosisGraphCandidateStatus | '')
              }
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm font-normal text-slate-900"
            >
              <option value="">All</option>
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Source
            <select
              value={sourceType}
              onChange={(event) =>
                setSourceType(event.target.value as DiagnosisGraphSourceType | '')
              }
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm font-normal text-slate-900"
            >
              <option value="">All</option>
              {sourceTypeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void load()}
            className="self-end rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Apply
          </button>
        </div>
      </section>

      {actionError ? <ErrorState message={actionError} /> : null}
      {unresolvedMimics.length ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="font-semibold">
            {unresolvedMimics.length} unresolved MIMIC candidate
            {unresolvedMimics.length === 1 ? '' : 's'}
          </div>
          <div className="mt-1">
            Resolve registry identity before approval so text-only differentials do
            not become graph facts.
          </div>
        </section>
      ) : null}
      {loading ? <LoadingState title="Loading graph candidates" /> : null}
      {error ? <ErrorState message={error} /> : null}

      {!loading && !error ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="space-y-3">
            {rows.map((candidate) => {
              const unresolvedMimic = isUnresolvedMimic(candidate);
              const approveDisabled =
                busyId === candidate.id ||
                !canReviewCandidates ||
                unresolvedMimic;
              const primaryLabel = unresolvedMimic ? 'Resolve mimic' : 'Approve';
              const primaryDisabled = unresolvedMimic
                ? busyId === candidate.id || !canReviewCandidates
                : approveDisabled;
              const primaryTitle = !canReviewCandidates
                ? seniorDisabledReason
                : unresolvedMimic
                  ? 'Resolve registry identity before approval.'
                  : undefined;

              return (
                <article
                  key={candidate.id}
                  className="rounded-lg border border-slate-200 bg-slate-50/70 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-semibold text-slate-950">
                          {candidate.diagnosisRegistry?.displayLabel ??
                            candidate.diagnosisRegistryId}
                        </h2>
                        <StatusBadge status={candidate.type} tone="info" />
                        {unresolvedMimic ? (
                          <StatusBadge status="Unresolved registry" tone="warning" />
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-700">
                        {candidate.rawText}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Target:{' '}
                        {candidate.targetDiagnosisRegistry?.displayLabel ??
                          candidate.unresolvedTargetText ??
                          'None yet'}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={primaryDisabled}
                      title={primaryTitle}
                      onClick={() =>
                        unresolvedMimic
                          ? openResolve(candidate)
                          : canReviewCandidates
                            ? void runAction(candidate.id, () =>
                                approveDiagnosisGraphCandidate(
                                  client,
                                  candidate.id,
                                ),
                              )
                            : setActionError(seniorDisabledReason)
                      }
                      className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {primaryLabel}
                    </button>
                  </div>
                  <details className="mt-3 rounded-md border border-slate-200 bg-white px-3 py-2">
                    <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Details and more actions
                    </summary>
                    <div className="mt-3 grid gap-3 text-xs text-slate-600 md:grid-cols-[1fr_auto]">
                      <div className="space-y-1">
                        <p>
                          <span className="font-semibold">Source:</span>{' '}
                          {candidate.sourceType}
                        </p>
                        <p>
                          <span className="font-semibold">Path:</span>{' '}
                          <span className="font-mono">{candidate.sourcePath}</span>
                        </p>
                        <p>
                          <span className="font-semibold">Status:</span>{' '}
                          {candidate.status}
                        </p>
                        <p>
                          <span className="font-semibold">Created:</span>{' '}
                          {formatDate(candidate.createdAt)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-start gap-2 md:justify-end">
                        <button
                          type="button"
                          disabled={busyId === candidate.id || !canReviewCandidates}
                          title={
                            !canReviewCandidates ? seniorDisabledReason : undefined
                          }
                          onClick={() => rejectCandidate(candidate)}
                          className="rounded-md border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700 disabled:opacity-50"
                        >
                          Reject
                        </button>
                        <button
                          type="button"
                          disabled={busyId === candidate.id || !canReviewCandidates}
                          title={
                            !canReviewCandidates ? seniorDisabledReason : undefined
                          }
                          onClick={() => mergeCandidate(candidate)}
                          className="rounded-md border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 disabled:opacity-50"
                        >
                          Merge
                        </button>
                      </div>
                    </div>
                  </details>
                </article>
              );
            })}
            {rows.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                No graph candidates match the current filters.
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {resolvingCandidate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <section className="w-full max-w-2xl rounded-lg bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  Resolve mimic
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {resolvingCandidate.rawText}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setResolvingCandidate(null)}
                className="rounded-md border border-slate-200 px-3 py-1 text-sm font-semibold text-slate-700"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {resolvingSuggestions.length ? (
                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Suggested registry matches
                  </div>
                  {resolvingSuggestions.map((suggestion) => (
                    <button
                      key={suggestion.diagnosisRegistryId}
                      type="button"
                      onClick={() =>
                        setResolveTargetId(suggestion.diagnosisRegistryId)
                      }
                      className={`block w-full rounded-md border p-3 text-left text-sm ${
                        resolveTargetId === suggestion.diagnosisRegistryId
                          ? 'border-slate-900 bg-slate-50'
                          : 'border-slate-200'
                      }`}
                    >
                      <div className="font-semibold text-slate-950">
                        {suggestion.displayLabel}
                      </div>
                      <div className="text-xs text-slate-500">
                        {suggestion.canonicalName} · {suggestion.matchType} ·{' '}
                        {Math.round(suggestion.confidence * 100)}%
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-md border border-slate-200 p-3 text-sm text-slate-600">
                  No automatic suggestions found. Paste an existing registry ID to
                  link this mimic, or reject the candidate.
                </div>
              )}

              <label className="block space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Target registry ID
                <input
                  value={resolveTargetId}
                  onChange={(event) => setResolveTargetId(event.target.value)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900"
                />
              </label>
              <label className="block space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Alias text
                <input
                  value={resolveAliasText}
                  onChange={(event) => setResolveAliasText(event.target.value)}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900"
                />
              </label>
              <label className="block space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Reason
                <textarea
                  value={resolveReason}
                  onChange={(event) => setResolveReason(event.target.value)}
                  className="min-h-20 w-full rounded-md border border-slate-200 px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900"
                />
              </label>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => void rejectResolvingCandidate()}
                className="rounded-md border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700"
              >
                Reject
              </button>
              <button
                type="button"
                disabled={!resolveTargetId.trim()}
                onClick={() => void submitResolve('link_existing')}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50"
              >
                Link existing
              </button>
              <button
                type="button"
                disabled={!resolveTargetId.trim() || !resolveAliasText.trim()}
                onClick={() => void submitResolve('add_alias_to_existing')}
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Add alias and link
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
