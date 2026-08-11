import { useQuery } from '@tanstack/react-query'
import { useApi } from '../../lib/api'
import { getDailyCaseArchiveApi } from './game.api'
import type {
  DailyCaseArchiveResponse,
} from './game.types'

export function useDailyCaseArchive() {
  const { request } = useApi()
  const query = useQuery({
    queryKey: ['game', 'archive', 'all'],
    queryFn: () => getDailyCaseArchiveApi(request, { status: 'all', limit: 100 }),
  })

  return {
    archive: query.data ?? null,
    items: (query.data as DailyCaseArchiveResponse | undefined)?.items ?? [],
    loading: query.isPending,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
  }
}
