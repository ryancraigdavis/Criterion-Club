import { create } from 'zustand'
import { postJson, sendJson } from '../api'

export interface ClubSession {
  name: string | null
  admin: boolean
}

export const SIGNED_OUT: ClubSession = { name: null, admin: false }

interface SessionState {
  session: ClubSession
  known: boolean
  refresh: () => Promise<void>
  signIn: (username: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

export const useClubSession = create<SessionState>((set) => ({
  session: SIGNED_OUT,
  known: false,
  refresh: async () => {
    const session = await sendJson<ClubSession>('/api/club/me').catch(() => SIGNED_OUT)
    set({ session, known: true })
  },
  signIn: async (username, password) => {
    const session = await postJson<ClubSession>('/api/club/login', { username, password })
    set({ session, known: true })
  },
  signOut: async () => {
    const session = await postJson<ClubSession>('/api/club/logout')
    set({ session, known: true })
  },
}))
