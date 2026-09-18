import './club.css'
import { useMemo } from 'react'
import { formatRuntime, relativeDay, screeningWhen } from './format'
import type { Screening } from './types'

interface Props {
  screening: Screening
  kicker?: string
  compact?: boolean
}

export function ScreeningCard({ screening, kicker = 'Next screening', compact = false }: Props) {
  const now = useMemo(() => new Date(), [])
  const soon = relativeDay(screening.startsAt, now)
  const details = [
    screeningWhen(screening.startsAt, now),
    screening.location,
    formatRuntime(screening.runtimeMin),
  ]
  return (
    <article className={compact ? 'screening screening--compact' : 'screening'}>
      <div className="screening__art">
        {screening.posterUrl === null ? (
          <div className="screening__blank">{screening.title}</div>
        ) : (
          <img src={screening.posterUrl} alt="" />
        )}
      </div>
      <div className="screening__body">
        <p className="screening__kicker">
          {kicker}
          {soon === null ? null : <span className="screening__soon">{soon}</span>}
        </p>
        <h2 className="screening__title">
          {screening.title}
          {screening.year === null ? null : (
            <span className="screening__year"> {screening.year}</span>
          )}
        </h2>
        <p className="screening__when">{details.filter(Boolean).join(' · ')}</p>
        {screening.message === null ? null : (
          <p className="screening__message">{screening.message}</p>
        )}
        {screening.description === null ? null : (
          <p className="screening__description">{screening.description}</p>
        )}
      </div>
    </article>
  )
}
