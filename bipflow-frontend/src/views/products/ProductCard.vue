<template>
  <article
    class="group relative overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
    :class="{ 'opacity-75': !product.is_available }"
  >
    <div class="absolute inset-x-5 top-5 z-20 flex items-start justify-between gap-3">
      <span
        class="inline-flex items-center rounded-full border border-white/80 bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600 shadow-sm backdrop-blur"
      >
        {{ product.category.name }}
      </span>

      <span
        v-if="cartQuantity > 0"
        class="inline-flex items-center rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white shadow-sm"
      >
        {{ cartQuantity }} no carrinho
      </span>
    </div>

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

    <div class="p-5">
      <div class="mb-4 flex items-start justify-between gap-4">
        <div>
          <p class="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
            {{ stockLabel }}
          </p>
          <h3 class="mt-2 text-xl font-semibold text-slate-900 transition-colors group-hover:text-emerald-700">
            {{ product.name }}
          </h3>
        </div>

        <div
          class="rounded-full px-3 py-1 text-xs font-semibold"
          :class="getCategoryColor(product.category.name)"
        >
          {{ availabilityLabel }}
        </div>
      </div>

      <p class="mb-5 text-sm leading-6 text-slate-500">
        {{ supportingCopy }}
      </p>

      <div class="flex items-center justify-between">
        <div>
          <p class="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
            Valor unitario
          </p>
          <span class="mt-1 block text-2xl font-semibold text-slate-900">
            {{ formatBRL(product.price) }}
          </span>
        </div>

        <div class="text-right">
          <p class="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
            Categoria
          </p>
          <span class="mt-1 block text-sm font-medium text-slate-600">
            {{ product.category.name }}
          </span>
        </div>
      </div>

      <div class="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-4">
        <div class="flex items-center justify-between gap-4">
          <div class="inline-flex items-center rounded-full border border-slate-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              class="h-10 w-10 rounded-full text-lg font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
              :disabled="!product.is_available || quantity <= 1"
              aria-label="Diminuir quantidade"
              @click="decrementQuantity"
            >
              -
            </button>
            <span class="min-w-10 text-center text-sm font-semibold text-slate-900">
              {{ quantity }}
            </span>
            <button
              type="button"
              class="h-10 w-10 rounded-full text-lg font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
              :disabled="!product.is_available || quantity >= product.stock_quantity"
              aria-label="Aumentar quantidade"
              @click="incrementQuantity"
            >
              +
            </button>
          </div>

          <button
            type="button"
            class="inline-flex flex-1 items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-emerald-200"
            :class="product.is_available
              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
              : 'cursor-not-allowed bg-slate-200 text-slate-500'"
            :disabled="!product.is_available"
            @click="handleAddToCart"
          >
            {{ product.is_available ? 'Adicionar ao carrinho' : 'Indisponivel' }}
          </button>
        </div>

        <p v-if="product.is_available" class="mt-3 text-xs text-slate-500">
          Estoque disponivel: {{ product.stock_quantity }} unidade<span v-if="product.stock_quantity !== 1">s</span>.
        </p>
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
`)}`;

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

const availabilityLabel = computed(() =>
  props.product.is_available ? 'Compra rapida' : 'Indisponivel'
)

const stockLabel = computed(() => {
  if (!props.product.is_available) {
    return 'Reposicao em andamento'
  }

  if (props.product.stock_quantity <= 5) {
    return `Ultimas ${props.product.stock_quantity} unidades`
  }

  return 'Pronto para envio'
})

const supportingCopy = computed(() => {
  if (!props.product.is_available) {
    return 'Este item esta temporariamente fora de estoque, mas voce pode continuar navegando por categorias semelhantes.'
  }

  if (props.product.stock_quantity <= 5) {
    return 'Item com disponibilidade limitada. Garanta no carrinho antes que o estoque acabe.'
  }

  return 'Adicione ao carrinho, ajuste quantidades e deixe seu pedido pronto para atendimento sem perder contexto da vitrine.'
})

const handleImageError = (event: Event) => {
  const img = event.target as HTMLImageElement
  if (img.src !== FALLBACK_IMAGE_URL) {
    img.src = FALLBACK_IMAGE_URL
  }
}

const getCategoryColor = (categoryName: string): string => {
  const colors: Record<string, string> = {
    Roupas: 'bg-blue-50 text-blue-700',
    Eletronicos: 'bg-emerald-50 text-emerald-700',
    'Eletrônicos': 'bg-emerald-50 text-emerald-700',
    Casa: 'bg-amber-50 text-amber-700',
    Esportes: 'bg-orange-50 text-orange-700',
    Livros: 'bg-violet-50 text-violet-700',
  }

  return colors[categoryName] || 'bg-slate-100 text-slate-700'
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
</script>
