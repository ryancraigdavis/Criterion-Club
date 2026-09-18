import { describe, expect, it } from 'vitest'
import {
  boardDate,
  dayMonth,
  daysUntil,
  fromLocalInput,
  relativeDay,
  screeningDate,
  screeningTime,
  screeningWhen,
  toLocalInput,
} from './format'

const CHICAGO = 'America/Chicago'
const FRIDAY_730PM = '2026-09-19T00:30:00Z'
const now = (iso: string) => new Date(iso)

describe('daysUntil', () => {
  it.each([
    ['same local evening', '2026-09-18T15:00:00Z', 0],
    ['after midnight UTC but same local day', '2026-09-18T23:59:00Z', 0],
    ['the local day before', '2026-09-17T20:00:00Z', 1],
    ['a week out', '2026-09-11T20:00:00Z', 7],
    ['already past', '2026-09-20T20:00:00Z', -2],
  ])('%s', (_name, at, expected) => {
    expect(daysUntil(FRIDAY_730PM, now(at), CHICAGO)).toBe(expected)
  })
})

describe('relativeDay', () => {
  it.each([
    ['tonight', FRIDAY_730PM, '2026-09-18T15:00:00Z', 'Tonight'],
    ['today for a matinee', '2026-09-18T18:00:00Z', '2026-09-18T14:00:00Z', 'Today'],
    ['tomorrow', FRIDAY_730PM, '2026-09-17T15:00:00Z', 'Tomorrow'],
    ['no label further out', FRIDAY_730PM, '2026-09-15T15:00:00Z', null],
  ])('%s', (_name, iso, at, expected) => {
    expect(relativeDay(iso, now(at), CHICAGO)).toBe(expected)
  })
})

describe('formatting a screening', () => {
  it('reads the date and time in the viewer’s zone', () => {
    expect(screeningDate(FRIDAY_730PM, CHICAGO)).toBe('Friday, September 18')
    expect(screeningTime(FRIDAY_730PM, CHICAGO)).toBe('7:30 PM')
  })

  it.each([
    ['uses a relative day when close', '2026-09-18T15:00:00Z', 'Tonight · 7:30 PM'],
    ['uses the date further out', '2026-09-14T15:00:00Z', 'Friday, September 18 · 7:30 PM'],
  ])('%s', (_name, at, expected) => {
    expect(screeningWhen(FRIDAY_730PM, now(at), CHICAGO)).toBe(expected)
  })

  it('prints a short board date', () => {
    expect(boardDate(FRIDAY_730PM, CHICAGO)).toBe('FRI SEP 18')
  })

  it('prints a day and month', () => {
    expect(dayMonth(FRIDAY_730PM, CHICAGO)).toBe('Sep 18')
  })
})

describe('datetime-local inputs', () => {
  it('round-trips through the local field', () => {
    const iso = new Date(2026, 8, 18, 19, 30).toISOString()
    expect(toLocalInput(iso)).toBe('2026-09-18T19:30')
    expect(fromLocalInput(toLocalInput(iso))).toBe(iso)
  })

  it.each([
    ['', null],
    ['tomorrow', null],
    ['2026-09-18', null],
    ['2026-13-40T99:99', null],
  ])('rejects %j', (value, expected) => {
    expect(fromLocalInput(value)).toBe(expected)
  })
})
