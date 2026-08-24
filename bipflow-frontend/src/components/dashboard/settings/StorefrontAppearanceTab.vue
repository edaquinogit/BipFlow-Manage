<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue';
import { useCurrentStore } from '@/composables/useCurrentStore';
import { useStorefrontAppearance } from '@/composables/useStorefrontAppearance';
import { useToast } from '@/composables/useToast';
import { categoryService } from '@/services/category.service';
import { Logger } from '@/services/logger';
import productService from '@/services/product.service';
import { storeService } from '@/services/store.service';
import { storefrontAppearanceService } from '@/services/storefront-appearance.service';
import type { Category } from '@/schemas/category.schema';
import type { Product as AdminProduct } from '@/schemas/product.schema';
import { buildErrorContext, type ApplicationError } from '@/types/errors';
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
  StorefrontBanner,
  StorefrontBannerPayload,
  StorefrontBannerStatus,
  StorefrontDestinationType,
  StoreTheme,
} from '@/types/store';
import {
  STOREFRONT_MEDIA_RULES,
  validateStorefrontMediaFile,
} from '@/utils/storefrontMedia';
import { STOREFRONT_PALETTE_PRESETS } from '@/utils/storefrontPalettePresets';

type AppearanceSection = 'identidade' | 'banner' | 'promocoes' | 'estilo' | 'preview';
type ThemeColorKey = keyof StoreTheme;
type ThemeDraft = Record<ThemeColorKey, string>;

interface AppearanceDraft {
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

interface BannerEditor {
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

const SECTIONS: { value: AppearanceSection; label: string }[] = [
  { value: 'identidade', label: 'Identidade' },
  { value: 'banner', label: 'Banner principal' },
  { value: 'promocoes', label: 'Promocoes' },
  { value: 'estilo', label: 'Estilo' },
  { value: 'preview', label: 'Preview' },
];

const DESTINATION_OPTIONS: { value: StorefrontDestinationType; label: string }[] = [
  { value: 'none', label: 'Nao fazer nada' },
  { value: 'products', label: 'Abrir vitrine' },
  { value: 'category', label: 'Abrir categoria' },
  { value: 'product', label: 'Abrir produto' },
  { value: 'external_url', label: 'Abrir link externo' },
];

const THEME_COLOR_FIELDS: { key: ThemeColorKey; label: string }[] = [
  { key: 'primary', label: 'Principal' },
  { key: 'accent', label: 'Destaque' },
  { key: 'background', label: 'Fundo' },
  { key: 'surface', label: 'Superficie' },
  { key: 'text', label: 'Texto' },
  { key: 'muted', label: 'Texto auxiliar' },
];

const FONT_PRESET_OPTIONS: { value: FontPreset; label: string }[] = [
  { value: 'modern', label: 'Moderna' },
  { value: 'editorial', label: 'Editorial' },
  { value: 'classic', label: 'Classica' },
];

const DEFAULT_THEME: ThemeDraft = {
  primary: '#05050A',
  accent: '#D81B60',
  background: '#FAFAFA',
  surface: '#FFFFFF',
  text: '#05050A',
  muted: '#6B7280',
};

const SECONDARY_COLOR_FALLBACK = '#D81B60';
const LOGO_MEDIA_RULES = STOREFRONT_MEDIA_RULES.logo;
const FAVICON_MEDIA_RULES = STOREFRONT_MEDIA_RULES.favicon;
const BANNER_MEDIA_RULES = STOREFRONT_MEDIA_RULES.banner;
const PROMOTION_MEDIA_RULES = STOREFRONT_MEDIA_RULES.promotion;

const { selectedStore, storefrontPath, fetchCurrentStore } = useCurrentStore();
const storeSlug = computed(() => selectedStore.value?.slug);
const { appearance, isLoading, loadError, save } = useStorefrontAppearance(storeSlug);
const toast = useToast();

const activeSection = ref<AppearanceSection>('identidade');
const isStorefrontLinkReady = computed(() => Boolean(selectedStore.value?.slug));
const categories = ref<Category[]>([]);
const products = ref<AdminProduct[]>([]);
const isOptionsLoading = ref(false);
const isBannersLoading = ref(false);
const bannerEditors = ref<BannerEditor[]>([]);
const isReorderingBanners = ref(false);
const nextDraftBannerId = ref(-1);

const logoInput = ref<HTMLInputElement | null>(null);
const faviconInput = ref<HTMLInputElement | null>(null);
const heroBannerInput = ref<HTMLInputElement | null>(null);
const pendingLogoFile = ref<File | null>(null);
const pendingFaviconFile = ref<File | null>(null);
const pendingHeroBannerFile = ref<File | null>(null);
const pendingLogoPreviewUrl = ref<string | null>(null);
const pendingFaviconPreviewUrl = ref<string | null>(null);
const pendingHeroBannerPreviewUrl = ref<string | null>(null);
const logoError = ref<string | null>(null);
const faviconError = ref<string | null>(null);
const heroBannerError = ref<string | null>(null);
const saveError = ref<string | null>(null);
const isSaving = ref(false);

function buildThemeDraft(theme: StoreTheme | null | undefined): ThemeDraft {
  return {
    primary: theme?.primary || DEFAULT_THEME.primary,
    accent: theme?.accent || DEFAULT_THEME.accent,
    background: theme?.background || DEFAULT_THEME.background,
    surface: theme?.surface || DEFAULT_THEME.surface,
    text: theme?.text || DEFAULT_THEME.text,
    muted: theme?.muted || DEFAULT_THEME.muted,
  };
}

function inferHeroDestinationType(appearanceValue: StorefrontAppearance | null): StorefrontDestinationType {
  if (appearanceValue?.hero_destination_type && appearanceValue.hero_destination_type !== 'none') {
    return appearanceValue.hero_destination_type;
  }

  return appearanceValue?.hero_cta_url ? 'external_url' : 'none';
}

function buildDraft(
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

function cloneDraft(draftValue: AppearanceDraft): AppearanceDraft {
  return {
    ...draftValue,
    theme: { ...draftValue.theme },
  };
}

function areDraftsEqual(left: AppearanceDraft, right: AppearanceDraft): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

const draft = ref<AppearanceDraft>(buildDraft(selectedStore.value, appearance.value));
const savedDraft = ref<AppearanceDraft>(buildDraft(selectedStore.value, appearance.value));
const logoPreviewUrl = computed(() => pendingLogoPreviewUrl.value || draft.value.logo_url);
const faviconPreviewUrl = computed(() => pendingFaviconPreviewUrl.value || draft.value.favicon_url);
const heroPreviewImageUrl = computed(() => pendingHeroBannerPreviewUrl.value || draft.value.hero_image_desktop);
const hasAppearanceChanges = computed(() => (
  Boolean(pendingLogoFile.value || pendingFaviconFile.value || pendingHeroBannerFile.value)
  || !areDraftsEqual(draft.value, savedDraft.value)
));
const previewStoreName = computed(() => (
  draft.value.display_name.trim() || selectedStore.value?.name || 'Loja Principal'
));
const heroPreviewUrl = computed(() => buildDestinationUrl(
  draft.value.hero_destination_type,
  draft.value.hero_destination_value,
));

const previewStyle = computed(() => ({
  '--preview-primary': draft.value.theme.primary,
  '--preview-accent': draft.value.theme.accent,
  '--preview-secondary': draft.value.secondary_color,
  '--preview-background': draft.value.theme.background,
  '--preview-surface': draft.value.theme.surface,
  '--preview-text': draft.value.theme.text,
  '--preview-muted': draft.value.theme.muted,
  '--preview-radius': draft.value.radius_style === 'minimal'
    ? '0.35rem'
    : draft.value.radius_style === 'soft'
      ? '1rem'
      : '0.65rem',
  '--preview-font-body': draft.value.font_preset === 'classic'
    ? 'Georgia, "Times New Roman", serif'
    : 'var(--font-sans)',
  '--preview-font-heading': draft.value.font_preset === 'editorial'
    ? 'var(--font-display)'
    : draft.value.font_preset === 'classic'
      ? 'Georgia, "Times New Roman", serif'
      : 'var(--font-sans)',
  fontFamily: 'var(--preview-font-body)',
}));

const visiblePreviewBanners = computed(() => (
  bannerEditors.value
    .filter((banner) => banner.is_active && (banner.pendingPreviewUrl || banner.image_url))
    .slice(0, 3)
));

watch([selectedStore, appearance], ([store, appearanceValue]) => {
  clearPendingAppearanceFiles();
  const nextDraft = buildDraft(store, appearanceValue);
  draft.value = nextDraft;
  savedDraft.value = cloneDraft(nextDraft);
});

watch(storeSlug, () => {
  void loadBanners();
});

onMounted(() => {
  void loadDestinationOptions();
  void loadBanners();
});

onBeforeUnmount(() => {
  clearPendingAppearanceFiles();
  clearBannerPreviewUrls();
});

function clearObjectUrl(target: Ref<string | null>): void {
  if (target.value) {
    URL.revokeObjectURL(target.value);
    target.value = null;
  }
}

function clearPendingAppearanceFiles(): void {
  clearObjectUrl(pendingLogoPreviewUrl);
  clearObjectUrl(pendingFaviconPreviewUrl);
  clearObjectUrl(pendingHeroBannerPreviewUrl);
  pendingLogoFile.value = null;
  pendingFaviconFile.value = null;
  pendingHeroBannerFile.value = null;
  logoError.value = null;
  faviconError.value = null;
  heroBannerError.value = null;

  if (logoInput.value) logoInput.value.value = '';
  if (faviconInput.value) faviconInput.value.value = '';
  if (heroBannerInput.value) heroBannerInput.value.value = '';
}

function clearBannerPreviewUrls(): void {
  for (const editor of bannerEditors.value) {
    if (editor.pendingPreviewUrl) {
      URL.revokeObjectURL(editor.pendingPreviewUrl);
      editor.pendingPreviewUrl = null;
    }
  }
}

function openLogoPicker(): void {
  logoInput.value?.click();
}

function openFaviconPicker(): void {
  faviconInput.value?.click();
}

function openHeroBannerPicker(): void {
  heroBannerInput.value?.click();
}

function applyPendingFile(
  event: Event,
  kind: 'logo' | 'favicon' | 'banner',
): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  if (!file) return;

  const validationError = validateStorefrontMediaFile(kind, file);
  if (validationError) {
    if (kind === 'logo') logoError.value = validationError;
    if (kind === 'favicon') faviconError.value = validationError;
    if (kind === 'banner') heroBannerError.value = validationError;
    input.value = '';
    return;
  }

  if (kind === 'logo') {
    clearObjectUrl(pendingLogoPreviewUrl);
    pendingLogoFile.value = file;
    pendingLogoPreviewUrl.value = URL.createObjectURL(file);
    logoError.value = null;
  }

  if (kind === 'favicon') {
    clearObjectUrl(pendingFaviconPreviewUrl);
    pendingFaviconFile.value = file;
    pendingFaviconPreviewUrl.value = URL.createObjectURL(file);
    faviconError.value = null;
  }

  if (kind === 'banner') {
    clearObjectUrl(pendingHeroBannerPreviewUrl);
    pendingHeroBannerFile.value = file;
    pendingHeroBannerPreviewUrl.value = URL.createObjectURL(file);
    draft.value.hero_enabled = true;
    heroBannerError.value = null;
  }
}

function removeLogo(): void {
  clearObjectUrl(pendingLogoPreviewUrl);
  pendingLogoFile.value = null;
  draft.value.logo_url = '';
  if (logoInput.value) logoInput.value.value = '';
}

function removeFavicon(): void {
  clearObjectUrl(pendingFaviconPreviewUrl);
  pendingFaviconFile.value = null;
  draft.value.favicon_url = '';
  if (faviconInput.value) faviconInput.value.value = '';
}

function removeHeroBanner(): void {
  clearObjectUrl(pendingHeroBannerPreviewUrl);
  pendingHeroBannerFile.value = null;
  draft.value.hero_image_desktop = '';
  draft.value.hero_image_mobile = '';
  draft.value.hero_enabled = false;
  if (heroBannerInput.value) heroBannerInput.value.value = '';
}

function normalizeDestinationValue(
  type: StorefrontDestinationType,
  value: string,
): string {
  if (type === 'none' || type === 'products') {
    return '';
  }
  return String(value || '').trim();
}

function handleHeroDestinationTypeChange(): void {
  draft.value.hero_destination_value = normalizeDestinationValue(
    draft.value.hero_destination_type,
    draft.value.hero_destination_value,
  );
}

function buildDestinationUrl(
  type: StorefrontDestinationType,
  value: string,
): string {
  const slug = selectedStore.value?.slug || 'default';
  const normalizedValue = String(value || '').trim();

  if (type === 'products') {
    return `/l/${slug}/produtos`;
  }

  if (type === 'category' && normalizedValue) {
    return `/l/${slug}/produtos?category=${normalizedValue}`;
  }

  if (type === 'product' && normalizedValue) {
    const product = products.value.find((item) => String(item.id) === normalizedValue);
    const productSlug = typeof product?.slug === 'string' ? product.slug : '';
    const publicCode = typeof product?.public_code === 'string' ? product.public_code : '';
    if (productSlug) return `/l/${slug}/produtos/${productSlug}`;
    if (publicCode) return `/l/${slug}/p/${publicCode}`;
  }

  if (type === 'external_url') {
    return normalizedValue;
  }

  return '';
}

function buildStorePayload(
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

function buildAppearancePayload(
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

function applyPalettePreset(presetId: string): void {
  const preset = STOREFRONT_PALETTE_PRESETS.find((item) => item.id === presetId);
  if (!preset) return;

  draft.value.theme = { ...preset.theme };
  draft.value.secondary_color = preset.secondaryColor;
}

function sourceFailureMessage(source: 'identity' | 'banner' | 'layout' | 'all'): string {
  if (source === 'identity') return 'Nao foi possivel salvar a identidade e as cores.';
  if (source === 'banner') return 'Nao foi possivel salvar o banner.';
  if (source === 'layout') return 'Nao foi possivel salvar o estilo.';
  return 'Nao foi possivel salvar a aparencia da vitrine.';
}

async function handleSaveAppearance(source: 'identity' | 'banner' | 'layout' | 'all'): Promise<void> {
  const store = selectedStore.value;
  if (!store || isSaving.value || !hasAppearanceChanges.value) {
    return;
  }

  isSaving.value = true;
  saveError.value = null;

  try {
    const draftToPersist = cloneDraft(draft.value);

    if (pendingLogoFile.value) {
      const uploadedLogo = await storefrontAppearanceService.uploadMedia('logo', pendingLogoFile.value);
      draftToPersist.logo_url = uploadedLogo.url;
    }

    if (pendingFaviconFile.value) {
      const uploadedFavicon = await storefrontAppearanceService.uploadMedia('favicon', pendingFaviconFile.value);
      draftToPersist.favicon_url = uploadedFavicon.url;
    }

    if (pendingHeroBannerFile.value) {
      const uploadedBanner = await storefrontAppearanceService.uploadMedia('banner', pendingHeroBannerFile.value);
      draftToPersist.hero_enabled = true;
      draftToPersist.hero_image_desktop = uploadedBanner.url;
    }

    draftToPersist.hero_destination_value = normalizeDestinationValue(
      draftToPersist.hero_destination_type,
      draftToPersist.hero_destination_value,
    );

    const storePayload = buildStorePayload(draftToPersist, savedDraft.value);
    const appearancePayload = buildAppearancePayload(draftToPersist, savedDraft.value);
    const shouldUpdateStore = Object.keys(storePayload).length > 0;
    const shouldUpdateAppearance = Object.keys(appearancePayload).length > 0;

    let updatedStore: Store | null = null;
    let updatedAppearance: StorefrontAppearance | null = null;

    if (shouldUpdateStore) {
      updatedStore = await storeService.updateCurrentAppearance(storePayload);
    }

    if (shouldUpdateAppearance) {
      updatedAppearance = await save(appearancePayload);
    }

    if (shouldUpdateStore) {
      await fetchCurrentStore(true);
    }

    const nextDraft = buildDraft(
      updatedStore ?? selectedStore.value ?? store,
      updatedAppearance ?? appearance.value,
    );
    draft.value = nextDraft;
    savedDraft.value = cloneDraft(nextDraft);
    clearPendingAppearanceFiles();
    toast.success('Aparencia da vitrine atualizada com sucesso.');
  } catch (error: unknown) {
    const message = sourceFailureMessage(source);
    Logger.error('Storefront appearance editor save failed', buildErrorContext(error as ApplicationError, {
      source,
      slug: store.slug,
    }));
    saveError.value = `${message} Tente novamente.`;
    toast.error(message);
  } finally {
    isSaving.value = false;
  }
}

function discardAppearanceChanges(): void {
  clearPendingAppearanceFiles();
  draft.value = cloneDraft(savedDraft.value);
  saveError.value = null;
}

async function loadDestinationOptions(): Promise<void> {
  isOptionsLoading.value = true;
  try {
    const [loadedCategories, loadedProducts] = await Promise.all([
      categoryService.getAll(),
      productService.getAll(),
    ]);
    categories.value = loadedCategories;
    products.value = loadedProducts;
  } catch (error: unknown) {
    Logger.warn('Failed to load storefront destination options', buildErrorContext(error as ApplicationError, {}));
    categories.value = [];
    products.value = [];
  } finally {
    isOptionsLoading.value = false;
  }
}

function toDateTimeLocal(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

function fromDateTimeLocal(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function buildBannerEditor(banner: StorefrontBanner): BannerEditor {
  return {
    clientId: String(banner.id),
    id: banner.id,
    image_url: banner.image_url,
    alt_text: banner.alt_text,
    title: banner.title,
    subtitle: banner.subtitle,
    cta_text: banner.cta_text,
    destination_type: banner.destination_type,
    destination_value: banner.destination_value,
    position: banner.position,
    is_active: banner.is_active,
    status: banner.status,
    starts_at: toDateTimeLocal(banner.starts_at),
    ends_at: toDateTimeLocal(banner.ends_at),
    pendingFile: null,
    pendingPreviewUrl: null,
    fileError: null,
    saveError: null,
    isSaving: false,
    isDeleting: false,
  };
}

function createDraftBannerEditor(): BannerEditor {
  const clientId = `draft-${Math.abs(nextDraftBannerId.value)}`;
  nextDraftBannerId.value -= 1;
  return {
    clientId,
    id: null,
    image_url: '',
    alt_text: '',
    title: '',
    subtitle: '',
    cta_text: '',
    destination_type: 'none',
    destination_value: '',
    position: bannerEditors.value.length,
    is_active: true,
    status: 'draft',
    starts_at: '',
    ends_at: '',
    pendingFile: null,
    pendingPreviewUrl: null,
    fileError: null,
    saveError: null,
    isSaving: false,
    isDeleting: false,
  };
}

async function loadBanners(): Promise<void> {
  if (!storeSlug.value) {
    clearBannerPreviewUrls();
    bannerEditors.value = [];
    return;
  }

  isBannersLoading.value = true;
  try {
    const loadedBanners = await storefrontAppearanceService.listBanners();
    clearBannerPreviewUrls();
    bannerEditors.value = loadedBanners.map(buildBannerEditor);
  } catch (error: unknown) {
    Logger.error('Storefront banners load failed', buildErrorContext(error as ApplicationError, {
      slug: storeSlug.value,
    }));
    bannerEditors.value = [];
  } finally {
    isBannersLoading.value = false;
  }
}

function addPromotionBanner(): void {
  activeSection.value = 'promocoes';
  bannerEditors.value = [...bannerEditors.value, createDraftBannerEditor()];
}

function openPromotionImagePicker(editor: BannerEditor): void {
  const input = document.querySelector<HTMLInputElement>(
    `[data-promotion-file-input="${editor.clientId}"]`,
  );
  input?.click();
}

function handlePromotionFileChange(editor: BannerEditor, event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  if (!file) return;

  const validationError = validateStorefrontMediaFile('promotion', file);
  if (validationError) {
    editor.fileError = validationError;
    input.value = '';
    return;
  }

  if (editor.pendingPreviewUrl) {
    URL.revokeObjectURL(editor.pendingPreviewUrl);
  }
  editor.pendingFile = file;
  editor.pendingPreviewUrl = URL.createObjectURL(file);
  editor.fileError = null;
}

function removePromotionImage(editor: BannerEditor): void {
  if (editor.pendingPreviewUrl) {
    URL.revokeObjectURL(editor.pendingPreviewUrl);
  }
  editor.pendingPreviewUrl = null;
  editor.pendingFile = null;
  editor.image_url = '';
}

function handlePromotionDestinationTypeChange(editor: BannerEditor): void {
  editor.destination_value = normalizeDestinationValue(
    editor.destination_type,
    editor.destination_value,
  );
}

function buildPromotionPayload(editor: BannerEditor, imageUrl: string): StorefrontBannerPayload {
  return {
    image_url: imageUrl,
    alt_text: editor.alt_text,
    title: editor.title,
    subtitle: editor.subtitle,
    cta_text: editor.cta_text,
    destination_type: editor.destination_type,
    destination_value: normalizeDestinationValue(
      editor.destination_type,
      editor.destination_value,
    ),
    position: editor.position,
    is_active: editor.is_active,
    starts_at: fromDateTimeLocal(editor.starts_at),
    ends_at: fromDateTimeLocal(editor.ends_at),
  };
}

async function savePromotionBanner(editor: BannerEditor): Promise<void> {
  if (editor.isSaving) return;

  editor.isSaving = true;
  editor.saveError = null;

  try {
    let imageUrl = editor.image_url;
    if (editor.pendingFile) {
      const uploadedPromotion = await storefrontAppearanceService.uploadMedia('promotion', editor.pendingFile);
      imageUrl = uploadedPromotion.url;
    }

    if (!imageUrl) {
      editor.saveError = 'Selecione uma imagem para o banner promocional.';
      return;
    }

    const payload = buildPromotionPayload(editor, imageUrl);
    if (editor.id) {
      await storefrontAppearanceService.updateBanner(editor.id, payload);
    } else {
      await storefrontAppearanceService.createBanner(payload);
    }

    toast.success('Banner promocional salvo com sucesso.');
    await loadBanners();
  } catch (error: unknown) {
    Logger.error('Storefront promotion banner save failed', buildErrorContext(error as ApplicationError, {
      id: editor.id,
      slug: storeSlug.value,
    }));
    editor.saveError = 'Nao foi possivel salvar este banner. Tente novamente.';
    toast.error('Nao foi possivel salvar o banner promocional.');
  } finally {
    editor.isSaving = false;
  }
}

async function deletePromotionBanner(editor: BannerEditor): Promise<void> {
  if (!editor.id) {
    if (editor.pendingPreviewUrl) URL.revokeObjectURL(editor.pendingPreviewUrl);
    bannerEditors.value = bannerEditors.value.filter((item) => item.clientId !== editor.clientId);
    return;
  }

  editor.isDeleting = true;
  try {
    await storefrontAppearanceService.deleteBanner(editor.id);
    toast.success('Banner promocional removido.');
    await loadBanners();
  } catch (error: unknown) {
    Logger.error('Storefront promotion banner delete failed', buildErrorContext(error as ApplicationError, {
      id: editor.id,
      slug: storeSlug.value,
    }));
    editor.saveError = 'Nao foi possivel remover este banner.';
    toast.error('Nao foi possivel remover o banner promocional.');
  } finally {
    editor.isDeleting = false;
  }
}

async function movePromotionBanner(index: number, direction: -1 | 1): Promise<void> {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= bannerEditors.value.length || isReorderingBanners.value) {
    return;
  }

  const current = [...bannerEditors.value];
  const source = current[index];
  const target = current[targetIndex];
  if (!source?.id || !target?.id) {
    return;
  }

  current[index] = target;
  current[targetIndex] = source;
  isReorderingBanners.value = true;

  try {
    const ids = current.filter((editor) => editor.id).map((editor) => editor.id as number);
    const updatedBanners = await storefrontAppearanceService.reorderBanners(ids);
    clearBannerPreviewUrls();
    bannerEditors.value = updatedBanners.map(buildBannerEditor);
  } catch (error: unknown) {
    Logger.error('Storefront promotion banner reorder failed', buildErrorContext(error as ApplicationError, {
      slug: storeSlug.value,
    }));
    toast.error('Nao foi possivel ordenar os banners promocionais.');
  } finally {
    isReorderingBanners.value = false;
  }
}

function statusLabel(statusValue: StorefrontBannerStatus | 'draft'): string {
  if (statusValue === 'active') return 'Ativo';
  if (statusValue === 'scheduled') return 'Agendado';
  if (statusValue === 'expired') return 'Expirado';
  if (statusValue === 'inactive') return 'Inativo';
  return 'Novo';
}
</script>

<template>
  <section>
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p class="max-w-xl text-xs leading-5 text-bip-muted">
        Personalize a aparencia da vitrine com upload, preview ao vivo, banners promocionais e destinos seguros.
      </p>

      <a
        data-cy="open-current-storefront-link"
        :href="isStorefrontLinkReady ? storefrontPath : undefined"
        target="_blank"
        rel="noopener"
        :aria-disabled="!isStorefrontLinkReady"
        :tabindex="isStorefrontLinkReady ? 0 : -1"
        class="inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-[#D1D5DB] bg-white px-4 text-[10px] font-black uppercase tracking-widest text-[#05050A] transition hover:border-[#D81B60] hover:text-[#D81B60] aria-disabled:cursor-not-allowed aria-disabled:bg-zinc-100 aria-disabled:text-bip-muted"
      >
        Abrir vitrine
      </a>
    </div>

    <nav role="tablist" aria-label="Secoes de aparencia" class="mt-5 inline-flex flex-wrap items-center gap-1 rounded-full border border-[#E5E7EB] bg-zinc-100 p-1">
      <button
        v-for="section in SECTIONS"
        :key="section.value"
        type="button"
        :data-cy="`storefront-appearance-section-${section.value}`"
        role="tab"
        :aria-selected="activeSection === section.value"
        class="rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-widest transition-all duration-300"
        :class="activeSection === section.value ? 'bg-[#D81B60] text-white shadow-lg shadow-[#D81B60]/30' : 'text-bip-muted hover:text-[#05050A]'"
        @click="activeSection = section.value"
      >
        {{ section.label }}
      </button>
    </nav>

    <p v-if="loadError" data-cy="storefront-appearance-load-error" class="mt-4 text-xs font-semibold text-[#D81B60]">{{ loadError }}</p>
    <p v-else-if="isLoading" data-cy="storefront-appearance-loading" class="mt-4 text-xs text-bip-muted">Carregando aparencia da vitrine...</p>

    <div v-else class="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
      <div class="min-w-0 space-y-5">
        <section v-show="activeSection === 'identidade'" data-cy="storefront-identity-colors-section" class="space-y-5">
          <div class="rounded-lg border border-[#E5E7EB] bg-white p-4">
            <h3 class="text-[10px] font-black uppercase tracking-widest text-bip-muted">Identidade da loja</h3>

            <div class="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <span class="mb-2 block text-[9px] font-black uppercase tracking-widest text-bip-muted">Logo da loja</span>
                <div class="flex gap-3">
                  <div class="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#E5E7EB] bg-zinc-50">
                    <img v-if="logoPreviewUrl" data-cy="storefront-logo-preview" :src="logoPreviewUrl" alt="Preview do logo" class="h-full w-full object-contain" />
                    <span v-else class="text-[10px] font-black uppercase tracking-widest text-bip-muted">Logo</span>
                  </div>

                  <div class="min-w-0 flex-1 space-y-2">
                    <input ref="logoInput" data-cy="storefront-logo-file" type="file" accept="image/png,image/jpeg,image/jpg,image/webp" class="sr-only" @change="applyPendingFile($event, 'logo')" />
                    <div class="flex flex-wrap gap-2">
                      <button type="button" data-cy="btn-select-storefront-logo" class="h-10 rounded-lg border border-[#D1D5DB] bg-white px-4 text-[10px] font-black uppercase tracking-widest text-[#05050A] hover:border-[#D81B60] hover:text-[#D81B60]" @click="openLogoPicker">
                        Alterar logo
                      </button>
                      <button type="button" data-cy="btn-remove-storefront-logo" :disabled="!logoPreviewUrl" class="h-10 rounded-lg border border-[#D1D5DB] bg-white px-4 text-[10px] font-black uppercase tracking-widest text-[#4B5563] disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-bip-muted" @click="removeLogo">
                        Remover
                      </button>
                    </div>
                    <p class="text-[11px] leading-5 text-bip-muted">PNG, JPG, JPEG ou WEBP ate 2 MB. Recomendado: {{ LOGO_MEDIA_RULES.recommendedSize }}.</p>
                    <p v-if="logoError" data-cy="storefront-logo-error" class="text-xs font-semibold text-[#D81B60]">{{ logoError }}</p>
                  </div>
                </div>
              </div>

              <div>
                <span class="mb-2 block text-[9px] font-black uppercase tracking-widest text-bip-muted">Favicon da loja</span>
                <div class="flex gap-3">
                  <div class="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#E5E7EB] bg-zinc-50">
                    <img v-if="faviconPreviewUrl" data-cy="storefront-favicon-preview" :src="faviconPreviewUrl" alt="Preview do favicon" class="h-full w-full object-contain" />
                    <span v-else class="text-[9px] font-black uppercase tracking-widest text-bip-muted">Icone</span>
                  </div>

                  <div class="min-w-0 flex-1 space-y-2">
                    <input ref="faviconInput" data-cy="storefront-favicon-file" type="file" accept="image/png,image/jpeg,image/jpg,image/webp" class="sr-only" @change="applyPendingFile($event, 'favicon')" />
                    <div class="flex flex-wrap gap-2">
                      <button type="button" data-cy="btn-select-storefront-favicon" class="h-10 rounded-lg border border-[#D1D5DB] bg-white px-4 text-[10px] font-black uppercase tracking-widest text-[#05050A] hover:border-[#D81B60] hover:text-[#D81B60]" @click="openFaviconPicker">
                        Alterar favicon
                      </button>
                      <button type="button" :disabled="!faviconPreviewUrl" class="h-10 rounded-lg border border-[#D1D5DB] bg-white px-4 text-[10px] font-black uppercase tracking-widest text-[#4B5563] disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-bip-muted" @click="removeFavicon">
                        Remover
                      </button>
                    </div>
                    <p class="text-[11px] leading-5 text-bip-muted">PNG, JPG, JPEG ou WEBP ate 1 MB. Recomendado: {{ FAVICON_MEDIA_RULES.recommendedSize }}.</p>
                    <p v-if="faviconError" data-cy="storefront-favicon-error" class="text-xs font-semibold text-[#D81B60]">{{ faviconError }}</p>
                  </div>
                </div>
              </div>

              <label class="block md:col-span-2">
                <span class="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-bip-muted">Nome exibido na vitrine</span>
                <input v-model="draft.display_name" data-cy="storefront-display-name" type="text" maxlength="120" class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]" :placeholder="selectedStore?.name || 'Nome da loja'" />
              </label>

              <label class="block md:col-span-2">
                <span class="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-bip-muted">Slogan</span>
                <input v-model="draft.tagline" data-cy="storefront-tagline" type="text" maxlength="160" class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]" placeholder="Ex.: Catalogo online" />
              </label>
            </div>
          </div>

          <div class="rounded-lg border border-[#E5E7EB] bg-white p-4">
            <h3 class="text-[10px] font-black uppercase tracking-widest text-bip-muted">Cores</h3>
            <div class="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <button
                v-for="preset in STOREFRONT_PALETTE_PRESETS"
                :key="preset.id"
                type="button"
                data-cy="storefront-palette-preset"
                :data-palette-id="preset.id"
                class="rounded-lg border border-[#E5E7EB] bg-white p-3 text-left transition hover:border-[#D81B60]/50 hover:bg-[#FDF2F8]"
                @click="applyPalettePreset(preset.id)"
              >
                <span class="block text-[10px] font-black uppercase tracking-widest text-[#05050A]">{{ preset.label }}</span>
                <span class="mt-2 flex gap-1.5" aria-hidden="true">
                  <span
                    v-for="color in [preset.theme.primary, preset.theme.accent, preset.secondaryColor, preset.theme.background]"
                    :key="`${preset.id}-${color}`"
                    class="h-5 w-5 rounded-full border border-black/10"
                    :style="{ backgroundColor: color }"
                  />
                </span>
              </button>
            </div>
            <div class="mt-4 grid gap-4 sm:grid-cols-2">
              <label v-for="field in THEME_COLOR_FIELDS" :key="field.key" class="block">
                <span class="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-bip-muted">{{ field.label }}</span>
                <span class="flex gap-2">
                  <input v-model="draft.theme[field.key]" type="color" class="h-11 w-14 shrink-0 cursor-pointer rounded-lg border border-[#D1D5DB] bg-white p-1" :aria-label="`${field.label} visual`" />
                  <input v-model="draft.theme[field.key]" :data-cy="`storefront-theme-${field.key}`" type="text" maxlength="9" class="h-11 min-w-0 flex-1 rounded-lg border border-[#D1D5DB] bg-white px-3 font-mono text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]" :aria-label="`${field.label} em HEX`" />
                </span>
              </label>

              <label class="block">
                <span class="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-bip-muted">Secundaria</span>
                <span class="flex gap-2">
                  <input v-model="draft.secondary_color" type="color" class="h-11 w-14 shrink-0 cursor-pointer rounded-lg border border-[#D1D5DB] bg-white p-1" aria-label="Secundaria visual" />
                  <input v-model="draft.secondary_color" data-cy="storefront-secondary-color" type="text" maxlength="9" class="h-11 min-w-0 flex-1 rounded-lg border border-[#D1D5DB] bg-white px-3 font-mono text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]" aria-label="Secundaria em HEX" />
                </span>
              </label>
            </div>
          </div>

          <button type="button" data-cy="btn-save-storefront-identity" :disabled="isSaving || !selectedStore || !hasAppearanceChanges" class="w-full rounded-lg bg-[#D81B60] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-[#D81B60]/90 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-bip-muted sm:w-auto" @click="handleSaveAppearance('identity')">
            {{ isSaving ? 'Salvando...' : 'Salvar alteracoes' }}
          </button>
        </section>

        <section v-show="activeSection === 'banner'" data-cy="storefront-banner-section" class="rounded-lg border border-[#E5E7EB] bg-white p-4">
          <label class="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#4B5563]">
            <input v-model="draft.hero_enabled" data-cy="storefront-banner-enabled" type="checkbox" class="h-4 w-4 rounded border-[#D1D5DB] text-[#D81B60] focus:ring-[#FCE7F3]" />
            Ativar banner principal
          </label>

          <div v-if="draft.hero_enabled" class="mt-4 grid gap-4 sm:grid-cols-2">
            <div class="sm:col-span-2">
              <span class="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-bip-muted">Imagem do banner</span>
              <input ref="heroBannerInput" data-cy="storefront-banner-file" type="file" accept="image/png,image/jpeg,image/jpg,image/webp" class="sr-only" @change="applyPendingFile($event, 'banner')" />
              <div class="flex flex-wrap gap-2">
                <button type="button" data-cy="btn-select-storefront-banner" class="h-10 rounded-lg border border-[#D1D5DB] bg-white px-4 text-[10px] font-black uppercase tracking-widest text-[#05050A] hover:border-[#D81B60] hover:text-[#D81B60]" @click="openHeroBannerPicker">
                  Alterar imagem
                </button>
                <button type="button" data-cy="btn-remove-storefront-banner" :disabled="!heroPreviewImageUrl" class="h-10 rounded-lg border border-[#D1D5DB] bg-white px-4 text-[10px] font-black uppercase tracking-widest text-[#4B5563] disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-bip-muted" @click="removeHeroBanner">
                  Remover
                </button>
              </div>
              <p class="mt-2 text-[11px] leading-5 text-bip-muted">PNG, JPG, JPEG ou WEBP ate 5 MB. Recomendado: {{ BANNER_MEDIA_RULES.recommendedSize }}.</p>
              <p v-if="heroBannerError" data-cy="storefront-banner-file-error" class="mt-1 text-xs font-semibold text-[#D81B60]">{{ heroBannerError }}</p>
            </div>

            <label class="block sm:col-span-2">
              <span class="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-bip-muted">Texto alternativo</span>
              <input v-model="draft.hero_alt_text" data-cy="storefront-banner-alt" type="text" maxlength="160" class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]" />
            </label>

            <label class="block">
              <span class="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-bip-muted">Titulo</span>
              <input v-model="draft.hero_title" data-cy="storefront-banner-title" type="text" maxlength="120" class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]" />
            </label>

            <label class="block">
              <span class="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-bip-muted">Subtitulo</span>
              <input v-model="draft.hero_subtitle" data-cy="storefront-banner-subtitle" type="text" maxlength="200" class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]" />
            </label>

            <label class="block">
              <span class="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-bip-muted">Texto do botao</span>
              <input v-model="draft.hero_cta_text" data-cy="storefront-banner-cta-text" type="text" maxlength="40" class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]" placeholder="Ex.: Ver produtos" />
            </label>

            <label class="block">
              <span class="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-bip-muted">Ao clicar no banner</span>
              <select v-model="draft.hero_destination_type" data-cy="storefront-banner-destination-type" class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]" @change="handleHeroDestinationTypeChange">
                <option v-for="option in DESTINATION_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</option>
              </select>
            </label>

            <label v-if="draft.hero_destination_type === 'category'" class="block">
              <span class="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-bip-muted">Categoria</span>
              <select v-model="draft.hero_destination_value" data-cy="storefront-banner-destination-category" class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]">
                <option value="">Selecione</option>
                <option v-for="category in categories" :key="category.id" :value="String(category.id)">{{ category.name }}</option>
              </select>
            </label>

            <label v-else-if="draft.hero_destination_type === 'product'" class="block">
              <span class="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-bip-muted">Produto</span>
              <select v-model="draft.hero_destination_value" data-cy="storefront-banner-destination-product" class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]">
                <option value="">Selecione</option>
                <option v-for="product in products" :key="product.id" :value="String(product.id)">{{ product.name }}</option>
              </select>
            </label>

            <label v-else-if="draft.hero_destination_type === 'external_url'" class="block">
              <span class="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-bip-muted">Link externo</span>
              <input v-model="draft.hero_destination_value" data-cy="storefront-banner-destination-link" type="url" class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]" placeholder="https://..." />
            </label>

            <div v-if="heroPreviewImageUrl" class="overflow-hidden rounded-lg border border-[#E5E7EB] bg-zinc-50 sm:col-span-2">
              <img data-cy="storefront-banner-preview" :src="heroPreviewImageUrl" :alt="draft.hero_alt_text || 'Preview do banner desktop'" class="aspect-[16/7] w-full object-cover" />
            </div>
          </div>

          <button type="button" data-cy="btn-save-storefront-banner" :disabled="isSaving || !hasAppearanceChanges" class="mt-4 w-full rounded-lg bg-[#D81B60] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-[#D81B60]/90 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-bip-muted sm:w-auto" @click="handleSaveAppearance('banner')">
            {{ isSaving ? 'Salvando...' : 'Salvar alteracoes' }}
          </button>
        </section>

        <section v-show="activeSection === 'promocoes'" data-cy="storefront-promotions-section" class="space-y-4">
          <div class="flex flex-col gap-3 rounded-lg border border-[#E5E7EB] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 class="text-[10px] font-black uppercase tracking-widest text-bip-muted">Banners promocionais</h3>
              <p class="mt-1 text-xs leading-5 text-bip-muted">Crie campanhas com ordem, status e periodo opcional.</p>
            </div>
            <button type="button" data-cy="btn-add-storefront-promotion" class="h-10 rounded-lg bg-[#05050A] px-4 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-[#D81B60]" @click="addPromotionBanner">
              Novo banner
            </button>
          </div>

          <p v-if="isBannersLoading" class="text-xs text-bip-muted">Carregando banners promocionais...</p>

          <article v-for="(editor, index) in bannerEditors" :key="editor.clientId" data-cy="storefront-promotion-card" class="rounded-lg border border-[#E5E7EB] bg-white p-4">
            <div class="flex flex-col gap-4 lg:grid lg:grid-cols-[220px_minmax(0,1fr)]">
              <div>
                <div class="overflow-hidden rounded-lg border border-[#E5E7EB] bg-zinc-50">
                  <img v-if="editor.pendingPreviewUrl || editor.image_url" data-cy="storefront-promotion-preview" :src="editor.pendingPreviewUrl || editor.image_url" :alt="editor.alt_text || editor.title || 'Preview do banner promocional'" class="aspect-[5/3] w-full object-cover" />
                  <div v-else class="flex aspect-[5/3] items-center justify-center text-[10px] font-black uppercase tracking-widest text-bip-muted">Banner</div>
                </div>

                <input :data-promotion-file-input="editor.clientId" data-cy="storefront-promotion-file" type="file" accept="image/png,image/jpeg,image/jpg,image/webp" class="sr-only" @change="handlePromotionFileChange(editor, $event)" />
                <div class="mt-3 flex flex-wrap gap-2">
                  <button type="button" class="h-10 rounded-lg border border-[#D1D5DB] bg-white px-3 text-[10px] font-black uppercase tracking-widest text-[#05050A] hover:border-[#D81B60] hover:text-[#D81B60]" @click="openPromotionImagePicker(editor)">
                    Alterar imagem
                  </button>
                  <button type="button" :disabled="!(editor.pendingPreviewUrl || editor.image_url)" class="h-10 rounded-lg border border-[#D1D5DB] bg-white px-3 text-[10px] font-black uppercase tracking-widest text-[#4B5563] disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-bip-muted" @click="removePromotionImage(editor)">
                    Remover
                  </button>
                </div>
                <p class="mt-2 text-[11px] leading-5 text-bip-muted">PNG, JPG, JPEG ou WEBP ate 5 MB. Recomendado: {{ PROMOTION_MEDIA_RULES.recommendedSize }}.</p>
                <p v-if="editor.fileError" class="mt-1 text-xs font-semibold text-[#D81B60]">{{ editor.fileError }}</p>
              </div>

              <div class="grid gap-4 sm:grid-cols-2">
                <div class="flex items-center justify-between gap-3 sm:col-span-2">
                  <label class="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[#4B5563]">
                    <input v-model="editor.is_active" type="checkbox" class="h-4 w-4 rounded border-[#D1D5DB] text-[#D81B60] focus:ring-[#FCE7F3]" />
                    Ativo
                  </label>
                  <span class="rounded-full border border-[#E5E7EB] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-bip-muted">{{ statusLabel(editor.status) }}</span>
                </div>

                <label class="block">
                  <span class="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-bip-muted">Titulo</span>
                  <input v-model="editor.title" data-cy="storefront-promotion-title" type="text" maxlength="120" class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]" />
                </label>

                <label class="block">
                  <span class="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-bip-muted">Texto alternativo</span>
                  <input v-model="editor.alt_text" type="text" maxlength="160" class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]" />
                </label>

                <label class="block">
                  <span class="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-bip-muted">Subtitulo</span>
                  <input v-model="editor.subtitle" type="text" maxlength="200" class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]" />
                </label>

                <label class="block">
                  <span class="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-bip-muted">Texto do botao</span>
                  <input v-model="editor.cta_text" type="text" maxlength="40" class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]" />
                </label>

                <label class="block">
                  <span class="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-bip-muted">Ao clicar no banner</span>
                  <select v-model="editor.destination_type" data-cy="storefront-promotion-destination-type" class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]" @change="handlePromotionDestinationTypeChange(editor)">
                    <option v-for="option in DESTINATION_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</option>
                  </select>
                </label>

                <label v-if="editor.destination_type === 'category'" class="block">
                  <span class="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-bip-muted">Categoria</span>
                  <select v-model="editor.destination_value" data-cy="storefront-promotion-destination-category" class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]">
                    <option value="">Selecione</option>
                    <option v-for="category in categories" :key="category.id" :value="String(category.id)">{{ category.name }}</option>
                  </select>
                </label>

                <label v-else-if="editor.destination_type === 'product'" class="block">
                  <span class="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-bip-muted">Produto</span>
                  <select v-model="editor.destination_value" data-cy="storefront-promotion-destination-product" class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]">
                    <option value="">Selecione</option>
                    <option v-for="product in products" :key="product.id" :value="String(product.id)">{{ product.name }}</option>
                  </select>
                </label>

                <label v-else-if="editor.destination_type === 'external_url'" class="block">
                  <span class="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-bip-muted">Link externo</span>
                  <input v-model="editor.destination_value" type="url" class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]" placeholder="https://..." />
                </label>

                <label class="block">
                  <span class="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-bip-muted">Inicio</span>
                  <input v-model="editor.starts_at" data-cy="storefront-promotion-starts-at" type="datetime-local" class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]" />
                </label>

                <label class="block">
                  <span class="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-bip-muted">Fim</span>
                  <input v-model="editor.ends_at" data-cy="storefront-promotion-ends-at" type="datetime-local" class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]" />
                </label>

                <p v-if="editor.saveError" class="text-xs font-semibold text-[#D81B60] sm:col-span-2">{{ editor.saveError }}</p>

                <div class="flex flex-wrap gap-2 sm:col-span-2">
                  <button type="button" data-cy="btn-save-storefront-promotion" :disabled="editor.isSaving" class="h-10 rounded-lg bg-[#D81B60] px-4 text-[10px] font-black uppercase tracking-widest text-white disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-bip-muted" @click="savePromotionBanner(editor)">
                    {{ editor.isSaving ? 'Salvando...' : 'Salvar banner' }}
                  </button>
                  <button type="button" data-cy="btn-delete-storefront-promotion" :disabled="editor.isDeleting" class="h-10 rounded-lg border border-[#D1D5DB] bg-white px-4 text-[10px] font-black uppercase tracking-widest text-[#4B5563] disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-bip-muted" @click="deletePromotionBanner(editor)">
                    {{ editor.isDeleting ? 'Removendo...' : 'Excluir' }}
                  </button>
                  <button type="button" data-cy="btn-move-storefront-promotion-up" :disabled="index === 0 || isReorderingBanners || !editor.id" class="h-10 rounded-lg border border-[#D1D5DB] bg-white px-4 text-[10px] font-black uppercase tracking-widest text-[#05050A] disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-bip-muted" @click="movePromotionBanner(index, -1)">
                    Subir
                  </button>
                  <button type="button" data-cy="btn-move-storefront-promotion-down" :disabled="index === bannerEditors.length - 1 || isReorderingBanners || !editor.id" class="h-10 rounded-lg border border-[#D1D5DB] bg-white px-4 text-[10px] font-black uppercase tracking-widest text-[#05050A] disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-bip-muted" @click="movePromotionBanner(index, 1)">
                    Descer
                  </button>
                </div>
              </div>
            </div>
          </article>
        </section>

        <section v-show="activeSection === 'estilo'" class="rounded-lg border border-[#E5E7EB] bg-white p-4">
          <h3 class="text-[10px] font-black uppercase tracking-widest text-bip-muted">Estilo da vitrine</h3>
          <div class="mt-4 grid gap-4 sm:grid-cols-2">
            <label class="block">
              <span class="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-bip-muted">Fonte</span>
              <select v-model="draft.font_preset" data-cy="storefront-font-preset-select" class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]">
                <option v-for="option in FONT_PRESET_OPTIONS" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </label>

            <label class="block">
              <span class="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-bip-muted">Cards</span>
              <select v-model="draft.card_style" data-cy="storefront-card-style-select" class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]">
                <option value="clean">Limpo</option>
                <option value="bordered">Com borda</option>
                <option value="elevated">Elevado</option>
              </select>
            </label>

            <label class="block">
              <span class="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-bip-muted">Arredondamento</span>
              <select v-model="draft.radius_style" data-cy="storefront-radius-style-select" class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]">
                <option value="minimal">Reto</option>
                <option value="rounded">Suave</option>
                <option value="soft">Arredondado</option>
              </select>
            </label>

            <label class="block">
              <span class="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-bip-muted">Densidade</span>
              <select v-model="draft.density" data-cy="storefront-density-select" class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]">
                <option value="comfortable">Confortavel</option>
                <option value="compact">Compacta</option>
              </select>
            </label>

            <label class="block">
              <span class="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-bip-muted">Animacoes</span>
              <select v-model="draft.motion_intensity" data-cy="storefront-motion-intensity-select" class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]">
                <option value="subtle">Suaves</option>
                <option value="standard">Normais</option>
              </select>
            </label>

            <label class="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#4B5563]">
              <input v-model="draft.motion_enabled" type="checkbox" class="h-4 w-4 rounded border-[#D1D5DB] text-[#D81B60] focus:ring-[#FCE7F3]" />
              Ativar animacoes
            </label>

            <label class="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#4B5563]">
              <input v-model="draft.decoration_enabled" data-cy="storefront-decoration-enabled" type="checkbox" class="h-4 w-4 rounded border-[#D1D5DB] text-[#D81B60] focus:ring-[#FCE7F3]" />
              Elementos decorativos
            </label>

            <label v-if="draft.decoration_enabled" class="block sm:col-span-2">
              <span class="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-bip-muted">Tipo de decoracao</span>
              <select v-model="draft.decoration_style" data-cy="storefront-decoration-style-select" class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]">
                <option value="none">Nenhuma</option>
                <option value="circles">Circulos</option>
                <option value="soft-shapes">Formas suaves</option>
                <option value="geometric">Geometrica</option>
              </select>
            </label>
          </div>

          <button type="button" data-cy="btn-save-storefront-layout" :disabled="isSaving || !hasAppearanceChanges" class="mt-4 w-full rounded-lg bg-[#D81B60] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-[#D81B60]/90 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-bip-muted sm:w-auto" @click="handleSaveAppearance('layout')">
            {{ isSaving ? 'Salvando...' : 'Salvar alteracoes' }}
          </button>
        </section>

        <section v-show="activeSection === 'preview'" class="rounded-lg border border-[#E5E7EB] bg-white p-4 xl:hidden">
          <h3 class="text-[10px] font-black uppercase tracking-widest text-bip-muted">Preview ao vivo</h3>
          <p class="mt-1 text-xs text-bip-muted">O preview tambem fica fixo ao lado no desktop.</p>
        </section>

        <p v-if="saveError" class="text-xs font-semibold text-[#D81B60]">{{ saveError }}</p>

        <div v-if="hasAppearanceChanges" data-cy="storefront-unsaved-changes" class="sticky bottom-3 z-10 flex flex-col gap-2 rounded-lg border border-[#FBCFE8] bg-white p-3 shadow-xl shadow-[#05050A]/10 sm:flex-row sm:items-center sm:justify-between">
          <p class="text-xs font-semibold text-[#4B5563]">Alteracoes nao salvas</p>
          <div class="flex flex-wrap gap-2">
            <button type="button" data-cy="btn-discard-storefront-appearance" class="h-10 rounded-lg border border-[#D1D5DB] bg-white px-4 text-[10px] font-black uppercase tracking-widest text-[#4B5563]" @click="discardAppearanceChanges">
              Descartar
            </button>
            <button type="button" data-cy="btn-save-storefront-appearance" :disabled="isSaving || !selectedStore" class="h-10 rounded-lg bg-[#D81B60] px-4 text-[10px] font-black uppercase tracking-widest text-white disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-bip-muted" @click="handleSaveAppearance('all')">
              {{ isSaving ? 'Salvando...' : 'Salvar alteracoes' }}
            </button>
          </div>
        </div>
      </div>

      <aside data-cy="storefront-live-preview" class="xl:sticky xl:top-24 xl:self-start">
        <div class="overflow-hidden rounded-lg border border-[#E5E7EB] bg-white shadow-[0_20px_60px_-42px_rgba(5,5,10,0.45)]">
          <div class="border-b border-[#E5E7EB] px-4 py-3">
            <h3 class="text-[10px] font-black uppercase tracking-widest text-bip-muted">Preview ao vivo</h3>
          </div>

          <div class="p-3">
            <div class="overflow-hidden rounded-lg border border-[#E5E7EB]" :style="previewStyle">
              <div class="bg-[var(--preview-background)] p-4 text-[var(--preview-text)]">
                <div class="flex items-center gap-3">
                  <div class="flex h-11 w-11 items-center justify-center overflow-hidden rounded-[var(--preview-radius)] bg-[var(--preview-surface)]">
                    <img v-if="logoPreviewUrl" :src="logoPreviewUrl" alt="" class="h-full w-full object-contain" />
                    <span v-else class="text-xs font-black">BF</span>
                  </div>
                  <div class="min-w-0">
                    <p class="truncate text-sm font-black" style="font-family: var(--preview-font-heading)">{{ previewStoreName }}</p>
                    <p class="truncate text-xs text-[var(--preview-muted)]">{{ draft.tagline || 'Catalogo online' }}</p>
                  </div>
                  <div v-if="faviconPreviewUrl" class="ml-auto flex h-7 w-7 items-center justify-center overflow-hidden rounded border border-black/10 bg-white">
                    <img :src="faviconPreviewUrl" alt="" class="h-full w-full object-contain" />
                  </div>
                </div>

                <div v-if="draft.hero_enabled && heroPreviewImageUrl" class="mt-4 overflow-hidden rounded-[var(--preview-radius)] border border-black/10 bg-[var(--preview-surface)]">
                  <img :src="heroPreviewImageUrl" :alt="draft.hero_alt_text" class="aspect-[16/7] w-full object-cover" />
                  <div v-if="draft.hero_title || draft.hero_subtitle || (draft.hero_cta_text && heroPreviewUrl)" class="space-y-2 p-3">
                    <p v-if="draft.hero_title" class="text-sm font-black leading-tight" style="font-family: var(--preview-font-heading)">{{ draft.hero_title }}</p>
                    <p v-if="draft.hero_subtitle" class="text-xs leading-5 text-[var(--preview-muted)]">{{ draft.hero_subtitle }}</p>
                    <span v-if="draft.hero_cta_text && heroPreviewUrl" class="inline-flex h-9 items-center rounded-[var(--preview-radius)] bg-[var(--preview-accent)] px-3 text-[10px] font-black uppercase tracking-widest text-white">
                      {{ draft.hero_cta_text }}
                    </span>
                  </div>
                </div>

                <div v-if="visiblePreviewBanners.length" class="mt-4 grid gap-2">
                  <div v-for="banner in visiblePreviewBanners" :key="banner.clientId" class="overflow-hidden rounded-[var(--preview-radius)] border border-black/10 bg-[var(--preview-surface)]">
                    <img :src="banner.pendingPreviewUrl || banner.image_url" :alt="banner.alt_text" class="aspect-[5/2] w-full object-cover" />
                    <div v-if="banner.title || banner.subtitle" class="p-2">
                      <p v-if="banner.title" class="text-xs font-black" style="font-family: var(--preview-font-heading)">{{ banner.title }}</p>
                      <p v-if="banner.subtitle" class="text-[11px] text-[var(--preview-muted)]">{{ banner.subtitle }}</p>
                    </div>
                  </div>
                </div>

                <div class="mt-4 grid grid-cols-2 gap-3">
                  <div v-for="item in 2" :key="item" class="rounded-[var(--preview-radius)] border border-black/10 bg-[var(--preview-surface)] p-2">
                    <div class="aspect-[4/5] rounded-[calc(var(--preview-radius)*0.75)] bg-[var(--preview-secondary)]/20" />
                    <p class="mt-2 h-3 rounded bg-[var(--preview-text)]/80" />
                    <p class="mt-2 h-3 w-2/3 rounded bg-[var(--preview-muted)]/40" />
                    <span class="mt-3 inline-flex h-7 w-full items-center justify-center rounded-[var(--preview-radius)] bg-[var(--preview-primary)] text-[9px] font-black uppercase tracking-widest text-white">
                      Comprar
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <p v-if="isOptionsLoading" class="mt-3 text-[11px] text-bip-muted">Carregando destinos...</p>
          </div>
        </div>
      </aside>
    </div>
  </section>
</template>
