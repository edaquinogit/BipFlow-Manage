import api from './api'
import type {
  PaginatedSalesOrdersResponse,
  SaleOrder,
  SaleOrderFilters,
  SaleOrderStatus,
} from '@/types/sales'

export const salesService = {
  async list(filters: SaleOrderFilters = {}): Promise<PaginatedSalesOrdersResponse> {
    const params: Record<string, string | number> = {
      page_size: filters.pageSize ?? 5,
    }

    if (filters.status) {
      params.status = filters.status
    }

    if (filters.search?.trim()) {
      params.search = filters.search.trim()
    }

    const response = await api.get<PaginatedSalesOrdersResponse>('v1/sales-orders/', { params })
    return response.data
  },

  async updateStatus(orderId: number, status: SaleOrderStatus): Promise<SaleOrder> {
    const response = await api.patch<SaleOrder>(`v1/sales-orders/${orderId}/status/`, {
      status,
    })

    return response.data
  },
}
