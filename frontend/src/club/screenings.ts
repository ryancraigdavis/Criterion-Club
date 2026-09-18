import { create } from 'zustand'
import { postJson, sendJson } from '../api'
import type { ScreeningPayload } from './draft'
import {
  type AdminScreening,
  type RawAdminScreening,
  type RawScreening,
  type Screening,
  toAdminScreening,
  toScreening,
} from './types'

const SCHEDULE_LIMIT = 6

interface ScreeningsState {
  next: Screening | null
  schedule: Screening[]
  known: boolean
  refresh: () => Promise<void>
}

async function loadPublic(): Promise<Pick<ScreeningsState, 'next' | 'schedule'>> {
  const [next, schedule] = await Promise.all([
    sendJson<{ screening: RawScreening | null }>('/api/club/next'),
    sendJson<{ screenings: RawScreening[] }>(`/api/club/schedule?limit=${SCHEDULE_LIMIT}`),
  ])
  return {
    next: next.screening === null ? null : toScreening(next.screening),
    schedule: schedule.screenings.map(toScreening),
  }
}

export const useScreenings = create<ScreeningsState>((set) => ({
  next: null,
  schedule: [],
  known: false,
  refresh: async () => {
    const loaded = await loadPublic().catch(() => ({ next: null, schedule: [] }))
    set({ ...loaded, known: true })
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
