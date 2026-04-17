export type GameEvent =
  | { type: 'REWARD_TRIGGERED'; xp: number; streak?: number }
