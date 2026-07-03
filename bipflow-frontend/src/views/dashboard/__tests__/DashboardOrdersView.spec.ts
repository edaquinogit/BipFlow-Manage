import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import DashboardOrdersView from '../DashboardOrdersView.vue'
import { useCurrentStore } from '@/composables/useCurrentStore'
import { useCurrentUser } from '@/composables/useCurrentUser'
import { useToast } from '@/composables/useToast'
import { salesService } from '@/services/sales.service'
import type { PaginatedSalesOrdersResponse, SaleOrder } from '@/types/sales'

vi.mock('@/composables/useCurrentStore', () => ({ useCurrentStore: vi.fn() }))
vi.mock('@/composables/useCurrentUser', () => ({ useCurrentUser: vi.fn() }))
vi.mock('@/composables/useToast', () => ({ useToast: vi.fn() }))
vi.mock('@/services/sales.service', () => ({
  salesService: {
    list: vi.fn(),
    updateStatus: vi.fn(),
  },
}))

function buildOrder(overrides: Partial<SaleOrder> = {}): SaleOrder {
  return {
    id: 1,
    order_reference: 'BPF-0001',
    status: 'prepared',
    channel: 'virtual',
    customer_name: 'Cliente Teste',
    customer_phone: '71999990000',
    customer_email: '',
    delivery_method: 'pickup',
    payment_method: 'pix',
    delivery_region_name: '',
    performed_by_username: null,
    subtotal: '50.00',
    delivery_fee: '0.00',
    total: '50.00',
    created_at: '2026-06-20T10:00:00Z',
    item_count: 1,
    items: [],
    ...overrides,
  }
}

function buildResponse(results: SaleOrder[]): PaginatedSalesOrdersResponse {
  return { count: results.length, next: null, previous: null, page_size: 20, total_pages: 1, results }
}

describe('DashboardOrdersView', () => {
  const toastState = { success: vi.fn(), error: vi.fn() }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useCurrentStore).mockReturnValue({ selectedStore: ref(null) } as any)
    vi.mocked(useCurrentUser).mockReturnValue({ canManageCatalog: ref(true) } as any)
    vi.mocked(useToast).mockReturnValue(toastState as any)
  })

  it('shows the loading skeleton while the history request is in flight', async () => {
    let resolveList: (value: PaginatedSalesOrdersResponse) => void = () => {}
    vi.mocked(salesService.list).mockReturnValue(new Promise((resolve) => { resolveList = resolve }))

    const wrapper = mount(DashboardOrdersView)
    await flushPromises()

    expect(wrapper.find('.animate-pulse').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Nenhuma venda registrada ainda.')

    resolveList(buildResponse([]))
    await flushPromises()

    expect(wrapper.text()).toContain('Nenhuma venda registrada ainda.')
  })

  it('shows an error banner when the history request fails', async () => {
    vi.mocked(salesService.list).mockRejectedValue(new Error('network down'))

    const wrapper = mount(DashboardOrdersView)
    await flushPromises()

    expect(wrapper.text()).toContain('Não foi possível carregar o histórico agora.')
  })

  it('shows the empty state when there are no orders', async () => {
    vi.mocked(salesService.list).mockResolvedValue(buildResponse([]))

    const wrapper = mount(DashboardOrdersView)
    await flushPromises()

    expect(wrapper.text()).toContain('Nenhuma venda registrada ainda.')
  })

  it('renders fetched orders with their status label', async () => {
    vi.mocked(salesService.list).mockResolvedValue(buildResponse([buildOrder()]))

    const wrapper = mount(DashboardOrdersView)
    await flushPromises()

    expect(wrapper.text()).toContain('Cliente Teste')
    expect(wrapper.text()).toContain('Novo')
  })

  it('shows a channel badge distinguishing PDV sales from virtual orders (Etapa 3/5 of the QR-code stock-exit evolution)', async () => {
    vi.mocked(salesService.list).mockResolvedValue(
      buildResponse([buildOrder({ id: 1, channel: 'loja_fisica' }), buildOrder({ id: 2, channel: 'virtual' })])
    )

    const wrapper = mount(DashboardOrdersView)
    await flushPromises()

    expect(wrapper.text()).toContain('Loja fisica')
    expect(wrapper.text()).toContain('Virtual')
  })

  it('shows the operator badge only for PDV sales with a known operator (Etapa R3 of the QR-code stock-exit refinement)', async () => {
    vi.mocked(salesService.list).mockResolvedValue(
      buildResponse([
        buildOrder({ id: 1, channel: 'loja_fisica', performed_by_username: 'caixa1' }),
        buildOrder({ id: 2, channel: 'loja_fisica', performed_by_username: null }),
        buildOrder({ id: 3, channel: 'virtual', performed_by_username: 'caixa1' }),
      ])
    )

    const wrapper = mount(DashboardOrdersView)
    await flushPromises()

    const badges = wrapper.findAll('[data-cy="sale-operator-badge"]')
    expect(badges).toHaveLength(1)
    expect(badges[0]?.text()).toContain('caixa1')
  })

  it('updates the sale status and reflects the change without refetching', async () => {
    vi.mocked(salesService.list).mockResolvedValue(buildResponse([buildOrder()]))
    vi.mocked(salesService.updateStatus).mockResolvedValue(buildOrder({ status: 'sent' }))

    const wrapper = mount(DashboardOrdersView)
    await flushPromises()

    const statusSelect = wrapper.find('article select')
    await statusSelect.setValue('sent')
    await flushPromises()

    expect(salesService.updateStatus).toHaveBeenCalledWith(1, 'sent')
    expect(toastState.success).toHaveBeenCalledWith('Status do pedido atualizado.')
    expect(salesService.list).toHaveBeenCalledTimes(1)
  })

  it('asks for confirmation instead of cancelling immediately (Etapa R2 of the QR-code stock-exit refinement)', async () => {
    vi.mocked(salesService.list).mockResolvedValue(buildResponse([buildOrder({ item_count: 2 })]))

    const wrapper = mount(DashboardOrdersView, { global: { stubs: { teleport: true } } })
    await flushPromises()

    const statusSelect = wrapper.find('article select')
    await statusSelect.setValue('cancelled')
    await flushPromises()

    // The cancellation itself must not fire until the confirmation is accepted.
    expect(salesService.updateStatus).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Cancelar pedido?')
    expect(wrapper.text()).toContain('estoque de 2 item(ns) sera devolvido')
  })

  it('cancels the order only after the confirmation is accepted', async () => {
    vi.mocked(salesService.list).mockResolvedValue(buildResponse([buildOrder()]))
    vi.mocked(salesService.updateStatus).mockResolvedValue(buildOrder({ status: 'cancelled' }))

    const wrapper = mount(DashboardOrdersView, { global: { stubs: { teleport: true } } })
    await flushPromises()

    await wrapper.find('article select').setValue('cancelled')
    await flushPromises()

    const confirmButton = wrapper.findAll('button').find((button) => button.text().includes('Confirmar cancelamento'))
    expect(confirmButton).toBeTruthy()
    await confirmButton!.trigger('click')
    await flushPromises()

    expect(salesService.updateStatus).toHaveBeenCalledWith(1, 'cancelled')
    expect(toastState.success).toHaveBeenCalledWith('Status do pedido atualizado.')
  })

  it('does not cancel the order when the confirmation is dismissed', async () => {
    vi.mocked(salesService.list).mockResolvedValue(buildResponse([buildOrder()]))

    const wrapper = mount(DashboardOrdersView, { global: { stubs: { teleport: true } } })
    await flushPromises()

    await wrapper.find('article select').setValue('cancelled')
    await flushPromises()

    const cancelButton = wrapper.findAll('button').find((button) => button.text().includes('Cancelar') && !button.text().includes('cancelamento'))
    expect(cancelButton).toBeTruthy()
    await cancelButton!.trigger('click')
    await flushPromises()

    expect(salesService.updateStatus).not.toHaveBeenCalled()
    expect(wrapper.text()).not.toContain('Cancelar pedido?')
  })
})
