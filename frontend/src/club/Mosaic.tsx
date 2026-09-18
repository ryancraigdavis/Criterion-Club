import { mosaicStyle } from './mosaic'
import { useSite } from './site'

export function Mosaic() {
  const mosaic = useSite((state) => state.site?.mosaic ?? null)
  return mosaic === null ? null : (
    <div className="mosaic" aria-hidden="true">
      <div className="mosaic__strip" style={mosaicStyle(mosaic)} />
    </div>
  )
}
