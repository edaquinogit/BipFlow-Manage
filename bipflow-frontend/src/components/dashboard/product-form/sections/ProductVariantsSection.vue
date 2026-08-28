<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import { PhotoIcon, PlusIcon, TrashIcon, XMarkIcon } from '@heroicons/vue/24/outline';
import type { ProductFormData } from '@/schemas/product.schema';
import { compressImageFile } from '@/utils/image';

type ProductVariantForm = ProductFormData['variants'][number];

const variants = defineModel<ProductFormData['variants']>('variants', { default: [] });

interface Props {
  error?: string;
}

defineProps<Props>();

const previewUrls = new Set<string>();
const previews = ref<string[]>([]);
const compressingIndexes = ref<Set<number>>(new Set());
const imageError = ref<string | null>(null);

const hasVariants = computed(() => variants.value.length > 0);

function normalizeVariantStock(value: unknown): number {
  const numericValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numericValue) ? Math.max(0, Math.trunc(numericValue)) : 0;
}

function revokePreview(url: string | null | undefined): void {
  if (!url || !url.startsWith('blob:')) {
    return;
  }

  URL.revokeObjectURL(url);
  previewUrls.delete(url);
}

function toPreview(entry: ProductVariantForm['image']): string {
  if (typeof entry === 'string') {
    return entry;
  }

  if (entry instanceof File) {
    const nextUrl = URL.createObjectURL(entry);
    previewUrls.add(nextUrl);
    return nextUrl;
  }

  return '';
}

function withPositions(nextVariants: ProductFormData['variants']): ProductFormData['variants'] {
  return nextVariants.map((variant, index) => ({
    ...variant,
    position: index,
  }));
}

function setVariants(nextVariants: ProductFormData['variants']): void {
  variants.value = withPositions(nextVariants);
}

function updateVariant(index: number, patch: Partial<ProductVariantForm>): void {
  const nextVariants = [...variants.value];
  const currentVariant = nextVariants[index];

  if (!currentVariant) {
    return;
  }

  nextVariants[index] = {
    ...currentVariant,
    ...patch,
  };
  setVariants(nextVariants);
}

function addVariant(): void {
  setVariants([
    ...variants.value,
    {
      name: '',
      color_hex: '#111827',
      stock_quantity: 0,
      image: null,
      is_active: true,
      position: variants.value.length,
    },
  ]);
}

function removeVariant(index: number): void {
  const nextVariants = [...variants.value];
  nextVariants.splice(index, 1);
  setVariants(nextVariants);
}

async function handleImageChange(index: number, event: Event): Promise<void> {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];

  if (!file) {
    return;
  }

  target.value = '';
  imageError.value = null;
  compressingIndexes.value = new Set(compressingIndexes.value).add(index);

  try {
    updateVariant(index, { image: await compressImageFile(file) });
  } catch (error) {
    imageError.value = error instanceof Error ? error.message : 'Falha ao processar a imagem.';
  } finally {
    const nextIndexes = new Set(compressingIndexes.value);
    nextIndexes.delete(index);
    compressingIndexes.value = nextIndexes;
  }
}

function removeVariantImage(index: number): void {
  updateVariant(index, { image: null });
}

watch(variants, (nextVariants) => {
  previews.value.forEach((url) => revokePreview(url));
  previews.value = nextVariants.map((variant) => toPreview(variant.image));
}, { immediate: true, deep: true });

onUnmounted(() => {
  previews.value.forEach((url) => revokePreview(url));
});
</script>

<template>
  <section class="space-y-6 pb-4">
    <header class="flex items-start justify-between gap-4">
      <div>
        <h3 class="mb-1 text-[10px] font-black uppercase tracking-[0.3em] text-[#111827]">
          Variantes de cor
        </h3>
        <p class="text-[9px] font-bold uppercase tracking-widest text-bip-muted">
          Nome, cor e imagem propria por opcao
        </p>
      </div>

      <button
        type="button"
        class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#05050A] transition hover:border-[#111827] hover:text-[#111827]"
        aria-label="Adicionar variante de cor"
        title="Adicionar variante"
        @click="addVariant"
      >
        <PlusIcon class="h-5 w-5" aria-hidden="true" />
      </button>
    </header>

    <div v-if="hasVariants" class="space-y-3">
      <div
        v-for="(variant, index) in variants"
        :key="variant.id ?? `new-${index}`"
        class="grid gap-3 rounded-xl border border-[#E5E7EB] bg-white p-3 sm:grid-cols-[4.5rem_minmax(0,1fr)_auto] sm:items-center"
      >
        <div class="relative h-[4.5rem] w-[4.5rem] overflow-hidden rounded-xl border border-dashed border-[#D1D5DB] bg-zinc-50">
          <img
            v-if="previews[index]"
            :src="previews[index]"
            :alt="`Imagem da variante ${variant.name || index + 1}`"
            class="h-full w-full object-cover"
          />
          <div v-else class="flex h-full w-full items-center justify-center text-bip-muted">
            <PhotoIcon class="h-6 w-6" aria-hidden="true" />
          </div>

          <input
            type="file"
            accept="image/jpeg, image/png, image/webp"
            class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            :aria-label="`Enviar imagem da variante ${variant.name || index + 1}`"
            @change="handleImageChange(index, $event)"
          />

          <button
            v-if="variant.image"
            type="button"
            class="absolute right-1 top-1 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white transition hover:bg-black"
            :aria-label="`Remover imagem da variante ${variant.name || index + 1}`"
            @click.stop="removeVariantImage(index)"
          >
            <XMarkIcon class="h-4 w-4" aria-hidden="true" />
          </button>

          <div
            v-if="compressingIndexes.has(index)"
            class="absolute inset-0 flex items-center justify-center bg-black/40 text-[9px] font-black uppercase tracking-widest text-white"
          >
            Processando
          </div>
        </div>

        <div class="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_5.5rem_6rem] sm:items-end">
          <label class="block min-w-0">
            <span class="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-bip-muted">
              Nome da cor
            </span>
            <input
              :value="variant.name"
              type="text"
              maxlength="80"
              class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#111827] focus:ring-2 focus:ring-[#F3F4F6]"
              placeholder="Preto, azul..."
              @input="updateVariant(index, { name: ($event.target as HTMLInputElement).value })"
            />
          </label>

          <label class="block">
            <span class="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-bip-muted">
              Qtd.
            </span>
            <input
              :value="variant.stock_quantity"
              type="number"
              min="0"
              step="1"
              class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#111827] focus:ring-2 focus:ring-[#F3F4F6]"
              :aria-label="`Quantidade em estoque da variante ${variant.name || index + 1}`"
              @input="updateVariant(index, { stock_quantity: normalizeVariantStock(($event.target as HTMLInputElement).value) })"
            />
          </label>

          <label class="block">
            <span class="mb-1.5 block text-[9px] font-black uppercase tracking-widest text-bip-muted">
              Cor
            </span>
            <input
              :value="variant.color_hex || '#111827'"
              type="color"
              class="h-11 w-full cursor-pointer rounded-lg border border-[#D1D5DB] bg-white p-1"
              :aria-label="`Selecionar cor da variante ${variant.name || index + 1}`"
              @input="updateVariant(index, { color_hex: ($event.target as HTMLInputElement).value })"
            />
          </label>

          <label class="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#4B5563] sm:col-span-3">
            <input
              :checked="variant.is_active"
              type="checkbox"
              class="h-4 w-4 rounded border-[#D1D5DB] text-[#111827] focus:ring-[#F3F4F6]"
              @change="updateVariant(index, { is_active: ($event.target as HTMLInputElement).checked })"
            />
            Ativa na vitrine
          </label>
        </div>

        <button
          type="button"
          class="inline-flex h-11 w-11 items-center justify-center rounded-xl text-[#9CA3AF] transition hover:bg-red-50 hover:text-red-600"
          :aria-label="`Remover variante ${variant.name || index + 1}`"
          title="Remover variante"
          @click="removeVariant(index)"
        >
          <TrashIcon class="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </div>

    <button
      v-else
      type="button"
      class="flex min-h-20 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#D1D5DB] bg-zinc-50 px-4 text-sm font-semibold text-bip-muted transition hover:border-[#111827] hover:text-[#111827]"
      @click="addVariant"
    >
      <PlusIcon class="h-5 w-5" aria-hidden="true" />
      Adicionar primeira cor
    </button>

    <Transition name="slide-up">
      <p v-if="error || imageError" class="text-center text-[9px] font-black uppercase tracking-widest text-[#111827]">
        {{ imageError || error }}
      </p>
    </Transition>
  </section>
</template>

<style scoped>
.slide-up-enter-active {
  transition: all 0.3s ease-out;
}

.slide-up-enter-from {
  opacity: 0;
  transform: translateY(10px);
}
</style>
