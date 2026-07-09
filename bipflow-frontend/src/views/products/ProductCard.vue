<template>
  <article
    class="group relative flex h-full min-w-0 flex-col overflow-hidden rounded-[1.15rem] border border-[#E9D7DF] bg-[linear-gradient(180deg,#FFFFFF_0%,#FFF9FB_100%)] shadow-[0_18px_40px_-30px_rgba(5,5,10,0.6)] transition duration-300 hover:-translate-y-1 hover:border-[#D81B60]/45 hover:shadow-[0_24px_60px_-34px_rgba(216,27,96,0.32)] min-[390px]:rounded-2xl"
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

    <div class="flex flex-1 flex-col p-3.5 min-[390px]:p-4 sm:p-5">
      <button
        type="button"
        class="w-full text-left"
        :aria-label="`Abrir detalhes de ${product.name}`"
        @click="handleOpenDetails"
      >
        <h3 class="line-clamp-2 min-h-[2.85rem] text-[13px] font-semibold leading-[1.32] text-[#05050A] transition-colors group-hover:text-[#D81B60] min-[390px]:min-h-[3.05rem] min-[390px]:text-[14px] min-[390px]:leading-[1.35] sm:min-h-[2.9rem] sm:text-[15px] sm:leading-[1.45] lg:min-h-[3rem] lg:text-base lg:leading-[1.5]">
          {{ product.name }}
        </h3>
      </button>

      <div class="mt-3.5 flex items-end justify-between gap-2.5 min-[390px]:mt-4 min-[390px]:gap-3">
        <div>
          <span class="block text-[1.12rem] font-semibold tracking-[-0.015em] text-[#05050A] min-[390px]:text-[1.22rem] sm:text-[1.36rem] lg:text-[1.28rem] xl:text-[1.34rem]">
            {{ formatBRL(product.price) }}
          </span>
          <p class="mt-1 text-[12px] text-slate-500 min-[390px]:text-sm">
            {{ stockStatusLabel }}
          </p>
        </div>

        <button
          type="button"
          class="inline-flex items-center gap-1.5 whitespace-nowrap text-[10px] font-semibold uppercase leading-[1.15] tracking-[0.12em] text-[#6B7280] transition hover:text-[#D81B60] sm:text-[11px]"
          :aria-label="`Ver descricao e detalhes de ${product.name}`"
          @click="handleOpenDetails"
        >
          Detalhes
          <ArrowRightIcon class="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div class="mt-auto pt-3.5 min-[390px]:pt-4">
        <div class="grid grid-cols-[auto,minmax(0,1fr)] items-center gap-1.5 min-[390px]:gap-2">
          <div class="min-w-0">
            <div class="inline-flex h-11 items-center rounded-[0.95rem] border border-[#D8DDE5] bg-white/95 shadow-[0_10px_24px_-22px_rgba(5,5,10,0.55)] min-[390px]:h-12 min-[390px]:rounded-xl">
              <button
                type="button"
                class="inline-flex h-11 w-10 items-center justify-center rounded-l-[0.95rem] text-[#6B7280] transition hover:bg-[#FAFAFA] disabled:cursor-not-allowed disabled:opacity-40 min-[390px]:h-12 min-[390px]:w-11 min-[390px]:rounded-l-xl"
                :disabled="!product.is_available || quantity <= 1"
                aria-label="Diminuir quantidade"
                @click.stop="decrementQuantity"
              >
                <MinusIcon class="h-4 w-4" aria-hidden="true" />
              </button>
              <span class="min-w-8 text-center text-[15px] font-semibold text-[#05050A] min-[390px]:min-w-10 min-[390px]:text-base">
                {{ quantity }}
              </span>
              <button
                type="button"
                class="inline-flex h-11 w-10 items-center justify-center rounded-r-[0.95rem] text-[#6B7280] transition hover:bg-[#FAFAFA] disabled:cursor-not-allowed disabled:opacity-40 min-[390px]:h-12 min-[390px]:w-11 min-[390px]:rounded-r-xl"
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
            data-cy="add-to-cart-button"
            class="inline-flex h-11 min-w-0 max-w-full shrink-0 items-center justify-center gap-1 overflow-hidden rounded-[0.95rem] px-2 text-[8px] font-bold uppercase leading-none tracking-[0.04em] shadow-[0_14px_30px_-22px_rgba(5,5,10,0.7)] transition duration-200 focus:outline-none focus:ring-2 focus:ring-[#FCE7F3] min-[390px]:h-12 min-[390px]:gap-1.5 min-[390px]:rounded-xl min-[390px]:px-2.5 min-[390px]:text-[8px] min-[390px]:tracking-[0.05em] min-[480px]:gap-2 min-[480px]:px-3 min-[480px]:text-[9px] min-[480px]:tracking-[0.08em] sm:px-4 sm:text-[11px] sm:tracking-[0.1em]"
            :class="product.is_available
              ? 'bg-[#05050A] text-white hover:-translate-y-0.5 hover:bg-[#D81B60] hover:shadow-[0_18px_36px_-24px_rgba(216,27,96,0.65)]'
              : 'cursor-not-allowed bg-slate-200 text-slate-500'"
            :disabled="!product.is_available"
            @click.stop="handleAddToCart"
          >
            <ShoppingBagIcon class="h-3.5 w-3.5 shrink-0 min-[390px]:h-4 min-[390px]:w-4 min-[480px]:h-4.5 min-[480px]:w-4.5" aria-hidden="true" />
            <span class="hidden truncate whitespace-nowrap sm:inline">{{ addToCartLabel }}</span>
            <span class="hidden truncate whitespace-nowrap min-[390px]:inline sm:hidden">{{ mediumAddToCartLabel }}</span>
            <span class="truncate whitespace-nowrap min-[390px]:hidden">{{ compactAddToCartLabel }}</span>
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
import { isLowStock } from '@/utils/stockAlerts'

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

  if (isLowStock(props.product)) {
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

const mediumAddToCartLabel = computed(() => {
  if (!props.product.is_available) {
    return 'Indisp.'
  }

  if (quantity.value > 1) {
    return `+${quantity.value}`
  }

  return 'Carrinho'
})

const compactAddToCartLabel = computed(() => {
  if (!props.product.is_available) {
    return 'Indisp.'
  }

  if (quantity.value > 1) {
    return `+${quantity.value}`
  }

  return 'Comprar'
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
