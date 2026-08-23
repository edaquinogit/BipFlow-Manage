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

export interface StoreAppearanceSettingsPayload {
  logo_url?: string
  tagline?: string
  theme?: StoreTheme
}

export interface StoreLabelSettings {
  page_format: 'a4'
  columns: number
  rows: number
  margin_mm: number
  cell_padding_mm: number
  qr_size_mm: number
  show_price: boolean
  show_size: boolean
  show_public_code: boolean
  labels_per_page: number
}

export type StoreLabelSettingsPayload = Partial<
  Pick<
    StoreLabelSettings,
    | 'page_format'
    | 'columns'
    | 'rows'
    | 'margin_mm'
    | 'cell_padding_mm'
    | 'qr_size_mm'
    | 'show_price'
    | 'show_size'
    | 'show_public_code'
  >
>
