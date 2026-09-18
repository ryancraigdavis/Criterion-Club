import { create } from 'zustand'
import { fetchSite, type SiteInfo } from '../api'

interface SiteState {
  site: SiteInfo | null
  refresh: () => Promise<void>
}

export const useSite = create<SiteState>((set) => ({
  site: null,
  refresh: async () => {
    const site = await fetchSite().catch(() => null)
    set({ site })
  },
}))
