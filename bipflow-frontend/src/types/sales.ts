export interface SaleOrderItem {
  id: number
  product_id: number | null
  product_name: string
  sku: string
  quantity: number
  unit_price: string
  line_total: string
}

export interface SaleOrder {
  id: number
  order_reference: string
  status: 'prepared' | 'sent' | 'cancelled'
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
