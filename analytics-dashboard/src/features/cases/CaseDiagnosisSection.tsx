import { useEffect, useState } from 'react';
import {
  searchDiagnosisRegistry,
  type CreateDiagnosisAndLinkPayload,
  type DiagnosisRegistrySearchItem,
  type EditorialCaseDetail,
  type LinkCaseDiagnosisPayload,
} from '../../api/admin';
import type { ApiClient } from '../../api/client';
import StatusBadge from '../../components/ui/StatusBadge';
import CaseDetailSection from './CaseDetailSection';
import {
  formatLabel,
  getDiagnosisWorkflowSummary,
} from './cases.helpers';

type CaseDiagnosisSectionProps = {
  detail: EditorialCaseDetail;
  client: ApiClient;
  anyActionPending: boolean;
  onLinkDiagnosis: (payload: LinkCaseDiagnosisPayload) => Promise<void>;
  onCreateAndLinkDiagnosis: (
    payload: CreateDiagnosisAndLinkPayload,
  ) => Promise<void>;
};

function parseAliases(value: string): string[] {
  return value
    .split(/[\n,]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export default function CaseDiagnosisSection({
  detail,
  client,
  anyActionPending,
  onLinkDiagnosis,
  onCreateAndLinkDiagnosis,
}: CaseDiagnosisSectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<DiagnosisRegistrySearchItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedRegistryId, setSelectedRegistryId] = useState<string | null>(null);
  const [linkEditorialNote, setLinkEditorialNote] = useState('');
  const [canonicalName, setCanonicalName] = useState('');
  const [aliasesInput, setAliasesInput] = useState('');
  const [category, setCategory] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [registryNotes, setRegistryNotes] = useState('');
  const [createEditorialNote, setCreateEditorialNote] = useState('');
  const diagnosisSummary = getDiagnosisWorkflowSummary(detail);

  useEffect(() => {
    setSearchQuery(detail.proposedDiagnosisText ?? '');
    setCanonicalName(detail.proposedDiagnosisText ?? '');
    setLinkEditorialNote(detail.diagnosisEditorialNote ?? '');
    setCreateEditorialNote(detail.diagnosisEditorialNote ?? '');
    setAliasesInput('');
    setCategory(detail.diagnosisRegistrySummary?.category ?? '');
    setSpecialty(detail.diagnosisRegistrySummary?.specialty ?? '');
    setRegistryNotes('');
    setSearchResults([]);
    setSearchError(null);
    setSelectedRegistryId(detail.diagnosisRegistryId ?? null);
  }, [detail]);

  async function handleSearch() {
    const trimmedQuery = searchQuery.trim();
    if (trimmedQuery.length < 2) {
      setSearchError('Enter at least 2 characters to search the registry.');
      setSearchResults([]);
      return;
    }

    try {
      setSearching(true);
      setSearchError(null);
      const results = await searchDiagnosisRegistry(client, {
        q: trimmedQuery,
        limit: 8,
      });
      setSearchResults(results);
      setSelectedRegistryId((current) =>
        results.some((item) => item.id === current) ? current : results[0]?.id ?? null,
      );
    } catch (error) {
      setSearchResults([]);
      setSearchError(
        error instanceof Error ? error.message : 'Failed to search diagnosis registry.',
      );
    } finally {
      setSearching(false);
    }
  }

  async function handleLinkDiagnosis() {
    if (!selectedRegistryId) {
      setSearchError('Select a registry diagnosis before linking it to the case.');
      return;
    }

    await onLinkDiagnosis({
      diagnosisRegistryId: selectedRegistryId,
      diagnosisEditorialNote: linkEditorialNote.trim() || undefined,
    });
  }

  async function handleCreateAndLinkDiagnosis() {
    const nextCanonicalName = canonicalName.trim();
    if (nextCanonicalName.length < 2) {
      setSearchError('Provide a canonical diagnosis name before creating it.');
      return;
    }

    await onCreateAndLinkDiagnosis({
      canonicalName: nextCanonicalName,
      aliases: parseAliases(aliasesInput),
      category: category.trim() || undefined,
      specialty: specialty.trim() || undefined,
      notes: registryNotes.trim() || undefined,
      diagnosisEditorialNote: createEditorialNote.trim() || undefined,
    });
  }

  return (
    <CaseDetailSection
      title="Diagnosis review"
      description="Diagnosis standardization stays inside the case review flow so editors can link or create canonicals without leaving the queue."
    >
      <div className="space-y-4">
        <div
          className={[
            'rounded-xl border px-4 py-3',
            diagnosisSummary.tone === 'success'
              ? 'border-emerald-200 bg-emerald-50'
              : diagnosisSummary.tone === 'warning'
                ? 'border-amber-200 bg-amber-50'
                : 'border-rose-200 bg-rose-50',
          ].join(' ')}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {diagnosisSummary.label}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {diagnosisSummary.description}
              </p>
            </div>
            <StatusBadge status={diagnosisSummary.label} tone={diagnosisSummary.tone} />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Proposed diagnosis
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {detail.proposedDiagnosisText || 'Not recorded'}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Linked canonical
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {detail.diagnosisRegistrySummary?.canonicalName ?? 'Unlinked'}
            </p>
            {detail.diagnosisRegistrySummary ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusBadge status={detail.diagnosisRegistrySummary.status} />
                {detail.diagnosisRegistrySummary.category ? (
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                    {detail.diagnosisRegistrySummary.category}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Mapping state
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={detail.diagnosisMappingStatus} />
              <StatusBadge status={detail.diagnosisMappingMethod} tone="info" />
            </div>
            {typeof detail.diagnosisMappingConfidence === 'number' ? (
              <p className="mt-2 text-xs text-slate-500">
                Confidence: {detail.diagnosisMappingConfidence}
              </p>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Editorial note
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
            {detail.diagnosisEditorialNote || 'No diagnosis editorial note recorded yet.'}
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Link an existing diagnosis
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Search the registry by canonical or alias, then link the selected entry to this case.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search canonical or alias"
                disabled={anyActionPending || searching}
              />
              <button
                type="button"
                onClick={() => void handleSearch()}
                disabled={anyActionPending || searching}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {searching ? 'Searching...' : 'Search'}
              </button>
            </div>

            {searchError ? (
              <p className="text-sm text-rose-600">{searchError}</p>
            ) : null}

            <div className="space-y-2">
              {searchResults.length > 0 ? (
                searchResults.map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    onClick={() => setSelectedRegistryId(result.id)}
                    disabled={anyActionPending}
                    className={[
                      'w-full rounded-xl border px-3 py-3 text-left transition',
                      selectedRegistryId === result.id
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-900 hover:bg-slate-100',
                    ].join(' ')}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{result.canonicalName}</span>
                      <StatusBadge
                        status={result.status}
                        tone={selectedRegistryId === result.id ? 'info' : undefined}
                      />
                    </div>
                    <p
                      className={[
                        'mt-1 text-xs',
                        selectedRegistryId === result.id ? 'text-slate-200' : 'text-slate-500',
                      ].join(' ')}
                    >
                      Match: {formatLabel(result.matchSource)} |{' '}
                      {result.aliasPreview.length > 0
                        ? `Aliases: ${result.aliasPreview.join(', ')}`
                        : 'No alias preview'}
                    </p>
                  </button>
                ))
              ) : (
                <p className="text-sm text-slate-500">
                  Search results will appear here.
                </p>
              )}
            </div>

            <label className="block space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Diagnosis editorial note
              </span>
              <textarea
                className="min-h-[88px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                value={linkEditorialNote}
                onChange={(event) => setLinkEditorialNote(event.target.value)}
                placeholder="Optional note for why this diagnosis was linked."
                disabled={anyActionPending}
              />
            </label>

            <button
              type="button"
              onClick={() => void handleLinkDiagnosis()}
              disabled={anyActionPending || !selectedRegistryId}
              className="rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Link selected diagnosis
            </button>
          </div>

          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Create and link a diagnosis
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Use this when the registry does not yet contain the diagnosis needed for this case.
              </p>
            </div>

            <label className="block space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Canonical name
              </span>
              <input
                type="text"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
                value={canonicalName}
                onChange={(event) => setCanonicalName(event.target.value)}
                disabled={anyActionPending}
              />
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Category
                </span>
                <input
                  type="text"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  placeholder="Optional"
                  disabled={anyActionPending}
                />
              </label>
              <label className="block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Specialty
                </span>
                <input
                  type="text"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
                  value={specialty}
                  onChange={(event) => setSpecialty(event.target.value)}
                  placeholder="Optional"
                  disabled={anyActionPending}
                />
              </label>
            </div>

            <label className="block space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Initial aliases
              </span>
              <textarea
                className="min-h-[88px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                value={aliasesInput}
                onChange={(event) => setAliasesInput(event.target.value)}
                placeholder="Comma or newline separated aliases"
                disabled={anyActionPending}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Registry notes
              </span>
              <textarea
                className="min-h-[88px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                value={registryNotes}
                onChange={(event) => setRegistryNotes(event.target.value)}
                placeholder="Optional notes about the new registry entry."
                disabled={anyActionPending}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Diagnosis editorial note
              </span>
              <textarea
                className="min-h-[88px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                value={createEditorialNote}
                onChange={(event) => setCreateEditorialNote(event.target.value)}
                placeholder="Optional note explaining why a new diagnosis was created."
                disabled={anyActionPending}
              />
            </label>

            <button
              type="button"
              onClick={() => void handleCreateAndLinkDiagnosis()}
              disabled={anyActionPending}
              className="rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Create diagnosis and link
            </button>
          </div>
        </div>
      </div>
    </CaseDetailSection>
  );
}
