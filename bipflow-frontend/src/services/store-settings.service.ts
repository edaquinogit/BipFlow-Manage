import api from './api'
import type {
  PublicStoreSettings,
  StoreSettings,
  StoreSettingsPayload,
} from '@/types/store-settings'

export const storeSettingsService = {
  async get(): Promise<StoreSettings> {
    const response = await api.get<StoreSettings>('v1/store-settings/')
    return response.data
  },

  async update(payload: StoreSettingsPayload): Promise<StoreSettings> {
    const response = await api.patch<StoreSettings>('v1/store-settings/', payload)
    return response.data
  },

  async getPublic(): Promise<PublicStoreSettings> {
    const response = await api.get<PublicStoreSettings>('v1/store-settings/public/')
    return response.data
  },
}
