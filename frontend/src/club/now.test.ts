import { describe, expect, it } from 'vitest'
import { MINUTE, untilNextTick } from './now'

describe('untilNextTick', () => {
  it.each([
    ['on the minute', Date.UTC(2026, 8, 18, 19, 30, 0), MINUTE],
    ['just after', Date.UTC(2026, 8, 18, 19, 30, 0, 250), MINUTE - 250],
    ['a second before', Date.UTC(2026, 8, 18, 19, 30, 59), 1000],
  ] as const)('waits for the next boundary %s', (_name, at, expected) => {
    expect(untilNextTick(at, MINUTE)).toBe(expected)
  })

  it('never waits longer than one period', () => {
    expect(untilNextTick(123_456, 5_000)).toBeLessThanOrEqual(5_000)
  })
})
