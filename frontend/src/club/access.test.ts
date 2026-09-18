import { describe, expect, it } from 'vitest'
import { ApiError } from '../api'
import { dashboardView, signInFailure, signInProblem, USERNAME_LIMIT } from './access'
import { SIGNED_OUT } from './session'

describe('signInProblem', () => {
  it.each([
    ['blank', '', 'Enter your Emby username.'],
    ['only spaces', '   ', 'Enter your Emby username.'],
    ['too long', 'x'.repeat(USERNAME_LIMIT + 1), 'That username is too long.'],
    ['fine', 'Ryan', null],
    ['padded but fine', '  Ryan ', null],
  ])('%s', (_name, username, expected) => {
    expect(signInProblem(username)).toBe(expected)
  })
})

describe('signInFailure', () => {
  it.each([
    [401, 'That username and password don’t match an Emby account.'],
    [429, 'Too many tries. Wait a few minutes and try again.'],
    [502, 'The Emby server didn’t answer. Try again shortly.'],
    [503, 'Sign-in isn’t switched on yet.'],
    [403, 'Couldn’t sign in. Check your connection and try again.'],
  ])('explains a %i', (status, expected) => {
    expect(signInFailure(new ApiError(status, 'x'))).toBe(expected)
  })

  it('explains a network failure', () => {
    expect(signInFailure(new TypeError('Failed to fetch'))).toMatch(/connection/)
  })
})

describe('dashboardView', () => {
  it.each([
    ['still checking', SIGNED_OUT, false, 'checking'],
    ['signed out', SIGNED_OUT, true, 'sign-in'],
    ['a member', { name: 'Guest', admin: false }, true, 'members-only'],
    ['an admin', { name: 'Ryan', admin: true }, true, 'dashboard'],
  ] as const)('%s', (_name, session, known, expected) => {
    expect(dashboardView(session, known)).toBe(expected)
  })
})
