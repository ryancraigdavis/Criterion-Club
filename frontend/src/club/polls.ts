import { create } from 'zustand'
import { postJson, sendJson } from '../api'
import type { PollPayload } from './poll'
import {
  type AdminPoll,
  type Poll,
  type RawAdminPoll,
  type RawPoll,
  toAdminPoll,
  toPoll,
} from './types'
import { browserVoterId } from './voter'

interface PollState {
  poll: Poll | null
  boardSchedule: boolean
  known: boolean
  refresh: () => Promise<void>
  vote: (optionId: number) => Promise<void>
  setBoardSchedule: (show: boolean) => void
}

async function loadPoll(): Promise<Poll | null> {
  const voter = encodeURIComponent(browserVoterId())
  const body = await sendJson<{ poll: RawPoll | null }>(`/api/club/poll?voter=${voter}`)
  return body.poll === null ? null : toPoll(body.poll)
}

async function loadBoardSchedule(): Promise<boolean> {
  return (await sendJson<{ board_schedule: boolean }>('/api/club/settings')).board_schedule
}

export const usePoll = create<PollState>((set, get) => ({
  poll: null,
  boardSchedule: true,
  known: false,
  refresh: async () => {
    const [poll, boardSchedule] = await Promise.all([
      loadPoll().catch(() => null),
      loadBoardSchedule().catch(() => true),
    ])
    set({ poll, boardSchedule, known: true })
  },
  vote: async (optionId) => {
    const poll = get().poll
    await postJson('/api/club/votes', {
      poll_id: poll?.id,
      option_id: optionId,
      voter: browserVoterId(),
    })
    await get().refresh()
  },
  setBoardSchedule: (boardSchedule) => set({ boardSchedule }),
}))

export function openPollOf(poll: Poll | null): Poll | null {
  return poll?.status === 'open' ? poll : null
}

export async function fetchAdminPolls(): Promise<AdminPoll[]> {
  const body = await sendJson<{ polls: RawAdminPoll[] }>('/api/club/admin/polls')
  return body.polls.map(toAdminPoll)
}

export async function savePoll(id: number | null, payload: PollPayload): Promise<AdminPoll> {
  const path = id === null ? '/api/club/admin/polls' : `/api/club/admin/polls/${id}`
  return toAdminPoll((await postJson<{ poll: RawAdminPoll }>(path, payload)).poll)
}

export async function movePoll(id: number, status: 'open' | 'closed'): Promise<void> {
  await postJson(`/api/club/admin/polls/${id}/status`, { status })
}

export async function deletePoll(id: number): Promise<void> {
  await postJson(`/api/club/admin/polls/${id}/delete`)
}

export async function saveBoardSchedule(show: boolean): Promise<void> {
  await postJson('/api/club/admin/settings', { board_schedule: show })
  usePoll.getState().setBoardSchedule(show)
}
