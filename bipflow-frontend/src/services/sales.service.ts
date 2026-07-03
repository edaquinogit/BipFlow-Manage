import api from './api'
import type {
  PaginatedSalesOrdersResponse,
  SaleOrder,
  SaleOrderBreakdown,
  SaleOrderCustomerInsights,
  SaleOrderDateRange,
  SaleOrderFilters,
  SaleOrderStatus,
  SaleOrderSummary,
  SaleOrderSummaryPeriod,
  SaleOrderTimeseriesPeriod,
  SaleOrderTimeseriesPoint,
} from '@/types/sales'

const buildRangeParams = (
  periodOrRange: SaleOrderSummaryPeriod | SaleOrderTimeseriesPeriod | SaleOrderDateRange
): Record<string, string> => {
  if (typeof periodOrRange === 'string') {
    return { period: periodOrRange }
  }

  return { start: periodOrRange.start, end: periodOrRange.end }
}

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

    if (filters.channel) {
      params.channel = filters.channel
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

  async summary(
    periodOrRange: SaleOrderSummaryPeriod | SaleOrderDateRange = '30d'
  ): Promise<SaleOrderSummary> {
    const response = await api.get<SaleOrderSummary>('v1/sales-orders/summary/', {
      params: buildRangeParams(periodOrRange),
    })

    return response.data
  },

  async timeseries(
    periodOrRange: SaleOrderTimeseriesPeriod | SaleOrderDateRange = '30d'
  ): Promise<SaleOrderTimeseriesPoint[]> {
    const response = await api.get<SaleOrderTimeseriesPoint[]>('v1/sales-orders/timeseries/', {
      params: buildRangeParams(periodOrRange),
    })

    return response.data
  },

  async breakdown(
    periodOrRange: SaleOrderSummaryPeriod | SaleOrderDateRange = '30d'
  ): Promise<SaleOrderBreakdown> {
    const response = await api.get<SaleOrderBreakdown>('v1/sales-orders/breakdown/', {
      params: buildRangeParams(periodOrRange),
    })

    return response.data
  },

  async customers(
    periodOrRange: SaleOrderSummaryPeriod | SaleOrderDateRange = '30d'
  ): Promise<SaleOrderCustomerInsights> {
    const response = await api.get<SaleOrderCustomerInsights>('v1/sales-orders/customers/', {
      params: buildRangeParams(periodOrRange),
    })

    return response.data
  },
}
