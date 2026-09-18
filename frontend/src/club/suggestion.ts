import type { Film } from './films'
import type { AdminSuggestion, SuggestionStatus } from './types'

export interface SuggestionDraft {
  itemId: string | null
  title: string
  year: string
  name: string
  note: string
}

export const SUGGESTION_LIMITS = { title: 200, name: 80, note: 500 } as const
const YEAR = /^\d{4}$/

export const SUGGESTION_STATUSES: { value: SuggestionStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'declined', label: 'Passed' },
]

export function emptySuggestion(): SuggestionDraft {
  return { itemId: null, title: '', year: '', name: '', note: '' }
}

export function suggestFilm(draft: SuggestionDraft, film: Film): SuggestionDraft {
  return {
    ...draft,
    itemId: film.itemId,
    title: film.title,
    year: film.year === null ? '' : String(film.year),
  }
}

export function clearFilm(draft: SuggestionDraft): SuggestionDraft {
  return { ...draft, itemId: null, title: '', year: '' }
}

export type SuggestionField = 'film' | 'year' | 'name' | 'note'

function badYear(year: string): boolean {
  const value = Number(year)
  return year !== '' && !(YEAR.test(year) && value >= 1880 && value <= 2100)
}

export function suggestionProblems(
  draft: SuggestionDraft,
  signedIn: boolean,
): Partial<Record<SuggestionField, string>> {
  const checks: [SuggestionField, boolean, string][] = [
    ['film', draft.itemId === null && draft.title.trim() === '', 'Pick a film or type a title.'],
    ['film', draft.title.trim().length > SUGGESTION_LIMITS.title, 'That title is too long.'],
    ['year', draft.itemId === null && badYear(draft.year), 'Use a four-digit year.'],
    ['name', !signedIn && draft.name.trim() === '', 'Tell us your name.'],
    ['name', draft.name.trim().length > SUGGESTION_LIMITS.name, 'That name is too long.'],
    [
      'note',
      draft.note.length > SUGGESTION_LIMITS.note,
      `Keep the note under ${SUGGESTION_LIMITS.note} characters.`,
    ],
  ]
  return Object.fromEntries(
    checks
      .filter(([, failed]) => failed)
      .reverse()
      .map(([field, , text]) => [field, text]),
  )
}

export interface SuggestionPayload {
  item_id: string | null
  title: string
  year: number | null
  name: string
  note: string
}

export function suggestionPayload(draft: SuggestionDraft): SuggestionPayload {
  const library = draft.itemId !== null
  return {
    item_id: draft.itemId,
    title: library ? '' : draft.title.trim(),
    year: library || draft.year === '' ? null : Number(draft.year),
    name: draft.name.trim(),
    note: draft.note.trim(),
  }
}

export type SuggestionFilter = SuggestionStatus | 'all'

export function filterSuggestions(
  suggestions: readonly AdminSuggestion[],
  filter: SuggestionFilter,
): AdminSuggestion[] {
  return suggestions.filter((s) => filter === 'all' || s.status === filter)
}

export function countByStatus(
  suggestions: readonly AdminSuggestion[],
): Record<SuggestionFilter, number> {
  const counts: Record<SuggestionFilter, number> = {
    all: suggestions.length,
    new: 0,
    shortlisted: 0,
    scheduled: 0,
    declined: 0,
  }
  for (const suggestion of suggestions) {
    counts[suggestion.status] += 1
  }
  return counts
}
