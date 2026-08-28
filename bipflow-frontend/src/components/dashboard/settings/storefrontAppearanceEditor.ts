import type {
  CardStyle,
  DecorationStyle,
  FontPreset,
  LayoutDensity,
  MotionIntensity,
  RadiusStyle,
  Store,
  StoreAppearanceSettingsPayload,
  StorefrontAppearance,
  StorefrontAppearancePayload,
  StorefrontBannerStatus,
  StorefrontDestinationType,
  StoreTheme,
} from '@/types/store';

export type AppearanceSection = 'identidade' | 'banner' | 'promocoes' | 'estilo' | 'preview';
export type ThemeColorKey = keyof StoreTheme;
export type ThemeDraft = Record<ThemeColorKey, string>;
export type PreviewMode = 'desktop' | 'mobile';
export type UploadSurfaceKind = 'logo' | 'favicon' | 'banner';

export interface AppearanceDraft {
  display_name: string;
  logo_url: string;
  favicon_url: string;
  tagline: string;
  theme: ThemeDraft;
  secondary_color: string;
  hero_enabled: boolean;
  hero_image_desktop: string;
  hero_image_mobile: string;
  hero_alt_text: string;
  hero_title: string;
  hero_subtitle: string;
  hero_cta_text: string;
  hero_destination_type: StorefrontDestinationType;
  hero_destination_value: string;
  card_style: CardStyle;
  radius_style: RadiusStyle;
  density: LayoutDensity;
  font_preset: FontPreset;
  motion_enabled: boolean;
  motion_intensity: MotionIntensity;
  decoration_enabled: boolean;
  decoration_style: DecorationStyle;
}

export interface BannerEditor {
  clientId: string;
  id: number | null;
  image_url: string;
  alt_text: string;
  title: string;
  subtitle: string;
  cta_text: string;
  destination_type: StorefrontDestinationType;
  destination_value: string;
  position: number;
  is_active: boolean;
  status: StorefrontBannerStatus | 'draft';
  starts_at: string;
  ends_at: string;
  pendingFile: File | null;
  pendingPreviewUrl: string | null;
  fileError: string | null;
  saveError: string | null;
  isSaving: boolean;
  isDeleting: boolean;
}

export interface SetupStep {
  id: 'logo' | 'colors' | 'banner' | 'review';
  label: string;
  isComplete: boolean;
  section: AppearanceSection;
}

export interface ContrastCheck {
  id: string;
  label: string;
  ratio: number;
  minimum: number;
  isOk: boolean;
}

export const SECTIONS: { value: AppearanceSection; label: string }[] = [
  { value: 'identidade', label: 'Identidade' },
  { value: 'banner', label: 'Banner principal' },
  { value: 'promocoes', label: 'Promocoes' },
  { value: 'estilo', label: 'Estilo' },
  { value: 'preview', label: 'Preview' },
];

export const DESTINATION_OPTIONS: { value: StorefrontDestinationType; label: string }[] = [
  { value: 'none', label: 'Nao fazer nada' },
  { value: 'products', label: 'Abrir vitrine' },
  { value: 'category', label: 'Abrir categoria' },
  { value: 'product', label: 'Abrir produto' },
  { value: 'external_url', label: 'Abrir link externo' },
];

export const CORE_THEME_COLOR_FIELDS: { key: ThemeColorKey; label: string; hint: string }[] = [
  { key: 'primary', label: 'Cor principal', hint: 'Usada em botoes e acoes principais.' },
  { key: 'accent', label: 'Cor de destaque', hint: 'Realca campanhas, selecoes e chamadas.' },
  { key: 'background', label: 'Fundo', hint: 'Base visual da vitrine.' },
  { key: 'text', label: 'Texto', hint: 'Cor das informacoes principais.' },
];

export const ADVANCED_THEME_COLOR_FIELDS: { key: ThemeColorKey; label: string; hint: string }[] = [
  { key: 'surface', label: 'Superficie', hint: 'Fundo de cards e areas internas.' },
  { key: 'muted', label: 'Texto auxiliar', hint: 'Descricoes e informacoes secundarias.' },
];

export const FONT_PRESET_OPTIONS: { value: FontPreset; label: string }[] = [
  { value: 'modern', label: 'Moderna' },
  { value: 'editorial', label: 'Editorial' },
  { value: 'classic', label: 'Classica' },
];

export const CARD_STYLE_OPTIONS: { value: CardStyle; label: string; description: string }[] = [
  { value: 'clean', label: 'Minimalista', description: 'Poucos elementos e foco no produto.' },
  { value: 'bordered', label: 'Profissional', description: 'Bordas claras e leitura organizada.' },
  { value: 'elevated', label: 'Moderno', description: 'Cards com mais destaque visual.' },
];

export const RADIUS_STYLE_OPTIONS: { value: RadiusStyle; label: string }[] = [
  { value: 'minimal', label: 'Reto' },
  { value: 'rounded', label: 'Suave' },
  { value: 'soft', label: 'Arredondado' },
];

export const DENSITY_OPTIONS: { value: LayoutDensity; label: string }[] = [
  { value: 'compact', label: 'Compacto' },
  { value: 'comfortable', label: 'Confortavel' },
];

export const MOTION_OPTIONS: { value: MotionIntensity; label: string; description: string }[] = [
  { value: 'subtle', label: 'Suave', description: 'Transicoes discretas.' },
  { value: 'standard', label: 'Dinamico', description: 'Mais presenca nas interacoes.' },
];

export const DEFAULT_THEME: ThemeDraft = {
  primary: '#05050A',
  accent: '#111827',
  background: '#FAFAFA',
  surface: '#FFFFFF',
  text: '#05050A',
  muted: '#6B7280',
};

export const SECONDARY_COLOR_FALLBACK = '#111827';

export function buildThemeDraft(theme: StoreTheme | null | undefined): ThemeDraft {
  return {
    primary: theme?.primary || DEFAULT_THEME.primary,
    accent: theme?.accent || DEFAULT_THEME.accent,
    background: theme?.background || DEFAULT_THEME.background,
    surface: theme?.surface || DEFAULT_THEME.surface,
    text: theme?.text || DEFAULT_THEME.text,
    muted: theme?.muted || DEFAULT_THEME.muted,
  };
}

export function inferHeroDestinationType(
  appearanceValue: StorefrontAppearance | null,
): StorefrontDestinationType {
  if (appearanceValue?.hero_destination_type && appearanceValue.hero_destination_type !== 'none') {
    return appearanceValue.hero_destination_type;
  }

  return appearanceValue?.hero_cta_url ? 'external_url' : 'none';
}

export function buildDraft(
  store: Store | null,
  appearanceValue: StorefrontAppearance | null,
): AppearanceDraft {
  const heroDestinationType = inferHeroDestinationType(appearanceValue);

  return {
    display_name: store?.display_name ?? '',
    logo_url: store?.logo_url ?? '',
    favicon_url: appearanceValue?.favicon_url ?? '',
    tagline: store?.tagline ?? '',
    theme: buildThemeDraft(store?.theme),
    secondary_color: appearanceValue?.secondary_color || SECONDARY_COLOR_FALLBACK,
    hero_enabled: appearanceValue?.hero_enabled ?? false,
    hero_image_desktop: appearanceValue?.hero_image_desktop ?? '',
    hero_image_mobile: appearanceValue?.hero_image_mobile ?? '',
    hero_alt_text: appearanceValue?.hero_alt_text ?? '',
    hero_title: appearanceValue?.hero_title ?? '',
    hero_subtitle: appearanceValue?.hero_subtitle ?? '',
    hero_cta_text: appearanceValue?.hero_cta_text ?? '',
    hero_destination_type: heroDestinationType,
    hero_destination_value: appearanceValue?.hero_destination_value || (
      heroDestinationType === 'external_url' ? appearanceValue?.hero_cta_url ?? '' : ''
    ),
    card_style: appearanceValue?.card_style ?? 'clean',
    radius_style: appearanceValue?.radius_style ?? 'rounded',
    density: appearanceValue?.density ?? 'comfortable',
    font_preset: appearanceValue?.font_preset ?? 'modern',
    motion_enabled: appearanceValue?.motion_enabled ?? true,
    motion_intensity: appearanceValue?.motion_intensity ?? 'standard',
    decoration_enabled: appearanceValue?.decoration_enabled ?? false,
    decoration_style: appearanceValue?.decoration_style ?? 'none',
  };
}

export function buildDefaultDraft(): AppearanceDraft {
  return {
    ...buildDraft(null, null),
    theme: { ...DEFAULT_THEME },
  };
}

export function cloneDraft(draftValue: AppearanceDraft): AppearanceDraft {
  return {
    ...draftValue,
    theme: { ...draftValue.theme },
  };
}

export function areDraftsEqual(left: AppearanceDraft, right: AppearanceDraft): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function describeFile(file: File): string {
  return `${file.name} - ${formatBytes(file.size)}`;
}

export function normalizeHexColor(value: string, fallback: string): string {
  const normalizedValue = String(value || '').trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(normalizedValue)) {
    return normalizedValue.toUpperCase();
  }
  if (/^#[0-9A-Fa-f]{3}$/.test(normalizedValue)) {
    return `#${normalizedValue.slice(1).split('').map((item) => `${item}${item}`).join('')}`.toUpperCase();
  }
  return fallback;
}

function hexToRgb(value: string): { r: number; g: number; b: number } {
  const normalizedValue = normalizeHexColor(value, '#000000').slice(1);
  return {
    r: Number.parseInt(normalizedValue.slice(0, 2), 16),
    g: Number.parseInt(normalizedValue.slice(2, 4), 16),
    b: Number.parseInt(normalizedValue.slice(4, 6), 16),
  };
}

function channelToLinear(channel: number): number {
  const value = channel / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(color: string): number {
  const { r, g, b } = hexToRgb(color);
  return (
    0.2126 * channelToLinear(r)
    + 0.7152 * channelToLinear(g)
    + 0.0722 * channelToLinear(b)
  );
}

export function contrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

export function buildContrastCheck(
  id: string,
  label: string,
  foreground: string,
  background: string,
  minimum = 4.5,
): ContrastCheck {
  const ratio = contrastRatio(foreground, background);
  return {
    id,
    label,
    ratio,
    minimum,
    isOk: ratio >= minimum,
  };
}

export function readableTextOn(background: string): string {
  return contrastRatio('#05050A', background) >= contrastRatio('#FFFFFF', background)
    ? '#05050A'
    : '#FFFFFF';
}

function rgbToHex(channel: number): string {
  return Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, '0');
}

function hslToHex(hue: number, saturation: number, lightness: number): string {
  const normalizedHue = ((hue % 360) + 360) % 360;
  const s = Math.max(0, Math.min(100, saturation)) / 100;
  const l = Math.max(0, Math.min(100, lightness)) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((normalizedHue / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;

  if (normalizedHue < 60) [r, g, b] = [c, x, 0];
  else if (normalizedHue < 120) [r, g, b] = [x, c, 0];
  else if (normalizedHue < 180) [r, g, b] = [0, c, x];
  else if (normalizedHue < 240) [r, g, b] = [0, x, c];
  else if (normalizedHue < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  return `#${rgbToHex((r + m) * 255)}${rgbToHex((g + m) * 255)}${rgbToHex((b + m) * 255)}`.toUpperCase();
}

function hexToHsl(value: string): { h: number; s: number; l: number } {
  const { r, g, b } = hexToRgb(value);
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const lightness = (max + min) / 2;
  let hue = 0;
  let saturation = 0;

  if (delta !== 0) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));
    if (max === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (max === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }

  return {
    h: hue < 0 ? hue + 360 : hue,
    s: saturation * 100,
    l: lightness * 100,
  };
}

export function ensureWhiteTextContrast(color: string): string {
  let normalizedColor = normalizeHexColor(color, DEFAULT_THEME.primary);
  const { h, s } = hexToHsl(normalizedColor);
  let { l } = hexToHsl(normalizedColor);

  while (contrastRatio('#FFFFFF', normalizedColor) < 4.5 && l > 18) {
    l -= 4;
    normalizedColor = hslToHex(h, s, l);
  }

  return normalizedColor;
}

export function fixThemeContrast(theme: ThemeDraft): ThemeDraft {
  const background = normalizeHexColor(theme.background, DEFAULT_THEME.background);
  return {
    ...theme,
    background,
    surface: normalizeHexColor(theme.surface, DEFAULT_THEME.surface),
    text: readableTextOn(background),
    primary: ensureWhiteTextContrast(theme.primary),
    accent: ensureWhiteTextContrast(theme.accent),
  };
}

export function buildPaletteFromPrimary(primary: string): {
  theme: ThemeDraft;
  secondaryColor: string;
} {
  const base = normalizeHexColor(primary, DEFAULT_THEME.primary);
  const { h, s } = hexToHsl(base);
  const background = hslToHex(h, 18, 97);

  return {
    theme: {
      primary: ensureWhiteTextContrast(base),
      accent: ensureWhiteTextContrast(hslToHex(h + 28, Math.max(55, s), 42)),
      background,
      surface: '#FFFFFF',
      text: readableTextOn(background),
      muted: hslToHex(h, 12, 42),
    },
    secondaryColor: hslToHex(h + 56, 65, 58),
  };
}

export function buildStorePayload(
  nextDraft: AppearanceDraft,
  previousDraft: AppearanceDraft,
): StoreAppearanceSettingsPayload {
  const payload: StoreAppearanceSettingsPayload = {};

  if (nextDraft.display_name !== previousDraft.display_name) {
    payload.display_name = nextDraft.display_name;
  }

  if (nextDraft.logo_url !== previousDraft.logo_url) {
    payload.logo_url = nextDraft.logo_url;
  }

  if (nextDraft.tagline !== previousDraft.tagline) {
    payload.tagline = nextDraft.tagline;
  }

  if (JSON.stringify(nextDraft.theme) !== JSON.stringify(previousDraft.theme)) {
    payload.theme = { ...nextDraft.theme };
  }

  return payload;
}

export function buildAppearancePayload(
  nextDraft: AppearanceDraft,
  previousDraft: AppearanceDraft,
): StorefrontAppearancePayload {
  const payload: StorefrontAppearancePayload = {};

  if (nextDraft.secondary_color !== previousDraft.secondary_color) payload.secondary_color = nextDraft.secondary_color;
  if (nextDraft.favicon_url !== previousDraft.favicon_url) payload.favicon_url = nextDraft.favicon_url;
  if (nextDraft.hero_enabled !== previousDraft.hero_enabled) payload.hero_enabled = nextDraft.hero_enabled;
  if (nextDraft.hero_image_desktop !== previousDraft.hero_image_desktop) payload.hero_image_desktop = nextDraft.hero_image_desktop;
  if (nextDraft.hero_image_mobile !== previousDraft.hero_image_mobile) payload.hero_image_mobile = nextDraft.hero_image_mobile;
  if (nextDraft.hero_alt_text !== previousDraft.hero_alt_text) payload.hero_alt_text = nextDraft.hero_alt_text;
  if (nextDraft.hero_title !== previousDraft.hero_title) payload.hero_title = nextDraft.hero_title;
  if (nextDraft.hero_subtitle !== previousDraft.hero_subtitle) payload.hero_subtitle = nextDraft.hero_subtitle;
  if (nextDraft.hero_cta_text !== previousDraft.hero_cta_text) payload.hero_cta_text = nextDraft.hero_cta_text;
  if (nextDraft.hero_destination_type !== previousDraft.hero_destination_type) payload.hero_destination_type = nextDraft.hero_destination_type;
  if (nextDraft.hero_destination_value !== previousDraft.hero_destination_value) payload.hero_destination_value = nextDraft.hero_destination_value;
  if (nextDraft.card_style !== previousDraft.card_style) payload.card_style = nextDraft.card_style;
  if (nextDraft.radius_style !== previousDraft.radius_style) payload.radius_style = nextDraft.radius_style;
  if (nextDraft.density !== previousDraft.density) payload.density = nextDraft.density;
  if (nextDraft.font_preset !== previousDraft.font_preset) payload.font_preset = nextDraft.font_preset;
  if (nextDraft.motion_enabled !== previousDraft.motion_enabled) payload.motion_enabled = nextDraft.motion_enabled;
  if (nextDraft.motion_intensity !== previousDraft.motion_intensity) {
    payload.motion_enabled = nextDraft.motion_enabled;
    payload.motion_intensity = nextDraft.motion_intensity;
  }
  if (nextDraft.decoration_enabled !== previousDraft.decoration_enabled) payload.decoration_enabled = nextDraft.decoration_enabled;
  if (nextDraft.decoration_style !== previousDraft.decoration_style) payload.decoration_style = nextDraft.decoration_style;

  return payload;
}
