import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '../api'
import { storefrontAppearanceService } from '../storefront-appearance.service'
import type { StorefrontAppearance } from '@/types/store'

vi.mock('../api', () => ({
  default: {
    get: vi.fn(),
    patch: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}))

function buildAppearance(overrides: Partial<StorefrontAppearance> = {}): StorefrontAppearance {
  return {
    secondary_color: '#E91E63',
    hero_enabled: false,
    hero_image_desktop: '',
    hero_image_mobile: '',
    hero_alt_text: '',
    hero_title: '',
    hero_subtitle: '',
    hero_cta_text: '',
    hero_cta_url: '',
    card_style: 'clean',
    radius_style: 'rounded',
    density: 'comfortable',
    motion_enabled: true,
    motion_intensity: 'standard',
    decoration_enabled: false,
    decoration_style: 'none',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('storefrontAppearanceService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches and updates one store appearance by slug', async () => {
    const appearance = buildAppearance({ hero_enabled: true })
    vi.mocked(api.get).mockResolvedValueOnce({ data: appearance } as never)
    vi.mocked(api.patch).mockResolvedValueOnce({ data: appearance } as never)

    await expect(storefrontAppearanceService.get('loja-a')).resolves.toEqual(appearance)
    await expect(storefrontAppearanceService.update('loja-a', { hero_enabled: true })).resolves.toEqual(appearance)

    expect(api.get).toHaveBeenCalledWith('v1/store/mine/loja-a/storefront-appearance/')
    expect(api.patch).toHaveBeenCalledWith('v1/store/mine/loja-a/storefront-appearance/', {
      hero_enabled: true,
    })
  })

  it('fetches the public visitor-facing appearance by slug', async () => {
    const appearance = {
      ...buildAppearance({ hero_enabled: true }),
      store_name: 'Loja A',
      store_slug: 'loja-a',
      logo_url: 'https://example.com/logo.png',
      tagline: 'Catalogo online',
      theme: { primary: '#111111' },
    }
    vi.mocked(api.get).mockResolvedValueOnce({ data: appearance } as never)

    await expect(storefrontAppearanceService.getPublic('loja-a')).resolves.toEqual(appearance)

    expect(api.get).toHaveBeenCalledWith('v1/public/stores/loja-a/appearance/')
  })
})
