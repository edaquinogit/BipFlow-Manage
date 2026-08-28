import { describe, expect, it } from 'vitest';
import type { Store, StorefrontAppearance } from '@/types/store';
import {
  DEFAULT_THEME,
  buildAppearancePayload,
  buildDraft,
  buildPaletteFromPrimary,
  buildStorePayload,
  contrastRatio,
  fixThemeContrast,
} from '../storefrontAppearanceEditor';

const baseStore: Store = {
  id: 1,
  name: 'Loja Principal',
  display_name: 'Loja Modelo',
  slug: 'default',
  logo_url: '/media/storefront/logo.png',
  tagline: 'Catalogo online',
  whatsapp_phone: '71999990000',
  theme: {
    primary: '#111111',
    accent: '#111827',
    background: '#FAFAFA',
    surface: '#FFFFFF',
    text: '#05050A',
    muted: '#6B7280',
  },
  is_active: true,
  receipt_exchange_policy: '',
  receipt_paper_format: '80mm',
};

const baseAppearance: StorefrontAppearance = {
  id: 10,
  store_id: 1,
  secondary_color: '#111827',
  favicon_url: '/media/storefront/favicon.png',
  hero_enabled: true,
  hero_image_desktop: '/media/storefront/banner.png',
  hero_image_mobile: '',
  hero_alt_text: 'Banner',
  hero_title: 'Treine com estilo',
  hero_subtitle: 'Confira nossas novidades',
  hero_cta_text: 'Ver produtos',
  hero_destination_type: 'products',
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
  updated_at: '2026-08-25T00:00:00Z',
};

describe('storefrontAppearanceEditor helpers', () => {
  it('builds an editable draft from store and appearance contracts', () => {
    const draft = buildDraft(baseStore, baseAppearance);

    expect(draft.display_name).toBe('Loja Modelo');
    expect(draft.logo_url).toBe('/media/storefront/logo.png');
    expect(draft.favicon_url).toBe('/media/storefront/favicon.png');
    expect(draft.hero_enabled).toBe(true);
    expect(draft.hero_destination_type).toBe('products');
    expect(draft.theme.primary).toBe('#111111');
  });

  it('emits only changed store and appearance payload fields', () => {
    const previous = buildDraft(baseStore, baseAppearance);
    const next = {
      ...previous,
      display_name: 'Nova Loja',
      hero_title: 'Oferta da semana',
      theme: {
        ...previous.theme,
        primary: '#222222',
      },
    };

    expect(buildStorePayload(next, previous)).toEqual({
      display_name: 'Nova Loja',
      theme: {
        ...previous.theme,
        primary: '#222222',
      },
    });
    expect(buildAppearancePayload(next, previous)).toEqual({
      hero_title: 'Oferta da semana',
    });
  });

  it('generates and fixes palettes with readable button text', () => {
    const generated = buildPaletteFromPrimary('#F7A8C8');
    const fixed = fixThemeContrast({
      ...DEFAULT_THEME,
      primary: '#FAFAFA',
      accent: generated.theme.accent,
    });

    expect(contrastRatio('#FFFFFF', generated.theme.primary)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#FFFFFF', fixed.primary)).toBeGreaterThanOrEqual(4.5);
  });
});
