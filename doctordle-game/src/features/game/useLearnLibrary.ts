import { useAuth } from '@clerk/clerk-react'
import { useQuery } from '@tanstack/react-query'
import { useApi } from '../../lib/api'
import { getLearnLibraryApi } from './game.api'

export function useLearnLibrary() {
  const { isLoaded, isSignedIn } = useAuth()
  const { request } = useApi()

  const query = useQuery({
    queryKey: ['game', 'learn'],
    queryFn: async () => getLearnLibraryApi(request),
    enabled: isLoaded && isSignedIn,
    placeholderData: (previousData) => previousData,
  })

  return {
    library: query.data ?? null,
    loading: query.isPending && !query.data,
    error: query.error instanceof Error ? query.error.message : null,
  }
}
