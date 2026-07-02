import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import DashboardStockMovementsView from '../DashboardStockMovementsView.vue'
import { useCurrentStore } from '@/composables/useCurrentStore'
import { useProducts } from '@/composables/useProducts'
import StockMovementService from '@/services/stockMovement.service'
import * as csvUtils from '@/utils/csv'
import type { StockMovement } from '@/types/stockMovement'

vi.mock('@/composables/useCurrentStore', () => ({ useCurrentStore: vi.fn() }))
vi.mock('@/composables/useProducts', () => ({ useProducts: vi.fn() }))
vi.mock('@/services/stockMovement.service', () => ({
  default: { list: vi.fn() },
}))

function buildMovement(overrides: Partial<StockMovement> = {}): StockMovement {
  return {
    id: 1,
    product: 10,
    product_name: 'Produto Teste',
    product_sku: 'SKU-1',
    movement_type: 'entrada',
    movement_type_display: 'Entrada',
    quantity: 5,
    previous_stock: 10,
    new_stock: 15,
    reason: 'compra',
    reason_display: 'Compra',
    source: 'manual',
    source_display: 'Manual',
    sale_order: null,
    sale_order_reference: null,
    performed_by: 1,
    performed_by_username: 'operador',
    notes: '',
    created_at: '2026-06-26T10:00:00-03:00',
    ...overrides,
  }
}

function buildResponse(results: StockMovement[], overrides: Partial<{ count: number; total_pages: number }> = {}) {
  return {
    count: results.length,
    next: null,
    previous: null,
    page_size: 50,
    total_pages: 1,
    results,
    ...overrides,
  }
}

describe('DashboardStockMovementsView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useCurrentStore).mockReturnValue({ selectedStore: ref(null) } as any)
    vi.mocked(useProducts).mockReturnValue({
      products: ref([{ id: 10, name: 'Produto Teste' }]),
      fetchData: vi.fn(),
    } as any)
  })

  it('shows the loading skeleton while the request is in flight', async () => {
    let resolveList: (value: ReturnType<typeof buildResponse>) => void = () => {}
    vi.mocked(StockMovementService.list).mockReturnValue(
      new Promise((resolve) => { resolveList = resolve })
    )

    const wrapper = mount(DashboardStockMovementsView)
    await flushPromises()

    expect(wrapper.find('[data-cy="loading-skeleton"]').exists()).toBe(true)

    resolveList(buildResponse([]))
    await flushPromises()

    expect(wrapper.find('[data-cy="loading-skeleton"]').exists()).toBe(false)
  })

  it('shows an error state with a retry button', async () => {
    vi.mocked(StockMovementService.list).mockRejectedValue(new Error('network down'))

    const wrapper = mount(DashboardStockMovementsView)
    await flushPromises()

    expect(wrapper.find('[data-cy="error-state"]').exists()).toBe(true)

    vi.mocked(StockMovementService.list).mockResolvedValue(buildResponse([buildMovement()]))
    await wrapper.find('[data-cy="btn-retry"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-cy="error-state"]').exists()).toBe(false)
    expect(wrapper.find('[data-cy="stock-ledger-table"]').exists()).toBe(true)
  })

  it('shows the empty state when there are no movements', async () => {
    vi.mocked(StockMovementService.list).mockResolvedValue(buildResponse([]))

    const wrapper = mount(DashboardStockMovementsView)
    await flushPromises()

    expect(wrapper.find('[data-cy="empty-state"]').exists()).toBe(true)
  })

  it('renders a row per movement with type, quantity and balance', async () => {
    vi.mocked(StockMovementService.list).mockResolvedValue(
      buildResponse([buildMovement({ movement_type: 'saida', quantity: 3, previous_stock: 10, new_stock: 7 })])
    )

    const wrapper = mount(DashboardStockMovementsView)
    await flushPromises()

    const row = wrapper.find('[data-cy="stock-ledger-row"]')
    expect(row.text()).toContain('Produto Teste')
    expect(row.text()).toContain('SKU-1')
    expect(row.text()).toContain('Saída')
    expect(row.text()).toContain('-3')
    expect(row.text()).toContain('10 → 7')
  })

  it('disables CSV export when there are no movements and enables it otherwise', async () => {
    vi.mocked(StockMovementService.list).mockResolvedValue(buildResponse([]))
    const emptyWrapper = mount(DashboardStockMovementsView)
    await flushPromises()
    expect(
      (emptyWrapper.find('[data-cy="btn-export-csv"]').element as HTMLButtonElement).disabled
    ).toBe(true)

    vi.mocked(StockMovementService.list).mockResolvedValue(buildResponse([buildMovement()]))
    const filledWrapper = mount(DashboardStockMovementsView)
    await flushPromises()
    expect(
      (filledWrapper.find('[data-cy="btn-export-csv"]').element as HTMLButtonElement).disabled
    ).toBe(false)
  })

  it('calls downloadCsv with a row per movement when exporting', async () => {
    const downloadCsvSpy = vi.spyOn(csvUtils, 'downloadCsv').mockImplementation(() => {})
    vi.mocked(StockMovementService.list).mockResolvedValue(
      buildResponse([buildMovement()])
    )

    const wrapper = mount(DashboardStockMovementsView)
    await flushPromises()
    await wrapper.find('[data-cy="btn-export-csv"]').trigger('click')

    expect(downloadCsvSpy).toHaveBeenCalledTimes(1)
    const call = downloadCsvSpy.mock.calls[0]
    expect(call).toBeDefined()
    const [filename, headers, rows] = call!
    expect(filename).toMatch(/^movimentacoes-estoque-.*\.csv$/)
    expect(headers).toContain('Produto')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toContain('Produto Teste')
  })

  it('refetches with the selected filter when a select changes', async () => {
    vi.mocked(StockMovementService.list).mockResolvedValue(buildResponse([buildMovement()]))

    const wrapper = mount(DashboardStockMovementsView)
    await flushPromises()

    await wrapper.find('[data-cy="filter-movement-type"]').setValue('saida')
    await flushPromises()

    expect(StockMovementService.list).toHaveBeenLastCalledWith(
      { movement_type: 'saida' },
      1,
      50
    )
  })

  it('offers PDV as a source filter option (Etapa 5 of the QR-code stock-exit evolution)', async () => {
    vi.mocked(StockMovementService.list).mockResolvedValue(buildResponse([buildMovement({ source: 'pdv' })]))

    const wrapper = mount(DashboardStockMovementsView)
    await flushPromises()

    await wrapper.find('[data-cy="filter-source"]').setValue('pdv')
    await flushPromises()

    expect(StockMovementService.list).toHaveBeenLastCalledWith({ source: 'pdv' }, 1, 50)
  })

  it('disables the previous-page button on the first page and enables next when more pages exist', async () => {
    vi.mocked(StockMovementService.list).mockResolvedValue(
      buildResponse([buildMovement()], { total_pages: 2 })
    )

    const wrapper = mount(DashboardStockMovementsView)
    await flushPromises()

    expect(
      (wrapper.find('[data-cy="btn-prev-page"]').element as HTMLButtonElement).disabled
    ).toBe(true)
    expect(
      (wrapper.find('[data-cy="btn-next-page"]').element as HTMLButtonElement).disabled
    ).toBe(false)
  })
})
