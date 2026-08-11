import { useMemo, useState } from 'react'
import { DifficultyBadge, TrackBadge } from './learn/archive/shared'
import type {
  DailyCaseArchiveItem,
  DailyCaseArchiveStatus,
} from '../game.types'
import type { DailyCaseArchiveFilter } from '../useDailyCaseArchive'

type ArchiveTabPageProps = {
  items: DailyCaseArchiveItem[]
  loading: boolean
  error: string | null
  filter: DailyCaseArchiveFilter
  onFilterChange: (filter: DailyCaseArchiveFilter) => void
  onRetry: () => void
  onOpenCase: (dailyCaseId: string) => void
}

const FILTERS: Array<{ id: DailyCaseArchiveFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'unplayed', label: 'Unplayed' },
  { id: 'completed', label: 'Completed' },
]

function formatReleaseDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

function getStatusCopy(status: DailyCaseArchiveStatus) {
  if (status === 'completed') {
    return {
      label: 'Completed',
      action: 'Review',
      tone:
        'border-[rgba(0,180,166,0.24)] bg-[rgba(0,180,166,0.1)] text-[var(--wardle-color-teal)]',
    }
  }

  if (status === 'in_progress') {
    return {
      label: 'In progress',
      action: 'Resume',
      tone:
        'border-[rgba(244,162,97,0.28)] bg-[rgba(244,162,97,0.1)] text-[var(--wardle-color-amber)]',
    }
  }

  return {
    label: 'Not played',
    action: 'Play',
    tone: 'border-white/[0.12] bg-white/[0.045] text-white/62',
  }
}

export default function ArchiveTabPage({
  items,
  loading,
  error,
  filter,
  onFilterChange,
  onRetry,
  onOpenCase,
}: ArchiveTabPageProps) {
  const [localQuery, setLocalQuery] = useState('')
  const visibleItems = useMemo(() => {
    const query = localQuery.trim().toLowerCase()
    if (!query) {
      return items
    }

    return items.filter((item) =>
      [item.displayLabel, item.trackDisplayLabel, item.releaseDate]
        .join(' ')
        .toLowerCase()
        .includes(query),
    )
  }, [items, localQuery])

  return (
    <section className="flex min-h-0 w-full flex-col overflow-hidden">
      <header className="shrink-0 border-b border-white/[0.07] px-4 pb-4 pt-2 sm:px-5">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="font-brand-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--wardle-color-teal)]/70">
              Archive
            </p>
            <h1 className="mt-1 text-xl font-black text-[var(--wardle-color-mint)]">
              Daily Cases
            </h1>
          </div>
          <div className="grid grid-cols-3 gap-1 rounded-[14px] border border-white/[0.08] bg-white/[0.035] p-1">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onFilterChange(item.id)}
                className={`rounded-[10px] px-3 py-2 text-xs font-bold transition ${
                  filter === item.id
                    ? 'bg-[var(--wardle-color-teal)] text-white'
                    : 'text-white/48 hover:bg-white/[0.06] hover:text-white/74'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <label className="mt-4 block">
          <span className="sr-only">Search archive</span>
          <input
            value={localQuery}
            onChange={(event) => setLocalQuery(event.target.value)}
            placeholder="Search daily number or date"
            className="h-12 w-full rounded-[14px] border border-white/[0.09] bg-white/[0.035] px-4 text-sm font-semibold text-white/78 outline-none transition placeholder:text-white/28 focus:border-[var(--wardle-color-teal)]/40"
          />
        </label>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
        {error ? (
          <ArchiveEmptyState
            title="Unable to load archive"
            copy="The archive could not be reached."
            actionLabel="Retry"
            onAction={onRetry}
          />
        ) : loading ? (
          <ArchiveEmptyState
            title="Loading archive"
            copy="Fetching released Daily Cases."
          />
        ) : visibleItems.length === 0 ? (
          <ArchiveEmptyState
            title="No cases found"
            copy={
              filter === 'unplayed'
                ? 'You are caught up on released Daily Cases.'
                : 'No released Daily Cases match this view.'
            }
          />
        ) : (
          <div className="grid gap-3 pb-6">
            {visibleItems.map((item) => (
              <ArchiveCaseRow
                key={item.dailyCaseId}
                item={item}
                onOpenCase={onOpenCase}
              />
            ))}
          </div>
        )}
      </div>
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
  const status = getStatusCopy(item.status)

  return (
    <article className="grid gap-3 rounded-[14px] border border-white/[0.07] bg-white/[0.025] px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="min-w-0 truncate text-base font-black text-[var(--wardle-color-mint)]">
            {item.displayLabel}
          </h2>
          <span
            className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 font-brand-mono text-[10px] font-bold uppercase tracking-[0.12em] ${status.tone}`}
          >
            {status.label}
          </span>
        </div>
        <p className="mt-1 text-sm font-semibold text-white/42">
          {formatReleaseDate(item.releaseDate)}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <TrackBadge track={item.track} />
          <DifficultyBadge difficulty={item.difficulty} />
        </div>
      </div>

      <button
        type="button"
        onClick={() => onOpenCase(item.dailyCaseId)}
        className="h-11 rounded-[13px] border border-[rgba(0,180,166,0.28)] bg-[rgba(0,180,166,0.11)] px-5 text-sm font-black text-[var(--wardle-color-teal)] transition hover:bg-[rgba(0,180,166,0.17)] active:scale-[0.99]"
      >
        {status.action}
      </button>
    </article>
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
  actionLabel?: string
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
          className="mt-5 h-11 rounded-[13px] border border-[rgba(0,180,166,0.28)] bg-[rgba(0,180,166,0.11)] px-5 text-sm font-black text-[var(--wardle-color-teal)] transition hover:bg-[rgba(0,180,166,0.17)]"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}
