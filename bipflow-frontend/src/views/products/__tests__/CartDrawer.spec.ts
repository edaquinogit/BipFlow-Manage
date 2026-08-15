import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import CartDrawer from '../CartDrawer.vue'
import type { CartCustomer, CartItem } from '@/types/product'
import type { CustomerProfile } from '@/types/customer'
import type { DeliveryRegion } from '@/types/delivery'

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: {}, fullPath: '/produtos' }),
  RouterLink: { template: '<a><slot /></a>' },
}))

const buildCustomer = (overrides: Partial<CartCustomer> = {}): CartCustomer => ({
  deliveryMethod: 'delivery',
  paymentMethod: 'pix',
  deliveryRegionId: null,
  deliveryRegionName: '',
  deliveryRegionFee: 0,
  notes: '',
  fullName: 'Convidado Teste',
  phone: '11999990000',
  email: '',
  address: 'Rua Teste, 100',
  neighborhood: 'Centro',
  city: 'Salvador',
  ...overrides,
})

const buildProfile = (overrides: Partial<CustomerProfile> = {}): CustomerProfile => ({
  full_name: 'Maria Cliente',
  phone: '11988887777',
  email: 'maria@example.com',
  address: 'Rua das Flores, 42',
  neighborhood: 'Jardim',
  city: 'Sao Paulo',
  delivery_region_id: null,
  delivery_region_name: '',
  ...overrides,
})

const buildItem = (): CartItem => ({
  product: {
    id: 1,
    name: 'Combo Executivo',
    slug: 'combo-executivo',
    price: '42.50',
    category: { id: 1, name: 'Lanches', slug: 'lanches' },
    image: null,
    stock_quantity: 10,
    is_available: true,
    created_at: '2026-01-01T00:00:00Z',
  },
  quantity: 1,
})

const buildRegion = (overrides: Partial<DeliveryRegion> = {}): DeliveryRegion => ({
  id: 1,
  name: 'Centro',
  city: 'Salvador',
  neighborhoods: '',
  delivery_fee: '12.00',
  is_active: true,
  ...overrides,
})

const mountDrawer = (props: Partial<InstanceType<typeof CartDrawer>['$props']> = {}) =>
  mount(CartDrawer, {
    props: {
      isOpen: true,
      items: [buildItem()],
      itemCount: 1,
      subtotal: 42.5,
      deliveryFee: 0,
      total: 42.5,
      customer: buildCustomer(),
      deliveryRegions: [],
      isWhatsAppConfigured: true,
      profile: null,
      ...props,
    },
  })

describe('CartDrawer', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('asks the shopper to create a profile instead of showing guest identity/address fields', () => {
    const wrapper = mountDrawer()

    expect(wrapper.text()).toContain('Crie seu perfil para finalizar este pedido.')
    expect(wrapper.find('input[autocomplete="name"]').exists()).toBe(false)
    expect(wrapper.find('input[autocomplete="tel"]').exists()).toBe(false)
    expect(wrapper.find('input[autocomplete="email"]').exists()).toBe(false)
    expect(wrapper.find('input[autocomplete="street-address"]').exists()).toBe(false)
  })

  it('shows the saved profile address and keeps the order form compact', () => {
    const wrapper = mountDrawer({ profile: buildProfile() })

    expect(wrapper.find('input[autocomplete="name"]').exists()).toBe(false)
    expect(wrapper.find('input[autocomplete="tel"]').exists()).toBe(false)
    expect(wrapper.find('input[autocomplete="email"]').exists()).toBe(false)
    expect(wrapper.find('input[autocomplete="street-address"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Maria Cliente - 11988887777')
    expect(wrapper.text()).toContain('Rua das Flores, 42, Jardim, Sao Paulo')
    expect(wrapper.text()).not.toContain('Retirar na loja')
  })

  it('asks an authenticated shopper to complete the saved address', () => {
    const wrapper = mountDrawer({
      profile: buildProfile({ address: '', neighborhood: '', city: '' }),
    })

    expect(wrapper.find('input[autocomplete="name"]').exists()).toBe(false)
    expect(wrapper.find('input[autocomplete="tel"]').exists()).toBe(false)
    expect(wrapper.find('input[autocomplete="street-address"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Complete o endereco do perfil para finalizar.')
    expect(wrapper.find('footer button').attributes('disabled')).toBeDefined()
  })

  it('requires a profile before allowing submission', () => {
    const wrapper = mountDrawer()

    expect(wrapper.text()).toContain('Crie seu perfil para finalizar o pedido.')
    expect(wrapper.find('footer button').attributes('disabled')).toBeDefined()
  })

  it('does not require guest fields when a complete profile is present', () => {
    const wrapper = mountDrawer({
      customer: buildCustomer({ fullName: '', phone: '', address: '' }),
      profile: buildProfile(),
    })

    expect(wrapper.find('footer button').attributes('disabled')).toBeUndefined()
  })

  it('keeps only payment and notes as per-order fields', () => {
    const wrapper = mountDrawer({ profile: buildProfile() })

    expect(wrapper.text()).not.toContain('Entrega')
    expect(wrapper.text()).toContain('Pagamento')
    expect(wrapper.text()).toContain('Observacoes')
  })

  it('shows Pix code guidance and keeps cash as store-only guidance', () => {
    const pixWrapper = mountDrawer({ profile: buildProfile() })
    expect(pixWrapper.find('[data-cy="checkout-payment-panel"]').text()).toContain('Codigo gerado no fechamento')
    expect(pixWrapper.find('option[value="cash"]').exists()).toBe(false)
    expect(pixWrapper.find('[data-cy="checkout-cash-store-only"]').text()).toContain('Dinheiro somente no caixa da loja.')
  })

  it('requires a region to be picked when active regions exist', () => {
    const wrapper = mountDrawer({
      profile: buildProfile(),
      deliveryRegions: [buildRegion()],
    })

    expect(wrapper.text()).toContain('Selecione a regiao.')
    expect(wrapper.find('footer button').attributes('disabled')).toBeDefined()
  })

  it('allows submitting once a region is selected', () => {
    const wrapper = mountDrawer({
      customer: buildCustomer({ deliveryRegionId: 1 }),
      profile: buildProfile(),
      deliveryRegions: [buildRegion()],
    })

    expect(wrapper.find('footer button').attributes('disabled')).toBeUndefined()
  })

  it('emits submitOrder when the footer button is clicked while valid', async () => {
    const wrapper = mountDrawer({ profile: buildProfile() })

    await wrapper.find('footer button').trigger('click')

    expect(wrapper.emitted('submitOrder')).toHaveLength(1)
  })

  it('emits updateCustomer with the notes text on input', async () => {
    const wrapper = mountDrawer({ profile: buildProfile() })

    await wrapper.find('textarea').setValue('Sem cebola')

    expect(wrapper.emitted('updateCustomer')?.[0]?.[0]).toEqual({
      notes: 'Sem cebola',
    })
  })

  it('emits updateCustomer with the payment method on change', async () => {
    const wrapper = mountDrawer({ profile: buildProfile() })

    await wrapper.find('select').setValue('card')

    expect(wrapper.emitted('updateCustomer')?.[0]?.[0]).toEqual({
      paymentMethod: 'card',
    })
  })
})
