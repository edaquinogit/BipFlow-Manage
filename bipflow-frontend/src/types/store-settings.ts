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

export interface PublicPaymentGatewaySettings {
  pix_payment_link_url: string
  card_payment_link_url: string
  is_pix_link_configured: boolean
  is_card_link_configured: boolean
  card_max_installments: number
  card_monthly_interest_rate: string
  card_min_installment_amount: string
}

export interface PublicStoreSettings {
  whatsapp_phone_digits: string
  is_whatsapp_configured: boolean
  payment_gateway: PublicPaymentGatewaySettings
}
