import { computed, ref } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import CreateCustomerProfileView from '../CreateCustomerProfileView.vue'

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  logout: vi.fn().mockResolvedValue(undefined),
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
    isAuthenticated: vi.fn(() => true),
    logout: mocks.logout,
    register: vi.fn(),
    login: vi.fn(),
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
})
