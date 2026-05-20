import { useAuth } from '@clerk/clerk-react'
import { useQuery } from '@tanstack/react-query'
import { useApi } from '../../lib/api'
import { getUserSettingsApi } from './profile.api'

export function useUserSettings() {
  const { isLoaded, isSignedIn, userId } = useAuth()
  const { request } = useApi()

  return useQuery({
    queryKey: ['settings', 'me', userId],
    queryFn: async () => getUserSettingsApi(request),
    enabled: isLoaded && isSignedIn && Boolean(userId),
    placeholderData: (previousData) => previousData,
  })
}
