import { useQuery } from '@tanstack/react-query'
import { useApi } from '../../lib/api'
import { getDailyCaseArchiveApi } from './game.api'
import type {
  DailyCaseArchiveResponse,
  DailyCaseArchiveStatus,
} from './game.types'

export type DailyCaseArchiveFilter = 'all' | DailyCaseArchiveStatus

export function useDailyCaseArchive(status: DailyCaseArchiveFilter) {
  const { request } = useApi()
  const query = useQuery({
    queryKey: ['game', 'archive', status],
    queryFn: () => getDailyCaseArchiveApi(request, { status, limit: 100 }),
  })

  return {
    archive: query.data ?? null,
    items: (query.data as DailyCaseArchiveResponse | undefined)?.items ?? [],
    loading: query.isPending,
    error: query.error instanceof Error ? query.error.message : null,
    refetch: query.refetch,
  }
}
