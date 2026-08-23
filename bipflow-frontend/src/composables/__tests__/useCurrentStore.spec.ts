import { beforeEach, describe, expect, it, vi } from 'vitest'

function mockStoreScope(initialSlug: string | null) {
  const setSelectedStoreSlug = vi.fn()
  const listeners: Array<(slug: string | null) => void> = []

  vi.doMock('@/services/store-scope', () => ({
    getSelectedStoreSlug: () => initialSlug,
    setSelectedStoreSlug,
    subscribeStoreScopeChange: vi.fn((listener: (slug: string | null) => void) => {
      listeners.push(listener)
      return vi.fn()
    }),
  }))

  return {
    setSelectedStoreSlug,
    notifyStoreScopeChange: (slug: string | null) => {
      listeners.forEach((listener) => listener(slug))
    },
  }
}

describe('useCurrentStore', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('re-fetches the current store when the requested slug changes during a fresh cache window', async () => {
    const getCurrent = vi
      .fn()
      .mockResolvedValueOnce({ id: 1, name: 'Nome do Usuario', slug: 'owner-store' })
      .mockResolvedValueOnce({ id: 2, name: 'Loja Correta', slug: 'default' })
    const getMine = vi.fn().mockResolvedValue([])
    const setSelectedStoreSlug = vi.fn()

    vi.doMock('@/services/store.service', () => ({
      storeService: { getCurrent, getMine },
    }))
    vi.doMock('@/services/auth.service', () => ({
      authService: { isAuthenticated: () => false },
    }))
    mockStoreScope('owner-store').setSelectedStoreSlug.mockImplementation(setSelectedStoreSlug)

    const { useCurrentStore } = await import('../useCurrentStore')
    const currentStore = useCurrentStore()

    await currentStore.fetchCurrentStore()
    currentStore.selectedStoreSlug.value = 'default'
    await currentStore.fetchCurrentStore()

    expect(getCurrent).toHaveBeenCalledTimes(2)
    expect(currentStore.store.value?.slug).toBe('default')
    expect(currentStore.store.value?.name).toBe('Loja Correta')
  })

  it('reuses the cache when the requested slug still matches the cached store', async () => {
    const getCurrent = vi.fn().mockResolvedValue({ id: 1, name: 'Loja Correta', slug: 'default' })
    const getMine = vi.fn().mockResolvedValue([])

    vi.doMock('@/services/store.service', () => ({
      storeService: { getCurrent, getMine },
    }))
    vi.doMock('@/services/auth.service', () => ({
      authService: { isAuthenticated: () => false },
    }))
    mockStoreScope('default')

    const { useCurrentStore } = await import('../useCurrentStore')
    const currentStore = useCurrentStore()

    await currentStore.fetchCurrentStore()
    await currentStore.fetchCurrentStore()

    expect(getCurrent).toHaveBeenCalledTimes(1)
    expect(currentStore.store.value?.slug).toBe('default')
  })

  it('discards a persisted slug that does not belong to the authenticated user', async () => {
    const getCurrent = vi.fn()
    const getMine = vi.fn().mockResolvedValue([
      { id: 2, name: 'Loja B', slug: 'loja-b' },
    ])
    const { setSelectedStoreSlug } = mockStoreScope('loja-a')

    vi.doMock('@/services/store.service', () => ({
      storeService: { getCurrent, getMine },
    }))
    vi.doMock('@/services/auth.service', () => ({
      authService: { isAuthenticated: () => true },
    }))

    const { useCurrentStore } = await import('../useCurrentStore')
    const currentStore = useCurrentStore()

    await currentStore.fetchCurrentStore()

    expect(getMine).toHaveBeenCalledTimes(1)
    expect(getCurrent).not.toHaveBeenCalled()
    expect(currentStore.selectedStore.value?.slug).toBe('loja-b')
    expect(currentStore.storefrontPath.value).toBe('/l/loja-b/produtos')
    expect(setSelectedStoreSlug).toHaveBeenCalledWith('loja-b')
  })

  it('keeps a persisted slug when it belongs to the authenticated user', async () => {
    const getCurrent = vi.fn()
    const getMine = vi.fn().mockResolvedValue([
      { id: 2, name: 'Loja B', slug: 'loja-b' },
      { id: 1, name: 'Loja A', slug: 'loja-a' },
    ])
    const { setSelectedStoreSlug } = mockStoreScope('loja-a')

    vi.doMock('@/services/store.service', () => ({
      storeService: { getCurrent, getMine },
    }))
    vi.doMock('@/services/auth.service', () => ({
      authService: { isAuthenticated: () => true },
    }))

    const { useCurrentStore } = await import('../useCurrentStore')
    const currentStore = useCurrentStore()

    await currentStore.fetchCurrentStore()

    expect(getCurrent).not.toHaveBeenCalled()
    expect(currentStore.selectedStore.value?.slug).toBe('loja-a')
    expect(currentStore.storefrontPath.value).toBe('/l/loja-a/produtos')
    expect(setSelectedStoreSlug).toHaveBeenCalledWith('loja-a')
  })

  it('resets the in-memory store singleton when the selected scope is cleared', async () => {
    const getCurrent = vi.fn()
    const getMine = vi.fn().mockResolvedValue([
      { id: 1, name: 'Loja A', slug: 'loja-a' },
    ])
    const { notifyStoreScopeChange } = mockStoreScope('loja-a')

    vi.doMock('@/services/store.service', () => ({
      storeService: { getCurrent, getMine },
    }))
    vi.doMock('@/services/auth.service', () => ({
      authService: { isAuthenticated: () => true },
    }))

    const { useCurrentStore } = await import('../useCurrentStore')
    const currentStore = useCurrentStore()

    await currentStore.fetchCurrentStore()
    notifyStoreScopeChange(null)

    expect(currentStore.store.value).toBeNull()
    expect(currentStore.stores.value).toEqual([])
    expect(currentStore.selectedStoreSlug.value).toBeNull()
    expect(currentStore.storefrontPath.value).toBe('/produtos')
  })
})
