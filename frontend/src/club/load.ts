export type LoadStatus = 'loading' | 'ready' | 'failed'

export type ClubLead = 'loading' | 'failed' | 'nothing' | 'screening'

export function clubLead(status: LoadStatus, hasNext: boolean): ClubLead {
  const leads: Record<LoadStatus, ClubLead> = {
    loading: 'loading',
    failed: 'failed',
    ready: hasNext ? 'screening' : 'nothing',
  }
  return leads[status]
}

export function afterFailure(current: LoadStatus): LoadStatus {
  return current === 'ready' ? 'ready' : 'failed'
}
