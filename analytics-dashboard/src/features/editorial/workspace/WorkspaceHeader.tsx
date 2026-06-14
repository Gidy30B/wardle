import { Link } from 'react-router-dom';

import type {
  DiagnosisEditorialWorkspace,
  WorkspaceLifecycle,
} from '../../../api/admin';
import { SpecialtyIcon } from '../../specialties/specialty-icons';
import { Btn } from './EditorialPrimitives';
import { formatLabel, formatScore } from './workspaceTransforms';
import type { WorkspaceTab } from './workspaceTypes';
import { WORKSPACE_TABS } from './workspaceTypes';

export function WorkspaceHeader({
  workspace,
}: {
  workspace: DiagnosisEditorialWorkspace;
}) {
  const canonicalDifferent =
    workspace.diagnosis.canonicalName &&
    workspace.diagnosis.canonicalName.toLowerCase() !==
      workspace.diagnosis.displayLabel.toLowerCase();
  const taxonomy = [
    workspace.diagnosis.bodySystem,
    workspace.diagnosis.category,
    workspace.diagnosis.difficultyBand,
  ].filter(Boolean);

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--color-navy-border)] bg-[var(--color-navy-mid)] text-white shadow-sm">
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <Link
              to="/editorial/workspace"
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 transition hover:text-slate-200"
            >
              â€¹ Queue
            </Link>
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-teal)]">
              Editorial Diagnosis Workspace
            </p>
            <h2 className="font-display mt-2 text-xl leading-tight sm:text-[30px]">
              {workspace.diagnosis.displayLabel}
            </h2>
            {canonicalDifferent ? (
              <p className="mt-1 text-sm text-slate-300">
                {workspace.diagnosis.canonicalName}
              </p>
            ) : null}
            {workspace.diagnosis.specialty || taxonomy.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {workspace.diagnosis.specialty ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-sm text-slate-300">
                    <SpecialtyIcon
                      specialty={workspace.diagnosis.specialty}
                      className="h-3.5 w-3.5"
                    />
                    {formatLabel(workspace.diagnosis.specialty)}
                  </span>
                ) : null}
                {taxonomy.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-sm text-slate-300"
                  >
                    {formatLabel(String(item))}
                  </span>
                ))}
              </div>
            ) : null}
            <p className="mt-2 break-all font-mono text-xs text-slate-400">
              {workspace.diagnosis.id}
            </p>
          </div>
          <div className="flex flex-wrap items-start justify-end gap-2">
            <Btn>Maturity history</Btn>
            <Btn variant="primary">+ Add distinction</Btn>
            <div className="flex w-full flex-wrap justify-end gap-2">
              <HeaderPill label={formatLabel(workspace.workspaceSummary.status)} />
              <HeaderPill label={formatLabel(workspace.lifecycle.ready)} />
            </div>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <HeaderMetric label="Education" value={workspace.education.status} />
          <HeaderMetric
            label="Usable cases"
            value={`${workspace.cases.summary.usable}/${workspace.cases.summary.total}`}
          />
          <HeaderMetric
            label="Coverage"
            value={formatScore(workspace.workspaceSummary.overallScore)}
          />
          <HeaderMetric label="Graph" value={workspace.graph.readiness} />
        </div>
      </div>

      <MaturityStageTrack lifecycle={workspace.lifecycle} />
    </section>
  );
}

const lifecycleSteps: Array<{
  key: keyof WorkspaceLifecycle;
  label: string;
}> = [
  { key: 'curriculum', label: 'Curriculum' },
  { key: 'brief', label: 'Brief' },
  { key: 'education', label: 'Education' },
  { key: 'cases', label: 'Cases' },
  { key: 'graph', label: 'Graph' },
  { key: 'ready', label: 'Ready' },
];

function MaturityStageTrack({ lifecycle }: { lifecycle: WorkspaceLifecycle }) {
  const firstBlocked = lifecycleSteps.findIndex(
    (step) => lifecycle[step.key] === 'blocked',
  );
  const firstIncomplete = lifecycleSteps.findIndex(
    (step) => lifecycle[step.key] !== 'complete',
  );
  const currentIndex =
    firstBlocked >= 0
      ? firstBlocked
      : firstIncomplete >= 0
        ? firstIncomplete
        : lifecycleSteps.length - 1;

  return (
    <div className="flex items-center overflow-x-auto border-t border-[var(--color-navy-border)]">
      {lifecycleSteps.map((stage, index) => {
        const done = index < currentIndex && lifecycle[stage.key] === 'complete';
        const current = index === currentIndex;
        const blocked = lifecycle[stage.key] === 'blocked';
        return (
          <div
            key={stage.key}
            className={[
              'flex shrink-0 items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-[11.5px] whitespace-nowrap',
              done ? 'border-[var(--color-teal)] text-[var(--color-teal)]' : '',
              current && !blocked
                ? 'border-white font-medium text-[var(--color-white-text)]'
                : '',
              blocked ? 'border-transparent text-[var(--color-rose)]' : '',
              !done && !current && !blocked
                ? 'border-transparent text-[var(--color-slate)]'
                : '',
            ].join(' ')}
          >
            <span className="h-[5px] w-[5px] shrink-0 rounded-full bg-current" />
            {stage.label}
          </div>
        );
      })}
    </div>
  );
}

function HeaderPill({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-[var(--color-navy-border)] bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-100">
      {label}
    </span>
  );
}

function HeaderMetric({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-navy-border)] bg-white/5 px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </p>
      <p className="font-editorial-num mt-1 text-[22px] text-white">
        {value === null || value === undefined
          ? 'Unknown'
          : formatLabel(String(value))}
      </p>
    </div>
  );
}

export function TabBar({
  activeTab,
  onChange,
}: {
  activeTab: WorkspaceTab;
  onChange: (tab: WorkspaceTab) => void;
}) {
  return (
    <div className="overflow-x-auto border-b border-[var(--color-navy-border)] bg-[var(--color-navy-mid)]">
      <div className="flex min-w-max">
        {WORKSPACE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={[
              'border-b-2 px-3 py-3 text-sm font-medium whitespace-nowrap transition-colors sm:px-5',
              activeTab === tab.id
                ? 'border-[var(--color-teal)] text-[var(--color-teal)] font-semibold'
                : 'border-transparent text-slate-400 hover:border-slate-500 hover:text-slate-200',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
