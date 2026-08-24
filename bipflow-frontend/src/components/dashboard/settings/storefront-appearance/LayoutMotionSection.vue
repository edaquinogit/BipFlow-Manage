<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useToast } from '@/composables/useToast';
import { Logger } from '@/services/logger';
import { buildErrorContext, type ApplicationError } from '@/types/errors';
import type {
  CardStyle,
  DecorationStyle,
  LayoutDensity,
  MotionIntensity,
  RadiusStyle,
  StorefrontAppearance,
  StorefrontAppearancePayload,
} from '@/types/store';

/**
 * Estilo do layout, animacoes e formas geometricas -- sempre presets
 * fechados (nunca CSS/valores livres), conforme o principio central da
 * personalizacao controlada.
 */
const props = defineProps<{
  appearance: StorefrontAppearance | null;
  save: (payload: StorefrontAppearancePayload) => Promise<StorefrontAppearance>;
}>();

type LayoutMotionDraft = Pick<
  StorefrontAppearance,
  | 'card_style'
  | 'radius_style'
  | 'density'
  | 'motion_enabled'
  | 'motion_intensity'
  | 'decoration_enabled'
  | 'decoration_style'
>;

const CARD_STYLE_OPTIONS: { value: CardStyle; label: string }[] = [
  { value: 'clean', label: 'Clean' },
  { value: 'bordered', label: 'Com borda' },
  { value: 'elevated', label: 'Elevado' },
];

const RADIUS_STYLE_OPTIONS: { value: RadiusStyle; label: string }[] = [
  { value: 'minimal', label: 'Minimo' },
  { value: 'rounded', label: 'Arredondado' },
  { value: 'soft', label: 'Suave' },
];

const DENSITY_OPTIONS: { value: LayoutDensity; label: string }[] = [
  { value: 'compact', label: 'Compacto' },
  { value: 'comfortable', label: 'Confortavel' },
];

const MOTION_INTENSITY_OPTIONS: { value: MotionIntensity; label: string }[] = [
  { value: 'subtle', label: 'Sutil' },
  { value: 'standard', label: 'Padrao' },
];

const DECORATION_STYLE_OPTIONS: { value: DecorationStyle; label: string }[] = [
  { value: 'none', label: 'Nenhuma' },
  { value: 'circles', label: 'Circulos' },
  { value: 'soft-shapes', label: 'Formas suaves' },
  { value: 'geometric', label: 'Geometrico' },
];

const { success, error: toastError } = useToast();
const isSaving = ref(false);
const saveError = ref<string | null>(null);

function buildDraft(appearance: StorefrontAppearance | null): LayoutMotionDraft {
  return {
    card_style: appearance?.card_style ?? 'clean',
    radius_style: appearance?.radius_style ?? 'rounded',
    density: appearance?.density ?? 'comfortable',
    motion_enabled: appearance?.motion_enabled ?? true,
    motion_intensity: appearance?.motion_intensity ?? 'standard',
    decoration_enabled: appearance?.decoration_enabled ?? false,
    decoration_style: appearance?.decoration_style ?? 'none',
  };
}

function areDraftsEqual(left: LayoutMotionDraft, right: LayoutMotionDraft): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

const draft = ref<LayoutMotionDraft>(buildDraft(props.appearance));
const savedDraft = ref<LayoutMotionDraft>(buildDraft(props.appearance));
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
    Logger.error('Storefront layout/motion save failed', buildErrorContext(error as ApplicationError, {}));
    saveError.value = 'Nao foi possivel salvar o estilo e as animacoes. Tente novamente.';
    toastError('Nao foi possivel salvar o estilo e as animacoes.');
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <section data-cy="storefront-layout-motion-section" class="max-w-2xl space-y-6">
    <div class="rounded-lg border border-[#E5E7EB] bg-white p-4">
      <h3 class="text-[10px] font-black uppercase tracking-widest text-bip-muted">Estilo do layout</h3>

      <div class="mt-4 grid gap-4 sm:grid-cols-3">
        <label class="block">
          <span class="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-bip-muted">Cards</span>
          <select v-model="draft.card_style" data-cy="storefront-card-style-select" class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]">
            <option v-for="option in CARD_STYLE_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </label>

        <label class="block">
          <span class="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-bip-muted">Bordas</span>
          <select v-model="draft.radius_style" data-cy="storefront-radius-style-select" class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]">
            <option v-for="option in RADIUS_STYLE_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </label>

        <label class="block">
          <span class="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-bip-muted">Densidade</span>
          <select v-model="draft.density" data-cy="storefront-density-select" class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]">
            <option v-for="option in DENSITY_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </label>
      </div>
    </div>

    <div class="rounded-lg border border-[#E5E7EB] bg-white p-4">
      <h3 class="text-[10px] font-black uppercase tracking-widest text-bip-muted">Animacoes</h3>

      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        <label class="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#4B5563]">
          <input v-model="draft.motion_enabled" data-cy="storefront-motion-enabled" type="checkbox" class="h-4 w-4 rounded border-[#D1D5DB] text-[#D81B60] focus:ring-[#FCE7F3]" />
          Ativar animacoes
        </label>

        <label class="block">
          <span class="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-bip-muted">Intensidade</span>
          <select v-model="draft.motion_intensity" data-cy="storefront-motion-intensity-select" :disabled="!draft.motion_enabled" class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3] disabled:bg-zinc-100">
            <option v-for="option in MOTION_INTENSITY_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </label>
      </div>

      <p class="mt-3 text-[11px] leading-5 text-bip-muted">
        `prefers-reduced-motion` do visitante e' sempre respeitado, mesmo com animacoes ativadas.
      </p>
    </div>

    <div class="rounded-lg border border-[#E5E7EB] bg-white p-4">
      <h3 class="text-[10px] font-black uppercase tracking-widest text-bip-muted">Formas geometricas</h3>

      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        <label class="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#4B5563]">
          <input v-model="draft.decoration_enabled" data-cy="storefront-decoration-enabled" type="checkbox" class="h-4 w-4 rounded border-[#D1D5DB] text-[#D81B60] focus:ring-[#FCE7F3]" />
          Ativar decoracoes
        </label>

        <label class="block">
          <span class="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-bip-muted">Estilo</span>
          <select v-model="draft.decoration_style" data-cy="storefront-decoration-style-select" :disabled="!draft.decoration_enabled" class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3] disabled:bg-zinc-100">
            <option v-for="option in DECORATION_STYLE_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </label>
      </div>
    </div>

    <p v-if="saveError" class="text-xs font-semibold text-[#D81B60]">{{ saveError }}</p>

    <button
      type="button"
      data-cy="btn-save-storefront-layout"
      :disabled="isSaving || !hasChanges"
      class="w-full rounded-lg bg-[#D81B60] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-[#D81B60]/90 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-bip-muted sm:w-auto"
      @click="handleSave"
    >
      {{ isSaving ? 'Salvando...' : 'Salvar alteracoes' }}
    </button>
  </section>
</template>
