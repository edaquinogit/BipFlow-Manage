import { computed, ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import CreateCustomerProfileView from '../CreateCustomerProfileView.vue'

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  logout: vi.fn().mockResolvedValue(undefined),
  login: vi.fn().mockResolvedValue({ access: 'token' }),
  register: vi.fn().mockResolvedValue({ message: 'ok', email: 'maria@example.com' }),
  isAuthenticated: vi.fn(() => true),
  fetchCurrentStore: vi.fn().mockResolvedValue(undefined),
  fetchCustomerProfile: vi.fn().mockResolvedValue(false),
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: { storeSlug: 'default' },
    query: { redirect: '/l/default/produtos' },
    fullPath: '/l/default/perfil/criar?redirect=/l/default/produtos',
  }),
  useRouter: () => ({ push: mocks.push }),
}))

vi.mock('@/services/auth.service', () => ({
  authService: {
    isAuthenticated: mocks.isAuthenticated,
    logout: mocks.logout,
    register: mocks.register,
    login: mocks.login,
  },
}))

vi.mock('@/composables/useCurrentStore', () => ({
  useCurrentStore: () => ({
    selectedStore: ref({ id: 1, slug: 'default', name: 'Loja Teste' }),
    fetchCurrentStore: mocks.fetchCurrentStore,
  }),
}))

vi.mock('@/composables/useCustomerProfile', () => ({
  useCustomerProfile: () => ({
    hasProfile: ref(false),
    fetchCustomerProfile: mocks.fetchCustomerProfile,
  }),
}))

vi.mock('@/composables/usePasswordStrength', () => ({
  usePasswordStrength: () => ({
    rules: computed(() => []),
    label: computed(() => 'Forte'),
    barClass: computed(() => 'bg-emerald-500'),
    filledBars: computed(() => 4),
    totalBars: computed(() => 4),
    isValid: computed(() => true),
  }),
}))

vi.mock('@/services/store-scope', () => ({
  setSelectedStoreSlug: vi.fn(),
}))

describe('CreateCustomerProfileView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.logout.mockResolvedValue(undefined)
    mocks.login.mockResolvedValue({ access: 'token' })
    mocks.register.mockResolvedValue({ message: 'ok', email: 'maria@example.com' })
    mocks.isAuthenticated.mockReturnValue(true)
    mocks.fetchCurrentStore.mockResolvedValue(undefined)
    mocks.fetchCustomerProfile.mockResolvedValue(false)
  })

  it('shows a CTA to restart profile creation with another email when authenticated without profile', async () => {
    const wrapper = mount(CreateCustomerProfileView, {
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
        },
      },
    })

    await flushPromises()

    expect(wrapper.text()).toContain('Criar perfil com outro email')

    await wrapper.findAll('button')[0]!.trigger('click')

    expect(mocks.logout).toHaveBeenCalledWith('/l/default/perfil/criar?redirect=/l/default/produtos')
  })

  it('creates the storefront profile without asking for delivery address', async () => {
    mocks.isAuthenticated.mockReturnValue(false)

    const wrapper = mount(CreateCustomerProfileView, {
      global: {
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
        },
      },
    })

    await flushPromises()

    expect(wrapper.find('input[autocomplete="street-address"]').exists()).toBe(false)
    expect(wrapper.find('input[autocomplete="address-level3"]').exists()).toBe(false)
    expect(wrapper.find('input[autocomplete="address-level2"]').exists()).toBe(false)

    await wrapper.find('input[autocomplete="name"]').setValue('Maria Cliente')
    await wrapper.find('input[autocomplete="tel"]').setValue('71999990000')
    await wrapper.find('input[autocomplete="email"]').setValue('maria@example.com')
    await wrapper.find('input[autocomplete="new-password"]').setValue('StrongPass123')
    await wrapper.findAll('input[autocomplete="new-password"]')[1]!.setValue('StrongPass123')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(mocks.register).toHaveBeenCalledWith(expect.objectContaining({
      email: 'maria@example.com',
      full_name: 'Maria Cliente',
      phone: '71999990000',
      registration_context: 'storefront_customer',
      store_slug: 'default',
    }))

    const payload = mocks.register.mock.calls[0]![0]
    expect(payload).not.toHaveProperty('address')
    expect(payload).not.toHaveProperty('neighborhood')
    expect(payload).not.toHaveProperty('city')
  })
})
