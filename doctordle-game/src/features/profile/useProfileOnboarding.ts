import { useAuth } from '@clerk/clerk-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import { useApi } from '../../lib/api'
import { getBackendProfileApi, updateBackendProfileApi } from './profile.api'
import {
  readProfileOnboarding,
  writeProfileOnboarding,
} from './profileOnboarding.storage'
import type {
  WardleProfileCompletionPayload,
  WardleProfileOnboarding,
} from './profile.types'

export function useProfileOnboarding() {
  const { isLoaded, isSignedIn, userId } = useAuth()
  const { request } = useApi()
  const queryClient = useQueryClient()
  const [revision, setRevision] = useState(0)
  const profileQueryKey = useMemo(() => ['profile', 'me', userId], [userId])
  const organizationQueryKey = useMemo(
    () => ['organizations', 'me', userId],
    [userId],
  )

  const backendProfileQuery = useQuery({
    queryKey: profileQueryKey,
    queryFn: async () => getBackendProfileApi(request),
    enabled: isLoaded && isSignedIn && Boolean(userId),
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
  })

  const localProfile = useMemo(() => {
    if (!userId) {
      return null
    }

    return readProfileOnboarding(userId)
  }, [revision, userId])

  const suggestedUsername = backendProfileQuery.data?.username?.trim() || ''

  const saveProfile = useCallback(
    async (payload: WardleProfileCompletionPayload) => {
      if (!userId) {
        return
      }

      const individualMode = payload.organization == null
      await updateBackendProfileApi(request, {
        username: payload.username.trim(),
        individualMode,
        organizationId: payload.organization?.id ?? null,
      })

      const nextProfile: WardleProfileOnboarding = {
        username: payload.username.trim(),
        university: payload.university?.trim() ?? payload.organization?.name ?? '',
        organizationId: payload.organization?.id ?? null,
        organizationName: payload.organization?.name ?? null,
        organizationType: payload.organization?.type ?? null,
        skipped: false,
        completedAt: new Date().toISOString(),
      }

      writeProfileOnboarding(userId, nextProfile)
      setRevision((value) => value + 1)

      await queryClient.invalidateQueries({ queryKey: profileQueryKey })
      await queryClient.invalidateQueries({ queryKey: organizationQueryKey })
    },
    [organizationQueryKey, profileQueryKey, queryClient, request, userId],
  )

  const skipProfile = useCallback(() => {
    if (!userId) {
      return
    }

    const nextProfile: WardleProfileOnboarding = {
      username: '',
      university: '',
      organizationId: null,
      organizationName: null,
      organizationType: null,
      skipped: false,
      completedAt: null,
    }

    writeProfileOnboarding(userId, nextProfile)
    setRevision((value) => value + 1)
  }, [userId])

  const isOnboardingResolved = Boolean(
    backendProfileQuery.data?.username?.trim() ||
      localProfile?.username.trim(),
  )

  return {
    backendProfile: backendProfileQuery.data ?? null,
    loading: backendProfileQuery.isPending && !backendProfileQuery.data,
    error: backendProfileQuery.error,
    localProfile,
    suggestedUsername,
    shouldShowOnboarding:
      isLoaded && isSignedIn && !backendProfileQuery.isPending && !isOnboardingResolved,
    saveProfile,
    skipProfile,
  }
}
