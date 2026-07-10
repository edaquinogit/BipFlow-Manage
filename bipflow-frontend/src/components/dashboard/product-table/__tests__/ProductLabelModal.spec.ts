import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ProductLabelModal from '../ProductLabelModal.vue'
import ProductService from '@/services/product.service'
import type { Product } from '@/schemas/product.schema'

vi.mock('@/services/product.service', () => ({
  default: { getQrCode: vi.fn() },
}))

const product = {
  id: 1,
  name: 'Produto teste',
  price: 19.9,
  stock_quantity: 5,
  is_available: true,
  low_stock_threshold: null,
  public_code: 'ABCD2345',
} as Product

const mountModal = (props: Partial<{ show: boolean; product: Product | null }> = {}) =>
  mount(ProductLabelModal, {
    props: {
      show: true,
      product,
      ...props,
    },
    // Render the Teleport target inline instead of moving it to <body> so
    // wrapper.find() can reach it directly (same pattern as StockMovementModal.spec.ts).
    global: {
      stubs: { teleport: true },
    },
  })

describe('ProductLabelModal (Etapa 2 of the QR-code stock-exit evolution)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not render when show is false', () => {
    const wrapper = mountModal({ show: false })

    expect(wrapper.find('[data-cy="btn-print-label"]').exists()).toBe(false)
  })

  it('fetches and renders the QR Code label when opened', async () => {
    vi.mocked(ProductService.getQrCode).mockResolvedValue({
      public_code: 'ABCD2345',
      url: 'https://loja.bipflow.app/l/loja-b/p/ABCD2345',
      qr_code: 'data:image/png;base64,AAAA',
    })

    const wrapper = mountModal()
    await flushPromises()

    expect(ProductService.getQrCode).toHaveBeenCalledWith(1)
    expect(wrapper.find('[data-cy="qr-printable-label"]').exists()).toBe(true)
    expect(wrapper.find('[data-cy="qr-label-image"]').attributes('src')).toBe(
      'data:image/png;base64,AAAA'
    )
    expect(wrapper.text()).toContain('ABCD2345')
  })

  it('shows an error state when the QR Code request fails', async () => {
    vi.mocked(ProductService.getQrCode).mockRejectedValue(new Error('network error'))

    const wrapper = mountModal()
    await flushPromises()

    expect(wrapper.find('[data-cy="qr-label-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-cy="btn-print-label"]').attributes('disabled')).toBeDefined()
  })

  it('emits close when the close button is clicked', async () => {
    vi.mocked(ProductService.getQrCode).mockResolvedValue({
      public_code: 'ABCD2345',
      url: 'https://loja.bipflow.app/l/loja-b/p/ABCD2345',
      qr_code: 'data:image/png;base64,AAAA',
    })

    const wrapper = mountModal()
    await flushPromises()

    await wrapper.find('.cancel-button').trigger('click')

    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('shows the size chip when the product has a size', async () => {
    vi.mocked(ProductService.getQrCode).mockResolvedValue({
      public_code: 'ABCD2345',
      url: 'https://loja.bipflow.app/l/loja-b/p/ABCD2345',
      qr_code: 'data:image/png;base64,AAAA',
    })

    const wrapper = mountModal({ product: { ...product, size: 'M' } })
    await flushPromises()

    expect(wrapper.find('[data-cy="qr-label-size"]').text()).toContain('M')
  })

  it('hides the size chip when the product has no size', async () => {
    vi.mocked(ProductService.getQrCode).mockResolvedValue({
      public_code: 'ABCD2345',
      url: 'https://loja.bipflow.app/l/loja-b/p/ABCD2345',
      qr_code: 'data:image/png;base64,AAAA',
    })

    const wrapper = mountModal()
    await flushPromises()

    expect(wrapper.find('[data-cy="qr-label-size"]').exists()).toBe(false)
  })

  it('calls window.print() when the print button is clicked', async () => {
    vi.mocked(ProductService.getQrCode).mockResolvedValue({
      public_code: 'ABCD2345',
      url: 'https://loja.bipflow.app/l/loja-b/p/ABCD2345',
      qr_code: 'data:image/png;base64,AAAA',
    })
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => undefined)

    const wrapper = mountModal()
    await flushPromises()
    await wrapper.find('[data-cy="btn-print-label"]').trigger('click')

    expect(printSpy).toHaveBeenCalledTimes(1)
  })
})
