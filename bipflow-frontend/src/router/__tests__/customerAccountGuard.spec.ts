import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/services/api', () => ({
  ensureAuthBooted: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/services/auth.service', () => ({
  authService: {
    isAuthenticated: vi.fn(),
  },
}))

import router from '../index'
import { authService } from '@/services/auth.service'
import { ensureAuthBooted } from '@/services/api'

describe('customer account route guard', () => {
  beforeEach(async () => {
    vi.mocked(authService.isAuthenticated).mockReturnValue(false)
    await router.push('/')
    vi.mocked(ensureAuthBooted).mockClear()
  })

  it('redirects storefront account access to the customer login route, not admin login', async () => {
    await router.push('/l/default/conta')

    expect(ensureAuthBooted).toHaveBeenCalledWith({ force: true })
    expect(router.currentRoute.value.fullPath).toBe(
      '/l/default/login?redirect=/l/default/conta&reason=customer_auth_required'
    )
  })

  it('keeps admin-protected routes redirecting to the admin login', async () => {
    await router.push('/dashboard')

    expect(ensureAuthBooted).toHaveBeenLastCalledWith({ force: true })
    expect(router.currentRoute.value.fullPath).toBe(
      '/login?redirect=/dashboard&reason=auth_required'
    )
  })

  it('does not force auth boot for an anonymous public catalog visit', async () => {
    await router.push('/l/default/produtos')

    expect(ensureAuthBooted).toHaveBeenLastCalledWith({ force: false })
    expect(router.currentRoute.value.fullPath).toBe('/l/default/produtos')
  })
})
