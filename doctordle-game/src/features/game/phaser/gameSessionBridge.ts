import type { RoundViewModel, RoundVisibleClue } from '../round.types'

export type PhaserVisibleClue = RoundVisibleClue
export type PhaserGameSessionSnapshot = RoundViewModel

export type PhaserGameSessionIntents = {
  onKeyPress: (value: string) => void
  onSubmit: () => void
  onContinue: () => void
  onOpenExplanation: () => void
  onOpenMenu: () => void
  onClearGuess: () => void
  onBackspace: () => void
  onReload: () => void
}
