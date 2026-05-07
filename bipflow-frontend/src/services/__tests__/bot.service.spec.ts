import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../api'
import { botService } from '../bot.service'

vi.mock('../api', () => ({
  default: {
    post: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}))

describe('BotService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends trimmed public bot messages to the API', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: {
        conversation_id: 1,
        session_id: 'session-1',
        conversation_status: 'waiting_customer',
        intent: 'greeting',
        reply: 'Ola!',
        options: [],
        products: [],
        delivery_regions: [],
      },
    } as never)

    const response = await botService.sendMessage('  Oi  ')

    expect(api.post).toHaveBeenCalledWith('v1/bot/messages/', {
      message: 'Oi',
      channel: 'web',
    })
    expect(response.intent).toBe('greeting')
  })

  it('sends conversation context when continuing a bot session', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: {
        conversation_id: 7,
        session_id: 'session-7',
        conversation_status: 'waiting_customer',
        intent: 'delivery',
        reply: 'Regioes ativas',
        options: [],
        products: [],
        delivery_regions: [],
      },
    } as never)

    await botService.sendMessage('entrega', {
      conversationId: 7,
      sessionId: 'session-7',
      customerPhone: ' 5571999999999 ',
    })

    expect(api.post).toHaveBeenCalledWith('v1/bot/messages/', {
      message: 'entrega',
      channel: 'web',
      conversation_id: 7,
      session_id: 'session-7',
      customer_phone: '5571999999999',
    })
  })
})
