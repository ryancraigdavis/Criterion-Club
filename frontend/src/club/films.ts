import { sendJson } from '../api'
import { API_BASE } from '../config'

export interface Film {
  itemId: string
  title: string
  year: number | null
  overview: string | null
  runtimeMin: number | null
  thumbUrl: string | null
}

interface RawFilm {
  item_id: string
  title: string
  year: number | null
  overview: string | null
  runtime_min: number | null
  thumb_url?: string | null
}

export const MIN_QUERY = 2
export const RESULTS = 8
export const DEBOUNCE_MS = 250

const DIACRITICS = /\p{Diacritic}/gu

export function normalizeTerm(term: string): string {
  return term.normalize('NFD').replace(DIACRITICS, '').toLowerCase()
}

// Only double quotes ask for an exact title: an apostrophe starts real titles ('Round Midnight).
const QUOTES = '"“”«»'

export interface SearchQuery {
  term: string
  exact: boolean
}

const trimQuotes = (text: string) =>
  text.replace(new RegExp(`^[${QUOTES}]+|[${QUOTES}]+$`, 'g'), '').trim()

export function parseQuery(query: string): SearchQuery {
  const text = query.trim()
  return { term: trimQuotes(text), exact: QUOTES.includes(text.charAt(0)) && text !== '' }
}

export function searchable(query: string): boolean {
  const { term, exact } = parseQuery(query)
  return term.length >= (exact ? 1 : MIN_QUERY)
}

const MATCH_TIERS: ((title: string, term: string) => boolean)[] = [
  (title, term) => title === term,
  (title, term) => title.startsWith(term),
  (title, term) => title.includes(term),
]

export function matchTier(title: string, term: string): number {
  const tier = MATCH_TIERS.findIndex((test) => test(normalizeTerm(title), term))
  return tier === -1 ? MATCH_TIERS.length : tier
}

export function bestMatches(films: readonly Film[], query: string): Film[] {
  const term = normalizeTerm(parseQuery(query).term)
  return [...films]
    .sort((a, b) => matchTier(a.title, term) - matchTier(b.title, term))
    .slice(0, RESULTS)
}

export function toFilm(raw: RawFilm): Film {
  return {
    itemId: raw.item_id,
    title: raw.title,
    year: raw.year,
    overview: raw.overview,
    runtimeMin: raw.runtime_min,
    thumbUrl: raw.thumb_url ? `${API_BASE}${raw.thumb_url}` : null,
  }
}

export async function searchFilms(query: string, signal?: AbortSignal): Promise<Film[]> {
  const path = `/api/club/films?q=${encodeURIComponent(query.trim())}`
  const body = await sendJson<{ films: RawFilm[] }>(path, { signal })
  return bestMatches(body.films.map(toFilm), query)
}
