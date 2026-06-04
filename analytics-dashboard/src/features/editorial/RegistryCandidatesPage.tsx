import { useAuth } from '@clerk/clerk-react';
import { useEffect, useMemo, useState } from 'react';
import {
  getDiagnosisRegistryCandidates,
  reviewDiagnosisRegistryCandidate,
  type DiagnosisRegistryCandidate,
  type DiagnosisRegistryCandidateDuplicateSuggestions,
  type DiagnosisRegistryCandidateStatus,
  type JsonValue,
} from '../../api/admin';
import { createApiClient } from '../../api/client';
import ErrorState from '../../components/ui/ErrorState';
import LoadingState from '../../components/ui/LoadingState';
import StatusBadge from '../../components/ui/StatusBadge';
import { useConsoleAccess } from '../../hooks/useConsoleAccess';

const statusOptions: Array<DiagnosisRegistryCandidateStatus | ''> = [
  '',
  'CANDIDATE',
  'NEEDS_REVIEW',
  'REJECTED',
  'MERGED',
  'APPROVED_PENDING_CREATE',
  'CREATED',
];

export default function RegistryCandidatesPage() {
  const { getToken } = useAuth();
  const access = useConsoleAccess();
  const client = useMemo(() => createApiClient(getToken), [getToken]);
  const [candidates, setCandidates] = useState<DiagnosisRegistryCandidate[]>(
    [],
  );
  const [status, setStatus] = useState<DiagnosisRegistryCandidateStatus | ''>(
    '',
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const data = await getDiagnosisRegistryCandidates(client, {
        status: status || undefined,
        limit: 200,
      });
      setCandidates(data);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load registry candidates.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client]);

  async function runReview(
    candidate: DiagnosisRegistryCandidate,
    action: () => Promise<unknown>,
  ) {
    if (!access.canPublishEditorial) {
      setActionError('Requires senior editor');
      return;
    }

    try {
      setBusyId(candidate.id);
      setActionError(null);
      await action();
      await load();
    } catch (reviewError) {
      setActionError(
        reviewError instanceof Error
          ? reviewError.message
          : 'Registry candidate review failed.',
      );
    } finally {
      setBusyId(null);
    }
  }

  function markNeedsReview(candidate: DiagnosisRegistryCandidate) {
    const note = window.prompt('Review note', candidate.reviewNote ?? '');
    if (note === null) return;
    void runReview(candidate, () =>
      reviewDiagnosisRegistryCandidate(client, candidate.id, {
        action: 'mark_needs_review',
        note: note.trim() || undefined,
      }),
    );
  }

  function reject(candidate: DiagnosisRegistryCandidate) {
    const note = window.prompt('Reject note', candidate.reviewNote ?? '');
    if (note === null) return;
    void runReview(candidate, () =>
      reviewDiagnosisRegistryCandidate(client, candidate.id, {
        action: 'reject',
        note: note.trim() || undefined,
      }),
    );
  }

  function mergeDuplicate(candidate: DiagnosisRegistryCandidate) {
    const suggestions = getDuplicateSuggestions(candidate);
    const defaultDuplicateId = suggestions.candidateMatches?.find(
      (match) => match.id !== candidate.id,
    )?.id;
    const duplicateCandidateId = window.prompt(
      'Duplicate candidate ID',
      defaultDuplicateId ?? '',
    );
    if (!duplicateCandidateId) return;
    const note = window.prompt('Review note', '') ?? undefined;
    void runReview(candidate, () =>
      reviewDiagnosisRegistryCandidate(client, candidate.id, {
        action: 'merge_duplicate_candidate',
        duplicateCandidateId: duplicateCandidateId.trim(),
        note: note?.trim() || undefined,
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
        message="Registry candidate review is available to editor, senior_editor, and admin roles."
      />
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-base font-semibold text-slate-900">
              Registry candidates
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Review proposed diagnosis registry entries from unresolved
              differential mappings before senior creation.
            </p>
          </div>
          <StatusBadge status={`${candidates.length} candidates`} tone="info" />
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[220px_auto]">
          <label className="space-y-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Status
            <select
              value={status}
              onChange={(event) =>
                setStatus(
                  event.target.value as DiagnosisRegistryCandidateStatus | '',
                )
              }
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900"
            >
              {statusOptions.map((option) => (
                <option key={option || 'all'} value={option}>
                  {option || 'All'}
                </option>
              ))}
            </select>
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
        <LoadingState title="Loading registry candidates" />
      ) : error ? (
        <ErrorState title="Unable to load candidates" message={error} />
      ) : candidates.length ? (
        <div className="space-y-3">
          {candidates.map((candidate) => (
            <RegistryCandidateCard
              key={candidate.id}
              candidate={candidate}
              busy={busyId === candidate.id}
              canReview={access.canPublishEditorial}
              onMarkNeedsReview={() => markNeedsReview(candidate)}
              onReject={() => reject(candidate)}
              onMergeDuplicate={() => mergeDuplicate(candidate)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">
          No registry candidates match the current filters.
        </div>
      )}
    </div>
  );
}

function RegistryCandidateCard({
  candidate,
  busy,
  canReview,
  onMarkNeedsReview,
  onReject,
  onMergeDuplicate,
}: {
  candidate: DiagnosisRegistryCandidate;
  busy: boolean;
  canReview: boolean;
  onMarkNeedsReview: () => void;
  onReject: () => void;
  onMergeDuplicate: () => void;
}) {
  const aliases = getStringArray(candidate.proposedAliases);
  const suggestions = getDuplicateSuggestions(candidate);

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-900">
              {candidate.proposedDisplayLabel}
            </h2>
            <StatusBadge status={candidate.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {candidate.proposedCanonicalName} /{' '}
            {candidate.proposedCanonicalNormalized}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onMarkNeedsReview}
            disabled={!canReview || busy}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Mark needs review
          </button>
          <button
            type="button"
            onClick={onMergeDuplicate}
            disabled={!canReview || busy}
            className="rounded-md border border-amber-200 px-3 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Merge duplicate
          </button>
          <button
            type="button"
            onClick={onReject}
            disabled={!canReview || busy}
            className="rounded-md border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      </div>

      <dl className="mt-4 grid gap-3 text-sm md:grid-cols-3">
        <InfoItem
          label="Source raw text"
          value={candidate.sourceRawText || 'Unknown'}
        />
        <InfoItem
          label="Context diagnosis"
          value={candidate.contextDiagnosisRegistry?.displayLabel ?? 'Unknown'}
        />
        <InfoItem
          label="Source"
          value={`${formatLabel(candidate.sourceType)} / ${
            candidate.sourceMappingId ?? candidate.sourceId
          }`}
        />
      </dl>

      <section className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Proposed aliases
        </p>
        <p className="mt-2 text-sm text-slate-600">
          {aliases.length ? aliases.join(', ') : 'No aliases proposed.'}
        </p>
      </section>

      <DuplicateSuggestions suggestions={suggestions} />

      {candidate.reviewNote ? (
        <section className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Review note
          </p>
          <p className="mt-1 text-sm text-slate-700">{candidate.reviewNote}</p>
        </section>
      ) : null}

      {!canReview ? (
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-amber-600">
          Review actions require senior editor access.
        </p>
      ) : null}
    </article>
  );
}

function DuplicateSuggestions({
  suggestions,
}: {
  suggestions: DiagnosisRegistryCandidateDuplicateSuggestions;
}) {
  const canonicalMatches = suggestions.registryCanonicalMatches ?? [];
  const aliasMatches = suggestions.registryAliasMatches ?? [];
  const candidateMatches = suggestions.candidateMatches ?? [];
  const total =
    canonicalMatches.length + aliasMatches.length + candidateMatches.length;

  return (
    <section className="mt-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        Duplicate suggestions
      </p>
      {total ? (
        <div className="mt-2 grid gap-2 md:grid-cols-3">
          {canonicalMatches.map((match) => (
            <SuggestionItem
              key={`registry-${match.id}`}
              title={match.displayLabel}
              meta={`Registry canonical / ${match.id}`}
            />
          ))}
          {aliasMatches.map((match) => (
            <SuggestionItem
              key={`alias-${match.aliasId}`}
              title={match.aliasTerm}
              meta={`Alias for ${match.registry.displayLabel} / ${match.registry.id}`}
            />
          ))}
          {candidateMatches.map((match) => (
            <SuggestionItem
              key={`candidate-${match.id}`}
              title={match.proposedDisplayLabel}
              meta={`Candidate / ${match.status} / ${match.id}`}
            />
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-500">
          No duplicate suggestions were captured.
        </p>
      )}
    </section>
  );
}

function SuggestionItem({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 break-all text-xs text-slate-500">{meta}</p>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
      <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm font-medium text-slate-800">
        {value}
      </dd>
    </div>
  );
}

function getDuplicateSuggestions(
  candidate: DiagnosisRegistryCandidate,
): DiagnosisRegistryCandidateDuplicateSuggestions {
  const value = candidate.duplicateSuggestions;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return value as DiagnosisRegistryCandidateDuplicateSuggestions;
}

function getStringArray(value: JsonValue | string[] | null): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const items: unknown[] = value;
  return items.filter((item): item is string => typeof item === 'string');
}

function formatLabel(value: string) {
  return value.replace(/_/g, ' ');
}
