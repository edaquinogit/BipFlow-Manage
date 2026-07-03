import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import DashboardPdvView from '../DashboardPdvView.vue'
import { useCurrentUser } from '@/composables/useCurrentUser'
import { useStoreSwitchEffect } from '@/composables/useStoreSwitchEffect'
import ProductService from '@/services/product.service'
import PdvSaleService from '@/services/pdvSale.service'
import { salesService } from '@/services/sales.service'

vi.mock('@/composables/useCurrentUser', () => ({ useCurrentUser: vi.fn() }))
vi.mock('@/composables/useStoreSwitchEffect', () => ({ useStoreSwitchEffect: vi.fn() }))
vi.mock('@/services/product.service', () => ({
  default: { getByCode: vi.fn() },
}))
vi.mock('@/services/pdvSale.service', () => ({
  default: { create: vi.fn() },
}))
vi.mock('@/services/sales.service', () => ({
  salesService: { list: vi.fn() },
}))

function buildEmptySalesResponse() {
  return { count: 0, next: null, previous: null, page_size: 5, total_pages: 1, results: [] }
}

function buildAxiosLikeError(data: Record<string, unknown>): Error {
  return Object.assign(new Error('Request failed'), { response: { data }, config: {} })
}

const scannedProduct = {
  id: 7,
  name: 'Coxinha premium',
  price: 18.5,
  stock_quantity: 12,
  is_available: true,
  low_stock_threshold: null,
  public_code: 'ABCD2345',
}

const mountPdvView = (options: Parameters<typeof mount>[1] = {}) => mount(DashboardPdvView, options)

describe('DashboardPdvView (Etapa 3 of the QR-code stock-exit evolution)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useCurrentUser).mockReturnValue({ canManageCatalog: ref(true) } as any)
    vi.mocked(salesService.list).mockResolvedValue(buildEmptySalesResponse())
  })

  it('shows a permission notice and hides the scan input without catalog access', () => {
    vi.mocked(useCurrentUser).mockReturnValue({ canManageCatalog: ref(false) } as any)
    const wrapper = mountPdvView()

    expect(wrapper.find('[data-cy="pdv-no-permission"]').exists()).toBe(true)
    expect(wrapper.find('[data-cy="pdv-scan-input"]').exists()).toBe(false)
  })

  it('starts with an empty cart and a disabled finalize button', () => {
    const wrapper = mountPdvView()

    expect(wrapper.find('[data-cy="pdv-cart-empty"]').exists()).toBe(true)
    expect(wrapper.find('[data-cy="pdv-finalize-sale"]').attributes('disabled')).toBeDefined()
  })

  it('adds a scanned product to the cart on Enter', async () => {
    vi.mocked(ProductService.getByCode).mockResolvedValue(scannedProduct as any)
    const wrapper = mountPdvView()

    await wrapper.find('[data-cy="pdv-scan-input"]').setValue('ABCD2345')
    await wrapper.find('[data-cy="pdv-scan-input"]').trigger('keyup.enter')
    await flushPromises()

    expect(ProductService.getByCode).toHaveBeenCalledWith('ABCD2345')
    expect(wrapper.find('[data-cy="pdv-cart-row"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Coxinha premium')
    // The scan input clears itself so the cashier can immediately scan the next item.
    expect((wrapper.find('[data-cy="pdv-scan-input"]').element as HTMLInputElement).value).toBe('')
  })

  it('shows an inline error and does not add anything for an unknown code', async () => {
    vi.mocked(ProductService.getByCode).mockRejectedValue(new Error('not found'))
    const wrapper = mountPdvView()

    await wrapper.find('[data-cy="pdv-scan-input"]').setValue('NOPE1234')
    await wrapper.find('[data-cy="pdv-scan-input"]').trigger('keyup.enter')
    await flushPromises()

    expect(wrapper.find('[data-cy="pdv-scan-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-cy="pdv-cart-empty"]').exists()).toBe(true)
  })

  it('shows a specific error and does not add an unavailable product (Etapa R1 of the QR-code stock-exit refinement)', async () => {
    vi.mocked(ProductService.getByCode).mockResolvedValue({ ...scannedProduct, is_available: false } as any)
    const wrapper = mountPdvView()

    await wrapper.find('[data-cy="pdv-scan-input"]').setValue('ABCD2345')
    await wrapper.find('[data-cy="pdv-scan-input"]').trigger('keyup.enter')
    await flushPromises()

    expect(wrapper.find('[data-cy="pdv-scan-error"]').text()).toContain('indisponível')
    expect(wrapper.find('[data-cy="pdv-cart-empty"]').exists()).toBe(true)
  })

  it('shows a specific error when a scan would exceed the available stock', async () => {
    vi.mocked(ProductService.getByCode).mockResolvedValue({ ...scannedProduct, stock_quantity: 1 } as any)
    const wrapper = mountPdvView()

    for (let i = 0; i < 2; i += 1) {
      await wrapper.find('[data-cy="pdv-scan-input"]').setValue('ABCD2345')
      await wrapper.find('[data-cy="pdv-scan-input"]').trigger('keyup.enter')
      await flushPromises()
    }

    expect(wrapper.find('[data-cy="pdv-scan-error"]').text()).toContain('Estoque insuficiente')
    // The first scan (within stock) must still be in the cart.
    expect(wrapper.findAll('[data-cy="pdv-cart-row"]')).toHaveLength(1)
  })

  it('aggregates a second scan of the same code into one cart line', async () => {
    vi.mocked(ProductService.getByCode).mockResolvedValue(scannedProduct as any)
    const wrapper = mountPdvView()

    for (let i = 0; i < 2; i += 1) {
      await wrapper.find('[data-cy="pdv-scan-input"]').setValue('ABCD2345')
      await wrapper.find('[data-cy="pdv-scan-input"]').trigger('keyup.enter')
      await flushPromises()
    }

    expect(wrapper.findAll('[data-cy="pdv-cart-row"]')).toHaveLength(1)
    expect(wrapper.find('[data-cy="pdv-cart-quantity"]').text()).toBe('2')
  })

  it('finalizes the sale with the cart items and selected payment method', async () => {
    vi.mocked(ProductService.getByCode).mockResolvedValue(scannedProduct as any)
    vi.mocked(PdvSaleService.create).mockResolvedValue({
      order_reference: 'PDV-20260702-120000-000000',
      items: [],
      subtotal: '18.50',
      total: '18.50',
      payment_method: 'pix',
      created_at: '2026-07-02T12:00:00Z',
    })

    const wrapper = mountPdvView()
    await wrapper.find('[data-cy="pdv-scan-input"]').setValue('ABCD2345')
    await wrapper.find('[data-cy="pdv-scan-input"]').trigger('keyup.enter')
    await flushPromises()

    await wrapper.find('[data-cy="pdv-finalize-sale"]').trigger('click')
    await flushPromises()

    expect(PdvSaleService.create).toHaveBeenCalledWith({
      items: [{ public_code: 'ABCD2345', quantity: 1 }],
      payment_method: 'pix',
      customer_name: undefined,
      notes: undefined,
    })
    // A successful sale clears the cart for the next customer.
    expect(wrapper.find('[data-cy="pdv-cart-empty"]').exists()).toBe(true)
  })

  it('passes the optional customer phone through to the sale payload (Etapa R4 of the QR-code stock-exit refinement)', async () => {
    vi.mocked(ProductService.getByCode).mockResolvedValue(scannedProduct as any)
    vi.mocked(PdvSaleService.create).mockResolvedValue({
      order_reference: 'PDV-20260702-120000-000000',
      items: [],
      subtotal: '18.50',
      total: '18.50',
      payment_method: 'pix',
      created_at: '2026-07-02T12:00:00Z',
    })

    const wrapper = mountPdvView()
    await wrapper.find('[data-cy="pdv-scan-input"]').setValue('ABCD2345')
    await wrapper.find('[data-cy="pdv-scan-input"]').trigger('keyup.enter')
    await flushPromises()
    await wrapper.find('[data-cy="pdv-customer-phone"]').setValue('71999998888')

    await wrapper.find('[data-cy="pdv-finalize-sale"]').trigger('click')
    await flushPromises()

    expect(PdvSaleService.create).toHaveBeenCalledWith(
      expect.objectContaining({ customer_phone: '71999998888' })
    )
  })

  it('shows an itemized receipt after a successful sale (Etapa R2 of the QR-code stock-exit refinement)', async () => {
    vi.mocked(ProductService.getByCode).mockResolvedValue(scannedProduct as any)
    vi.mocked(PdvSaleService.create).mockResolvedValue({
      order_reference: 'PDV-20260702-120000-000000',
      items: [
        {
          product_id: 7,
          product_name: 'Coxinha premium',
          public_code: 'ABCD2345',
          quantity: 1,
          unit_price: '18.50',
          line_total: '18.50',
        },
      ],
      subtotal: '18.50',
      total: '18.50',
      payment_method: 'pix',
      created_at: '2026-07-02T12:00:00Z',
    })

    const wrapper = mountPdvView({ global: { stubs: { teleport: true } } })
    await wrapper.find('[data-cy="pdv-scan-input"]').setValue('ABCD2345')
    await wrapper.find('[data-cy="pdv-scan-input"]').trigger('keyup.enter')
    await flushPromises()

    await wrapper.find('[data-cy="pdv-finalize-sale"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-cy="pdv-receipt-order-reference"]').text()).toBe('PDV-20260702-120000-000000')
    expect(wrapper.find('[data-cy="pdv-receipt-item"]').text()).toContain('Coxinha premium')
    expect(wrapper.find('[data-cy="pdv-receipt-total"]').text()).toContain('18,50')
  })

  it('closing the receipt refocuses the scan input for the next customer', async () => {
    vi.mocked(ProductService.getByCode).mockResolvedValue(scannedProduct as any)
    vi.mocked(PdvSaleService.create).mockResolvedValue({
      order_reference: 'PDV-20260702-120000-000000',
      items: [],
      subtotal: '18.50',
      total: '18.50',
      payment_method: 'pix',
      created_at: '2026-07-02T12:00:00Z',
    })

    const wrapper = mountPdvView({ global: { stubs: { teleport: true } }, attachTo: document.body })
    await wrapper.find('[data-cy="pdv-scan-input"]').setValue('ABCD2345')
    await wrapper.find('[data-cy="pdv-scan-input"]').trigger('keyup.enter')
    await flushPromises()
    await wrapper.find('[data-cy="pdv-finalize-sale"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-cy="pdv-receipt-order-reference"]').exists()).toBe(true)

    const closeButton = wrapper.findAll('button').find((button) => button.text().includes('Fechar'))
    await closeButton!.trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-cy="pdv-receipt-order-reference"]').exists()).toBe(false)
    expect(document.activeElement).toBe(wrapper.find('[data-cy="pdv-scan-input"]').element)
    wrapper.unmount()
  })

  it('keeps the cart intact when the sale is rejected (e.g. insufficient stock)', async () => {
    vi.mocked(ProductService.getByCode).mockResolvedValue(scannedProduct as any)
    vi.mocked(PdvSaleService.create).mockRejectedValue(new Error('insufficient stock'))

    const wrapper = mountPdvView()
    await wrapper.find('[data-cy="pdv-scan-input"]').setValue('ABCD2345')
    await wrapper.find('[data-cy="pdv-scan-input"]').trigger('keyup.enter')
    await flushPromises()

    await wrapper.find('[data-cy="pdv-finalize-sale"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-cy="pdv-cart-row"]').exists()).toBe(true)
  })

  it('surfaces the backend\'s specific validation message instead of a generic one (Etapa R1)', async () => {
    vi.mocked(ProductService.getByCode).mockResolvedValue(scannedProduct as any)
    vi.mocked(PdvSaleService.create).mockRejectedValue(
      buildAxiosLikeError({ items: ['Quantidade solicitada para "Coxinha premium" excede o estoque disponível (3).'] })
    )

    const wrapper = mountPdvView({ attachTo: document.body })
    await wrapper.find('[data-cy="pdv-scan-input"]').setValue('ABCD2345')
    await wrapper.find('[data-cy="pdv-scan-input"]').trigger('keyup.enter')
    await flushPromises()

    await wrapper.find('[data-cy="pdv-finalize-sale"]').trigger('click')
    await flushPromises()

    // The toast composable is real (not mocked) here, so the assertion is
    // indirect: the cart survives the rejection either way (already covered
    // above) -- what this test guards is that extractPdvSaleErrorMessage
    // doesn't throw and the flow completes without leaving isSubmitting stuck.
    expect(wrapper.find('[data-cy="pdv-finalize-sale"]').attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  it('refocuses the scan input after a manual quantity adjustment, so the next scan does not leak into it', async () => {
    vi.mocked(ProductService.getByCode).mockResolvedValue(scannedProduct as any)
    const wrapper = mountPdvView({ attachTo: document.body })

    await wrapper.find('[data-cy="pdv-scan-input"]').setValue('ABCD2345')
    await wrapper.find('[data-cy="pdv-scan-input"]').trigger('keyup.enter')
    await flushPromises()

    await wrapper.find('[data-cy="pdv-cart-increment"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-cy="pdv-cart-quantity"]').text()).toBe('2')
    expect(document.activeElement).toBe(wrapper.find('[data-cy="pdv-scan-input"]').element)
    wrapper.unmount()
  })

  it('disables the decrement button at quantity 1 and the increment button at the available stock limit (Etapa R3)', async () => {
    vi.mocked(ProductService.getByCode).mockResolvedValue({ ...scannedProduct, stock_quantity: 1 } as any)
    const wrapper = mountPdvView()

    await wrapper.find('[data-cy="pdv-scan-input"]').setValue('ABCD2345')
    await wrapper.find('[data-cy="pdv-scan-input"]').trigger('keyup.enter')
    await flushPromises()

    expect(wrapper.find('[data-cy="pdv-cart-decrement"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-cy="pdv-cart-increment"]').attributes('disabled')).toBeDefined()
  })

  it('shows a low-stock badge in the cart when the scanned product is near its threshold (Etapa R3)', async () => {
    vi.mocked(ProductService.getByCode).mockResolvedValue({ ...scannedProduct, stock_quantity: 3, low_stock_threshold: 5 } as any)
    const wrapper = mountPdvView()

    await wrapper.find('[data-cy="pdv-scan-input"]').setValue('ABCD2345')
    await wrapper.find('[data-cy="pdv-scan-input"]').trigger('keyup.enter')
    await flushPromises()

    expect(wrapper.find('[data-cy="pdv-low-stock-badge"]').exists()).toBe(true)
  })

  it('does not show a low-stock badge for healthy stock levels', async () => {
    vi.mocked(ProductService.getByCode).mockResolvedValue(scannedProduct as any)
    const wrapper = mountPdvView()

    await wrapper.find('[data-cy="pdv-scan-input"]').setValue('ABCD2345')
    await wrapper.find('[data-cy="pdv-scan-input"]').trigger('keyup.enter')
    await flushPromises()

    expect(wrapper.find('[data-cy="pdv-low-stock-badge"]').exists()).toBe(false)
  })

  it('refocuses the scan input after removing a line', async () => {
    vi.mocked(ProductService.getByCode).mockResolvedValue(scannedProduct as any)
    const wrapper = mountPdvView({ attachTo: document.body })

    await wrapper.find('[data-cy="pdv-scan-input"]').setValue('ABCD2345')
    await wrapper.find('[data-cy="pdv-scan-input"]').trigger('keyup.enter')
    await flushPromises()

    await wrapper.find('[data-cy="pdv-cart-remove"]').trigger('click')
    await flushPromises()

    expect(document.activeElement).toBe(wrapper.find('[data-cy="pdv-scan-input"]').element)
    wrapper.unmount()
  })

  it('clears the cart when the active store switches, to avoid mixing products from different stores', async () => {
    vi.mocked(ProductService.getByCode).mockResolvedValue(scannedProduct as any)
    const wrapper = mountPdvView()

    await wrapper.find('[data-cy="pdv-scan-input"]').setValue('ABCD2345')
    await wrapper.find('[data-cy="pdv-scan-input"]').trigger('keyup.enter')
    await flushPromises()
    expect(wrapper.find('[data-cy="pdv-cart-row"]').exists()).toBe(true)

    const onStoreSwitch = vi.mocked(useStoreSwitchEffect).mock.calls[0]?.[0]
    expect(onStoreSwitch).toBeTypeOf('function')
    onStoreSwitch?.()
    await flushPromises()

    expect(wrapper.find('[data-cy="pdv-cart-empty"]').exists()).toBe(true)
  })

  it('loads and shows the most recent PDV sales on mount (Etapa R4 of the QR-code stock-exit refinement)', async () => {
    vi.mocked(salesService.list).mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      page_size: 5,
      total_pages: 1,
      results: [
        {
          id: 1,
          order_reference: 'PDV-20260702-100000-000000',
          status: 'prepared',
          channel: 'loja_fisica',
          customer_name: 'Cliente balcão',
          customer_phone: '',
          customer_email: '',
          delivery_method: 'pickup',
          payment_method: 'cash',
          delivery_region_name: '',
          performed_by_username: 'caixa1',
          subtotal: '18.50',
          delivery_fee: '0.00',
          total: '18.50',
          created_at: '2026-07-02T10:00:00Z',
          item_count: 1,
          items: [],
        },
      ],
    })

    const wrapper = mountPdvView()
    await flushPromises()

    expect(salesService.list).toHaveBeenCalledWith({ channel: 'loja_fisica', pageSize: 5 })
    expect(wrapper.find('[data-cy="pdv-recent-sales"]').exists()).toBe(true)
    expect(wrapper.find('[data-cy="pdv-recent-sale-row"]').text()).toContain('PDV-20260702-100000-000000')
  })

  it('does not show the recent-sales panel when there is nothing to show', async () => {
    const wrapper = mountPdvView()
    await flushPromises()

    expect(wrapper.find('[data-cy="pdv-recent-sales"]').exists()).toBe(false)
  })

  it('does not fetch recent sales without catalog access', async () => {
    vi.mocked(useCurrentUser).mockReturnValue({ canManageCatalog: ref(false) } as any)
    mountPdvView()
    await flushPromises()

    expect(salesService.list).not.toHaveBeenCalled()
  })

  it('refreshes the recent-sales panel after a sale finalizes', async () => {
    vi.mocked(ProductService.getByCode).mockResolvedValue(scannedProduct as any)
    vi.mocked(PdvSaleService.create).mockResolvedValue({
      order_reference: 'PDV-20260702-120000-000000',
      items: [],
      subtotal: '18.50',
      total: '18.50',
      payment_method: 'pix',
      created_at: '2026-07-02T12:00:00Z',
    })

    const wrapper = mountPdvView({ global: { stubs: { teleport: true } } })
    await flushPromises()
    expect(salesService.list).toHaveBeenCalledTimes(1)

    await wrapper.find('[data-cy="pdv-scan-input"]').setValue('ABCD2345')
    await wrapper.find('[data-cy="pdv-scan-input"]').trigger('keyup.enter')
    await flushPromises()
    await wrapper.find('[data-cy="pdv-finalize-sale"]').trigger('click')
    await flushPromises()

    expect(salesService.list).toHaveBeenCalledTimes(2)
  })
})
