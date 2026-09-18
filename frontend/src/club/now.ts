import { useEffect, useState } from 'react'

export const MINUTE = 60_000

export function untilNextTick(nowMs: number, every: number): number {
  return every - (nowMs % every)
}

export function useNow(every = MINUTE): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      setNow(new Date())
      timer = setTimeout(tick, untilNextTick(Date.now(), every))
    }
    timer = setTimeout(tick, untilNextTick(Date.now(), every))
    return () => clearTimeout(timer)
  }, [every])
  return now
}
