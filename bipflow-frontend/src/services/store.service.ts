import api from './api'
import type { Store, StoreReceiptSettingsPayload } from '@/types/store'

export const storeService = {
  async getCurrent(): Promise<Store> {
    const response = await api.get<Store>('v1/store/current/')
    return response.data
  },

  /** Stores the authenticated user belongs to (Etapa 4 store switcher). */
  async getMine(): Promise<Store[]> {
    const response = await api.get<Store[]>('v1/store/mine/')
    return response.data
  },

  /** Create an additional store owned by the authenticated user. */
  async create(name: string): Promise<Store> {
    const response = await api.post<Store>('v1/store/mine/', { name })
    return response.data
  },

  /** Rename a store the authenticated user owns or manages. */
  async rename(slug: string, name: string): Promise<Store> {
    const response = await api.patch<Store>(`v1/store/mine/${slug}/`, { name })
    return response.data
  },

  /** Update a store's PDV receipt settings (exchange policy + paper format). */
  async updateReceiptSettings(slug: string, payload: StoreReceiptSettingsPayload): Promise<Store> {
    const response = await api.patch<Store>(`v1/store/mine/${slug}/receipt-settings/`, payload)
    return response.data
  },
}
