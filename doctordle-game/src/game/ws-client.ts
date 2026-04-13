import { io, type Socket } from 'socket.io-client'
import { emit } from '../features/game/events/game.eventBus'

const SOCKET_SERVER_URL = 'http://localhost:3000'
const DEBUG = import.meta.env.DEV

let socket: Socket | null = null
let activeToken: string | null = null

export function initSocket(token: string) {
  if (DEBUG) {
    console.log('[WS CONNECT INIT]')
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

  return socket
}

export function disconnectSocket() {
  socket?.disconnect()
  socket = null
  activeToken = null
}
