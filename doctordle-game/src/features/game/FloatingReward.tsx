import { useState, useEffect } from 'react'

type RewardEvent = {
  id: number
  xp: number
  streak?: number
  type: 'correct' | 'close'
}

type Props = {
  reward: RewardEvent | null
}

export function FloatingReward({ reward }: Props) {
  const [visible, setVisible] = useState(false)
  const [showSecondary, setShowSecondary] = useState(false)

  useEffect(() => {
    if (!reward) return

    setVisible(true)
    setShowSecondary(false)

    const secondaryTimer = setTimeout(() => {
      setShowSecondary(true)
    }, 100)

    const hideTimer = setTimeout(() => {
      setVisible(false)
    }, reward.type === 'close' ? 600 : 900)

    return () => {
      clearTimeout(secondaryTimer)
      clearTimeout(hideTimer)
    }
  }, [reward?.id])

  if (!reward || !visible) return null

  const isCorrect = reward.type === 'correct'
  const isClose = reward.type === 'close'

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
      <div
        className={`
          text-center animate-[floatUp_0.8s_ease-out_forwards]
          ${isClose ? 'opacity-90' : ''}
        `}
      >
        {/* PRIMARY: XP */}
        <div
          className={`
            font-semibold
            ${isCorrect ? 'text-lg text-white' : 'text-base text-white/90'}
          `}
        >
          +{reward.xp} XP
        </div>

        {/* SECONDARY */}
        {showSecondary && (
          <div
            className={`
              mt-1 text-sm animate-[fadeIn_0.2s_ease]
              ${
                isCorrect
                  ? 'text-white/70'
                  : 'text-yellow-300/80'
              }
            `}
          >
            {isCorrect ? `🔥 ${reward.streak}` : '↗ Close'}
          </div>
        )}
      </div>
    </div>
  )
}