import { computed, type ComputedRef, type Ref } from 'vue'
import type { Store, StoreStatus, StoreTheme } from '@/types/store'

const FALLBACK_LOGO_URL = '/brand-logo.png'

const DEFAULT_THEME: Required<Record<keyof StoreTheme, string>> = {
  primary: '#05050A',
  accent: '#D81B60',
  background: '#FAFAFA',
  surface: '#FFFFFF',
  text: '#05050A',
  muted: '#6B7280',
}

const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/

export interface StoreBranding {
  name: string
  slug: string
  logoUrl: string
  tagline: string
  whatsappPhone: string
  isActive: boolean
  status: StoreStatus
  statusLabel: string
  theme: Required<Record<keyof StoreTheme, string>>
  cssVars: Record<string, string>
}

function sanitizeText(value: string | null | undefined, fallback: string): string {
  const normalizedValue = value?.trim()
  return normalizedValue || fallback
}

function sanitizeThemeColor(value: string | null | undefined, fallback: string): string {
  const normalizedValue = value?.trim()
  return normalizedValue && HEX_COLOR_PATTERN.test(normalizedValue) ? normalizedValue : fallback
}

export function buildStoreBranding(store: Store | null | undefined): StoreBranding {
  const theme = {
    primary: sanitizeThemeColor(store?.theme?.primary, DEFAULT_THEME.primary),
    accent: sanitizeThemeColor(store?.theme?.accent, DEFAULT_THEME.accent),
    background: sanitizeThemeColor(store?.theme?.background, DEFAULT_THEME.background),
    surface: sanitizeThemeColor(store?.theme?.surface, DEFAULT_THEME.surface),
    text: sanitizeThemeColor(store?.theme?.text, DEFAULT_THEME.text),
    muted: sanitizeThemeColor(store?.theme?.muted, DEFAULT_THEME.muted),
  }
  const isActive = store?.is_active ?? true
  const status = store?.status ?? (isActive ? 'active' : 'inactive')

  return {
    name: sanitizeText(store?.name, 'Boutique Fitness'),
    slug: sanitizeText(store?.slug, ''),
    logoUrl: sanitizeText(store?.logo_url, FALLBACK_LOGO_URL),
    tagline: sanitizeText(store?.tagline, 'Catalogo online'),
    whatsappPhone: sanitizeText(store?.whatsapp_phone, ''),
    isActive,
    status,
    statusLabel: status === 'active' ? 'Ativa' : 'Inativa',
    theme,
    cssVars: {
      '--store-primary': theme.primary,
      '--store-accent': theme.accent,
      '--store-background': theme.background,
      '--store-surface': theme.surface,
      '--store-text': theme.text,
      '--store-muted': theme.muted,
    },
  }
}

export function useStoreBranding(store: Ref<Store | null> | ComputedRef<Store | null>) {
  return computed(() => buildStoreBranding(store.value))
}
