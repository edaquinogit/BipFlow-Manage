<template>
  <article
    class="group relative overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
    :class="{ 'opacity-75': !product.is_available }"
  >
    <div class="absolute inset-x-4 top-4 z-20 flex items-start justify-end">
      <span
        v-if="cartQuantity > 0"
        class="inline-flex items-center gap-1 rounded-full bg-slate-900/88 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white shadow-sm backdrop-blur"
      >
        <span class="h-1.5 w-1.5 rounded-full bg-rose-300" />
        {{ cartQuantity }}
      </span>
    </div>

    <button
      type="button"
      class="block w-full text-left"
      :aria-label="`Ver detalhes do produto ${product.name}`"
      @click="handleOpenDetails"
    >
      <div class="aspect-square overflow-hidden bg-slate-100">
        <img
          :src="imageSource"
          :alt="`Imagem do produto ${product.name}`"
          class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
          @error="handleImageError"
        />

        <div
          v-if="!product.is_available"
          class="absolute inset-0 flex items-center justify-center bg-slate-950/50"
        >
          <span class="rounded-full bg-rose-600 px-3 py-1 text-sm font-medium text-white">
            Fora de estoque
          </span>
        </div>
      </div>
    </button>

    <div class="p-4">
      <button
        type="button"
        class="w-full text-left"
        :aria-label="`Abrir detalhes de ${product.name}`"
        @click="handleOpenDetails"
      >
        <p v-if="product.category?.name" class="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
          {{ product.category.name }}
        </p>
        <h3 class="mt-2 line-clamp-2 text-base font-semibold leading-6 text-slate-900 transition-colors group-hover:text-rose-700">
          {{ product.name }}
        </h3>
      </button>

      <div class="mt-4 flex items-end justify-between gap-4">
        <div>
          <span class="block text-2xl font-semibold text-slate-900">
            {{ formatBRL(product.price) }}
          </span>
          <p class="mt-1 text-xs text-slate-500">
            {{ stockStatusLabel }}
          </p>
        </div>

        <button
          type="button"
          class="inline-flex items-center gap-1 text-sm font-semibold text-rose-700 transition hover:text-rose-800"
          :aria-label="`Ver descricao e detalhes de ${product.name}`"
          @click="handleOpenDetails"
        >
          Detalhes
          <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fill-rule="evenodd" d="M7.22 4.22a.75.75 0 011.06 0l5.25 5.25a.75.75 0 010 1.06l-5.25 5.25a.75.75 0 01-1.06-1.06L11.94 10 7.22 5.28a.75.75 0 010-1.06z" clip-rule="evenodd" />
          </svg>
        </button>
      </div>

      <div
        class="mt-4 rounded-[22px] border p-3 transition-colors"
        :class="product.is_available ? 'border-rose-100 bg-rose-50/70' : 'border-slate-200 bg-slate-50'"
      >
        <div class="flex items-center gap-3">
          <div class="min-w-0 flex-1">
            <div class="inline-flex items-center rounded-full border border-slate-200 bg-white p-1 shadow-sm">
              <button
                type="button"
                class="h-9 w-9 rounded-full text-lg font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                :disabled="!product.is_available || quantity <= 1"
                aria-label="Diminuir quantidade"
                @click.stop="decrementQuantity"
              >
                -
              </button>
              <span class="min-w-10 text-center text-sm font-semibold text-slate-900">
                {{ quantity }}
              </span>
              <button
                type="button"
                class="h-9 w-9 rounded-full text-lg font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                :disabled="!product.is_available || quantity >= product.stock_quantity"
                aria-label="Aumentar quantidade"
                @click.stop="incrementQuantity"
              >
                +
              </button>
            </div>
          </div>

          <button
            type="button"
            class="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full px-4 py-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-rose-200"
            :class="product.is_available
              ? 'bg-rose-600 text-white hover:bg-rose-700'
              : 'cursor-not-allowed bg-slate-200 text-slate-500'"
            :disabled="!product.is_available"
            @click.stop="handleAddToCart"
          >
            <svg
              class="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.9"
              aria-hidden="true"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 4h2l2.4 10.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 .98-.8L20 7H7" />
              <circle cx="10" cy="19" r="1.4" />
              <circle cx="17" cy="19" r="1.4" />
            </svg>
            <span class="sr-only">{{ addToCartLabel }}</span>
          </button>
        </div>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Product } from '@/types/product'
import { formatBRL } from '@/utils/formatters'

const props = withDefaults(defineProps<{
  product: Product
  cartQuantity?: number
}>(), {
  cartQuantity: 0,
})

const emit = defineEmits<{
  addToCart: [product: Product, quantity: number]
  openDetails: [product: Product]
}>()

const FALLBACK_IMAGE_URL = `data:image/svg+xml;utf8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 540">
    <rect width="540" height="540" fill="#f3f4f6" />
    <rect x="70" y="70" width="400" height="400" rx="32" fill="#e5e7eb" />
    <circle cx="200" cy="210" r="42" fill="#cbd5e1" />
    <path d="M130 385l92-98c10-11 28-11 38 0l49 52 34-37c11-12 29-12 40 0l57 61v44H130z" fill="#94a3b8" />
    <text x="270" y="455" text-anchor="middle" fill="#6b7280" font-family="Arial, sans-serif" font-size="28" font-weight="700">
      Imagem indisponivel
    </text>
  </svg>
`)}`

const quantity = ref(1)

watch(
  () => props.product.id,
  () => {
    quantity.value = 1
  }
)

watch(
  () => props.product.stock_quantity,
  (nextStock) => {
    quantity.value = Math.min(quantity.value, Math.max(nextStock, 1))
  }
)

const imageSource = computed(() => props.product.image || FALLBACK_IMAGE_URL)

const stockStatusLabel = computed(() => {
  if (!props.product.is_available) {
    return 'Indisponivel'
  }

  if (props.product.stock_quantity <= 5) {
    return `${props.product.stock_quantity} restantes`
  }

  return 'Disponivel'
})

const addToCartLabel = computed(() => {
  if (!props.product.is_available) {
    return 'Indisponivel'
  }

  if (quantity.value > 1) {
    return `Adicionar ${quantity.value}`
  }

  return 'Adicionar ao carrinho'
})

const handleImageError = (event: Event) => {
  const img = event.target as HTMLImageElement
  if (img.src !== FALLBACK_IMAGE_URL) {
    img.src = FALLBACK_IMAGE_URL
  }
}

const incrementQuantity = () => {
  quantity.value = Math.min(quantity.value + 1, props.product.stock_quantity)
}

const decrementQuantity = () => {
  quantity.value = Math.max(quantity.value - 1, 1)
}

const handleAddToCart = () => {
  if (!props.product.is_available) {
    return
  }

  emit('addToCart', props.product, quantity.value)
  quantity.value = 1
}

const handleOpenDetails = () => {
  emit('openDetails', props.product)
}
</script>
