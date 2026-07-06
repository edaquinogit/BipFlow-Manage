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

describe('customer account route guard', () => {
  beforeEach(async () => {
    vi.mocked(authService.isAuthenticated).mockReturnValue(false)
    await router.push('/')
  })

  it('redirects storefront account access to the customer login route, not admin login', async () => {
    await router.push('/l/default/conta')

    expect(router.currentRoute.value.fullPath).toBe(
      '/l/default/login?redirect=/l/default/conta&reason=customer_auth_required'
    )
  })

  it('keeps admin-protected routes redirecting to the admin login', async () => {
    await router.push('/dashboard')

    expect(router.currentRoute.value.fullPath).toBe(
      '/login?redirect=/dashboard&reason=auth_required'
    )
  })
})
