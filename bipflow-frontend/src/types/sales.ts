export interface SaleOrderItem {
  id: number
  product_id: number | null
  product_name: string
  sku: string
  quantity: number
  unit_price: string
  line_total: string
}

export type SaleOrderStatus = 'prepared' | 'sent' | 'cancelled'

export interface SaleOrder {
  id: number
  order_reference: string
  status: SaleOrderStatus
  customer_name: string
  customer_phone: string
  customer_email: string
  delivery_method: 'delivery' | 'pickup'
  payment_method: 'pix' | 'card' | 'cash'
  delivery_region_name: string
  subtotal: string
  delivery_fee: string
  total: string
  created_at: string
  item_count: number
  items: SaleOrderItem[]
}

export interface PaginatedSalesOrdersResponse {
  count: number
  next: string | null
  previous: string | null
  page_size: number
  total_pages: number
  results: SaleOrder[]
}

export interface SaleOrderFilters {
  status?: SaleOrderStatus
  search?: string
  pageSize?: number
}

export type SaleOrderSummaryPeriod = 'today' | '7d' | '30d' | '90d' | 'month'

export interface SaleOrderSummary {
  period: SaleOrderSummaryPeriod
  revenue_total: string
  orders_count: number
  average_ticket: string
  comparison_previous_period: string | null
}

export type SaleOrderTimeseriesPeriod = '7d' | '30d' | '90d'

export interface SaleOrderTimeseriesPoint {
  date: string
  revenue: string
  orders_count: number
}

export interface TopProductBreakdown {
  product_id: number | null
  product_name: string
  image_url: string | null
  quantity_total: number
  revenue_total: string
}

export interface PaymentMethodBreakdown {
  payment_method: SaleOrder['payment_method']
  revenue_total: string
  orders_count: number
}

export interface StatusBreakdown {
  status: SaleOrderStatus
  orders_count: number
}

export interface SaleOrderBreakdown {
  period: SaleOrderSummaryPeriod
  top_products: TopProductBreakdown[]
  by_payment_method: PaymentMethodBreakdown[]
  by_status: StatusBreakdown[]
}
