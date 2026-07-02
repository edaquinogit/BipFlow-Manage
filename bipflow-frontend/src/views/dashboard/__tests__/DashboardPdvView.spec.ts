import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import DashboardPdvView from '../DashboardPdvView.vue'
import { useCurrentUser } from '@/composables/useCurrentUser'
import ProductService from '@/services/product.service'
import PdvSaleService from '@/services/pdvSale.service'

vi.mock('@/composables/useCurrentUser', () => ({ useCurrentUser: vi.fn() }))
vi.mock('@/services/product.service', () => ({
  default: { getByCode: vi.fn() },
}))
vi.mock('@/services/pdvSale.service', () => ({
  default: { create: vi.fn() },
}))

const scannedProduct = {
  id: 7,
  name: 'Coxinha premium',
  price: 18.5,
  stock_quantity: 12,
  is_available: true,
  low_stock_threshold: null,
  public_code: 'ABCD2345',
}

const mountPdvView = () => mount(DashboardPdvView)

describe('DashboardPdvView (Etapa 3 of the QR-code stock-exit evolution)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useCurrentUser).mockReturnValue({ canManageCatalog: ref(true) } as any)
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

  it('aggregates a second scan of the same code into one cart line', async () => {
    vi.mocked(ProductService.getByCode).mockResolvedValue(scannedProduct as any)
    const wrapper = mountPdvView()

    for (let i = 0; i < 2; i += 1) {
      await wrapper.find('[data-cy="pdv-scan-input"]').setValue('ABCD2345')
      await wrapper.find('[data-cy="pdv-scan-input"]').trigger('keyup.enter')
      await flushPromises()
    }

    expect(wrapper.findAll('[data-cy="pdv-cart-row"]')).toHaveLength(1)
    expect(
      (wrapper.find('[data-cy="pdv-cart-quantity"]').element as HTMLInputElement).value
    ).toBe('2')
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
})
