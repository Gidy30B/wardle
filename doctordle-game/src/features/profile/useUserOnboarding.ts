import { useAuth } from '@clerk/clerk-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { useApi } from '../../lib/api'
import type { Organization } from '../organizations/organization.types'
import {
  completeOnboardingIndividualApi,
  completeOnboardingOrganizationApi,
  getUserOnboardingApi,
  saveOnboardingProfileApi,
} from './profile.api'
import type { WardleProfileCompletionPayload } from './profile.types'

export function useUserOnboarding() {
  const { isLoaded, isSignedIn, userId } = useAuth()
  const { request } = useApi()
  const queryClient = useQueryClient()

  const queryKey = useMemo(() => ['onboarding', 'me', userId], [userId])
  const profileQueryKey = useMemo(() => ['profile', 'me', userId], [userId])
  const organizationQueryKey = useMemo(
    () => ['organizations', 'me', userId],
    [userId],
  )

  const query = useQuery({
    queryKey,
    queryFn: async () => getUserOnboardingApi(request),
    enabled: isLoaded && isSignedIn && Boolean(userId),
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
  })

  const suggestedUsername = query.data?.username?.trim() || ''

  const saveProfile = useCallback(
    async (payload: WardleProfileCompletionPayload) => {
      if (!userId) {
        return
      }

      let state = query.data
      const username = payload.username.trim()

      if (username && username !== state?.username?.trim()) {
        state = await saveOnboardingProfileApi(request, { username })
      }

      if (payload.organization) {
        state = await completeOnboardingOrganizationApi(request, {
          organizationId: payload.organization.id,
        })
      } else {
        state = await completeOnboardingIndividualApi(request)
      }

      queryClient.setQueryData(queryKey, state)
      await queryClient.invalidateQueries({ queryKey: profileQueryKey })
      await queryClient.invalidateQueries({ queryKey: organizationQueryKey })
      await queryClient.invalidateQueries({ queryKey: ['leaderboard'] })
    },
    [organizationQueryKey, profileQueryKey, query.data, queryClient, queryKey, request, userId],
  )

  const completeWithOrganization = useCallback(
    async (organization: Organization) => {
      await saveProfile({
        username: query.data?.username ?? suggestedUsername,
        university: organization.name,
        organization,
      })
    },
    [query.data?.username, saveProfile, suggestedUsername],
  )

  const continueIndividually = useCallback(async () => {
    await saveProfile({
      username: query.data?.username ?? suggestedUsername,
      organization: null,
    })
  }, [query.data?.username, saveProfile, suggestedUsername])

  return {
    onboarding: query.data ?? null,
    loading: query.isPending && !query.data,
    error: query.error,
    suggestedUsername,
    shouldShowOnboarding:
      isLoaded &&
      isSignedIn &&
      !query.isPending &&
      query.data?.onboardingStatus !== 'COMPLETE',
    saveProfile,
    completeWithOrganization,
    continueIndividually,
    refetch: query.refetch,
  }
}
