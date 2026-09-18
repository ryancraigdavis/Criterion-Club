import { postJson, sendJson } from '../api'
import type { RsvpPayload } from './rsvp'
import type { SuggestionPayload } from './suggestion'
import {
  type AdminRsvp,
  type AdminSuggestion,
  type RawAdminRsvp,
  type RawAdminSuggestion,
  type Rsvp,
  type RsvpTotals,
  type SuggestionStatus,
  toAdminRsvp,
  toAdminSuggestion,
} from './types'

export async function sendRsvp(payload: RsvpPayload): Promise<Rsvp> {
  return (await postJson<{ rsvp: Rsvp }>('/api/club/rsvp', payload)).rsvp
}

export async function fetchMyRsvp(eventId: number): Promise<Rsvp | null> {
  return (await sendJson<{ rsvp: Rsvp | null }>(`/api/club/rsvp?event_id=${eventId}`)).rsvp
}

export async function sendSuggestion(payload: SuggestionPayload): Promise<{ title: string }> {
  return (await postJson<{ suggestion: { title: string } }>('/api/club/suggestions', payload))
    .suggestion
}

export async function fetchGuestList(
  eventId: number,
): Promise<{ rsvps: AdminRsvp[]; totals: RsvpTotals }> {
  const body = await sendJson<{ rsvps: RawAdminRsvp[]; totals: RsvpTotals }>(
    `/api/club/admin/events/${eventId}/rsvps`,
  )
  return { rsvps: body.rsvps.map(toAdminRsvp), totals: body.totals }
}

export async function removeRsvp(id: number): Promise<void> {
  await postJson(`/api/club/admin/rsvps/${id}/delete`)
}

export async function fetchSuggestions(): Promise<AdminSuggestion[]> {
  const body = await sendJson<{ suggestions: RawAdminSuggestion[] }>('/api/club/admin/suggestions')
  return body.suggestions.map(toAdminSuggestion)
}

export async function markSuggestion(id: number, status: SuggestionStatus): Promise<void> {
  await postJson(`/api/club/admin/suggestions/${id}`, { status })
}

export async function removeSuggestion(id: number): Promise<void> {
  await postJson(`/api/club/admin/suggestions/${id}/delete`)
}
