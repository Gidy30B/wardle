import StatusBadge from '../../../../components/ui/StatusBadge';
import type { RecallPromptCardViewModel } from '../viewModels/contentCoverageViewModel.ts';
import { toneToBadge } from './BoardVerdict.tsx';

export function RecallPromptCard({
  prompt,
}: {
  prompt: RecallPromptCardViewModel;
}) {
  return (
    <article className="rounded-lg border border-[var(--color-navy-border)] bg-white/[0.03] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-100">{prompt.prompt}</p>
          <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
            {prompt.reasoningDepth.replace(/_/g, ' ')}
          </p>
        </div>
        <StatusBadge status={prompt.tone} tone={toneToBadge(prompt.tone)} />
      </div>

      <dl className="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-2">
        <PromptLink label="Concept" value={prompt.linkedConcept} />
        <PromptLink label="Discriminator" value={prompt.linkedDiscriminator} />
        <PromptLink label="Differential" value={prompt.linkedDifferential} />
        <PromptLink label="Scoring" value={prompt.linkedScoringSystem} />
      </dl>

      {prompt.issues.length ? (
        <ul className="mt-3 space-y-1 text-xs leading-5 text-amber-200">
          {prompt.issues.map((issue) => (
            <li key={issue}>- {issue}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function PromptLink({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-slate-500">{label}</dt>
      <dd>{value ?? 'not linked'}</dd>
    </div>
  );
}
