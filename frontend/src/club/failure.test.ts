import { describe, expect, it } from 'vitest'
import { ApiError } from '../api'
import { attempt, failureText } from './failure'

describe('failureText', () => {
  it.each([
    [
      'an api error',
      new ApiError(502, 'the emby server did not answer'),
      'Couldn’t save: the emby server did not answer',
    ],
    ['a plain error', new Error('offline'), 'Couldn’t save: offline'],
    ['anything else', 'nope', 'Couldn’t save.'],
  ] as const)('describes %s', (_name, error, expected) => {
    expect(failureText(error, 'save')).toBe(expected)
  })
})

describe('attempt', () => {
  it('reports nothing when the work succeeds, which clears an earlier failure', async () => {
    await expect(attempt(() => Promise.resolve('ok'), 'save')).resolves.toBeNull()
  })

  it('turns a rejection into a sentence', async () => {
    const failing = () => Promise.reject(new ApiError(500, 'boom'))
    await expect(attempt(failing, 'remove the RSVP')).resolves.toBe(
      'Couldn’t remove the RSVP: boom',
    )
  })

  it('catches work that throws before it returns a promise', async () => {
    const throwing = (): Promise<unknown> => {
      throw new Error('bad input')
    }
    await expect(attempt(() => Promise.resolve().then(throwing), 'save')).resolves.toBe(
      'Couldn’t save: bad input',
    )
  })
})
