import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../api'
import { authService } from '../auth.service'
import { tokenStore } from '../token-store'

vi.mock('../api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}))

vi.mock('../logger', () => ({
  Logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

function seedCartStorage(): void {
  window.localStorage.setItem('bipflow_cart_acme_customer', JSON.stringify({ fullName: 'Ana' }))
  window.localStorage.setItem('bipflow_cart_acme_customer_savedAt', String(Date.now()))
  window.localStorage.setItem(
    'bipflow_cart_other-store_customer',
    JSON.stringify({ fullName: 'Beto' })
  )
  window.localStorage.setItem('bipflow_cart_other-store_customer_savedAt', String(Date.now()))
  window.localStorage.setItem(
    'bipflow_cart_acme_items',
    JSON.stringify([{ product: { id: 1 }, quantity: 2 }])
  )
}

describe('authService logout -- cart PII cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    tokenStore.setAccessToken('fake-token')
  })

  it('logout() clears persisted cart customer PII across every store, but leaves cart items alone', async () => {
    seedCartStorage()
    vi.mocked(api.post).mockResolvedValue({ data: {} } as never)

    await authService.logout()

    expect(window.localStorage.getItem('bipflow_cart_acme_customer')).toBeNull()
    expect(window.localStorage.getItem('bipflow_cart_acme_customer_savedAt')).toBeNull()
    expect(window.localStorage.getItem('bipflow_cart_other-store_customer')).toBeNull()
    expect(window.localStorage.getItem('bipflow_cart_other-store_customer_savedAt')).toBeNull()
    expect(window.localStorage.getItem('bipflow_cart_acme_items')).not.toBeNull()
    expect(tokenStore.hasAccessToken()).toBe(false)
  })

  it('logout() still clears cart PII even when the server revoke call fails', async () => {
    seedCartStorage()
    vi.mocked(api.post).mockRejectedValue(new Error('network down'))

    await authService.logout()

    expect(window.localStorage.getItem('bipflow_cart_acme_customer')).toBeNull()
  })

  it('logoutAllDevices() clears persisted cart customer PII across every store', async () => {
    seedCartStorage()
    vi.mocked(api.post).mockResolvedValue({
      data: { message: 'ok', revoked_count: 2 },
    } as never)

    await authService.logoutAllDevices()

    expect(window.localStorage.getItem('bipflow_cart_acme_customer')).toBeNull()
    expect(window.localStorage.getItem('bipflow_cart_other-store_customer')).toBeNull()
    expect(window.localStorage.getItem('bipflow_cart_acme_items')).not.toBeNull()
  })
})
