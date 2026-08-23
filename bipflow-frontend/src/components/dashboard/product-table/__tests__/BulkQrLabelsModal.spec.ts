import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import BulkQrLabelsModal from '../BulkQrLabelsModal.vue'
import ProductService from '@/services/product.service'
import { buildProductLabelsPdf } from '@/utils/productLabelsPdf'
import { DEFAULT_PRODUCT_LABEL_SETTINGS, type ProductBulkLabel } from '@/types/productLabel'

vi.mock('@/services/product.service', () => ({
  default: { getQrCodesBulk: vi.fn() },
}))

vi.mock('@/utils/productLabelsPdf', () => ({
  buildProductLabelsPdf: vi.fn(),
}))

const buildLabel = (overrides: Partial<ProductBulkLabel> = {}): ProductBulkLabel => ({
  id: 1,
  public_code: 'ABCD2345',
  name: 'Produto teste',
  price: '19.90',
  size: null,
  url: 'https://loja.bipflow.app/l/loja-b/p/ABCD2345',
  qr_code: 'data:image/png;base64,AAAA',
  ...overrides,
})

const buildBulkResponse = (
  labels: ProductBulkLabel[],
  missingIds: number[] = []
) => ({
  labels,
  missing_ids: missingIds,
  settings: { ...DEFAULT_PRODUCT_LABEL_SETTINGS },
})

const mountModal = (props: Partial<{ show: boolean; productIds: number[] }> = {}) =>
  mount(BulkQrLabelsModal, {
    props: {
      show: true,
      productIds: [1, 2],
      ...props,
    },
    // Render the Teleport target inline instead of moving it to <body> so
    // wrapper.find() can reach it directly (same pattern as ProductLabelModal.spec.ts).
    global: {
      stubs: { teleport: true },
    },
  })

describe('BulkQrLabelsModal (Etapa 6 of the QR-code stock-exit evolution)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not render when show is false', () => {
    const wrapper = mountModal({ show: false })

    expect(wrapper.find('[data-cy="btn-print-labels"]').exists()).toBe(false)
  })

  it('fetches and renders the label grid when opened', async () => {
    vi.mocked(ProductService.getQrCodesBulk).mockResolvedValue(
      buildBulkResponse([buildLabel({ id: 1 }), buildLabel({ id: 2, name: 'Produto B' })])
    )

    const wrapper = mountModal()
    await flushPromises()

    expect(ProductService.getQrCodesBulk).toHaveBeenCalledWith([1, 2])
    expect(wrapper.findAll('[data-cy="qr-bulk-label-card"]')).toHaveLength(2)
    expect(wrapper.find('[data-cy="qr-bulk-missing-warning"]').exists()).toBe(false)
  })

  it('shows the size chip only for labels that have a size', async () => {
    vi.mocked(ProductService.getQrCodesBulk).mockResolvedValue(
      buildBulkResponse([buildLabel({ id: 1, size: 'M' }), buildLabel({ id: 2, size: null })])
    )

    const wrapper = mountModal()
    await flushPromises()

    expect(wrapper.findAll('[data-cy="qr-bulk-label-size"]')).toHaveLength(1)
  })

  it('shows a non-blocking warning when some selected products were not found', async () => {
    vi.mocked(ProductService.getQrCodesBulk).mockResolvedValue(
      buildBulkResponse([buildLabel({ id: 1 })], [2])
    )

    const wrapper = mountModal()
    await flushPromises()

    expect(wrapper.find('[data-cy="qr-bulk-missing-warning"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-cy="qr-bulk-label-card"]')).toHaveLength(1)
    expect(wrapper.find('[data-cy="btn-print-labels"]').attributes('disabled')).toBeUndefined()
  })

  it('shows an empty state and disables actions when every selected product is missing', async () => {
    vi.mocked(ProductService.getQrCodesBulk).mockResolvedValue(buildBulkResponse([], [1, 2]))

    const wrapper = mountModal()
    await flushPromises()

    expect(wrapper.find('[data-cy="qr-bulk-labels-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-cy="btn-print-labels"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-cy="btn-download-labels-pdf"]').attributes('disabled')).toBeDefined()
  })

  it('shows an error state when the request fails', async () => {
    vi.mocked(ProductService.getQrCodesBulk).mockRejectedValue(new Error('network error'))

    const wrapper = mountModal()
    await flushPromises()

    expect(wrapper.find('[data-cy="qr-bulk-labels-error"]').exists()).toBe(true)
  })

  it('emits close when the close button is clicked', async () => {
    vi.mocked(ProductService.getQrCodesBulk).mockResolvedValue(buildBulkResponse([buildLabel()]))

    const wrapper = mountModal()
    await flushPromises()
    await wrapper.find('.cancel-button').trigger('click')

    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('calls window.print() when the print button is clicked', async () => {
    vi.mocked(ProductService.getQrCodesBulk).mockResolvedValue(buildBulkResponse([buildLabel()]))
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => undefined)

    const wrapper = mountModal()
    await flushPromises()
    await wrapper.find('[data-cy="btn-print-labels"]').trigger('click')

    expect(printSpy).toHaveBeenCalledTimes(1)
  })

  it('builds and saves a PDF when the download button is clicked', async () => {
    const labels = [buildLabel()]
    vi.mocked(ProductService.getQrCodesBulk).mockResolvedValue(buildBulkResponse(labels))
    const saveSpy = vi.fn()
    vi.mocked(buildProductLabelsPdf).mockReturnValue({ save: saveSpy } as unknown as ReturnType<typeof buildProductLabelsPdf>)

    const wrapper = mountModal()
    await flushPromises()
    await wrapper.find('[data-cy="btn-download-labels-pdf"]').trigger('click')

    expect(buildProductLabelsPdf).toHaveBeenCalledWith(labels, DEFAULT_PRODUCT_LABEL_SETTINGS)
    expect(saveSpy).toHaveBeenCalledWith('etiquetas-produtos.pdf')
  })
})
