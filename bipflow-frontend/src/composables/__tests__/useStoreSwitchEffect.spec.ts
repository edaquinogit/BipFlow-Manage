import { describe, it, expect, vi, beforeEach } from 'vitest'
import { effectScope, ref } from 'vue'
import { useStoreSwitchEffect } from '../useStoreSwitchEffect'
import { useCurrentStore } from '../useCurrentStore'

vi.mock('../useCurrentStore', () => ({ useCurrentStore: vi.fn() }))

describe('useStoreSwitchEffect', () => {
  const selectedStore = ref<{ slug: string } | null>(null)

  beforeEach(() => {
    selectedStore.value = null
    vi.mocked(useCurrentStore).mockReturnValue({ selectedStore } as any)
  })

  it('does not run the callback on the initial resolution from null to the first store', async () => {
    const callback = vi.fn()
    const scope = effectScope()
    scope.run(() => useStoreSwitchEffect(callback))

    selectedStore.value = { slug: 'loja-principal' }
    await null

    expect(callback).not.toHaveBeenCalled()
    scope.stop()
  })

  it('runs the callback when the resolved store changes to a different slug', async () => {
    selectedStore.value = { slug: 'loja-principal' }
    const callback = vi.fn()
    const scope = effectScope()
    scope.run(() => useStoreSwitchEffect(callback))

    selectedStore.value = { slug: 'filial-centro' }
    await null

    expect(callback).toHaveBeenCalledTimes(1)
    scope.stop()
  })

  it('does not run the callback when the same store resolves again with a new object reference', async () => {
    selectedStore.value = { slug: 'loja-principal' }
    const callback = vi.fn()
    const scope = effectScope()
    scope.run(() => useStoreSwitchEffect(callback))

    selectedStore.value = { slug: 'loja-principal' }
    await null

    expect(callback).not.toHaveBeenCalled()
    scope.stop()
  })
})
