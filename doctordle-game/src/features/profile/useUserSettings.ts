import { useAuth } from '@clerk/clerk-react'
import { useQuery } from '@tanstack/react-query'
import { useApi } from '../../lib/api'
import { getUserSettingsApi } from './profile.api'

export function useUserSettings() {
  const { isLoaded, isSignedIn } = useAuth()
  const { request } = useApi()

  return useQuery({
    queryKey: ['settings', 'me'],
    queryFn: async () => getUserSettingsApi(request),
    enabled: isLoaded && isSignedIn,
    placeholderData: (previousData) => previousData,
  })
}
