/**
 * PDV receipt PDF/email evolution: `PdvSaleReceiptModal.vue` used to be
 * coupled to `PdvSaleResponse` (types/pdvSale.ts), which only exists right
 * after a sale finalizes. Etapa E4 (viewing the receipt of a past sale from
 * the PDV's "Últimas vendas" panel) needs the same modal fed by a
 * `SaleOrder` (types/sales.ts) instead -- `ReceiptData` is the common
 * subset both already satisfy structurally (a `PdvSaleResponse` or a
 * `SaleOrder` can be passed directly wherever a `ReceiptData` is expected,
 * no adapter needed for extra fields), so the modal doesn't need to know
 * which one produced it.
 */
export interface ReceiptLineItem {
  product_id: number | null
  product_name: string
  quantity: number
  unit_price: string
  line_total: string
}

export interface ReceiptData {
  order_reference: string
  items: ReceiptLineItem[]
  total: string
  payment_method: string
  created_at: string
  customer_email?: string
}
