import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../api'
import { storeService } from '../store.service'

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

describe('StoreService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches the current resolved store', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        id: 1,
        name: 'Loja Principal',
        slug: 'default',
        logo_url: 'https://example.com/logo.png',
        tagline: 'Catalogo online',
        whatsapp_phone: '5571999999999',
        theme: {
          primary: '#05050A',
          accent: '#D81B60',
        },
        is_active: true,
        status: 'active',
      },
    } as never)

    const response = await storeService.getCurrent()

    expect(api.get).toHaveBeenCalledWith('v1/store/current/')
    expect(response.slug).toBe('default')
    expect(response.logo_url).toBe('https://example.com/logo.png')
    expect(response.tagline).toBe('Catalogo online')
    expect(response.status).toBe('active')
    expect(response.is_active).toBe(true)
  })
})
