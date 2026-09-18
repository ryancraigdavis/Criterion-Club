import { describe, expect, it } from 'vitest'
import {
  confirmation,
  draftFromRsvp,
  emptyRsvp,
  headcount,
  RSVP_LIMITS,
  type RsvpDraft,
  rsvpPayload,
  rsvpProblems,
  rsvpSummary,
} from './rsvp'

const draft = (overrides: Partial<RsvpDraft> = {}): RsvpDraft => ({ ...emptyRsvp(), ...overrides })

describe('rsvpProblems', () => {
  it.each([
    ['a signed-out yes with a name', draft({ answer: 'yes', name: 'Eli' }), false, {}],
    ['a signed-in maybe without a name', draft({ answer: 'maybe' }), true, {}],
    ['no answer yet', draft({ name: 'Eli' }), false, { answer: 'Let us know if you’re coming.' }],
    ['signed out without a name', draft({ answer: 'yes' }), false, { name: 'Tell us your name.' }],
    [
      'too many guests',
      draft({ answer: 'yes', name: 'Eli', guests: '11' }),
      false,
      { guests: `Guests should be a number from 0 to ${RSVP_LIMITS.guests}.` },
    ],
    [
      'guests that are not a number',
      draft({ answer: 'maybe', name: 'Eli', guests: 'two' }),
      false,
      { guests: `Guests should be a number from 0 to ${RSVP_LIMITS.guests}.` },
    ],
    [
      'guests ignored when not coming',
      draft({ answer: 'no', name: 'Eli', guests: 'two' }),
      false,
      {},
    ],
  ] as const)('%s', (_name, value, signedIn, expected) => {
    expect(rsvpProblems(value, signedIn)).toEqual(expected)
  })
})

describe('rsvpPayload', () => {
  it('trims and counts guests', () => {
    expect(
      rsvpPayload(draft({ answer: 'yes', guests: '2', name: ' Eli ', note: ' hi ' }), 7),
    ).toEqual({
      event_id: 7,
      answer: 'yes',
      guests: 2,
      name: 'Eli',
      note: 'hi',
    })
  })

  it('drops guests for a no', () => {
    expect(rsvpPayload(draft({ answer: 'no', guests: '3' }), 7).guests).toBe(0)
  })
})

it('round-trips a saved RSVP', () => {
  const saved = { name: 'Eli', answer: 'maybe' as const, guests: 1, note: null }
  expect(draftFromRsvp(saved)).toEqual({ answer: 'maybe', guests: '1', name: 'Eli', note: '' })
})

describe('confirmation', () => {
  it.each([
    [{ answer: 'yes', guests: 0 }, 'You’re on the list', 'See you there.'],
    [{ answer: 'yes', guests: 2 }, 'You’re on the list', 'Plus 2 guests. See you there.'],
    [{ answer: 'yes', guests: 1 }, 'You’re on the list', 'Plus 1 guest. See you there.'],
    [{ answer: 'maybe', guests: 0 }, 'Marked as a maybe', 'Come back and update it when you know.'],
    [{ answer: 'no', guests: 0 }, 'Sorry you’ll miss it', 'Thanks for letting us know.'],
  ] as const)('%j', (rsvp, title, detail) => {
    expect(confirmation({ name: 'Eli', note: null, ...rsvp })).toEqual({ title, detail })
  })
})

describe('rsvpSummary', () => {
  it.each([
    [{ going: 0, maybe: 0, declined: 0, guests: 0 }, 'No RSVPs yet'],
    [{ going: 4, maybe: 0, declined: 0, guests: 0 }, '4 going'],
    [{ going: 4, maybe: 2, declined: 1, guests: 3 }, '4 going (+3) · 2 maybe · 1 can’t'],
    [{ going: 0, maybe: 0, declined: 2, guests: 0 }, '2 can’t'],
  ])('%j', (totals, expected) => {
    expect(rsvpSummary(totals)).toBe(expected)
  })

  it('counts heads including guests', () => {
    expect(headcount({ going: 4, maybe: 2, declined: 1, guests: 3 })).toBe(7)
  })
})
