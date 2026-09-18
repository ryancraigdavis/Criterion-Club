import { API_BASE } from '../config'
import type { Screening } from './types'

const DEFAULT_MINUTES = 120

export function calendarFileUrl(id: number): string {
  return `${API_BASE}/api/club/screenings/${id}/calendar.ics`
}

export function calendarStamp(date: Date): string {
  return date
    .toISOString()
    .replace(/\.\d{3}Z$/, 'Z')
    .replace(/[-:]/g, '')
}

export function googleCalendarUrl(screening: Screening, siteUrl: string): string {
  const start = new Date(screening.startsAt)
  const end = new Date(start.getTime() + (screening.runtimeMin ?? DEFAULT_MINUTES) * 60_000)
  const details = [screening.message, screening.description, siteUrl].filter(Boolean).join('\n\n')
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Criterion Club: ${screening.title}`,
    dates: `${calendarStamp(start)}/${calendarStamp(end)}`,
    details,
    location: screening.location ?? '',
  })
  return `https://calendar.google.com/calendar/render?${params}`
}
