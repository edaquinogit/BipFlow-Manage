import api from './api'
import type { CustomerProfile, CustomerProfileUpdatePayload } from '@/types/customer'

export const customerService = {
  /** The authenticated customer's own profile for the currently selected store. */
  async getMe(): Promise<CustomerProfile> {
    const response = await api.get<CustomerProfile>('v1/customers/me/')
    return response.data
  },

  /** Partial update: only the fields sent are changed. */
  async updateMe(payload: CustomerProfileUpdatePayload): Promise<CustomerProfile> {
    const response = await api.patch<CustomerProfile>('v1/customers/me/', payload)
    return response.data
  },
}
