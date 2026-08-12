import StatusBadge from '../../../../components/ui/StatusBadge';
import { BoardEmptyState } from '../components/BoardEmptyState.tsx';
import { BoardVerdict } from '../components/BoardVerdict.tsx';
import { ClinicalJudgementRow } from '../components/ClinicalJudgementRow.tsx';
import { CompactPanel } from '../EditorialPrimitives.tsx';
import type { WorkspaceWorkflowComponentProps } from '../WorkspaceWorkflowRegistry.ts';

export function OverviewWorkflow({ viewModel }: WorkspaceWorkflowComponentProps) {
  const workflow = viewModel.overview;

  return (
    <div className="space-y-4">
      <BoardVerdict
        eyebrow={viewModel.diagnosis.name}
        question={workflow.question}
        verdict={workflow.clinicalVerdict}
        detail={workflow.detail}
        topConcerns={workflow.concerns.map((concern) => concern.title)}
        tone={workflow.tone}
      />

      <CompactPanel
        title="Editorial governance summary"
        subtitle="Structured editorial assessment."
        action={<StatusBadge status={workflow.tone} tone={workflow.tone === 'danger' ? 'danger' : workflow.tone === 'warning' ? 'warning' : 'success'} />}
      >
        <div className="space-y-3">
          <div className="rounded-lg border border-[var(--color-navy-border)] bg-white/[0.03] p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Core diagnostic claim
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-200">
              {viewModel.diagnosticReasoning.coreDiagnosticClaim.claim}
            </p>
          </div>

          {workflow.concerns.length ? (
            <div className="grid gap-2">
              {workflow.concerns.map((concern) => (
                <article
                  key={concern.id}
                  className="rounded-lg border border-[var(--color-navy-border)] bg-white/[0.03] p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-100">
                        {concern.title}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-400">
                        {concern.detail}
                      </p>
                    </div>
                    <StatusBadge
                      status={concern.severity}
                      tone={concern.severity === 'blocker' ? 'danger' : 'warning'}
                    />
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <BoardEmptyState
              title="No governance concerns projected"
              detail="No blocker-level or warning-level concerns are projected by the knowledge or diagnostic reasoning layers."
            />
          )}
        </div>
      </CompactPanel>

      <CompactPanel
        title="Editorial standing checks"
        subtitle="Structured editorial checks across five governance domains."
      >
        <div className="grid gap-3 lg:grid-cols-2">
          {workflow.standing.map((row) => (
            <ClinicalJudgementRow
              key={row.id}
              label={row.label}
              status={row.status}
              detail={row.detail}
              tone={row.tone}
            />
          ))}
        </div>
      </CompactPanel>
    </div>
  );
}
