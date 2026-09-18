// The Criterion Collection "C", traced from artifacts/criterion.png: an outer circle, a concentric
// inner one, and two straight cuts that open it to the right.
export const MARK_VIEWBOX = 100
export const MARK_PATH =
  'M 96.84 32.52 A 50 50 0 1 0 57.17 99.48 L 53.64 77.3 A 27.58 27.58 0 1 1 75.58 40.28 Z'

export function markSvg(colour: string, background: string | null = null, inset = 0): string {
  const size = MARK_VIEWBOX + inset * 2
  const plate =
    background === null
      ? ''
      : `<rect width="${size}" height="${size}" rx="${size * 0.18}" fill="${background}"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"><title>Criterion Club</title>${plate}<path transform="translate(${inset} ${inset})" d="${MARK_PATH}" fill="${colour}"/></svg>`
}
