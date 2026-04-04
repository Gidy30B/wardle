import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useQuery } from '@tanstack/react-query'
import { getUserProgressApi } from '../game/game.api'
import { useApi } from '../../lib/api'

export function useUserProgress() {
  const { isLoaded, isSignedIn } = useAuth()
  const { request } = useApi()
  const [xpEarned, setXpEarned] = useState(0)
  const previousXpTotalRef = useRef<number | null>(null)

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
      setXpEarned(Math.max(0, query.data.xpTotal - previousXpTotal))
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
    error: query.error ?? null,
  }
}
