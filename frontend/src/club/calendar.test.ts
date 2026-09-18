import { describe, expect, it } from 'vitest'
import { calendarFileUrl, calendarStamp, googleCalendarUrl } from './calendar'
import type { Screening } from './types'

const SAMURAI: Screening = {
  id: 7,
  title: 'Seven Samurai',
  year: 1954,
  startsAt: '2026-09-25T02:00:00+00:00',
  location: 'The basement',
  message: 'Bring a cushion.',
  description: null,
  itemId: '42',
  posterUrl: null,
  runtimeMin: 207,
}

const params = (url: string) => new URL(url).searchParams

describe('calendarStamp', () => {
  it('writes UTC in the compact calendar form', () => {
    expect(calendarStamp(new Date('2026-09-25T02:00:00.000Z'))).toBe('20260925T020000Z')
  })
})

describe('calendarFileUrl', () => {
  it('points at the screening’s .ics', () => {
    expect(calendarFileUrl(7)).toBe('/api/club/screenings/7/calendar.ics')
  })
})

describe('googleCalendarUrl', () => {
  it('fills in the event and ends it after the runtime', () => {
    const query = params(googleCalendarUrl(SAMURAI, 'https://club.example.com'))
    expect(query.get('action')).toBe('TEMPLATE')
    expect(query.get('text')).toBe('Criterion Club: Seven Samurai')
    expect(query.get('dates')).toBe('20260925T020000Z/20260925T052700Z')
    expect(query.get('location')).toBe('The basement')
    expect(query.get('details')).toBe('Bring a cushion.\n\nhttps://club.example.com')
  })

  it('gives a film of unknown length two hours and no place a blank location', () => {
    const query = params(
      googleCalendarUrl({ ...SAMURAI, runtimeMin: null, location: null }, 'https://x.test'),
    )
    expect(query.get('dates')).toBe('20260925T020000Z/20260925T040000Z')
    expect(query.get('location')).toBe('')
  })
})
