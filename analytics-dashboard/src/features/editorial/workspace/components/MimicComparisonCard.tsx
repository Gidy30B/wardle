import StatusBadge from '../../../../components/ui/StatusBadge';
import type { DiagnosticComparison } from '../viewModels/diagnosticReasoningViewModel.ts';

export function MimicComparisonCard({
  comparison,
}: {
  comparison: DiagnosticComparison;
}) {
  return (
    <article className="rounded-lg border border-[var(--color-navy-border)] bg-white/[0.03] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-100">
            {comparison.targetDiagnosisName} vs {comparison.mimicName}
          </p>
          {comparison.sharedConfusion ? (
            <p className="mt-1 text-xs leading-5 text-slate-400">
              Shared confusion: {comparison.sharedConfusion}
            </p>
          ) : null}
        </div>
        <StatusBadge
          status={comparison.confidence}
          tone={reasoningToneToBadge(comparison.confidence)}
        />
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-300">
        {comparison.whyTargetWins}
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <SupportPill label="Discriminators" value={comparison.discriminators.length} />
        <SupportPill label="Evidence" value={comparison.supportingEvidenceRelationshipIds.length} />
        <SupportPill label="Cases/paths" value={comparison.supportingReasoningPathIds.length} />
      </div>
    </article>
  );
}

function SupportPill({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-slate-400">
      {label}: {value}
    </span>
  );
}

function reasoningToneToBadge(tone: DiagnosticComparison['confidence']) {
  if (tone === 'strong') return 'success';
  if (tone === 'watch') return 'warning';
  return 'danger';
}
