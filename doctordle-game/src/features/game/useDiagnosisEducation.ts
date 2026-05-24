import { useQuery } from '@tanstack/react-query'
import { ApiRequestError, useApi } from '../../lib/api'
import { getDiagnosisEducationApi } from './game.api'

const diagnosisEducationEnabled =
  import.meta.env.VITE_LEARN_DIAGNOSIS_EDUCATION !== 'false'

export function useDiagnosisEducation(diagnosisRegistryId: string | null) {
  const { request } = useApi()

  const query = useQuery({
    queryKey: ['diagnosis-education', diagnosisRegistryId],
    queryFn: async () => {
      if (!diagnosisRegistryId) {
        return null
      }

      if (import.meta.env.DEV) {
        performance.mark?.(`education:${diagnosisRegistryId}:start`)
      }

      try {
        return await getDiagnosisEducationApi(request, diagnosisRegistryId)
      } catch (error) {
        if (error instanceof ApiRequestError && error.status === 404) {
          if (import.meta.env.DEV) {
            console.debug('[education-query] unavailable', diagnosisRegistryId)
          }
          return null
        }

        throw error
      } finally {
        if (import.meta.env.DEV) {
          performance.mark?.(`education:${diagnosisRegistryId}:end`)
        }
      }
    },
    enabled: diagnosisEducationEnabled && Boolean(diagnosisRegistryId),
    staleTime: (query) =>
      query.state.data === null ? 30_000 : 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: (failureCount, error) => {
      if (error instanceof ApiRequestError && [401, 403, 404].includes(error.status)) {
        return false
      }

      return failureCount < 1
    },
    refetchOnMount: (query) => query.state.data === null,
    refetchOnWindowFocus: (query) => query.state.data === null,
    refetchOnReconnect: false,
  })

  return {
    education: query.data ?? null,
    enabled: diagnosisEducationEnabled,
    loading: query.isPending && Boolean(diagnosisRegistryId),
    error: query.error instanceof Error ? query.error.message : null,
  }
}
