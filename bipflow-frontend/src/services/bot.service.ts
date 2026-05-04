import api from './api'
import type { BotChannel, BotMessagePayload, BotMessageResponse } from '@/types/bot'

export const botService = {
  async sendMessage(message: string, channel: BotChannel = 'web'): Promise<BotMessageResponse> {
    const payload: BotMessagePayload = {
      message: message.trim(),
      channel,
    }

    const response = await api.post<BotMessageResponse>('v1/bot/messages/', payload)
    return response.data
  },
}
