<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useToast } from '@/composables/useToast';
import { Logger } from '@/services/logger';
import { storefrontAppearanceService } from '@/services/storefront-appearance.service';
import { buildErrorContext, type ApplicationError } from '@/types/errors';
import type { StorefrontAppearance, StorefrontAppearancePayload } from '@/types/store';
import {
  STOREFRONT_MEDIA_RULES,
  validateStorefrontMediaFile,
} from '@/utils/storefrontMedia';

/**
 * Banner opcional do hero. O lojista faz a arte pronta (Canva/Figma) --
 * nao adicionamos texto por cima da imagem automaticamente, apenas
 * exibimos titulo/subtitulo/CTA como elementos separados quando informados.
 */
const props = defineProps<{
  appearance: StorefrontAppearance | null;
  save: (payload: StorefrontAppearancePayload) => Promise<StorefrontAppearance>;
}>();

type BannerDraft = Pick<
  StorefrontAppearance,
  | 'hero_enabled'
  | 'hero_image_desktop'
  | 'hero_image_mobile'
  | 'hero_alt_text'
  | 'hero_title'
  | 'hero_subtitle'
  | 'hero_cta_text'
  | 'hero_cta_url'
>;

const { success, error: toastError } = useToast();
const BANNER_MEDIA_RULES = STOREFRONT_MEDIA_RULES.banner;
const isSaving = ref(false);
const saveError = ref<string | null>(null);
const bannerInput = ref<HTMLInputElement | null>(null);
const pendingBannerFile = ref<File | null>(null);
const pendingBannerPreviewUrl = ref<string | null>(null);
const bannerError = ref<string | null>(null);

function buildDraft(appearance: StorefrontAppearance | null): BannerDraft {
  return {
    hero_enabled: appearance?.hero_enabled ?? false,
    hero_image_desktop: appearance?.hero_image_desktop ?? '',
    hero_image_mobile: appearance?.hero_image_mobile ?? '',
    hero_alt_text: appearance?.hero_alt_text ?? '',
    hero_title: appearance?.hero_title ?? '',
    hero_subtitle: appearance?.hero_subtitle ?? '',
    hero_cta_text: appearance?.hero_cta_text ?? '',
    hero_cta_url: appearance?.hero_cta_url ?? '',
  };
}

function areDraftsEqual(left: BannerDraft, right: BannerDraft): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

const draft = ref<BannerDraft>(buildDraft(props.appearance));
const savedDraft = ref<BannerDraft>(buildDraft(props.appearance));
const bannerPreviewUrl = computed(() => (
  pendingBannerPreviewUrl.value || draft.value.hero_image_desktop
));
const hasChanges = computed(() => (
  Boolean(pendingBannerFile.value) || !areDraftsEqual(draft.value, savedDraft.value)
));

watch(() => props.appearance, (appearance) => {
  clearPendingBannerFile();
  const nextDraft = buildDraft(appearance);
  draft.value = nextDraft;
  savedDraft.value = buildDraft(appearance);
});

onBeforeUnmount(() => {
  clearPendingBannerFile();
});

function clearPendingBannerFile(): void {
  if (pendingBannerPreviewUrl.value) {
    URL.revokeObjectURL(pendingBannerPreviewUrl.value);
  }
  pendingBannerFile.value = null;
  pendingBannerPreviewUrl.value = null;
  bannerError.value = null;
  if (bannerInput.value) {
    bannerInput.value.value = '';
  }
}

function openBannerPicker(): void {
  bannerInput.value?.click();
}

function handleBannerFileChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  if (!file) {
    return;
  }

  const validationError = validateStorefrontMediaFile('banner', file);
  if (validationError) {
    clearPendingBannerFile();
    bannerError.value = validationError;
    return;
  }

  clearPendingBannerFile();
  pendingBannerFile.value = file;
  pendingBannerPreviewUrl.value = URL.createObjectURL(file);
  draft.value.hero_enabled = true;
}

function removeBannerImage(): void {
  clearPendingBannerFile();
  draft.value.hero_image_desktop = '';
  draft.value.hero_image_mobile = '';
  draft.value.hero_enabled = false;
}

async function handleSave(): Promise<void> {
  if (isSaving.value || !hasChanges.value) {
    return;
  }

  isSaving.value = true;
  saveError.value = null;

  try {
    const draftToPersist: BannerDraft = { ...draft.value };

    if (pendingBannerFile.value) {
      const uploadedBanner = await storefrontAppearanceService.uploadMedia(
        'banner',
        pendingBannerFile.value,
      );
      draftToPersist.hero_enabled = true;
      draftToPersist.hero_image_desktop = uploadedBanner.url;
    }

    const updatedAppearance = await props.save({ ...draftToPersist });
    const nextDraft = buildDraft(updatedAppearance);
    draft.value = nextDraft;
    savedDraft.value = buildDraft(updatedAppearance);
    clearPendingBannerFile();
    success('Aparencia da vitrine atualizada com sucesso.');
  } catch (error: unknown) {
    Logger.error('Storefront banner save failed', buildErrorContext(error as ApplicationError, {}));
    saveError.value = 'Nao foi possivel salvar o banner. Tente novamente.';
    toastError('Nao foi possivel salvar o banner.');
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <section data-cy="storefront-banner-section" class="max-w-2xl space-y-4 rounded-lg border border-[#E5E7EB] bg-white p-4">
    <label class="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#4B5563]">
      <input v-model="draft.hero_enabled" data-cy="storefront-banner-enabled" type="checkbox" class="h-4 w-4 rounded border-[#D1D5DB] text-[#111827] focus:ring-[#F3F4F6]" />
      Ativar banner principal
    </label>

    <div v-if="draft.hero_enabled" class="grid gap-4 sm:grid-cols-2">
      <div class="block sm:col-span-2">
        <span class="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-bip-muted">Imagem do banner</span>
        <input
          ref="bannerInput"
          data-cy="storefront-banner-file"
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          class="sr-only"
          @change="handleBannerFileChange"
        />

        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            data-cy="btn-select-storefront-banner"
            class="inline-flex h-10 items-center justify-center rounded-lg border border-[#D1D5DB] bg-white px-4 text-[10px] font-black uppercase tracking-widest text-[#05050A] transition hover:border-[#111827] hover:text-[#111827]"
            @click="openBannerPicker"
          >
            Alterar imagem
          </button>
          <button
            type="button"
            data-cy="btn-remove-storefront-banner"
            :disabled="!bannerPreviewUrl"
            class="inline-flex h-10 items-center justify-center rounded-lg border border-[#D1D5DB] bg-white px-4 text-[10px] font-black uppercase tracking-widest text-[#4B5563] transition hover:border-[#111827] hover:text-[#111827] disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-bip-muted"
            @click="removeBannerImage"
          >
            Remover
          </button>
        </div>

        <p class="mt-2 text-[11px] leading-5 text-bip-muted">
          PNG, JPG, JPEG ou WEBP ate 5 MB. Recomendado: {{ BANNER_MEDIA_RULES.recommendedSize }}.
        </p>
        <p v-if="bannerError" data-cy="storefront-banner-file-error" class="mt-1 text-xs font-semibold text-[#111827]">
          {{ bannerError }}
        </p>
      </div>

      <label class="block sm:col-span-2">
        <span class="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-bip-muted">Texto alternativo (acessibilidade)</span>
        <input v-model="draft.hero_alt_text" data-cy="storefront-banner-alt" type="text" maxlength="160" class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#111827] focus:ring-2 focus:ring-[#F3F4F6]" placeholder="Descreva a imagem do banner" />
      </label>

      <label class="block">
        <span class="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-bip-muted">Titulo (opcional)</span>
        <input v-model="draft.hero_title" data-cy="storefront-banner-title" type="text" maxlength="120" class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#111827] focus:ring-2 focus:ring-[#F3F4F6]" />
      </label>

      <label class="block">
        <span class="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-bip-muted">Subtitulo (opcional)</span>
        <input v-model="draft.hero_subtitle" data-cy="storefront-banner-subtitle" type="text" maxlength="200" class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#111827] focus:ring-2 focus:ring-[#F3F4F6]" />
      </label>

      <label class="block">
        <span class="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-bip-muted">Texto do CTA (opcional)</span>
        <input v-model="draft.hero_cta_text" data-cy="storefront-banner-cta-text" type="text" maxlength="40" class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#111827] focus:ring-2 focus:ring-[#F3F4F6]" placeholder="Ex.: Ver colecao" />
      </label>

      <label class="block">
        <span class="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-bip-muted">Link do CTA (opcional)</span>
        <input v-model="draft.hero_cta_url" data-cy="storefront-banner-cta-url" type="url" class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#111827] focus:ring-2 focus:ring-[#F3F4F6]" />
      </label>

      <div v-if="bannerPreviewUrl" class="overflow-hidden rounded-lg border border-[#E5E7EB] bg-zinc-50 sm:col-span-2">
        <img
          data-cy="storefront-banner-preview"
          :src="bannerPreviewUrl"
          :alt="draft.hero_alt_text || 'Preview do banner desktop'"
          class="aspect-[16/7] w-full object-cover"
        />
      </div>
    </div>

    <p v-if="saveError" class="text-xs font-semibold text-[#111827]">{{ saveError }}</p>

    <button
      type="button"
      data-cy="btn-save-storefront-banner"
      :disabled="isSaving || !hasChanges"
      class="w-full rounded-lg bg-[#111827] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-[#111827]/90 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-bip-muted sm:w-auto"
      @click="handleSave"
    >
      {{ isSaving ? 'Salvando...' : 'Salvar alteracoes' }}
    </button>
  </section>
</template>
