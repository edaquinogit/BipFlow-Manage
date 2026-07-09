import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../api'
import { extractCheckoutErrorMessage, orderService } from '../order.service'
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

const buildCustomer = (overrides: Partial<CartCustomer> = {}): CartCustomer => ({
  deliveryMethod: 'pickup',
  paymentMethod: 'pix',
  deliveryRegionId: null,
  deliveryRegionName: '',
  deliveryRegionFee: 0,
  notes: '',
  fullName: 'Convidado Teste',
  phone: '11977776666',
  email: '',
  address: '',
  neighborhood: '',
  city: '',
  ...overrides,
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

  it('sends guest identity and address fields, trimmed, in the payload (guest checkout reinstated)', async () => {
    const items: CartItem[] = [{ product: buildProduct(), quantity: 1 }]
    const customer = buildCustomer({
      deliveryMethod: 'delivery',
      fullName: '  Maria Convidada  ',
      phone: ' 11988887777 ',
      email: ' maria@example.com ',
      address: ' Rua Teste, 100 ',
      neighborhood: ' Centro ',
      city: ' Salvador ',
    })

    await orderService.checkoutViaWhatsApp(items, customer)

    const payload = vi.mocked(api.post).mock.calls[0]?.[1] as {
      customer: Record<string, unknown>
    }
    expect(payload.customer).toMatchObject({
      full_name: 'Maria Convidada',
      phone: '11988887777',
      email: 'maria@example.com',
      address: 'Rua Teste, 100',
      neighborhood: 'Centro',
      city: 'Salvador',
    })
  })
})

describe('extractCheckoutErrorMessage', () => {
  // isAxiosError() requires `instanceof Error` -- a plain object literal
  // (as real axios errors never are) would silently fall through to the
  // generic message and pass for the wrong reason.
  const axiosError = (code: string) => Object.assign(new Error('Request failed'), {
    response: { data: { code } },
    config: {},
    isAxiosError: true,
  })

  it('maps guest_identity_required to a specific message', () => {
    expect(extractCheckoutErrorMessage(axiosError('guest_identity_required')))
      .toBe('Informe seu nome e telefone para finalizar o pedido.')
  })

  it('maps guest_address_incomplete to a specific message', () => {
    expect(extractCheckoutErrorMessage(axiosError('guest_address_incomplete')))
      .toBe('Informe endereco, bairro e cidade para receber em casa.')
  })

  it('falls back to a generic message for unknown errors', () => {
    expect(extractCheckoutErrorMessage(new Error('boom')))
      .toBe('Nao foi possivel registrar o pedido agora. Revise os dados e tente novamente.')
  })
})
