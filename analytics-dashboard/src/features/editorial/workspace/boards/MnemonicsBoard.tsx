import { CompactPanel } from '../EditorialPrimitives.tsx';
import { BoardEmptyState } from '../components/BoardEmptyState.tsx';
import { BoardVerdict } from '../components/BoardVerdict.tsx';
import { MnemonicCard } from '../components/MnemonicCard.tsx';
import type { MnemonicsBoardViewModel } from '../viewModels/editorialWorkflowViewModel.ts';

export function MnemonicsBoard({ board }: { board: MnemonicsBoardViewModel }) {
  return (
    <div className="space-y-4">
      <BoardVerdict
        eyebrow={board.label}
        question={board.question}
        verdict={board.verdict}
        detail="Mnemonics are clinical memory aids; kept separate from formal scoring systems."
        tone={board.tone}
      />

      <CompactPanel title="Mnemonic coverage">
        {board.mnemonics.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {board.mnemonics.map((mnemonic) => (
              <MnemonicCard key={mnemonic.id} mnemonic={mnemonic} />
            ))}
          </div>
        ) : (
          <BoardEmptyState
            title="No mnemonics in learner content"
            detail="Mnemonics will appear when present in learner content."
          />
        )}
      </CompactPanel>
    </div>
  );
}
