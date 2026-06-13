<template>
  <article
    class="group relative flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-[0_14px_35px_-28px_rgba(5,5,10,0.55)] transition hover:-translate-y-0.5 hover:border-[#D81B60]/40"
    :class="{ 'opacity-75': !product.is_available }"
  >
    <button
      type="button"
      class="block w-full text-left"
      :aria-label="`Ver detalhes do produto ${product.name}`"
      @click="handleOpenDetails"
    >
      <div class="relative aspect-[4/5] overflow-hidden bg-[#F4F1F3]">
        <div class="absolute inset-x-3 top-3 z-20 flex items-start justify-between gap-2">
          <span
            v-if="product.category?.name"
            class="max-w-[70%] truncate rounded-full bg-white/[0.92] px-3 py-1 text-[11px] font-semibold text-[#05050A] backdrop-blur"
          >
            {{ product.category.name }}
          </span>
          <span
            v-if="cartQuantity > 0"
            class="ml-auto inline-flex min-h-7 shrink-0 items-center justify-center rounded-full bg-[#D81B60] px-3 text-[11px] font-semibold text-white"
          >
            {{ cartQuantity }} no pedido
          </span>
        </div>

        <img
          :src="imageSource"
          :alt="`Imagem do produto ${product.name}`"
          class="h-full w-full transition-transform duration-500 group-hover:scale-[1.03]"
          :class="hasProductImage ? 'object-cover' : 'object-contain p-6'"
          loading="lazy"
          @error="handleImageError"
        />

        <div
          v-if="!product.is_available"
          class="absolute inset-0 flex items-center justify-center bg-slate-950/50"
        >
          <span class="rounded-full bg-red-600 px-3 py-1 text-sm font-medium text-white">
            Fora de estoque
          </span>
        </div>
      </div>
    </button>

    <div class="flex flex-1 flex-col p-3 sm:p-4">
      <button
        type="button"
        class="w-full text-left"
        :aria-label="`Abrir detalhes de ${product.name}`"
        @click="handleOpenDetails"
      >
        <h3 class="line-clamp-2 min-h-11 text-sm font-semibold leading-5 text-[#05050A] transition-colors group-hover:text-[#D81B60] sm:text-base sm:leading-6">
          {{ product.name }}
        </h3>
      </button>

      <div class="mt-3 flex items-end justify-between gap-3">
        <div>
          <span class="block text-lg font-semibold text-[#05050A] sm:text-xl">
            {{ formatBRL(product.price) }}
          </span>
          <p class="mt-1 text-xs text-slate-500">
            {{ stockStatusLabel }}
          </p>
        </div>

        <button
          type="button"
          class="inline-flex items-center gap-1 text-xs font-semibold text-[#6B7280] transition hover:text-[#D81B60] sm:text-sm"
          :aria-label="`Ver descricao e detalhes de ${product.name}`"
          @click="handleOpenDetails"
        >
          Detalhes
          <ArrowRightIcon class="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div class="mt-auto pt-4">
        <div class="grid grid-cols-[auto,minmax(0,1fr)] items-center gap-2">
          <div class="min-w-0">
            <div class="inline-flex h-10 items-center rounded-lg border border-[#D1D5DB] bg-white">
              <button
                type="button"
                class="inline-flex h-9 w-9 items-center justify-center text-[#6B7280] transition hover:bg-[#FAFAFA] disabled:cursor-not-allowed disabled:opacity-40"
                :disabled="!product.is_available || quantity <= 1"
                aria-label="Diminuir quantidade"
                @click.stop="decrementQuantity"
              >
                <MinusIcon class="h-4 w-4" aria-hidden="true" />
              </button>
              <span class="min-w-9 text-center text-sm font-semibold text-[#05050A]">
                {{ quantity }}
              </span>
              <button
                type="button"
                class="inline-flex h-9 w-9 items-center justify-center text-[#6B7280] transition hover:bg-[#FAFAFA] disabled:cursor-not-allowed disabled:opacity-40"
                :disabled="!product.is_available || quantity >= product.stock_quantity"
                aria-label="Aumentar quantidade"
                @click.stop="incrementQuantity"
              >
                <PlusIcon class="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <button
            type="button"
            class="inline-flex h-10 min-w-0 shrink-0 items-center justify-center gap-2 rounded-lg px-3 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#FCE7F3] sm:text-sm"
            :class="product.is_available
              ? 'bg-[#05050A] text-white hover:bg-[#D81B60]'
              : 'cursor-not-allowed bg-slate-200 text-slate-500'"
            :disabled="!product.is_available"
            @click.stop="handleAddToCart"
          >
            <ShoppingBagIcon class="h-4 w-4" aria-hidden="true" />
            <span class="hidden min-[390px]:inline">{{ addToCartLabel }}</span>
            <span class="min-[390px]:hidden">Adicionar</span>
          </button>
        </div>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  ArrowRightIcon,
  MinusIcon,
  PlusIcon,
  ShoppingBagIcon,
} from '@heroicons/vue/24/outline'
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
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 800">
    <rect width="640" height="800" fill="#FAFAFA"/>
    <rect x="96" y="128" width="448" height="544" rx="36" fill="#FFFFFF" stroke="#E5E7EB" stroke-width="2"/>
    <path d="M222 330h196c18 0 32 14 32 32v118c0 18-14 32-32 32H222c-18 0-32-14-32-32V362c0-18 14-32 32-32z" fill="#F4F1F3"/>
    <path d="M236 462l52-54c10-10 26-10 36 0l34 35 18-19c10-11 28-11 38 0l58 60v28H236z" fill="#E9A8C0"/>
    <circle cx="276" cy="382" r="22" fill="#D81B60" opacity=".22"/>
    <text x="320" y="592" text-anchor="middle" fill="#6B7280" font-family="Arial, sans-serif" font-size="26" font-weight="700">Imagem em breve</text>
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

const hasProductImage = computed(() => Boolean(props.product.image))

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

  return 'Adicionar ao pedido'
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
