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
  deliveryMethod: 'pickup',
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

  it('shows guest identity and address fields when there is no profile', () => {
    const wrapper = mountDrawer({ customer: buildCustomer({ deliveryMethod: 'delivery' }) })

    expect(wrapper.find('input[autocomplete="name"]').exists()).toBe(true)
    expect(wrapper.find('input[autocomplete="tel"]').exists()).toBe(true)
    expect(wrapper.find('input[autocomplete="email"]').exists()).toBe(true)
    expect(wrapper.find('input[autocomplete="street-address"]').exists()).toBe(true)
    expect(wrapper.find('input[autocomplete="address-level3"]').exists()).toBe(true)
    expect(wrapper.find('input[autocomplete="address-level2"]').exists()).toBe(true)
  })

  it('hides identity and address fields and shows the saved-address hint when the profile is complete', () => {
    const wrapper = mountDrawer({
      customer: buildCustomer({ deliveryMethod: 'delivery' }),
      profile: buildProfile(),
    })

    expect(wrapper.find('input[autocomplete="name"]').exists()).toBe(false)
    expect(wrapper.find('input[autocomplete="tel"]').exists()).toBe(false)
    expect(wrapper.find('input[autocomplete="email"]').exists()).toBe(false)
    expect(wrapper.find('input[autocomplete="street-address"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Entregamos no endereço salvo no seu perfil.')
  })

  it('hides identity fields but still shows address fields when the profile has no saved address', () => {
    const wrapper = mountDrawer({
      customer: buildCustomer({ deliveryMethod: 'delivery' }),
      profile: buildProfile({ address: '', neighborhood: '', city: '' }),
    })

    expect(wrapper.find('input[autocomplete="name"]').exists()).toBe(false)
    expect(wrapper.find('input[autocomplete="tel"]').exists()).toBe(false)
    expect(wrapper.find('input[autocomplete="street-address"]').exists()).toBe(true)
    expect(wrapper.find('input[autocomplete="address-level3"]').exists()).toBe(true)
    expect(wrapper.find('input[autocomplete="address-level2"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Entregamos no endereço salvo no seu perfil.')
  })

  it('requires guest name and phone before allowing submission when there is no profile', () => {
    const wrapper = mountDrawer({ customer: buildCustomer({ fullName: '', phone: '' }) })

    expect(wrapper.text()).toContain('Informe seu nome e telefone para finalizar o pedido.')
    expect(wrapper.find('footer button').attributes('disabled')).toBeDefined()
  })

  it('requires guest address before allowing submission of a delivery order with no profile', () => {
    const wrapper = mountDrawer({
      customer: buildCustomer({ deliveryMethod: 'delivery', address: '', neighborhood: '', city: '' }),
    })

    expect(wrapper.text()).toContain('Informe endereco, bairro e cidade para receber em casa.')
    expect(wrapper.find('footer button').attributes('disabled')).toBeDefined()
  })

  it('does not require guest fields when a complete profile is present', () => {
    const wrapper = mountDrawer({
      customer: buildCustomer({ deliveryMethod: 'delivery', fullName: '', phone: '', address: '' }),
      profile: buildProfile(),
    })

    expect(wrapper.find('footer button').attributes('disabled')).toBeUndefined()
  })

  it('still lets the customer choose delivery method, payment method and notes', () => {
    const wrapper = mountDrawer()

    expect(wrapper.text()).toContain('Entrega')
    expect(wrapper.text()).toContain('Pagamento')
    expect(wrapper.text()).toContain('Observacoes')
  })

  it('requires a delivery region to be picked when regions exist for a delivery order', () => {
    const wrapper = mountDrawer({
      customer: buildCustomer({ deliveryMethod: 'delivery' }),
      deliveryRegions: [buildRegion()],
    })

    expect(wrapper.text()).toContain('Selecione a regiao de entrega.')
    expect(wrapper.find('footer button').attributes('disabled')).toBeDefined()
  })

  it('allows submitting a delivery order once a region is selected', () => {
    const wrapper = mountDrawer({
      customer: buildCustomer({ deliveryMethod: 'delivery', deliveryRegionId: 1 }),
      deliveryRegions: [buildRegion()],
    })

    expect(wrapper.find('footer button').attributes('disabled')).toBeUndefined()
  })

  it('emits submitOrder when the footer button is clicked while valid', async () => {
    const wrapper = mountDrawer()

    await wrapper.find('footer button').trigger('click')

    expect(wrapper.emitted('submitOrder')).toHaveLength(1)
  })

  it('emits updateCustomer with the notes text on input', async () => {
    const wrapper = mountDrawer()

    await wrapper.find('textarea').setValue('Sem cebola')

    expect(wrapper.emitted('updateCustomer')?.[0]?.[0]).toEqual({ notes: 'Sem cebola' })
  })

  it('emits updateCustomer with guest identity fields on input', async () => {
    const wrapper = mountDrawer()

    await wrapper.find('input[autocomplete="name"]').setValue('Joao Convidado')
    await wrapper.find('input[autocomplete="tel"]').setValue('11955554444')

    const emitted = wrapper.emitted('updateCustomer') ?? []
    expect(emitted).toContainEqual([{ fullName: 'Joao Convidado' }])
    expect(emitted).toContainEqual([{ phone: '11955554444' }])
  })
})
