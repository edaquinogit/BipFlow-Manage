import { z } from 'zod'

/**
 * Etapa 3 of the QR-code stock-exit evolution: point-of-sale checkout for
 * the physical store. Mirrors bipdelivery/api/pdv.py's serializers (see
 * docs/architecture/qrcode-stock-exit-evolution.md) -- resolves cart items
 * by the scanned/typed `public_code` instead of a numeric product id, the
 * way CheckoutPayloadItem (types/product.ts) does for the WhatsApp cart.
 */
export const PDV_PAYMENT_METHODS = ['pix', 'card', 'cash'] as const
export type PdvPaymentMethod = (typeof PDV_PAYMENT_METHODS)[number]

export interface PdvSaleItemPayload {
  public_code: string
  quantity: number
}

export interface PdvSaleRequestPayload {
  items: PdvSaleItemPayload[]
  payment_method: PdvPaymentMethod
  customer_name?: string
  notes?: string
}

export const PdvSaleItemResponseSchema = z.object({
  product_id: z.number(),
  product_name: z.string(),
  public_code: z.string(),
  quantity: z.number(),
  unit_price: z.union([z.string(), z.number()]).transform((value) => String(value)),
  line_total: z.union([z.string(), z.number()]).transform((value) => String(value)),
})

export const PdvSaleResponseSchema = z.object({
  order_reference: z.string(),
  items: z.array(PdvSaleItemResponseSchema),
  subtotal: z.union([z.string(), z.number()]).transform((value) => String(value)),
  total: z.union([z.string(), z.number()]).transform((value) => String(value)),
  payment_method: z.string(),
  created_at: z.string(),
})

export type PdvSaleResponse = z.infer<typeof PdvSaleResponseSchema>
