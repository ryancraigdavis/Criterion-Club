import { MARK_PATH, MARK_VIEWBOX } from './mark'

export function ClubMark({ size = 40 }: { size?: number }) {
  return (
    <svg
      className="club-mark"
      viewBox={`0 0 ${MARK_VIEWBOX} ${MARK_VIEWBOX}`}
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <path d={MARK_PATH} fill="currentColor" />
    </svg>
  )
}
