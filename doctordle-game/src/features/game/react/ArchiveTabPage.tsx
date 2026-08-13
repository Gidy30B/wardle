import { useEffect, useMemo, useState } from 'react'
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Search,
  Sparkles,
  Stethoscope,
  X,
} from 'lucide-react'
import BottomSheet from '../../../components/ui/BottomSheet'
import { DifficultyBadge, TrackBadge } from './learn/archive/shared'
import {
  buildArchiveCalendarMonth,
  excludeArchiveAssignments,
  getAdjacentArchiveMonth,
  getArchiveDateKey,
  getArchiveMonths,
  getArchiveMonthsForYear,
  getArchiveYears,
  getLatestArchiveMonth,
  getNextArchiveCase,
  getPreferredArchiveMonthForYear,
  groupArchiveByDate,
  parseArchiveDate,
  searchArchiveItems,
  type ArchiveCalendarDay,
  type ArchiveDateGroup,
  type ArchiveMonth,
} from '../archiveDomain'
import type { DailyCaseArchiveItem } from '../game.types'

type ArchiveTabPageProps = {
  items: DailyCaseArchiveItem[]
  loading: boolean
  error: string | null
  onRetry: () => void
  onOpenCase: (dailyCaseId: string) => void
  onPlayToday?: () => void
  onContinueArchive: (dailyCaseId: string) => void
}

const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const MONTH_SHORT_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

function formatAbsoluteDate(date: Date, includeYear: boolean) {
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    ...(includeYear ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  }).format(date)
}

function formatReleaseDate(value: string) {
  const date = parseArchiveDate(value)
  if (!date) {
    return value
  }

  const today = new Date()
  const todayUtc = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  )
  const releaseUtc = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  )
  const daysAgo = Math.max(0, Math.floor((todayUtc - releaseUtc) / 86_400_000))
  const shortDate = formatAbsoluteDate(date, today.getUTCFullYear() !== date.getUTCFullYear())

  if (daysAgo === 1) {
    return `Yesterday · ${shortDate}`
  }

  if (daysAgo >= 2 && daysAgo <= 6) {
    return `${daysAgo} days ago · ${shortDate}`
  }

  return shortDate
}

function getActionLabel(item: DailyCaseArchiveItem) {
  if (item.status === 'completed') {
    return 'Review case'
  }

  if (item.status === 'in_progress') {
    return 'Resume case'
  }

  return 'Play case'
}

function getStatusLabel(item: DailyCaseArchiveItem) {
  if (item.status === 'completed') {
    return 'Completed'
  }

  if (item.status === 'in_progress') {
    return 'In progress'
  }

  return 'Available to play'
}

function getGroupStatusSummary(group: ArchiveDateGroup) {
  const statusCounts = group.items.reduce(
    (counts, item) => ({
      completed: counts.completed + (item.status === 'completed' ? 1 : 0),
      inProgress: counts.inProgress + (item.status === 'in_progress' ? 1 : 0),
      available: counts.available + (item.status === 'unplayed' ? 1 : 0),
    }),
    { completed: 0, inProgress: 0, available: 0 },
  )
  const parts = [
    statusCounts.inProgress
      ? `${statusCounts.inProgress} in progress`
      : null,
    statusCounts.available ? `${statusCounts.available} available` : null,
    statusCounts.completed ? `${statusCounts.completed} completed` : null,
  ].filter(Boolean)

  return `${group.items.length} ${
    group.items.length === 1 ? 'assignment' : 'assignments'
  }: ${parts.join(', ')}`
}

function formatMobileSheetDate(dateKey: string) {
  const date = parseArchiveDate(dateKey)
  if (!date) {
    return dateKey.toUpperCase()
  }

  const weekday = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    timeZone: 'UTC',
  }).format(date)
  const day = new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date)
  const month = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    timeZone: 'UTC',
  }).format(date)

  return `${weekday} · ${day} ${month}`.toUpperCase()
}

function formatArchiveMetadataValue(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/(^|\s)\S/g, (character) => character.toUpperCase())
}

function getMobileArchiveMetadata(item: DailyCaseArchiveItem) {
  const parts = [formatArchiveMetadataValue(item.difficulty)]

  if (item.track !== 'DAILY') {
    parts.unshift(formatArchiveMetadataValue(item.track))
  }

  if (item.status === 'in_progress') {
    parts.push('In progress')
  } else if (item.status === 'completed') {
    parts.push('Completed')
  }

  return parts.join(' · ')
}

function getMobileArchiveAction(item: DailyCaseArchiveItem) {
  if (item.status === 'completed') {
    return 'Review'
  }

  if (item.status === 'in_progress') {
    return 'Resume'
  }

  return 'Play'
}

function getDateTitle(dateKey: string) {
  const date = parseArchiveDate(dateKey)
  if (!date) {
    return dateKey
  }

  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
    .format(date)
    .toUpperCase()
}

function getMonthName(year: number, month: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month, 1)))
}

function getCalendarCellLabel(day: ArchiveCalendarDay) {
  const date = new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(day.date)

  if (!day.inCurrentMonth) {
    return `${date}, outside displayed month`
  }

  if (!day.group) {
    return `${date}, no archive case`
  }

  const firstItem = day.group.items[0]
  const caseLabel =
    day.group.items.length === 1 && firstItem
      ? firstItem.displayLabel
      : `${day.group.items.length} archive cases`
  const assignment =
    day.group.items.length === 1 && firstItem
      ? `${caseLabel}, ${getStatusLabel(firstItem)}`
      : `${caseLabel}, ${getGroupStatusSummary(day.group)}`

  return `${date}, ${assignment}`
}

export default function ArchiveTabPage({
  items,
  loading,
  error,
  onRetry,
  onOpenCase,
  onPlayToday,
  onContinueArchive,
}: ArchiveTabPageProps) {
  const [localQuery, setLocalQuery] = useState('')
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const months = useMemo(() => getArchiveMonths(items), [items])
  const years = useMemo(() => getArchiveYears(items), [items])
  const groups = useMemo(() => groupArchiveByDate(items), [items])
  const latestMonth = useMemo(() => getLatestArchiveMonth(items), [items])
  const [currentMonthKey, setCurrentMonthKey] = useState<string | null>(null)
  const [navigatorOpen, setNavigatorOpen] = useState(false)
  const [navigatorYear, setNavigatorYear] = useState<number | null>(null)
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null)
  const [dateSheetOpen, setDateSheetOpen] = useState(false)
  const nextArchiveCase = useMemo(() => getNextArchiveCase(items), [items])
  const query = localQuery.trim()
  const searchResults = useMemo(
    () => searchArchiveItems(items, query),
    [items, query],
  )
  const currentMonth =
    months.find((month) => month.key === currentMonthKey) ?? latestMonth
  const calendar = currentMonth
    ? buildArchiveCalendarMonth(currentMonth, groups)
    : null
  const selectedGroup =
    selectedDateKey && !query ? groups.get(selectedDateKey) ?? null : null
  const selectedGroupItems = selectedGroup
    ? excludeArchiveAssignments(selectedGroup.items, [nextArchiveCase?.dailyCaseId])
    : []
  const currentMonthIsLatest =
    Boolean(currentMonth && latestMonth && currentMonth.key === latestMonth.key)
  const olderMonth = currentMonth
    ? getAdjacentArchiveMonth(months, currentMonth.key, 'older')
    : null
  const newerMonth = currentMonth
    ? getAdjacentArchiveMonth(months, currentMonth.key, 'newer')
    : null
  const navigatorYearValue = navigatorYear ?? currentMonth?.year ?? years[0] ?? null
  const navigatorYearMonths = navigatorYearValue
    ? getArchiveMonthsForYear(items, navigatorYearValue)
    : []
  const currentMonthDatePrefix = currentMonth ? `${currentMonth.key}-` : null

  const changeArchiveYear = (year: number) => {
    if (!currentMonth) {
      return
    }

    const preferredMonth = getPreferredArchiveMonthForYear(
      items,
      year,
      currentMonth.month,
    )
    if (!preferredMonth) {
      return
    }

    setCurrentMonthKey(preferredMonth.key)
    setNavigatorYear(year)
    setDateSheetOpen(false)
  }

  const selectArchiveDate = (dateKey: string) => {
    const group = groups.get(dateKey)
    if (!group) {
      return
    }

    setSelectedDateKey(dateKey)
    setDateSheetOpen(true)
  }

  const openMobileSearch = () => {
    setMobileSearchOpen(true)
    setDateSheetOpen(false)
    setNavigatorOpen(false)
  }

  const closeMobileSearch = () => {
    setMobileSearchOpen(false)
    setLocalQuery('')
  }

  useEffect(() => {
    if (!latestMonth) {
      setCurrentMonthKey(null)
      return
    }

    if (!currentMonthKey || !months.some((month) => month.key === currentMonthKey)) {
      setCurrentMonthKey(latestMonth.key)
    }
  }, [currentMonthKey, latestMonth, months])

  useEffect(() => {
    if (currentMonth && !navigatorYear) {
      setNavigatorYear(currentMonth.year)
    }
  }, [currentMonth, navigatorYear])

  useEffect(() => {
    if (!selectedDateKey && nextArchiveCase) {
      const nextDateKey = getArchiveDateKey(nextArchiveCase.releaseDate)
      if (nextDateKey && currentMonthDatePrefix && nextDateKey.startsWith(currentMonthDatePrefix)) {
        setSelectedDateKey(nextDateKey)
      }
    }
  }, [currentMonthDatePrefix, nextArchiveCase, selectedDateKey])

  useEffect(() => {
    if (
      selectedDateKey &&
      currentMonthDatePrefix &&
      !selectedDateKey.startsWith(currentMonthDatePrefix)
    ) {
      setSelectedDateKey(null)
      setDateSheetOpen(false)
    }
  }, [currentMonthDatePrefix, selectedDateKey])

  useEffect(() => {
    if (!dateSheetOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDateSheetOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [dateSheetOpen])

  useEffect(() => {
    if (!mobileSearchOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileSearchOpen(false)
        setLocalQuery('')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mobileSearchOpen])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const desktopQuery = window.matchMedia('(min-width: 640px)')
    const syncResponsiveSearchState = () => {
      setMobileSearchOpen(false)
      if (!desktopQuery.matches) {
        setLocalQuery('')
      }
    }

    syncResponsiveSearchState()
    if (typeof desktopQuery.addEventListener === 'function') {
      desktopQuery.addEventListener('change', syncResponsiveSearchState)
      return () =>
        desktopQuery.removeEventListener('change', syncResponsiveSearchState)
    }

    const legacyDesktopQuery = desktopQuery as MediaQueryList & {
      addListener: (listener: () => void) => void
      removeListener: (listener: () => void) => void
    }
    legacyDesktopQuery.addListener(syncResponsiveSearchState)
    return () => legacyDesktopQuery.removeListener(syncResponsiveSearchState)
  }, [])

  const catchUpCount = items.filter((item) => item.status !== 'completed').length
  const completedCount = items.filter((item) => item.status === 'completed').length

  return (
    <section className="flex min-h-0 w-full flex-col overflow-hidden">
      <MobileArchiveHeader
        searchOpen={mobileSearchOpen}
        query={localQuery}
        onOpenSearch={openMobileSearch}
        onQueryChange={setLocalQuery}
        onClearSearch={() => setLocalQuery('')}
        onCloseSearch={closeMobileSearch}
      />

      <header className="hidden shrink-0 border-b border-white/[0.07] px-4 pb-3 pt-2 sm:block sm:px-5">
        <p className="font-brand-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--wardle-color-teal)]/70">
          Archive
        </p>
        <h1 className="mt-1 text-2xl font-black leading-tight text-[var(--wardle-color-mint)]">
          Catch up
        </h1>
        <p className="mt-1 text-sm font-semibold text-white/38">
          {catchUpCount} available · {completedCount} completed
        </p>

        <label className="mt-4 flex h-11 w-full min-w-0 max-w-full items-center gap-2 rounded-[13px] border border-white/[0.09] bg-white/[0.035] px-3 transition focus-within:border-[var(--wardle-color-teal)]/40 focus-within:ring-2 focus-within:ring-[rgba(0,180,166,0.18)]">
          <Search className="h-4 w-4 shrink-0 text-white/30" strokeWidth={2} />
          <span className="sr-only">Search archive</span>
          <input
            value={localQuery}
            onChange={(event) => {
              setLocalQuery(event.target.value)
              setDateSheetOpen(false)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setLocalQuery('')
                setDateSheetOpen(false)
              }
            }}
            placeholder="Search case number or date"
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white/78 outline-none placeholder:text-white/28"
          />
          {localQuery ? (
            <button
              type="button"
              onClick={() => {
                setLocalQuery('')
                setDateSheetOpen(false)
              }}
              aria-label="Clear search"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] text-white/34 transition hover:bg-white/[0.06] hover:text-white/62 focus:outline-none focus:ring-2 focus:ring-[rgba(0,180,166,0.24)]"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          ) : null}
        </label>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
        {error || loading || items.length === 0 ? (
          <ArchiveEmptyState
            title={
              error
                ? 'Unable to load archive'
                : loading
                  ? 'Loading archive'
                  : "You're caught up"
            }
            copy={
              error
                ? 'The archive could not be reached.'
                : loading
                  ? 'Fetching released Daily Cases.'
                  : "You've played every available Daily Case."
            }
            actionLabel={error ? 'Retry' : "Play today's case"}
            onAction={error ? onRetry : onPlayToday}
          />
        ) : mobileSearchOpen && !query ? (
          <MobileArchiveSearchPrompt />
        ) : query ? (
          <SearchResults
            items={searchResults}
            query={query}
            onOpenCase={onOpenCase}
          />
        ) : (
          <div className="grid min-w-0 gap-4 pb-6">
            <div className="hidden sm:block">
              <ArchiveCatchUpHero
                item={nextArchiveCase}
                onContinueArchive={onContinueArchive}
                onPlayToday={onPlayToday}
              />
            </div>

            {calendar ? (
              <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
                <MobileArchiveCalendar
                  calendar={calendar}
                  years={years}
                  olderMonth={olderMonth}
                  newerMonth={newerMonth}
                  latestMonth={latestMonth}
                  navigatorOpen={navigatorOpen}
                  navigatorYearValue={navigatorYearValue}
                  navigatorYearMonths={navigatorYearMonths}
                  currentMonthIsLatest={currentMonthIsLatest}
                  selectedDateKey={selectedDateKey}
                  onSelectOlderMonth={() => {
                    if (olderMonth) {
                      setCurrentMonthKey(olderMonth.key)
                      setNavigatorYear(olderMonth.year)
                      setDateSheetOpen(false)
                    }
                  }}
                  onSelectNewerMonth={() => {
                    if (newerMonth) {
                      setCurrentMonthKey(newerMonth.key)
                      setNavigatorYear(newerMonth.year)
                      setDateSheetOpen(false)
                    }
                  }}
                  onToggleNavigator={() => {
                    setNavigatorYear(calendar.year)
                    setNavigatorOpen((open) => !open)
                    setDateSheetOpen(false)
                  }}
                  onSelectLatestMonth={() => {
                    if (latestMonth) {
                      setCurrentMonthKey(latestMonth.key)
                      setNavigatorYear(latestMonth.year)
                      setNavigatorOpen(false)
                      setDateSheetOpen(false)
                    }
                  }}
                  onSelectYear={changeArchiveYear}
                  onSelectMonth={(month) => {
                    setCurrentMonthKey(month.key)
                    setNavigatorYear(month.year)
                    setNavigatorOpen(false)
                    setDateSheetOpen(false)
                  }}
                  onSelectDate={selectArchiveDate}
                />

                <section className="hidden min-w-0 max-w-full rounded-[18px] border border-white/[0.06] bg-white/[0.025] p-3 sm:block sm:p-4">
                  <div className="mb-3 grid min-w-0 gap-2">
                    <div className="flex min-w-0 items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (olderMonth) {
                            setCurrentMonthKey(olderMonth.key)
                            setNavigatorYear(olderMonth.year)
                            setDateSheetOpen(false)
                          }
                        }}
                        disabled={!olderMonth}
                        aria-label="Previous archive month"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] border border-white/[0.08] bg-white/[0.03] text-white/48 transition hover:text-white/72 disabled:opacity-30"
                      >
                        <ChevronLeft className="h-4 w-4" strokeWidth={2} />
                      </button>
                      <div className="grid min-w-0 flex-1 justify-items-center gap-0.5">
                        <span className="min-w-0 truncate text-base font-black text-[var(--wardle-color-mint)]">
                          {getMonthName(calendar.year, calendar.month)}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setNavigatorYear(calendar.year)
                            setNavigatorOpen((open) => !open)
                            setDateSheetOpen(false)
                          }}
                          aria-expanded={navigatorOpen}
                          className="inline-flex min-w-0 items-center justify-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1 font-brand-mono text-[11px] font-bold text-white/54 transition hover:bg-white/[0.05] hover:text-white/78 focus:outline-none focus:ring-2 focus:ring-[rgba(0,180,166,0.22)]"
                        >
                          {calendar.year}
                          <ChevronDown
                            className={`h-3.5 w-3.5 shrink-0 text-white/32 transition ${
                              navigatorOpen ? 'rotate-180' : ''
                            }`}
                            strokeWidth={2}
                          />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (newerMonth) {
                            setCurrentMonthKey(newerMonth.key)
                            setNavigatorYear(newerMonth.year)
                            setDateSheetOpen(false)
                          }
                        }}
                        disabled={!newerMonth}
                        aria-label="Next archive month"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] border border-white/[0.08] bg-white/[0.03] text-white/48 transition hover:text-white/72 disabled:opacity-30"
                      >
                        <ChevronRight className="h-4 w-4" strokeWidth={2} />
                      </button>
                    </div>

                    {!currentMonthIsLatest && latestMonth ? (
                      <button
                        type="button"
                        onClick={() => {
                          setCurrentMonthKey(latestMonth.key)
                          setNavigatorYear(latestMonth.year)
                          setNavigatorOpen(false)
                          setDateSheetOpen(false)
                        }}
                        className="justify-self-center rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-1 font-brand-mono text-[10px] font-bold uppercase tracking-[0.12em] text-white/38 transition hover:bg-white/[0.05] hover:text-white/62"
                      >
                        Latest
                      </button>
                    ) : null}

                    {navigatorOpen && navigatorYearValue ? (
                      <ArchiveMonthNavigator
                        years={years}
                        selectedYear={navigatorYearValue}
                        selectedMonthKey={calendar.key}
                        activeMonths={navigatorYearMonths}
                        onSelectYear={changeArchiveYear}
                        onSelectMonth={(month) => {
                          setCurrentMonthKey(month.key)
                          setNavigatorYear(month.year)
                          setNavigatorOpen(false)
                          setDateSheetOpen(false)
                        }}
                      />
                    ) : null}
                  </div>

                  <ArchiveCalendarLegend />

                  <div className="grid w-full min-w-0 grid-cols-7 gap-1">
                    {WEEKDAY_LABELS.map((label, index) => (
                      <div
                        key={`${label}-${index}`}
                        className="py-1 text-center font-brand-mono text-[10px] font-bold text-white/24"
                      >
                        {label}
                      </div>
                    ))}
                    {calendar.weeks.flat().map((day) => (
                      <CalendarCell
                        key={day.key}
                        day={day}
                        selected={selectedDateKey === day.key}
                        onSelectDate={selectArchiveDate}
                      />
                    ))}
                  </div>
                </section>

                <SelectedDateDetail
                  group={selectedGroup}
                  visibleItems={selectedGroupItems}
                  onOpenCase={onOpenCase}
                />
                <MobileDateDetailSheet
                  group={selectedGroup}
                  isOpen={dateSheetOpen}
                  onClose={() => setDateSheetOpen(false)}
                  onOpenCase={(dailyCaseId) => {
                    setDateSheetOpen(false)
                    onOpenCase(dailyCaseId)
                  }}
                />
              </div>
            ) : null}

            <div className="hidden sm:block">
              <ArchiveRewardNote />
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function MobileArchiveHeader({
  searchOpen,
  query,
  onOpenSearch,
  onQueryChange,
  onClearSearch,
  onCloseSearch,
}: {
  searchOpen: boolean
  query: string
  onOpenSearch: () => void
  onQueryChange: (value: string) => void
  onClearSearch: () => void
  onCloseSearch: () => void
}) {
  if (searchOpen) {
    return (
      <header className="flex min-h-[58px] shrink-0 items-center gap-2 border-b border-white/[0.07] px-4 py-3 sm:hidden">
        <div className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full border border-white/[0.09] bg-white/[0.035] px-3 transition focus-within:border-[var(--wardle-color-teal)]/40 focus-within:ring-2 focus-within:ring-[rgba(0,180,166,0.18)]">
          <Search className="h-4 w-4 shrink-0 text-white/32" strokeWidth={2} />
          <input
            autoFocus
            aria-label="Search archive"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.stopPropagation()
                onCloseSearch()
              }
            }}
            placeholder="Search case number or date"
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white/78 outline-none placeholder:text-white/28"
          />
          {query ? (
            <button
              type="button"
              onClick={onClearSearch}
              aria-label="Clear archive search"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/34 transition hover:bg-white/[0.06] hover:text-white/68 focus:outline-none focus:ring-2 focus:ring-[rgba(0,180,166,0.24)]"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onCloseSearch}
          aria-label="Close archive search"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/48 transition hover:bg-white/[0.05] hover:text-white/76 focus:outline-none focus:ring-2 focus:ring-[rgba(0,180,166,0.24)]"
        >
          <X className="h-5 w-5" strokeWidth={2} />
        </button>
      </header>
    )
  }

  return (
    <header className="flex min-h-[58px] shrink-0 items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-3 sm:hidden">
      <h1 className="min-w-0 truncate text-2xl font-black leading-tight text-[var(--wardle-color-mint)]">
        Archive
      </h1>
      <button
        type="button"
        onClick={onOpenSearch}
        aria-label="Search archive"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/[0.075] bg-white/[0.025] text-white/46 transition hover:bg-white/[0.055] hover:text-white/76 focus:outline-none focus:ring-2 focus:ring-[rgba(0,180,166,0.24)]"
      >
        <Search className="h-4 w-4" strokeWidth={2} />
      </button>
    </header>
  )
}

function MobileArchiveSearchPrompt() {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center px-6 text-center sm:hidden">
      <Search className="h-5 w-5 text-white/24" strokeWidth={1.8} aria-hidden="true" />
      <p className="mt-3 text-sm font-semibold text-white/42">
        Search by case number or date.
      </p>
    </div>
  )
}

function MobileArchiveCalendar({
  calendar,
  years,
  olderMonth,
  newerMonth,
  latestMonth,
  navigatorOpen,
  navigatorYearValue,
  navigatorYearMonths,
  currentMonthIsLatest,
  selectedDateKey,
  onSelectOlderMonth,
  onSelectNewerMonth,
  onToggleNavigator,
  onSelectLatestMonth,
  onSelectYear,
  onSelectMonth,
  onSelectDate,
}: {
  calendar: ArchiveMonth & { weeks: ArchiveCalendarDay[][] }
  years: number[]
  olderMonth: ArchiveMonth | null
  newerMonth: ArchiveMonth | null
  latestMonth: ArchiveMonth | null
  navigatorOpen: boolean
  navigatorYearValue: number | null
  navigatorYearMonths: ArchiveMonth[]
  currentMonthIsLatest: boolean
  selectedDateKey: string | null
  onSelectOlderMonth: () => void
  onSelectNewerMonth: () => void
  onToggleNavigator: () => void
  onSelectLatestMonth: () => void
  onSelectYear: (year: number) => void
  onSelectMonth: (month: ArchiveMonth) => void
  onSelectDate: (dateKey: string) => void
}) {
  return (
    <section className="min-w-0 max-w-full sm:hidden">
      <MobileArchiveMonthHeader
        calendar={calendar}
        olderMonth={olderMonth}
        newerMonth={newerMonth}
        latestMonth={latestMonth}
        navigatorOpen={navigatorOpen}
        navigatorYearValue={navigatorYearValue}
        currentMonthIsLatest={currentMonthIsLatest}
        onSelectOlderMonth={onSelectOlderMonth}
        onSelectNewerMonth={onSelectNewerMonth}
        onToggleNavigator={onToggleNavigator}
        onSelectLatestMonth={onSelectLatestMonth}
      />

      {navigatorOpen && navigatorYearValue ? (
        <div className="mb-4">
          <ArchiveMonthNavigator
            years={years}
            selectedYear={navigatorYearValue}
            selectedMonthKey={calendar.key}
            activeMonths={navigatorYearMonths}
            onSelectYear={onSelectYear}
            onSelectMonth={onSelectMonth}
          />
        </div>
      ) : null}

      <MobileArchiveTileLegend />

      <div className="grid w-full min-w-0 grid-cols-7 gap-1.5">
        {WEEKDAY_LABELS.map((label, index) => (
          <div
            key={`${label}-${index}`}
            className="pb-2 pt-1 text-center font-brand-mono text-[10px] font-bold text-white/32"
          >
            {label}
          </div>
        ))}
        {calendar.weeks.flat().map((day) => (
          <MobileCalendarCell
            key={day.key}
            day={day}
            selected={selectedDateKey === day.key}
            onSelectDate={onSelectDate}
          />
        ))}
      </div>
    </section>
  )
}

function MobileArchiveMonthHeader({
  calendar,
  olderMonth,
  newerMonth,
  latestMonth,
  navigatorOpen,
  navigatorYearValue,
  currentMonthIsLatest,
  onSelectOlderMonth,
  onSelectNewerMonth,
  onToggleNavigator,
  onSelectLatestMonth,
}: {
  calendar: ArchiveMonth
  olderMonth: ArchiveMonth | null
  newerMonth: ArchiveMonth | null
  latestMonth: ArchiveMonth | null
  navigatorOpen: boolean
  navigatorYearValue: number | null
  currentMonthIsLatest: boolean
  onSelectOlderMonth: () => void
  onSelectNewerMonth: () => void
  onToggleNavigator: () => void
  onSelectLatestMonth: () => void
}) {
  return (
    <div className="mb-4 grid min-w-0 justify-items-center gap-1">
      <button
        type="button"
        onClick={onToggleNavigator}
        aria-expanded={navigatorOpen}
        className="inline-flex max-w-full min-w-0 items-center justify-center gap-1.5 rounded-full px-3 py-1 text-lg font-black leading-tight text-[var(--wardle-color-mint)] transition hover:text-white focus:outline-none focus:ring-2 focus:ring-[rgba(0,180,166,0.24)]"
      >
        <span className="min-w-0 truncate">
          {getMonthName(calendar.year, calendar.month)} {calendar.year}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-white/34 transition ${
            navigatorOpen ? 'rotate-180' : ''
          }`}
          strokeWidth={2}
        />
      </button>

      <div className="grid w-full grid-cols-[44px_minmax(0,1fr)_44px] items-center">
        <button
          type="button"
          onClick={onSelectOlderMonth}
          disabled={!olderMonth}
          aria-label="Previous archive month"
          className="flex h-11 w-11 items-center justify-center rounded-full text-white/52 transition hover:bg-white/[0.04] hover:text-white/78 focus:outline-none focus:ring-2 focus:ring-[rgba(0,180,166,0.22)] disabled:cursor-default disabled:text-white/16 disabled:hover:bg-transparent"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={2} />
        </button>

        {!currentMonthIsLatest && latestMonth ? (
          <button
            type="button"
            onClick={onSelectLatestMonth}
            className="justify-self-center rounded-full px-3 py-1 font-brand-mono text-[10px] font-bold uppercase tracking-[0.12em] text-white/36 transition hover:bg-white/[0.04] hover:text-white/62 focus:outline-none focus:ring-2 focus:ring-[rgba(0,180,166,0.2)]"
          >
            Latest
          </button>
        ) : (
          <span
            className="justify-self-center font-brand-mono text-[10px] font-bold uppercase tracking-[0.12em] text-white/18"
            aria-hidden="true"
          >
            {navigatorYearValue}
          </span>
        )}

        <button
          type="button"
          onClick={onSelectNewerMonth}
          disabled={!newerMonth}
          aria-label="Next archive month"
          className="flex h-11 w-11 items-center justify-center rounded-full text-white/52 transition hover:bg-white/[0.04] hover:text-white/78 focus:outline-none focus:ring-2 focus:ring-[rgba(0,180,166,0.22)] disabled:cursor-default disabled:text-white/16 disabled:hover:bg-transparent"
        >
          <ChevronRight className="h-5 w-5" strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}

function getArchiveCalendarTileState(day: ArchiveCalendarDay) {
  if (!day.inCurrentMonth || !day.group) {
    return 'empty' as const
  }

  if (day.group.items.some((item) => item.status === 'in_progress')) {
    return 'in_progress' as const
  }

  if (day.group.items.every((item) => item.status === 'completed')) {
    return 'completed' as const
  }

  return 'available' as const
}

function getArchiveCalendarTileStyle(
  state: ReturnType<typeof getArchiveCalendarTileState>,
  selected: boolean,
  inCurrentMonth: boolean,
) {
  const base = {
    borderRadius: '4px',
    outline: selected ? '2px solid var(--wardle-color-mint)' : undefined,
    outlineOffset: selected ? '2px' : undefined,
  }

  if (state === 'completed') {
    return {
      ...base,
      backgroundColor: 'var(--wardle-color-teal)',
      borderColor: 'var(--wardle-color-teal)',
      color: '#052322',
      boxShadow: '0 5px 16px rgba(0, 180, 166, 0.13)',
    }
  }

  if (state === 'in_progress') {
    return {
      ...base,
      backgroundColor: 'var(--wardle-color-amber)',
      borderColor: 'var(--wardle-color-amber)',
      color: '#3f2305',
      boxShadow: '0 5px 16px rgba(244, 162, 97, 0.12)',
    }
  }

  if (state === 'available') {
    return {
      ...base,
      backgroundColor: '#ffffff',
      borderColor: '#ffffff',
      color: '#071313',
      boxShadow: '0 5px 18px rgba(255, 255, 255, 0.10)',
    }
  }

  return {
    ...base,
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    color: inCurrentMonth ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.10)',
    boxShadow: 'none',
  }
}

function MobileCalendarCell({
  day,
  selected,
  onSelectDate,
}: {
  day: ArchiveCalendarDay
  selected: boolean
  onSelectDate: (dateKey: string) => void
}) {
  const tileState = getArchiveCalendarTileState(day)
  const interactive = tileState !== 'empty'
  const assignmentCount = day.group?.items.length ?? 0
  const tileStyle = getArchiveCalendarTileStyle(tileState, selected, day.inCurrentMonth)

  return (
    <button
      type="button"
      disabled={!interactive}
      onClick={() => onSelectDate(day.key)}
      aria-label={getCalendarCellLabel(day)}
      data-archive-tile-state={tileState}
      style={tileStyle}
      className={`group relative flex aspect-square min-h-[42px] min-w-0 items-center justify-center border text-center text-[15px] font-black leading-none transition-[transform,box-shadow,filter] duration-150 focus:outline-none disabled:cursor-default ${
        interactive
          ? 'hover:-translate-y-0.5 hover:brightness-[1.03] active:translate-y-0 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-[var(--wardle-color-mint)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#071313]'
          : ''
      }`}
    >
      <span>{day.dayNumber}</span>

      {assignmentCount > 1 ? (
        <span
          style={{ borderRadius: '3px' }}
          className="absolute right-1 top-1 flex min-h-4 min-w-4 items-center justify-center bg-black/[0.14] px-1 font-brand-mono text-[8px] font-black leading-none text-current"
        >
          {assignmentCount}
        </span>
      ) : null}
    </button>
  )
}

function MobileArchiveTileLegend() {
  return (
    <div className="mb-3 flex items-center justify-center gap-4 font-brand-mono text-[9px] font-bold uppercase tracking-[0.08em] text-white/42 sm:hidden">
      <span className="inline-flex items-center gap-1.5">
        <span
          className="h-2.5 w-2.5 rounded-[3px] border border-white bg-white"
          aria-hidden="true"
        />
        Play
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          className="h-2.5 w-2.5 rounded-[3px] border border-[var(--wardle-color-amber)] bg-[var(--wardle-color-amber)]"
          aria-hidden="true"
        />
        Resume
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          className="h-2.5 w-2.5 rounded-[3px] border border-[var(--wardle-color-teal)] bg-[var(--wardle-color-teal)]"
          aria-hidden="true"
        />
        Done
      </span>
    </div>
  )
}

function ArchiveCalendarLegend() {
  return (
    <div className="mb-3 grid min-w-0 grid-cols-2 gap-1.5 text-[10px] font-bold text-white/46 sm:flex sm:flex-wrap sm:items-center">
      <CalendarLegendItem
        label="Ready to play"
        className="border-white bg-white"
      />
      <CalendarLegendItem
        label="In progress"
        className="border-[var(--wardle-color-amber)] bg-[var(--wardle-color-amber)]"
      />
      <CalendarLegendItem
        label="Completed"
        className="border-[var(--wardle-color-teal)] bg-[var(--wardle-color-teal)]"
      />
    </div>
  )
}

function CalendarLegendItem({
  label,
  className,
}: {
  label: string
  className: string
}) {
  return (
    <div className="inline-flex min-w-0 items-center gap-1.5">
      <span className={`h-3 w-3 shrink-0 rounded-[4px] border ${className}`} />
      <span className="min-w-0 truncate">{label}</span>
    </div>
  )
}

function ArchiveCatchUpHero({
  item,
  onContinueArchive,
  onPlayToday,
}: {
  item: DailyCaseArchiveItem | null
  onContinueArchive: (dailyCaseId: string) => void
  onPlayToday?: () => void
}) {
  if (!item) {
    return (
      <section className="min-w-0 max-w-full rounded-[18px] border border-[rgba(0,180,166,0.18)] bg-[rgba(0,180,166,0.055)] px-4 py-4">
        <p className="text-lg font-black text-[var(--wardle-color-mint)]">
          You're caught up
        </p>
        <p className="mt-1 text-sm leading-6 text-white/42">
          You've played every available Daily Case.
        </p>
        {onPlayToday ? (
          <button
            type="button"
            onClick={onPlayToday}
            className="mt-3 h-10 w-full min-w-0 rounded-[12px] border border-[rgba(0,180,166,0.28)] bg-[rgba(0,180,166,0.11)] px-4 text-sm font-black text-[var(--wardle-color-teal)] sm:w-auto"
          >
            Play today's case
          </button>
        ) : null}
      </section>
    )
  }

  const inProgress = item.status === 'in_progress'

  return (
    <section className="min-w-0 max-w-full rounded-[18px] border border-[rgba(244,162,97,0.24)] bg-[rgba(244,162,97,0.075)] px-4 py-4">
      <p className="font-brand-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--wardle-color-amber)]/78">
        Continue Archive
      </p>
      <div className="mt-2 flex min-w-0 flex-col items-stretch gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 max-w-full">
          <h2 className="min-w-0 break-words text-xl font-black leading-tight text-[var(--wardle-color-mint)] sm:truncate">
            {item.displayLabel}
          </h2>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-white/46">
            <span className="break-words">
              {inProgress ? 'In progress' : formatReleaseDate(item.releaseDate)}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onContinueArchive(item.dailyCaseId)}
          className="h-11 w-full min-w-0 rounded-[13px] border border-[rgba(244,162,97,0.34)] bg-[rgba(244,162,97,0.12)] px-4 text-sm font-black text-[var(--wardle-color-amber)] transition hover:bg-[rgba(244,162,97,0.17)] focus:outline-none focus:ring-2 focus:ring-[rgba(244,162,97,0.3)] active:scale-[0.99] sm:w-auto sm:shrink-0"
        >
          {inProgress ? 'Resume' : 'Play next'}
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {item.track !== 'DAILY' ? <TrackBadge track={item.track} /> : null}
        <DifficultyBadge difficulty={item.difficulty} />
      </div>
    </section>
  )
}

function ArchiveMonthNavigator({
  years,
  selectedYear,
  selectedMonthKey,
  activeMonths,
  onSelectYear,
  onSelectMonth,
}: {
  years: number[]
  selectedYear: number
  selectedMonthKey: string
  activeMonths: ArchiveMonth[]
  onSelectYear: (year: number) => void
  onSelectMonth: (month: ArchiveMonth) => void
}) {
  const activeMonthByNumber = new Map(
    activeMonths.map((month) => [month.month, month]),
  )

  return (
    <div className="grid min-w-0 gap-3 rounded-[14px] border border-white/[0.07] bg-black/[0.16] p-3">
      {years.length > 1 ? (
        <div className="grid min-w-0 gap-2">
          <p className="font-brand-mono text-[10px] font-bold uppercase tracking-[0.14em] text-white/28">
            Select year
          </p>
          <div className="grid min-w-0 grid-cols-2 gap-1.5 sm:grid-cols-3">
            {years.map((year) => (
              <button
                key={year}
                type="button"
                onClick={() => onSelectYear(year)}
                className={`rounded-[10px] border px-3 py-2 font-brand-mono text-[11px] font-bold transition ${
                  selectedYear === year
                    ? 'border-[rgba(0,180,166,0.35)] bg-[rgba(0,180,166,0.12)] text-[var(--wardle-color-teal)]'
                    : 'border-white/[0.07] bg-white/[0.025] text-white/38 hover:text-white/62'
                }`}
              >
                {year}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-4 gap-1.5">
        {MONTH_SHORT_LABELS.map((label, monthNumber) => {
          const archiveMonth = activeMonthByNumber.get(monthNumber)
          const active = Boolean(archiveMonth)
          const selected = archiveMonth?.key === selectedMonthKey

          return (
            <button
              key={label}
              type="button"
              disabled={!archiveMonth}
              onClick={() => {
                if (archiveMonth) {
                  onSelectMonth(archiveMonth)
                }
              }}
              className={`h-9 rounded-[10px] border font-brand-mono text-[10px] font-bold uppercase tracking-[0.08em] transition disabled:cursor-default ${
                selected
                  ? 'border-[rgba(0,180,166,0.42)] bg-[rgba(0,180,166,0.16)] text-[var(--wardle-color-mint)]'
                  : active
                    ? 'border-white/[0.08] bg-white/[0.035] text-white/58 hover:bg-white/[0.06] hover:text-white/78'
                    : 'border-transparent bg-transparent text-white/14'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function CalendarCell({
  day,
  selected,
  onSelectDate,
}: {
  day: ArchiveCalendarDay
  selected: boolean
  onSelectDate: (dateKey: string) => void
}) {
  const tileState = getArchiveCalendarTileState(day)
  const interactive = tileState !== 'empty'
  const assignmentCount = day.group?.items.length ?? 0
  const tileStyle = getArchiveCalendarTileStyle(tileState, selected, day.inCurrentMonth)

  return (
    <button
      type="button"
      disabled={!interactive}
      onClick={() => onSelectDate(day.key)}
      aria-label={getCalendarCellLabel(day)}
      data-archive-tile-state={tileState}
      style={tileStyle}
      className={`relative flex aspect-square min-h-8 min-w-0 items-center justify-center border text-center text-sm font-black transition-[transform,box-shadow,filter] duration-150 focus:outline-none disabled:cursor-default sm:min-h-[40px] ${
        interactive
          ? 'hover:-translate-y-0.5 hover:brightness-[1.03] active:translate-y-0 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-[var(--wardle-color-mint)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#071313]'
          : ''
      }`}
    >
      <span>{day.dayNumber}</span>
      {assignmentCount > 1 ? (
        <span
          style={{ borderRadius: '3px' }}
          className="absolute right-1.5 top-1.5 flex min-h-4 min-w-4 items-center justify-center bg-black/[0.14] px-1 font-brand-mono text-[8px] font-black leading-none text-current"
        >
          {assignmentCount}
        </span>
      ) : null}
    </button>
  )
}

function SelectedDateDetail({
  group,
  visibleItems,
  onOpenCase,
}: {
  group: ArchiveDateGroup | null
  visibleItems: DailyCaseArchiveItem[]
  onOpenCase: (dailyCaseId: string) => void
}) {
  if (!group || visibleItems.length === 0) {
    return null
  }

  return (
    <section className="hidden min-w-0 max-w-full rounded-[18px] border border-white/[0.06] bg-white/[0.025] px-4 py-4 sm:block">
      <ArchiveDateAssignments
        group={group}
        items={visibleItems}
        onOpenCase={onOpenCase}
      />
    </section>
  )
}

function MobileDateDetailSheet({
  group,
  isOpen,
  onClose,
  onOpenCase,
}: {
  group: ArchiveDateGroup | null
  isOpen: boolean
  onClose: () => void
  onOpenCase: (dailyCaseId: string) => void
}) {
  if (!group) {
    return null
  }

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel={`${getDateTitle(group.dateKey)} archive cases`}
      className="sm:hidden"
    >
      <div className="min-w-0 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
        <MobileArchiveSheetHeader group={group} onClose={onClose} />
        <MobileArchiveAssignmentList
          items={group.items}
          onOpenCase={onOpenCase}
        />
      </div>
    </BottomSheet>
  )
}

function MobileArchiveSheetHeader({
  group,
  onClose,
}: {
  group: ArchiveDateGroup
  onClose: () => void
}) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-4 pb-3 pt-1">
      <div className="min-w-0 pt-1">
        <h2 className="font-brand-mono text-[11px] font-bold uppercase tracking-[0.17em] text-[var(--wardle-color-mint)]">
          {formatMobileSheetDate(group.dateKey)}
        </h2>
        {group.items.length > 1 ? (
          <p className="mt-1.5 text-sm font-semibold text-white/38">
            {group.items.length} cases
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close date detail"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/[0.075] bg-white/[0.025] text-white/44 transition hover:bg-white/[0.055] hover:text-white/72 focus:outline-none focus:ring-2 focus:ring-[rgba(0,180,166,0.24)]"
      >
        <X className="h-4 w-4" strokeWidth={2} />
      </button>
    </div>
  )
}

function MobileArchiveAssignmentList({
  items,
  onOpenCase,
}: {
  items: DailyCaseArchiveItem[]
  onOpenCase: (dailyCaseId: string) => void
}) {
  return (
    <div className="min-w-0 divide-y divide-white/[0.065]">
      {items.map((item) => (
        <MobileArchiveAssignmentRow
          key={item.dailyCaseId}
          item={item}
          onOpenCase={onOpenCase}
        />
      ))}
    </div>
  )
}

function MobileArchiveAssignmentRow({
  item,
  onOpenCase,
}: {
  item: DailyCaseArchiveItem
  onOpenCase: (dailyCaseId: string) => void
}) {
  const completed = item.status === 'completed'
  const inProgress = item.status === 'in_progress'
  const metadata = getMobileArchiveMetadata(item)
  const action = getMobileArchiveAction(item)
  const LeadingIcon = completed
    ? Check
    : inProgress || item.track === 'PRACTICE'
      ? Clock3
      : item.track === 'PREMIUM'
        ? Sparkles
        : Stethoscope
  const iconTone = completed
    ? 'border-white/[0.07] bg-white/[0.025] text-white/34'
    : inProgress
      ? 'border-[rgba(244,162,97,0.25)] bg-[rgba(244,162,97,0.08)] text-[var(--wardle-color-amber)]'
      : 'border-[rgba(0,180,166,0.22)] bg-[rgba(0,180,166,0.07)] text-[var(--wardle-color-teal)]'
  const actionTone = completed
    ? 'text-white/42'
    : inProgress
      ? 'text-[var(--wardle-color-amber)]'
      : 'text-[var(--wardle-color-teal)]'

  return (
    <button
      type="button"
      onClick={() => onOpenCase(item.dailyCaseId)}
      aria-label={`${item.displayLabel}, ${metadata}, ${action} case`}
      className={`group flex min-h-[76px] w-full min-w-0 items-center gap-3 py-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[rgba(0,180,166,0.32)] ${
        completed ? 'opacity-70' : ''
      }`}
    >
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border ${iconTone}`}
        aria-hidden="true"
      >
        <LeadingIcon className="h-5 w-5" strokeWidth={1.9} />
      </span>

      <span className="min-w-0 flex-1">
        <span
          className={`block min-w-0 truncate text-[16px] font-black leading-5 ${
            completed ? 'text-white/52' : 'text-[var(--wardle-color-mint)]'
          }`}
        >
          {item.displayLabel}
        </span>
        <span
          className={`mt-1 block min-w-0 truncate text-[12px] font-semibold ${
            inProgress
              ? 'text-[var(--wardle-color-amber)]/72'
              : completed
                ? 'text-white/28'
                : 'text-white/38'
          }`}
        >
          {metadata}
        </span>
      </span>

      <span
        className={`flex shrink-0 items-center gap-1 text-sm font-black ${actionTone}`}
        aria-hidden="true"
      >
        {action}
        <ChevronRight
          className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
          strokeWidth={2}
        />
      </span>
    </button>
  )
}

function ArchiveDateAssignments({
  group,
  items,
  onOpenCase,
}: {
  group: ArchiveDateGroup
  items: DailyCaseArchiveItem[]
  onOpenCase: (dailyCaseId: string) => void
}) {
  return (
    <>
      <ArchiveDateAssignmentsHeader group={group} />
      <ArchiveDateAssignmentsBody items={items} onOpenCase={onOpenCase} />
    </>
  )
}

function ArchiveDateAssignmentsHeader({ group }: { group: ArchiveDateGroup }) {
  return (
    <div className="min-w-0">
      <h2 className="font-brand-mono text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--wardle-color-mint)]">
        {getDateTitle(group.dateKey)}
      </h2>
      <p className="mt-1 text-xs font-semibold text-white/38">
        {getGroupStatusSummary(group)}
      </p>
    </div>
  )
}

function ArchiveDateAssignmentsBody({
  items,
  onOpenCase,
}: {
  items: DailyCaseArchiveItem[]
  onOpenCase: (dailyCaseId: string) => void
}) {
  return (
    <div className="mt-3 grid min-w-0 gap-2">
      {items.map((item) => (
        <ArchiveCaseRow
          key={item.dailyCaseId}
          item={item}
          onOpenCase={onOpenCase}
        />
      ))}
    </div>
  )
}

function SearchResults({
  items,
  query,
  onOpenCase,
}: {
  items: DailyCaseArchiveItem[]
  query: string
  onOpenCase: (dailyCaseId: string) => void
}) {
  if (items.length === 0) {
    return (
      <ArchiveEmptyState
        title="No matching cases"
        copy="Try another case number or date."
      />
    )
  }

  return (
    <section className="grid min-w-0 gap-2 pb-6">
      <p className="min-w-0 break-words font-brand-mono text-[10px] font-bold uppercase tracking-[0.16em] text-white/30">
        Search results for {query}
      </p>
      {items.map((item) => (
        <ArchiveCaseRow
          key={item.dailyCaseId}
          item={item}
          onOpenCase={onOpenCase}
        />
      ))}
    </section>
  )
}

function ArchiveCaseRow({
  item,
  onOpenCase,
}: {
  item: DailyCaseArchiveItem
  onOpenCase: (dailyCaseId: string) => void
}) {
  const completed = item.status === 'completed'
  const inProgress = item.status === 'in_progress'

  return (
    <article
      className={`grid min-w-0 max-w-full gap-3 overflow-hidden rounded-[14px] border px-3.5 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ${
        completed
          ? 'border-white/[0.045] bg-white/[0.018]'
          : inProgress
            ? 'border-[rgba(244,162,97,0.18)] bg-white/[0.025]'
            : 'border-white/[0.07] bg-white/[0.028]'
      }`}
    >
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          {completed ? (
            <span className="shrink-0 text-sm font-black text-[var(--wardle-color-teal)]">
              ok
            </span>
          ) : null}
          <h3
            className={`min-w-0 truncate text-[15px] font-black leading-5 ${
              completed ? 'text-white/54' : 'text-[var(--wardle-color-mint)]'
            }`}
          >
            {item.displayLabel}
          </h3>
        </div>
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-semibold text-white/36">
          {formatReleaseDate(item.releaseDate)} · {getStatusLabel(item)}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {item.track !== 'DAILY' ? <TrackBadge track={item.track} /> : null}
          <DifficultyBadge difficulty={item.difficulty} />
        </div>
      </div>
      <button
        type="button"
        onClick={() => onOpenCase(item.dailyCaseId)}
        className={`h-10 w-full min-w-0 rounded-[12px] border px-4 text-sm font-black transition focus:outline-none focus:ring-2 active:scale-[0.99] sm:w-auto sm:shrink-0 ${
          completed
            ? 'border-white/[0.07] bg-white/[0.025] text-white/46 hover:bg-white/[0.05] hover:text-white/68 focus:ring-white/[0.12]'
            : inProgress
              ? 'border-[rgba(244,162,97,0.28)] bg-[rgba(244,162,97,0.1)] text-[var(--wardle-color-amber)] hover:bg-[rgba(244,162,97,0.15)] focus:ring-[rgba(244,162,97,0.3)]'
              : 'border-[rgba(0,180,166,0.28)] bg-[rgba(0,180,166,0.1)] text-[var(--wardle-color-teal)] hover:bg-[rgba(0,180,166,0.16)] focus:ring-[rgba(0,180,166,0.28)]'
        }`}
      >
        {getActionLabel(item)}
      </button>
    </article>
  )
}

function ArchiveRewardNote() {
  return (
    <aside className="min-w-0 max-w-full rounded-[13px] border border-white/[0.055] bg-white/[0.02] px-3.5 py-3 text-sm leading-6 text-white/42">
      <span className="font-bold text-white/58">Archive cases earn XP.</span>{' '}
      Daily streaks and rankings stay with today's case.
    </aside>
  )
}

function ArchiveEmptyState({
  title,
  copy,
  actionLabel,
  onAction,
}: {
  title: string
  copy: string
  actionLabel?: string | null
  onAction?: () => void
}) {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center rounded-[14px] border border-white/[0.07] bg-white/[0.025] px-6 text-center">
      <p className="text-base font-black text-[var(--wardle-color-mint)]">
        {title}
      </p>
      <p className="mt-2 max-w-sm text-sm leading-6 text-white/42">{copy}</p>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 h-11 rounded-[13px] border border-[rgba(0,180,166,0.28)] bg-[rgba(0,180,166,0.11)] px-5 text-sm font-black text-[var(--wardle-color-teal)] transition hover:bg-[rgba(0,180,166,0.17)] focus:outline-none focus:ring-2 focus:ring-[rgba(0,180,166,0.28)]"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}