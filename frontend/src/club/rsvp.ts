import type { Rsvp, RsvpAnswer, RsvpTotals } from './types'

export interface RsvpDraft {
  answer: RsvpAnswer | null
  guests: string
  name: string
  note: string
}

export const ANSWERS: { value: RsvpAnswer; label: string }[] = [
  { value: 'yes', label: 'I’m in' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'no', label: 'Can’t make it' },
]

export const RSVP_LIMITS = { name: 80, note: 500, guests: 10 } as const
const WHOLE = /^\d+$/

export function emptyRsvp(): RsvpDraft {
  return { answer: null, guests: '0', name: '', note: '' }
}

export function draftFromRsvp(rsvp: Rsvp): RsvpDraft {
  return {
    answer: rsvp.answer,
    guests: String(rsvp.guests),
    name: rsvp.name,
    note: rsvp.note ?? '',
  }
}

export type RsvpField = 'answer' | 'guests' | 'name' | 'note'

export function rsvpProblems(
  draft: RsvpDraft,
  signedIn: boolean,
): Partial<Record<RsvpField, string>> {
  const guests = Number(draft.guests)
  const counting = draft.answer !== 'no'
  const checks: [RsvpField, boolean, string][] = [
    ['answer', draft.answer === null, 'Let us know if you’re coming.'],
    ['name', !signedIn && draft.name.trim() === '', 'Tell us your name.'],
    ['name', draft.name.trim().length > RSVP_LIMITS.name, 'That name is too long.'],
    [
      'guests',
      counting && (!WHOLE.test(draft.guests) || guests > RSVP_LIMITS.guests),
      `Guests should be a number from 0 to ${RSVP_LIMITS.guests}.`,
    ],
    [
      'note',
      draft.note.length > RSVP_LIMITS.note,
      `Keep the note under ${RSVP_LIMITS.note} characters.`,
    ],
  ]
  return Object.fromEntries(
    checks
      .filter(([, failed]) => failed)
      .reverse()
      .map(([field, , text]) => [field, text]),
  )
}

export interface RsvpPayload {
  event_id: number
  answer: RsvpAnswer
  guests: number
  name: string
  note: string
}

export function rsvpPayload(draft: RsvpDraft, eventId: number): RsvpPayload {
  const answer = draft.answer ?? 'yes'
  return {
    event_id: eventId,
    answer,
    guests: answer === 'no' ? 0 : Number(draft.guests) || 0,
    name: draft.name.trim(),
    note: draft.note.trim(),
  }
}

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`

export function confirmation(rsvp: Rsvp): { title: string; detail: string } {
  const lines: Record<RsvpAnswer, { title: string; detail: string }> = {
    yes: {
      title: 'You’re on the list',
      detail:
        rsvp.guests > 0 ? `Plus ${plural(rsvp.guests, 'guest')}. See you there.` : 'See you there.',
    },
    maybe: { title: 'Marked as a maybe', detail: 'Come back and update it when you know.' },
    no: { title: 'Sorry you’ll miss it', detail: 'Thanks for letting us know.' },
  }
  return lines[rsvp.answer]
}

export function rsvpSummary(totals: RsvpTotals): string {
  const going =
    totals.guests > 0 ? `${totals.going} going (+${totals.guests})` : `${totals.going} going`
  const parts = [
    [totals.going + totals.guests > 0, going],
    [totals.maybe > 0, `${totals.maybe} maybe`],
    [totals.declined > 0, `${totals.declined} can’t`],
  ] as const
  const shown = parts.filter(([when]) => when).map(([, text]) => text)
  return shown.length === 0 ? 'No RSVPs yet' : shown.join(' · ')
}

export function headcount(totals: RsvpTotals): number {
  return totals.going + totals.guests
}
