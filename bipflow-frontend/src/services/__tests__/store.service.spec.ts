import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../api'
import { storeService } from '../store.service'

vi.mock('../api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
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

  it('reads payment settings for a store', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        payment_pix_link_url: 'https://pay.example.com/pix',
        payment_card_link_url: 'https://pay.example.com/card',
        card_max_installments: 6,
        card_monthly_interest_rate: '1.99',
        card_min_installment_amount: '10.00',
      },
    } as never)

    const response = await storeService.getPaymentSettings('default')

    expect(api.get).toHaveBeenCalledWith('v1/store/mine/default/payment-settings/')
    expect(response.card_max_installments).toBe(6)
  })

  it('updates payment settings for a store', async () => {
    vi.mocked(api.patch).mockResolvedValue({
      data: {
        payment_pix_link_url: 'https://pay.example.com/pix',
        payment_card_link_url: '',
        card_max_installments: 1,
        card_monthly_interest_rate: '0.00',
        card_min_installment_amount: '5.00',
      },
    } as never)

    await storeService.updatePaymentSettings('default', {
      payment_pix_link_url: 'https://pay.example.com/pix',
    })

    expect(api.patch).toHaveBeenCalledWith('v1/store/mine/default/payment-settings/', {
      payment_pix_link_url: 'https://pay.example.com/pix',
    })
  })
})
