export interface StoreSettings {
  id: number
  whatsapp_phone: string
  whatsapp_phone_digits: string
  is_whatsapp_configured: boolean
  created_at?: string
  updated_at?: string
}

export interface StoreSettingsPayload {
  whatsapp_phone: string
}

export interface PublicStoreSettings {
  whatsapp_phone_digits: string
  is_whatsapp_configured: boolean
}
