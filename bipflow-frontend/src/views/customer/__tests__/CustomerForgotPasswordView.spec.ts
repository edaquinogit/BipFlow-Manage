import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CustomerForgotPasswordView from '../CustomerForgotPasswordView.vue'
import { authService } from '@/services/auth.service'
import { useRoute } from 'vue-router'

const mocks = vi.hoisted(() => ({
  route: {
    params: { storeSlug: 'default' },
    query: { redirect: '/l/default/produtos' },
  },
}))

vi.mock('@/services/auth.service', () => ({
  authService: {
    requestPasswordReset: vi.fn(),
  },
}))

vi.mock('@/services/store-scope', () => ({
  setSelectedStoreSlug: vi.fn(),
}))

vi.mock('vue-router', () => ({
  RouterLink: {
    props: ['to'],
    template: '<a :data-to="JSON.stringify(to)"><slot /></a>',
  },
  useRoute: vi.fn(),
}))

function mountView() {
  return mount(CustomerForgotPasswordView)
}

describe('CustomerForgotPasswordView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useRoute).mockReturnValue(mocks.route as any)
  })

  it('uses storefront copy instead of administrative recovery copy', () => {
    const wrapper = mountView()

    expect(wrapper.text()).toContain('Minha conta')
    expect(wrapper.text()).toContain('Recuperar senha')
    expect(wrapper.text()).not.toContain('administrativo')
    expect(wrapper.text()).not.toContain('Painel administrativo')
  })

  it('requests a reset link and preserves the storefront login return route', async () => {
    vi.mocked(authService.requestPasswordReset).mockResolvedValue({
      email: 'cliente@example.com',
      message: 'Enviamos um link para seu email.',
    })

    const wrapper = mountView()

    await wrapper.find('input[type="email"]').setValue('CLIENTE@EXAMPLE.COM')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(authService.requestPasswordReset).toHaveBeenCalledWith({
      email: 'cliente@example.com',
    })
    expect(wrapper.find('[data-cy="password-reset-success"]').text()).toContain('Enviamos um link')

    const loginLinks = wrapper.findAll('a')
    const loginRouteData = loginLinks[0]?.attributes('data-to')

    expect(loginRouteData).toBeDefined()
    expect(JSON.parse(loginRouteData!)).toEqual({
      path: '/l/default/login',
      query: { redirect: '/l/default/produtos' },
    })
  })
})
