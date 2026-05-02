import { useAuth } from '@clerk/clerk-react'
import { useQuery } from '@tanstack/react-query'
import { useApi } from '../../lib/api'
import { getMyOrganizationsApi } from './organization.api'

export function useUserOrganizations() {
  const { isLoaded, isSignedIn } = useAuth()
  const { request } = useApi()

  const query = useQuery({
    queryKey: ['organizations', 'me'],
    queryFn: async () => getMyOrganizationsApi(request),
    enabled: isLoaded && isSignedIn,
    placeholderData: (previousData) => previousData,
  })

  const memberships = Array.isArray(query.data) ? query.data : []
  const activeMemberships = memberships.filter((membership) => membership.status === 'ACTIVE')
  const primaryOrganization = activeMemberships[0]?.organization ?? null

  return {
    memberships,
    activeMemberships,
    primaryOrganization,
    loading: query.isPending && !query.data,
    error: query.error ?? null,
    refetch: query.refetch,
  }
}
