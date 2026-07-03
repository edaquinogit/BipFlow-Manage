<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import { compressImageFile } from '@/utils/image';

const coverImage = defineModel<string | File | null>('coverImage', { default: null });
const galleryImages = defineModel<Array<string | File>>('galleryImages', { default: [] });

interface Props {
  error?: string;
}

defineProps<Props>();

const coverPreview = ref<string | null>(null);
const galleryPreviews = ref<string[]>([]);
const previewUrls = new Set<string>();
const isCompressingCover = ref(false);
const isCompressingGallery = ref<boolean[]>([false, false]);
const imageError = ref<string | null>(null);

function revokePreview(url: string | null): void {
  if (!url || !url.startsWith('blob:')) {
    return;
  }

  URL.revokeObjectURL(url);
  previewUrls.delete(url);
}

function toPreview(entry: string | File): string {
  if (typeof entry === 'string') {
    return entry;
  }

  const nextUrl = URL.createObjectURL(entry);
  previewUrls.add(nextUrl);
  return nextUrl;
}

watch(coverImage, (newValue) => {
  revokePreview(coverPreview.value);

  if (!newValue) {
    coverPreview.value = null;
    return;
  }

  coverPreview.value = typeof newValue === 'string' ? newValue : toPreview(newValue);
}, { immediate: true });

watch(galleryImages, (newValue) => {
  galleryPreviews.value.forEach((url) => revokePreview(url));
  galleryPreviews.value = newValue.map((entry) => toPreview(entry));
}, { immediate: true, deep: true });

const allSlots = computed(() => {
  const slots: Array<{ key: string; label: string; preview: string | null; removable: boolean; isLoading: boolean }> = [
    {
      key: 'cover',
      label: 'Imagem principal',
      preview: coverPreview.value,
      removable: Boolean(coverImage.value),
      isLoading: isCompressingCover.value,
    },
  ];

  for (let index = 0; index < 2; index += 1) {
    slots.push({
      key: `gallery-${index}`,
      label: `Galeria ${index + 2}`,
      preview: galleryPreviews.value[index] || null,
      removable: Boolean(galleryImages.value[index]),
      isLoading: isCompressingGallery.value[index] || false,
    });
  }

  return slots;
});

async function handleCoverChange(event: Event): Promise<void> {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];

  if (!file) {
    return;
  }

  target.value = '';
  isCompressingCover.value = true;
  imageError.value = null;

  try {
    coverImage.value = await compressImageFile(file);
  } catch (error) {
    imageError.value = error instanceof Error ? error.message : 'Falha ao processar a imagem.';
    coverImage.value = null;
  } finally {
    isCompressingCover.value = false;
  }
}

async function handleGalleryChange(index: number, event: Event): Promise<void> {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];

  if (!file) {
    return;
  }

  target.value = '';
  const nextGallery = [...galleryImages.value];
  let compressedImage: string | File | null = null;

  isCompressingGallery.value[index] = true;
  imageError.value = null;

  try {
    compressedImage = await compressImageFile(file);
    nextGallery[index] = compressedImage;
  } catch (error) {
    imageError.value = error instanceof Error ? error.message : 'Falha ao processar a imagem.';
    nextGallery.splice(index, 1);
  } finally {
    isCompressingGallery.value[index] = false;
  }

  galleryImages.value = nextGallery.filter((entry): entry is string | File => Boolean(entry)).slice(0, 2);
}

function removeImage(slotKey: string): void {
  if (slotKey === 'cover') {
    coverImage.value = null;
    return;
  }

  const index = Number(slotKey.split('-')[1]);
  const nextGallery = [...galleryImages.value];
  nextGallery.splice(index, 1);
  galleryImages.value = nextGallery;
}

onUnmounted(() => {
  revokePreview(coverPreview.value);
  galleryPreviews.value.forEach((url) => revokePreview(url));
});
</script>

<template>
  <section class="space-y-6 pb-4">
    <header>
      <h3 class="mb-1 text-[10px] font-black uppercase tracking-[0.3em] text-[#D81B60]">
        Imagens da vitrine
      </h3>
      <p class="text-[9px] font-bold uppercase tracking-widest text-bip-muted">
        Até 3 imagens do produto no catálogo
      </p>
    </header>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div
        v-for="slot in allSlots"
        :key="slot.key"
        class="group relative flex h-44 items-center justify-center overflow-hidden rounded-xl border border-dashed border-[#D1D5DB] bg-zinc-50 transition-all hover:border-[#D81B60]/50"
        :class="{ 'border-[#D81B60]/40 bg-[#FCE7F3]': error }"
      >
        <Transition name="fade">
          <img
            v-if="slot.preview"
            :src="slot.preview"
            class="absolute inset-0 h-full w-full object-cover opacity-65 transition-opacity duration-500 group-hover:opacity-30"
            :data-cy="`product-image-preview-${slot.key}`"
            :alt="slot.label"
          />
        </Transition>

        <input
          v-if="slot.key === 'cover'"
          type="file"
          name="image"
          data-cy="input-product-image-cover"
          accept="image/jpeg, image/png, image/webp"
          class="absolute inset-0 z-20 h-full w-full cursor-pointer opacity-0"
          aria-label="Enviar imagem principal do produto"
          @change="handleCoverChange"
        />

        <input
          v-else
          type="file"
          :name="`gallery-image-${slot.key}`"
          :data-cy="`input-product-image-${slot.key}`"
          accept="image/jpeg, image/png, image/webp"
          class="absolute inset-0 z-20 h-full w-full cursor-pointer opacity-0"
          :aria-label="`Enviar ${slot.label}`"
          @change="handleGalleryChange(Number(slot.key.split('-')[1]), $event)"
        />

        <button
          v-if="slot.removable"
          type="button"
          class="absolute right-3 top-3 z-30 inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/70 text-white transition hover:bg-black"
          :aria-label="`Remover ${slot.label}`"
          @click.stop="removeImage(slot.key)"
        >
          X
        </button>

        <div
          v-if="slot.isLoading"
          class="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-black/30 text-[10px] font-black uppercase tracking-[0.3em] text-white"
        >
          Processando imagem...
        </div>

        <div class="pointer-events-none z-10 flex flex-col items-center gap-3 px-3 text-center">
          <div
            class="flex h-10 w-10 items-center justify-center rounded-full bg-white text-bip-muted transition-all duration-300 group-hover:bg-[#FCE7F3] group-hover:text-[#D81B60]"
            :class="{ 'bg-[#FCE7F3] text-[#D81B60]': slot.preview }"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path v-if="!slot.preview" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </div>
          <div>
            <p class="text-[10px] font-black uppercase tracking-[0.2em] text-[#05050A]">
              {{ slot.label }}
            </p>
            <p class="mt-1 text-[9px] font-bold uppercase tracking-widest text-bip-muted">
              {{ slot.preview ? 'Trocar imagem' : 'Enviar imagem' }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <Transition name="slide-up">
      <p v-if="error || imageError" class="text-center text-[9px] font-black uppercase tracking-widest text-[#D81B60]">
        {{ imageError || error }}
      </p>
    </Transition>
  </section>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-up-enter-active {
  transition: all 0.3s ease-out;
}

.slide-up-enter-from {
  opacity: 0;
  transform: translateY(10px);
}
</style>
