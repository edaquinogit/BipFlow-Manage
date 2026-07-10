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

export const ProductQrCodesBulkResponseSchema = z.object({
  labels: z.array(ProductBulkLabelSchema),
  missing_ids: z.array(z.number()),
})

export type ProductBulkLabel = z.infer<typeof ProductBulkLabelSchema>
export type ProductQrCodesBulkResponse = z.infer<typeof ProductQrCodesBulkResponseSchema>
