import type { Film } from './films'
import type { AdminPoll, AdminSuggestion, PollOption, PollStatus } from './types'

export const POLL_LIMITS = { question: 200, minOptions: 2, maxOptions: 6 } as const
export const YEAR_RANGE = { min: 1880, max: 2100 } as const

export interface OptionDraft {
  key: string
  itemId: string | null
  title: string
  year: number | null
  suggestionId: number | null
}

export interface PollDraft {
  question: string
  options: OptionDraft[]
}

export function emptyPoll(): PollDraft {
  return { question: '', options: [] }
}

export function optionFromFilm(film: Film): OptionDraft {
  return {
    key: `item:${film.itemId}`,
    itemId: film.itemId,
    title: film.title,
    year: film.year,
    suggestionId: null,
  }
}

export function optionFromSuggestion(suggestion: AdminSuggestion): OptionDraft {
  const key =
    suggestion.itemId === null
      ? typedKey(suggestion.title, suggestion.year)
      : `item:${suggestion.itemId}`
  return {
    key,
    itemId: suggestion.itemId,
    title: suggestion.title,
    year: suggestion.year,
    suggestionId: suggestion.id,
  }
}

function typedKey(title: string, year: number | null): string {
  return `typed:${title.trim().toLocaleLowerCase()}|${year ?? ''}`
}

function typedYear(year: string): number | null {
  const text = year.trim()
  const value = Number(text)
  const valid = /^\d{4}$/.test(text) && value >= YEAR_RANGE.min && value <= YEAR_RANGE.max
  return valid ? value : null
}

export function typedYearProblem(year: string): string | null {
  const blank = year.trim() === ''
  return blank || typedYear(year) !== null ? null : 'Use a four-digit year, or leave it blank.'
}

export function optionFromTyped(title: string, year: string): OptionDraft {
  const parsed = typedYear(year)
  return {
    key: typedKey(title, parsed),
    itemId: null,
    title: title.trim(),
    year: parsed,
    suggestionId: null,
  }
}

export function pollFromAdmin(poll: AdminPoll): PollDraft {
  return {
    question: poll.question,
    options: poll.options.map((option) => ({
      key: option.itemId === null ? typedKey(option.title, option.year) : `item:${option.itemId}`,
      itemId: option.itemId,
      title: option.title,
      year: option.year,
      suggestionId: option.suggestionId,
    })),
  }
}

export function canAdd(draft: PollDraft, option: OptionDraft): boolean {
  const fresh = !draft.options.some((existing) => existing.key === option.key)
  return fresh && option.title !== '' && draft.options.length < POLL_LIMITS.maxOptions
}

export function addOption(draft: PollDraft, option: OptionDraft): PollDraft {
  return canAdd(draft, option) ? { ...draft, options: [...draft.options, option] } : draft
}

export function removeOption(draft: PollDraft, key: string): PollDraft {
  return { ...draft, options: draft.options.filter((option) => option.key !== key) }
}

export type PollField = 'question' | 'options'

export function pollProblems(draft: PollDraft): Partial<Record<PollField, string>> {
  const question = draft.question.trim()
  const checks: [PollField, boolean, string][] = [
    ['question', question === '', 'Ask the club a question.'],
    ['question', question.length > POLL_LIMITS.question, 'Keep the question short.'],
    ['options', draft.options.length < POLL_LIMITS.minOptions, 'Add at least two options.'],
  ]
  return Object.fromEntries(
    checks
      .filter(([, failed]) => failed)
      .reverse()
      .map(([field, , text]) => [field, text]),
  )
}

export interface PollPayload {
  question: string
  options: {
    item_id: string | null
    title: string
    year: number | null
    suggestion_id: number | null
  }[]
}

export function pollPayload(draft: PollDraft): PollPayload {
  return {
    question: draft.question.trim(),
    options: draft.options.map((option) => ({
      item_id: option.itemId,
      title: option.itemId === null ? option.title : '',
      year: option.itemId === null ? option.year : null,
      suggestion_id: option.suggestionId,
    })),
  }
}

export interface Tally<T extends PollOption> {
  option: T
  votes: number
  percent: number
  leading: boolean
}

export function tally<T extends PollOption>(options: readonly T[]): Tally<T>[] {
  const votes = options.map((option) => option.votes ?? 0)
  const total = votes.reduce((sum, count) => sum + count, 0)
  const top = Math.max(0, ...votes)
  return options.map((option, i) => ({
    option,
    votes: votes[i] ?? 0,
    percent: total === 0 ? 0 : Math.round(((votes[i] ?? 0) / total) * 100),
    leading: top > 0 && votes[i] === top,
  }))
}

export type PollAction = 'edit' | 'open' | 'close' | 'reopen' | 'delete'

const ACTIONS: Record<PollStatus, PollAction[]> = {
  draft: ['edit', 'open', 'delete'],
  open: ['close', 'delete'],
  closed: ['reopen', 'delete'],
}

export function waitingOnOpenPoll(status: PollStatus, anotherOpen: boolean): boolean {
  return anotherOpen && status !== 'open'
}

export function pollActions(status: PollStatus, anotherOpen: boolean): PollAction[] {
  return ACTIONS[status].filter(
    (action) => !(anotherOpen && (action === 'open' || action === 'reopen')),
  )
}
