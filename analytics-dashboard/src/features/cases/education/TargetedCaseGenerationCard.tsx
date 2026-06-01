import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type {
  ClueRevealStrategy,
  DiagnosisGraphCandidate,
  GenerateTargetedCaseResult,
  TargetedCaseDifficulty,
  TeachingUnitCoverageMap,
} from '../../../api/admin';

type Props = {
  coverage: TeachingUnitCoverageMap | null;
  mimicCandidates: DiagnosisGraphCandidate[];
  disabled: boolean;
  pending: boolean;
  generatedCase: GenerateTargetedCaseResult['generatedCase'] | null;
  onGenerate: (payload: {
    difficulty: TargetedCaseDifficulty;
    teachingUnitIds: string[];
    mimicDiagnosisIds?: string[];
    clueRevealStrategy?: ClueRevealStrategy;
  }) => void;
};

const difficulties: TargetedCaseDifficulty[] = ['EASY', 'MEDIUM', 'HARD'];

const revealStrategies: Array<{
  value: ClueRevealStrategy;
  label: string;
}> = [
  { value: 'classic', label: 'Classic' },
  { value: 'early_anchor', label: 'Early anchor' },
  { value: 'late_discriminator', label: 'Late discriminator' },
  { value: 'progressive_narrowing', label: 'Progressive narrowing' },
];

export default function TargetedCaseGenerationCard({
  coverage,
  mimicCandidates,
  disabled,
  pending,
  generatedCase,
  onGenerate,
}: Props) {
  const teachingUnits = coverage?.teachingUnits ?? [];
  const mimicOptions = useMemo(() => buildMimicOptions(mimicCandidates), [
    mimicCandidates,
  ]);
  const [difficulty, setDifficulty] =
    useState<TargetedCaseDifficulty>('MEDIUM');
  const [selectedTeachingUnitIds, setSelectedTeachingUnitIds] = useState<
    string[]
  >([]);
  const [selectedMimicIds, setSelectedMimicIds] = useState<string[]>([]);
  const [clueRevealStrategy, setClueRevealStrategy] =
    useState<ClueRevealStrategy>('progressive_narrowing');

  function toggle(values: string[], value: string) {
    return values.includes(value)
      ? values.filter((item) => item !== value)
      : [...values, value];
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            Generate targeted case
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Generated case will require review before publishing.
          </p>
        </div>
        <button
          type="button"
          disabled={disabled || pending}
          onClick={() =>
            onGenerate({
              difficulty,
              teachingUnitIds: selectedTeachingUnitIds,
              mimicDiagnosisIds: selectedMimicIds,
              clueRevealStrategy,
            })
          }
          className="rounded-xl border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? 'Generating...' : 'Generate case'}
        </button>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700">
          Difficulty
          <select
            value={difficulty}
            onChange={(event) =>
              setDifficulty(event.target.value as TargetedCaseDifficulty)
            }
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            {difficulties.map((item) => (
              <option key={item} value={item}>
                {formatLabel(item)}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Clue reveal strategy
          <select
            value={clueRevealStrategy}
            onChange={(event) =>
              setClueRevealStrategy(event.target.value as ClueRevealStrategy)
            }
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            {revealStrategies.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Checklist
          title="Teaching units"
          emptyLabel="No teaching units available yet."
          items={teachingUnits.map((unit) => ({
            id: unit.id,
            label: unit.title,
            detail: unit.recommendedAction,
          }))}
          selectedIds={selectedTeachingUnitIds}
          onToggle={(id) =>
            setSelectedTeachingUnitIds((values) => toggle(values, id))
          }
        />
        <Checklist
          title="Mimics to preserve"
          emptyLabel="No graph mimics available yet."
          items={mimicOptions}
          selectedIds={selectedMimicIds}
          onToggle={(id) =>
            setSelectedMimicIds((values) => toggle(values, id))
          }
        />
      </div>

      {generatedCase ? (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <p className="font-semibold">Generated case queued for review.</p>
          <Link
            to={`/cases/${generatedCase.id}`}
            className="mt-1 inline-flex font-semibold text-emerald-900 underline"
          >
            Open {generatedCase.title}
          </Link>
        </div>
      ) : null}
    </section>
  );
}

function Checklist({
  title,
  emptyLabel,
  items,
  selectedIds,
  onToggle,
}: {
  title: string;
  emptyLabel: string;
  items: Array<{ id: string; label: string; detail?: string }>;
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {items.length === 0 ? (
        <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
          {emptyLabel}
        </p>
      ) : (
        <div className="mt-2 max-h-48 space-y-2 overflow-auto rounded-lg border border-slate-200 p-2">
          {items.map((item) => (
            <label
              key={item.id}
              className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50"
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(item.id)}
                onChange={() => onToggle(item.id)}
                className="mt-1"
              />
              <span>
                <span className="font-medium text-slate-800">
                  {item.label}
                </span>
                {item.detail ? (
                  <span className="block text-xs text-slate-500">
                    {item.detail}
                  </span>
                ) : null}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function buildMimicOptions(candidates: DiagnosisGraphCandidate[]) {
  const options = new Map<string, { id: string; label: string; detail?: string }>();
  for (const candidate of candidates) {
    const id = candidate.targetDiagnosisRegistryId;
    const label =
      candidate.targetDiagnosisRegistry?.displayLabel ??
      candidate.unresolvedTargetText ??
      candidate.rawText;
    if (!id || !label || options.has(id)) {
      continue;
    }

    options.set(id, {
      id,
      label,
      detail: candidate.status === 'APPROVED' ? 'Approved graph mimic' : 'Graph mimic candidate',
    });
  }

  return [...options.values()];
}

function formatLabel(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
