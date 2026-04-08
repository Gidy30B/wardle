import type { GameResult } from '../game.types'

export type GameEvent =
  | { type: 'REWARD_TRIGGERED'; xp: number; streak?: number }
  | { type: 'RESULT_RECEIVED'; result: GameResult }
  | { type: 'SUBMIT_GUESS' }
