import { type FormEvent, type ReactNode, useEffect, useState } from 'react'
import { Choice, Field } from '../Field'
import { FilmSearch } from '../FilmPicker'
import { failureText } from '../failure'
import { fetchSuggestions } from '../members'
import {
  addOption,
  canAdd,
  emptyPoll,
  type OptionDraft,
  optionFromFilm,
  optionFromSuggestion,
  optionFromTyped,
  POLL_LIMITS,
  type PollDraft,
  pollFromAdmin,
  pollPayload,
  pollProblems,
  removeOption,
  typedYearProblem,
} from '../poll'
import { savePoll } from '../polls'
import type { AdminPoll, AdminSuggestion } from '../types'

type Source = 'suggestions' | 'library' | 'typed'

const SOURCES: { value: Source; label: string }[] = [
  { value: 'suggestions', label: 'From suggestions' },
  { value: 'library', label: 'From the library' },
  { value: 'typed', label: 'Type one in' },
]

interface AddProps {
  draft: PollDraft
  add: (option: OptionDraft) => void
}

function SuggestionPick({ draft, add, suggestion }: AddProps & { suggestion: AdminSuggestion }) {
  const option = optionFromSuggestion(suggestion)
  return (
    <li>
      <button
        type="button"
        className="chip"
        disabled={!canAdd(draft, option)}
        onClick={() => add(option)}
      >
        + {suggestion.title}
        {suggestion.year === null ? '' : ` (${suggestion.year})`}
      </button>
    </li>
  )
}

function FromSuggestions(props: AddProps) {
  const [suggestions, setSuggestions] = useState<AdminSuggestion[]>([])
  useEffect(() => {
    fetchSuggestions().then(
      (all) => setSuggestions(all.filter((s) => s.status !== 'declined')),
      () => setSuggestions([]),
    )
  }, [])
  return suggestions.length === 0 ? (
    <p className="panel__detail">No suggestions to pick from yet.</p>
  ) : (
    <ul className="option-picks">
      {suggestions.map((suggestion) => (
        <SuggestionPick key={suggestion.id} {...props} suggestion={suggestion} />
      ))}
    </ul>
  )
}

function Typed({ draft, add }: AddProps) {
  const [title, setTitle] = useState('')
  const [year, setYear] = useState('')
  const option = optionFromTyped(title, year)
  const yearProblem = typedYearProblem(year) ?? undefined
  const commit = () => {
    add(option)
    setTitle('')
    setYear('')
  }
  return (
    <div className="editor__row editor__row--add">
      <Field label="Title">
        {(id) => (
          <input
            id={id}
            className="field__input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        )}
      </Field>
      <Field label="Year" problem={yearProblem}>
        {(id) => (
          <input
            id={id}
            className="field__input"
            inputMode="numeric"
            value={year}
            onChange={(e) => setYear(e.target.value)}
          />
        )}
      </Field>
      <button
        type="button"
        className="button button--ghost"
        disabled={yearProblem !== undefined || !canAdd(draft, option)}
        onClick={commit}
      >
        Add option
      </button>
    </div>
  )
}

function AddOption(props: AddProps) {
  const [source, setSource] = useState<Source>('suggestions')
  const views: Record<Source, () => ReactNode> = {
    suggestions: () => <FromSuggestions {...props} />,
    library: () => <FilmSearch onPick={(film) => props.add(optionFromFilm(film))} />,
    typed: () => <Typed {...props} />,
  }
  return props.draft.options.length >= POLL_LIMITS.maxOptions ? (
    <p className="club-form__hint">That’s the most options a poll can have.</p>
  ) : (
    <div className="option-add">
      <Choice legend="Add an option" options={SOURCES} value={source} onChange={setSource} />
      {views[source]()}
    </div>
  )
}

function OptionList({ draft, onRemove }: { draft: PollDraft; onRemove: (key: string) => void }) {
  return draft.options.length === 0 ? null : (
    <ol className="option-list">
      {draft.options.map((option) => (
        <li key={option.key} className="option-list__row">
          <span>
            {option.title}
            {option.year === null ? null : <span className="poll__year"> {option.year}</span>}
            {option.suggestionId === null ? null : <span className="tag">Suggested</span>}
          </span>
          <button type="button" className="chip" onClick={() => onRemove(option.key)}>
            Remove
          </button>
        </li>
      ))}
    </ol>
  )
}

function Problem({ text }: { text: string | null | undefined }) {
  return text ? (
    <p className="club-form__problem" role="alert">
      {text}
    </p>
  ) : null
}

interface Props {
  poll: AdminPoll | null
  onDone: () => void
}

export function PollEditor({ poll, onDone }: Props) {
  const [draft, setDraft] = useState<PollDraft>(() => (poll ? pollFromAdmin(poll) : emptyPoll()))
  const [checked, setChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const problems = pollProblems(draft)
  const shown = checked ? problems : {}

  const send = async () => {
    setBusy(true)
    try {
      await savePoll(poll?.id ?? null, pollPayload(draft))
      onDone()
    } catch (error) {
      setFailure(failureText(error, 'save the poll'))
      setBusy(false)
    }
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setChecked(true)
    return Object.keys(problems).length === 0 && !busy ? send() : undefined
  }

  return (
    <form className="editor editor--single" onSubmit={submit} noValidate>
      <div className="editor__fields">
        <h3 className="editor__title">{poll ? 'Edit poll' : 'New poll'}</h3>
        <Field label="Question" problem={shown.question}>
          {(id) => (
            <input
              id={id}
              className="field__input"
              value={draft.question}
              placeholder="What should we watch in October?"
              onChange={(e) => setDraft({ ...draft, question: e.target.value })}
            />
          )}
        </Field>
        <OptionList draft={draft} onRemove={(key) => setDraft(removeOption(draft, key))} />
        <Problem text={shown.options} />
        <AddOption
          draft={draft}
          add={(option) => setDraft((current) => addOption(current, option))}
        />
        <Problem text={failure} />
        <p className="club-form__hint">
          Polls save as drafts. Open one from the list to put it on the club page.
        </p>
        <div className="editor__actions">
          <button type="submit" className="button" disabled={busy}>
            {poll ? 'Save poll' : 'Create poll'}
          </button>
          <button type="button" className="button button--ghost" disabled={busy} onClick={onDone}>
            Cancel
          </button>
        </div>
      </div>
    </form>
  )
}
