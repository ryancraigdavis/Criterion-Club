import type { CSSProperties } from 'react'
import type { SiteMosaic } from '../api'

export function mosaicStyle(mosaic: SiteMosaic): CSSProperties {
  return {
    '--mosaic-url': `url("${mosaic.url}")`,
    '--mosaic-ratio': (mosaic.height / mosaic.width).toFixed(4),
  } as CSSProperties
}
