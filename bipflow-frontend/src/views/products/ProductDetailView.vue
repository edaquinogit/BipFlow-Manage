<template>
  <div class="min-h-screen bg-slate-50">
    <header class="border-b border-slate-200 bg-white/92 backdrop-blur">
      <div class="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <button
          type="button"
          class="inline-flex w-fit items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-100"
          @click="goBackToCatalog"
        >
          <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fill-rule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.56l3.22 3.22a.75.75 0 11-1.06 1.06l-4.5-4.5a.75.75 0 010-1.06l4.5-4.5a.75.75 0 111.06 1.06L5.56 9.25h10.69A.75.75 0 0117 10z" clip-rule="evenodd" />
          </svg>
          Voltar ao catalogo
        </button>

        <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div v-if="product" class="max-w-3xl">
            <p class="text-sm font-semibold uppercase tracking-[0.26em] text-rose-600">
              {{ product.category.name }}
            </p>
            <h1 class="mt-3 text-4xl font-semibold tracking-tight text-slate-900">
              {{ product.name }}
            </h1>
            <p class="mt-3 max-w-2xl text-base leading-7 text-slate-600">
              {{ productDescription }}
            </p>
          </div>

          <div v-if="product" class="grid gap-3 sm:grid-cols-3">
            <div class="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4">
              <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Valor
              </p>
              <p class="mt-2 text-xl font-semibold text-slate-900">
                {{ formatBRL(product.price) }}
              </p>
            </div>

            <div class="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4">
              <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Tamanho
              </p>
              <p class="mt-2 text-xl font-semibold text-slate-900">
                {{ product.size || 'Sob consulta' }}
              </p>
            </div>

            <div class="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4">
              <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Estoque
              </p>
              <p class="mt-2 text-xl font-semibold text-slate-900">
                {{ availabilitySummary }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-7xl px-4 py-8 pb-32 sm:px-6 lg:px-8">
      <div v-if="isLoading" class="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_380px]">
        <div class="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm animate-pulse">
          <div class="aspect-square bg-slate-200" />
        </div>

        <div class="space-y-4">
          <div class="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm animate-pulse">
            <div class="h-5 w-32 rounded bg-slate-200" />
            <div class="mt-4 h-10 rounded bg-slate-200" />
            <div class="mt-4 h-24 rounded bg-slate-200" />
          </div>
        </div>
      </div>

      <div
        v-else-if="errorMessage || !product"
        class="rounded-[32px] border border-rose-200 bg-white p-10 text-center shadow-sm"
      >
        <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-600">
          <svg class="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12v-.008zm8.25-.75a8.25 8.25 0 10-16.5 0 8.25 8.25 0 0016.5 0z" />
          </svg>
        </div>
        <h2 class="mt-5 text-2xl font-semibold text-slate-900">Nao foi possivel abrir este produto</h2>
        <p class="mt-3 text-base text-slate-600">
          {{ errorMessage || 'O produto pode ter sido removido ou esta temporariamente indisponivel.' }}
        </p>
        <div class="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            type="button"
            class="inline-flex items-center justify-center rounded-full bg-rose-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-rose-700"
            @click="loadProduct"
          >
            Tentar novamente
          </button>
          <button
            type="button"
            class="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-100"
            @click="goBackToCatalog"
          >
            Voltar ao catalogo
          </button>
        </div>
      </div>

      <div v-else class="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_380px]">
        <section class="space-y-6">
          <div
            class="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm"
            @mouseenter="pauseCarousel"
            @mouseleave="resumeCarousel"
          >
            <div
              class="relative aspect-square overflow-hidden bg-slate-100 touch-pan-y"
              @pointerdown="handlePointerDown"
              @pointermove="handlePointerMove"
              @pointerup="handlePointerUp"
              @pointercancel="handlePointerCancel"
              @pointerleave="handlePointerLeave"
            >
              <Transition :name="slideTransitionName" mode="out-in">
                <img
                  :key="activeImageSource"
                  :src="activeImageSource"
                  :alt="`Imagem do produto ${product.name}`"
                  class="h-full w-full object-cover select-none"
                  loading="eager"
                  draggable="false"
                  @error="handleImageError"
                />
              </Transition>

              <div
                v-if="productImages.length > 1"
                class="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 px-4 py-4"
              >
                <span
                  v-for="(imageUrl, index) in productImages"
                  :key="`${imageUrl}-${index}`"
                  class="h-1.5 rounded-full transition-all duration-300"
                  :class="imageUrl === activeImageSource ? 'w-8 bg-white shadow-sm' : 'w-2.5 bg-white/55'"
                />
              </div>
            </div>
          </div>

          <div v-if="productImages.length > 1" class="grid grid-cols-3 gap-3 sm:grid-cols-4">
            <button
              v-for="imageUrl in productImages"
              :key="imageUrl"
              type="button"
              class="overflow-hidden rounded-[20px] border bg-white transition"
              :class="imageUrl === activeImageSource
                ? 'border-rose-300 shadow-sm'
                : 'border-slate-200 hover:border-slate-300'"
              :aria-label="`Selecionar imagem do produto ${product.name}`"
              @click="handleSelectImage(imageUrl)"
            >
              <div class="aspect-square overflow-hidden bg-slate-100">
                <img
                  :src="imageUrl"
                  :alt="`Miniatura do produto ${product.name}`"
                  class="h-full w-full object-cover"
                />
              </div>
            </button>
          </div>

          <div class="grid gap-4 md:grid-cols-2">
            <article class="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Descricao completa
              </p>
              <p class="mt-3 text-sm leading-7 text-slate-600">
                {{ productDescription }}
              </p>
            </article>

            <article class="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Informacoes do produto
              </p>
              <dl class="mt-4 space-y-4 text-sm text-slate-600">
                <div class="flex items-center justify-between gap-4">
                  <dt>Tamanho</dt>
                  <dd class="font-semibold text-slate-900">{{ product.size || 'Sob consulta' }}</dd>
                </div>
                <div class="flex items-center justify-between gap-4">
                  <dt>SKU</dt>
                  <dd class="font-semibold text-slate-900">{{ product.sku || 'Nao informado' }}</dd>
                </div>
                <div class="flex items-center justify-between gap-4">
                  <dt>Categoria</dt>
                  <dd class="font-semibold text-slate-900">{{ product.category.name }}</dd>
                </div>
                <div class="flex items-center justify-between gap-4">
                  <dt>Disponibilidade</dt>
                  <dd class="font-semibold" :class="availabilityToneClass">{{ availabilityLabel }}</dd>
                </div>
              </dl>
            </article>
          </div>
        </section>

        <aside class="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <section class="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
            <div class="flex items-center justify-between gap-4">
              <div>
                <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Compra rapida
                </p>
                <p class="mt-2 text-3xl font-semibold text-slate-900">
                  {{ formatBRL(product.price) }}
                </p>
              </div>

              <span
                class="rounded-full px-3 py-1 text-xs font-semibold"
                :class="product.is_available ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-600'"
              >
                {{ availabilityLabel }}
              </span>
            </div>

            <p class="mt-4 text-sm leading-6 text-slate-600">
              {{ purchaseSupportCopy }}
            </p>

            <div class="mt-5 rounded-[28px] border border-rose-100 bg-rose-50/70 p-4">
              <div class="flex flex-col gap-4">
                <div class="flex items-center justify-between gap-4">
                  <div>
                    <p class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Quantidade
                    </p>
                    <p class="mt-1 text-sm text-slate-600">
                      {{ cartQuantity > 0 ? `${cartQuantity} ja no carrinho` : 'Selecione e confirme em um toque.' }}
                    </p>
                  </div>

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
                </div>

                <button
                  type="button"
                  class="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-rose-200"
                  :class="product.is_available
                    ? 'bg-rose-600 text-white hover:bg-rose-700'
                    : 'cursor-not-allowed bg-slate-200 text-slate-500'"
                  :disabled="!product.is_available"
                  @click="handleAddToCart"
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
                  {{ addToCartLabel }}
                </button>
              </div>
            </div>

            <div class="mt-5 grid gap-3">
              <button
                type="button"
                class="inline-flex items-center justify-center rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-100"
                @click="isCartOpen = true"
              >
                Abrir carrinho
              </button>

              <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <p class="font-semibold text-slate-900">{{ itemCount }} item<span v-if="itemCount !== 1">s</span> no pedido</p>
                <p class="mt-1">Total atual: {{ formatBRL(total) }}</p>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </main>

    <Transition name="cart-bar">
      <div
        v-if="itemCount > 0"
        class="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/96 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-20px_45px_-30px_rgba(15,23,42,0.35)] backdrop-blur"
      >
        <div class="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            class="flex min-w-0 flex-1 items-center gap-3 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-slate-300 hover:bg-slate-100"
            aria-label="Abrir carrinho"
            @click="isCartOpen = true"
          >
            <span class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white">
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 4h2l2.4 10.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 .98-.8L20 7H7" />
                <circle cx="10" cy="19" r="1.5" />
                <circle cx="17" cy="19" r="1.5" />
              </svg>
            </span>

            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-semibold text-slate-900">
                {{ itemCount }} item<span v-if="itemCount !== 1">s</span> no carrinho
              </span>
              <span class="block truncate text-sm text-slate-500">
                {{ floatingCartMessage }}
              </span>
            </span>

            <span class="shrink-0 text-right">
              <span class="block text-lg font-semibold text-slate-900">
                {{ formatBRL(total) }}
              </span>
              <span class="block text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
                Total
              </span>
            </span>
          </button>

          <div class="grid gap-3 sm:w-auto sm:grid-cols-[minmax(0,180px)_minmax(0,180px)]">
            <button
              type="button"
              class="inline-flex items-center justify-center rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-100"
              @click="isCartOpen = true"
            >
              Revisar pedido
            </button>

            <button
              type="button"
              class="inline-flex items-center justify-center rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-300"
              :disabled="items.length === 0 || isSubmittingOrder"
              @click="handleSubmitOrder"
            >
              {{ isSubmittingOrder ? 'Processando...' : 'Finalizar pedido' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <CartDrawer
      :is-open="isCartOpen"
      :items="items"
      :customer="customer"
      :item-count="itemCount"
      :subtotal="subtotal"
      :delivery-fee="deliveryFee"
      :total="total"
      :is-submitting="isSubmittingOrder"
      @close="isCartOpen = false"
      @clear-cart="clearCart"
      @remove-item="removeItem"
      @update-quantity="updateQuantity"
      @update-customer="updateCustomer"
      @copy-order="handleCopyOrder"
      @submit-order="handleSubmitOrder"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CartDrawer from './CartDrawer.vue'
import { useCart } from '@/composables/useCart'
import { useToast } from '@/composables/useToast'
import { PublicRoutes } from '@/router/public.routes'
import { Logger } from '@/services/logger'
import { orderService } from '@/services/order.service'
import productService from '@/services/product.service'
import type { ProductDetail } from '@/types/product'
import { formatBRL } from '@/utils/formatters'

const route = useRoute()
const router = useRouter()
const toast = useToast()

const FALLBACK_IMAGE_URL = `data:image/svg+xml;utf8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 720">
    <rect width="720" height="720" fill="#f3f4f6" />
    <rect x="90" y="90" width="540" height="540" rx="40" fill="#e5e7eb" />
    <circle cx="275" cy="290" r="58" fill="#cbd5e1" />
    <path d="M175 500l125-132c13-14 36-14 49 0l66 70 47-50c14-15 37-15 51 0l92 98v70H175z" fill="#94a3b8" />
    <text x="360" y="610" text-anchor="middle" fill="#6b7280" font-family="Arial, sans-serif" font-size="34" font-weight="700">
      Imagem indisponivel
    </text>
  </svg>
`)}`

const product = ref<ProductDetail | null>(null)
const activeImage = ref<string | null>(null)
const isLoading = ref(true)
const isCartOpen = ref(false)
const isSubmittingOrder = ref(false)
const errorMessage = ref('')
const quantity = ref(1)
const slideTransitionName = ref('carousel-slide-next')
const isCarouselPaused = ref(false)
const pointerStartX = ref<number | null>(null)
const pointerDeltaX = ref(0)
const activePointerId = ref<number | null>(null)
let carouselInterval: ReturnType<typeof setInterval> | null = null

const {
  items,
  customer,
  itemCount,
  uniqueItemCount,
  subtotal,
  deliveryFee,
  total,
  addItem,
  removeItem,
  updateQuantity,
  clearCart,
  updateCustomer,
  resetCustomer,
  getProductQuantity,
  buildOrderSummary,
} = useCart()

const productDescription = computed(() => (
  product.value?.description?.trim()
    || 'Este produto foi preparado para uma experiencia de compra mais clara, com informacoes essenciais reunidas em uma unica tela.'
))

const productImages = computed(() => {
  const productGallery = product.value?.images?.length
    ? product.value.images
    : product.value?.image
      ? [product.value.image]
      : []

  return productGallery.length > 0 ? productGallery : [FALLBACK_IMAGE_URL]
})

const activeImageSource = computed(() => (
  activeImage.value && productImages.value.includes(activeImage.value)
    ? activeImage.value
    : productImages.value[0]
))

function stopCarousel(): void {
  if (!carouselInterval) {
    return
  }

  clearInterval(carouselInterval)
  carouselInterval = null
}

function setActiveImageByIndex(nextIndex: number, direction: 'next' | 'prev'): void {
  slideTransitionName.value = direction === 'next'
    ? 'carousel-slide-next'
    : 'carousel-slide-prev'
  activeImage.value = productImages.value[nextIndex] ?? FALLBACK_IMAGE_URL
}

function goToNextImage(): void {
  if (productImages.value.length <= 1) {
    return
  }

  const currentIndex = productImages.value.findIndex((imageUrl) => imageUrl === activeImageSource.value)
  const nextIndex = currentIndex >= 0
    ? (currentIndex + 1) % productImages.value.length
    : 0

  setActiveImageByIndex(nextIndex, 'next')
}

function goToPreviousImage(): void {
  if (productImages.value.length <= 1) {
    return
  }

  const currentIndex = productImages.value.findIndex((imageUrl) => imageUrl === activeImageSource.value)
  const previousIndex = currentIndex >= 0
    ? (currentIndex - 1 + productImages.value.length) % productImages.value.length
    : 0

  setActiveImageByIndex(previousIndex, 'prev')
}

function startCarousel(): void {
  stopCarousel()

  if (productImages.value.length <= 1 || isCarouselPaused.value) {
    return
  }

  carouselInterval = setInterval(() => {
    goToNextImage()
  }, 3500)
}

function handleSelectImage(imageUrl: string): void {
  const currentIndex = productImages.value.findIndex((item) => item === activeImageSource.value)
  const nextIndex = productImages.value.findIndex((item) => item === imageUrl)

  slideTransitionName.value = nextIndex >= currentIndex
    ? 'carousel-slide-next'
    : 'carousel-slide-prev'

  activeImage.value = imageUrl
  startCarousel()
}

function pauseCarousel(): void {
  isCarouselPaused.value = true
  stopCarousel()
}

function resumeCarousel(): void {
  isCarouselPaused.value = false
  startCarousel()
}

function handlePointerDown(event: PointerEvent): void {
  if (productImages.value.length <= 1) {
    return
  }

  activePointerId.value = event.pointerId
  pointerStartX.value = event.clientX
  pointerDeltaX.value = 0
  pauseCarousel()
}

function handlePointerMove(event: PointerEvent): void {
  if (activePointerId.value !== event.pointerId || pointerStartX.value === null) {
    return
  }

  pointerDeltaX.value = event.clientX - pointerStartX.value
}

function finalizePointerInteraction(): void {
  const swipeThreshold = 48

  if (pointerDeltaX.value <= -swipeThreshold) {
    goToNextImage()
  } else if (pointerDeltaX.value >= swipeThreshold) {
    goToPreviousImage()
  }

  pointerStartX.value = null
  pointerDeltaX.value = 0
  activePointerId.value = null
  resumeCarousel()
}

function handlePointerUp(event: PointerEvent): void {
  if (activePointerId.value !== event.pointerId) {
    return
  }

  finalizePointerInteraction()
}

function handlePointerCancel(): void {
  pointerStartX.value = null
  pointerDeltaX.value = 0
  activePointerId.value = null
  resumeCarousel()
}

function handlePointerLeave(event: PointerEvent): void {
  if (activePointerId.value !== event.pointerId) {
    return
  }

  finalizePointerInteraction()
}

const cartQuantity = computed(() => (
  product.value ? getProductQuantity(product.value.id) : 0
))

const availabilityLabel = computed(() => {
  if (!product.value?.is_available) {
    return 'Indisponivel'
  }

  return product.value.stock_quantity <= 5 ? 'Ultimas unidades' : 'Disponivel'
})

const availabilitySummary = computed(() => {
  if (!product.value?.is_available) {
    return 'Indisponivel'
  }

  return `${product.value.stock_quantity} un.`
})

const availabilityToneClass = computed(() => (
  product.value?.is_available ? 'text-rose-700' : 'text-slate-600'
))

const purchaseSupportCopy = computed(() => {
  if (!product.value) {
    return ''
  }

  if (!product.value.is_available) {
    return 'Este item esta fora de estoque no momento, mas voce ainda pode explorar outros produtos da categoria.'
  }

  if (cartQuantity.value > 0) {
    return `${cartQuantity.value} unidade${cartQuantity.value !== 1 ? 's' : ''} ja adicionada${cartQuantity.value !== 1 ? 's' : ''}. Ajuste a quantidade se quiser reforcar o pedido.`
  }

  return 'Descricao, tamanho e compra reunidos em um unico fluxo para decisao rapida e sem atrito.'
})

const addToCartLabel = computed(() => {
  if (!product.value?.is_available) {
    return 'Indisponivel'
  }

  if (quantity.value > 1) {
    return `Adicionar ${quantity.value}`
  }

  return 'Adicionar ao carrinho'
})

const floatingCartMessage = computed(() => {
  if (customer.value.fullName.trim()) {
    return `Pedido em preparo para ${customer.value.fullName.trim()}.`
  }

  return `${uniqueItemCount.value} produto${uniqueItemCount.value !== 1 ? 's' : ''} diferente${uniqueItemCount.value !== 1 ? 's' : ''} pronto${uniqueItemCount.value !== 1 ? 's' : ''} para fechamento.`
})

async function loadProduct(): Promise<void> {
  const slug = typeof route.params.slug === 'string' ? route.params.slug : ''

  if (!slug) {
    errorMessage.value = 'Produto invalido.'
    isLoading.value = false
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    product.value = await productService.getPublicBySlug(slug)
    activeImage.value = product.value.images?.[0] || product.value.image || FALLBACK_IMAGE_URL
    quantity.value = 1
    isCarouselPaused.value = false
    startCarousel()
  } catch (error) {
    product.value = null
    stopCarousel()
    errorMessage.value = 'Nao encontramos os detalhes deste produto agora.'
    Logger.warn('Failed to load public product detail', {
      slug,
      error: error instanceof Error ? error.message : 'unknown_error',
    })
  } finally {
    isLoading.value = false
  }
}

watch(productImages, () => {
  startCarousel()
})

watch(
  () => route.params.slug,
  () => {
    void loadProduct()
  },
  { immediate: true }
)

function handleImageError(event: Event): void {
  const img = event.target as HTMLImageElement
  if (img.src !== FALLBACK_IMAGE_URL) {
    img.src = FALLBACK_IMAGE_URL
    activeImage.value = FALLBACK_IMAGE_URL
  }
}

function incrementQuantity(): void {
  if (!product.value) {
    return
  }

  quantity.value = Math.min(quantity.value + 1, product.value.stock_quantity)
}

function decrementQuantity(): void {
  quantity.value = Math.max(quantity.value - 1, 1)
}

function handleAddToCart(): void {
  if (!product.value || !product.value.is_available) {
    return
  }

  addItem(product.value, quantity.value)
  toast.success(`${quantity.value} unidade(s) de ${product.value.name} adicionada(s) ao carrinho.`)
  quantity.value = 1
}

function goBackToCatalog(): void {
  void router.push({ name: PublicRoutes.Products })
}

async function handleCopyOrder(): Promise<void> {
  if (items.value.length === 0) {
    toast.info('Adicione produtos ao carrinho antes de copiar o pedido.')
    return
  }

  const summary = buildOrderSummary()

  try {
    if (!navigator.clipboard?.writeText) {
      throw new Error('clipboard_unavailable')
    }

    await navigator.clipboard.writeText(summary)
    toast.success('Resumo do pedido copiado. Agora voce pode compartilhar com o cliente ou atendimento.')
  } catch {
    toast.error('Nao foi possivel copiar o pedido automaticamente neste navegador.')
  }
}

function validateCheckoutData(): boolean {
  if (items.value.length === 0) {
    toast.info('Adicione produtos ao carrinho antes de finalizar o pedido.')
    return false
  }

  if (!customer.value.fullName.trim()) {
    toast.info('Preencha o nome do cliente para emitir a nota do pedido.')
    isCartOpen.value = true
    return false
  }

  if (!customer.value.phone.trim()) {
    toast.info('Preencha o WhatsApp do cliente para concluir o atendimento.')
    isCartOpen.value = true
    return false
  }

  if (customer.value.deliveryMethod === 'delivery') {
    const hasAddress =
      customer.value.address.trim() &&
      customer.value.neighborhood.trim() &&
      customer.value.city.trim()

    if (!hasAddress) {
      toast.info('Complete o endereco de entrega para finalizar o pedido.')
      isCartOpen.value = true
      return false
    }
  }

  return true
}

async function handleSubmitOrder(): Promise<void> {
  if (!validateCheckoutData() || isSubmittingOrder.value) {
    return
  }

  isSubmittingOrder.value = true

  try {
    const response = await orderService.checkoutViaWhatsApp(items.value, customer.value)

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(response.message)
    }

    if (response.whatsapp_url) {
      window.open(response.whatsapp_url, '_blank', 'noopener,noreferrer')
      toast.success(`Pedido ${response.order_reference} emitido com sucesso e pronto para envio no WhatsApp.`)
    } else {
      toast.success(`Pedido ${response.order_reference} emitido. Resumo copiado para compartilhamento manual.`)
    }

    clearCart()
    resetCustomer()
    isCartOpen.value = false
  } catch (error) {
    Logger.warn('Failed to finalize order via WhatsApp from product detail', {
      error: error instanceof Error ? error.message : 'unknown_error',
    })
    toast.error('Nao foi possivel finalizar o pedido agora. Revise os dados e tente novamente.')
  } finally {
    isSubmittingOrder.value = false
  }
}

onBeforeUnmount(() => {
  stopCarousel()
})
</script>

<style scoped>
.cart-bar-enter-active,
.cart-bar-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}

.cart-bar-enter-from,
.cart-bar-leave-to {
  opacity: 0;
  transform: translateY(16px);
}

.carousel-slide-next-enter-active,
.carousel-slide-next-leave-active,
.carousel-slide-prev-enter-active,
.carousel-slide-prev-leave-active {
  transition: transform 0.4s ease, opacity 0.4s ease;
}

.carousel-slide-next-enter-from {
  opacity: 0;
  transform: translateX(30px);
}

.carousel-slide-next-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}

.carousel-slide-prev-enter-from {
  opacity: 0;
  transform: translateX(-30px);
}

.carousel-slide-prev-leave-to {
  opacity: 0;
  transform: translateX(30px);
}
</style>
