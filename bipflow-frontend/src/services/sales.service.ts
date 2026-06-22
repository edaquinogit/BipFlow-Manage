import api from './api'
import type {
  PaginatedSalesOrdersResponse,
  SaleOrder,
  SaleOrderBreakdown,
  SaleOrderFilters,
  SaleOrderStatus,
  SaleOrderSummary,
  SaleOrderSummaryPeriod,
  SaleOrderTimeseriesPeriod,
  SaleOrderTimeseriesPoint,
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

  async summary(period: SaleOrderSummaryPeriod = '30d'): Promise<SaleOrderSummary> {
    const response = await api.get<SaleOrderSummary>('v1/sales-orders/summary/', {
      params: { period },
    })

    return response.data
  },

  async timeseries(period: SaleOrderTimeseriesPeriod = '30d'): Promise<SaleOrderTimeseriesPoint[]> {
    const response = await api.get<SaleOrderTimeseriesPoint[]>('v1/sales-orders/timeseries/', {
      params: { period },
    })

    return response.data
  },

  async breakdown(period: SaleOrderSummaryPeriod = '30d'): Promise<SaleOrderBreakdown> {
    const response = await api.get<SaleOrderBreakdown>('v1/sales-orders/breakdown/', {
      params: { period },
    })

    return response.data
  },
}
