import { z } from 'zod'
import type { Category } from '@/schemas/category.schema'

/**
 * ========================================
 * 🛍️ CUSTOMER-FACING PRODUCT TYPES
 * ========================================
 *
 * TypeScript interfaces and Zod schemas for the customer-facing
 * products page with pagination, filtering, and search.
 */

/**
 * Category for customer display
 */
export interface ProductCategory {
  id: number
  name: string
  slug: string | null
}

/**
 * Product for customer display (simplified from admin schema)
 */
export interface Product {
  id: number
  name: string
  slug: string | null
  price: string
  category: ProductCategory
  image: string | null
  stock_quantity: number
  is_available: boolean
  created_at: string
}

/**
 * Product filters for customer search
 */
export interface ProductFilters {
  search?: string
  categoryId?: number
  priceMin?: number
  priceMax?: number
  inStockOnly?: boolean
}

export type ProductSortOption =
  | 'featured'
  | 'price-asc'
  | 'price-desc'
  | 'name-asc'
  | 'newest'

export interface CartItem {
  product: Product
  quantity: number
}

export interface CartCustomer {
  fullName: string
  phone: string
  email: string
  deliveryMethod: 'delivery' | 'pickup'
  paymentMethod: 'pix' | 'card' | 'cash'
  address: string
  neighborhood: string
  city: string
  notes: string
}

export interface CheckoutPayloadItem {
  product_id: number
  quantity: number
}

export interface CheckoutPayloadCustomer {
  full_name: string
  phone: string
  email: string
  delivery_method: 'delivery' | 'pickup'
  payment_method: 'pix' | 'card' | 'cash'
  address: string
  neighborhood: string
  city: string
  notes: string
}

export interface CheckoutPayload {
  items: CheckoutPayloadItem[]
  customer: CheckoutPayloadCustomer
}

export interface CheckoutResponseItem {
  product_id: number
  product_name: string
  sku: string
  quantity: number
  unit_price: string
  line_total: string
}

export interface CheckoutResponse {
  order_reference: string
  items: CheckoutResponseItem[]
  customer: CheckoutPayloadCustomer
  subtotal: string
  delivery_fee: string
  total: string
  message: string
  whatsapp_url: string
}

export type ProductFilterCategory = Pick<Category, 'id' | 'name'>

/**
 * Paginated API response
 */
export interface PaginatedProductsResponse {
  count: number
  next: string | null
  previous: string | null
  page_size: number
  total_pages: number
  results: Product[]
}

/**
 * Zod schemas for validation
 */
export const ProductCategorySchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string().nullable(),
})

export const ProductSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string().nullable(),
  price: z.union([z.string(), z.number()]).transform((value) => String(value)),
  category: ProductCategorySchema,
  image: z.string().url().nullable(),
  stock_quantity: z.number(),
  is_available: z.boolean(),
  created_at: z.string(),
})

export const PaginatedProductsResponseSchema = z.object({
  count: z.number(),
  next: z.string().nullable(),
  previous: z.string().nullable(),
  page_size: z.number(),
  total_pages: z.number(),
  results: z.array(ProductSchema),
})

export const ProductFiltersSchema = z.object({
  search: z.string().optional(),
  categoryId: z.number().optional(),
  priceMin: z.number().optional(),
  priceMax: z.number().optional(),
  inStockOnly: z.boolean().optional(),
})

/**
 * Type guards
 */
export const isProduct = (obj: unknown): obj is Product => {
  return ProductSchema.safeParse(obj).success
}

export const isPaginatedResponse = (obj: unknown): obj is PaginatedProductsResponse => {
  return PaginatedProductsResponseSchema.safeParse(obj).success
}
