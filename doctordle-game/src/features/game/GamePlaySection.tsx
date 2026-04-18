import { useMemo } from 'react'
import PhaserGameSession from './phaser/PhaserGameSession'
import type { PhaserGameSessionIntents, PhaserGameSessionSnapshot } from './phaser/gameSessionBridge'
import type { RoundViewModel } from './round.types'

type GamePlaySectionProps = {
  roundViewModel: RoundViewModel
  onGuessChange: (value: string) => void
  onClearGuess: () => void
  onBackspace: () => void
  onSubmit: () => void
  onContinue?: () => void
  onWhy?: () => void
  onReload?: () => void
  onOpenMenu: () => void
  onOpenExplanation: () => void
}

export default function GamePlaySection({
  roundViewModel,
  onGuessChange,
  onClearGuess,
  onBackspace,
  onSubmit,
  onContinue,
  onWhy,
  onReload,
  onOpenMenu,
  onOpenExplanation,
}: GamePlaySectionProps) {
  const snapshot = useMemo<PhaserGameSessionSnapshot>(
    () => roundViewModel,
    [roundViewModel],
  )

  const intents = useMemo<PhaserGameSessionIntents>(
    () => ({
      onKeyPress: (value: string) => {
        if (!roundViewModel.canEditGuess) {
          return
        }

        onGuessChange(`${roundViewModel.guess}${value}`.toUpperCase())
      },
      onSubmit,
      onContinue: onContinue ?? (() => undefined),
      onOpenExplanation: onWhy ?? onOpenExplanation,
      onOpenMenu,
      onClearGuess,
      onBackspace,
      onReload: onReload ?? (() => undefined),
    }),
    [onBackspace, onClearGuess, onContinue, onGuessChange, onOpenExplanation, onOpenMenu, onReload, onSubmit, onWhy, roundViewModel.canEditGuess, roundViewModel.guess],
  )

  return (
    <section className="relative flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex-1 min-h-0">
        <PhaserGameSession snapshot={snapshot} intents={intents} className="h-full w-full" />
      </div>
    </section>
  )
}
