import type { Film } from './films'
import { fromLocalInput, toLocalInput } from './format'
import type { AdminScreening, Screening, ScreeningStatus } from './types'

export interface Draft {
  itemId: string | null
  title: string
  year: string
  runtimeMin: number | null
  posterUrl: string | null
  artUrl: string
  message: string
  description: string
  autoDescription: boolean
  startsAt: string
  location: string
  status: ScreeningStatus
}

export type DraftField =
  | 'film'
  | 'startsAt'
  | 'year'
  | 'artUrl'
  | 'message'
  | 'description'
  | 'location'
export type DraftProblems = Partial<Record<DraftField, string>>

export const LIMITS = { title: 200, message: 600, description: 3000, location: 200 } as const
const SHOWING_FOR_MS = 4 * 3600 * 1000
const YEAR = /^\d{4}$/

export function emptyDraft(): Draft {
  return {
    itemId: null,
    title: '',
    year: '',
    runtimeMin: null,
    posterUrl: null,
    artUrl: '',
    message: '',
    description: '',
    autoDescription: true,
    startsAt: '',
    location: '',
    status: 'published',
  }
}

export function withFilm(draft: Draft, film: Film): Draft {
  const replace = draft.autoDescription || draft.description.trim() === ''
  return {
    ...draft,
    itemId: film.itemId,
    title: film.title,
    year: film.year === null ? '' : String(film.year),
    runtimeMin: film.runtimeMin,
    posterUrl: null,
    artUrl: '',
    description: replace ? (film.overview ?? '') : draft.description,
    autoDescription: replace,
  }
}

export function withoutFilm(draft: Draft): Draft {
  return {
    ...draft,
    itemId: null,
    title: '',
    year: '',
    runtimeMin: null,
    posterUrl: null,
    description: draft.autoDescription ? '' : draft.description,
  }
}

export function draftFromScreening(screening: AdminScreening): Draft {
  return {
    itemId: screening.itemId,
    title: screening.title,
    year: screening.year === null ? '' : String(screening.year),
    runtimeMin: screening.runtimeMin,
    posterUrl: screening.posterUrl,
    artUrl: screening.artUrl ?? '',
    message: screening.message ?? '',
    description: screening.description ?? '',
    autoDescription: false,
    startsAt: toLocalInput(screening.startsAt),
    location: screening.location ?? '',
    status: screening.status,
  }
}

function yearProblem(year: string): string | null {
  const value = Number(year)
  const valid = year === '' || (YEAR.test(year) && value >= 1880 && value <= 2100)
  return valid ? null : 'Use a four-digit year.'
}

export function draftProblems(draft: Draft): DraftProblems {
  const checks: [DraftField, boolean, string][] = [
    ['film', draft.itemId === null && draft.title.trim() === '', 'Pick a film or type a title.'],
    ['film', draft.title.trim().length > LIMITS.title, 'That title is too long.'],
    ['startsAt', fromLocalInput(draft.startsAt) === null, 'Choose a date and time.'],
    ['year', yearProblem(draft.year) !== null, yearProblem(draft.year) ?? ''],
    [
      'artUrl',
      draft.artUrl !== '' && !/^https?:\/\/\S+$/.test(draft.artUrl.trim()),
      'Paste a web address starting with http.',
    ],
    [
      'message',
      draft.message.length > LIMITS.message,
      `Keep the message under ${LIMITS.message} characters.`,
    ],
    [
      'description',
      draft.description.length > LIMITS.description,
      `Keep the description under ${LIMITS.description} characters.`,
    ],
    ['location', draft.location.length > LIMITS.location, 'That location is too long.'],
  ]
  return Object.fromEntries(
    checks
      .filter(([, failed]) => failed)
      .reverse()
      .map(([field, , text]) => [field, text]),
  )
}

export interface ScreeningPayload {
  item_id: string | null
  title: string
  year: number | null
  art_url: string | null
  message: string
  description: string
  starts_at: string
  location: string
  status: ScreeningStatus
}

export function draftPayload(draft: Draft): ScreeningPayload {
  const library = draft.itemId !== null
  return {
    item_id: draft.itemId,
    title: library ? '' : draft.title.trim(),
    year: library || draft.year === '' ? null : Number(draft.year),
    art_url: library || draft.artUrl.trim() === '' ? null : draft.artUrl.trim(),
    message: draft.message.trim(),
    description: draft.description.trim(),
    starts_at: fromLocalInput(draft.startsAt) ?? '',
    location: draft.location.trim(),
    status: draft.status,
  }
}

export function isUpcoming(startsAt: string, now: Date): boolean {
  return new Date(startsAt).getTime() >= now.getTime() - SHOWING_FOR_MS
}

export function adminOrder(screenings: readonly AdminScreening[], now: Date): AdminScreening[] {
  const time = (s: AdminScreening) => new Date(s.startsAt).getTime()
  const upcoming = screenings.filter((s) => isUpcoming(s.startsAt, now))
  const past = screenings.filter((s) => !isUpcoming(s.startsAt, now))
  return [...upcoming.sort((a, b) => time(a) - time(b)), ...past.sort((a, b) => time(b) - time(a))]
}

type FilmFacts = Pick<Screening, 'title' | 'year' | 'posterUrl' | 'itemId' | 'runtimeMin'>

function draftFacts(draft: Draft): FilmFacts {
  return {
    title: draft.title.trim(),
    year: Number(draft.year) || null,
    posterUrl: draft.itemId ? draft.posterUrl : draft.artUrl.trim() || null,
    itemId: draft.itemId,
    runtimeMin: draft.runtimeMin,
  }
}

const orNull = (text: string) => text.trim() || null

export function draftPreview(draft: Draft): Screening | null {
  const facts = draftFacts(draft)
  const startsAt = fromLocalInput(draft.startsAt)
  return startsAt === null || facts.title === ''
    ? null
    : {
        id: 0,
        ...facts,
        startsAt,
        location: orNull(draft.location),
        message: orNull(draft.message),
        description: orNull(draft.description),
        thumbUrl: null,
        trailerUrl: null,
      }
}
