import { useAuth, useUser } from '@clerk/clerk-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo } from 'react'
import { useApi } from '../../lib/api'
import {
  clearPendingAuthProfile,
  consumePendingAuthProfile,
} from '../auth/authProfileSync'
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
  const { user } = useUser()
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
    retry: 1,
  })

  useEffect(() => {
    if (
      !userId ||
      !query.data ||
      query.data.onboardingStatus === 'COMPLETE'
    ) {
      return
    }

    const email = user?.primaryEmailAddress?.emailAddress
    const pendingProfile = consumePendingAuthProfile(userId, email)
    if (!pendingProfile?.displayName.trim()) {
      return
    }

    const pendingDisplayName = pendingProfile.displayName.trim()
    if (pendingDisplayName === query.data.displayName?.trim()) {
      clearPendingAuthProfile(email)
      return
    }

    void saveOnboardingProfileApi(request, {
      displayName: pendingDisplayName,
    })
      .then(async (state) => {
        clearPendingAuthProfile(email)
        queryClient.setQueryData(queryKey, state)
        await queryClient.invalidateQueries({ queryKey: profileQueryKey })
      })
      .catch((error: unknown) => {
        if (import.meta.env.DEV) {
          console.warn('[auth] Failed to sync pending signup profile', error)
        }
      })
  }, [
    profileQueryKey,
    query.data,
    query.data?.onboardingStatus,
    queryClient,
    queryKey,
    request,
    user?.primaryEmailAddress?.emailAddress,
    userId,
  ])

  const suggestedDisplayName =
    query.data?.displayName?.trim() ||
    user?.fullName ||
    user?.primaryEmailAddress?.emailAddress?.split('@')[0] ||
    ''

  const saveProfile = useCallback(
    async (payload: WardleProfileCompletionPayload) => {
      if (!userId) {
        return
      }

      let state = query.data
      const displayName = payload.displayName.trim()

      if (displayName && displayName !== state?.displayName?.trim()) {
        state = await saveOnboardingProfileApi(request, { displayName })
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
        displayName: query.data?.displayName ?? suggestedDisplayName,
        university: organization.name,
        organization,
      })
    },
    [query.data?.displayName, saveProfile, suggestedDisplayName],
  )

  const continueIndividually = useCallback(async () => {
    await saveProfile({
      displayName: query.data?.displayName ?? suggestedDisplayName,
      organization: null,
    })
  }, [query.data?.displayName, saveProfile, suggestedDisplayName])

  return {
    onboarding: query.data ?? null,
    loading: query.isPending && !query.data,
    error: query.error,
    suggestedDisplayName,
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
