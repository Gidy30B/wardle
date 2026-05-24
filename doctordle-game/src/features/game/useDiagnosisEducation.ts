import { useQuery } from '@tanstack/react-query'
import { useApi } from '../../lib/api'
import { getDiagnosisEducationApi } from './game.api'

const diagnosisEducationEnabled =
  import.meta.env.VITE_LEARN_DIAGNOSIS_EDUCATION !== 'false'

export function useDiagnosisEducation(diagnosisRegistryId: string | null) {
  const { request } = useApi()

  const query = useQuery({
    queryKey: ['diagnosis-education', diagnosisRegistryId],
    queryFn: async () => {
      if (!diagnosisRegistryId) {
        throw new Error('Missing diagnosis registry id')
      }

      return getDiagnosisEducationApi(request, diagnosisRegistryId)
    },
    enabled: diagnosisEducationEnabled && Boolean(diagnosisRegistryId),
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,
  })

  return {
    education: query.data ?? null,
    enabled: diagnosisEducationEnabled,
    loading: query.isPending && Boolean(diagnosisRegistryId),
    error: query.error instanceof Error ? query.error.message : null,
  }
}
