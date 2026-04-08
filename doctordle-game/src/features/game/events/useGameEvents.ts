import { useEffect, useRef } from 'react'
import { subscribe } from './game.eventBus'
import type { GameEvent } from './game.events'

export function useGameEvents(handler: (event: GameEvent) => void) {
  const handlerRef = useRef(handler)

  useEffect(() => {
    handlerRef.current = handler
  }, [handler])

  useEffect(() => {
    return subscribe((event) => {
      handlerRef.current(event)
    })
  }, [])
}
