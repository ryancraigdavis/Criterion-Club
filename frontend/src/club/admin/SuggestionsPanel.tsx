import { useCallback, useEffect, useState } from 'react'
import { Choice, failureText } from '../Field'
import { dayMonth } from '../format'
import { fetchSuggestions, markSuggestion, removeSuggestion } from '../members'
import {
  countByStatus,
  filterSuggestions,
  SUGGESTION_STATUSES,
  type SuggestionFilter,
} from '../suggestion'
import type { AdminSuggestion, SuggestionStatus } from '../types'

const FILTERS: { value: SuggestionFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  ...SUGGESTION_STATUSES,
]

function PitchRow({ suggestion, onChange }: { suggestion: AdminSuggestion; onChange: () => void }) {
  const mark = (status: SuggestionStatus) => markSuggestion(suggestion.id, status).then(onChange)
  const remove = () =>
    window.confirm(`Remove the suggestion for ${suggestion.title}?`)
      ? removeSuggestion(suggestion.id).then(onChange)
      : undefined
  const by = `From ${suggestion.name}${suggestion.signedIn ? ' ✓' : ''} · ${dayMonth(suggestion.createdAt)}`
  return (
    <li className="pitch">
      {suggestion.thumbUrl === null ? (
        <span className="film-thumb film-thumb--blank" />
      ) : (
        <img className="film-thumb" src={suggestion.thumbUrl} alt="" loading="lazy" />
      )}
      <div className="pitch__body">
        <p className="pitch__title">
          {suggestion.title}
          {suggestion.year === null ? null : <span> {suggestion.year}</span>}
          {suggestion.itemId === null ? null : <span className="pitch__owned">In the library</span>}
        </p>
        <p className="pitch__by">{by}</p>
        {suggestion.note === null ? null : <p className="pitch__note">{suggestion.note}</p>}
      </div>
      <div className="pitch__actions">
        <Choice
          legend="Status"
          options={SUGGESTION_STATUSES}
          value={suggestion.status}
          onChange={mark}
        />
        <button type="button" className="chip" onClick={remove}>
          Remove
        </button>
      </div>
    </li>
  )
}

export function SuggestionsPanel() {
  const [suggestions, setSuggestions] = useState<AdminSuggestion[] | null>(null)
  const [filter, setFilter] = useState<SuggestionFilter>('all')
  const [failure, setFailure] = useState<string | null>(null)

  const load = useCallback(() => {
    fetchSuggestions().then(setSuggestions, (error: unknown) =>
      setFailure(failureText(error, 'load suggestions')),
    )
  }, [])

  useEffect(load, [load])

  const counts = countByStatus(suggestions ?? [])
  const options = FILTERS.map((option) => ({
    ...option,
    label: `${option.label} ${counts[option.value]}`,
  }))
  const shown = filterSuggestions(suggestions ?? [], filter)
  return (
    <section className="dashboard__section" aria-labelledby="suggestions-title">
      <header className="section-head">
        <h2 id="suggestions-title" className="section-head__title">
          Suggestions
        </h2>
        <Choice legend="Show" options={options} value={filter} onChange={setFilter} />
      </header>
      {failure === null ? null : <p className="club-form__problem">{failure}</p>}
      {suggestions !== null && shown.length === 0 ? (
        <p className="panel__detail">Nothing here yet.</p>
      ) : null}
      <ul className="pitches">
        {shown.map((suggestion) => (
          <PitchRow key={suggestion.id} suggestion={suggestion} onChange={load} />
        ))}
      </ul>
    </section>
  )
}
