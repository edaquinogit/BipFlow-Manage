import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'

describe('CustomerProfileMenuButton', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('shows the Entrar/Criar perfil menu when not authenticated', async () => {
    vi.doMock('vue-router', () => ({
      useRoute: () => ({ params: {}, fullPath: '/produtos' }),
      RouterLink: { template: '<a><slot /></a>' },
    }))
    vi.doMock('@/services/auth.service', () => ({
      authService: { isAuthenticated: () => false },
    }))
    vi.doMock('@/composables/useCustomerProfile', () => ({
      useCustomerProfile: () => ({ hasProfile: { value: null }, fetchCustomerProfile: vi.fn() }),
    }))

    const { default: CustomerProfileMenuButton } = await import('../CustomerProfileMenuButton.vue')
    const wrapper = mount(CustomerProfileMenuButton)

    expect(wrapper.text()).not.toContain('Criar perfil')

    await wrapper.find('button').trigger('click')

    expect(wrapper.text()).toContain('Criar perfil')
    expect(wrapper.text()).toContain('Entrar')
  })

  it('links straight to the account page when authenticated with a profile', async () => {
    vi.doMock('vue-router', () => ({
      useRoute: () => ({ params: { storeSlug: 'minha-loja' }, fullPath: '/l/minha-loja/produtos' }),
      RouterLink: { template: '<a><slot /></a>' },
    }))
    vi.doMock('@/services/auth.service', () => ({
      authService: { isAuthenticated: () => true },
    }))
    vi.doMock('@/composables/useCustomerProfile', () => ({
      useCustomerProfile: () => ({ hasProfile: { value: true }, fetchCustomerProfile: vi.fn() }),
    }))

    const { default: CustomerProfileMenuButton } = await import('../CustomerProfileMenuButton.vue')
    const wrapper = mount(CustomerProfileMenuButton)

    const link = wrapper.find('a')
    expect(link.exists()).toBe(true)
    expect(link.attributes('aria-label')).toBe('Minha conta')
    expect(wrapper.find('button').exists()).toBe(false)
  })
})
