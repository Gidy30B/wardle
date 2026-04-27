import type { RoundViewModel, RoundVisibleClue } from '../round.types'

export type PhaserVisibleClue = RoundVisibleClue
export type PhaserGameSessionSnapshot = RoundViewModel

export type PhaserGameSessionIntents = {
  onInputCharacter: (value: string) => void
  onMoveSuggestionHighlight: (direction: -1 | 1) => void
  onSelectSuggestion: (index: number) => void
  onSelectHighlightedSuggestion: () => boolean
  onSubmit: () => void
  onContinue: () => void
  onOpenExplanation: () => void
  onOpenMenu: () => void
  onClearGuess: () => void
  onClearSelectedSuggestion: () => boolean
  onBackspace: () => void
  onReload: () => void
}
