import StatusBadge from '../../../../components/ui/StatusBadge';
import type { MnemonicCardViewModel } from '../viewModels/contentCoverageViewModel.ts';
import { toneToBadge } from './BoardVerdict.tsx';

export function MnemonicCard({ mnemonic }: { mnemonic: MnemonicCardViewModel }) {
  return (
    <article className="rounded-lg border border-[var(--color-navy-border)] bg-white/[0.03] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-100">
            {mnemonic.mnemonic}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {mnemonic.associatedScoringSystem ?? 'No linked scoring system'}
          </p>
        </div>
        <StatusBadge status={mnemonic.tone} tone={toneToBadge(mnemonic.tone)} />
      </div>

      <div className="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-3">
        <span>Education: {mnemonic.educationSupported ? 'yes' : 'no'}</span>
        <span>Recall: {mnemonic.recallSupported ? 'yes' : 'no'}</span>
        <span>Cases: {mnemonic.caseSupported ? 'yes' : 'no'}</span>
      </div>

      {mnemonic.issues.length ? (
        <ul className="mt-3 space-y-1 text-xs leading-5 text-amber-200">
          {mnemonic.issues.map((issue) => (
            <li key={issue}>- {issue}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
