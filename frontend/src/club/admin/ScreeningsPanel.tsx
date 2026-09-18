import { useCallback, useEffect, useState } from 'react'
import { adminOrder, isUpcoming } from '../draft'
import { useFailure } from '../failure'
import { screeningDate, screeningTime } from '../format'
import { useNow } from '../now'
import { refreshNote, refreshScreening } from '../refresh'
import { rsvpSummary } from '../rsvp'
import { fetchAdminScreenings, useScreenings } from '../screenings'
import { saveShowSchedule, useSettings } from '../settings'
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

interface RefreshProps {
  screening: AdminScreening
  onNote: (note: string | null) => void
  onChanged: () => void
}

function RefreshButton({ screening, onNote, onChanged }: RefreshProps) {
  const [busy, setBusy] = useState(false)
  const [failure, run] = useFailure()
  const refresh = () => {
    setBusy(true)
    onNote(null)
    void run(
      () => refreshScreening(screening.id).then((result) => onNote(refreshNote(result.changed))),
      'refresh from Emby',
    )
      .then((ok) => (ok ? onChanged() : undefined))
      .finally(() => setBusy(false))
  }
  useEffect(() => (failure === null ? undefined : onNote(failure)), [failure, onNote])
  return screening.itemId === null ? null : (
    <button type="button" className="chip" disabled={busy} onClick={refresh}>
      {busy ? 'Refreshing…' : 'Refresh'}
    </button>
  )
}

function ScreeningRow({ screening, now, onEdit, onChanged }: RowProps) {
  const [guests, setGuests] = useState(false)
  const [note, setNote] = useState<string | null>(null)
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
          <span className="slate__note" role="status">
            {note ?? ''}
          </span>
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
          <RefreshButton screening={screening} onNote={setNote} onChanged={onChanged} />
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
          Nothing scheduled yet. Add the first screening to put it on the club page.
        </p>
      ) : null}
    </>
  )
}

function ScheduleSwitch() {
  const show = useSettings((state) => state.showSchedule)
  const [busy, setBusy] = useState(false)
  const [failure, run] = useFailure()
  const toggle = () => {
    setBusy(true)
    void run(() => saveShowSchedule(!show), 'change the setting').finally(() => setBusy(false))
  }
  return (
    <div className="switch-row">
      <label className="switch">
        <input type="checkbox" checked={show} disabled={busy} onChange={toggle} />
        <span>List the screenings after the next one on the club page</span>
      </label>
      {failure === null ? null : <p className="club-form__problem">{failure}</p>}
    </div>
  )
}

export function ScreeningsPanel() {
  const [screenings, setScreenings] = useState<AdminScreening[] | null>(null)
  const [editing, setEditing] = useState<Editing>(null)
  const [failure, run] = useFailure()
  const now = useNow()

  const load = useCallback(() => {
    void run(() => fetchAdminScreenings().then(setScreenings), 'load the screenings')
  }, [run])

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
      <ScheduleSwitch />
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
