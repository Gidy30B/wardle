import { useAuth } from '@clerk/clerk-react'
import { useCallback } from 'react'
import { getApiBaseUrl } from './runtimeUrls'

const apiBaseUrl = getApiBaseUrl()
const clerkJwtAudience = import.meta.env.VITE_CLERK_JWT_AUDIENCE

if (!clerkJwtAudience) {
  throw new Error('Missing VITE_CLERK_JWT_AUDIENCE')
}

type RequestJson = <T>(path: string, init?: RequestInit) => Promise<T>

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly payload?: unknown,
  ) {
    super(message)
    this.name = 'ApiRequestError'
  }
}

export function useApi() {
  const { getToken } = useAuth()

  const request = useCallback<RequestJson>(async <T>(path: string, init: RequestInit = {}) => {
    const token = await getToken({ template: clerkJwtAudience })

    if (!token) {
      throw new Error('No auth token available')
    }

    const headers = new Headers(init.headers)
    headers.set('Authorization', `Bearer ${token}`)
    if (init.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }

    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers,
    })

    const contentType = response.headers.get('content-type') ?? ''
    const payload = contentType.includes('application/json')
      ? await response.json()
      : await response.text()

    if (!response.ok) {
      if (response.status === 401) {
        throw new ApiRequestError('Unauthorized', response.status)
      }

      if (typeof payload === 'string') {
        throw new ApiRequestError(
          payload || `Request failed: ${response.status}`,
          response.status,
          payload,
        )
      }

      const message =
        typeof payload === 'object' && payload !== null && 'message' in payload
          ? String((payload as { message?: unknown }).message ?? '')
          : ''

      throw new ApiRequestError(
        message || `Request failed: ${response.status}`,
        response.status,
        payload,
      )
    }

    return payload as T
  }, [getToken])

  return { request }
}

export type { RequestJson }
