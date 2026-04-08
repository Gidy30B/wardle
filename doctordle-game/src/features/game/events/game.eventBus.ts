import type { GameEvent } from './game.events'

type GameEventListener = (event: GameEvent) => void

const listeners = new Set<GameEventListener>()
const DEBUG = false

export function emit(event: GameEvent) {
  if (DEBUG) {
    console.log(`[GameEvent:${event.type}]`, event)
  }

  const snapshot = Array.from(listeners)

  snapshot.forEach((listener) => {
    listener(event)
  })
}

export function subscribe(listener: GameEventListener) {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}
