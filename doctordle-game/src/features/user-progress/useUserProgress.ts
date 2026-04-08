import { useAuth } from '@clerk/clerk-react'
import { useQuery } from '@tanstack/react-query'
import { getUserProgressApi } from '../game/game.api'
import { useApi } from '../../lib/api'

export function useUserProgress() {
  const { isLoaded, isSignedIn } = useAuth()
  const { request } = useApi()

  const query = useQuery({
    queryKey: ['progress'],
    queryFn: async () => getUserProgressApi(request),
    enabled: isLoaded && isSignedIn,
    placeholderData: (previousData) => previousData,
  })

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
    xpEarned: 0,
    rewardEvent: null,
    error: query.error ?? null,
  }
}
