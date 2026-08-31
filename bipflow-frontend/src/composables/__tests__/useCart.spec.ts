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

describe('useCart - store scope isolation', () => {
  beforeEach(() => {
    vi.resetModules()
    window.localStorage.clear()
  })

  it('rehydrates cart items and customer data when the selected store changes', async () => {
    const cart = await loadCart('loja-a')

    cart.addItem(
      {
        id: 1,
        name: 'Produto Loja A',
        price: '10.00',
        stock_quantity: 5,
        is_available: true,
      } as any,
      2
    )
    cart.updateCustomer({ fullName: 'Ana Loja A', phone: '5571999990000' })
    await nextTick()

    window.localStorage.setItem(
      'bipflow_cart_loja-b_items',
      JSON.stringify([
        {
          product: {
            id: 2,
            name: 'Produto Loja B',
            price: '20.00',
            stock_quantity: 5,
            is_available: true,
          },
          quantity: 1,
        },
      ])
    )
    window.localStorage.setItem(
      'bipflow_cart_loja-b_customer',
      JSON.stringify({ fullName: 'Bia Loja B', phone: '5571888880000' })
    )
    window.localStorage.setItem('bipflow_cart_loja-b_customer_savedAt', String(Date.now()))

    const { setSelectedStoreSlug } = await import('../../services/store-scope')
    setSelectedStoreSlug('loja-b')
    await nextTick()

    expect(cart.items.value).toHaveLength(1)
    expect(cart.items.value[0]?.product.id).toBe(2)
    expect(cart.customer.value.fullName).toBe('Bia Loja B')
    expect(window.localStorage.getItem('bipflow_cart_loja-a_items')).toContain('Produto Loja A')
    expect(window.localStorage.getItem('bipflow_cart_loja-b_items')).toContain('Produto Loja B')
  })

  it('does not refresh the customer TTL stamp for a store scope switch that changes nothing', async () => {
    const cart = await loadCart('loja-a')
    cart.updateCustomer({ fullName: 'Ana Loja A', phone: '5571999990000' })
    await nextTick() // let the real persistence watcher write the initial saved-at stamp

    const backdatedSavedAt = Date.now() - 10 * 24 * 60 * 60 * 1000 // 10 days ago, still within TTL
    window.localStorage.setItem('bipflow_cart_loja-a_customer_savedAt', String(backdatedSavedAt))

    const { setSelectedStoreSlug } = await import('../../services/store-scope')
    setSelectedStoreSlug('loja-b')
    await nextTick()

    // Switching scope flushes loja-a's in-memory state to storage, but since
    // the customer data itself didn't change, the saved-at stamp must not be
    // bumped to "now" -- otherwise the 30-day TTL never elapses as long as
    // the shopper keeps switching stores.
    expect(window.localStorage.getItem('bipflow_cart_loja-a_customer_savedAt')).toBe(
      String(backdatedSavedAt)
    )
  })
})

describe('useCart - product variants', () => {
  beforeEach(() => {
    vi.resetModules()
    window.localStorage.clear()
  })

  const product = {
    id: 1,
    name: 'Camiseta',
    price: '59.90',
    stock_quantity: 8,
    is_available: true,
  } as any

  const black = {
    id: 10,
    name: 'Preto',
    color_hex: '#000000',
    price: null,
    effective_price: '59.90',
    stock_quantity: 3,
    image: 'https://example.com/preto.jpg',
    is_active: true,
    position: 0,
  }

  const blue = {
    id: 11,
    name: 'Azul',
    color_hex: '#3366FF',
    price: null,
    effective_price: '59.90',
    stock_quantity: 5,
    image: null,
    is_active: true,
    position: 1,
  }

  it('keeps different variants of the same product as separate cart lines', async () => {
    const cart = await loadCart()

    cart.addItem(product, 1, black)
    cart.addItem(product, 2, blue)

    expect(cart.items.value).toHaveLength(2)
    expect(cart.getProductQuantity(product.id)).toBe(3)
    expect(cart.getProductQuantity(product.id, black.id)).toBe(1)
    expect(cart.getProductQuantity(product.id, blue.id)).toBe(2)
  })

  it('updates and removes only the requested variant line', async () => {
    const cart = await loadCart()

    cart.addItem(product, 1, black)
    cart.addItem(product, 2, blue)

    cart.updateQuantity(product.id, 4, black.id)
    cart.removeItem(product.id, blue.id)

    expect(cart.items.value).toHaveLength(1)
    expect(cart.items.value[0]?.variant?.id).toBe(black.id)
    expect(cart.items.value[0]?.quantity).toBe(3)
  })

  it('caps variant cart quantities by the selected variant stock', async () => {
    const cart = await loadCart()

    cart.addItem(product, 5, black)
    cart.updateQuantity(product.id, 6, black.id)

    expect(cart.items.value[0]?.quantity).toBe(3)
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
