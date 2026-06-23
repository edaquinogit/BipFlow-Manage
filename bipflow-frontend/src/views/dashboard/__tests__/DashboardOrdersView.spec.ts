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
    customer_name: 'Cliente Teste',
    customer_phone: '71999990000',
    customer_email: '',
    delivery_method: 'pickup',
    payment_method: 'pix',
    delivery_region_name: '',
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

    expect(wrapper.text()).toContain('Nao foi possivel carregar o historico agora.')
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
})
