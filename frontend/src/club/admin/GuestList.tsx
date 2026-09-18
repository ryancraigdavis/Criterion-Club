import { useCallback, useEffect, useState } from 'react'
import { useFailure } from '../failure'
import { fetchGuestList, removeRsvp } from '../members'
import { ANSWERS, headcount, rsvpSummary } from '../rsvp'
import type { AdminRsvp, RsvpTotals } from '../types'
import { SignedInMark } from './SignedInMark'

const ANSWER_LABELS = Object.fromEntries(ANSWERS.map((answer) => [answer.value, answer.label]))

interface Loaded {
  rsvps: AdminRsvp[]
  totals: RsvpTotals
}

function GuestRow({ rsvp, onRemove }: { rsvp: AdminRsvp; onRemove: (rsvp: AdminRsvp) => void }) {
  return (
    <tr>
      <td>
        {rsvp.name}
        <SignedInMark signedIn={rsvp.signedIn} />
      </td>
      <td>
        <span className={`badge badge--answer-${rsvp.answer}`}>{ANSWER_LABELS[rsvp.answer]}</span>
      </td>
      <td className="guests__count">{rsvp.answer === 'no' ? '' : rsvp.guests}</td>
      <td className="guests__note">{rsvp.note ?? ''}</td>
      <td>
        <button type="button" className="chip" onClick={() => onRemove(rsvp)}>
          Remove
        </button>
      </td>
    </tr>
  )
}

function GuestTable({ loaded, onRemove }: { loaded: Loaded; onRemove: (rsvp: AdminRsvp) => void }) {
  return loaded.rsvps.length === 0 ? (
    <p className="panel__detail">No RSVPs yet.</p>
  ) : (
    <>
      <p className="guests__totals">
        <strong>{headcount(loaded.totals)} expected</strong> · {rsvpSummary(loaded.totals)}
      </p>
      <table className="guests__table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Answer</th>
            <th>Guests</th>
            <th>Note</th>
            <th>
              <span className="visually-hidden">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {loaded.rsvps.map((rsvp) => (
            <GuestRow key={rsvp.id} rsvp={rsvp} onRemove={onRemove} />
          ))}
        </tbody>
      </table>
    </>
  )
}

export function GuestList({ eventId, onChanged }: { eventId: number; onChanged: () => void }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [failure, run] = useFailure()

  const load = useCallback(() => {
    void run(() => fetchGuestList(eventId).then(setLoaded), 'load the guest list')
  }, [eventId, run])

  useEffect(load, [load])

  const removed = (ok: boolean) => (ok ? [load(), onChanged()] : undefined)
  const remove = (rsvp: AdminRsvp) =>
    window.confirm(`Remove ${rsvp.name}’s RSVP?`)
      ? void run(() => removeRsvp(rsvp.id), 'remove the RSVP').then(removed)
      : undefined

  return (
    <div className="guests">
      {failure === null ? null : <p className="club-form__problem">{failure}</p>}
      {loaded === null ? null : <GuestTable loaded={loaded} onRemove={remove} />}
    </div>
  )
}
