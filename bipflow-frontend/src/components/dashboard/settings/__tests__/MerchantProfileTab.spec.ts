import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import MerchantProfileTab from '../MerchantProfileTab.vue'
import { useCurrentUser } from '@/composables/useCurrentUser'
import { useToast } from '@/composables/useToast'
import { storeService } from '@/services/store.service'
import type { MerchantProfile } from '@/types/store'

vi.mock('@/composables/useCurrentUser', () => ({ useCurrentUser: vi.fn() }))
vi.mock('@/composables/useToast', () => ({ useToast: vi.fn() }))
vi.mock('@/composables/useStoreSwitchEffect', () => ({ useStoreSwitchEffect: vi.fn() }))
vi.mock('@/services/store.service', () => ({
  storeService: {
    getMerchantProfile: vi.fn(),
    updateMerchantProfile: vi.fn(),
  },
}))

function buildProfile(overrides: Partial<MerchantProfile> = {}): MerchantProfile {
  return {
    legal_name: '',
    trade_name: '',
    tax_id: '',
    contact_email: '',
    contact_phone: '',
    postal_code: '',
    street: '',
    number: '',
    complement: '',
    district: '',
    city: '',
    state: '',
    country: 'BR',
    website_url: '',
    instagram_url: '',
    facebook_url: '',
    tiktok_url: '',
    youtube_url: '',
    is_complete: false,
    has_complete_address: false,
    created_at: '2026-09-02T00:00:00Z',
    updated_at: '2026-09-02T00:00:00Z',
    ...overrides,
  }
}

describe('MerchantProfileTab', () => {
  const toastState = { success: vi.fn(), error: vi.fn() }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useCurrentUser).mockReturnValue({ canManageCatalog: ref(true) } as never)
    vi.mocked(useToast).mockReturnValue(toastState as never)
  })

  it('hydrates the form from the loaded profile', async () => {
    vi.mocked(storeService.getMerchantProfile).mockResolvedValue(
      buildProfile({ trade_name: 'Boutique X', city: 'Salvador', state: 'BA', is_complete: true }),
    )

    const wrapper = mount(MerchantProfileTab)
    await flushPromises()

    expect((wrapper.find('[data-cy="merchant-trade-name"]').element as HTMLInputElement).value).toBe('Boutique X')
    expect((wrapper.find('[data-cy="merchant-city"]').element as HTMLInputElement).value).toBe('Salvador')
    expect(wrapper.find('[data-cy="merchant-profile-status"]').text()).toContain('Completo')
  })

  it('keeps the save button disabled until a field changes', async () => {
    vi.mocked(storeService.getMerchantProfile).mockResolvedValue(buildProfile())

    const wrapper = mount(MerchantProfileTab)
    await flushPromises()

    expect(wrapper.find('[data-cy="btn-save-merchant-profile"]').attributes('disabled')).toBeDefined()

    await wrapper.find('[data-cy="merchant-trade-name"]').setValue('Nova Loja')

    expect(wrapper.find('[data-cy="btn-save-merchant-profile"]').attributes('disabled')).toBeUndefined()
  })

  it('PATCHes only the changed fields and shows a success toast', async () => {
    vi.mocked(storeService.getMerchantProfile).mockResolvedValue(
      buildProfile({ legal_name: 'ACME LTDA' }),
    )
    vi.mocked(storeService.updateMerchantProfile).mockResolvedValue(
      buildProfile({ legal_name: 'ACME LTDA', trade_name: 'ACME Store' }),
    )

    const wrapper = mount(MerchantProfileTab)
    await flushPromises()

    await wrapper.find('[data-cy="merchant-trade-name"]').setValue('ACME Store')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(storeService.updateMerchantProfile).toHaveBeenCalledWith({ trade_name: 'ACME Store' })
    expect(toastState.success).toHaveBeenCalledWith('Perfil da loja atualizado.')
  })

  it('flags an invalid e-mail and blocks saving', async () => {
    vi.mocked(storeService.getMerchantProfile).mockResolvedValue(buildProfile())

    const wrapper = mount(MerchantProfileTab)
    await flushPromises()

    await wrapper.find('[data-cy="merchant-contact-email"]').setValue('not-an-email')

    expect(wrapper.text()).toContain('Informe um e-mail válido.')
    expect(wrapper.find('[data-cy="btn-save-merchant-profile"]').attributes('disabled')).toBeDefined()
  })

  it('warns about a link that does not start with https', async () => {
    vi.mocked(storeService.getMerchantProfile).mockResolvedValue(buildProfile())

    const wrapper = mount(MerchantProfileTab)
    await flushPromises()

    await wrapper.find('[data-cy="merchant-instagram"]').setValue('javascript:alert(1)')

    expect(wrapper.text()).toContain('Comece com https://')
    expect(wrapper.find('[data-cy="btn-save-merchant-profile"]').attributes('disabled')).toBeDefined()
  })

  it('surfaces per-field server validation errors', async () => {
    vi.mocked(storeService.getMerchantProfile).mockResolvedValue(buildProfile())
    vi.mocked(storeService.updateMerchantProfile).mockRejectedValue(
      Object.assign(new Error('Request failed'), {
        config: {},
        response: { status: 400, data: { tax_id: ['CNPJ invalido.'] } },
      }),
    )

    const wrapper = mount(MerchantProfileTab)
    await flushPromises()

    await wrapper.find('[data-cy="merchant-tax-id"]').setValue('11222333000180')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.text()).toContain('CNPJ invalido.')
    expect(wrapper.find('[data-cy="merchant-profile-form-error"]').text()).toContain('Revise os campos destacados')
    expect(toastState.error).toHaveBeenCalled()
  })

  it('shows an error banner when the profile fails to load', async () => {
    vi.mocked(storeService.getMerchantProfile).mockRejectedValue(new Error('network down'))

    const wrapper = mount(MerchantProfileTab)
    await flushPromises()

    expect(wrapper.find('[data-cy="merchant-profile-load-error"]').text()).toContain(
      'Não foi possível carregar o perfil da loja agora.',
    )
  })

  it('hides the editing form for members without write access', async () => {
    vi.mocked(useCurrentUser).mockReturnValue({ canManageCatalog: ref(false) } as never)
    vi.mocked(storeService.getMerchantProfile).mockResolvedValue(buildProfile({ trade_name: 'Loja Y' }))

    const wrapper = mount(MerchantProfileTab)
    await flushPromises()

    expect(wrapper.find('[data-cy="btn-save-merchant-profile"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('não tem permissão para editá-lo')
  })
})
