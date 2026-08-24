<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useCurrentStore } from '@/composables/useCurrentStore';
import { useToast } from '@/composables/useToast';
import { Logger } from '@/services/logger';
import { storeService } from '@/services/store.service';
import { storefrontAppearanceService } from '@/services/storefront-appearance.service';
import { buildErrorContext, type ApplicationError } from '@/types/errors';
import type {
  Store,
  StoreAppearanceSettingsPayload,
  StorefrontAppearance,
  StoreTheme,
} from '@/types/store';
import {
  STOREFRONT_MEDIA_RULES,
  validateStorefrontMediaFile,
} from '@/utils/storefrontMedia';

/**
 * Identidade + Cores: logo, tagline e a paleta editavel pelo lojista.
 * Cores base (primary/accent/background/surface/text) vivem em Store.theme;
 * secondary_color e' o unico campo de cor que mora em StorefrontAppearance
 * -- ver decisao de modelagem em StorefrontAppearance (models.py).
 */
const props = defineProps<{
  appearance: StorefrontAppearance | null;
  save: (payload: { secondary_color?: string }) => Promise<StorefrontAppearance>;
}>();

const { selectedStore, fetchCurrentStore } = useCurrentStore();
const { success, error: toastError } = useToast();

type ThemeColorKey = keyof StoreTheme;
type ThemeDraft = Record<ThemeColorKey, string>;

interface IdentityColorsDraft {
  logo_url: string;
  tagline: string;
  theme: ThemeDraft;
  secondary_color: string;
}

const SECONDARY_COLOR_FALLBACK = '#D81B60';
const LOGO_MEDIA_RULES = STOREFRONT_MEDIA_RULES.logo;

const THEME_COLOR_FIELDS: { key: ThemeColorKey; label: string }[] = [
  { key: 'primary', label: 'Principal' },
  { key: 'accent', label: 'Destaque' },
  { key: 'background', label: 'Fundo' },
  { key: 'surface', label: 'Superficie' },
  { key: 'text', label: 'Texto' },
  { key: 'muted', label: 'Texto auxiliar' },
];

function buildThemeDraft(theme: StoreTheme | null | undefined): ThemeDraft {
  return {
    primary: theme?.primary || '#05050A',
    accent: theme?.accent || '#D81B60',
    background: theme?.background || '#FAFAFA',
    surface: theme?.surface || '#FFFFFF',
    text: theme?.text || '#05050A',
    muted: theme?.muted || '#6B7280',
  };
}

function buildDraft(store: Store | null, appearance: StorefrontAppearance | null): IdentityColorsDraft {
  return {
    logo_url: store?.logo_url ?? '',
    tagline: store?.tagline ?? '',
    theme: buildThemeDraft(store?.theme),
    secondary_color: appearance?.secondary_color || SECONDARY_COLOR_FALLBACK,
  };
}

function areDraftsEqual(left: IdentityColorsDraft, right: IdentityColorsDraft): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function buildStorePayload(
  nextDraft: IdentityColorsDraft,
  previousDraft: IdentityColorsDraft,
): StoreAppearanceSettingsPayload {
  const payload: StoreAppearanceSettingsPayload = {};

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

const draft = ref<IdentityColorsDraft>(buildDraft(selectedStore.value, props.appearance));
const savedDraft = ref<IdentityColorsDraft>(buildDraft(selectedStore.value, props.appearance));
const logoInput = ref<HTMLInputElement | null>(null);
const pendingLogoFile = ref<File | null>(null);
const pendingLogoPreviewUrl = ref<string | null>(null);
const logoError = ref<string | null>(null);
const logoPreviewUrl = computed(() => pendingLogoPreviewUrl.value || draft.value.logo_url);
const hasChanges = computed(() => (
  Boolean(pendingLogoFile.value) || !areDraftsEqual(draft.value, savedDraft.value)
));
const isSaving = ref(false);
const saveError = ref<string | null>(null);

watch([selectedStore, () => props.appearance], ([store, appearance]) => {
  clearPendingLogoFile();
  const nextDraft = buildDraft(store, appearance);
  draft.value = nextDraft;
  savedDraft.value = buildDraft(store, appearance);
});

onBeforeUnmount(() => {
  clearPendingLogoFile();
});

function clearPendingLogoFile(): void {
  if (pendingLogoPreviewUrl.value) {
    URL.revokeObjectURL(pendingLogoPreviewUrl.value);
  }
  pendingLogoFile.value = null;
  pendingLogoPreviewUrl.value = null;
  logoError.value = null;
  if (logoInput.value) {
    logoInput.value.value = '';
  }
}

function openLogoPicker(): void {
  logoInput.value?.click();
}

function handleLogoFileChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  if (!file) {
    return;
  }

  const validationError = validateStorefrontMediaFile('logo', file);
  if (validationError) {
    clearPendingLogoFile();
    logoError.value = validationError;
    return;
  }

  clearPendingLogoFile();
  pendingLogoFile.value = file;
  pendingLogoPreviewUrl.value = URL.createObjectURL(file);
}

function removeLogo(): void {
  clearPendingLogoFile();
  draft.value.logo_url = '';
}

async function handleSave(): Promise<void> {
  const store = selectedStore.value;
  if (!store || isSaving.value || !hasChanges.value) {
    return;
  }

  isSaving.value = true;
  saveError.value = null;

  try {
    const draftToPersist: IdentityColorsDraft = {
      ...draft.value,
      theme: { ...draft.value.theme },
    };

    if (pendingLogoFile.value) {
      const uploadedLogo = await storefrontAppearanceService.uploadMedia(
        'logo',
        pendingLogoFile.value,
      );
      draftToPersist.logo_url = uploadedLogo.url;
    }

    const storePayload = buildStorePayload(draftToPersist, savedDraft.value);
    const shouldUpdateStore = Object.keys(storePayload).length > 0;
    const shouldUpdateSecondaryColor = (
      draftToPersist.secondary_color !== savedDraft.value.secondary_color
    );
    let updatedStore: Store | null = null;
    let updatedAppearance: StorefrontAppearance | null = null;

    if (shouldUpdateStore) {
      updatedStore = await storeService.updateCurrentAppearance(storePayload);
    }

    if (shouldUpdateSecondaryColor) {
      updatedAppearance = await props.save({
        secondary_color: draftToPersist.secondary_color,
      });
    }

    if (shouldUpdateStore) {
      await fetchCurrentStore(true);
    }

    if (selectedStore.value?.slug === store.slug) {
      const nextDraft = buildDraft(updatedStore ?? selectedStore.value ?? store, updatedAppearance ?? props.appearance);
      draft.value = nextDraft;
      savedDraft.value = buildDraft(updatedStore ?? selectedStore.value ?? store, updatedAppearance ?? props.appearance);
      clearPendingLogoFile();
      success('Aparencia da vitrine atualizada com sucesso.');
    }
  } catch (error: unknown) {
    Logger.error('Storefront identity/colors save failed', buildErrorContext(error as ApplicationError, { slug: store.slug }));
    saveError.value = 'Nao foi possivel salvar a identidade e as cores. Tente novamente.';
    toastError('Nao foi possivel salvar a identidade e as cores.');
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <section data-cy="storefront-identity-colors-section" class="max-w-2xl space-y-6">
    <div class="rounded-lg border border-[#E5E7EB] bg-white p-4">
      <h3 class="text-[10px] font-black uppercase tracking-widest text-bip-muted">Identidade</h3>

      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        <div class="sm:col-span-2">
          <span class="mb-2 block text-[9px] font-black uppercase tracking-widest text-bip-muted">
            Logo da loja
          </span>

          <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div class="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#E5E7EB] bg-zinc-50">
              <img
                v-if="logoPreviewUrl"
                data-cy="storefront-logo-preview"
                :src="logoPreviewUrl"
                alt="Preview do logo"
                class="h-full w-full object-contain"
              />
              <span v-else class="text-[10px] font-black uppercase tracking-widest text-bip-muted">
                Logo
              </span>
            </div>

            <div class="flex flex-1 flex-col gap-2">
              <input
                ref="logoInput"
                data-cy="storefront-logo-file"
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                class="sr-only"
                @change="handleLogoFileChange"
              />

              <div class="flex flex-wrap gap-2">
                <button
                  type="button"
                  data-cy="btn-select-storefront-logo"
                  class="inline-flex h-10 items-center justify-center rounded-lg border border-[#D1D5DB] bg-white px-4 text-[10px] font-black uppercase tracking-widest text-[#05050A] transition hover:border-[#D81B60] hover:text-[#D81B60]"
                  @click="openLogoPicker"
                >
                  Alterar logo
                </button>
                <button
                  type="button"
                  data-cy="btn-remove-storefront-logo"
                  :disabled="!logoPreviewUrl"
                  class="inline-flex h-10 items-center justify-center rounded-lg border border-[#D1D5DB] bg-white px-4 text-[10px] font-black uppercase tracking-widest text-[#4B5563] transition hover:border-[#D81B60] hover:text-[#D81B60] disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-bip-muted"
                  @click="removeLogo"
                >
                  Remover
                </button>
              </div>

              <p class="text-[11px] leading-5 text-bip-muted">
                PNG, JPG, JPEG ou WEBP ate 2 MB. Recomendado: {{ LOGO_MEDIA_RULES.recommendedSize }}.
              </p>
              <p v-if="logoError" data-cy="storefront-logo-error" class="text-xs font-semibold text-[#D81B60]">
                {{ logoError }}
              </p>
            </div>
          </div>
        </div>

        <label class="block sm:col-span-2">
          <span class="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-bip-muted">
            Tagline
          </span>
          <input
            v-model="draft.tagline"
            data-cy="storefront-tagline"
            type="text"
            maxlength="160"
            class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
            placeholder="Ex.: Catalogo online"
          />
        </label>
      </div>
    </div>

    <div class="rounded-lg border border-[#E5E7EB] bg-white p-4">
      <h3 class="text-[10px] font-black uppercase tracking-widest text-bip-muted">Cores</h3>

      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        <label
          v-for="field in THEME_COLOR_FIELDS"
          :key="field.key"
          class="block"
        >
          <span class="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-bip-muted">
            {{ field.label }}
          </span>
          <span class="flex gap-2">
            <input
              v-model="draft.theme[field.key]"
              type="color"
              class="h-11 w-14 shrink-0 cursor-pointer rounded-lg border border-[#D1D5DB] bg-white p-1"
              :aria-label="`${field.label} visual`"
            />
            <input
              v-model="draft.theme[field.key]"
              :data-cy="`storefront-theme-${field.key}`"
              type="text"
              maxlength="9"
              pattern="^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$"
              class="h-11 min-w-0 flex-1 rounded-lg border border-[#D1D5DB] bg-white px-3 font-mono text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
              :aria-label="`${field.label} em HEX`"
            />
          </span>
        </label>

        <label class="block">
          <span class="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-bip-muted">Secundaria</span>
          <span class="flex gap-2">
            <input
              v-model="draft.secondary_color"
              type="color"
              class="h-11 w-14 shrink-0 cursor-pointer rounded-lg border border-[#D1D5DB] bg-white p-1"
              aria-label="Secundaria visual"
            />
            <input
              v-model="draft.secondary_color"
              data-cy="storefront-secondary-color"
              type="text"
              maxlength="9"
              pattern="^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$"
              class="h-11 min-w-0 flex-1 rounded-lg border border-[#D1D5DB] bg-white px-3 font-mono text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
              aria-label="Secundaria em HEX"
            />
          </span>
        </label>
      </div>
    </div>

    <p v-if="saveError" class="text-xs font-semibold text-[#D81B60]">{{ saveError }}</p>

    <button
      type="button"
      data-cy="btn-save-storefront-identity"
      :disabled="isSaving || !selectedStore || !hasChanges"
      class="w-full rounded-lg bg-[#D81B60] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-[#D81B60]/90 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-bip-muted sm:w-auto"
      @click="handleSave"
    >
      {{ isSaving ? 'Salvando...' : 'Salvar alteracoes' }}
    </button>
  </section>
</template>
