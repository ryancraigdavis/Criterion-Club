import { useRef } from 'react'
import { calendarFileUrl, googleCalendarUrl } from './calendar'
import type { Screening } from './types'

export function AddToCalendar({ screening }: { screening: Screening }) {
  const menu = useRef<HTMLDetailsElement>(null)
  const close = () => menu.current?.removeAttribute('open')
  return (
    <details ref={menu} className="calendar-menu">
      <summary className="button button--ghost">Add to calendar</summary>
      <div className="calendar-menu__list">
        <a href={calendarFileUrl(screening.id)} download onClick={close}>
          Apple or Outlook (.ics)
        </a>
        <a
          href={googleCalendarUrl(screening, window.location.origin)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={close}
        >
          Google Calendar
        </a>
      </div>
    </details>
  )
}
