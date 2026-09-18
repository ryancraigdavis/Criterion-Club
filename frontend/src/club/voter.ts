const KEY = 'twbc-voter'

function freshId(): string {
  const bytes = new Uint8Array(18)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

let fallback: string | null = null

export function browserVoterId(): string {
  try {
    const stored = window.localStorage.getItem(KEY)
    const id = stored ?? freshId()
    window.localStorage.setItem(KEY, id)
    return id
  } catch {
    fallback ??= freshId()
    return fallback
  }
}
