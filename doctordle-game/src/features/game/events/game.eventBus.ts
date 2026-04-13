import type { GameEvent } from './game.events'

type GameEventListener = (event: GameEvent) => void

const listeners = new Set<GameEventListener>()
const DEBUG = import.meta.env.DEV

export function emit(event: GameEvent) {
  if (DEBUG) {
    console.log('[EVENT BUS EMIT]', event)
  }

  const snapshot = Array.from(listeners)

  snapshot.forEach((listener) => {
    listener(event)
  })
}

export function subscribe(listener: GameEventListener) {
  const wrappedListener: GameEventListener = (event) => {
    if (DEBUG) {
      console.log('[EVENT BUS RECEIVE]', event)
    }

    listener(event)
  }

  listeners.add(wrappedListener)

  return () => {
    listeners.delete(wrappedListener)
  }
}
