import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import WhatsappTab from '../WhatsappTab.vue'
import { useCurrentStore } from '@/composables/useCurrentStore'
import { useCurrentUser } from '@/composables/useCurrentUser'
import { useToast } from '@/composables/useToast'
import { storeSettingsService } from '@/services/store-settings.service'
import type { StoreSettings } from '@/types/store-settings'

vi.mock('@/composables/useCurrentStore', () => ({ useCurrentStore: vi.fn() }))
vi.mock('@/composables/useCurrentUser', () => ({ useCurrentUser: vi.fn() }))
vi.mock('@/composables/useToast', () => ({ useToast: vi.fn() }))
vi.mock('@/services/store-settings.service', () => ({
  storeSettingsService: {
    get: vi.fn(),
    update: vi.fn(),
  },
}))

function buildSettings(overrides: Partial<StoreSettings> = {}): StoreSettings {
  return {
    id: 1,
    whatsapp_phone: '5571999990000',
    whatsapp_phone_digits: '5571999990000',
    is_whatsapp_configured: true,
    ...overrides,
  }
}

describe('WhatsappTab', () => {
  const toastState = { success: vi.fn(), error: vi.fn() }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useCurrentStore).mockReturnValue({ selectedStore: ref(null) } as any)
    vi.mocked(useCurrentUser).mockReturnValue({ canManageCatalog: ref(true) } as any)
    vi.mocked(useToast).mockReturnValue(toastState as any)
  })

  it('loads the current whatsapp settings into the draft on mount', async () => {
    vi.mocked(storeSettingsService.get).mockResolvedValue(buildSettings())

    const wrapper = mount(WhatsappTab)
    await flushPromises()

    expect((wrapper.find('input[type="tel"]').element as HTMLInputElement).value).toBe('5571999990000')
    expect(wrapper.text()).toContain('5571999990000')
  })

  it('shows a validation message for a phone number that is too short', async () => {
    vi.mocked(storeSettingsService.get).mockResolvedValue(buildSettings({ whatsapp_phone: '' }))

    const wrapper = mount(WhatsappTab)
    await flushPromises()

    await wrapper.find('input[type="tel"]').setValue('12345')

    expect(wrapper.text()).toContain('Use codigo do pais e DDD')
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined()
  })

  it('saves a valid phone number and shows a success toast', async () => {
    vi.mocked(storeSettingsService.get).mockResolvedValue(buildSettings({ whatsapp_phone: '' }))
    vi.mocked(storeSettingsService.update).mockResolvedValue(buildSettings())

    const wrapper = mount(WhatsappTab)
    await flushPromises()

    await wrapper.find('input[type="tel"]').setValue('5571999990000')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(storeSettingsService.update).toHaveBeenCalledWith({ whatsapp_phone: '5571999990000' })
    expect(toastState.success).toHaveBeenCalledWith('WhatsApp da loja atualizado.')
  })

  it('shows an error banner when loading the settings fails', async () => {
    vi.mocked(storeSettingsService.get).mockRejectedValue(new Error('network down'))

    const wrapper = mount(WhatsappTab)
    await flushPromises()

    expect(wrapper.text()).toContain('Nao foi possivel carregar o WhatsApp da loja agora.')
  })
})
