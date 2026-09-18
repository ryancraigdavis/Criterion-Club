import type { Film } from '../club/films'

const FILMS: Record<string, Film> = {
  twbb: {
    itemId: 'twbb',
    title: 'There Will Be Blood',
    year: 2007,
    overview: 'An oilman builds an empire.',
    runtimeMin: 158,
    thumbUrl: null,
  },
  alien: {
    itemId: 'alien',
    title: 'Alien',
    year: 1979,
    overview: 'A crew answers a distress call.',
    runtimeMin: 117,
    thumbUrl: null,
  },
}

export function item(id: string): Film {
  const found = FILMS[id]
  if (!found) {
    throw new Error(`fixture ${id} missing`)
  }
  return found
}
