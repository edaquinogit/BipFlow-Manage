import type { StoreTheme } from '@/types/store'

export interface StorefrontPalettePreset {
  id: string
  label: string
  theme: Required<Record<keyof StoreTheme, string>>
  secondaryColor: string
}

export const STOREFRONT_PALETTE_PRESETS: StorefrontPalettePreset[] = [
  {
    id: 'neutro-premium',
    label: 'Neutro premium',
    theme: {
      primary: '#05050A',
      accent: '#111827',
      background: '#FAFAFA',
      surface: '#FFFFFF',
      text: '#05050A',
      muted: '#6B7280',
    },
    secondaryColor: '#374151',
  },
  {
    id: 'azul-profissional',
    label: 'Azul profissional',
    theme: {
      primary: '#0F172A',
      accent: '#2563EB',
      background: '#F8FAFC',
      surface: '#FFFFFF',
      text: '#0F172A',
      muted: '#64748B',
    },
    secondaryColor: '#38BDF8',
  },
  {
    id: 'preto-premium',
    label: 'Preto premium',
    theme: {
      primary: '#050505',
      accent: '#D4AF37',
      background: '#F7F7F5',
      surface: '#FFFFFF',
      text: '#111111',
      muted: '#6F6A5F',
    },
    secondaryColor: '#E8C766',
  },
  {
    id: 'verde-natural',
    label: 'Verde natural',
    theme: {
      primary: '#14532D',
      accent: '#16A34A',
      background: '#F7FAF5',
      surface: '#FFFFFF',
      text: '#102A1D',
      muted: '#647067',
    },
    secondaryColor: '#84CC16',
  },
  {
    id: 'minimalista',
    label: 'Minimalista',
    theme: {
      primary: '#111827',
      accent: '#6B7280',
      background: '#FFFFFF',
      surface: '#F9FAFB',
      text: '#111827',
      muted: '#6B7280',
    },
    secondaryColor: '#9CA3AF',
  },
]
