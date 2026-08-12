import type { WorkflowTone } from './viewModels/editorialWorkflowViewModel.ts';
import type {
  WorkflowNavigationViewModel,
  WorkspaceWorkflowId,
} from './viewModels/workflowNavigationViewModel.ts';

export function WorkspaceWorkflowNav({
  navigation,
  workflowTones,
  onWorkflowChange,
}: {
  navigation: WorkflowNavigationViewModel;
  workflowTones: Partial<Record<WorkspaceWorkflowId, WorkflowTone>>;
  onWorkflowChange: (workflowId: WorkspaceWorkflowId) => void;
}) {
  return (
    <nav
      aria-label="Editorial workflow navigation"
      className="sticky top-0 z-20 overflow-x-auto border-b border-[var(--color-navy-border)] bg-[var(--color-navy)]/95 backdrop-blur"
    >
      <div className="flex min-w-max gap-1 px-1 py-2">
        {navigation.items.map((item) => {
          const isActive = item.id === navigation.activeWorkflowId;
          const tone = workflowTones[item.id];
          const showBadge =
            !isActive &&
            tone &&
            tone !== 'neutral' &&
            tone !== 'info' &&
            tone !== 'success';

          return (
            <button
              key={item.id}
              data-testid={`workspace-workflow-${item.id}`}
              type="button"
              onClick={() => onWorkflowChange(item.id)}
              className={[
                'rounded-lg border px-3 py-2 text-left transition',
                isActive
                  ? 'border-[var(--color-teal)] bg-[var(--color-teal-bg)] text-[var(--color-teal)]'
                  : 'border-transparent text-slate-400 hover:border-[var(--color-navy-border)] hover:bg-white/5 hover:text-slate-100',
              ].join(' ')}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="flex items-center justify-between gap-1.5">
                <span className="block text-xs font-semibold">{item.label}</span>
                {showBadge && (
                  <span
                    aria-label={tone === 'danger' ? 'has blockers' : 'has warnings'}
                    className={[
                      'inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold',
                      tone === 'danger'
                        ? 'bg-[var(--color-rose)]/15 text-[var(--color-rose)]'
                        : 'bg-[var(--color-amber)]/15 text-[var(--color-amber)]',
                    ].join(' ')}
                  >
                    {tone === 'danger' ? '!' : '~'}
                  </span>
                )}
              </span>
              <span className="mt-0.5 block max-w-[190px] truncate text-[10px] opacity-70">
                {item.question}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
