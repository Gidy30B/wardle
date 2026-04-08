import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useQuery } from '@tanstack/react-query'
import { getUserProgressApi } from '../game/game.api'
import { useApi } from '../../lib/api'

type RewardEvent = {
  id: number
  xp: number
  streak?: number
  type: 'correct' | 'close'
}

export function useUserProgress() {
  const { isLoaded, isSignedIn } = useAuth()
  const { request } = useApi()
  const [xpEarned, setXpEarned] = useState(0)
  const [rewardEvent, setRewardEvent] = useState<RewardEvent | null>(null)
  const previousXpTotalRef = useRef<number | null>(null)
  const rewardIdRef = useRef(0)

  const query = useQuery({
    queryKey: ['progress'],
    queryFn: async () => getUserProgressApi(request),
    enabled: isLoaded && isSignedIn,
    placeholderData: (previousData) => previousData,
  })

  useEffect(() => {
    if (!query.data) {
      return
    }

    const previousXpTotal = previousXpTotalRef.current
    if (previousXpTotal !== null) {
      const gainedXp = Math.max(0, query.data.xpTotal - previousXpTotal)
      setXpEarned(gainedXp)

      if (gainedXp > 0) {
        rewardIdRef.current += 1
        setRewardEvent({
          id: rewardIdRef.current,
          xp: gainedXp,
          streak: query.data.currentStreak,
          type: 'correct',
        })
      }
    }

    previousXpTotalRef.current = query.data.xpTotal
  }, [query.data])

  const progressSummary = {
    streak: query.data?.currentStreak ?? 0,
    level: query.data?.level ?? 1,
    rank: query.data?.rank ?? 'Rookie',
    xpTotal: query.data?.xpTotal ?? 0,
  }

  return {
    progress: query.data ?? null,
    loading: query.isPending && !query.data,
    progressSummary,
    xpEarned,
    rewardEvent,
    error: query.error ?? null,
  }
}
