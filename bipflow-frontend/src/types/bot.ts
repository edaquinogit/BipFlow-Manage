export type BotChannel = 'web' | 'whatsapp'

export type BotConversationStatus = 'open' | 'waiting_customer' | 'waiting_human' | 'closed'

export type BotMessageRole = 'user' | 'bot'

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

export interface BotConversationMessage {
  id: number
  role: BotMessageRole
  content: string
  intent: string
  metadata: Record<string, unknown>
  created_at: string
}

export interface BotConversationSummary {
  id: number
  session_id: string
  channel: BotChannel
  customer_phone: string
  status: BotConversationStatus
  last_intent: string
  created_at: string
  updated_at: string
  message_count: number
  last_message_preview: string
}

export interface BotConversationDetail extends BotConversationSummary {
  messages: BotConversationMessage[]
}

export interface BotConversationFilters {
  status?: BotConversationStatus
  channel?: BotChannel
  intent?: string
  search?: string
  pageSize?: number
}

export interface PaginatedBotConversationsResponse {
  count: number
  next: string | null
  previous: string | null
  page_size: number
  total_pages: number
  results: BotConversationSummary[]
}
