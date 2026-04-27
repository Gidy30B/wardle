import { useAuth } from '@clerk/clerk-react'
import { useQuery } from '@tanstack/react-query'
import { useApi } from '../../lib/api'
import { getTodayCasesApi } from './game.api'

export function useTodayCases() {
  const { isLoaded, isSignedIn } = useAuth()
  const { request } = useApi()

  const query = useQuery({
    queryKey: ['game', 'today'],
    queryFn: async () => getTodayCasesApi(request),
    enabled: isLoaded && isSignedIn,
    placeholderData: (previousData) => previousData,
  })

  return {
    todayCases: query.data ?? null,
    loading: query.isPending && !query.data,
    error: query.error instanceof Error ? query.error.message : null,
  }
}
