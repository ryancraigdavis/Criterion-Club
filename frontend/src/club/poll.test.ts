import { describe, expect, it } from 'vitest'
import { item } from '../test/fixtures'
import {
  addOption,
  canAdd,
  emptyPoll,
  optionFromFilm,
  optionFromSuggestion,
  optionFromTyped,
  POLL_LIMITS,
  type PollDraft,
  pollActions,
  pollFromAdmin,
  pollPayload,
  pollProblems,
  removeOption,
  tally,
  typedYearProblem,
  waitingOnOpenPoll,
} from './poll'
import type { AdminPoll, AdminSuggestion, PollOption } from './types'

const twbb = optionFromFilm(item('twbb'))
const paris = optionFromTyped(' Paris, Texas ', '1984')

const suggestion: AdminSuggestion = {
  id: 9,
  itemId: null,
  title: 'Paris, Texas',
  year: 1984,
  name: 'Eli',
  signedIn: false,
  note: null,
  status: 'new',
  createdAt: '2026-09-16T00:00:00Z',
  thumbUrl: null,
}

describe('building options', () => {
  it('keys films, typed titles and suggestions so duplicates are caught', () => {
    expect(twbb).toMatchObject({ key: 'item:twbb', itemId: 'twbb', title: 'There Will Be Blood' })
    expect(paris).toMatchObject({
      key: 'typed:paris, texas|1984',
      title: 'Paris, Texas',
      year: 1984,
    })
    expect(optionFromSuggestion(suggestion)).toMatchObject({ key: paris.key, suggestionId: 9 })
  })

  it.each([
    ['two digits', '84'],
    ['too early', '1492'],
    ['too late', '2400'],
  ])('ignores a year that is %s', (_name, year) => {
    expect(optionFromTyped('Paris', year).year).toBeNull()
  })

  it('refuses duplicates, blanks and a seventh option', () => {
    const draft = addOption(addOption(emptyPoll(), twbb), paris)
    expect(draft.options).toHaveLength(2)
    expect(canAdd(draft, optionFromSuggestion(suggestion))).toBe(false)
    expect(canAdd(draft, optionFromTyped('  ', ''))).toBe(false)
    const full: PollDraft = {
      question: 'Q',
      options: Array.from({ length: POLL_LIMITS.maxOptions }, (_, i) =>
        optionFromTyped(`Film ${i}`, ''),
      ),
    }
    expect(addOption(full, twbb)).toBe(full)
  })

  it('removes by key', () => {
    const draft = removeOption(addOption(addOption(emptyPoll(), twbb), paris), twbb.key)
    expect(draft.options.map((option) => option.title)).toEqual(['Paris, Texas'])
  })
})

describe('pollProblems', () => {
  it.each([
    ['ready', { question: 'Next month?', options: [twbb, paris] }, {}],
    [
      'no question',
      { question: '  ', options: [twbb, paris] },
      { question: 'Ask the club a question.' },
    ],
    ['one option', { question: 'Q', options: [twbb] }, { options: 'Add at least two options.' }],
  ])('%s', (_name, draft, expected) => {
    expect(pollProblems(draft)).toEqual(expected)
  })
})

it('sends library options by id and typed ones by title', () => {
  expect(
    pollPayload({ question: ' Next? ', options: [twbb, { ...paris, suggestionId: 9 }] }),
  ).toEqual({
    question: 'Next?',
    options: [
      { item_id: 'twbb', title: '', year: null, suggestion_id: null },
      { item_id: null, title: 'Paris, Texas', year: 1984, suggestion_id: 9 },
    ],
  })
})

it('reloads a saved poll into the editor', () => {
  const saved: AdminPoll = {
    id: 1,
    question: 'Next?',
    status: 'draft',
    closedAt: null,
    createdAt: 't',
    totalVotes: 0,
    options: [
      {
        id: 1,
        itemId: 'twbb',
        title: 'There Will Be Blood',
        year: 2007,
        thumbUrl: null,
        votes: 0,
        suggestionId: null,
        voters: [],
      },
      {
        id: 2,
        itemId: null,
        title: 'Paris, Texas',
        year: 1984,
        thumbUrl: null,
        votes: 0,
        suggestionId: 9,
        voters: [],
      },
    ],
  }
  expect(pollFromAdmin(saved).options.map((option) => option.key)).toEqual([twbb.key, paris.key])
})

describe('tally', () => {
  const option = (id: number, votes: number | null): PollOption => ({
    id,
    itemId: null,
    title: `F${id}`,
    year: null,
    thumbUrl: null,
    votes,
  })

  it('works out shares and the leader', () => {
    expect(
      tally([option(1, 3), option(2, 1), option(3, 0)]).map(({ percent, leading }) => [
        percent,
        leading,
      ]),
    ).toEqual([
      [75, true],
      [25, false],
      [0, false],
    ])
  })

  it('marks every tied leader and nobody when there are no votes', () => {
    expect(tally([option(1, 2), option(2, 2)]).map((row) => row.leading)).toEqual([true, true])
    expect(
      tally([option(1, null), option(2, null)]).map((row) => [row.percent, row.leading]),
    ).toEqual([
      [0, false],
      [0, false],
    ])
  })
})

describe('pollActions', () => {
  it.each([
    ['draft', false, ['edit', 'open', 'delete']],
    ['draft', true, ['edit', 'delete']],
    ['open', false, ['close', 'delete']],
    ['closed', false, ['reopen', 'delete']],
    ['closed', true, ['delete']],
  ] as const)('%s with another open: %s', (status, anotherOpen, expected) => {
    expect(pollActions(status, anotherOpen)).toEqual(expected)
  })
})

describe('typedYearProblem', () => {
  it.each([
    ['blank', '', null],
    ['padded', ' 1984 ', null],
    ['two digits', '84', 'Use a four-digit year, or leave it blank.'],
    ['words', 'soon', 'Use a four-digit year, or leave it blank.'],
    ['out of range', '1492', 'Use a four-digit year, or leave it blank.'],
  ] as const)('%s', (_name, year, expected) => {
    expect(typedYearProblem(year)).toBe(expected)
  })
})

describe('waitingOnOpenPoll', () => {
  it.each([
    ['a draft behind an open poll', 'draft', true, true],
    ['a closed poll behind an open poll', 'closed', true, true],
    ['the open poll itself', 'open', true, false],
    ['a draft with nothing open', 'draft', false, false],
  ] as const)('%s', (_name, status, anotherOpen, expected) => {
    expect(waitingOnOpenPoll(status, anotherOpen)).toBe(expected)
  })
})
