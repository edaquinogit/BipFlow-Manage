import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAsyncResource } from '../useAsyncResource'
import { Logger } from '../../services/logger'

vi.mock('../../services/logger', () => ({
  Logger: {
    warn: vi.fn(),
  },
}))

describe('useAsyncResource', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('starts idle with no data and no error', () => {
    const resource = useAsyncResource<number>()

    expect(resource.data.value).toBeNull()
    expect(resource.isLoading.value).toBe(false)
    expect(resource.error.value).toBeNull()
  })

  it('sets data and clears isLoading on a successful run', async () => {
    const resource = useAsyncResource<{ total: number }>()

    await resource.run(() => Promise.resolve({ total: 42 }), 'falhou')

    expect(resource.data.value).toEqual({ total: 42 })
    expect(resource.isLoading.value).toBe(false)
    expect(resource.error.value).toBeNull()
  })

  it('toggles isLoading to true while the loader is pending', async () => {
    const resource = useAsyncResource<number>()
    let resolveLoader: (value: number) => void = () => {}
    const pending = new Promise<number>((resolve) => {
      resolveLoader = resolve
    })

    const runPromise = resource.run(() => pending, 'falhou')
    expect(resource.isLoading.value).toBe(true)

    resolveLoader(1)
    await runPromise

    expect(resource.isLoading.value).toBe(false)
  })

  it('sets the given error message and logs on failure, leaving data untouched', async () => {
    const resource = useAsyncResource<number>()
    await resource.run(() => Promise.resolve(1), 'falhou');

    await resource.run(() => Promise.reject(new Error('boom')), 'Nao foi possivel carregar.')

    expect(resource.data.value).toBe(1)
    expect(resource.error.value).toBe('Nao foi possivel carregar.')
    expect(resource.isLoading.value).toBe(false)
    expect(Logger.warn).toHaveBeenCalledWith(
      'useAsyncResource: request failed',
      expect.objectContaining({ error: expect.any(Error) })
    )
  })

  it('clears a previous error at the start of the next run', async () => {
    const resource = useAsyncResource<number>()
    await resource.run(() => Promise.reject(new Error('boom')), 'falhou')
    expect(resource.error.value).toBe('falhou')

    await resource.run(() => Promise.resolve(2), 'falhou')

    expect(resource.error.value).toBeNull()
    expect(resource.data.value).toBe(2)
  })
})
