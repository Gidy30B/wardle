import type { DailyCaseArchiveItem } from './game.types'

export type ArchiveMonth = {
  key: string
  label: string
  year: number
  month: number
}

export type ArchiveDateGroup = {
  dateKey: string
  items: DailyCaseArchiveItem[]
  status: 'empty' | 'available' | 'completed' | 'in_progress'
}

export type ArchiveCalendarDay = {
  key: string
  date: Date
  dayNumber: number
  inCurrentMonth: boolean
  group: ArchiveDateGroup | null
}

export type ArchiveCalendarMonth = ArchiveMonth & {
  weeks: ArchiveCalendarDay[][]
}

export type ArchiveMonthDirection = 'older' | 'newer'

export function parseArchiveDate(value?: string | null): Date | null {
  if (!value) {
    return null
  }

  const normalized = value.includes('T') ? value : `${value}T00:00:00.000Z`
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}

export function getArchiveDateKey(value?: string | null): string | null {
  const date = parseArchiveDate(value)
  return date ? date.toISOString().slice(0, 10) : null
}

function getTimeValue(value?: string | null) {
  return parseArchiveDate(value)?.getTime() ?? 0
}

export function sortArchiveCatchUp(items: DailyCaseArchiveItem[]) {
  return items
    .filter((item) => item.status === 'in_progress' || item.status === 'unplayed')
    .sort((left, right) => {
      if (left.status !== right.status) {
        return left.status === 'in_progress' ? -1 : 1
      }

      return getTimeValue(right.releaseDate) - getTimeValue(left.releaseDate)
    })
}

export function getNextArchiveCase(
  items: DailyCaseArchiveItem[],
  excludeIds: Iterable<string | null | undefined> = [],
) {
  const excluded = new Set(
    Array.from(excludeIds).filter((id): id is string => Boolean(id)),
  )

  return (
    sortArchiveCatchUp([...items]).find(
      (item) => !excluded.has(item.dailyCaseId),
    ) ?? null
  )
}

export function sortArchiveItems(items: DailyCaseArchiveItem[]) {
  return [...items].sort((left, right) => {
    const leftTime =
      left.status === 'completed'
        ? getTimeValue(left.completedAt) || getTimeValue(left.releaseDate)
        : getTimeValue(left.releaseDate)
    const rightTime =
      right.status === 'completed'
        ? getTimeValue(right.completedAt) || getTimeValue(right.releaseDate)
        : getTimeValue(right.releaseDate)

    return rightTime - leftTime
  })
}

export function getArchiveMonths(items: DailyCaseArchiveItem[]): ArchiveMonth[] {
  const monthMap = new Map<string, ArchiveMonth>()

  for (const item of items) {
    const date = parseArchiveDate(item.releaseDate)
    if (!date) {
      continue
    }

    const year = date.getUTCFullYear()
    const month = date.getUTCMonth()
    const key = `${year}-${String(month + 1).padStart(2, '0')}`
    monthMap.set(key, {
      key,
      year,
      month,
      label: new Intl.DateTimeFormat(undefined, {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(date),
    })
  }

  return Array.from(monthMap.values()).sort((left, right) =>
    left.key < right.key ? 1 : -1,
  )
}

export function getArchiveYears(items: DailyCaseArchiveItem[]): number[] {
  return Array.from(
    new Set(getArchiveMonths(items).map((month) => month.year)),
  ).sort((left, right) => right - left)
}

export function getArchiveMonthsForYear(
  items: DailyCaseArchiveItem[],
  year: number,
): ArchiveMonth[] {
  return getArchiveMonths(items).filter((month) => month.year === year)
}

export function getLatestArchiveMonth(
  items: DailyCaseArchiveItem[],
): ArchiveMonth | null {
  return getArchiveMonths(items)[0] ?? null
}

export function getPreferredArchiveMonthForYear(
  items: DailyCaseArchiveItem[],
  year: number,
  preferredMonth: number,
): ArchiveMonth | null {
  const months = getArchiveMonthsForYear(items, year)
  return months.find((month) => month.month === preferredMonth) ?? months[0] ?? null
}

export function getAdjacentArchiveMonth(
  months: ArchiveMonth[],
  currentKey: string,
  direction: ArchiveMonthDirection,
): ArchiveMonth | null {
  const currentIndex = months.findIndex((month) => month.key === currentKey)
  if (currentIndex < 0) {
    return null
  }

  const nextIndex = direction === 'older' ? currentIndex + 1 : currentIndex - 1
  return months[nextIndex] ?? null
}

export function excludeArchiveAssignments(
  items: DailyCaseArchiveItem[],
  excludeIds: Iterable<string | null | undefined>,
): DailyCaseArchiveItem[] {
  const excluded = new Set(
    Array.from(excludeIds).filter((id): id is string => Boolean(id)),
  )

  return items.filter((item) => !excluded.has(item.dailyCaseId))
}

export function groupArchiveByDate(
  items: DailyCaseArchiveItem[],
): Map<string, ArchiveDateGroup> {
  const groups = new Map<string, DailyCaseArchiveItem[]>()

  for (const item of sortArchiveItems(items)) {
    const dateKey = getArchiveDateKey(item.releaseDate)
    if (!dateKey) {
      continue
    }

    groups.set(dateKey, [...(groups.get(dateKey) ?? []), item])
  }

  return new Map(
    Array.from(groups.entries()).map(([dateKey, groupItems]) => [
      dateKey,
      {
        dateKey,
        items: groupItems,
        status: getArchiveDateGroupStatus(groupItems),
      },
    ]),
  )
}

export function getArchiveDateGroupStatus(
  items: DailyCaseArchiveItem[],
): ArchiveDateGroup['status'] {
  if (items.some((item) => item.status === 'in_progress')) {
    return 'in_progress'
  }

  if (items.some((item) => item.status === 'unplayed')) {
    return 'available'
  }

  if (items.some((item) => item.status === 'completed')) {
    return 'completed'
  }

  return 'empty'
}

export function buildArchiveCalendarMonth(
  month: ArchiveMonth,
  groups: Map<string, ArchiveDateGroup>,
): ArchiveCalendarMonth {
  const firstDay = new Date(Date.UTC(month.year, month.month, 1))
  const startOffset = (firstDay.getUTCDay() + 6) % 7
  const start = new Date(firstDay)
  start.setUTCDate(firstDay.getUTCDate() - startOffset)

  const days: ArchiveCalendarDay[] = []
  for (let index = 0; index < 42; index += 1) {
    const date = new Date(start)
    date.setUTCDate(start.getUTCDate() + index)
    const key = date.toISOString().slice(0, 10)
    days.push({
      key,
      date,
      dayNumber: date.getUTCDate(),
      inCurrentMonth:
        date.getUTCFullYear() === month.year &&
        date.getUTCMonth() === month.month,
      group: groups.get(key) ?? null,
    })
  }

  return {
    ...month,
    weeks: Array.from({ length: 6 }, (_, index) =>
      days.slice(index * 7, index * 7 + 7),
    ),
  }
}

export function searchArchiveItems(
  items: DailyCaseArchiveItem[],
  query: string,
) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    return []
  }

  return sortArchiveItems(items).filter((item) =>
    [
      item.displayLabel,
      item.trackDisplayLabel,
      item.releaseDate,
      item.difficulty,
    ]
      .join(' ')
      .toLowerCase()
      .includes(normalizedQuery),
  )
}
