import { useAuth } from '@clerk/clerk-react';
import { useEffect, useMemo, useState } from 'react';
import {
  approveDiagnosisGraphCandidate,
  getDiagnosisGraphCandidates,
  mergeDiagnosisGraphCandidate,
  rejectDiagnosisGraphCandidate,
  type DiagnosisGraphCandidate,
  type DiagnosisGraphCandidateStatus,
  type DiagnosisGraphCandidateType,
  type DiagnosisGraphSourceType,
} from '../../api/admin';
import { createApiClient } from '../../api/client';
import ErrorState from '../../components/ui/ErrorState';
import LoadingState from '../../components/ui/LoadingState';

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

export default function DiagnosisGraphCandidatesPage() {
  const { getToken } = useAuth();
  const client = useMemo(() => createApiClient(getToken), [getToken]);
  const [rows, setRows] = useState<DiagnosisGraphCandidate[]>([]);
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

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const data = await getDiagnosisGraphCandidates(client, {
        diagnosisRegistryId: diagnosisRegistryId || undefined,
        type: type || undefined,
        status: status || undefined,
        sourceType: sourceType || undefined,
      });
      setRows(data);
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
    const note = window.prompt('Reject note', candidate.reviewNote ?? '');
    if (note === null) {
      return;
    }

    void runAction(candidate.id, () =>
      rejectDiagnosisGraphCandidate(client, candidate.id, { note }),
    );
  }

  function mergeCandidate(candidate: DiagnosisGraphCandidate) {
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
      {loading ? <LoadingState title="Loading graph candidates" /> : null}
      {error ? <ErrorState message={error} /> : null}

      {!loading && !error ? (
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Diagnosis</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Raw text / Label</th>
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Path</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((candidate) => (
                  <tr key={candidate.id} className="align-top">
                    <td className="px-4 py-3 text-slate-700">
                      {candidate.diagnosisRegistry?.displayLabel ??
                        candidate.diagnosisRegistryId}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {candidate.type}
                    </td>
                    <td className="max-w-md px-4 py-3 text-slate-700">
                      {candidate.rawText}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {candidate.targetDiagnosisRegistry?.displayLabel ??
                        candidate.unresolvedTargetText ??
                        '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {candidate.sourceType}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">
                      {candidate.sourcePath}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {candidate.status}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {formatDate(candidate.createdAt)}
                    </td>
                    <td className="space-y-2 px-4 py-3">
                      <button
                        type="button"
                        disabled={busyId === candidate.id}
                        onClick={() =>
                          void runAction(candidate.id, () =>
                            approveDiagnosisGraphCandidate(client, candidate.id),
                          )
                        }
                        className="block rounded-md border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={busyId === candidate.id}
                        onClick={() => rejectCandidate(candidate)}
                        className="block rounded-md border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700 disabled:opacity-50"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        disabled={busyId === candidate.id}
                        onClick={() => mergeCandidate(candidate)}
                        className="block rounded-md border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 disabled:opacity-50"
                      >
                        Merge
                      </button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                      No graph candidates match the current filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
