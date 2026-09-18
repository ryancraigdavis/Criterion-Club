import { describe, expect, it } from 'vitest'
import { toSite } from '../api'
import { mosaicStyle } from './mosaic'

const RAW = { emby_url: 'https://emby.example', emby_server_id: 'abc' }

describe('toSite', () => {
  it('has no mosaic until the server has built one', () => {
    expect(toSite(RAW).mosaic).toBeNull()
    expect(toSite({ ...RAW, mosaic: null }).mosaic).toBeNull()
  })

  it('keeps the mosaic dimensions', () => {
    const mosaic = { url: '/api/club-art/mosaic-abc.webp', width: 1280, height: 1920 }
    expect(toSite({ ...RAW, mosaic }).mosaic).toEqual(mosaic)
  })
})

describe('mosaicStyle', () => {
  it('hands the image and its height-to-width ratio to the stylesheet', () => {
    const style = mosaicStyle({ url: '/api/club-art/mosaic-abc.webp', width: 1280, height: 1920 })
    expect(style).toEqual({
      '--mosaic-url': 'url("/api/club-art/mosaic-abc.webp")',
      '--mosaic-ratio': '1.5000',
    })
  })
})
