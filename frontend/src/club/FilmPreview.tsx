import { useEffect, useRef, useState } from 'react'
import { AddToCalendar } from './AddToCalendar'
import { ScreeningCard } from './ScreeningCard'
import { trailerEmbed } from './trailer'
import type { Screening } from './types'

interface Props {
  screening: Screening
  kicker: string
  playing: boolean
  onClose: () => void
  onRsvp: (screening: Screening) => void
}

function Trailer({ embed, title }: { embed: string; title: string }) {
  return (
    <div className="film-preview__trailer">
      <iframe
        src={embed}
        title={`${title} — trailer`}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  )
}

export function FilmPreview({ screening, kicker, playing: startPlaying, onClose, onRsvp }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const embed = trailerEmbed(screening.trailerUrl)
  const [playing, setPlaying] = useState(startPlaying && embed !== null)
  useEffect(() => {
    dialog.current?.showModal()
  }, [])
  const closeOnBackdrop = (event: React.MouseEvent<HTMLDialogElement>) =>
    event.target === dialog.current ? dialog.current?.close() : undefined
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape closes a modal <dialog> natively; the click only catches the backdrop.
    <dialog
      ref={dialog}
      className="film-preview"
      aria-label={screening.title}
      onClose={onClose}
      onClick={closeOnBackdrop}
    >
      <div className="film-preview__body">
        <button
          type="button"
          className="chip film-preview__close"
          onClick={() => dialog.current?.close()}
        >
          Close
        </button>
        {playing && embed !== null ? (
          <Trailer embed={embed} title={screening.title} />
        ) : (
          <ScreeningCard screening={screening} kicker={kicker} />
        )}
        <div className="club-actions">
          <button type="button" className="button" onClick={() => onRsvp(screening)}>
            RSVP
          </button>
          {embed === null ? null : (
            <button
              type="button"
              className="button button--ghost"
              onClick={() => setPlaying(!playing)}
            >
              {playing ? 'Show details' : 'Watch trailer'}
            </button>
          )}
          <AddToCalendar screening={screening} />
        </div>
      </div>
    </dialog>
  )
}
