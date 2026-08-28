export type FeedbackType =
  | 'problem'
  | 'purchase_difficulty'
  | 'shipping'
  | 'checkout'
  | 'product'
  | 'suggestion'
  | 'other'

export type FeedbackStatus = 'new' | 'reviewing' | 'resolved' | 'ignored'

/** Extra context auto-filled from the current page -- the customer never types this. */
export interface FeedbackContext {
  pagePath?: string
  productId?: number | null
  orderId?: number | null
  correlationId?: string
}

export interface FeedbackSubmitPayload {
  type: FeedbackType
  message: string
  contact?: string
  page_path?: string
  product_id?: number | null
  order_id?: number | null
  correlation_id?: string
}

export interface FeedbackSubmitResponse {
  id: number
  status: FeedbackStatus
}

/** Dashboard read view of one report -- see CustomerFeedbackSerializer. */
export interface FeedbackReport {
  id: number
  feedback_type: FeedbackType
  message: string
  contact: string
  page_path: string
  product: number | null
  product_name: string | null
  order: number | null
  order_reference: string | null
  customer_name: string
  customer_phone: string
  correlation_id: string
  status: FeedbackStatus
  created_at: string
  updated_at: string
}

export interface FeedbackReportFilters {
  status?: FeedbackStatus
  type?: FeedbackType
  dateFrom?: string
  dateTo?: string
  pageSize?: number
  page?: number
}

export interface PaginatedFeedbackReportsResponse {
  count: number
  next: string | null
  previous: string | null
  page_size: number
  total_pages: number
  results: FeedbackReport[]
}
