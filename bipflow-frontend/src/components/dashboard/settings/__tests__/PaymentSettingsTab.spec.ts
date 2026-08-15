import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import PaymentSettingsTab from '../PaymentSettingsTab.vue'
import { useCurrentStore } from '@/composables/useCurrentStore'
import { useToast } from '@/composables/useToast'
import { storeService } from '@/services/store.service'

vi.mock('@/composables/useCurrentStore', () => ({ useCurrentStore: vi.fn() }))
vi.mock('@/composables/useToast', () => ({ useToast: vi.fn() }))
vi.mock('@/services/store.service', () => ({
  storeService: {
    getPaymentSettings: vi.fn(),
    updatePaymentSettings: vi.fn(),
  },
}))

const selectedStore = {
  id: 1,
  name: 'Boutique Fitness',
  slug: 'boutique-fitness',
}

describe('PaymentSettingsTab', () => {
  const toastState = { success: vi.fn(), error: vi.fn() }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useToast).mockReturnValue(toastState as any)
    vi.mocked(useCurrentStore).mockReturnValue({
      selectedStore: ref(selectedStore),
    } as any)
    vi.mocked(storeService.getPaymentSettings).mockResolvedValue({
      payment_pix_link_url: 'https://pay.example.com/pix',
      payment_card_link_url: 'https://pay.example.com/card',
      card_max_installments: 6,
      card_monthly_interest_rate: '1.99',
      card_min_installment_amount: '10.00',
    })
  })

  it('loads payment settings into the form', async () => {
    const wrapper = mount(PaymentSettingsTab)
    await flushPromises()

    expect(storeService.getPaymentSettings).toHaveBeenCalledWith('boutique-fitness')
    expect((wrapper.find('[data-cy="payment-pix-link-input"]').element as HTMLInputElement).value).toBe('https://pay.example.com/pix')
    expect((wrapper.find('[data-cy="payment-card-max-installments-input"]').element as HTMLInputElement).value).toBe('6')
  })

  it('saves the configured links and card simulation rules', async () => {
    vi.mocked(storeService.updatePaymentSettings).mockResolvedValue({
      payment_pix_link_url: 'https://pay.example.com/pix-novo',
      payment_card_link_url: 'https://pay.example.com/card',
      card_max_installments: 4,
      card_monthly_interest_rate: '2.5',
      card_min_installment_amount: '15',
    })

    const wrapper = mount(PaymentSettingsTab)
    await flushPromises()
    await wrapper.find('[data-cy="payment-pix-link-input"]').setValue('https://pay.example.com/pix-novo')
    await wrapper.find('[data-cy="payment-card-max-installments-input"]').setValue('4')
    await wrapper.find('[data-cy="payment-card-interest-input"]').setValue('2.50')
    await wrapper.find('[data-cy="payment-card-min-installment-input"]').setValue('15.00')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(storeService.updatePaymentSettings).toHaveBeenCalledWith('boutique-fitness', {
      payment_pix_link_url: 'https://pay.example.com/pix-novo',
      payment_card_link_url: 'https://pay.example.com/card',
      card_max_installments: 4,
      card_monthly_interest_rate: '2.5',
      card_min_installment_amount: '15',
    })
    expect(toastState.success).toHaveBeenCalledWith('Configuracoes de pagamento atualizadas.')
  })

  it('shows an error message when saving fails', async () => {
    vi.mocked(storeService.updatePaymentSettings).mockRejectedValue(new Error('network down'))
    const wrapper = mount(PaymentSettingsTab)
    await flushPromises()

    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.find('[data-cy="payment-settings-error"]').exists()).toBe(true)
    expect(toastState.error).toHaveBeenCalled()
  })
})
