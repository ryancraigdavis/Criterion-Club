import { create } from 'zustand'
import { postJson, sendJson } from '../api'
import type { ScreeningPayload } from './draft'
import { afterFailure, type LoadStatus } from './load'
import {
  type AdminScreening,
  type PastScreening,
  type RawAdminScreening,
  type RawPastScreening,
  type RawScreening,
  type Screening,
  toAdminScreening,
  toPastScreening,
  toScreening,
} from './types'

const SCHEDULE_LIMIT = 6
const PAST_LIMIT = 24

interface ScreeningsState {
  next: Screening | null
  schedule: Screening[]
  past: PastScreening[]
  status: LoadStatus
  refresh: () => Promise<void>
  retry: () => Promise<void>
}

async function loadPast(): Promise<PastScreening[]> {
  const body = await sendJson<{ screenings: RawPastScreening[] }>(
    `/api/club/past?limit=${PAST_LIMIT}`,
  )
  return body.screenings.map(toPastScreening)
}

async function loadPublic(): Promise<Pick<ScreeningsState, 'next' | 'schedule' | 'past'>> {
  const [next, schedule, past] = await Promise.all([
    sendJson<{ screening: RawScreening | null }>('/api/club/next'),
    sendJson<{ screenings: RawScreening[] }>(`/api/club/schedule?limit=${SCHEDULE_LIMIT}`),
    loadPast().catch(() => []),
  ])
  return {
    next: next.screening === null ? null : toScreening(next.screening),
    schedule: schedule.screenings.map(toScreening),
    past,
  }
}

export const useScreenings = create<ScreeningsState>((set, get) => ({
  next: null,
  schedule: [],
  past: [],
  status: 'loading',
  refresh: async () => {
    await loadPublic().then(
      (loaded) => set({ ...loaded, status: 'ready' }),
      () => set((state) => ({ status: afterFailure(state.status) })),
    )
  },
  retry: () => {
    set({ status: 'loading' })
    return get().refresh()
  },
}))

export async function fetchAdminScreenings(): Promise<AdminScreening[]> {
  const body = await sendJson<{ screenings: RawAdminScreening[] }>('/api/club/admin/events')
  return body.screenings.map(toAdminScreening)
}

export async function saveScreening(
  id: number | null,
  payload: ScreeningPayload,
): Promise<AdminScreening> {
  const path = id === null ? '/api/club/admin/events' : `/api/club/admin/events/${id}`
  const body = await postJson<{ screening: RawAdminScreening }>(path, payload)
  return toAdminScreening(body.screening)
}

export async function deleteScreening(id: number): Promise<void> {
  await postJson(`/api/club/admin/events/${id}/delete`)
}

export function laterScreenings(
  schedule: readonly Screening[],
  next: Screening | null,
): Screening[] {
  return schedule.filter((screening) => screening.id !== next?.id)
}
