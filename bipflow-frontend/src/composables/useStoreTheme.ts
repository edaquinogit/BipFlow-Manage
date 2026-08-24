import { computed, type ComputedRef, type Ref } from 'vue'
import type { Store } from '@/types/store'
import { buildStoreBranding, type StoreBranding } from '@/composables/useStoreBranding'

export interface StoreThemeTokens extends StoreBranding {
  /** Full semantic token map for the storefront theme engine (--store-*, --motion-*). */
  cssVars: Record<string, string>
}

/**
 * Editable per-store colors only. Every derived token (hover/soft shades,
 * radius, motion) is computed in CSS from these -- see storefront-theme.css --
 * so no component ever needs to know a store's raw hex values.
 */
export function buildStoreTheme(store: Store | null | undefined): StoreThemeTokens {
  const branding = buildStoreBranding(store)

  return {
    ...branding,
    cssVars: {
      ...branding.cssVars,
      '--store-secondary-base': branding.theme.accent,
    },
  }
}

export function useStoreTheme(store: Ref<Store | null> | ComputedRef<Store | null>) {
  return computed(() => buildStoreTheme(store.value))
}
