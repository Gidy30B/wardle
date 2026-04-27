import { useAuth, useUser } from '@clerk/clerk-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApi } from '../../lib/api'
import { consumePendingAuthProfile } from '../auth/authProfileSync'
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
  const { user } = useUser()
  const { request } = useApi()
  const queryClient = useQueryClient()
  const [revision, setRevision] = useState(0)

  const backendProfileQuery = useQuery({
    queryKey: ['profile', 'me'],
    queryFn: async () => getBackendProfileApi(request),
    enabled: isLoaded && isSignedIn,
    retry: 1,
  })

  useEffect(() => {
    if (!userId) {
      return
    }

    const consumedProfile = consumePendingAuthProfile(
      userId,
      user?.primaryEmailAddress?.emailAddress,
    )
    if (consumedProfile) {
      setRevision((value) => value + 1)
    }
  }, [user?.primaryEmailAddress?.emailAddress, userId])

  const localProfile = useMemo(() => {
    if (!userId) {
      return null
    }

    return readProfileOnboarding(userId)
  }, [revision, userId])

  const suggestedDisplayName =
    user?.fullName ??
    user?.username ??
    user?.primaryEmailAddress?.emailAddress?.split('@')[0] ??
    ''

  const saveProfile = useCallback(
    async (payload: WardleProfileCompletionPayload) => {
      if (!userId) {
        return
      }

      const individualMode = payload.organization == null
      await updateBackendProfileApi(request, {
        displayName: payload.displayName.trim(),
        individualMode,
        organizationId: payload.organization?.id ?? null,
      })

      const nextProfile: WardleProfileOnboarding = {
        displayName: payload.displayName.trim(),
        university: payload.university?.trim() ?? payload.organization?.name ?? '',
        organizationId: payload.organization?.id ?? null,
        organizationName: payload.organization?.name ?? null,
        organizationType: payload.organization?.type ?? null,
        skipped: false,
        completedAt: new Date().toISOString(),
      }

      writeProfileOnboarding(userId, nextProfile)
      setRevision((value) => value + 1)

      await queryClient.invalidateQueries({ queryKey: ['profile', 'me'] })
      await queryClient.invalidateQueries({ queryKey: ['organizations', 'me'] })
    },
    [queryClient, request, userId],
  )

  const skipProfile = useCallback(() => {
    if (!userId) {
      return
    }

    const nextProfile: WardleProfileOnboarding = {
      displayName: '',
      university: '',
      organizationId: null,
      organizationName: null,
      organizationType: null,
      skipped: true,
      completedAt: null,
    }

    writeProfileOnboarding(userId, nextProfile)
    setRevision((value) => value + 1)
  }, [userId])

  const isOnboardingResolved = Boolean(
    backendProfileQuery.data?.displayName?.trim() ||
    localProfile?.skipped ||
      localProfile?.displayName.trim(),
  )

  return {
    backendProfile: backendProfileQuery.data ?? null,
    loading: backendProfileQuery.isPending && !backendProfileQuery.data,
    error: backendProfileQuery.error,
    localProfile,
    suggestedDisplayName,
    shouldShowOnboarding:
      isLoaded && isSignedIn && !backendProfileQuery.isPending && !isOnboardingResolved,
    saveProfile,
    skipProfile,
  }
}
