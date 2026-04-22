<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'

const coverImage = defineModel<string | File | null>('coverImage', { default: null })
const galleryImages = defineModel<Array<string | File>>('galleryImages', { default: [] })

interface Props {
  error?: string;
}

defineProps<Props>()

const coverPreview = ref<string | null>(null)
const galleryPreviews = ref<string[]>([])

const previewUrls = new Set<string>()

function revokePreview(url: string | null): void {
  if (!url || !url.startsWith('blob:')) {
    return
  }

  URL.revokeObjectURL(url)
  previewUrls.delete(url)
}

function toPreview(entry: string | File): string {
  if (typeof entry === 'string') {
    return entry
  }

  const nextUrl = URL.createObjectURL(entry)
  previewUrls.add(nextUrl)
  return nextUrl
}

watch(coverImage, (newValue, previousValue) => {
  revokePreview(coverPreview.value)

  if (!newValue) {
    coverPreview.value = null
    return
  }

  coverPreview.value = typeof newValue === 'string' ? newValue : toPreview(newValue)

  if (typeof previousValue === 'string') {
    return
  }
}, { immediate: true })

watch(galleryImages, (newValue) => {
  galleryPreviews.value.forEach((url) => revokePreview(url))
  galleryPreviews.value = newValue.map((entry) => toPreview(entry))
}, { immediate: true, deep: true })

const allSlots = computed(() => {
  const slots: Array<{ key: string; label: string; preview: string | null; removable: boolean }> = [
    {
      key: 'cover',
      label: 'Imagem principal',
      preview: coverPreview.value,
      removable: Boolean(coverImage.value),
    },
  ]

  for (let index = 0; index < 2; index += 1) {
    slots.push({
      key: `gallery-${index}`,
      label: `Galeria ${index + 2}`,
      preview: galleryPreviews.value[index] || null,
      removable: Boolean(galleryImages.value[index]),
    })
  }

  return slots
})

function handleCoverChange(event: Event): void {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (!file) {
    return
  }

  coverImage.value = file
}

function handleGalleryChange(index: number, event: Event): void {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (!file) {
    return
  }

  const nextGallery = [...galleryImages.value]
  nextGallery[index] = file
  galleryImages.value = nextGallery.slice(0, 2)
}

function removeImage(slotKey: string): void {
  if (slotKey === 'cover') {
    coverImage.value = null
    return
  }

  const index = Number(slotKey.split('-')[1])
  const nextGallery = [...galleryImages.value]
  nextGallery.splice(index, 1)
  galleryImages.value = nextGallery
}

onUnmounted(() => {
  revokePreview(coverPreview.value)
  galleryPreviews.value.forEach((url) => revokePreview(url))
})
</script>

<template>
  <section class="space-y-6 pb-4">
    <header>
      <h3 class="text-[10px] font-black uppercase text-indigo-500 tracking-[0.3em] mb-1">
        Visual Asset
      </h3>
      <p class="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">
        Up to 3 product images for the public storefront
      </p>
    </header>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div
        v-for="slot in allSlots"
        :key="slot.key"
        class="relative group h-44 rounded-2xl border-2 border-dashed border-zinc-800 hover:border-indigo-500/50 transition-all flex items-center justify-center overflow-hidden bg-zinc-950 shadow-inner"
        :class="{ 'border-red-500/40 bg-red-500/5': error }"
      >
        <Transition name="fade">
          <img
            v-if="slot.preview"
            :src="slot.preview"
            class="absolute inset-0 h-full w-full object-cover opacity-65 group-hover:opacity-30 transition-opacity duration-500"
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
          class="absolute inset-0 h-full w-full opacity-0 cursor-pointer z-20"
          aria-label="Upload product cover image"
          @change="handleCoverChange"
        />

        <input
          v-else
          type="file"
          :name="`gallery-image-${slot.key}`"
          :data-cy="`input-product-image-${slot.key}`"
          accept="image/jpeg, image/png, image/webp"
          class="absolute inset-0 h-full w-full opacity-0 cursor-pointer z-20"
          :aria-label="`Upload ${slot.label}`"
          @change="handleGalleryChange(Number(slot.key.split('-')[1]), $event)"
        />

        <button
          v-if="slot.removable"
          type="button"
          class="absolute right-3 top-3 z-30 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white transition hover:bg-black"
          :aria-label="`Remover ${slot.label}`"
          @click.stop="removeImage(slot.key)"
        >
          ×
        </button>

        <div class="pointer-events-none z-10 flex flex-col items-center gap-3 text-center px-3">
          <div
            class="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-zinc-500 group-hover:text-indigo-400 group-hover:bg-indigo-500/10 transition-all duration-300"
            :class="{ 'text-indigo-400 bg-indigo-500/10': slot.preview }"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path v-if="!slot.preview" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </div>
          <div>
            <p class="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-300">
              {{ slot.label }}
            </p>
            <p class="mt-1 text-[9px] font-bold uppercase tracking-widest text-zinc-500">
              {{ slot.preview ? 'Replace image' : 'Upload image' }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <Transition name="slide-up">
      <p v-if="error" class="text-[9px] text-red-500 font-black uppercase tracking-widest text-center animate-pulse">
        {{ error }}
      </p>
    </Transition>
  </section>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.5s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

.slide-up-enter-active {
  transition: all 0.3s ease-out;
}
.slide-up-enter-from {
  transform: translateY(10px);
  opacity: 0;
}
</style>
