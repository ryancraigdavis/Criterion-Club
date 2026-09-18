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
  refresh: () => Promise<void>
  vote: (optionId: number) => Promise<void>
}

async function loadPoll(): Promise<Poll | null> {
  const voter = encodeURIComponent(browserVoterId())
  const body = await sendJson<{ poll: RawPoll | null }>(`/api/club/poll?voter=${voter}`)
  return body.poll === null ? null : toPoll(body.poll)
}

export const usePoll = create<PollState>((set, get) => ({
  poll: null,
  refresh: async () => {
    await loadPoll().then(
      (poll) => set({ poll }),
      () => undefined,
    )
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
}))

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
