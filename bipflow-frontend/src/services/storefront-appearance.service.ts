import api from './api'
import type {
  PublicStorefrontAppearance,
  StorefrontAppearance,
  StorefrontAppearancePayload,
} from '@/types/store'

export const storefrontAppearanceService = {
  /** Fetch one store's extended storefront personalization (hero, layout, motion, decorations). */
  async get(slug: string): Promise<StorefrontAppearance> {
    const response = await api.get<StorefrontAppearance>(`v1/store/mine/${slug}/storefront-appearance/`)
    return response.data
  },

  /** Fetch public storefront personalization for a visitor-facing store slug. */
  async getPublic(slug: string): Promise<PublicStorefrontAppearance> {
    const response = await api.get<PublicStorefrontAppearance>(`v1/public/stores/${slug}/appearance/`)
    return response.data
  },

  /** Update one store's extended storefront personalization. */
  async update(slug: string, payload: StorefrontAppearancePayload): Promise<StorefrontAppearance> {
    const response = await api.patch<StorefrontAppearance>(
      `v1/store/mine/${slug}/storefront-appearance/`,
      payload
    )
    return response.data
  },
}
