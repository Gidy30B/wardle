import { io, type Socket } from 'socket.io-client'
import { emit } from '../features/game/events/game.eventBus'
import { emitNotificationCreated } from '../features/notifications/notification.eventBus'
import type { NotificationCreatedPayload } from '../features/notifications/notification.types'
import { getSocketServerUrl } from '../lib/runtimeUrls'

const DEBUG = import.meta.env.DEV
const SOCKET_SERVER_URL = getSocketServerUrl()

let socket: Socket | null = null
let activeToken: string | null = null

export function initSocket(token: string) {
  if (DEBUG) {
    console.log('[WS CONNECT INIT]')
  }

  if (!SOCKET_SERVER_URL) {
    if (DEBUG) {
      console.warn('[WS DISABLED] Set VITE_WS_URL or an absolute VITE_API_URL to enable realtime.')
    }

    return null
  }

  const normalizedToken = token.trim()

  if (!normalizedToken) {
    return null
  }

  if (socket && activeToken === normalizedToken) {
    if (!socket.connected) {
      socket.connect()
    }

    return socket
  }

  socket?.disconnect()
  activeToken = normalizedToken

  socket = io(SOCKET_SERVER_URL, {
    auth: {
      token: normalizedToken,
    },
    transports: ['websocket'],
  })

  socket.on('connect', () => {
    console.log('[WS CONNECTED]', socket?.id)
  })

  socket.on('disconnect', () => {
    console.log('[WS DISCONNECTED]')
  })

  socket.on('connect_error', (err) => {
    console.error('WS CONNECTION ERROR', err.message)
  })

  if (DEBUG) {
    socket.onAny((event, data) => {
      console.log('[WS RAW EVENT]', event, data)
    })
  }

  socket.on('game.v1.reward.applied', (data: { xp: number; streak?: number }) => {
    if (DEBUG) {
      console.log('[WS RECEIVED] reward.applied', data)
      console.log('[BRIDGE -> EVENT BUS]', data)
    }

    emit({
      type: 'REWARD_TRIGGERED',
      xp: data.xp,
      streak: data.streak,
    })
  })

  socket.on('notification.v1.created', (data: NotificationCreatedPayload) => {
    if (DEBUG) {
      console.log('[WS RECEIVED] notification.created', data)
    }

    emitNotificationCreated(data)
  })

  return socket
}

export function disconnectSocket() {
  socket?.disconnect()
  socket = null
  activeToken = null
}
