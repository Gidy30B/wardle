import { useAuth } from '@clerk/clerk-react'
import { useCallback } from 'react'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL
const clerkJwtAudience = import.meta.env.VITE_CLERK_JWT_AUDIENCE

if (!apiBaseUrl) {
  throw new Error('Missing VITE_API_BASE_URL (or VITE_API_URL)')
}

if (!clerkJwtAudience) {
  throw new Error('Missing VITE_CLERK_JWT_AUDIENCE')
}

type RequestJson = <T>(path: string, init?: RequestInit) => Promise<T>

export function useApi() {
  const { getToken } = useAuth()

  const request = useCallback<RequestJson>(async <T>(path: string, init: RequestInit = {}) => {
    const token = await getToken({ template: clerkJwtAudience })

    if (!token) {
      throw new Error('No auth token available')
    }

    const headers = new Headers(init.headers)
    headers.set('Authorization', `Bearer ${token}`)
    if (!headers.has('Content-Type')) {
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
        throw new Error('Unauthorized')
      }

      if (typeof payload === 'string') {
        throw new Error(payload || `Request failed: ${response.status}`)
      }

      const message =
        typeof payload === 'object' && payload !== null && 'message' in payload
          ? String((payload as { message?: unknown }).message ?? '')
          : ''

      throw new Error(message || `Request failed: ${response.status}`)
    }

    return payload as T
  }, [getToken])

  return { request }
}

export type { RequestJson }
