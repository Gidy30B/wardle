import { useAuth } from '@clerk/clerk-react'
import { useQuery } from '@tanstack/react-query'
import { getCurrentUserLeaderboardPositionApi, getLeaderboardApi } from '../game/game.api'
import type { LeaderboardMode } from './leaderboard.types'
import { useApi } from '../../lib/api'

type UseLeaderboardOptions = {
  enabled?: boolean
}

export function useLeaderboard(mode: LeaderboardMode, options: UseLeaderboardOptions = {}) {
  const { enabled = true } = options
  const { isLoaded, isSignedIn, userId } = useAuth()
  const { request } = useApi()

  const leaderboardQuery = useQuery({
    queryKey: ['leaderboard', mode],
    queryFn: async () => getLeaderboardApi(request, mode),
    enabled: enabled && isLoaded && isSignedIn,
    placeholderData: (previousData) => previousData,
  })

  const currentUserPositionQuery = useQuery({
    queryKey: ['leaderboard', 'me', mode],
    queryFn: async () => getCurrentUserLeaderboardPositionApi(request, mode),
    enabled: enabled && isLoaded && isSignedIn,
    placeholderData: (previousData) => previousData,
  })

  return {
    leaderboard: leaderboardQuery.data ?? [],
    currentUserPosition: currentUserPositionQuery.data ?? null,
    currentUserId: userId ?? null,
    loading: leaderboardQuery.isPending && !leaderboardQuery.data,
    error:
      leaderboardQuery.error instanceof Error
        ? leaderboardQuery.error.message
        : currentUserPositionQuery.error instanceof Error
          ? currentUserPositionQuery.error.message
          : null,
  }
}
