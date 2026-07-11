import { describe, it, expect, beforeEach, vi } from 'vitest'
import { nextTick } from 'vue'

async function loadCart(slug = 'acme') {
  const { setSelectedStoreSlug } = await import('../../services/store-scope')
  setSelectedStoreSlug(slug)
  const { useCart } = await import('../useCart')
  return useCart()
}

describe('useCart - customer PII TTL', () => {
  beforeEach(() => {
    vi.resetModules()
    window.localStorage.clear()
  })

  it('persists customer data and reloads it within the TTL window', async () => {
    const cart = await loadCart()
    cart.updateCustomer({ fullName: 'Ana', phone: '5571999990000' })
    await nextTick()

    vi.resetModules()
    const reloaded = await loadCart()

    expect(reloaded.customer.value.fullName).toBe('Ana')
    expect(reloaded.customer.value.phone).toBe('5571999990000')
  })

  it('treats customer data past the 30-day TTL as expired', async () => {
    const cart = await loadCart()
    cart.updateCustomer({ fullName: 'Ana' })
    await nextTick() // let the persistence watcher write the real saved-at stamp first

    const staleTimestamp = Date.now() - 31 * 24 * 60 * 60 * 1000
    window.localStorage.setItem('bipflow_cart_acme_customer_savedAt', String(staleTimestamp))

    vi.resetModules()
    const reloaded = await loadCart()

    expect(reloaded.customer.value.fullName).toBe('')
    expect(window.localStorage.getItem('bipflow_cart_acme_customer')).toBeNull()
  })

  it('treats legacy customer data with no saved-at timestamp as expired', async () => {
    window.localStorage.setItem(
      'bipflow_cart_acme_customer',
      JSON.stringify({ fullName: 'Legacy Name' })
    )
    // No _savedAt key -- simulates data written before this TTL existed.

    const cart = await loadCart()

    expect(cart.customer.value.fullName).toBe('')
  })

  it('does not expire cart items when the customer TTL lapses', async () => {
    window.localStorage.setItem(
      'bipflow_cart_acme_items',
      JSON.stringify([{ product: { id: 1, stock_quantity: 5 }, quantity: 2 }])
    )
    window.localStorage.setItem(
      'bipflow_cart_acme_customer_savedAt',
      String(Date.now() - 31 * 24 * 60 * 60 * 1000)
    )

    const cart = await loadCart()

    expect(cart.items.value).toHaveLength(1)
  })
})

describe('clearAllPersistedCartCustomerData', () => {
  beforeEach(() => {
    vi.resetModules()
    window.localStorage.clear()
  })

  it('removes customer PII for every store but leaves cart items untouched', async () => {
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

    const { clearAllPersistedCartCustomerData } = await import('../useCart')
    clearAllPersistedCartCustomerData()

    expect(window.localStorage.getItem('bipflow_cart_acme_customer')).toBeNull()
    expect(window.localStorage.getItem('bipflow_cart_acme_customer_savedAt')).toBeNull()
    expect(window.localStorage.getItem('bipflow_cart_other-store_customer')).toBeNull()
    expect(window.localStorage.getItem('bipflow_cart_other-store_customer_savedAt')).toBeNull()
    expect(window.localStorage.getItem('bipflow_cart_acme_items')).not.toBeNull()
  })
})
