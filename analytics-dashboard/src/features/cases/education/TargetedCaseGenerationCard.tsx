import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type {
  ClueRevealStrategy,
  DiagnosisGraphCandidate,
  GenerateTargetedCaseResult,
  TargetedCaseDifficulty,
  TeachingUnitCoverageMap,
} from '../../../api/admin';
import {
  CompactMetricGrid,
  EmptyGuidance,
  PrototypeSectionHeader,
} from '../../editorial/workspace/EditorialPrimitives';

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
    <section className="editorial-panel rounded-lg p-4">
      <PrototypeSectionHeader
        eyebrow="Coverage action"
        title="Generate targeted case"
        subtitle="Create a draft case that closes selected learning-goal and mimic gaps. Generated cases require review before publishing."
        action={
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
          className="rounded-lg border border-[var(--color-teal)]/40 bg-[var(--color-teal)]/15 px-4 py-2 text-sm font-semibold text-[var(--color-teal)] transition hover:bg-[var(--color-teal)]/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? 'Generating...' : 'Generate case'}
        </button>
        }
      />

      <div className="mt-4">
        <CompactMetricGrid
          items={[
            { label: 'Teaching units', value: teachingUnits.length, tone: teachingUnits.length ? 'warning' : 'neutral' },
            { label: 'Selected goals', value: selectedTeachingUnitIds.length, tone: selectedTeachingUnitIds.length ? 'success' : 'warning' },
            { label: 'Mimics available', value: mimicOptions.length, tone: mimicOptions.length ? 'info' : 'neutral' },
            { label: 'Selected mimics', value: selectedMimicIds.length, tone: selectedMimicIds.length ? 'success' : 'neutral' },
          ]}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <label className="block text-sm font-medium text-slate-300">
          Difficulty
          <select
            value={difficulty}
            onChange={(event) =>
              setDifficulty(event.target.value as TargetedCaseDifficulty)
            }
            className="mt-1 w-full rounded-lg border border-[var(--color-navy-border)] bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-[var(--color-teal)]"
          >
            {difficulties.map((item) => (
              <option key={item} value={item}>
                {formatLabel(item)}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-medium text-slate-300">
          Clue reveal strategy
          <select
            value={clueRevealStrategy}
            onChange={(event) =>
              setClueRevealStrategy(event.target.value as ClueRevealStrategy)
            }
            className="mt-1 w-full rounded-lg border border-[var(--color-navy-border)] bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-[var(--color-teal)]"
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
        <div className="mt-4 rounded-lg border border-[var(--color-green)]/35 bg-[var(--color-green)]/10 p-3 text-sm text-green-100">
          <p className="font-semibold">Generated case queued for review.</p>
          <Link
            to={`/cases/${generatedCase.id}`}
            className="mt-1 inline-flex font-semibold text-[var(--color-green)] underline"
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
      <p className="text-sm font-semibold text-slate-100">{title}</p>
      {items.length === 0 ? (
        <div className="mt-2">
          <EmptyGuidance title="No options available" description={emptyLabel} />
        </div>
      ) : (
        <div className="mt-2 max-h-48 space-y-2 overflow-auto rounded-lg border border-[var(--color-navy-border)] bg-slate-950/35 p-2">
          {items.map((item) => (
            <label
              key={item.id}
              className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm text-slate-300 hover:bg-white/6"
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(item.id)}
                onChange={() => onToggle(item.id)}
                className="mt-1"
              />
              <span>
                <span className="font-medium text-slate-100">
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
