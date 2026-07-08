import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SaleOrderDetailModal from '../SaleOrderDetailModal.vue'
import type { SaleOrderDetail } from '@/types/sales'

function buildOrderDetail(overrides: Partial<SaleOrderDetail> = {}): SaleOrderDetail {
  return {
    id: 1,
    order_reference: 'BPF-0001',
    status: 'prepared',
    channel: 'virtual',
    customer_name: 'Cliente Teste',
    customer_phone: '71999990000',
    customer_email: 'cliente@example.com',
    delivery_method: 'delivery',
    payment_method: 'pix',
    delivery_region_name: 'Centro',
    performed_by_username: null,
    subtotal: '50.00',
    delivery_fee: '5.00',
    total: '55.00',
    created_at: '2026-06-20T10:00:00Z',
    item_count: 1,
    items: [
      { id: 1, product_id: 9, product_name: 'Pizza Margherita', sku: '', quantity: 1, unit_price: '50.00', line_total: '50.00' },
    ],
    address: 'Rua das Flores, 123',
    neighborhood: 'Centro',
    city: 'Salvador',
    notes: 'Sem cebola, por favor',
    message: 'Pedido via WhatsApp',
    whatsapp_url: 'https://wa.me/5571999990000',
    ...overrides,
  }
}

const mountModal = (props: Partial<InstanceType<typeof SaleOrderDetailModal>['$props']> = {}) =>
  mount(SaleOrderDetailModal, {
    props: { show: true, order: buildOrderDetail(), isLoading: false, error: null, ...props },
    global: { stubs: { teleport: true } },
  })

describe('SaleOrderDetailModal', () => {
  it('renders the address, notes and whatsapp link for a delivery order', () => {
    const wrapper = mountModal()

    expect(wrapper.text()).toContain('Rua das Flores, 123')
    expect(wrapper.text()).toContain('Centro')
    expect(wrapper.text()).toContain('Sem cebola, por favor')
    expect(wrapper.find('a[href="https://wa.me/5571999990000"]').exists()).toBe(true)
  })

  it('does not render delivery address fields for a pickup order', () => {
    const wrapper = mountModal({
      order: buildOrderDetail({ delivery_method: 'pickup', address: '', neighborhood: '', city: '' }),
    })

    expect(wrapper.text()).not.toContain('Rua das Flores, 123')
  })

  it('shows a loading state instead of order content', () => {
    const wrapper = mountModal({ isLoading: true, order: null })

    expect(wrapper.find('.animate-pulse').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Cliente Teste')
  })

  it('shows an error message instead of order content', () => {
    const wrapper = mountModal({ error: 'Não foi possível carregar os detalhes deste pedido.', order: null })

    expect(wrapper.text()).toContain('Não foi possível carregar os detalhes deste pedido.')
  })

  it('emits close when the close button is clicked', async () => {
    const wrapper = mountModal()

    await wrapper.find('button[aria-label="Fechar"]').trigger('click')

    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('renders nothing when show is false', () => {
    const wrapper = mountModal({ show: false })

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })
})
