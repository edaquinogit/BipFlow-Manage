import { beforeEach, describe, expect, it, vi } from 'vitest'

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
    vi.doMock('@/services/store-scope', () => ({
      getSelectedStoreSlug: () => 'owner-store',
      setSelectedStoreSlug,
    }))

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
    vi.doMock('@/services/store-scope', () => ({
      getSelectedStoreSlug: () => 'default',
      setSelectedStoreSlug: vi.fn(),
    }))

    const { useCurrentStore } = await import('../useCurrentStore')
    const currentStore = useCurrentStore()

    await currentStore.fetchCurrentStore()
    await currentStore.fetchCurrentStore()

    expect(getCurrent).toHaveBeenCalledTimes(1)
    expect(currentStore.store.value?.slug).toBe('default')
  })
})