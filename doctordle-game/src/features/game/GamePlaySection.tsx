import CaseCard from '../../components/CaseCard'
import type { GameResult } from './game.types'

type GamePlaySectionProps = {
  caseData: Parameters<typeof CaseCard>[0]['caseData']
  caseLoading: boolean
  error: string | null
  attemptLabels?: Array<{ guess: string; label: 'correct' | 'close' | 'wrong' }>
  finalResult?: GameResult | null
  streak?: number
  onContinue?: () => void
  onWhy?: () => void
  canOpenExplanation: boolean
  onOpenExplanation: () => void
}

export default function GamePlaySection({
  caseData,
  caseLoading,
  error,
  attemptLabels: _attemptLabels,
  finalResult: _finalResult,
  streak: _streak,
  onContinue: _onContinue,
  onWhy: _onWhy,
  canOpenExplanation,
  onOpenExplanation,
}: GamePlaySectionProps) {
  return (
    <section className="px-2">
      <div className="pb-2">
        <CaseCard
          caseData={caseData}
          isLoading={caseLoading}
          error={error}
          onOpenExplanation={onOpenExplanation}
          canOpenExplanation={canOpenExplanation}
        />
      </div>
    </section>
  )
}
