import { useAuth } from '@clerk/clerk-react'
import { useQuery } from '@tanstack/react-query'
import { useApi } from '../../lib/api'
import { getLearnLibraryApi } from './game.api'

export function useLearnLibrary() {
  const { isLoaded, isSignedIn, userId } = useAuth()
  const { request } = useApi()

  const query = useQuery({
    queryKey: ['game', 'learn', userId],
    queryFn: async () => getLearnLibraryApi(request),
    enabled: isLoaded && isSignedIn && Boolean(userId),
    placeholderData: (previousData) => previousData,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  })

  return {
    library: query.data ?? null,
    loading: query.isPending && !query.data,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
  }
}
