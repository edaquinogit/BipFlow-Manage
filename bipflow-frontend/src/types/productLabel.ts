import { z } from 'zod'

/**
 * Etapa 2 of the QR-code stock-exit evolution: the printable QR Code
 * payload returned by GET /v1/products/{id}/qr-code/. Mirrors
 * bipdelivery/api/product_labels.py -- `qr_code` is a base64 PNG data URI
 * encoding `url`, which itself ends in `public_code` (see
 * docs/architecture/qrcode-stock-exit-evolution.md).
 */
export const ProductQrCodeSchema = z.object({
  public_code: z.string(),
  url: z.string(),
  qr_code: z.string().refine((value) => value.startsWith('data:image/png;base64,'), {
    message: 'Expected a base64 PNG data URI',
  }),
})

export type ProductQrCode = z.infer<typeof ProductQrCodeSchema>

/**
 * Etapa 6 of the QR-code stock-exit evolution: response shape of
 * GET /v1/products/qr-codes-bulk/?ids=1,2,3 (bipdelivery/api/views.py's
 * qr_codes_bulk action). Richer than ProductQrCode -- it carries id/name/
 * price/size too, so the frontend can render a label without needing the
 * product to still be present in the currently-loaded/filtered product list.
 */
export const ProductBulkLabelSchema = z.object({
  id: z.number(),
  public_code: z.string(),
  name: z.string(),
  price: z.string(),
  size: z.string().nullable().optional(),
  url: z.string(),
  qr_code: z.string().refine((value) => value.startsWith('data:image/png;base64,'), {
    message: 'Expected a base64 PNG data URI',
  }),
})

export const DEFAULT_PRODUCT_LABEL_SETTINGS = {
  page_format: 'a4',
  columns: 2,
  rows: 5,
  margin_mm: 10,
  cell_padding_mm: 4,
  qr_size_mm: 26,
  show_price: true,
  show_size: true,
  show_public_code: true,
  labels_per_page: 10,
} as const

export const ProductLabelSettingsSchema = z.object({
  page_format: z.literal('a4').default(DEFAULT_PRODUCT_LABEL_SETTINGS.page_format),
  columns: z.number().int().min(1).max(6).default(DEFAULT_PRODUCT_LABEL_SETTINGS.columns),
  rows: z.number().int().min(1).max(12).default(DEFAULT_PRODUCT_LABEL_SETTINGS.rows),
  margin_mm: z.number().int().min(0).max(30).default(DEFAULT_PRODUCT_LABEL_SETTINGS.margin_mm),
  cell_padding_mm: z.number().int().min(0).max(20).default(DEFAULT_PRODUCT_LABEL_SETTINGS.cell_padding_mm),
  qr_size_mm: z.number().int().min(12).max(80).default(DEFAULT_PRODUCT_LABEL_SETTINGS.qr_size_mm),
  show_price: z.boolean().default(DEFAULT_PRODUCT_LABEL_SETTINGS.show_price),
  show_size: z.boolean().default(DEFAULT_PRODUCT_LABEL_SETTINGS.show_size),
  show_public_code: z.boolean().default(DEFAULT_PRODUCT_LABEL_SETTINGS.show_public_code),
  labels_per_page: z.number().int().min(1).default(DEFAULT_PRODUCT_LABEL_SETTINGS.labels_per_page),
})

export const ProductQrCodesBulkResponseSchema = z.object({
  labels: z.array(ProductBulkLabelSchema),
  missing_ids: z.array(z.number()),
  settings: ProductLabelSettingsSchema.optional().default(DEFAULT_PRODUCT_LABEL_SETTINGS),
})

export type ProductBulkLabel = z.infer<typeof ProductBulkLabelSchema>
export type ProductLabelSettings = z.infer<typeof ProductLabelSettingsSchema>
export type ProductQrCodesBulkResponse = z.infer<typeof ProductQrCodesBulkResponseSchema>
