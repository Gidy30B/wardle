/// <reference types="node" />

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildArchiveCalendarMonth,
  excludeArchiveAssignments,
  getArchiveMonthsForYear,
  getArchiveYears,
  getLatestArchiveMonth,
  getArchiveMonths,
  getNextArchiveCase,
  getPreferredArchiveMonthForYear,
  groupArchiveByDate,
} from './archiveDomain.ts'
import type { DailyCaseArchiveItem } from './game.types.ts'

function archiveItem(
  overrides: Partial<DailyCaseArchiveItem> = {},
): DailyCaseArchiveItem {
  return {
    dailyCaseId: overrides.dailyCaseId ?? 'daily-1',
    caseId: overrides.caseId ?? 'case-1',
    casePublicNumber: overrides.casePublicNumber ?? 1,
    displayLabel: overrides.displayLabel ?? 'Daily Case 001',
    trackDisplayLabel: overrides.trackDisplayLabel ?? 'Daily Case',
    releaseDate: overrides.releaseDate ?? '2026-08-10',
    track: overrides.track ?? 'DAILY',
    sequenceIndex: overrides.sequenceIndex ?? 1,
    difficulty: overrides.difficulty ?? 'MEDIUM',
    status: overrides.status ?? 'unplayed',
    completedAt: overrides.completedAt ?? null,
  }
}

describe('archive catch-up resolver', () => {
  it('prioritizes in-progress over unplayed', () => {
    const next = getNextArchiveCase([
      archiveItem({ dailyCaseId: 'unplayed-new', releaseDate: '2026-08-12' }),
      archiveItem({
        dailyCaseId: 'started-old',
        status: 'in_progress',
        releaseDate: '2026-08-01',
      }),
    ])

    assert.equal(next?.dailyCaseId, 'started-old')
  })

  it('chooses newest in-progress case first', () => {
    const next = getNextArchiveCase([
      archiveItem({
        dailyCaseId: 'started-old',
        status: 'in_progress',
        releaseDate: '2026-08-01',
      }),
      archiveItem({
        dailyCaseId: 'started-new',
        status: 'in_progress',
        releaseDate: '2026-08-09',
      }),
    ])

    assert.equal(next?.dailyCaseId, 'started-new')
  })

  it('falls back to newest unplayed and skips completed', () => {
    const next = getNextArchiveCase([
      archiveItem({
        dailyCaseId: 'completed-new',
        status: 'completed',
        releaseDate: '2026-08-11',
      }),
      archiveItem({ dailyCaseId: 'unplayed-old', releaseDate: '2026-08-02' }),
      archiveItem({ dailyCaseId: 'unplayed-new', releaseDate: '2026-08-10' }),
    ])

    assert.equal(next?.dailyCaseId, 'unplayed-new')
  })

  it('returns null when only completed cases exist', () => {
    const next = getNextArchiveCase([
      archiveItem({ dailyCaseId: 'done', status: 'completed' }),
    ])

    assert.equal(next, null)
  })

  it('excludes the current daily case id', () => {
    const next = getNextArchiveCase(
      [
        archiveItem({ dailyCaseId: 'current', releaseDate: '2026-08-10' }),
        archiveItem({ dailyCaseId: 'next', releaseDate: '2026-08-09' }),
      ],
      ['current'],
    )

    assert.equal(next?.dailyCaseId, 'next')
  })
})

describe('archive month grouping', () => {
  it('groups many cases across months newest month first', () => {
    const items = Array.from({ length: 70 }, (_, index) =>
      archiveItem({
        dailyCaseId: `daily-${index}`,
        releaseDate: new Date(Date.UTC(2026, 5, 1 + index))
          .toISOString()
          .slice(0, 10),
      }),
    )

    const months = getArchiveMonths(items)

    assert.equal(months[0].key, '2026-08')
    assert.ok(months.some((month) => month.key === '2026-06'))
  })

  it('builds calendar cells with date status and multiple assignments', () => {
    const items = [
      archiveItem({ dailyCaseId: 'done', status: 'completed', releaseDate: '2026-08-07' }),
      archiveItem({ dailyCaseId: 'started', status: 'in_progress', releaseDate: '2026-08-08' }),
      archiveItem({ dailyCaseId: 'daily', releaseDate: '2026-08-10' }),
      archiveItem({
        dailyCaseId: 'premium',
        releaseDate: '2026-08-10',
        track: 'PREMIUM',
        trackDisplayLabel: 'Premium Case',
      }),
    ]
    const [month] = getArchiveMonths(items)
    const calendar = buildArchiveCalendarMonth(month, groupArchiveByDate(items))
    const cells = calendar.weeks.flat()

    assert.equal(cells.find((cell) => cell.key === '2026-08-07')?.group?.status, 'completed')
    assert.equal(cells.find((cell) => cell.key === '2026-08-08')?.group?.status, 'in_progress')
    assert.equal(cells.find((cell) => cell.key === '2026-08-10')?.group?.items.length, 2)
  })
})

describe('archive year and month navigation helpers', () => {
  it('derives available years newest first', () => {
    const years = getArchiveYears([
      archiveItem({ dailyCaseId: 'jun-2024', releaseDate: '2024-06-01' }),
      archiveItem({ dailyCaseId: 'dec-2025', releaseDate: '2025-12-31' }),
      archiveItem({ dailyCaseId: 'jan-2026', releaseDate: '2026-01-01' }),
      archiveItem({ dailyCaseId: 'aug-2026', releaseDate: '2026-08-10' }),
    ])

    assert.deepEqual(years, [2026, 2025, 2024])
  })

  it('returns only months containing archive assignments for a year', () => {
    const months = getArchiveMonthsForYear(
      [
        archiveItem({ dailyCaseId: 'dec-2025', releaseDate: '2025-12-31' }),
        archiveItem({ dailyCaseId: 'jan-2026', releaseDate: '2026-01-01' }),
        archiveItem({ dailyCaseId: 'jun-2026', releaseDate: '2026-06-15' }),
        archiveItem({ dailyCaseId: 'aug-2026', releaseDate: '2026-08-10' }),
      ],
      2026,
    )

    assert.deepEqual(
      months.map((month) => month.key),
      ['2026-08', '2026-06', '2026-01'],
    )
  })

  it('returns the most recent loaded archive month', () => {
    const latest = getLatestArchiveMonth([
      archiveItem({ dailyCaseId: 'dec-2025', releaseDate: '2025-12-31' }),
      archiveItem({ dailyCaseId: 'aug-2026', releaseDate: '2026-08-10' }),
      archiveItem({ dailyCaseId: 'jun-2026', releaseDate: '2026-06-15' }),
    ])

    assert.equal(latest?.key, '2026-08')
  })

  it('preserves the current month when changing to a year that has it', () => {
    const preferred = getPreferredArchiveMonthForYear(
      [
        archiveItem({ dailyCaseId: 'aug-2026', releaseDate: '2026-08-10' }),
        archiveItem({ dailyCaseId: 'aug-2025', releaseDate: '2025-08-10' }),
        archiveItem({ dailyCaseId: 'jun-2025', releaseDate: '2025-06-01' }),
      ],
      2025,
      7,
    )

    assert.equal(preferred?.key, '2025-08')
  })

  it('falls back to the latest available month when changing to a year without the current month', () => {
    const preferred = getPreferredArchiveMonthForYear(
      [
        archiveItem({ dailyCaseId: 'aug-2026', releaseDate: '2026-08-10' }),
        archiveItem({ dailyCaseId: 'jun-2024', releaseDate: '2024-06-15' }),
        archiveItem({ dailyCaseId: 'apr-2024', releaseDate: '2024-04-12' }),
      ],
      2024,
      7,
    )

    assert.equal(preferred?.key, '2024-06')
  })

  it('preserves multiple assignments under one date key', () => {
    const groups = groupArchiveByDate([
      archiveItem({ dailyCaseId: 'daily', releaseDate: '2026-08-10' }),
      archiveItem({
        dailyCaseId: 'premium',
        releaseDate: '2026-08-10',
        track: 'PREMIUM',
        trackDisplayLabel: 'Premium Case',
      }),
    ])

    assert.deepEqual(
      groups.get('2026-08-10')?.items.map((item) => item.dailyCaseId),
      ['daily', 'premium'],
    )
  })

  it('can exclude the continue case from selected-date detail by daily case id', () => {
    const selectedItems = [
      archiveItem({ dailyCaseId: 'daily-continue', releaseDate: '2026-08-10' }),
      archiveItem({
        dailyCaseId: 'premium-other',
        releaseDate: '2026-08-10',
        track: 'PREMIUM',
        trackDisplayLabel: 'Premium Case',
      }),
    ]

    assert.deepEqual(
      excludeArchiveAssignments(selectedItems, ['daily-continue']).map(
        (item) => item.dailyCaseId,
      ),
      ['premium-other'],
    )
  })

  it('returns no selected-detail assignments when the selected date only contains the continue case', () => {
    const selectedItems = [
      archiveItem({ dailyCaseId: 'daily-continue', releaseDate: '2026-08-10' }),
    ]

    assert.deepEqual(
      excludeArchiveAssignments(selectedItems, ['daily-continue']),
      [],
    )
  })
})
