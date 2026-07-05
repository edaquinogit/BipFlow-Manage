export type StoreStatus = 'active' | 'inactive'

export type ReceiptPaperFormat = '58mm' | '80mm' | 'a4'

export interface StoreTheme {
  primary?: string | null
  accent?: string | null
  background?: string | null
  surface?: string | null
  text?: string | null
  muted?: string | null
}

export interface Store {
  id: number
  name: string
  slug: string
  logo_url?: string | null
  tagline?: string | null
  whatsapp_phone: string
  theme?: StoreTheme | null
  is_active: boolean
  status?: StoreStatus
  receipt_exchange_policy: string
  receipt_paper_format: ReceiptPaperFormat
}

export interface StoreReceiptSettingsPayload {
  receipt_exchange_policy?: string
  receipt_paper_format?: ReceiptPaperFormat
}
