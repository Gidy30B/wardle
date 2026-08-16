import StatusBadge from '../../../../components/ui/StatusBadge';
import type { WorkflowTone } from '../viewModels/editorialWorkflowViewModel.ts';

export function BoardVerdict({
  eyebrow,
  question,
  verdict,
  detail,
  topConcerns,
  tone = 'info',
}: {
  eyebrow: string;
  question: string;
  verdict: string;
  detail?: string;
  topConcerns?: string[];
  tone?: WorkflowTone;
}) {
  const concerns = topConcerns ?? [];

  return (
    <section className="rounded-xl border border-[var(--color-navy-border)] bg-[var(--color-navy-mid)] p-4 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="editorial-eyebrow">{eyebrow}</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-100">
            {question}
          </h2>
        </div>
        <StatusBadge status={tone} tone={toneToBadge(tone)} />
      </div>
      <p className="mt-3 text-base leading-7 text-slate-200">{verdict}</p>
      {detail ? (
        <p className="mt-2 text-sm leading-6 text-slate-400">{detail}</p>
      ) : null}
      {topConcerns ? (
        <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Key concerns
          </p>
          {concerns.length ? (
            <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-300">
              {concerns.slice(0, 3).map((concern) => (
                <li key={concern}>- {concern}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs leading-5 text-slate-400">
              No concerns are currently projected.
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}

export function toneToBadge(tone: WorkflowTone | string) {
  if (tone === 'danger') return 'danger';
  if (tone === 'warning') return 'warning';
  if (tone === 'success') return 'success';
  return 'info';
}
