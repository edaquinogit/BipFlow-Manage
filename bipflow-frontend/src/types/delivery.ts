export interface DeliveryRegion {
  id: number
  name: string
  city: string
  neighborhoods: string
  delivery_fee: string
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export interface DeliveryRegionPayload {
  name: string
  city: string
  neighborhoods: string
  delivery_fee: string
  is_active: boolean
}

export interface PaginatedDeliveryRegionsResponse {
  count: number
  next: string | null
  previous: string | null
  page_size: number
  total_pages: number
  results: DeliveryRegion[]
}
