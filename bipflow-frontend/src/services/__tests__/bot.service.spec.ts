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
})
