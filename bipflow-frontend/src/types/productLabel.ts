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
