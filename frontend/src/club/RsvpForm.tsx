import './club.css'
import { type FormEvent, useEffect, useState } from 'react'
import { Choice, Field } from './Field'
import { failureText } from './failure'
import { screeningWhen } from './format'
import { fetchMyRsvp, sendRsvp } from './members'
import { useNow } from './now'
import {
  ANSWERS,
  confirmation,
  draftFromRsvp,
  emptyRsvp,
  type RsvpDraft,
  type RsvpField,
  rsvpPayload,
  rsvpProblems,
} from './rsvp'
import { useClubSession } from './session'
import type { Rsvp, Screening } from './types'

interface Props {
  screening: Screening
  onDone?: () => void
}

function useMyRsvp(eventId: number, signedIn: boolean): [Rsvp | null, (rsvp: Rsvp | null) => void] {
  const [rsvp, setRsvp] = useState<Rsvp | null>(null)
  useEffect(() => {
    let live = true
    setRsvp(null)
    const load = signedIn ? fetchMyRsvp(eventId) : Promise.resolve(null)
    load.then(
      (found) => live && setRsvp(found),
      () => undefined,
    )
    return () => {
      live = false
    }
  }, [eventId, signedIn])
  return [rsvp, setRsvp]
}

function Answered({
  rsvp,
  onChange,
  onDone,
}: {
  rsvp: Rsvp
  onChange: () => void
  onDone?: () => void
}) {
  const { title, detail } = confirmation(rsvp)
  return (
    <div className="answered" role="status">
      <p className="answered__title">{title}</p>
      <p className="answered__detail">{detail}</p>
      <div className="account__actions">
        <button type="button" className="button button--ghost" onClick={onChange}>
          Change my answer
        </button>
        {onDone ? (
          <button type="button" className="button" onClick={onDone}>
            Done
          </button>
        ) : null}
      </div>
    </div>
  )
}

function Failure({ text }: { text: string | null }) {
  return text === null ? null : (
    <p className="club-form__problem" role="alert">
      {text}
    </p>
  )
}

interface FieldsProps {
  draft: RsvpDraft
  shown: Partial<Record<RsvpField, string>>
  memberName: string | null
  set: (patch: Partial<RsvpDraft>) => void
}

function Guests({ draft, shown, set }: FieldsProps) {
  return draft.answer === 'no' ? null : (
    <Field label="Guests you’re bringing" problem={shown.guests}>
      {(id) => (
        <input
          id={id}
          className="field__input field__input--short"
          type="number"
          min={0}
          max={10}
          inputMode="numeric"
          value={draft.guests}
          onChange={(e) => set({ guests: e.target.value })}
        />
      )}
    </Field>
  )
}

function Name({ draft, shown, memberName, set }: FieldsProps) {
  return memberName !== null ? (
    <p className="club-form__hint">Answering as {memberName}.</p>
  ) : (
    <Field
      label="Your name"
      hint="Answer again with the same name to change your RSVP."
      problem={shown.name}
    >
      {(id) => (
        <input
          id={id}
          className="field__input"
          autoComplete="name"
          value={draft.name}
          onChange={(e) => set({ name: e.target.value })}
        />
      )}
    </Field>
  )
}

function RsvpFields(props: FieldsProps) {
  const { draft, shown, set } = props
  return (
    <>
      <Choice
        legend="Are you coming?"
        options={ANSWERS}
        value={draft.answer}
        problem={shown.answer}
        onChange={(answer) => set({ answer })}
      />
      <Guests {...props} />
      <Name {...props} />
      <Field label="Anything we should know?" problem={shown.note}>
        {(id) => (
          <textarea
            id={id}
            className="field__input"
            rows={2}
            value={draft.note}
            onChange={(e) => set({ note: e.target.value })}
          />
        )}
      </Field>
    </>
  )
}

function ScreeningLine({ screening }: { screening: Screening }) {
  const now = useNow()
  return (
    <p className="rsvp__for">
      <strong>{screening.title}</strong>
      <span>{screeningWhen(screening.startsAt, now)}</span>
    </p>
  )
}

export function RsvpForm({ screening, onDone }: Props) {
  const memberName = useClubSession((state) => state.session.name)
  const [saved, setSaved] = useMyRsvp(screening.id, memberName !== null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<RsvpDraft>(emptyRsvp)
  const [checked, setChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const problems = rsvpProblems(draft, memberName !== null)
  const set = (patch: Partial<RsvpDraft>) => setDraft((current) => ({ ...current, ...patch }))

  const send = async () => {
    setBusy(true)
    setFailure(null)
    try {
      setSaved(await sendRsvp(rsvpPayload(draft, screening.id)))
      setEditing(false)
    } catch (error) {
      setFailure(failureText(error, 'send your RSVP'))
    } finally {
      setBusy(false)
    }
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setChecked(true)
    return Object.keys(problems).length === 0 && !busy ? send() : undefined
  }

  const change = () => {
    setDraft(saved ? draftFromRsvp(saved) : emptyRsvp())
    setEditing(true)
  }

  return saved && !editing ? (
    <>
      <ScreeningLine screening={screening} />
      <Answered rsvp={saved} onChange={change} onDone={onDone} />
    </>
  ) : (
    <form className="club-form" onSubmit={submit} noValidate>
      <ScreeningLine screening={screening} />
      <RsvpFields draft={draft} shown={checked ? problems : {}} memberName={memberName} set={set} />
      <Failure text={failure} />
      <button type="submit" className="button club-form__submit" disabled={busy}>
        {busy ? 'Sending…' : 'Send RSVP'}
      </button>
    </form>
  )
}
