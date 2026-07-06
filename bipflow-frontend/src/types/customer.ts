export interface CustomerProfile {
  full_name: string
  phone: string
  email: string
  address: string
  neighborhood: string
  city: string
  delivery_region_id: number | null
  delivery_region_name: string
}

export interface CustomerProfileUpdatePayload {
  full_name?: string
  phone?: string
  address?: string
  neighborhood?: string
  city?: string
  delivery_region_id?: number | null
}

export interface CreateCustomerProfilePayload {
  email: string
  password: string
  confirm_password: string
  store_slug: string
  full_name: string
  phone: string
  address?: string
  neighborhood?: string
  city?: string
}
