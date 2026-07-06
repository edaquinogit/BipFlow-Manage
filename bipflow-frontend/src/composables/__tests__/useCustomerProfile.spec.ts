import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('useCustomerProfile', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('stores the profile and reports hasProfile=true on success', async () => {
    const profile = {
      full_name: 'Cliente Teste',
      phone: '11999990000',
      email: 'cliente@example.com',
      address: '',
      neighborhood: '',
      city: '',
      delivery_region_id: null,
      delivery_region_name: '',
    }
    const getMe = vi.fn().mockResolvedValue(profile)

    vi.doMock('@/services/customer.service', () => ({
      customerService: { getMe, updateMe: vi.fn() },
    }))

    const { useCustomerProfile } = await import('../useCustomerProfile')
    const { profile: profileRef, hasProfile, fetchCustomerProfile } = useCustomerProfile()

    const result = await fetchCustomerProfile()

    expect(result).toBe(true)
    expect(hasProfile.value).toBe(true)
    expect(profileRef.value).toEqual(profile)
  })

  it('reports hasProfile=false and clears the profile on failure (401/404)', async () => {
    const getMe = vi.fn().mockRejectedValue(new Error('not found'))

    vi.doMock('@/services/customer.service', () => ({
      customerService: { getMe, updateMe: vi.fn() },
    }))

    const { useCustomerProfile } = await import('../useCustomerProfile')
    const { profile: profileRef, hasProfile, fetchCustomerProfile } = useCustomerProfile()

    const result = await fetchCustomerProfile()

    expect(result).toBe(false)
    expect(hasProfile.value).toBe(false)
    expect(profileRef.value).toBeNull()
  })

  it('resetCustomerProfile clears state back to unknown', async () => {
    vi.doMock('@/services/customer.service', () => ({
      customerService: { getMe: vi.fn().mockResolvedValue({}), updateMe: vi.fn() },
    }))

    const { useCustomerProfile } = await import('../useCustomerProfile')
    const { hasProfile, fetchCustomerProfile, resetCustomerProfile } = useCustomerProfile()

    await fetchCustomerProfile()
    expect(hasProfile.value).toBe(true)

    resetCustomerProfile()

    expect(hasProfile.value).toBeNull()
  })
})
