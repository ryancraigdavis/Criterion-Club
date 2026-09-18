import { describe, expect, it } from 'vitest'
import { trailerEmbed, youtubeId } from './trailer'

describe('youtubeId', () => {
  it.each([
    ['the saved form', 'https://www.youtube.com/watch?v=7mw6LyyoeGE', '7mw6LyyoeGE'],
    ['nothing saved', null, null],
    ['anything else', 'https://evil.example/watch?v=7mw6LyyoeGE', null],
    ['a longer id', 'https://www.youtube.com/watch?v=7mw6LyyoeGEx', null],
  ] as const)('%s', (_name, url, expected) => {
    expect(youtubeId(url)).toBe(expected)
  })
})

describe('trailerEmbed', () => {
  it('plays through youtube-nocookie without suggestions', () => {
    expect(trailerEmbed('https://www.youtube.com/watch?v=7mw6LyyoeGE')).toBe(
      'https://www.youtube-nocookie.com/embed/7mw6LyyoeGE?autoplay=1&rel=0&modestbranding=1',
    )
  })

  it('has nothing to play without a trailer', () => {
    expect(trailerEmbed(null)).toBeNull()
  })
})
