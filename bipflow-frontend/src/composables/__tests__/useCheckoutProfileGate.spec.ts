import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('useCheckoutProfileGate', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('allows checkout straight away when the customer already has a profile', async () => {
    const push = vi.fn()
    vi.doMock('vue-router', () => ({
      useRoute: () => ({ params: {}, fullPath: '/produtos' }),
      useRouter: () => ({ push }),
    }))
    vi.doMock('@/services/auth.service', () => ({
      authService: { isAuthenticated: () => true },
    }))
    vi.doMock('@/composables/useCustomerProfile', () => ({
      useCustomerProfile: () => ({
        hasProfile: { value: true },
        fetchCustomerProfile: vi.fn(),
      }),
    }))

    const { useCheckoutProfileGate } = await import('../useCheckoutProfileGate')
    const result = await useCheckoutProfileGate().ensureCustomerProfile()

    expect(result).toBe(true)
    expect(push).not.toHaveBeenCalled()
  })

  it('fetches the profile once when authenticated but not checked yet this session', async () => {
    const hasProfileRef = { value: null as boolean | null }
    const fetchCustomerProfile = vi.fn().mockImplementation(async () => {
      hasProfileRef.value = true
      return true
    })
    const push = vi.fn()

    vi.doMock('vue-router', () => ({
      useRoute: () => ({ params: {}, fullPath: '/produtos' }),
      useRouter: () => ({ push }),
    }))
    vi.doMock('@/services/auth.service', () => ({
      authService: { isAuthenticated: () => true },
    }))
    vi.doMock('@/composables/useCustomerProfile', () => ({
      useCustomerProfile: () => ({
        hasProfile: hasProfileRef,
        fetchCustomerProfile,
      }),
    }))

    const { useCheckoutProfileGate } = await import('../useCheckoutProfileGate')
    const result = await useCheckoutProfileGate().ensureCustomerProfile()

    expect(fetchCustomerProfile).toHaveBeenCalledTimes(1)
    expect(result).toBe(true)
    expect(push).not.toHaveBeenCalled()
  })

  it('redirects to the store-scoped create-profile route when not authenticated', async () => {
    const push = vi.fn()
    vi.doMock('vue-router', () => ({
      useRoute: () => ({ params: { storeSlug: 'minha-loja' }, fullPath: '/l/minha-loja/produtos' }),
      useRouter: () => ({ push }),
    }))
    vi.doMock('@/services/auth.service', () => ({
      authService: { isAuthenticated: () => false },
    }))
    vi.doMock('@/composables/useCustomerProfile', () => ({
      useCustomerProfile: () => ({
        hasProfile: { value: null },
        fetchCustomerProfile: vi.fn(),
      }),
    }))

    const { useCheckoutProfileGate } = await import('../useCheckoutProfileGate')
    const result = await useCheckoutProfileGate().ensureCustomerProfile()

    expect(result).toBe(false)
    expect(push).toHaveBeenCalledWith({
      path: '/l/minha-loja/perfil/criar',
      query: { redirect: '/l/minha-loja/produtos' },
    })
  })

  it('falls back to the non-slug create-profile route outside a store-scoped URL', async () => {
    const push = vi.fn()
    vi.doMock('vue-router', () => ({
      useRoute: () => ({ params: {}, fullPath: '/produtos' }),
      useRouter: () => ({ push }),
    }))
    vi.doMock('@/services/auth.service', () => ({
      authService: { isAuthenticated: () => false },
    }))
    vi.doMock('@/composables/useCustomerProfile', () => ({
      useCustomerProfile: () => ({
        hasProfile: { value: null },
        fetchCustomerProfile: vi.fn(),
      }),
    }))

    const { useCheckoutProfileGate } = await import('../useCheckoutProfileGate')
    await useCheckoutProfileGate().ensureCustomerProfile()

    expect(push).toHaveBeenCalledWith({
      path: '/perfil/criar',
      query: { redirect: '/produtos' },
    })
  })

  it('redirects when authenticated but the fetched profile does not exist for this store', async () => {
    const push = vi.fn()
    vi.doMock('vue-router', () => ({
      useRoute: () => ({ params: {}, fullPath: '/produtos' }),
      useRouter: () => ({ push }),
    }))
    vi.doMock('@/services/auth.service', () => ({
      authService: { isAuthenticated: () => true },
    }))
    vi.doMock('@/composables/useCustomerProfile', () => ({
      useCustomerProfile: () => ({
        hasProfile: { value: false },
        fetchCustomerProfile: vi.fn(),
      }),
    }))

    const { useCheckoutProfileGate } = await import('../useCheckoutProfileGate')
    const result = await useCheckoutProfileGate().ensureCustomerProfile()

    expect(result).toBe(false)
    expect(push).toHaveBeenCalledWith({
      path: '/perfil/criar',
      query: { redirect: '/produtos' },
    })
  })
})
