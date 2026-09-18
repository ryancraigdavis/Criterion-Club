import { describe, expect, it } from 'vitest'
import { bestMatches, type Film, matchTier, parseQuery, searchable } from './films'

const film = (title: string, itemId = title): Film => ({
  itemId,
  title,
  year: null,
  overview: null,
  runtimeMin: null,
  thumbUrl: null,
})

describe('parseQuery', () => {
  it.each([
    ['plain words', 'there will be', { term: 'there will be', exact: false }],
    ['a quoted title', '"M"', { term: 'M', exact: true }],
    ['a quote still being typed', '"M', { term: 'M', exact: true }],
    ['curly quotes', '“Ran”', { term: 'Ran', exact: true }],
    ['an apostrophe title', "'Round Midnight", { term: "'Round Midnight", exact: false }],
    ['nothing', '   ', { term: '', exact: false }],
  ] as const)('%s', (_name, query, expected) => {
    expect(parseQuery(query)).toEqual(expected)
  })
})

describe('searchable', () => {
  it.each([
    ['one letter', 'M', false],
    ['two letters', 'Ma', true],
    ['one quoted letter', '"M"', true],
    ['an open quote alone', '"', false],
    ['empty quotes', '""', false],
  ] as const)('%s', (_name, query, expected) => {
    expect(searchable(query)).toBe(expected)
  })
})

describe('bestMatches', () => {
  it('puts exact, then prefix, then substring matches first', () => {
    const films = ['Bean', 'There Will Be Blood', 'Where There Will Be'].map((t) => film(t))
    expect(bestMatches(films, 'there will be').map((f) => f.title)).toEqual([
      'There Will Be Blood',
      'Where There Will Be',
      'Bean',
    ])
  })

  it('ranks by the title inside the quotes', () => {
    const films = [film('M*A*S*H'), film('M')]
    expect(bestMatches(films, '"M"').map((f) => f.title)).toEqual(['M', 'M*A*S*H'])
  })

  it('ignores accents when matching', () => {
    expect(matchTier('Cléo from 5 to 7', 'cleo')).toBe(1)
  })
})
