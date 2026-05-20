import type { RequestJson } from '../../lib/api'
import type { UserStatsReport } from './userStats.types'

export async function getUserStatsApi(
  request: RequestJson,
): Promise<UserStatsReport> {
  return request<UserStatsReport>('/users/me/stats')
}
