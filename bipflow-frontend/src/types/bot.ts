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
  intent: BotIntent
  reply: string
  options: BotOption[]
  products: BotProductSuggestion[]
  delivery_regions: BotDeliveryRegionSuggestion[]
}
