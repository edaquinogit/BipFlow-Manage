import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../api'
import { orderService } from '../order.service'
import { storeBotSessionId } from '../bot.service'
import type { CartCustomer, CartItem, Product } from '@/types/product'

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

const buildProduct = (): Product => ({
  id: 1,
  name: 'Combo Executivo',
  slug: 'combo-executivo',
  price: '42.50',
  category: { id: 1, name: 'Lanches', slug: 'lanches' },
  image: null,
  stock_quantity: 10,
  is_available: true,
  created_at: '2026-01-01T00:00:00Z',
})

const buildCustomer = (): CartCustomer => ({
  deliveryMethod: 'pickup',
  paymentMethod: 'pix',
  deliveryRegionId: null,
  deliveryRegionName: '',
  deliveryRegionFee: 0,
  notes: '',
})

describe('orderService.checkoutViaWhatsApp', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    vi.mocked(api.post).mockResolvedValue({ data: { order_reference: 'BPF-1' } } as never)
  })

  it('omits bot_session_id when the customer never used the bot', async () => {
    const items: CartItem[] = [{ product: buildProduct(), quantity: 1 }]

    await orderService.checkoutViaWhatsApp(items, buildCustomer())

    const payload = vi.mocked(api.post).mock.calls[0]?.[1] as Record<string, unknown>
    expect(payload).not.toHaveProperty('bot_session_id')
  })

  it('includes the stored bot session id in the checkout payload', async () => {
    storeBotSessionId('session-42')
    const items: CartItem[] = [{ product: buildProduct(), quantity: 1 }]

    await orderService.checkoutViaWhatsApp(items, buildCustomer())

    const payload = vi.mocked(api.post).mock.calls[0]?.[1] as Record<string, unknown>
    expect(payload.bot_session_id).toBe('session-42')
  })
})
