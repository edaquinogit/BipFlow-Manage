import api from './api'
import type { BotMessageContext, BotMessagePayload, BotMessageResponse } from '@/types/bot'

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
}
