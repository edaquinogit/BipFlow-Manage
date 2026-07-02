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

// Etapa 3 of the QR-code stock-exit evolution: which channel the sale came
// through -- the existing e-commerce/WhatsApp checkout (virtual) or the
// physical-store PDV (loja_fisica). Mirrors SaleOrder.CHANNEL_CHOICES in
// bipdelivery/api/models.py.
export type SaleOrderChannel = 'virtual' | 'loja_fisica'

export interface SaleOrder {
  id: number
  order_reference: string
  status: SaleOrderStatus
  channel: SaleOrderChannel
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
  period: SaleOrderSummaryPeriod | 'custom'
  revenue_total: string
  orders_count: number
  average_ticket: string
  comparison_previous_period: string | null
  comparison_same_period_last_year: string | null
}

export interface SaleOrderDateRange {
  start: string
  end: string
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

export interface RegionBreakdown {
  region: string
  revenue_total: string
  orders_count: number
}

// Etapa 5 of the QR-code stock-exit evolution: revenue split between the
// virtual (e-commerce/WhatsApp) and loja_fisica (PDV) channels.
export interface ChannelBreakdown {
  channel: SaleOrderChannel
  revenue_total: string
  orders_count: number
}

export interface SaleOrderBreakdown {
  period: SaleOrderSummaryPeriod | 'custom'
  top_products: TopProductBreakdown[]
  by_payment_method: PaymentMethodBreakdown[]
  by_status: StatusBreakdown[]
  by_region: RegionBreakdown[]
  by_channel: ChannelBreakdown[]
}

export interface SaleOrderCustomerInsights {
  period: SaleOrderSummaryPeriod | 'custom'
  new_customers: number
  returning_customers: number
  bot_conversations_count: number
  bot_converted_count: number
  bot_conversion_rate: string | null
}
