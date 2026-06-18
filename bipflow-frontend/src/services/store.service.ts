import api from './api'
import type { Store } from '@/types/store'

export const storeService = {
  async getCurrent(): Promise<Store> {
    const response = await api.get<Store>('v1/store/current/')
    return response.data
  },
}
