import { useAuth } from '@clerk/clerk-react'
import { useQuery } from '@tanstack/react-query'
import { useApi } from '../../lib/api'
import { getUserStatsApi } from './userStats.api'

export function useUserStats() {
  const { isLoaded, isSignedIn, userId } = useAuth()
  const { request } = useApi()
  const query = useQuery({
    queryKey: ['user-stats', 'me', userId],
    queryFn: async () => getUserStatsApi(request),
    enabled: isLoaded && isSignedIn && Boolean(userId),
    placeholderData: (previousData) => previousData,
  })

  return {
    report: query.data ?? null,
    loading: query.isPending && !query.data,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
  }
}
