import { create } from 'zustand'
import { postJson, sendJson } from '../api'

interface SettingsState {
  showSchedule: boolean
  refresh: () => Promise<void>
}

interface RawSettings {
  show_schedule: boolean
}

export const useSettings = create<SettingsState>((set) => ({
  showSchedule: false,
  refresh: async () => {
    const showSchedule = await sendJson<RawSettings>('/api/club/settings').then(
      (body) => body.show_schedule,
      () => false,
    )
    set({ showSchedule })
  },
}))

export async function saveShowSchedule(show: boolean): Promise<void> {
  await postJson<RawSettings>('/api/club/admin/settings', { show_schedule: show })
  useSettings.setState({ showSchedule: show })
}
