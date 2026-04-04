import CaseCard from '../../components/CaseCard'

type GamePlaySectionProps = {
  caseData: Parameters<typeof CaseCard>[0]['caseData']
  caseLoading: boolean
  error: string | null
  onOpenExplanation: () => void
  canOpenExplanation: boolean
}

export default function GamePlaySection({
  caseData,
  caseLoading,
  error,
  onOpenExplanation,
  canOpenExplanation,
}: GamePlaySectionProps) {
  return (
    <section className="min-h-[120px]">
      <CaseCard
        caseData={caseData}
        isLoading={caseLoading}
        error={error}
        onOpenExplanation={onOpenExplanation}
        canOpenExplanation={canOpenExplanation}
      />
    </section>
  )
}
