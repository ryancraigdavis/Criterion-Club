import { describe, expect, it } from 'vitest'
import { afterFailure, clubLead } from './load'

describe('clubLead', () => {
  it.each([
    ['still loading', 'loading', false, 'loading'],
    ['unreachable', 'failed', false, 'failed'],
    ['loaded with nothing on', 'ready', false, 'nothing'],
    ['loaded with a screening', 'ready', true, 'screening'],
  ] as const)('%s', (_name, status, hasNext, expected) => {
    expect(clubLead(status, hasNext)).toBe(expected)
  })
})

describe('afterFailure', () => {
  it.each([
    ['keeps showing what already loaded', 'ready', 'ready'],
    ['fails a first load', 'loading', 'failed'],
    ['stays failed', 'failed', 'failed'],
  ] as const)('%s', (_name, current, expected) => {
    expect(afterFailure(current)).toBe(expected)
  })
})
