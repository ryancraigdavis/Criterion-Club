import { API_BASE } from './config'

export interface SiteMosaic {
  url: string
  width: number
  height: number
}

export interface SiteInfo {
  embyUrl: string
  embyServerId: string | null
  mosaic: SiteMosaic | null
}

interface RawSite {
  emby_url: string
  emby_server_id: string | null
  mosaic?: SiteMosaic | null
}

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export function errorDetail(body: unknown, status: number): string {
  const detail = (body as { detail?: unknown } | null)?.detail
  const first = Array.isArray(detail) ? (detail[0] as { msg?: unknown } | undefined)?.msg : detail
  return typeof first === 'string' ? first : `request failed (${status})`
}

export async function sendJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { credentials: 'same-origin', ...init })
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    throw new ApiError(response.status, errorDetail(body, response.status))
  }
  return body as T
}

export function postJson<T>(path: string, payload: unknown = {}): Promise<T> {
  return sendJson<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function toSite(raw: RawSite): SiteInfo {
  const mosaic = raw.mosaic ? { ...raw.mosaic, url: `${API_BASE}${raw.mosaic.url}` } : null
  return { embyUrl: raw.emby_url, embyServerId: raw.emby_server_id, mosaic }
}

export async function fetchSite(): Promise<SiteInfo> {
  return toSite(await sendJson<RawSite>('/api/site'))
}

export function embyHomeUrl(site: SiteInfo): string {
  return `${site.embyUrl}/web/index.html`
}

export function embyItemUrl(site: SiteInfo, itemId: string): string {
  const server = site.embyServerId ? `&serverId=${encodeURIComponent(site.embyServerId)}` : ''
  return `${embyHomeUrl(site)}#!/item?id=${encodeURIComponent(itemId)}${server}`
}
