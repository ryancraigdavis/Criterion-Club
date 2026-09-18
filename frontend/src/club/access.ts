import { ApiError } from '../api'
import type { ClubSession } from './session'

export const USERNAME_LIMIT = 128

export function signInProblem(username: string): string | null {
  const name = username.trim()
  const checks: [boolean, string][] = [
    [name === '', 'Enter your Emby username.'],
    [name.length > USERNAME_LIMIT, 'That username is too long.'],
  ]
  return checks.find(([failed]) => failed)?.[1] ?? null
}

const FAILURES: Record<number, string> = {
  401: 'That username and password don’t match an Emby account.',
  429: 'Too many tries. Wait a few minutes and try again.',
  502: 'The Emby server didn’t answer. Try again shortly.',
  503: 'Sign-in isn’t switched on yet.',
}

export function signInFailure(error: unknown): string {
  const status = error instanceof ApiError ? error.status : 0
  return FAILURES[status] ?? 'Couldn’t sign in. Check your connection and try again.'
}

export type DashboardView = 'checking' | 'sign-in' | 'members-only' | 'dashboard'

export function dashboardView(session: ClubSession, known: boolean): DashboardView {
  const views: [boolean, DashboardView][] = [
    [!known, 'checking'],
    [session.name === null, 'sign-in'],
    [!session.admin, 'members-only'],
  ]
  return views.find(([when]) => when)?.[1] ?? 'dashboard'
}
