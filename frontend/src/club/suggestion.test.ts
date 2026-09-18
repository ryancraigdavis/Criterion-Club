import { describe, expect, it } from 'vitest'
import { item } from '../test/fixtures'
import {
  clearFilm,
  countByStatus,
  emptySuggestion,
  filterSuggestions,
  type SuggestionDraft,
  suggestFilm,
  suggestionPayload,
  suggestionProblems,
} from './suggestion'
import type { AdminSuggestion } from './types'

const draft = (overrides: Partial<SuggestionDraft> = {}): SuggestionDraft => ({
  ...emptySuggestion(),
  ...overrides,
})

describe('suggestionProblems', () => {
  it.each([
    ['a library film', suggestFilm(draft({ name: 'Eli' }), item('twbb')), false, {}],
    ['a typed film', draft({ title: 'Paris, Texas', year: '1984', name: 'Eli' }), false, {}],
    ['signed in without a name', draft({ title: 'Paris, Texas' }), true, {}],
    ['no film', draft({ name: 'Eli' }), false, { film: 'Pick a film or type a title.' }],
    ['no name when signed out', draft({ title: 'X' }), false, { name: 'Tell us your name.' }],
    [
      'a bad year',
      draft({ title: 'X', year: '84', name: 'Eli' }),
      false,
      { year: 'Use a four-digit year.' },
    ],
  ] as const)('%s', (_name, value, signedIn, expected) => {
    expect(suggestionProblems(value, signedIn)).toEqual(expected)
  })
})

describe('suggestionPayload', () => {
  it('sends only the id for a library film', () => {
    expect(suggestionPayload(suggestFilm(draft({ name: ' Eli ' }), item('twbb')))).toEqual({
      item_id: 'twbb',
      title: '',
      year: null,
      name: 'Eli',
      note: '',
    })
  })

  it('sends typed details and forgets them when cleared', () => {
    const typed = draft({ title: ' Paris, Texas ', year: '1984', note: ' Wim! ' })
    expect(suggestionPayload(typed)).toMatchObject({
      item_id: null,
      title: 'Paris, Texas',
      year: 1984,
      note: 'Wim!',
    })
    expect(clearFilm(suggestFilm(typed, item('twbb')))).toMatchObject({
      itemId: null,
      title: '',
      year: '',
    })
  })
})

describe('inbox filters', () => {
  const inbox = (['new', 'new', 'shortlisted', 'declined'] as const).map(
    (status, id): AdminSuggestion => ({
      id,
      itemId: null,
      title: `Film ${id}`,
      year: null,
      name: 'Eli',
      signedIn: false,
      note: null,
      status,
      createdAt: '2026-09-16T00:00:00Z',
      thumbUrl: null,
    }),
  )

  it('counts every status', () => {
    expect(countByStatus(inbox)).toEqual({
      all: 4,
      new: 2,
      shortlisted: 1,
      scheduled: 0,
      declined: 1,
    })
  })

  it.each([
    ['all', [0, 1, 2, 3]],
    ['new', [0, 1]],
    ['scheduled', []],
  ] as const)('filters to %s', (filter, ids) => {
    expect(filterSuggestions(inbox, filter).map((s) => s.id)).toEqual(ids)
  })
})
