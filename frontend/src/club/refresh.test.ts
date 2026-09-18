import { describe, expect, it } from 'vitest'
import { refreshNote } from './refresh'

describe('refreshNote', () => {
  it.each([
    ['nothing changed', [], 'Already up to date with Emby.'],
    ['one field', ['art_version'], 'Updated the poster.'],
    ['two fields', ['title', 'art_version'], 'Updated the title and poster.'],
    [
      'three fields',
      ['title', 'runtime_min', 'art_version'],
      'Updated the title, running time and poster.',
    ],
  ] as const)('%s', (_name, changed, expected) => {
    expect(refreshNote([...changed])).toBe(expected)
  })
})
