export type BotChannel = 'web' | 'whatsapp'

export type BotIntent =
  | 'greeting'
  | 'catalog'
  | 'product_search'
  | 'delivery'
  | 'checkout'
  | 'human_support'
  | 'fallback'

export interface BotMessagePayload {
  message: string
  channel?: BotChannel
  conversation_id?: number
  session_id?: string
  customer_phone?: string
}

export interface BotMessageContext {
  channel?: BotChannel
  conversationId?: number | null
  sessionId?: string | null
  customerPhone?: string
}

export interface BotOption {
  label: string
  value: string
}

export interface BotProductSuggestion {
  id: number
  name: string
  slug: string | null
  price: string
  stock_quantity: number
}

export interface BotDeliveryRegionSuggestion {
  id: number
  name: string
  city: string
  delivery_fee: string
}

export interface BotMessageResponse {
  conversation_id: number
  session_id: string
  conversation_status: string
  intent: BotIntent
  reply: string
  options: BotOption[]
  products: BotProductSuggestion[]
  delivery_regions: BotDeliveryRegionSuggestion[]
}
