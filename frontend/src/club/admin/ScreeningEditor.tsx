import { type FormEvent, useState } from 'react'
import {
  type Draft,
  draftFromScreening,
  draftPayload,
  draftPreview,
  draftProblems,
  emptyDraft,
  withFilm,
  withoutFilm,
} from '../draft'
import { Choice, Field, failureText } from '../Field'
import { FilmFields } from '../FilmPicker'
import { ScreeningCard } from '../ScreeningCard'
import { deleteScreening, saveScreening } from '../screenings'
import type { AdminScreening, ScreeningStatus } from '../types'

const STATUSES: { value: ScreeningStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'cancelled', label: 'Cancelled' },
]

interface Props {
  screening: AdminScreening | null
  onDone: () => void
}

export function ScreeningEditor({ screening, onDone }: Props) {
  const [draft, setDraft] = useState<Draft>(() =>
    screening ? draftFromScreening(screening) : emptyDraft(),
  )
  const [checked, setChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const problems = draftProblems(draft)
  const shown = checked ? problems : {}
  const preview = draftPreview(draft)
  const set = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }))

  const run = async (work: () => Promise<unknown>) => {
    setBusy(true)
    setFailure(null)
    try {
      await work()
      onDone()
    } catch (error) {
      setFailure(failureText(error, 'save that screening'))
      setBusy(false)
    }
  }

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setChecked(true)
    const ready = Object.keys(problems).length === 0 && !busy
    return ready ? run(() => saveScreening(screening?.id ?? null, draftPayload(draft))) : undefined
  }

  const remove = () => {
    const sure =
      screening !== null && window.confirm(`Delete “${screening.title}”? This can’t be undone.`)
    return sure ? run(() => deleteScreening(screening.id)) : undefined
  }

  return (
    <form className="editor" onSubmit={save} noValidate>
      <div className="editor__fields">
        <h3 className="editor__title">{screening ? 'Edit screening' : 'New screening'}</h3>
        <FilmFields
          itemId={draft.itemId}
          title={draft.title}
          year={draft.year}
          problems={shown}
          onPick={(picked) => setDraft((current) => withFilm(current, picked))}
          onClear={() => setDraft(withoutFilm)}
          onTyped={set}
          extra={
            <Field
              label="Poster image address"
              hint="A link to a poster image. We keep a copy."
              problem={shown.artUrl}
            >
              {(id) => (
                <input
                  id={id}
                  className="field__input"
                  type="url"
                  value={draft.artUrl}
                  placeholder="https://"
                  onChange={(e) => set({ artUrl: e.target.value })}
                />
              )}
            </Field>
          }
        />
        <div className="editor__row">
          <Field label="Date and time" problem={shown.startsAt}>
            {(id) => (
              <input
                id={id}
                className="field__input"
                type="datetime-local"
                value={draft.startsAt}
                onChange={(e) => set({ startsAt: e.target.value })}
              />
            )}
          </Field>
          <Field label="Where" problem={shown.location}>
            {(id) => (
              <input
                id={id}
                className="field__input"
                value={draft.location}
                placeholder="Living room"
                onChange={(e) => set({ location: e.target.value })}
              />
            )}
          </Field>
        </div>
        <Field
          label="Message"
          hint="The note from the hosts, shown above the description."
          problem={shown.message}
        >
          {(id) => (
            <textarea
              id={id}
              className="field__input"
              rows={2}
              value={draft.message}
              onChange={(e) => set({ message: e.target.value })}
            />
          )}
        </Field>
        <Field label="Description" problem={shown.description}>
          {(id) => (
            <textarea
              id={id}
              className="field__input"
              rows={5}
              value={draft.description}
              onChange={(e) => set({ description: e.target.value, autoDescription: false })}
            />
          )}
        </Field>
        <Choice
          legend="Status"
          options={STATUSES}
          value={draft.status}
          onChange={(status) => set({ status })}
        />
        {failure === null ? null : (
          <p className="club-form__problem" role="alert">
            {failure}
          </p>
        )}
        <div className="editor__actions">
          <button type="submit" className="button" disabled={busy}>
            {screening ? 'Save changes' : 'Add screening'}
          </button>
          <button type="button" className="button button--ghost" disabled={busy} onClick={onDone}>
            Cancel
          </button>
          {screening ? (
            <button
              type="button"
              className="button button--danger"
              disabled={busy}
              onClick={remove}
            >
              Delete
            </button>
          ) : null}
        </div>
      </div>
      <aside className="editor__preview">
        <span className="field__label">What members see</span>
        {preview ? (
          <ScreeningCard screening={preview} compact />
        ) : (
          <p className="panel__detail">Pick a film and a time to preview the card.</p>
        )}
      </aside>
    </form>
  )
}
