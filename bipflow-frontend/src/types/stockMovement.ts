import { z } from 'zod'

/**
 * ========================================
 * 📦 STOCK MOVEMENT TYPES
 * ========================================
 *
 * Mirrors bipdelivery/api/serializers.py's StockMovementSerializer.
 * Manual entrada/saida is registered via ProductService.createStockMovement,
 * history is read via ProductService.getStockMovements -- see
 * docs/architecture/stock-movement-evolution.md.
 */

export const STOCK_MOVEMENT_TYPES = ['entrada', 'saida'] as const
export type StockMovementType = (typeof STOCK_MOVEMENT_TYPES)[number]

export const STOCK_MOVEMENT_SOURCES = ['manual', 'venda'] as const
export type StockMovementSource = (typeof STOCK_MOVEMENT_SOURCES)[number]

export const StockMovementSchema = z.object({
  id: z.number(),
  product: z.number(),
  product_name: z.string().nullable().optional(),
  product_sku: z.string().nullable().optional(),
  movement_type: z.enum(STOCK_MOVEMENT_TYPES),
  movement_type_display: z.string(),
  quantity: z.number(),
  previous_stock: z.number(),
  new_stock: z.number(),
  reason: z.string(),
  reason_display: z.string(),
  source: z.string(),
  source_display: z.string(),
  sale_order: z.number().nullable(),
  sale_order_reference: z.string().nullable().optional(),
  performed_by: z.number().nullable(),
  performed_by_username: z.string().nullable().optional(),
  notes: z.string(),
  created_at: z.string(),
})

export type StockMovement = z.infer<typeof StockMovementSchema>

export const PaginatedStockMovementsSchema = z.object({
  count: z.number(),
  next: z.string().nullable(),
  previous: z.string().nullable(),
  page_size: z.number().optional(),
  total_pages: z.number().optional(),
  results: z.array(StockMovementSchema),
})

export type PaginatedStockMovements = z.infer<typeof PaginatedStockMovementsSchema>

/**
 * Manual entrada/saida reasons -- entrada_inicial and venda are
 * system-generated only and deliberately left out (the backend rejects them
 * if sent from this form).
 */
export const STOCK_MOVEMENT_REASONS: Record<StockMovementType, Array<{ value: string; label: string }>> = {
  entrada: [
    { value: 'compra', label: 'Compra' },
    { value: 'devolucao', label: 'Devolução' },
    { value: 'ajuste_inventario', label: 'Ajuste de inventário' },
    { value: 'outro', label: 'Outro' },
  ],
  saida: [
    { value: 'perda_avaria', label: 'Perda/Avaria' },
    { value: 'ajuste_inventario', label: 'Ajuste de inventário' },
    { value: 'outro', label: 'Outro' },
  ],
}

export interface StockMovementInput {
  movement_type: StockMovementType
  quantity: number
  reason: string
  notes?: string
}

/**
 * Every reason the ledger (Etapa 2) can filter by -- unlike
 * STOCK_MOVEMENT_REASONS (manual entry only), this includes the
 * system-generated `entrada_inicial`/`venda` so historical movements stay
 * filterable even though a human can never pick them from the entrada/saida
 * form.
 */
export const ALL_STOCK_MOVEMENT_REASONS: Array<{ value: string; label: string }> = [
  { value: 'compra', label: 'Compra' },
  { value: 'devolucao', label: 'Devolução' },
  { value: 'perda_avaria', label: 'Perda/Avaria' },
  { value: 'ajuste_inventario', label: 'Ajuste de inventário' },
  { value: 'entrada_inicial', label: 'Entrada inicial' },
  { value: 'venda', label: 'Venda' },
  { value: 'outro', label: 'Outro' },
]

export interface StockMovementLedgerFilters {
  product?: number
  movement_type?: StockMovementType
  source?: StockMovementSource
  reason?: string
  search?: string
  start?: string
  end?: string
}
