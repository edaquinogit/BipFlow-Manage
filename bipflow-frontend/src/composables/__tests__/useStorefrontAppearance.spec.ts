import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import { useStorefrontAppearance } from '../useStorefrontAppearance'
import { storefrontAppearanceService } from '@/services/storefront-appearance.service'
import { Logger } from '@/services/logger'
import type { StorefrontAppearance } from '@/types/store'

vi.mock('@/services/storefront-appearance.service', () => ({
  storefrontAppearanceService: {
    get: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock('@/services/logger', () => ({
  Logger: {
    error: vi.fn(),
  },
}))

function buildAppearance(overrides: Partial<StorefrontAppearance> = {}): StorefrontAppearance {
  return {
    id: 10,
    store_id: 1,
    secondary_color: '#374151',
    favicon_url: '',
    hero_enabled: false,
    hero_image_desktop: '',
    hero_image_mobile: '',
    hero_alt_text: '',
    hero_title: '',
    hero_subtitle: '',
    hero_cta_text: '',
    hero_destination_type: 'none',
    hero_destination_value: '',
    hero_cta_url: '',
    card_style: 'clean',
    radius_style: 'rounded',
    density: 'comfortable',
    font_preset: 'modern',
    motion_enabled: true,
    motion_intensity: 'standard',
    decoration_enabled: false,
    decoration_style: 'none',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('useStorefrontAppearance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(storefrontAppearanceService.get).mockResolvedValue(buildAppearance())
  })

  it('loads the active store appearance without putting a slug in the request URL', async () => {
    const slug = ref('loja-a')
    const { appearance, isLoading, loadError } = useStorefrontAppearance(slug)

    expect(isLoading.value).toBe(true)
    await flushPromises()

    expect(storefrontAppearanceService.get).toHaveBeenCalledWith()
    expect(isLoading.value).toBe(false)
    expect(loadError.value).toBeNull()
    expect(appearance.value?.store_id).toBe(1)
  })

  it('keeps empty state clean while no active store is selected', async () => {
    const slug = ref<string | null>(null)
    const { appearance, isLoading, loadError } = useStorefrontAppearance(slug)
    await flushPromises()

    expect(storefrontAppearanceService.get).not.toHaveBeenCalled()
    expect(appearance.value).toBeNull()
    expect(isLoading.value).toBe(false)
    expect(loadError.value).toBeNull()
  })

  it('exposes a friendly error and logs diagnostic context when loading fails', async () => {
    const apiError = Object.assign(new Error('Forbidden'), {
      response: { status: 403, data: { message: 'Sem permissao' } },
      config: { url: 'v1/store/current/storefront-appearance/', method: 'get' },
    })
    vi.mocked(storefrontAppearanceService.get).mockRejectedValue(apiError)

    const slug = ref('loja-a')
    const { appearance, isLoading, loadError } = useStorefrontAppearance(slug)
    await flushPromises()

    expect(appearance.value).toBeNull()
    expect(isLoading.value).toBe(false)
    expect(loadError.value).toBe('Nao foi possivel carregar a aparencia da vitrine.')
    expect(Logger.error).toHaveBeenCalledWith(
      'Storefront appearance load failed',
      expect.objectContaining({
        endpoint: 'v1/store/current/storefront-appearance/',
        selectedStoreSlug: 'loja-a',
        statusCode: 403,
      }),
    )
  })

  it('sends only the PATCH payload and keeps state synchronized after save', async () => {
    vi.mocked(storefrontAppearanceService.update).mockResolvedValue(
      buildAppearance({ hero_enabled: true }),
    )

    const slug = ref('loja-a')
    const { appearance, save } = useStorefrontAppearance(slug)
    await flushPromises()

    await save({ hero_enabled: true })

    expect(storefrontAppearanceService.update).toHaveBeenCalledWith({ hero_enabled: true })
    expect(appearance.value?.hero_enabled).toBe(true)
  })
})
