import GamePlaySection from '../GamePlaySection'
import type { RoundViewModel } from '../round.types'
import ReactResultModal from './ReactResultModal'
import type { AppIconSet } from '../../../theme/icons'

type PlayTabPageProps = {
  iconSet: AppIconSet
  roundViewModel: RoundViewModel
  isResultModalOpen: boolean
  currentStreak: number | null
  organizationName: string | null
  onInputCharacter: (value: string) => void
  onChangeGuess: (value: string) => void
  onClearGuess: () => void
  onClearSelectedSuggestion: () => boolean
  onBackspace: () => void
  onMoveSuggestionHighlight: (direction: -1 | 1) => void
  onSelectSuggestion: (index: number) => void
  onSelectHighlightedSuggestion: () => boolean
  onSubmit: () => void
  onContinue: () => void
  onReload: () => void
  onCloseResultModal: () => void
  onReviewLearning: () => void
}

export default function PlayTabPage({
  iconSet,
  roundViewModel,
  isResultModalOpen,
  currentStreak,
  organizationName,
  onInputCharacter,
  onChangeGuess,
  onClearGuess,
  onClearSelectedSuggestion,
  onBackspace,
  onMoveSuggestionHighlight,
  onSelectSuggestion,
  onSelectHighlightedSuggestion,
  onSubmit,
  onContinue,
  onReload,
  onCloseResultModal,
  onReviewLearning,
}: PlayTabPageProps) {
  return (
    <>
      <GamePlaySection
        iconSet={iconSet}
        roundViewModel={roundViewModel}
        currentStreak={currentStreak}
        organizationName={organizationName}
        onInputCharacter={onInputCharacter}
        onChangeGuess={onChangeGuess}
        onClearGuess={onClearGuess}
        onClearSelectedSuggestion={onClearSelectedSuggestion}
        onBackspace={onBackspace}
        onMoveSuggestionHighlight={onMoveSuggestionHighlight}
        onSelectSuggestion={onSelectSuggestion}
        onSelectHighlightedSuggestion={onSelectHighlightedSuggestion}
        onSubmit={onSubmit}
        onContinue={onContinue}
        onReload={onReload}
        onOpenMenu={() => undefined}
        onOpenExplanation={() => undefined}
      />

      <ReactResultModal
        iconSet={iconSet}
        isOpen={isResultModalOpen}
        roundViewModel={roundViewModel}
        currentStreak={currentStreak}
        organizationName={organizationName}
        onClose={onCloseResultModal}
        onReviewLearning={onReviewLearning}
        onContinue={onContinue}
      />
    </>
  )
}
