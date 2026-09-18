import { postJson } from '../api'
import { type AdminScreening, type RawAdminScreening, toAdminScreening } from './types'

const FIELD_NAMES: Record<string, string> = {
  title: 'title',
  year: 'year',
  runtime_min: 'running time',
  art_version: 'poster',
}

function listed(names: string[]): string {
  const last = names.at(-1) ?? ''
  return names.length < 2 ? last : `${names.slice(0, -1).join(', ')} and ${last}`
}

export function refreshNote(changed: string[]): string {
  const names = changed.map((field) => FIELD_NAMES[field] ?? field)
  return names.length === 0 ? 'Already up to date with Emby.' : `Updated the ${listed(names)}.`
}

export async function refreshScreening(
  id: number,
): Promise<{ screening: AdminScreening; changed: string[] }> {
  const body = await postJson<{ screening: RawAdminScreening; changed: string[] }>(
    `/api/club/admin/events/${id}/refresh`,
  )
  return { screening: toAdminScreening(body.screening), changed: body.changed }
}
