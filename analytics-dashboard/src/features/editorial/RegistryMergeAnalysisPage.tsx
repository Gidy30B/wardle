import { useAuth } from '@clerk/clerk-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  analyzeDiagnosisRegistryMerge,
  executeDiagnosisRegistryMerge,
  searchDiagnosisRegistry,
  type DiagnosisRegistrySearchItem,
  type RegistryMergeAnalysis,
  type RegistryMergeExecutionResult,
  type RegistryMergeSeverity,
} from '../../api/admin';
import { createApiClient } from '../../api/client';
import ErrorState from '../../components/ui/ErrorState';
import StatusBadge from '../../components/ui/StatusBadge';
import type { StatusBadgeTone } from '../../components/ui/statusBadgeMeta';
import { useConsoleAccess } from '../../hooks/useConsoleAccess';

type PickerSide = 'source' | 'target';

export default function RegistryMergeAnalysisPage() {
  const { getToken } = useAuth();
  const client = useMemo(() => createApiClient(getToken), [getToken]);
  const access = useConsoleAccess();
  const [searchParams] = useSearchParams();
  const [source, setSource] = useState<DiagnosisRegistrySearchItem | null>(null);
  const [target, setTarget] = useState<DiagnosisRegistrySearchItem | null>(null);
  const [sourceQuery, setSourceQuery] = useState('');
  const [targetQuery, setTargetQuery] = useState('');
  const [sourceResults, setSourceResults] = useState<DiagnosisRegistrySearchItem[]>([]);
  const [targetResults, setTargetResults] = useState<DiagnosisRegistrySearchItem[]>([]);
  const [analysis, setAnalysis] = useState<RegistryMergeAnalysis | null>(null);
  const [mergeResult, setMergeResult] =
    useState<RegistryMergeExecutionResult | null>(null);
  const [searching, setSearching] = useState<PickerSide | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sourceId = searchParams.get('source');
    const targetId = searchParams.get('target');
    if (sourceId) {
      setSource({
        id: sourceId,
        canonicalName: sourceId,
        status: 'ACTIVE',
        category: null,
        specialty: null,
        subspecialty: null,
        bodySystem: null,
        organSystem: null,
        difficultyBand: null,
        rarityBand: null,
        clinicalSetting: null,
        ageGroup: null,
        urgencyLevel: null,
        isPlayable: false,
        isGeneratable: false,
        preferredClueTypes: null,
        excludedClueTypes: null,
        searchPriority: 0,
        aliasPreview: [],
        matchSource: 'canonical',
      });
    }
    if (targetId) {
      setTarget({
        id: targetId,
        canonicalName: targetId,
        status: 'ACTIVE',
        category: null,
        specialty: null,
        subspecialty: null,
        bodySystem: null,
        organSystem: null,
        difficultyBand: null,
        rarityBand: null,
        clinicalSetting: null,
        ageGroup: null,
        urgencyLevel: null,
        isPlayable: false,
        isGeneratable: false,
        preferredClueTypes: null,
        excludedClueTypes: null,
        searchPriority: 0,
        aliasPreview: [],
        matchSource: 'canonical',
      });
    }
  }, [searchParams]);

  async function runSearch(side: PickerSide, query: string) {
    if (query.trim().length < 2) {
      return;
    }
    try {
      setSearching(side);
      setError(null);
      const results = await searchDiagnosisRegistry(client, {
        q: query,
        limit: 8,
      });
      if (side === 'source') {
        setSourceResults(results);
      } else {
        setTargetResults(results);
      }
    } catch (searchError) {
      setError(errorMessage(searchError, 'Registry search failed.'));
    } finally {
      setSearching(null);
    }
  }

  async function runAnalysis() {
    if (!source || !target) {
      setError('Select both source and target diagnoses.');
      return;
    }
    if (!access.canPublishEditorial) {
      setError('Requires senior editor.');
      return;
    }
    try {
      setAnalyzing(true);
      setError(null);
      const result = await analyzeDiagnosisRegistryMerge(client, {
        sourceDiagnosisRegistryId: source.id,
        targetDiagnosisRegistryId: target.id,
      });
      setAnalysis(result);
      setMergeResult(null);
    } catch (analysisError) {
      setAnalysis(null);
      setError(errorMessage(analysisError, 'Merge analysis failed.'));
    } finally {
      setAnalyzing(false);
    }
  }

  async function executeMerge() {
    if (!source || !target || !analysis) {
      setError('Run a merge analysis first.');
      return;
    }
    if (!canExecuteMerge(access.canPublishEditorial, source.id, target.id, analysis)) {
      setError('Merge execution is not available for this analysis.');
      return;
    }
    try {
      setExecuting(true);
      setError(null);
      const result = await executeDiagnosisRegistryMerge(client, {
        sourceDiagnosisRegistryId: source.id,
        targetDiagnosisRegistryId: target.id,
        reason,
        expectedAnalysisHash: analysis.analysisHash,
      });
      setMergeResult(result);
      setConfirmOpen(false);
    } catch (executeError) {
      setError(errorMessage(executeError, 'Merge execution failed.'));
    } finally {
      setExecuting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <Link to="/editorial" className="text-sm font-semibold text-slate-600 hover:text-slate-900">
          Back to editorial
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">
          Registry merge analysis
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Dry-run impact analysis only. No registry records are changed.
        </p>
      </div>

      {error ? <ErrorState title="Merge analysis unavailable" message={error} /> : null}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-2">
          <RegistryPicker
            title="Source diagnosis"
            query={sourceQuery}
            selected={source}
            results={sourceResults}
            searching={searching === 'source'}
            onQueryChange={setSourceQuery}
            onSearch={() => runSearch('source', sourceQuery)}
            onSelect={(item) => {
              setSource(item);
              setAnalysis(null);
              setMergeResult(null);
            }}
          />
          <RegistryPicker
            title="Target diagnosis"
            query={targetQuery}
            selected={target}
            results={targetResults}
            searching={searching === 'target'}
            onQueryChange={setTargetQuery}
            onSearch={() => runSearch('target', targetQuery)}
            onSelect={(item) => {
              setTarget(item);
              setAnalysis(null);
              setMergeResult(null);
            }}
          />
        </div>
        <div className="mt-4">
          <button
            type="button"
            disabled={analyzing || !source || !target || !access.canPublishEditorial}
            onClick={runAnalysis}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            title={!access.canPublishEditorial ? 'Requires senior editor' : undefined}
          >
            {analyzing ? 'Analyzing...' : 'Analyze merge'}
          </button>
        </div>
      </section>

      {analysis ? (
        <MergeAnalysisResult
          analysis={analysis}
          showExecute={access.canPublishEditorial}
          canExecute={canExecuteMerge(
            access.canPublishEditorial,
            source?.id,
            target?.id,
            analysis,
          )}
          onOpenConfirm={() => setConfirmOpen(true)}
        />
      ) : null}
      {mergeResult ? (
        <MergeExecutionSummary
          result={mergeResult}
          targetDiagnosisRegistryId={mergeResult.targetDiagnosisRegistryId}
        />
      ) : null}
      {confirmOpen && analysis ? (
        <MergeConfirmationModal
          analysis={analysis}
          reason={reason}
          executing={executing}
          onReasonChange={setReason}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={executeMerge}
        />
      ) : null}
    </div>
  );
}

function RegistryPicker({
  title,
  query,
  selected,
  results,
  searching,
  onQueryChange,
  onSearch,
  onSelect,
}: {
  title: string;
  query: string;
  selected: DiagnosisRegistrySearchItem | null;
  results: DiagnosisRegistrySearchItem[];
  searching: boolean;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
  onSelect: (item: DiagnosisRegistrySearchItem) => void;
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <div className="mt-2 flex gap-2">
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onSearch();
          }}
          className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Search diagnosis"
        />
        <button
          type="button"
          onClick={onSearch}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
        >
          {searching ? 'Searching' : 'Search'}
        </button>
      </div>
      {selected ? (
        <div className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
          <span className="font-semibold text-emerald-900">
            {selected.canonicalName}
          </span>
          <span className="ml-2 text-emerald-700">{selected.id}</span>
        </div>
      ) : null}
      {results.length ? (
        <div className="mt-2 divide-y divide-slate-100 rounded-md border border-slate-200">
          {results.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item)}
              className="block w-full px-3 py-2 text-left text-sm transition hover:bg-slate-50"
            >
              <span className="font-semibold text-slate-900">
                {item.canonicalName}
              </span>
              <span className="ml-2 text-slate-500">{item.status}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MergeAnalysisResult({
  analysis,
  showExecute,
  canExecute,
  onOpenConfirm,
}: {
  analysis: RegistryMergeAnalysis;
  showExecute: boolean;
  canExecute: boolean;
  onOpenConfirm: () => void;
}) {
  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge
              status={`Severity: ${analysis.severity}`}
              tone={severityTone(analysis.severity)}
            />
            <StatusBadge
              status={`Readiness: ${analysis.readiness.score}%`}
              tone={analysis.allowed ? 'success' : 'danger'}
            />
            <StatusBadge
              status={analysis.allowed ? 'Analysis clear' : 'Blocked'}
              tone={analysis.allowed ? 'success' : 'danger'}
            />
          </div>
          {showExecute ? (
            <button
              type="button"
              disabled={!canExecute}
              onClick={onOpenConfirm}
              className="rounded-md bg-rose-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Execute merge
            </button>
          ) : null}
        </div>
        <p className="mt-3 text-sm text-slate-600">
          Preview: merge source into target canonical{' '}
          <span className="font-semibold text-slate-900">
            {analysis.mergePreview.resultingCanonical}
          </span>
          .
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-base font-semibold text-slate-900">Impact summary</p>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {Object.entries(analysis.impact).map(([key, value]) => (
            <div key={key} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                {formatLabel(key)}
              </p>
              <p className="mt-2 text-xl font-semibold text-slate-900">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <ListPanel title="Blockers" items={analysis.blockers} tone="danger" />
        <ListPanel title="Warnings" items={analysis.warnings} tone="warning" />
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-base font-semibold text-slate-900">Conflicts</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {Object.entries(analysis.conflicts).map(([key, items]) => (
            <ListPanel
              key={key}
              title={formatLabel(key)}
              items={items}
              tone={items.length ? 'warning' : 'success'}
              emptyText="No conflicts detected."
            />
          ))}
        </div>
      </section>

      <ListPanel
        title="Recommendations"
        items={analysis.recommendations}
        tone="info"
        emptyText="No recommendations."
      />
    </div>
  );
}

function MergeConfirmationModal({
  analysis,
  reason,
  executing,
  onReasonChange,
  onCancel,
  onConfirm,
}: {
  analysis: RegistryMergeAnalysis;
  reason: string;
  executing: boolean;
  onReasonChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="w-full max-w-3xl rounded-xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Confirm registry merge
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              This will reassign registry-linked editorial assets and deprecate the source diagnosis.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700"
          >
            Cancel
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Source
            </p>
            <p className="mt-2 font-semibold text-slate-950">
              {analysis.source.displayLabel}
            </p>
            <p className="text-xs text-slate-500">{analysis.source.id}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Target
            </p>
            <p className="mt-2 font-semibold text-slate-950">
              {analysis.target.displayLabel}
            </p>
            <p className="text-xs text-slate-500">{analysis.target.id}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <StatusBadge
            status={`Severity: ${analysis.severity}`}
            tone={severityTone(analysis.severity)}
          />
          <StatusBadge
            status={`Warnings: ${analysis.warnings.length}`}
            tone={analysis.warnings.length ? 'warning' : 'success'}
          />
          <StatusBadge
            status={`Blockers: ${analysis.blockers.length}`}
            tone={analysis.blockers.length ? 'danger' : 'success'}
          />
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-4">
          {Object.entries(analysis.impact)
            .filter(([, value]) => value > 0)
            .slice(0, 12)
            .map(([key, value]) => (
              <div key={key} className="rounded-md border border-slate-200 p-2">
                <p className="text-xs text-slate-500">{formatLabel(key)}</p>
                <p className="font-semibold text-slate-900">{value}</p>
              </div>
            ))}
        </div>

        <label className="mt-4 block text-sm font-semibold text-slate-900">
          Reason
          <textarea
            value={reason}
            onChange={(event) => onReasonChange(event.target.value)}
            className="mt-2 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal"
            placeholder="Why is this merge being performed?"
          />
        </label>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={executing}
            onClick={onConfirm}
            className="rounded-md bg-rose-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {executing ? 'Executing...' : 'Confirm merge'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MergeExecutionSummary({
  result,
  targetDiagnosisRegistryId,
}: {
  result: RegistryMergeExecutionResult;
  targetDiagnosisRegistryId: string;
}) {
  return (
    <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-emerald-950">
            Merge completed
          </p>
          <p className="mt-1 text-sm text-emerald-800">
            Source is now {result.sourceStatus.toLowerCase()}. Merge log:{' '}
            {result.mergeLogId}
          </p>
        </div>
        <Link
          to={`/editorial/diagnoses/${targetDiagnosisRegistryId}`}
          className="rounded-md border border-emerald-300 bg-white px-3 py-2 text-sm font-semibold text-emerald-800"
        >
          Target workspace
        </Link>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-lg bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
            Aliases moved
          </p>
          <p className="mt-2 text-xl font-semibold text-emerald-950">
            {result.reassignmentSummary.aliasesMoved}
          </p>
        </div>
        <div className="rounded-lg bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
            Aliases created
          </p>
          <p className="mt-2 text-xl font-semibold text-emerald-950">
            {result.reassignmentSummary.aliasesCreated}
          </p>
        </div>
        <div className="rounded-lg bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
            Aliases skipped
          </p>
          <p className="mt-2 text-xl font-semibold text-emerald-950">
            {result.reassignmentSummary.aliasesSkipped.length}
          </p>
        </div>
      </div>
      {result.reassignmentSummary.aliasesSkipped.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {result.reassignmentSummary.aliasesSkipped.map((alias) => (
            <StatusBadge
              key={`${alias.aliasId ?? alias.term}:${alias.reason}`}
              status={`${alias.term}: ${alias.reason}`}
              tone="warning"
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ListPanel({
  title,
  items,
  tone,
  emptyText = 'None.',
}: {
  title: string;
  items: string[];
  tone: StatusBadgeTone;
  emptyText?: string;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-base font-semibold text-slate-900">{title}</p>
      {items.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {items.map((item) => (
            <StatusBadge key={item} status={item} tone={tone} />
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-600">{emptyText}</p>
      )}
    </section>
  );
}

function severityTone(severity: RegistryMergeSeverity): StatusBadgeTone {
  if (severity === 'BLOCKED') return 'danger';
  if (severity === 'HIGH') return 'warning';
  if (severity === 'MEDIUM') return 'info';
  return 'success';
}

function canExecuteMerge(
  hasSeniorAccess: boolean,
  sourceId: string | undefined,
  targetId: string | undefined,
  analysis: RegistryMergeAnalysis | null,
) {
  return Boolean(
    hasSeniorAccess &&
      sourceId &&
      targetId &&
      sourceId !== targetId &&
      analysis?.allowed &&
      analysis.severity !== 'BLOCKED' &&
      analysis.blockers.length === 0,
  );
}

function formatLabel(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
