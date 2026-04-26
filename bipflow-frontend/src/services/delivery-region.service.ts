import api from './api'
import type {
  DeliveryRegion,
  DeliveryRegionPayload,
  PaginatedDeliveryRegionsResponse,
} from '@/types/delivery'

function unwrapRegions(data: DeliveryRegion[] | PaginatedDeliveryRegionsResponse): DeliveryRegion[] {
  return Array.isArray(data) ? data : data.results
}

export const deliveryRegionService = {
  async getAll(): Promise<DeliveryRegion[]> {
    const response = await api.get<DeliveryRegion[] | PaginatedDeliveryRegionsResponse>(
      'v1/delivery-regions/',
      {
        params: {
          page_size: 100,
        },
      }
    )

    return unwrapRegions(response.data)
  },

  async getActive(): Promise<DeliveryRegion[]> {
    const response = await api.get<DeliveryRegion[]>('v1/delivery-regions/active/')
    return response.data
  },

  async create(payload: DeliveryRegionPayload): Promise<DeliveryRegion> {
    const response = await api.post<DeliveryRegion>('v1/delivery-regions/', payload)
    return response.data
  },

  async update(id: number, payload: DeliveryRegionPayload): Promise<DeliveryRegion> {
    const response = await api.patch<DeliveryRegion>(`v1/delivery-regions/${id}/`, payload)
    return response.data
  },

  async delete(id: number): Promise<void> {
    await api.delete(`v1/delivery-regions/${id}/`)
  },
}
