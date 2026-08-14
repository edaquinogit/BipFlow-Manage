import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import CustomerLoginView from '../CustomerLoginView.vue'
import { authService } from '@/services/auth.service'
import { useCustomerProfile } from '@/composables/useCustomerProfile'
import { useRoute, useRouter } from 'vue-router'

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  fetchCustomerProfile: vi.fn(),
  route: {
    params: { storeSlug: 'default' },
    query: { redirect: '/l/default/produtos' },
    fullPath: '/l/default/login?redirect=/l/default/produtos',
  },
}))

vi.mock('@/services/auth.service', () => ({
  authService: {
    login: vi.fn(),
    isAuthenticated: vi.fn(),
  },
}))

vi.mock('@/composables/useCustomerProfile', () => ({
  useCustomerProfile: vi.fn(),
}))

vi.mock('@/services/store-scope', () => ({
  setSelectedStoreSlug: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRoute: vi.fn(),
  useRouter: vi.fn(),
}))

const RouterLinkStub = defineComponent({
  name: 'RouterLink',
  props: {
    to: { type: [Object, String], required: true },
  },
  template: '<a :data-to="JSON.stringify(to)"><slot /></a>',
})

function mountView() {
  return mount(CustomerLoginView, {
    global: {
      stubs: {
        RouterLink: RouterLinkStub,
      },
    },
  })
}

describe('CustomerLoginView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useRoute).mockReturnValue(mocks.route as any)
    vi.mocked(useRouter).mockReturnValue({ push: mocks.push } as any)
    vi.mocked(useCustomerProfile).mockReturnValue({
      fetchCustomerProfile: mocks.fetchCustomerProfile,
    } as any)
  })

  it('keeps invalid credential feedback localized for storefront customers', async () => {
    vi.mocked(authService.login).mockRejectedValue({
      response: {
        status: 401,
        data: { detail: 'No active account found with the given credentials' },
      },
    })

    const wrapper = mountView()

    await wrapper.find('input[type="email"]').setValue('cliente@example.com')
    await wrapper.find('input[type="password"]').setValue('senha-errada')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('[data-cy="login-error"]').text()).toBe('Email ou senha inválidos.')
    expect(wrapper.text()).not.toContain('No active account')
  })

  it('links password recovery to the storefront customer route', () => {
    const wrapper = mountView()

    const forgotLink = wrapper
      .findAllComponents(RouterLinkStub)
      .find((link) => link.text() === 'Esqueci minha senha')

    expect(forgotLink?.props('to')).toEqual({
      path: '/l/default/senha/recuperar',
      query: { redirect: '/l/default/produtos' },
    })
  })

  it('sends authenticated accounts without a store profile to the profile step', async () => {
    vi.mocked(authService.login).mockResolvedValue({ access: 'token' })
    mocks.fetchCustomerProfile.mockResolvedValue(false)

    const wrapper = mountView()

    await wrapper.find('input[type="email"]').setValue('cliente@example.com')
    await wrapper.find('input[type="password"]').setValue('SenhaForte123')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(mocks.push).toHaveBeenCalledWith({
      path: '/l/default/perfil/criar',
      query: { redirect: '/l/default/produtos' },
    })
  })
})
