import type {
  WorkflowSectionViewModel,
  WorkflowTone,
} from './viewModels/editorialWorkflowViewModel.ts';
import type { WorkspaceWorkflowId } from './viewModels/workflowNavigationViewModel.ts';

const HEALTH_WORKFLOW_IDS: WorkspaceWorkflowId[] = [
  'overview',
  'teaching',
  'cases',
  'content',
  'publish',
];

function toneToHealthDot(tone: WorkflowTone): string {
  if (tone === 'danger') return 'bg-[var(--color-rose)]';
  if (tone === 'warning') return 'bg-[var(--color-amber)]';
  if (tone === 'success') return 'bg-[var(--color-green)]';
  return 'bg-slate-600';
}

export function WorkspaceStatusStrip({
  diagnosisName,
  activeWorkflow,
  blockerCount,
  warningCount,
  workflowHealth,
}: {
  diagnosisName: string;
  activeWorkflow: WorkflowSectionViewModel;
  blockerCount: number;
  warningCount: number;
  workflowHealth: Partial<
    Record<WorkspaceWorkflowId, { label: string; tone: WorkflowTone }>
  >;
}) {
  return (
    <div className="border-b border-[var(--color-navy-border)] px-1 py-3">
      <p className="text-base font-semibold leading-none text-slate-100">
        {diagnosisName}
      </p>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="text-xs text-slate-400">
          <span className="font-medium text-[var(--color-teal)]">
            {activeWorkflow.label}
          </span>
          {' · '}
          {activeWorkflow.question}
        </p>
        <p className="text-xs">
          {blockerCount > 0 && (
            <span className="text-[var(--color-rose)]">
              {blockerCount} blocker{blockerCount !== 1 ? 's' : ''}
            </span>
          )}
          {blockerCount > 0 && warningCount > 0 && (
            <span className="mx-1.5 text-slate-600">·</span>
          )}
          {warningCount > 0 && (
            <span className="text-[var(--color-amber)]">
              {warningCount} warning{warningCount !== 1 ? 's' : ''}
            </span>
          )}
          {blockerCount === 0 && warningCount === 0 && (
            <span className="text-[var(--color-green)]">No blockers projected</span>
          )}
        </p>
      </div>
      <div className="mt-2 flex flex-wrap gap-3">
        {HEALTH_WORKFLOW_IDS.map((id) => {
          const wf = workflowHealth[id];
          if (!wf) return null;
          return (
            <span key={id} className="flex items-center gap-1 text-[10px] text-slate-500">
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${toneToHealthDot(wf.tone)}`}
                aria-hidden="true"
              />
              {wf.label}
              <span className="sr-only"> status: {wf.tone}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
