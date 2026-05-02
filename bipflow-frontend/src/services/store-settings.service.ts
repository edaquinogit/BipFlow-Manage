import api from './api'
import type { StoreSettings, StoreSettingsPayload } from '@/types/store-settings'

export const storeSettingsService = {
  async get(): Promise<StoreSettings> {
    const response = await api.get<StoreSettings>('v1/store-settings/')
    return response.data
  },

  async update(payload: StoreSettingsPayload): Promise<StoreSettings> {
    const response = await api.patch<StoreSettings>('v1/store-settings/', payload)
    return response.data
  },
}
