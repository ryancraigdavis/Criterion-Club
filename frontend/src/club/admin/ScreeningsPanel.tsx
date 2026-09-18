import { useCallback, useEffect, useMemo, useState } from 'react'
import { adminOrder, isUpcoming } from '../draft'
import { screeningDate, screeningTime } from '../format'
import { rsvpSummary } from '../rsvp'
import { fetchAdminScreenings, useScreenings } from '../screenings'
import type { AdminScreening } from '../types'
import { GuestList } from './GuestList'
import { ScreeningEditor } from './ScreeningEditor'

type Editing = AdminScreening | 'new' | null

const STATUS_LABELS = { draft: 'Draft', published: 'Published', cancelled: 'Cancelled' } as const

interface RowProps {
  screening: AdminScreening
  now: Date
  onEdit: () => void
  onChanged: () => void
}

function ScreeningRow({ screening, now, onEdit, onChanged }: RowProps) {
  const [guests, setGuests] = useState(false)
  const past = !isUpcoming(screening.startsAt, now)
  return (
    <li className="slate-item">
      <div className={past ? 'slate slate--past' : 'slate'}>
        <div className="slate__when">
          <span>{screeningDate(screening.startsAt)}</span>
          <span className="slate__time">{screeningTime(screening.startsAt)}</span>
        </div>
        <div className="slate__film">
          <strong>{screening.title}</strong>
          {screening.year === null ? null : <span> {screening.year}</span>}
          <span className="slate__rsvps">{rsvpSummary(screening.rsvps)}</span>
          {screening.artUrl && screening.posterUrl === null ? (
            <span className="slate__warning">Couldn’t load the poster from that address</span>
          ) : null}
        </div>
        <span className={`badge badge--${screening.status}`}>
          {STATUS_LABELS[screening.status]}
        </span>
        <div className="slate__buttons">
          <button
            type="button"
            className="chip"
            aria-pressed={guests}
            onClick={() => setGuests(!guests)}
          >
            Guest list
          </button>
          <button type="button" className="chip" onClick={onEdit}>
            Edit
          </button>
        </div>
      </div>
      {guests ? <GuestList eventId={screening.id} onChanged={onChanged} /> : null}
    </li>
  )
}

function EditorSlot({ editing, onDone }: { editing: Editing; onDone: () => void }) {
  return editing === null ? null : (
    <ScreeningEditor
      key={editing === 'new' ? 'new' : editing.id}
      screening={editing === 'new' ? null : editing}
      onDone={onDone}
    />
  )
}

function Notes({ failure, empty }: { failure: string | null; empty: boolean }) {
  return (
    <>
      {failure === null ? null : <p className="club-form__problem">{failure}</p>}
      {empty ? (
        <p className="panel__detail">
          Nothing scheduled yet. Add the first screening to put it on the front door.
        </p>
      ) : null}
    </>
  )
}

export function ScreeningsPanel() {
  const [screenings, setScreenings] = useState<AdminScreening[] | null>(null)
  const [editing, setEditing] = useState<Editing>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const now = useMemo(() => new Date(), [])

  const load = useCallback(() => {
    fetchAdminScreenings().then(setScreenings, (error: unknown) =>
      setFailure(error instanceof Error ? error.message : String(error)),
    )
  }, [])

  useEffect(load, [load])

  const done = () => {
    setEditing(null)
    load()
    void useScreenings.getState().refresh()
  }

  const ordered = adminOrder(screenings ?? [], now)
  const empty = screenings !== null && ordered.length === 0 && editing === null
  return (
    <section className="dashboard__section" aria-labelledby="screenings-title">
      <header className="section-head">
        <h2 id="screenings-title" className="section-head__title">
          Screenings
        </h2>
        {editing === null ? (
          <button type="button" className="button" onClick={() => setEditing('new')}>
            New screening
          </button>
        ) : null}
      </header>
      <EditorSlot editing={editing} onDone={done} />
      <Notes failure={failure} empty={empty} />
      <ul className="slates">
        {ordered.map((screening) => (
          <ScreeningRow
            key={screening.id}
            screening={screening}
            now={now}
            onEdit={() => setEditing(screening)}
            onChanged={load}
          />
        ))}
      </ul>
    </section>
  )
}
