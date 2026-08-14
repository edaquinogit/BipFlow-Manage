import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useToast } from '../useToast'

describe('useToast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useToast().clearAll()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('clears one toast type without removing higher-priority feedback', () => {
    const toast = useToast()

    toast.success('Produto adicionado.')
    toast.error('Falha ao registrar pedido.')

    toast.clearByType('success')

    expect(toast.toasts.value).toHaveLength(1)
    expect(toast.toasts.value[0]).toMatchObject({
      type: 'error',
      message: 'Falha ao registrar pedido.',
    })
  })
})
