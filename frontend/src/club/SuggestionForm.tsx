import './club.css'
import { type FormEvent, useState } from 'react'
import { Field, failureText } from './Field'
import { FilmFields } from './FilmPicker'
import { sendSuggestion } from './members'
import { useClubSession } from './session'
import {
  clearFilm,
  emptySuggestion,
  type SuggestionDraft,
  suggestFilm,
  suggestionPayload,
  suggestionProblems,
} from './suggestion'

interface Props {
  onDone?: () => void
}

function Thanks({
  title,
  onAnother,
  onDone,
}: {
  title: string
  onAnother: () => void
  onDone?: () => void
}) {
  return (
    <div className="answered" role="status">
      <p className="answered__title">It’s in the box</p>
      <p className="answered__detail">Thanks for suggesting {title}. The hosts read every one.</p>
      <div className="account__actions">
        <button type="button" className="button button--ghost" onClick={onAnother}>
          Suggest another
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

export function SuggestionForm({ onDone }: Props) {
  const session = useClubSession((state) => state.session)
  const signedIn = session.name !== null
  const [draft, setDraft] = useState<SuggestionDraft>(emptySuggestion)
  const [checked, setChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [sent, setSent] = useState<string | null>(null)
  const problems = suggestionProblems(draft, signedIn)
  const shown = checked ? problems : {}
  const set = (patch: Partial<SuggestionDraft>) => setDraft((current) => ({ ...current, ...patch }))

  const send = async () => {
    setBusy(true)
    setFailure(null)
    try {
      setSent((await sendSuggestion(suggestionPayload(draft))).title)
    } catch (error) {
      setFailure(failureText(error, 'send your suggestion'))
    } finally {
      setBusy(false)
    }
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setChecked(true)
    return Object.keys(problems).length === 0 && !busy ? send() : undefined
  }

  const another = () => {
    setDraft((current) => ({ ...emptySuggestion(), name: current.name }))
    setChecked(false)
    setSent(null)
  }

  return sent !== null ? (
    <Thanks title={sent} onAnother={another} onDone={onDone} />
  ) : (
    <form className="club-form" onSubmit={submit} noValidate>
      <FilmFields
        itemId={draft.itemId}
        title={draft.title}
        year={draft.year}
        problems={shown}
        onPick={(film) => setDraft((current) => suggestFilm(current, film))}
        onClear={() => setDraft(clearFilm)}
        onTyped={set}
      />
      {signedIn ? (
        <p className="club-form__hint">Suggesting as {session.name}.</p>
      ) : (
        <Field label="Your name" problem={shown.name}>
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
      )}
      <Field label="Why this one?" hint="Optional, but it helps us pick." problem={shown.note}>
        {(id) => (
          <textarea
            id={id}
            className="field__input"
            rows={3}
            value={draft.note}
            onChange={(e) => set({ note: e.target.value })}
          />
        )}
      </Field>
      {failure === null ? null : (
        <p className="club-form__problem" role="alert">
          {failure}
        </p>
      )}
      <button type="submit" className="button club-form__submit" disabled={busy}>
        {busy ? 'Sending…' : 'Drop it in the box'}
      </button>
    </form>
  )
}
