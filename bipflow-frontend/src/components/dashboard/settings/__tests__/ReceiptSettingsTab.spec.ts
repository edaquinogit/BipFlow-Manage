import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import ReceiptSettingsTab from '../ReceiptSettingsTab.vue'
import { useCurrentStore } from '@/composables/useCurrentStore'
import { useToast } from '@/composables/useToast'
import { storeService } from '@/services/store.service'
import type { Store } from '@/types/store'

vi.mock('@/composables/useCurrentStore', () => ({ useCurrentStore: vi.fn() }))
vi.mock('@/composables/useToast', () => ({ useToast: vi.fn() }))
vi.mock('@/services/store.service', () => ({
  storeService: {
    updateReceiptSettings: vi.fn(),
  },
}))

function buildStore(overrides: Partial<Store> = {}): Store {
  return {
    id: 1,
    name: 'Boutique Fitness',
    slug: 'boutique-fitness',
    whatsapp_phone: '5571999990000',
    is_active: true,
    receipt_exchange_policy: 'Trocas em ate 7 dias.',
    receipt_paper_format: '80mm',
    ...overrides,
  }
}

describe('ReceiptSettingsTab', () => {
  const toastState = { success: vi.fn(), error: vi.fn() }
  const fetchCurrentStore = vi.fn().mockResolvedValue(undefined)

  beforeEach(() => {
    vi.clearAllMocks()
    fetchCurrentStore.mockClear()
    vi.mocked(useToast).mockReturnValue(toastState as any)
  })

  it('loads the current store receipt settings into the form', () => {
    vi.mocked(useCurrentStore).mockReturnValue({
      selectedStore: ref(buildStore()),
      fetchCurrentStore,
    } as any)

    const wrapper = mount(ReceiptSettingsTab)

    expect(
      (wrapper.find('[data-cy="receipt-exchange-policy-input"]').element as HTMLTextAreaElement).value
    ).toBe('Trocas em ate 7 dias.')
    expect(
      (wrapper.find('[data-cy="receipt-paper-format-select"]').element as HTMLSelectElement).value
    ).toBe('80mm')
  })

  it('saves the updated settings and refreshes the current store', async () => {
    const store = buildStore()
    vi.mocked(useCurrentStore).mockReturnValue({
      selectedStore: ref(store),
      fetchCurrentStore,
    } as any)
    vi.mocked(storeService.updateReceiptSettings).mockResolvedValue(store)

    const wrapper = mount(ReceiptSettingsTab)
    await wrapper.find('[data-cy="receipt-exchange-policy-input"]').setValue('Trocas em ate 15 dias.')
    await wrapper.find('[data-cy="receipt-paper-format-select"]').setValue('58mm')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(storeService.updateReceiptSettings).toHaveBeenCalledWith('boutique-fitness', {
      receipt_exchange_policy: 'Trocas em ate 15 dias.',
      receipt_paper_format: '58mm',
    })
    expect(fetchCurrentStore).toHaveBeenCalledWith(true)
    expect(toastState.success).toHaveBeenCalledWith('Configurações de recibo atualizadas.')
  })

  it('shows an error message when saving fails', async () => {
    vi.mocked(useCurrentStore).mockReturnValue({
      selectedStore: ref(buildStore()),
      fetchCurrentStore,
    } as any)
    vi.mocked(storeService.updateReceiptSettings).mockRejectedValue(new Error('network down'))

    const wrapper = mount(ReceiptSettingsTab)
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.find('[data-cy="receipt-settings-error"]').exists()).toBe(true)
    expect(toastState.error).toHaveBeenCalled()
  })

  it('disables the submit button while there is no selected store', () => {
    vi.mocked(useCurrentStore).mockReturnValue({
      selectedStore: ref(null),
      fetchCurrentStore,
    } as any)

    const wrapper = mount(ReceiptSettingsTab)

    expect(wrapper.find('[data-cy="btn-save-receipt-settings"]').attributes('disabled')).toBeDefined()
  })
})
