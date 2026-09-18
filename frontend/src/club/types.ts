import { API_BASE } from '../config'

export type ScreeningStatus = 'draft' | 'published' | 'cancelled'
export type RsvpAnswer = 'yes' | 'maybe' | 'no'
export type SuggestionStatus = 'new' | 'shortlisted' | 'scheduled' | 'declined'

export interface RsvpTotals {
  going: number
  maybe: number
  declined: number
  guests: number
}

export interface Rsvp {
  name: string
  answer: RsvpAnswer
  guests: number
  note: string | null
}

export interface RawAdminRsvp extends Rsvp {
  id: number
  signed_in: boolean
  updated_at: string
}

export interface AdminRsvp extends Rsvp {
  id: number
  signedIn: boolean
  updatedAt: string
}

export interface RawAdminSuggestion {
  id: number
  item_id: string | null
  title: string
  year: number | null
  name: string
  signed_in: boolean
  note: string | null
  status: SuggestionStatus
  created_at: string
  thumb_url: string | null
}

export interface AdminSuggestion {
  id: number
  itemId: string | null
  title: string
  year: number | null
  name: string
  signedIn: boolean
  note: string | null
  status: SuggestionStatus
  createdAt: string
  thumbUrl: string | null
}

export interface RawScreening {
  id: number
  title: string
  year: number | null
  starts_at: string
  location: string | null
  message: string | null
  description: string | null
  item_id: string | null
  poster_url: string | null
  runtime_min: number | null
}

export interface RawAdminScreening extends RawScreening {
  status: ScreeningStatus
  art_url: string | null
  updated_at: string
  rsvps?: RsvpTotals
}

export interface Screening {
  id: number
  title: string
  year: number | null
  startsAt: string
  location: string | null
  message: string | null
  description: string | null
  itemId: string | null
  posterUrl: string | null
  runtimeMin: number | null
}

export interface AdminScreening extends Screening {
  status: ScreeningStatus
  artUrl: string | null
  updatedAt: string
  rsvps: RsvpTotals
}

export function toScreening(raw: RawScreening): Screening {
  return {
    id: raw.id,
    title: raw.title,
    year: raw.year,
    startsAt: raw.starts_at,
    location: raw.location,
    message: raw.message,
    description: raw.description,
    itemId: raw.item_id,
    posterUrl: raw.poster_url === null ? null : `${API_BASE}${raw.poster_url}`,
    runtimeMin: raw.runtime_min,
  }
}

export function toAdminScreening(raw: RawAdminScreening): AdminScreening {
  return {
    ...toScreening(raw),
    status: raw.status,
    artUrl: raw.art_url,
    updatedAt: raw.updated_at,
    rsvps: raw.rsvps ?? NO_RSVPS,
  }
}

export const NO_RSVPS: RsvpTotals = { going: 0, maybe: 0, declined: 0, guests: 0 }

export function toAdminRsvp(raw: RawAdminRsvp): AdminRsvp {
  return {
    id: raw.id,
    name: raw.name,
    answer: raw.answer,
    guests: raw.guests,
    note: raw.note,
    signedIn: raw.signed_in,
    updatedAt: raw.updated_at,
  }
}

export function toAdminSuggestion(raw: RawAdminSuggestion): AdminSuggestion {
  return {
    id: raw.id,
    itemId: raw.item_id,
    title: raw.title,
    year: raw.year,
    name: raw.name,
    signedIn: raw.signed_in,
    note: raw.note,
    status: raw.status,
    createdAt: raw.created_at,
    thumbUrl: raw.thumb_url === null ? null : `${API_BASE}${raw.thumb_url}`,
  }
}

export type PollStatus = 'draft' | 'open' | 'closed'

export interface RawPollOption {
  id: number
  item_id: string | null
  title: string
  year: number | null
  thumb_url: string | null
  votes: number | null
}

export interface RawPoll {
  id: number
  question: string
  status: PollStatus
  options: RawPollOption[]
  total_votes: number | null
  my_vote: number | null
}

export interface RawAdminPollOption extends RawPollOption {
  suggestion_id: number | null
  votes: number
  voters: string[]
}

export interface RawAdminPoll {
  id: number
  question: string
  status: PollStatus
  closed_at: string | null
  created_at: string
  options: RawAdminPollOption[]
  total_votes: number
}

export interface PollOption {
  id: number
  itemId: string | null
  title: string
  year: number | null
  thumbUrl: string | null
  votes: number | null
}

export interface Poll {
  id: number
  question: string
  status: PollStatus
  options: PollOption[]
  totalVotes: number | null
  myVote: number | null
}

export interface AdminPollOption extends PollOption {
  suggestionId: number | null
  votes: number
  voters: string[]
}

export interface AdminPoll {
  id: number
  question: string
  status: PollStatus
  closedAt: string | null
  createdAt: string
  options: AdminPollOption[]
  totalVotes: number
}

const withBase = (url: string | null) => (url === null ? null : `${API_BASE}${url}`)

function toPollOption(raw: RawPollOption): PollOption {
  return {
    id: raw.id,
    itemId: raw.item_id,
    title: raw.title,
    year: raw.year,
    thumbUrl: withBase(raw.thumb_url),
    votes: raw.votes,
  }
}

export function toPoll(raw: RawPoll): Poll {
  return {
    id: raw.id,
    question: raw.question,
    status: raw.status,
    options: raw.options.map(toPollOption),
    totalVotes: raw.total_votes,
    myVote: raw.my_vote,
  }
}

export function toAdminPoll(raw: RawAdminPoll): AdminPoll {
  return {
    id: raw.id,
    question: raw.question,
    status: raw.status,
    closedAt: raw.closed_at,
    createdAt: raw.created_at,
    totalVotes: raw.total_votes,
    options: raw.options.map((option) => ({
      ...toPollOption(option),
      suggestionId: option.suggestion_id,
      votes: option.votes,
      voters: option.voters,
    })),
  }
}
