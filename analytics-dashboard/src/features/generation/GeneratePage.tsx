import { useAuth } from '@clerk/clerk-react';
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import { Link } from 'react-router-dom';
import {
  generateCases,
  searchDiagnosisRegistry,
  type DiagnosisDifficultyBand,
  type DiagnosisRegistrySearchItem,
  type GenerateCaseResultItem,
  type GenerateCaseSkipReason,
  type GenerateCasesResult,
  type GenerationMode,
  type GenerationResultTab,
  type PlannedGenerationSlot,
} from '../../api/admin';
import { createApiClient } from '../../api/client';
import ActionFeedback from '../../components/ui/ActionFeedback';
import StatusBadge from '../../components/ui/StatusBadge';
import { useActionFeedback } from '../../hooks/useActionFeedback';

type CreatedResult = Extract<GenerateCaseResultItem, { status: 'created' }>;
type SkippedResult = Extract<GenerateCaseResultItem, { status: 'skipped' }>;
type FailedResult = Extract<GenerateCaseResultItem, { status: 'failed' }>;

type ResultSummary = {
  all: GenerateCaseResultItem[];
  created: CreatedResult[];
  skipped: SkippedResult[];
  failed: FailedResult[];
};

const resultTabs: Array<{ value: GenerationResultTab; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'created', label: 'Created' },
  { value: 'skipped', label: 'Skipped' },
  { value: 'failed', label: 'Failed' },
  { value: 'planner', label: 'Planner' },
];

const difficultyOptions: Array<{
  value: '' | 'easy' | 'medium' | 'hard';
  label: string;
}> = [
  { value: '', label: 'Default balance' },
  { value: 'easy', label: 'Easy / Basic' },
  { value: 'medium', label: 'Medium / Intermediate' },
  { value: 'hard', label: 'Hard / Advanced' },
];

const difficultyBandOptions: Array<{ value: ''; label: string } | {
  value: DiagnosisDifficultyBand;
  label: string;
}> = [
  { value: '', label: 'Any difficulty band' },
  { value: 'BASIC', label: 'Basic' },
  { value: 'INTERMEDIATE', label: 'Intermediate' },
  { value: 'ADVANCED', label: 'Advanced' },
];

const skipReasonLabels: Record<GenerateCaseSkipReason, string> = {
  duplicate_answer: 'Duplicate answer',
  duplicate_scenario: 'Duplicate scenario',
  low_quality: 'Low quality',
  specialty_cluster: 'Specialty cluster',
  difficulty_balance: 'Difficulty balance',
};

function summarizeResults(result: GenerateCasesResult): ResultSummary {
  return {
    all: result.results,
    created: result.results.filter(
      (item): item is CreatedResult => item.status === 'created',
    ),
    skipped: result.results.filter(
      (item): item is SkippedResult => item.status === 'skipped',
    ),
    failed: result.results.filter(
      (item): item is FailedResult => item.status === 'failed',
    ),
  };
}

function compactValue(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function formatNullable(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return 'None';
  }

  return String(value);
}

function formatPlannerStatus(slot: PlannedGenerationSlot) {
  if (slot.selectionStatus === 'unavailable') {
    return 'Unavailable';
  }

  if (slot.existingCaseCount && slot.existingCaseCount > 0) {
    return 'Repeat';
  }

  return 'Unused';
}

function normalizeForSearch(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase();
}

function getUniqueOptions(
  items: DiagnosisRegistrySearchItem[],
  field: 'specialty' | 'bodySystem',
) {
  return Array.from(
    new Set(
      items
        .map((item) => item[field])
        .filter((value): value is string => Boolean(value)),
    ),
  ).sort((left, right) => left.localeCompare(right));
}

function getQualityTone(score: number | null): MetricTone {
  if (score === null) {
    return 'default';
  }

  if (score >= 80) {
    return 'teal';
  }

  if (score >= 65) {
    return 'amber';
  }

  return 'red';
}

function isAuthGenerationError(error: Error) {
  const message = error.message.toLowerCase();
  return (
    message.includes('admin') ||
    message.includes('forbidden') ||
    message.includes('unauthorized') ||
    message.includes('clerk') ||
    message.includes('token')
  );
}

export default function GeneratePage() {
  const { getToken } = useAuth();
  const client = useMemo(() => createApiClient(getToken), [getToken]);
  const [mode, setMode] = useState<GenerationMode>('registry_balanced');
  const [activeTab, setActiveTab] = useState<GenerationResultTab>('all');
  const [count, setCount] = useState(10);
  const [track, setTrack] = useState('');
  const [bodySystem, setBodySystem] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [registryFirst, setRegistryFirst] = useState(true);
  const [registryQuery, setRegistryQuery] = useState('');
  const [registrySpecialtyFilter, setRegistrySpecialtyFilter] = useState('');
  const [registryBodySystemFilter, setRegistryBodySystemFilter] = useState('');
  const [registryDifficultyFilter, setRegistryDifficultyFilter] = useState<
    '' | DiagnosisDifficultyBand
  >('');
  const [registryItems, setRegistryItems] = useState<DiagnosisRegistrySearchItem[]>([]);
  const [selectedTargets, setSelectedTargets] = useState<DiagnosisRegistrySearchItem[]>([]);
  const [registryLoading, setRegistryLoading] = useState(false);
  const [registryError, setRegistryError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateCasesResult | null>(null);
  const feedback = useActionFeedback();
  const summary = result ? summarizeResults(result) : null;
  const plannerSummary = result?.plannerDiagnostics[0]?.diagnostics ?? null;
  const driftCount =
    result?.plannerDiagnostics.filter(
      (slot) => slot.comparison?.matchesPlanner === false,
    ).length ?? 0;
  const unavailableCount =
    result?.plannerDiagnostics.filter(
      (slot) => slot.selectionStatus === 'unavailable',
    ).length ?? 0;
  const specialtyOptions = useMemo(
    () => getUniqueOptions([...registryItems, ...selectedTargets], 'specialty'),
    [registryItems, selectedTargets],
  );
  const bodySystemOptions = useMemo(
    () => getUniqueOptions([...registryItems, ...selectedTargets], 'bodySystem'),
    [registryItems, selectedTargets],
  );
  const filteredRegistryItems = useMemo(() => {
    const specialtyFilter = normalizeForSearch(registrySpecialtyFilter);
    const bodyFilter = normalizeForSearch(registryBodySystemFilter);

    return registryItems.filter((item) => {
      const matchesSpecialty =
        !specialtyFilter ||
        normalizeForSearch(item.specialty) === specialtyFilter;
      const matchesBody =
        !bodyFilter || normalizeForSearch(item.bodySystem) === bodyFilter;
      const matchesDifficulty =
        !registryDifficultyFilter ||
        item.difficultyBand === registryDifficultyFilter;

      return matchesSpecialty && matchesBody && matchesDifficulty;
    });
  }, [
    registryBodySystemFilter,
    registryDifficultyFilter,
    registryItems,
    registrySpecialtyFilter,
  ]);
  const selectedTargetIds = useMemo(
    () => new Set(selectedTargets.map((item) => item.id)),
    [selectedTargets],
  );
  const targetedGenerationSupported = false;
  const canGenerate =
    !loading && (mode === 'registry_balanced' || targetedGenerationSupported);
  const generationStatusCopy = registryFirst
    ? 'Generating registry-planned batch...'
    : 'Generating legacy unplanned batch...';

  useEffect(() => {
    let cancelled = false;

    async function loadRegistry() {
      try {
        setRegistryLoading(true);
        setRegistryError(null);
        const items = await searchDiagnosisRegistry(client, {
          q: compactValue(registryQuery),
          limit: 25,
          status: 'ACTIVE',
        });

        if (!cancelled) {
          setRegistryItems(items);
        }
      } catch (error) {
        if (!cancelled) {
          setRegistryItems([]);
          setRegistryError(
            error instanceof Error
              ? error.message
              : 'Unable to load diagnosis registry',
          );
        }
      } finally {
        if (!cancelled) {
          setRegistryLoading(false);
        }
      }
    }

    loadRegistry();

    return () => {
      cancelled = true;
    };
  }, [client, registryQuery]);

  function toggleTarget(item: DiagnosisRegistrySearchItem) {
    setSelectedTargets((current) => {
      if (current.some((target) => target.id === item.id)) {
        return current.filter((target) => target.id !== item.id);
      }

      return [...current, item];
    });
  }

  async function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (mode === 'diagnosis_targeted') {
      feedback.showError(
        'Diagnosis-targeted generation is ready in the UI, but the backend endpoint does not yet accept explicit diagnosis IDs.',
      );
      return;
    }

    try {
      setLoading(true);
      feedback.showPending(generationStatusCopy);
      const response = await generateCases(client, {
        count,
        track: compactValue(track),
        bodySystem: compactValue(bodySystem),
        difficulty: compactValue(difficulty),
        registryFirst,
      });
      setResult(response);
      setActiveTab('all');
      feedback.showSuccess(
        `Batch complete: ${response.created} created, ${response.skipped} skipped, ${response.failed} failed.`,
      );
    } catch (generateError) {
      const message =
        generateError instanceof Error
          ? generateError.message
          : 'Failed to generate cases';
      feedback.showError(
        generateError instanceof Error && isAuthGenerationError(generateError)
          ? `Admin authorization error: ${message}`
          : message,
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <ActionFeedback
        feedback={feedback.feedback}
        onDismiss={loading ? undefined : feedback.clear}
      />

      <form
        className="grid gap-6 xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.35fr)]"
        onSubmit={handleGenerate}
      >
        <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <SectionHeader
            eyebrow="Generation controls"
            title="Prepare a registry batch"
            description="Choose balanced filters or stage diagnosis targets before generation."
          />

          <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
            <ModeButton
              active={mode === 'registry_balanced'}
              label="Registry balanced"
              onClick={() => setMode('registry_balanced')}
            />
            <ModeButton
              active={mode === 'diagnosis_targeted'}
              label="Diagnosis targeted"
              onClick={() => setMode('diagnosis_targeted')}
            />
          </div>

          {mode === 'diagnosis_targeted' ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Diagnosis-targeted generation is ready in the UI, but the backend
              endpoint does not yet accept explicit diagnosis IDs.
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Count</span>
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 disabled:bg-slate-100"
                disabled={loading}
                type="number"
                min={1}
                max={50}
                value={count}
                onChange={(event) => setCount(Number(event.target.value))}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">
                Difficulty band
              </span>
              <select
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 disabled:bg-slate-100"
                disabled={loading}
                value={difficulty}
                onChange={(event) => setDifficulty(event.target.value)}
              >
                {difficultyOptions.map((option) => (
                  <option key={option.value || 'default'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">
                Specialty
              </span>
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 disabled:bg-slate-100"
                disabled={loading}
                placeholder="Optional registry specialty"
                value={track}
                onChange={(event) => setTrack(event.target.value)}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">
                Body system
              </span>
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 disabled:bg-slate-100"
                disabled={loading}
                placeholder="Optional registry body system"
                value={bodySystem}
                onChange={(event) => setBodySystem(event.target.value)}
              />
            </label>
          </div>

          <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <input
              className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900"
              type="checkbox"
              checked={registryFirst}
              disabled={loading || mode === 'diagnosis_targeted'}
              onChange={(event) => setRegistryFirst(event.target.checked)}
            />
            <span>
              <span className="block text-sm font-semibold text-slate-900">
                Registry-first planning
              </span>
              <span className="mt-1 block text-sm text-slate-500">
                Registry-first planning selects balanced diagnosis targets before
                case synthesis.
              </span>
            </span>
          </label>

          <div>
            <button
              className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!canGenerate}
              type="submit"
            >
              {loading ? 'Generating...' : 'Generate cases'}
            </button>
            {mode === 'diagnosis_targeted' ? (
              <p className="mt-2 text-xs text-slate-500">
                Select targets below to stage the batch. Generation will unlock
                when the backend accepts explicit diagnosis IDs.
              </p>
            ) : null}
          </div>
        </section>

        <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <SectionHeader
            eyebrow="Registry target selection"
            title="Browse diagnosis registry"
            description="Search canonical names and accepted aliases, then stage targets for future targeted generation."
          />

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-2 xl:col-span-2">
              <span className="text-sm font-medium text-slate-700">Search</span>
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900"
                placeholder="Canonical name or alias"
                value={registryQuery}
                onChange={(event) => setRegistryQuery(event.target.value)}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">
                Specialty filter
              </span>
              <select
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900"
                value={registrySpecialtyFilter}
                onChange={(event) => setRegistrySpecialtyFilter(event.target.value)}
              >
                <option value="">Any specialty</option>
                {specialtyOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">
                Body-system filter
              </span>
              <select
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900"
                value={registryBodySystemFilter}
                onChange={(event) => setRegistryBodySystemFilter(event.target.value)}
              >
                <option value="">Any body system</option>
                {bodySystemOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 md:col-span-2 xl:col-span-1">
              <span className="text-sm font-medium text-slate-700">
                Difficulty filter
              </span>
              <select
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900"
                value={registryDifficultyFilter}
                onChange={(event) =>
                  setRegistryDifficultyFilter(
                    event.target.value as '' | DiagnosisDifficultyBand,
                  )
                }
              >
                {difficultyBandOptions.map((option) => (
                  <option key={option.value || 'all'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <SelectedTargets
            targets={selectedTargets}
            onRemove={(target) => toggleTarget(target)}
          />

          <RegistryPicker
            items={filteredRegistryItems}
            loading={registryLoading}
            error={registryError}
            selectedIds={selectedTargetIds}
            onToggle={toggleTarget}
          />

          <PlannerPreview
            mode={mode}
            track={track}
            bodySystem={bodySystem}
            difficulty={difficulty}
            registryFirst={registryFirst}
            selectedTargets={selectedTargets}
          />
        </section>
      </form>

      {loading ? (
        <section className="rounded-2xl border border-sky-200 bg-sky-50 p-5 text-sm text-sky-800">
          {generationStatusCopy} Planning registry targets, generating cases,
          and running validation.
        </section>
      ) : null}

      {result && summary ? (
        <BatchResultsConsole
          activeTab={activeTab}
          driftCount={driftCount}
          plannerSummary={plannerSummary}
          result={result}
          summary={summary}
          unavailableCount={unavailableCount}
          onChangeTab={setActiveTab}
        />
      ) : !loading ? (
        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <SectionHeader
            eyebrow="Ready"
            title="Prepare a registry-balanced case batch."
            description="Choose filters or select diagnosis targets, then generate."
          />
        </section>
      ) : null}
    </div>
  );
}

function SectionHeader({
  description,
  eyebrow,
  title,
}: {
  description: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
        {eyebrow}
      </p>
      <h2 className="mt-1 text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  );
}

function ModeButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={[
        'rounded-lg px-3 py-2 text-sm font-semibold transition',
        active
          ? 'bg-white text-slate-950 shadow-sm'
          : 'text-slate-600 hover:bg-white/60 hover:text-slate-900',
      ].join(' ')}
      type="button"
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function SelectedTargets({
  targets,
  onRemove,
}: {
  targets: DiagnosisRegistrySearchItem[];
  onRemove: (target: DiagnosisRegistrySearchItem) => void;
}) {
  if (targets.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
        No diagnosis targets selected.
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {targets.map((target) => (
        <button
          key={target.id}
          className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
          type="button"
          onClick={() => onRemove(target)}
        >
          {target.canonicalName} x
        </button>
      ))}
    </div>
  );
}

function RegistryPicker({
  error,
  items,
  loading,
  onToggle,
  selectedIds,
}: {
  error: string | null;
  items: DiagnosisRegistrySearchItem[];
  loading: boolean;
  onToggle: (item: DiagnosisRegistrySearchItem) => void;
  selectedIds: Set<string>;
}) {
  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
        Loading registry diagnoses...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        {error}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
        No registry diagnoses match these filters.
      </div>
    );
  }

  return (
    <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
      {items.map((item) => {
        const selected = selectedIds.has(item.id);

        return (
          <button
            key={item.id}
            className={[
              'w-full rounded-xl border p-3 text-left transition',
              selected
                ? 'border-teal-300 bg-teal-50'
                : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white',
            ].join(' ')}
            type="button"
            onClick={() => onToggle(item)}
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="font-semibold text-slate-900">
                  {item.canonicalName}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {formatNullable(item.specialty)} -{' '}
                  {formatNullable(item.bodySystem)} -{' '}
                  {formatNullable(item.difficultyBand)}
                </p>
                {item.aliasPreview?.length ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Aliases: {item.aliasPreview.slice(0, 3).join(', ')}
                    {item.aliasPreview.length > 3
                      ? ` +${item.aliasPreview.length - 3}`
                      : ''}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-slate-400">No aliases shown</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusBadge status={item.status} />
                <PlainBadge
                  label={item.isGeneratable === false ? 'Not generatable' : 'Generatable'}
                  tone={item.isGeneratable === false ? 'red' : 'teal'}
                />
                <PlainBadge
                  label={item.isPlayable === false ? 'Not playable' : 'Playable'}
                  tone={item.isPlayable === false ? 'amber' : 'slate'}
                />
                {selected ? <PlainBadge label="Selected" tone="teal" /> : null}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function PlannerPreview({
  bodySystem,
  difficulty,
  mode,
  registryFirst,
  selectedTargets,
  track,
}: {
  bodySystem: string;
  difficulty: string;
  mode: GenerationMode;
  registryFirst: boolean;
  selectedTargets: DiagnosisRegistrySearchItem[];
  track: string;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-sm font-semibold text-slate-900">Planner preview</h3>
      {mode === 'registry_balanced' ? (
        <div className="mt-3 space-y-2 text-sm text-slate-600">
          <p>
            Planner will select diagnoses using generatable/playable registry
            rows{registryFirst ? '.' : ', unless registry-first planning is off.'}
          </p>
          <PreviewLine label="Specialty" value={compactValue(track) ?? 'Any'} />
          <PreviewLine
            label="Body system"
            value={compactValue(bodySystem) ?? 'Any'}
          />
          <PreviewLine
            label="Difficulty"
            value={compactValue(difficulty) ?? 'Balanced'}
          />
        </div>
      ) : (
        <div className="mt-3 space-y-2 text-sm text-slate-600">
          {selectedTargets.length === 0 ? (
            <p>Select one or more diagnoses from the registry picker.</p>
          ) : (
            selectedTargets.map((target) => (
              <PreviewLine
                key={target.id}
                label={target.canonicalName}
                value={`${formatNullable(target.specialty)} / ${formatNullable(
                  target.bodySystem,
                )} / ${formatNullable(target.difficultyBand)}`}
              />
            ))
          )}
        </div>
      )}
    </section>
  );
}

function PreviewLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
      <span className="font-medium text-slate-700">{label}</span>
      <span className="text-slate-500">{value}</span>
    </div>
  );
}

function BatchResultsConsole({
  activeTab,
  driftCount,
  onChangeTab,
  plannerSummary,
  result,
  summary,
  unavailableCount,
}: {
  activeTab: GenerationResultTab;
  driftCount: number;
  onChangeTab: (tab: GenerationResultTab) => void;
  plannerSummary: PlannedGenerationSlot['diagnostics'] | null;
  result: GenerateCasesResult;
  summary: ResultSummary;
  unavailableCount: number;
}) {
  const tabCounts: Record<GenerationResultTab, number> = {
    all: summary.all.length,
    created: summary.created.length,
    skipped: summary.skipped.length,
    failed: summary.failed.length,
    planner: result.plannerDiagnostics.length,
  };

  return (
    <section className="space-y-5 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <SectionHeader
          eyebrow="Batch results"
          title={`Batch ${result.batchId}`}
          description="Inspect generated cases, skipped outcomes, failures, and planner diagnostics."
        />
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Per-case quality is available in editorial detail after generation.
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
        <MetricCard label="Requested" value={result.requested} />
        <MetricCard label="Generated" value={result.generated} />
        <MetricCard label="Accepted" value={result.accepted} />
        <MetricCard label="Rejected" value={result.rejected} tone="amber" />
        <MetricCard label="Created" value={result.created} tone="teal" />
        <MetricCard label="Skipped" value={result.skipped} tone="amber" />
        <MetricCard label="Failed" value={result.failed} tone="red" />
        <MetricCard
          label="Avg quality"
          value={result.averageQualityScore ?? 'None'}
          tone={getQualityTone(result.averageQualityScore)}
        />
      </div>

      {plannerSummary ? (
        <div className="grid gap-3 md:grid-cols-4">
          <MetricCard
            label="Selected unused"
            value={plannerSummary.selectedUnusedCount}
          />
          <MetricCard
            label="Selected repeats"
            value={plannerSummary.selectedRepeatCount}
            tone="amber"
          />
          <MetricCard
            label="Unavailable"
            value={unavailableCount}
            tone={unavailableCount > 0 ? 'red' : 'default'}
          />
          <MetricCard label="Planner drift" value={driftCount} tone="amber" />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {resultTabs.map((tab) => (
          <button
            key={tab.value}
            className={[
              'rounded-lg px-3 py-2 text-sm font-semibold transition',
              activeTab === tab.value
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
            ].join(' ')}
            type="button"
            onClick={() => onChangeTab(tab.value)}
          >
            {tab.label} ({tabCounts[tab.value]})
          </button>
        ))}
      </div>

      {activeTab === 'all' ? (
        <ResultList items={summary.all} />
      ) : activeTab === 'created' ? (
        <CreatedList items={summary.created} />
      ) : activeTab === 'skipped' ? (
        <SkippedList items={summary.skipped} />
      ) : activeTab === 'failed' ? (
        <FailedList items={summary.failed} />
      ) : (
        <PlannerDiagnostics result={result} />
      )}
    </section>
  );
}

function ResultList({ items }: { items: GenerateCaseResultItem[] }) {
  if (items.length === 0) {
    return <EmptyPanel message="No results in this batch." />;
  }

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {items.map((item) => (
        <ResultCard key={`${item.status}-${item.index}`} item={item} />
      ))}
    </div>
  );
}

function ResultCard({ item }: { item: GenerateCaseResultItem }) {
  if (item.status === 'created') {
    return <CreatedCard item={item} />;
  }

  if (item.status === 'skipped') {
    return <SkippedCard item={item} />;
  }

  return <FailedCard item={item} />;
}

function CreatedList({ items }: { items: CreatedResult[] }) {
  if (items.length === 0) {
    return <EmptyPanel message="No cases were created in this batch." />;
  }

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {items.map((item) => (
        <CreatedCard key={item.caseId} item={item} />
      ))}
    </div>
  );
}

function CreatedCard({ item }: { item: CreatedResult }) {
  return (
    <article className="rounded-xl border border-teal-200 bg-teal-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">
        Created slot {item.index + 1}
      </p>
      <h3 className="mt-2 text-base font-semibold text-slate-900">
        {item.answer}
      </h3>
      <p className="mt-1 text-xs text-slate-600">Case ID: {item.caseId}</p>
      <Link
        className="mt-3 inline-flex rounded-lg bg-white px-3 py-2 text-sm font-semibold text-teal-700 ring-1 ring-teal-200 transition hover:bg-teal-100"
        to={`/cases/${item.caseId}`}
      >
        Open in editorial
      </Link>
    </article>
  );
}

function SkippedList({ items }: { items: SkippedResult[] }) {
  if (items.length === 0) {
    return <EmptyPanel message="No cases were skipped in this batch." />;
  }

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {items.map((item) => (
        <SkippedCard key={`${item.index}-${item.reason}`} item={item} />
      ))}
    </div>
  );
}

function SkippedCard({ item }: { item: SkippedResult }) {
  return (
    <article className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
        Skipped slot {item.index + 1}
      </p>
      <h3 className="mt-2 text-base font-semibold text-slate-900">
        {item.answer}
      </h3>
      <p className="mt-1 text-sm text-amber-800">
        Reason: {skipReasonLabels[item.reason]}
      </p>
    </article>
  );
}

function FailedList({ items }: { items: FailedResult[] }) {
  if (items.length === 0) {
    return <EmptyPanel message="No failures were reported in this batch." />;
  }

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {items.map((item) => (
        <FailedCard key={`${item.index}-${item.error}`} item={item} />
      ))}
    </div>
  );
}

function FailedCard({ item }: { item: FailedResult }) {
  return (
    <article className="rounded-xl border border-rose-200 bg-rose-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-700">
        Failed slot {item.index + 1}
      </p>
      <p className="mt-2 text-sm text-rose-800">{item.error}</p>
      <p className="mt-2 text-xs text-slate-600">
        Retry with narrower registry filters if this reflects target scarcity or
        repeated validation failures.
      </p>
    </article>
  );
}

function PlannerDiagnostics({ result }: { result: GenerateCasesResult }) {
  if (result.plannerDiagnostics.length === 0) {
    return <EmptyPanel message="No planner diagnostics were returned." />;
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-[0.18em] text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Slot</th>
              <th className="px-4 py-3 font-semibold">Target diagnosis</th>
              <th className="px-4 py-3 font-semibold">Specialty</th>
              <th className="px-4 py-3 font-semibold">Body system</th>
              <th className="px-4 py-3 font-semibold">Difficulty</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">AI answer</th>
              <th className="px-4 py-3 font-semibold">Match</th>
              <th className="px-4 py-3 font-semibold">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-700">
            {result.plannerDiagnostics.map((slot) => (
              <tr key={`${slot.batchId}-${slot.index}`}>
                <td className="px-4 py-3 font-medium text-slate-900">
                  {slot.index + 1}
                </td>
                <td className="px-4 py-3">
                  {slot.diagnosis?.displayLabel ?? 'No target'}
                </td>
                <td className="px-4 py-3">
                  {formatNullable(slot.diagnosis?.specialty)}
                </td>
                <td className="px-4 py-3">
                  {formatNullable(slot.diagnosis?.bodySystem)}
                </td>
                <td className="px-4 py-3">
                  {formatNullable(slot.diagnosis?.difficultyBand)}
                </td>
                <td className="px-4 py-3">{formatPlannerStatus(slot)}</td>
                <td className="px-4 py-3">
                  {formatNullable(slot.comparison?.aiAnswer)}
                </td>
                <td className="px-4 py-3">
                  {slot.comparison
                    ? slot.comparison.matchesPlanner
                      ? 'Match'
                      : 'Drift'
                    : 'Pending'}
                </td>
                <td className="px-4 py-3">
                  {formatNullable(slot.repeatReason)}
                  {slot.duplicatePrevented ? ' / duplicate prevented' : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <details className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-900">
          Raw planner diagnostics
        </summary>
        <pre className="mt-3 max-h-96 overflow-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">
          {JSON.stringify(result.plannerDiagnostics, null, 2)}
        </pre>
      </details>
    </div>
  );
}

type MetricTone = 'default' | 'teal' | 'amber' | 'red';

function MetricCard({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number | string;
  tone?: MetricTone;
}) {
  const toneClass = {
    default: 'border-slate-200 bg-slate-50 text-slate-500',
    teal: 'border-teal-200 bg-teal-50 text-teal-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    red: 'border-rose-200 bg-rose-50 text-rose-700',
  }[tone];

  return (
    <div className={`rounded-xl border px-4 py-3 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.2em]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function PlainBadge({
  label,
  tone,
}: {
  label: string;
  tone: 'slate' | 'teal' | 'amber' | 'red';
}) {
  const toneClass = {
    slate: 'border-slate-200 bg-white text-slate-600',
    teal: 'border-teal-200 bg-white text-teal-700',
    amber: 'border-amber-200 bg-white text-amber-700',
    red: 'border-rose-200 bg-white text-rose-700',
  }[tone];

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${toneClass}`}
    >
      {label}
    </span>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
      {message}
    </div>
  );
}
