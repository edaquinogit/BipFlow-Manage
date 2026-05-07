import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../api'
import { botService } from '../bot.service'

vi.mock('../api', () => ({
  default: {
    get: vi.fn(),
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

  it('lists dashboard bot conversations with normalized filters', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        count: 1,
        next: null,
        previous: null,
        page_size: 8,
        total_pages: 1,
        results: [
          {
            id: 3,
            session_id: 'session-3',
            channel: 'web',
            customer_phone: '',
            status: 'waiting_human',
            last_intent: 'human_support',
            created_at: '2026-05-06T10:00:00Z',
            updated_at: '2026-05-06T10:01:00Z',
            message_count: 2,
            last_message_preview: 'Quero falar com atendente',
          },
        ],
      },
    } as never)

    const response = await botService.getConversations({
      status: 'waiting_human',
      search: '  atendente  ',
      pageSize: 6,
    })

    expect(api.get).toHaveBeenCalledWith('v1/bot-conversations/', {
      params: {
        page_size: 6,
        status: 'waiting_human',
        search: 'atendente',
      },
    })
    expect(response.results[0]?.status).toBe('waiting_human')
  })

  it('loads a dashboard bot conversation detail', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        id: 3,
        session_id: 'session-3',
        channel: 'web',
        customer_phone: '',
        status: 'waiting_customer',
        last_intent: 'delivery',
        created_at: '2026-05-06T10:00:00Z',
        updated_at: '2026-05-06T10:01:00Z',
        message_count: 2,
        last_message_preview: 'Entrega',
        messages: [
          {
            id: 11,
            role: 'user',
            content: 'Entrega',
            intent: 'delivery',
            metadata: {},
            created_at: '2026-05-06T10:00:00Z',
          },
        ],
      },
    } as never)

    const response = await botService.getConversation(3)

    expect(api.get).toHaveBeenCalledWith('v1/bot-conversations/3/')
    expect(response.messages).toHaveLength(1)
  })
})
