const LOCALE = 'en-US'
const DAY_MS = 86_400_000
const EVENING_HOUR = 17
const LOCAL_INPUT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/

type Fields = Record<'year' | 'month' | 'day' | 'hour', number>

function fields(date: Date, timeZone?: string): Fields {
  const parts = new Intl.DateTimeFormat(LOCALE, {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(date)
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0)
  return { year: value('year'), month: value('month'), day: value('day'), hour: value('hour') }
}

function calendarDay(date: Date, timeZone?: string): number {
  const { year, month, day } = fields(date, timeZone)
  return Date.UTC(year, month - 1, day) / DAY_MS
}

const spaced = (text: string) => text.replace(/ /g, ' ')

export function daysUntil(iso: string, now: Date, timeZone?: string): number {
  return calendarDay(new Date(iso), timeZone) - calendarDay(now, timeZone)
}

export function relativeDay(iso: string, now: Date, timeZone?: string): string | null {
  const days = daysUntil(iso, now, timeZone)
  const evening = fields(new Date(iso), timeZone).hour >= EVENING_HOUR
  const labels: [boolean, string][] = [
    [days === 0 && evening, 'Tonight'],
    [days === 0, 'Today'],
    [days === 1, 'Tomorrow'],
  ]
  return labels.find(([when]) => when)?.[1] ?? null
}

export function screeningDate(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date(iso))
}

export function screeningTime(iso: string, timeZone?: string): string {
  return spaced(
    new Intl.DateTimeFormat(LOCALE, { timeZone, hour: 'numeric', minute: '2-digit' }).format(
      new Date(iso),
    ),
  )
}

export function screeningWhen(iso: string, now: Date, timeZone?: string): string {
  const day = relativeDay(iso, now, timeZone) ?? screeningDate(iso, timeZone)
  return `${day} · ${screeningTime(iso, timeZone)}`
}

export function watchedOn(iso: string, now: Date, timeZone?: string): string {
  const sameYear = fields(new Date(iso), timeZone).year === fields(now, timeZone).year
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone,
    month: 'short',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric',
  }).format(new Date(iso))
}

export function dayMonth(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat(LOCALE, { timeZone, month: 'short', day: 'numeric' }).format(
    new Date(iso),
  )
}

const pad = (value: number) => String(value).padStart(2, '0')

export function toLocalInput(iso: string): string {
  const date = new Date(iso)
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  return `${day}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function fromLocalInput(value: string): string | null {
  const date = new Date(value)
  return LOCAL_INPUT.test(value) && !Number.isNaN(date.getTime()) ? date.toISOString() : null
}

export function formatRuntime(minutes: number | null): string | null {
  const total = minutes ?? 0
  const hours = Math.floor(total / 60)
  const parts = [hours > 0 ? `${hours}h` : '', `${total % 60}m`].filter(Boolean)
  return total > 0 ? parts.join(' ') : null
}
