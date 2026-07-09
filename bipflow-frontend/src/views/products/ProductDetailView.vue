<template>
  <div class="storefront-shell min-h-screen" :style="storeBranding.cssVars">
    <header class="storefront-header border-b">
      <div class="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3.5 min-[390px]:py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <button
          type="button"
          class="storefront-outline-button inline-flex h-10 w-fit items-center gap-2 rounded-xl border bg-white px-4 text-[11px] font-bold uppercase tracking-[0.14em] transition min-[390px]:text-xs"
          @click="goBackToCatalog"
        >
          <ArrowLeftIcon class="h-4 w-4" aria-hidden="true" />
          Voltar ao catalogo
        </button>

        <div class="flex items-center justify-between gap-2.5 min-[390px]:gap-3">
          <div class="flex min-w-0 items-center gap-2.5 min-[390px]:gap-3">
            <div class="flex h-11 w-28 shrink-0 items-center justify-center overflow-hidden min-[390px]:h-12 min-[390px]:w-32">
              <img
                :src="storeBranding.logoUrl"
                :alt="storeBranding.name"
                class="h-full w-full object-contain"
              />
            </div>
            <div class="min-w-0">
              <p class="brand-wordmark brand-wordmark-premium truncate text-base min-[390px]:text-lg">{{ storeBranding.name }}</p>
              <p class="storefront-muted truncate text-[11px] min-[390px]:text-xs">{{ storeBranding.tagline }}</p>
            </div>
          </div>

          <CustomerProfileMenuButton />
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-7xl px-4 py-6 pb-24 min-[390px]:py-8 sm:px-6 lg:px-8">
      <div v-if="isLoading" class="grid gap-6 min-[390px]:gap-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
        <div class="animate-pulse">
          <div class="aspect-[4/5] rounded-lg bg-[#F4F1F3]" />
        </div>

        <div class="animate-pulse">
          <div class="h-4 w-32 rounded bg-slate-200" />
          <div class="mt-4 h-8 rounded bg-slate-200" />
          <div class="mt-5 h-10 w-40 rounded bg-slate-200" />
          <div class="mt-5 h-24 rounded bg-slate-200" />
          <div class="mt-6 h-36 rounded bg-slate-200" />
        </div>
      </div>

      <div
        v-else-if="errorMessage || !product"
        class="mx-auto max-w-xl py-24 text-center"
      >
        <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
          <svg class="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m0 3.75h.008v.008H12v-.008zm8.25-.75a8.25 8.25 0 10-16.5 0 8.25 8.25 0 0016.5 0z" />
          </svg>
        </div>
        <h2 class="mt-5 text-2xl font-semibold text-[#05050A]">Nao foi possivel abrir este produto</h2>
        <p class="mt-3 text-base text-[#6B7280]">
          {{ errorMessage || 'O produto pode ter sido removido ou esta temporariamente indisponivel.' }}
        </p>
        <div class="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            type="button"
            class="inline-flex items-center justify-center rounded-lg bg-[#05050A] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#D81B60]"
            @click="loadProduct"
          >
            Tentar novamente
          </button>
          <button
            type="button"
            class="inline-flex items-center justify-center rounded-lg border border-[#D1D5DB] bg-white px-5 py-3 text-sm font-semibold text-[#05050A] transition hover:border-[#D81B60] hover:text-[#D81B60]"
            @click="goBackToCatalog"
          >
            Voltar ao catalogo
          </button>
        </div>
      </div>

      <div v-else class="grid gap-6 min-[390px]:gap-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
        <section class="min-w-0 space-y-3.5 min-[390px]:space-y-4">
          <div
            class="w-full overflow-hidden rounded-[1.15rem] bg-[#F4F1F3] min-[390px]:rounded-lg"
            @mouseenter="pauseCarousel"
            @mouseleave="resumeCarousel"
          >
            <div
              class="relative aspect-[4/5] overflow-hidden bg-[#F4F1F3] touch-pan-y"
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
                  class="h-full w-full select-none object-contain p-4 min-[390px]:p-5 sm:p-8"
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
                  :class="imageUrl === activeImageSource ? 'w-8 bg-white' : 'w-2.5 bg-white/55'"
                />
              </div>
            </div>
          </div>

          <div v-if="productImages.length > 1" class="flex gap-2.5 overflow-x-auto pb-1 min-[390px]:gap-3">
            <button
              v-for="imageUrl in productImages"
              :key="imageUrl"
              type="button"
                class="h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-[1rem] border bg-white transition min-[390px]:h-20 min-[390px]:w-20 min-[390px]:rounded-lg sm:h-24 sm:w-24"
              :class="imageUrl === activeImageSource
                ? 'border-[#D81B60]'
                : 'border-[#E5E7EB] hover:border-[#D81B60]'"
              :aria-label="`Selecionar imagem do produto ${product.name}`"
              @click="handleSelectImage(imageUrl)"
            >
              <div class="aspect-square overflow-hidden bg-slate-100">
                <img
                  :src="imageUrl"
                  :alt="`Miniatura do produto ${product.name}`"
                  class="h-full w-full object-contain p-1.5"
                  loading="lazy"
                />
              </div>
            </button>
          </div>
        </section>

        <aside class="min-w-0 lg:sticky lg:top-6 lg:self-start">
          <section class="w-full max-w-full">
            <div class="flex flex-wrap items-center justify-between gap-2.5 min-[390px]:gap-3">
              <p class="text-xs font-bold uppercase tracking-[0.16em] text-[#D81B60] min-[390px]:text-sm min-[390px]:normal-case min-[390px]:tracking-normal">
                {{ product.category.name }}
              </p>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-white transition focus:outline-none focus:ring-2 focus:ring-[#FCE7F3] min-[390px]:h-10 min-[390px]:w-10"
                  :class="isShareCopied
                    ? 'border-[#D81B60] bg-[#D81B60] text-white shadow-[0_12px_24px_-18px_rgba(216,27,96,0.6)]'
                    : 'storefront-outline-button hover:border-[#D81B60] hover:text-[#D81B60]'"
                  :aria-label="isShareCopied ? 'Link do produto copiado' : 'Compartilhar produto'"
                  :title="isShareCopied ? 'Link copiado' : 'Compartilhar produto'"
                  @click="void handleShareProduct()"
                >
                  <CheckIcon
                    v-if="isShareCopied"
                    class="h-4 w-4 min-[390px]:h-[18px] min-[390px]:w-[18px]"
                    aria-hidden="true"
                  />
                  <ShareIcon
                    v-else
                    class="h-4 w-4 min-[390px]:h-[18px] min-[390px]:w-[18px]"
                    aria-hidden="true"
                  />
                </button>

                <span
                  class="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] min-[390px]:text-xs"
                  :class="product.is_available ? 'bg-[#FCE7F3] text-[#D81B60]' : 'bg-slate-100 text-slate-600'"
                >
                  {{ availabilityLabel }}
                </span>
              </div>
            </div>

            <h1 class="mt-2.5 text-[1.8rem] font-semibold leading-[1.05] text-[#05050A] min-[390px]:mt-3 min-[390px]:text-3xl sm:text-4xl">
              {{ product.name }}
            </h1>

            <p class="mt-4 text-[1.9rem] font-semibold tracking-[-0.03em] text-[#05050A] min-[390px]:mt-5 min-[390px]:text-3xl">
              {{ formatBRL(product.price) }}
            </p>

            <p class="mt-3 text-[13px] leading-6 text-slate-600 min-[390px]:text-sm">
              {{ productDescription }}
            </p>

            <dl class="mt-5 divide-y divide-[#E5E7EB] border-y border-[#E5E7EB] text-[13px] text-[#6B7280] min-[390px]:mt-6 min-[390px]:text-sm">
              <div class="flex items-center justify-between gap-4 py-3">
                <dt>Tamanho</dt>
                <dd class="text-right font-semibold text-[#05050A]">{{ product.size || 'Sob consulta' }}</dd>
              </div>
              <div class="flex items-center justify-between gap-4 py-3">
                <dt>SKU</dt>
                <dd class="text-right font-semibold text-[#05050A]">{{ product.sku || 'Nao informado' }}</dd>
              </div>
              <div class="flex items-center justify-between gap-4 py-3">
                <dt>Estoque</dt>
                <dd class="text-right font-semibold" :class="availabilityToneClass">
                  {{ product.is_available ? `${product.stock_quantity} un.` : 'Indisponivel' }}
                </dd>
              </div>
            </dl>

            <div class="mt-5 border-t border-[#E5E7EB] pt-4 min-[390px]:mt-6 min-[390px]:pt-5">
              <div class="flex flex-col gap-3.5 min-[390px]:gap-4">
                <div class="flex items-center justify-between gap-3 min-[390px]:gap-4">
                  <div>
                    <p class="text-sm font-semibold text-[#05050A]">
                      Quantidade
                    </p>
                    <p class="mt-1 text-[13px] text-slate-600 min-[390px]:text-sm">
                      {{ cartQuantity > 0 ? `${cartQuantity} ja no pedido` : 'Selecione e confirme em um toque.' }}
                    </p>
                  </div>

                  <div class="inline-flex h-11 items-center rounded-[0.95rem] border border-[#D8DDE5] bg-white shadow-[0_12px_28px_-24px_rgba(5,5,10,0.55)] min-[390px]:h-12 min-[390px]:rounded-xl">
                    <button
                      type="button"
                      class="inline-flex h-11 w-10 items-center justify-center rounded-l-[0.95rem] text-[#6B7280] transition hover:bg-[#FAFAFA] disabled:cursor-not-allowed disabled:opacity-40 min-[390px]:h-12 min-[390px]:w-11 min-[390px]:rounded-l-xl"
                      :disabled="!product.is_available || quantity <= 1"
                      aria-label="Diminuir quantidade"
                      @click="decrementQuantity"
                    >
                      <MinusIcon class="h-4 w-4" aria-hidden="true" />
                    </button>
                    <span class="min-w-8 text-center text-[15px] font-semibold text-[#05050A] min-[390px]:min-w-11 min-[390px]:text-base">
                      {{ quantity }}
                    </span>
                    <button
                      type="button"
                      class="inline-flex h-11 w-10 items-center justify-center rounded-r-[0.95rem] text-[#6B7280] transition hover:bg-[#FAFAFA] disabled:cursor-not-allowed disabled:opacity-40 min-[390px]:h-12 min-[390px]:w-11 min-[390px]:rounded-r-xl"
                      :disabled="!product.is_available || quantity >= product.stock_quantity"
                      aria-label="Aumentar quantidade"
                      @click="incrementQuantity"
                    >
                      <PlusIcon class="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  class="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-[12px] font-bold uppercase tracking-[0.12em] shadow-[0_16px_34px_-24px_rgba(5,5,10,0.65)] transition duration-200 focus:outline-none focus:ring-2 focus:ring-[#FCE7F3] min-[390px]:px-6 min-[390px]:py-3.5 min-[390px]:text-[13px] min-[390px]:tracking-[0.14em] sm:text-sm"
                  :class="product.is_available
                    ? 'bg-[#05050A] text-white hover:-translate-y-0.5 hover:bg-[#D81B60] hover:shadow-[0_18px_40px_-24px_rgba(216,27,96,0.55)]'
                    : 'cursor-not-allowed bg-slate-200 text-slate-500'"
                  :disabled="!product.is_available"
                  @click="handleAddToCart"
                >
                  <ShoppingBagIcon class="h-5 w-5 shrink-0" aria-hidden="true" />
                  {{ addToCartLabel }}
                </button>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </main>

    <FloatingCartButton
      :item-count="itemCount"
      @open-cart="openCart"
    />

    <CartDrawer
      :is-open="isCartOpen"
      :items="items"
      :item-count="itemCount"
      :subtotal="subtotal"
      :delivery-fee="deliveryFee"
      :total="total"
      :customer="customer"
      :delivery-regions="deliveryRegions"
      :is-delivery-regions-loading="isDeliveryRegionsLoading"
      :is-submitting="isSubmittingOrder"
      :is-whats-app-configured="isWhatsAppConfigured"
      :profile="customerProfile"
      @close="isCartOpen = false"
      @clear-cart="clearCart"
      @remove-item="removeItem"
      @update-quantity="updateQuantity"
      @update-customer="updateCustomer"
      @submit-order="handleSubmitOrder"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  ArrowLeftIcon,
  CheckIcon,
  MinusIcon,
  PlusIcon,
  ShoppingBagIcon,
  ShareIcon,
} from '@heroicons/vue/24/outline'
import { useRoute, useRouter } from 'vue-router'
import CartDrawer from './CartDrawer.vue'
import CustomerProfileMenuButton from './CustomerProfileMenuButton.vue'
import FloatingCartButton from './FloatingCartButton.vue'
import { useCart } from '@/composables/useCart'
import { useCurrentStore } from '@/composables/useCurrentStore'
import { useCustomerProfile } from '@/composables/useCustomerProfile'
import { useStoreBranding } from '@/composables/useStoreBranding'
import { useToast } from '@/composables/useToast'
import { PublicRoutes } from '@/router/public.routes'
import { authService } from '@/services/auth.service'
import { deliveryRegionService } from '@/services/delivery-region.service'
import { Logger } from '@/services/logger'
import { extractCheckoutErrorMessage, orderService } from '@/services/order.service'
import productService from '@/services/product.service'
import { setSelectedStoreSlug } from '@/services/store-scope'
import { storeSettingsService } from '@/services/store-settings.service'
import type { DeliveryRegion } from '@/types/delivery'
import type { ProductDetail } from '@/types/product'
import { formatBRL } from '@/utils/formatters'
import { isLowStock } from '@/utils/stockAlerts'

const route = useRoute()
const router = useRouter()
const routeStoreSlug = typeof route.params?.storeSlug === 'string' ? route.params.storeSlug : ''
if (routeStoreSlug) {
  setSelectedStoreSlug(routeStoreSlug)
}
const toast = useToast()
const { profile: customerProfile, fetchCustomerProfile } = useCustomerProfile()
const { selectedStore, fetchCurrentStore } = useCurrentStore()
const storeBranding = useStoreBranding(selectedStore)

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
const product = ref<ProductDetail | null>(null)
const deliveryRegions = ref<DeliveryRegion[]>([])
const storeWhatsAppPhone = ref('')
const activeImage = ref<string | null>(null)
const isLoading = ref(true)
const isCartOpen = ref(false)

// Guest checkout reinstated: refresh the profile whenever the cart opens so
// CartDrawer decides which fields to show from fresh data (covers switching
// stores mid-SPA-session without a reload). Guard matches
// CustomerProfileMenuButton's own pattern so an anonymous visitor never
// fires a doomed 401 fetch.
function openCart(): void {
  isCartOpen.value = true
  if (authService.isAuthenticated()) {
    void fetchCustomerProfile()
  }
}

const isSubmittingOrder = ref(false)
const isDeliveryRegionsLoading = ref(false)
const errorMessage = ref('')
const quantity = ref(1)
const slideTransitionName = ref('carousel-slide-next')
const isCarouselPaused = ref(false)
const isShareCopied = ref(false)
const pointerStartX = ref<number | null>(null)
const pointerDeltaX = ref(0)
const activePointerId = ref<number | null>(null)
let carouselInterval: ReturnType<typeof setInterval> | null = null
let shareFeedbackTimeout: ReturnType<typeof setTimeout> | null = null

const {
  items,
  customer,
  itemCount,
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
} = useCart()

const productDescription = computed(() => (
  product.value?.description?.trim()
    || 'Peca selecionada para uma compra simples, com informacoes essenciais reunidas em uma unica tela.'
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

const isWhatsAppConfigured = computed(() => storeWhatsAppPhone.value.length > 0)

const availabilityLabel = computed(() => {
  if (!product.value?.is_available) {
    return 'Indisponivel'
  }

  return isLowStock(product.value) ? 'Ultimas unidades' : 'Disponivel'
})

const availabilityToneClass = computed(() => (
  product.value?.is_available ? 'text-[#D81B60]' : 'text-slate-600'
))

const addToCartLabel = computed(() => {
  if (!product.value?.is_available) {
    return 'Indisponivel'
  }

  if (quantity.value > 1) {
    return `Adicionar ${quantity.value}`
  }

  return 'Adicionar ao pedido'
})

function getProductShareUrl(): string {
  if (typeof window !== 'undefined' && window.location.href) {
    return window.location.href
  }

  return ''
}

function isShareAbortError(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'name' in error
    && error.name === 'AbortError'
}

function clearShareCopiedFeedback(): void {
  if (shareFeedbackTimeout) {
    clearTimeout(shareFeedbackTimeout)
    shareFeedbackTimeout = null
  }

  isShareCopied.value = false
}

function showShareCopiedFeedback(): void {
  clearShareCopiedFeedback()
  isShareCopied.value = true
  shareFeedbackTimeout = setTimeout(() => {
    isShareCopied.value = false
    shareFeedbackTimeout = null
  }, 2200)
}

async function copyProductShareUrl(shareUrl: string): Promise<boolean> {
  if (!navigator.clipboard?.writeText) {
    return false
  }

  try {
    await navigator.clipboard.writeText(shareUrl)
    showShareCopiedFeedback()
    toast.success('Link do produto copiado.')
    return true
  } catch (error) {
    Logger.warn('Failed to copy public product share URL', {
      shareUrl,
      error: error instanceof Error ? error.message : 'unknown_error',
    })
    return false
  }
}

async function handleShareProduct(): Promise<void> {
  if (!product.value) {
    return
  }

  const shareUrl = getProductShareUrl()

  if (!shareUrl) {
    toast.error('Nao foi possivel compartilhar o link agora.')
    return
  }

  const sharePayload = {
    title: product.value.name,
    text: `${product.value.name} • ${formatBRL(product.value.price)}`,
    url: shareUrl,
  }

  if (typeof navigator.share === 'function') {
    try {
      await navigator.share(sharePayload)
      return
    } catch (error) {
      if (isShareAbortError(error)) {
        return
      }

      Logger.warn('Native public product share failed, falling back to clipboard', {
        shareUrl,
        error: error instanceof Error ? error.message : 'unknown_error',
      })
    }
  }

  const copied = await copyProductShareUrl(shareUrl)

  if (!copied) {
    toast.error('Nao foi possivel compartilhar o link agora.')
  }
}

async function loadProduct(): Promise<void> {
  const slug = typeof route.params.slug === 'string' ? route.params.slug : ''
  // Etapa 4 of the QR-code stock-exit evolution: a printed QR's deep-link
  // URL (/l/:storeSlug/p/:code) resolves the product by its public_code
  // instead of by slug -- same view, different lookup key.
  const code = typeof route.params.code === 'string' ? route.params.code : ''

  if (!slug && !code) {
    errorMessage.value = 'Produto invalido.'
    isLoading.value = false
    return
  }

  isLoading.value = true
  errorMessage.value = ''

  try {
    product.value = code
      ? await productService.getPublicByCode(code)
      : await productService.getPublicBySlug(slug)
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
      code,
      error: error instanceof Error ? error.message : 'unknown_error',
    })
  } finally {
    isLoading.value = false
  }
}

async function loadStoreSettings(): Promise<void> {
  try {
    const settings = await storeSettingsService.getPublic()
    storeWhatsAppPhone.value = settings.whatsapp_phone_digits
  } catch (error) {
    storeWhatsAppPhone.value = ''
    Logger.warn('Failed to load public store settings from product detail', {
      error: error instanceof Error ? error.message : 'unknown_error',
    })
  }
}

async function loadDeliveryRegions(): Promise<void> {
  isDeliveryRegionsLoading.value = true

  try {
    deliveryRegions.value = await deliveryRegionService.getActive()

    const selectedRegion = deliveryRegions.value.find(
      (region) => region.id === customer.value.deliveryRegionId
    )

    if (customer.value.deliveryRegionId && !selectedRegion) {
      updateCustomer({
        deliveryRegionId: null,
        deliveryRegionName: '',
        deliveryRegionFee: 0,
      })
    }

    if (
      customer.value.deliveryMethod === 'delivery'
      && !customer.value.deliveryRegionId
      && deliveryRegions.value.length === 1
    ) {
      const [region] = deliveryRegions.value
      if (!region) {
        return
      }

      updateCustomer({
        deliveryRegionId: region.id,
        deliveryRegionName: region.name,
        deliveryRegionFee: Number(region.delivery_fee),
      })
    }
  } catch (error) {
    deliveryRegions.value = []
    Logger.warn('Failed to load public delivery regions from product detail', {
      error: error instanceof Error ? error.message : 'unknown_error',
    })
  } finally {
    isDeliveryRegionsLoading.value = false
  }
}

onMounted(() => {
  void Promise.allSettled([
    fetchCurrentStore(),
    loadDeliveryRegions(),
    loadStoreSettings(),
  ])
})

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

// Separate watcher (not merged with the one above) because Vue's watch only
// re-fires when the *watched* value itself changes -- navigating between
// two code-anchored products never touches route.params.slug (always
// undefined on this route), so that watcher alone would miss it.
watch(
  () => route.params.code,
  (code) => {
    if (typeof code === 'string' && code.trim()) {
      void loadProduct()
    }
  }
)

watch(
  () => route.params?.storeSlug,
  (storeSlug) => {
    if (typeof storeSlug === 'string' && storeSlug.trim()) {
      setSelectedStoreSlug(storeSlug)
      void Promise.allSettled([
        fetchCurrentStore(true),
        loadDeliveryRegions(),
        loadStoreSettings(),
        loadProduct(),
      ])
    }
  }
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
  toast.success(`${quantity.value} unidade(s) de ${product.value.name} adicionada(s) ao pedido.`)
  quantity.value = 1
}

function goBackToCatalog(): void {
  const storeSlug = typeof route.params.storeSlug === 'string' ? route.params.storeSlug : ''

  void router.push(
    storeSlug
      ? { name: PublicRoutes.StoreProducts, params: { storeSlug } }
      : { name: PublicRoutes.Products }
  )
}

function canOpenWhatsAppCheckout(): boolean {
  if (items.value.length === 0) {
    toast.info('Adicione produtos ao pedido antes de finalizar pelo WhatsApp.')
    return false
  }

  return true
}

async function handleSubmitOrder(): Promise<void> {
  if (!canOpenWhatsAppCheckout() || isSubmittingOrder.value) {
    return
  }

  isSubmittingOrder.value = true

  try {
    const checkout = await orderService.checkoutViaWhatsApp(items.value, customer.value)

    if (checkout.whatsapp_url) {
      const openedWindow = window.open(checkout.whatsapp_url, '_blank', 'noopener,noreferrer')
      if (!openedWindow) {
        window.location.href = checkout.whatsapp_url
      }
      toast.success(`Pedido ${checkout.order_reference} registrado. Abrimos o WhatsApp para atendimento.`)
    } else {
      toast.error('Pedido registrado, mas o WhatsApp da loja nao esta configurado.')
    }

    clearCart()
    resetCustomer()
    isCartOpen.value = false
    await loadProduct()
  } catch (error) {
    Logger.warn('Failed to register WhatsApp checkout from product detail', {
      error: error instanceof Error ? error.message : 'unknown_error',
    })
    toast.error(extractCheckoutErrorMessage(error))
  } finally {
    isSubmittingOrder.value = false
  }
}

onBeforeUnmount(() => {
  stopCarousel()
  clearShareCopiedFeedback()
})
</script>

<style scoped>
.storefront-shell {
  background: var(--store-background);
  color: var(--store-text);
}

.storefront-header {
  background: var(--store-background);
  border-color: color-mix(in srgb, var(--store-muted) 22%, transparent);
}

.storefront-muted {
  color: var(--store-muted);
}

.storefront-outline-button {
  border-color: color-mix(in srgb, var(--store-muted) 42%, transparent);
  color: var(--store-text);
}

.storefront-outline-button:hover {
  border-color: var(--store-accent);
  color: var(--store-accent);
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
