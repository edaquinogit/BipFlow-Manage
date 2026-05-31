import api from './api'
import type { PaginatedSalesOrdersResponse, SaleOrder, SaleOrderStatus } from '@/types/sales'

export const salesService = {
  async getRecent(limit = 5): Promise<SaleOrder[]> {
    const response = await api.get<PaginatedSalesOrdersResponse>('v1/sales-orders/', {
      params: {
        page_size: limit,
      },
    })

    return response.data.results
  },

  async updateStatus(orderId: number, status: SaleOrderStatus): Promise<SaleOrder> {
    const response = await api.patch<SaleOrder>(`v1/sales-orders/${orderId}/status/`, {
      status,
    })

    return response.data
  },
}
