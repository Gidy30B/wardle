export function getVisibleStreak(streak: number | null | undefined): number | null {
  return typeof streak === 'number' && streak > 0 ? streak : null
}
