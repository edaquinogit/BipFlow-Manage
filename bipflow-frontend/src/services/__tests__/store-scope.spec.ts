import { beforeEach, describe, expect, it, vi } from 'vitest'

const STORE_SCOPE_STORAGE_KEY = 'bipflow_selected_store_slug'

describe('store-scope', () => {
  beforeEach(() => {
    vi.resetModules()
    window.localStorage.clear()
  })

  it('keeps a persisted slug as a candidate without trusting it for requests', async () => {
    window.localStorage.setItem(STORE_SCOPE_STORAGE_KEY, 'loja-a')

    const storeScope = await import('../store-scope')

    expect(storeScope.getSelectedStoreSlug()).toBe('loja-a')
    expect(storeScope.getRequestStoreSlug()).toBeNull()
  })

  it('trusts an explicitly selected slug and exposes it for requests', async () => {
    const storeScope = await import('../store-scope')

    storeScope.setSelectedStoreSlug(' loja-b ')

    expect(storeScope.getSelectedStoreSlug()).toBe('loja-b')
    expect(storeScope.getRequestStoreSlug()).toBe('loja-b')
    expect(window.localStorage.getItem(STORE_SCOPE_STORAGE_KEY)).toBe('loja-b')
  })

  it('clears the selected slug from memory and localStorage', async () => {
    const storeScope = await import('../store-scope')

    storeScope.setSelectedStoreSlug('loja-a')
    storeScope.clearSelectedStore()

    expect(storeScope.getSelectedStoreSlug()).toBeNull()
    expect(storeScope.getRequestStoreSlug()).toBeNull()
    expect(window.localStorage.getItem(STORE_SCOPE_STORAGE_KEY)).toBeNull()
  })

  it('notifies subscribers when the selected scope is cleared', async () => {
    const storeScope = await import('../store-scope')
    const listener = vi.fn()

    storeScope.subscribeStoreScopeChange(listener)
    storeScope.setSelectedStoreSlug('loja-a')
    storeScope.clearSelectedStore()

    expect(listener).toHaveBeenLastCalledWith(null)
  })
})
