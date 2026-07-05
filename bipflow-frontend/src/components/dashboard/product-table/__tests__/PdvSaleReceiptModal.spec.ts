import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import PdvSaleReceiptModal from '../PdvSaleReceiptModal.vue'
import { useCurrentStore } from '@/composables/useCurrentStore'
import { buildReceiptPdf, buildReceiptPdfBase64 } from '@/utils/receiptPdf'
import PdvSaleService from '@/services/pdvSale.service'
import type { PdvSaleResponse } from '@/types/pdvSale'
import type { Store } from '@/types/store'

vi.mock('@/composables/useCurrentStore', () => ({ useCurrentStore: vi.fn() }))
vi.mock('@/utils/receiptPdf', () => ({
  buildReceiptPdf: vi.fn(),
  buildReceiptPdfBase64: vi.fn(),
}))
vi.mock('@/services/pdvSale.service', () => ({
  default: { sendReceiptEmail: vi.fn() },
}))

function buildStore(overrides: Partial<Store> = {}): Store {
  return {
    id: 1,
    name: 'Boutique Fitness',
    slug: 'boutique-fitness',
    whatsapp_phone: '5571999990000',
    is_active: true,
    receipt_exchange_policy: 'Trocas em ate 7 dias mediante apresentacao deste comprovante.',
    receipt_paper_format: '80mm',
    ...overrides,
  }
}

function buildSale(overrides: Partial<PdvSaleResponse> = {}): PdvSaleResponse {
  return {
    order_reference: 'PDV-20260702-120000-000000',
    items: [
      {
        product_id: 7,
        product_name: 'Coxinha premium',
        public_code: 'ABCD2345',
        quantity: 2,
        unit_price: '18.50',
        line_total: '37.00',
      },
    ],
    subtotal: '37.00',
    total: '37.00',
    payment_method: 'pix',
    created_at: '2026-07-02T12:00:00Z',
    customer_email: '',
    ...overrides,
  }
}

const mountModal = (sale: PdvSaleResponse | null = buildSale()) =>
  mount(PdvSaleReceiptModal, {
    props: { show: true, sale },
    global: { stubs: { teleport: true } },
  })

describe('PdvSaleReceiptModal (PDV receipt refinement: store info, exchange policy, print format)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useCurrentStore).mockReturnValue({ selectedStore: ref(buildStore()) } as any)
  })

  it('does not render when there is no sale', () => {
    const wrapper = mountModal(null)

    expect(wrapper.find('[data-cy="pdv-receipt"]').exists()).toBe(false)
  })

  it('shows the order reference and formatted date inside the printable block', () => {
    const wrapper = mountModal()

    const printable = wrapper.find('[data-cy="pdv-receipt"]')
    expect(printable.find('[data-cy="pdv-receipt-order-reference"]').text()).toBe(
      'PDV-20260702-120000-000000'
    )
    expect(printable.text()).toContain('02/07/2026')
  })

  it('shows the current store name in the printed receipt', () => {
    const wrapper = mountModal()

    expect(wrapper.find('[data-cy="pdv-receipt"]').text()).toContain('Boutique Fitness')
  })

  it('shows the exchange policy when the store has one configured', () => {
    const wrapper = mountModal()

    expect(wrapper.find('[data-cy="pdv-receipt-exchange-policy"]').text()).toContain(
      'Trocas em ate 7 dias'
    )
  })

  it('hides the exchange policy line when the store has none configured', () => {
    vi.mocked(useCurrentStore).mockReturnValue({
      selectedStore: ref(buildStore({ receipt_exchange_policy: '' })),
    } as any)

    const wrapper = mountModal()

    expect(wrapper.find('[data-cy="pdv-receipt-exchange-policy"]').exists()).toBe(false)
  })

  it('applies the print-format class matching the store\'s configured paper format', () => {
    vi.mocked(useCurrentStore).mockReturnValue({
      selectedStore: ref(buildStore({ receipt_paper_format: '58mm' })),
    } as any)

    const wrapper = mountModal()

    expect(wrapper.find('[data-cy="pdv-receipt"]').classes()).toContain('format-58mm')
  })

  it('defaults to the 80mm format class when there is no current store', () => {
    vi.mocked(useCurrentStore).mockReturnValue({ selectedStore: ref(null) } as any)

    const wrapper = mountModal()

    expect(wrapper.find('[data-cy="pdv-receipt"]').classes()).toContain('format-80mm')
    expect(wrapper.find('[data-cy="pdv-receipt"]').text()).not.toContain('Boutique Fitness')
  })

  it('calls window.print() when the print button is clicked', async () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => undefined)

    const wrapper = mountModal()
    await wrapper.find('[data-cy="btn-print-receipt"]').trigger('click')

    expect(printSpy).toHaveBeenCalledTimes(1)
  })

  it('builds and downloads a PDF when the "Baixar PDF" button is clicked', async () => {
    const saveSpy = vi.fn()
    vi.mocked(buildReceiptPdf).mockReturnValue({ save: saveSpy } as any)
    const sale = buildSale()

    const wrapper = mountModal(sale)
    await wrapper.find('[data-cy="btn-download-receipt-pdf"]').trigger('click')

    expect(buildReceiptPdf).toHaveBeenCalledWith(sale, buildStore())
    expect(saveSpy).toHaveBeenCalledWith(`recibo-${sale.order_reference}.pdf`)
  })

  it('emits close when the close button is clicked', async () => {
    const wrapper = mountModal()

    await wrapper.find('.cancel-button').trigger('click')

    expect(wrapper.emitted('close')).toHaveLength(1)
    await flushPromises()
  })

  describe('send by email (PDV receipt PDF/email evolution)', () => {
    it('opens the email form pre-filled with the sale\'s customer email', async () => {
      const wrapper = mountModal(buildSale({ customer_email: 'cliente@example.com' }))

      await wrapper.find('[data-cy="btn-open-receipt-email"]').trigger('click')

      expect(
        (wrapper.find('[data-cy="receipt-email-input"]').element as HTMLInputElement).value
      ).toBe('cliente@example.com')
    })

    it('builds the PDF and sends it to the entered email', async () => {
      vi.mocked(buildReceiptPdfBase64).mockReturnValue('JVBERi0xLjQ=')
      vi.mocked(PdvSaleService.sendReceiptEmail).mockResolvedValue(undefined)
      const sale = buildSale()

      const wrapper = mountModal(sale)
      await wrapper.find('[data-cy="btn-open-receipt-email"]').trigger('click')
      await wrapper.find('[data-cy="receipt-email-input"]').setValue('cliente@example.com')
      await wrapper.find('[data-cy="btn-send-receipt-email"]').trigger('click')
      await flushPromises()

      expect(buildReceiptPdfBase64).toHaveBeenCalledWith(sale, buildStore())
      expect(PdvSaleService.sendReceiptEmail).toHaveBeenCalledWith(
        sale.order_reference,
        'cliente@example.com',
        'JVBERi0xLjQ='
      )
      expect(wrapper.find('[data-cy="receipt-email-sent"]').text()).toContain('cliente@example.com')
      expect(wrapper.find('[data-cy="receipt-email-input"]').exists()).toBe(false)
    })

    it('shows a validation message when trying to send with no email', async () => {
      const wrapper = mountModal()

      await wrapper.find('[data-cy="btn-open-receipt-email"]').trigger('click')
      await wrapper.find('[data-cy="receipt-email-input"]').setValue('')
      await wrapper.find('[data-cy="btn-send-receipt-email"]').trigger('click')

      expect(wrapper.find('[data-cy="receipt-email-error"]').exists()).toBe(true)
      expect(PdvSaleService.sendReceiptEmail).not.toHaveBeenCalled()
    })

    it('shows an error message when the send fails', async () => {
      vi.mocked(buildReceiptPdfBase64).mockReturnValue('JVBERi0xLjQ=')
      vi.mocked(PdvSaleService.sendReceiptEmail).mockRejectedValue(new Error('network down'))

      const wrapper = mountModal()
      await wrapper.find('[data-cy="btn-open-receipt-email"]').trigger('click')
      await wrapper.find('[data-cy="receipt-email-input"]').setValue('cliente@example.com')
      await wrapper.find('[data-cy="btn-send-receipt-email"]').trigger('click')
      await flushPromises()

      expect(wrapper.find('[data-cy="receipt-email-error"]').exists()).toBe(true)
      expect(wrapper.find('[data-cy="receipt-email-sent"]').exists()).toBe(false)
    })

    it('closes the email form on cancel without sending', async () => {
      const wrapper = mountModal()

      await wrapper.find('[data-cy="btn-open-receipt-email"]').trigger('click')
      await wrapper.findAll('.cancel-button').at(-1)!.trigger('click')

      expect(wrapper.find('[data-cy="receipt-email-input"]').exists()).toBe(false)
      expect(PdvSaleService.sendReceiptEmail).not.toHaveBeenCalled()
    })
  })
})
