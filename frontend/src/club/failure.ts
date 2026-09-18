import { useCallback, useState } from 'react'

export function failureText(error: unknown, action: string): string {
  return error instanceof Error ? `Couldn’t ${action}: ${error.message}` : `Couldn’t ${action}.`
}

export function attempt(work: () => Promise<unknown>, action: string): Promise<string | null> {
  return work().then(
    () => null,
    (error: unknown) => failureText(error, action),
  )
}

export type Run = (work: () => Promise<unknown>, action: string) => Promise<boolean>

export function useFailure(): [string | null, Run] {
  const [failure, setFailure] = useState<string | null>(null)
  const run = useCallback<Run>(async (work, action) => {
    const problem = await attempt(work, action)
    setFailure(problem)
    return problem === null
  }, [])
  return [failure, run]
}
