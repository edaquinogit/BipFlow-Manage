<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useToast } from '@/composables/useToast';
import { Logger } from '@/services/logger';
import { buildErrorContext, type ApplicationError } from '@/types/errors';
import type { StorefrontAppearance, StorefrontAppearancePayload } from '@/types/store';

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
const isSaving = ref(false);
const saveError = ref<string | null>(null);

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
const hasChanges = computed(() => !areDraftsEqual(draft.value, savedDraft.value));

watch(() => props.appearance, (appearance) => {
  const nextDraft = buildDraft(appearance);
  draft.value = nextDraft;
  savedDraft.value = buildDraft(appearance);
});

async function handleSave(): Promise<void> {
  if (isSaving.value || !hasChanges.value) {
    return;
  }

  isSaving.value = true;
  saveError.value = null;

  try {
    const updatedAppearance = await props.save({ ...draft.value });
    const nextDraft = buildDraft(updatedAppearance);
    draft.value = nextDraft;
    savedDraft.value = buildDraft(updatedAppearance);
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
      <input v-model="draft.hero_enabled" data-cy="storefront-banner-enabled" type="checkbox" class="h-4 w-4 rounded border-[#D1D5DB] text-[#D81B60] focus:ring-[#FCE7F3]" />
      Ativar banner principal
    </label>

    <div v-if="draft.hero_enabled" class="grid gap-4 sm:grid-cols-2">
      <label class="block">
        <span class="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-bip-muted">Imagem (desktop)</span>
        <input v-model="draft.hero_image_desktop" data-cy="storefront-banner-desktop-url" type="url" class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]" placeholder="https://.../banner-desktop.jpg" />
      </label>

      <label class="block">
        <span class="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-bip-muted">Imagem (mobile)</span>
        <input v-model="draft.hero_image_mobile" data-cy="storefront-banner-mobile-url" type="url" class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]" placeholder="https://.../banner-mobile.jpg" />
      </label>

      <label class="block sm:col-span-2">
        <span class="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-bip-muted">Texto alternativo (acessibilidade)</span>
        <input v-model="draft.hero_alt_text" data-cy="storefront-banner-alt" type="text" maxlength="160" class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]" placeholder="Descreva a imagem do banner" />
      </label>

      <label class="block">
        <span class="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-bip-muted">Titulo (opcional)</span>
        <input v-model="draft.hero_title" data-cy="storefront-banner-title" type="text" maxlength="120" class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]" />
      </label>

      <label class="block">
        <span class="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-bip-muted">Subtitulo (opcional)</span>
        <input v-model="draft.hero_subtitle" data-cy="storefront-banner-subtitle" type="text" maxlength="200" class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]" />
      </label>

      <label class="block">
        <span class="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-bip-muted">Texto do CTA (opcional)</span>
        <input v-model="draft.hero_cta_text" data-cy="storefront-banner-cta-text" type="text" maxlength="40" class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]" placeholder="Ex.: Ver colecao" />
      </label>

      <label class="block">
        <span class="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-bip-muted">Link do CTA (opcional)</span>
        <input v-model="draft.hero_cta_url" data-cy="storefront-banner-cta-url" type="url" class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]" />
      </label>

      <div v-if="draft.hero_image_desktop" class="overflow-hidden rounded-lg border border-[#E5E7EB] bg-zinc-50 sm:col-span-2">
        <img
          data-cy="storefront-banner-preview"
          :src="draft.hero_image_desktop"
          :alt="draft.hero_alt_text || 'Preview do banner desktop'"
          class="aspect-[16/7] w-full object-cover"
        />
      </div>
    </div>

    <p v-if="saveError" class="text-xs font-semibold text-[#D81B60]">{{ saveError }}</p>

    <button
      type="button"
      data-cy="btn-save-storefront-banner"
      :disabled="isSaving || !hasChanges"
      class="w-full rounded-lg bg-[#D81B60] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-[#D81B60]/90 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-bip-muted sm:w-auto"
      @click="handleSave"
    >
      {{ isSaving ? 'Salvando...' : 'Salvar alteracoes' }}
    </button>
  </section>
</template>
