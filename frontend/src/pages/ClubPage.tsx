import '../club/club.css'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { AddToCalendar } from '../club/AddToCalendar'
import { FilmPreview } from '../club/FilmPreview'
import { screeningDate, screeningTime } from '../club/format'
import { type ClubLead, clubLead } from '../club/load'
import { Mosaic } from '../club/Mosaic'
import { PollVote } from '../club/PollVote'
import { usePoll } from '../club/polls'
import { RsvpForm } from '../club/RsvpForm'
import { ScreeningCard } from '../club/ScreeningCard'
import { SuggestionForm } from '../club/SuggestionForm'
import { laterScreenings, useScreenings } from '../club/screenings'
import { useSettings } from '../club/settings'
import { youtubeId } from '../club/trailer'
import type { Screening } from '../club/types'
import { Watched } from '../club/Watched'
import { SiteHeader } from '../ui/SiteHeader'

type Panel = { kind: 'rsvp'; screening: Screening } | { kind: 'suggest' } | null

interface Preview {
  screening: Screening
  kicker: string
  playing: boolean
}

function Poster({ screening, onOpen }: { screening: Screening; onOpen: () => void }) {
  return (
    <button
      type="button"
      className="coming-up__poster"
      onClick={onOpen}
      aria-label={`More about ${screening.title}`}
    >
      {screening.thumbUrl === null ? (
        <span className="coming-up__blank" />
      ) : (
        <img
          className="coming-up__thumb"
          src={screening.thumbUrl}
          alt=""
          width={40}
          height={60}
          loading="lazy"
        />
      )}
    </button>
  )
}

function ComingUp({
  screenings,
  onRsvp,
  onPreview,
}: {
  screenings: Screening[]
  onRsvp: (s: Screening) => void
  onPreview: (s: Screening) => void
}) {
  return screenings.length === 0 ? null : (
    <section className="coming-up" aria-labelledby="coming-up-title">
      <h2 id="coming-up-title" className="section-head__title">
        Coming up
      </h2>
      <ol className="coming-up__list">
        {screenings.map((screening) => (
          <li key={screening.id} className="coming-up__row">
            <Poster screening={screening} onOpen={() => onPreview(screening)} />
            <span className="coming-up__date">{screeningDate(screening.startsAt)}</span>
            <button type="button" className="coming-up__film" onClick={() => onPreview(screening)}>
              {screening.title}
              {screening.year === null ? null : (
                <span className="screening__year"> {screening.year}</span>
              )}
            </button>
            <span className="coming-up__time">{screeningTime(screening.startsAt)}</span>
            <button type="button" className="chip" onClick={() => onRsvp(screening)}>
              RSVP
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
}

function PollSection() {
  const poll = usePoll((state) => state.poll)
  return poll === null ? null : (
    <section className="club-poll" aria-labelledby="club-poll-title">
      <h2 id="club-poll-title" className="section-head__title">
        {poll.status === 'open' ? 'Club poll' : 'Poll results'}
      </h2>
      <PollVote poll={poll} />
    </section>
  )
}

function NothingScheduled() {
  return (
    <section className="club-gate">
      <h2 className="club-gate__title">Nothing on the schedule</h2>
      <p className="club-gate__detail">The next screening goes up here as soon as it’s set.</p>
    </section>
  )
}

function LoadFailed() {
  const retry = useScreenings((state) => state.retry)
  return (
    <section className="club-gate" role="alert">
      <h2 className="club-gate__title">Couldn’t reach the club</h2>
      <p className="club-gate__detail">
        The schedule didn’t load. Check your connection and try again.
      </p>
      <button type="button" className="button" onClick={() => void retry()}>
        Try again
      </button>
    </section>
  )
}

function Lead({ lead, next }: { lead: ClubLead; next: Screening | null }) {
  const views: Record<ClubLead, () => ReactNode> = {
    loading: () => <div className="reel club-page__loading" role="status" aria-label="Loading" />,
    failed: () => <LoadFailed />,
    nothing: () => <NothingScheduled />,
    screening: () => (next === null ? null : <ScreeningCard screening={next} />),
  }
  return views[lead]()
}

const PANEL_TITLES = { rsvp: 'RSVP', suggest: 'Suggest a film' } as const

function ClubPanel({ panel, onClose }: { panel: Exclude<Panel, null>; onClose: () => void }) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    ref.current?.focus({ preventScroll: true })
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [])
  return (
    <section ref={ref} className="club-panel" aria-label={PANEL_TITLES[panel.kind]} tabIndex={-1}>
      <header className="sheet__head">
        <h2 className="sheet__title">{PANEL_TITLES[panel.kind]}</h2>
        <button type="button" className="chip" onClick={onClose}>
          Close
        </button>
      </header>
      {panel.kind === 'rsvp' ? (
        <RsvpForm screening={panel.screening} onDone={onClose} />
      ) : (
        <SuggestionForm onDone={onClose} />
      )}
    </section>
  )
}

function Actions({
  next,
  onOpen,
  onTrailer,
}: {
  next: Screening | null
  onOpen: (panel: Panel) => void
  onTrailer: (screening: Screening) => void
}) {
  return (
    <div className="club-actions">
      {next === null ? null : (
        <button
          type="button"
          className="button"
          onClick={() => onOpen({ kind: 'rsvp', screening: next })}
        >
          RSVP
        </button>
      )}
      {next === null || youtubeId(next.trailerUrl) === null ? null : (
        <button type="button" className="button button--ghost" onClick={() => onTrailer(next)}>
          Watch trailer
        </button>
      )}
      <button
        type="button"
        className="button button--ghost"
        onClick={() => onOpen({ kind: 'suggest' })}
      >
        Suggest a film
      </button>
      {next === null ? null : <AddToCalendar screening={next} />}
    </div>
  )
}

function panelKey(panel: Exclude<Panel, null>): string {
  return panel.kind === 'rsvp' ? `rsvp-${panel.screening.id}` : 'suggest'
}

export function ClubPage() {
  const next = useScreenings((state) => state.next)
  const schedule = useScreenings((state) => state.schedule)
  const status = useScreenings((state) => state.status)
  const past = useScreenings((state) => state.past)
  const [panel, setPanel] = useState<Panel>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const later = useMemo(() => laterScreenings(schedule, next), [schedule, next])
  const showLater = useSettings((state) => state.showSchedule)
  const rsvpFromPreview = (screening: Screening) => {
    setPreview(null)
    setPanel({ kind: 'rsvp', screening })
  }
  return (
    <>
      <Mosaic />
      <SiteHeader />
      <main className="club-page">
        <h1 className="visually-hidden">Criterion Club</h1>
        <Lead lead={clubLead(status, next !== null)} next={next} />
        {status === 'ready' ? (
          <Actions
            next={next}
            onOpen={setPanel}
            onTrailer={(screening) =>
              setPreview({ screening, kicker: 'Next screening', playing: true })
            }
          />
        ) : null}
        {panel === null ? null : (
          <ClubPanel key={panelKey(panel)} panel={panel} onClose={() => setPanel(null)} />
        )}
        <PollSection />
        <ComingUp
          screenings={showLater ? later : []}
          onRsvp={(screening) => setPanel({ kind: 'rsvp', screening })}
          onPreview={(screening) => setPreview({ screening, kicker: 'Coming up', playing: false })}
        />
        <Watched screenings={past} />
      </main>
      {preview === null ? null : (
        <FilmPreview
          key={preview.screening.id}
          screening={preview.screening}
          kicker={preview.kicker}
          playing={preview.playing}
          onClose={() => setPreview(null)}
          onRsvp={rsvpFromPreview}
        />
      )}
    </>
  )
}
