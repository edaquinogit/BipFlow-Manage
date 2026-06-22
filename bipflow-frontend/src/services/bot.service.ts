import api from './api'
import { Logger } from './logger'
import type {
  BotConversationDetail,
  BotConversationFilters,
  BotMessageContext,
  BotMessagePayload,
  BotMessageResponse,
  PaginatedBotConversationsResponse,
} from '@/types/bot'

const BOT_SESSION_STORAGE_KEY = 'bipflow.catalogBot.sessionId'

export function getStoredBotSessionId(): string {
  try {
    return sessionStorage.getItem(BOT_SESSION_STORAGE_KEY) ?? ''
  } catch (error) {
    Logger.debug('Catalog bot session storage is unavailable', {
      error: error instanceof Error ? error.message : 'unknown_error',
    })
    return ''
  }
}

export function storeBotSessionId(nextSessionId: string): void {
  try {
    sessionStorage.setItem(BOT_SESSION_STORAGE_KEY, nextSessionId)
  } catch (error) {
    Logger.debug('Failed to store catalog bot session id', {
      error: error instanceof Error ? error.message : 'unknown_error',
    })
  }
}

export const botService = {
  async sendMessage(
    message: string,
    context: BotMessageContext = {}
  ): Promise<BotMessageResponse> {
    const payload: BotMessagePayload = {
      message: message.trim(),
      channel: context.channel ?? 'web',
    }

    if (context.conversationId) {
      payload.conversation_id = context.conversationId
    }

    if (context.sessionId) {
      payload.session_id = context.sessionId
    }

    if (context.customerPhone?.trim()) {
      payload.customer_phone = context.customerPhone.trim()
    }

    const response = await api.post<BotMessageResponse>('v1/bot/messages/', payload)
    return response.data
  },

  async getConversations(
    filters: BotConversationFilters = {}
  ): Promise<PaginatedBotConversationsResponse> {
    const params: Record<string, string | number> = {
      page_size: filters.pageSize ?? 8,
    }

    if (filters.status) {
      params.status = filters.status
    }

    if (filters.channel) {
      params.channel = filters.channel
    }

    if (filters.intent?.trim()) {
      params.intent = filters.intent.trim()
    }

    if (filters.search?.trim()) {
      params.search = filters.search.trim()
    }

    const response = await api.get<PaginatedBotConversationsResponse>('v1/bot-conversations/', {
      params,
    })

    return response.data
  },

  async getConversation(conversationId: number): Promise<BotConversationDetail> {
    const response = await api.get<BotConversationDetail>(
      `v1/bot-conversations/${conversationId}/`
    )

    return response.data
  },
}
