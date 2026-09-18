import { useCallback, useEffect, useState } from 'react'
import { failureText } from '../Field'
import { fetchGuestList, removeRsvp } from '../members'
import { ANSWERS, headcount, rsvpSummary } from '../rsvp'
import type { AdminRsvp, RsvpTotals } from '../types'

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
        {rsvp.signedIn ? (
          <span className="guests__signed" title="Signed in with Emby">
            {' '}
            ✓
          </span>
        ) : null}
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
  const [failure, setFailure] = useState<string | null>(null)

  const load = useCallback(() => {
    fetchGuestList(eventId).then(setLoaded, (error: unknown) =>
      setFailure(failureText(error, 'load the guest list')),
    )
  }, [eventId])

  useEffect(load, [load])

  const remove = (rsvp: AdminRsvp) => {
    const sure = window.confirm(`Remove ${rsvp.name}’s RSVP?`)
    return sure
      ? removeRsvp(rsvp.id).then(() => {
          load()
          onChanged()
        })
      : undefined
  }

  return (
    <div className="guests">
      {failure === null ? null : <p className="club-form__problem">{failure}</p>}
      {loaded === null ? null : <GuestTable loaded={loaded} onRemove={remove} />}
    </div>
  )
}
