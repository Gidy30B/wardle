import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameEvent } from './events/game.events'
import { useGameEvents } from './events/useGameEvents'

type FloatingRewardState = {
  id: number
  xp: number
  streak?: number
}

export function FloatingReward() {
  const rewardIdRef = useRef(0)
  const timersRef = useRef<number[]>([])
  const [queue, setQueue] = useState<FloatingRewardState[]>([])
  const [activeReward, setActiveReward] = useState<FloatingRewardState | null>(null)
  const [visible, setVisible] = useState(false)
  const [showSecondary, setShowSecondary] = useState(false)

  const handleEvent = useCallback((event: GameEvent) => {
    if (event.type !== 'REWARD_TRIGGERED') {
      return
    }

    rewardIdRef.current += 1
    setQueue((prev) => {
      const next = [
        ...prev,
        {
          id: rewardIdRef.current,
          xp: event.xp,
          streak: event.streak,
        },
      ]

      return next.slice(-5)
    })
  }, [])

  useGameEvents(handleEvent)

  useEffect(() => {
    if (activeReward || queue.length === 0) return

    const delay = setTimeout(() => {
      setActiveReward(queue[0])
      setQueue((prev) => prev.slice(1))
    }, 120)

    return () => clearTimeout(delay)
  }, [queue, activeReward])

  useEffect(() => {
    if (!activeReward) return

    timersRef.current.forEach((timerId) => clearTimeout(timerId))
    timersRef.current = []

    setVisible(true)
    setShowSecondary(false)

    const secondaryTimer = setTimeout(() => {
      setShowSecondary(true)
    }, 100)

    const hideTimer = setTimeout(() => {
      setVisible(false)
    }, 900)

    const clearTimer = setTimeout(() => {
      setActiveReward(null)
    }, 1200)

    timersRef.current.push(secondaryTimer, hideTimer, clearTimer)

    return () => {
      timersRef.current.forEach((timerId) => clearTimeout(timerId))
      timersRef.current = []
    }
  }, [activeReward?.id])

  if (!activeReward || !visible || activeReward.xp <= 0) return null

  const secondaryLabel = activeReward.streak !== undefined ? `Streak ${activeReward.streak}` : 'Correct'
  const scaleClass =
    activeReward?.streak && activeReward.streak >= 5
      ? 'scale-125'
      : activeReward?.streak && activeReward.streak >= 3
      ? 'scale-110'
      : ''

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
      <div
        className={`
          text-center
          ${scaleClass}
          animate-[floatUp_0.8s_cubic-bezier(0.22,1,0.36,1)_forwards]
        `}
      >
        <div
          className={`
            font-semibold
            text-lg text-white
          `}
        >
          +{activeReward.xp} XP
        </div>

        {showSecondary && (
          <div
            className={`
              mt-1 text-sm animate-[fadeIn_0.2s_ease]
              text-white/70
            `}
          >
            {secondaryLabel}
          </div>
        )}
      </div>
    </div>
  )
}
