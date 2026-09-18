import { embyItemUrl, type SiteInfo } from '../api'
import { watchedOn } from './format'
import { useNow } from './now'
import { useSite } from './site'
import type { PastScreening } from './types'

function Poster({ screening, site }: { screening: PastScreening; site: SiteInfo | null }) {
  const art =
    screening.posterUrl === null ? (
      <span className="watched__blank">{screening.title}</span>
    ) : (
      <img src={screening.posterUrl} alt="" loading="lazy" />
    )
  return screening.itemId !== null && site !== null ? (
    <a
      className="watched__poster"
      href={embyItemUrl(site, screening.itemId)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${screening.title} on Emby`}
    >
      {art}
    </a>
  ) : (
    <span className="watched__poster">{art}</span>
  )
}

export function Watched({ screenings }: { screenings: PastScreening[] }) {
  const site = useSite((state) => state.site)
  const now = useNow()
  return screenings.length === 0 ? null : (
    <section className="watched" aria-labelledby="watched-title">
      <h2 id="watched-title" className="section-head__title">
        What we’ve watched
      </h2>
      <ol className="watched__grid">
        {screenings.map((screening) => (
          <li key={screening.id} className="watched__film">
            <Poster screening={screening} site={site} />
            <p className="watched__title">
              {screening.title}
              {screening.year === null ? null : (
                <span className="screening__year"> {screening.year}</span>
              )}
            </p>
            <p className="watched__date">{watchedOn(screening.startsAt, now)}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
