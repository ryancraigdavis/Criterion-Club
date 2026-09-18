import { describe, expect, it } from 'vitest'
import { item } from '../test/fixtures'
import {
  adminOrder,
  type Draft,
  draftFromScreening,
  draftPayload,
  draftPreview,
  draftProblems,
  emptyDraft,
  LIMITS,
  withFilm,
  withoutFilm,
} from './draft'
import { toLocalInput } from './format'
import type { AdminScreening } from './types'

const twbb = item('twbb')
const alien = item('alien')
const FRIDAY = new Date(2026, 8, 18, 19, 30).toISOString()

const draft = (overrides: Partial<Draft> = {}): Draft => ({
  ...emptyDraft(),
  startsAt: toLocalInput(FRIDAY),
  ...overrides,
})

const screening = (overrides: Partial<AdminScreening> = {}): AdminScreening => ({
  id: 1,
  title: 'Magnolia',
  year: 1999,
  startsAt: FRIDAY,
  location: 'Living room',
  message: 'Bring frogs',
  description: 'It rains.',
  itemId: null,
  posterUrl: null,
  runtimeMin: null,
  status: 'published',
  artUrl: 'https://img.example/m.jpg',
  updatedAt: FRIDAY,
  rsvps: { going: 0, maybe: 0, declined: 0, guests: 0 },
  ...overrides,
})

describe('picking a film', () => {
  it('fills the title, year and synopsis', () => {
    expect(withFilm(draft(), twbb)).toMatchObject({
      itemId: 'twbb',
      title: 'There Will Be Blood',
      year: '2007',
      description: 'An oilman builds an empire.',
      autoDescription: true,
    })
  })

  it('swaps the synopsis when you change your mind', () => {
    const second = withFilm(withFilm(draft(), twbb), { ...alien, overview: 'In space.' })
    expect(second.description).toBe('In space.')
  })

  it('keeps a description you wrote yourself', () => {
    const written = draft({ description: 'Our pick for the month.', autoDescription: false })
    expect(withFilm(written, twbb).description).toBe('Our pick for the month.')
  })

  it('clears the library film but not your own words', () => {
    expect(withoutFilm(withFilm(draft(), twbb))).toMatchObject({
      itemId: null,
      title: '',
      description: '',
    })
    const written = withFilm(draft({ description: 'Mine', autoDescription: false }), twbb)
    expect(withoutFilm(written).description).toBe('Mine')
  })
})

describe('draftProblems', () => {
  it.each([
    ['a library film', withFilm(draft(), twbb), {}],
    ['a typed title', draft({ title: 'Paris, Texas', year: '1984' }), {}],
    ['no film at all', draft(), { film: 'Pick a film or type a title.' }],
    ['no date', draft({ title: 'X', startsAt: '' }), { startsAt: 'Choose a date and time.' }],
    ['a bad year', draft({ title: 'X', year: '84' }), { year: 'Use a four-digit year.' }],
    ['an ancient year', draft({ title: 'X', year: '1492' }), { year: 'Use a four-digit year.' }],
    [
      'art that is not a web address',
      draft({ title: 'X', artUrl: 'poster.jpg' }),
      { artUrl: 'Paste a web address starting with http.' },
    ],
    [
      'a long message',
      draft({ title: 'X', message: 'x'.repeat(LIMITS.message + 1) }),
      { message: `Keep the message under ${LIMITS.message} characters.` },
    ],
  ])('%s', (_name, value, expected) => {
    expect(draftProblems(value)).toEqual(expected)
  })
})

describe('draftPayload', () => {
  it('sends only the id for a library film', () => {
    const payload = draftPayload(
      withFilm(draft({ artUrl: 'https://x.example/a.jpg', message: ' Snacks ' }), twbb),
    )
    expect(payload).toMatchObject({
      item_id: 'twbb',
      title: '',
      year: null,
      art_url: null,
      message: 'Snacks',
      starts_at: FRIDAY,
    })
  })

  it('sends the typed details for another film', () => {
    const payload = draftPayload(
      draft({ title: ' Paris, Texas ', year: '1984', artUrl: ' https://x.example/p.jpg ' }),
    )
    expect(payload).toMatchObject({
      item_id: null,
      title: 'Paris, Texas',
      year: 1984,
      art_url: 'https://x.example/p.jpg',
    })
  })
})

it('round-trips a saved screening into the editor', () => {
  const back = draftPayload(draftFromScreening(screening()))
  expect(back).toEqual({
    item_id: null,
    title: 'Magnolia',
    year: 1999,
    art_url: 'https://img.example/m.jpg',
    message: 'Bring frogs',
    description: 'It rains.',
    starts_at: FRIDAY,
    location: 'Living room',
    status: 'published',
  })
})

it('lists upcoming screenings soonest first, then the past newest first', () => {
  const now = new Date(2026, 8, 10)
  const at = (month: number, day: number) => new Date(2026, month, day, 19, 30).toISOString()
  const list = [
    screening({ id: 1, startsAt: at(7, 1) }),
    screening({ id: 2, startsAt: at(8, 30) }),
    screening({ id: 3, startsAt: at(8, 12) }),
    screening({ id: 4, startsAt: at(7, 20) }),
  ]
  expect(adminOrder(list, now).map((s) => s.id)).toEqual([3, 2, 4, 1])
})

describe('draftPreview', () => {
  it('shows a library film with what the picker gave it', () => {
    const preview = draftPreview(withFilm(draft({ message: 'Snacks' }), twbb))
    expect(preview).toMatchObject({ title: 'There Will Be Blood', year: 2007, message: 'Snacks' })
    expect(preview).toMatchObject({ itemId: 'twbb', runtimeMin: 158, posterUrl: null })
  })

  it('keeps the saved poster while an existing screening is edited', () => {
    const saved = draft({ itemId: 'twbb', title: 'Blood', posterUrl: '/api/club-art/abc.webp' })
    expect(draftPreview(saved)?.posterUrl).toBe('/api/club-art/abc.webp')
  })

  it('shows typed art for another film', () => {
    const preview = draftPreview(
      draft({ title: 'Paris, Texas', year: '1984', artUrl: 'https://x.example/p.jpg' }),
    )
    expect(preview).toMatchObject({
      title: 'Paris, Texas',
      year: 1984,
      posterUrl: 'https://x.example/p.jpg',
    })
  })

  it('waits for a title and a time', () => {
    expect(draftPreview(draft())).toBeNull()
    expect(draftPreview(draft({ title: 'X', startsAt: '' }))).toBeNull()
  })
})
