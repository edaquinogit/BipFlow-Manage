<template>
  <div class="min-h-screen bg-[#FAFAFA] text-[#05050A]">
    <header class="border-b border-[#E5E7EB] bg-[#FAFAFA]">
      <div class="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <button
          type="button"
          class="inline-flex h-10 w-fit items-center gap-2 rounded-lg border border-[#D1D5DB] bg-white px-4 text-sm font-semibold text-[#05050A] transition hover:border-[#D81B60] hover:text-[#D81B60]"
          @click="goBackToCatalog"
        >
          <ArrowLeftIcon class="h-4 w-4" aria-hidden="true" />
          Voltar ao catalogo
        </button>

        <div class="flex items-center gap-3">
          <div class="flex h-12 w-32 shrink-0 items-center justify-center overflow-hidden">
            <img
              :src="BRAND_LOGO_URL"
              alt="KN Boutique Fitness"
              class="h-full w-full object-contain"
            />
          </div>
          <div>
            <p class="brand-wordmark brand-wordmark-premium text-lg">KN Boutique Fitness</p>
            <p class="text-xs text-[#6B7280]">Detalhe da peca</p>
          </div>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-7xl px-4 py-8 pb-24 sm:px-6 lg:px-8">
      <div v-if="isLoading" class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
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

      <div v-else class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start">
        <section class="min-w-0 space-y-4">
          <div
            class="w-full overflow-hidden rounded-lg bg-[#F4F1F3]"
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
                  class="h-full w-full select-none object-contain p-5 sm:p-8"
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

          <div v-if="productImages.length > 1" class="flex gap-3 overflow-x-auto pb-1">
            <button
              v-for="imageUrl in productImages"
              :key="imageUrl"
              type="button"
                class="h-20 w-20 shrink-0 overflow-hidden rounded-lg border bg-white transition sm:h-24 sm:w-24"
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
                />
              </div>
            </button>
          </div>
        </section>

        <aside class="min-w-0 lg:sticky lg:top-6 lg:self-start">
          <section class="w-full max-w-full">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <p class="text-sm font-semibold text-[#D81B60]">
                {{ product.category.name }}
              </p>
              <span
                class="rounded-full px-3 py-1 text-xs font-semibold"
                :class="product.is_available ? 'bg-[#FCE7F3] text-[#D81B60]' : 'bg-slate-100 text-slate-600'"
              >
                {{ availabilityLabel }}
              </span>
            </div>

            <h1 class="mt-3 text-3xl font-semibold leading-tight text-[#05050A] sm:text-4xl">
              {{ product.name }}
            </h1>

            <p class="mt-5 text-3xl font-semibold text-[#05050A]">
              {{ formatBRL(product.price) }}
            </p>

            <p class="mt-3 text-sm leading-6 text-slate-600">
              {{ productDescription }}
            </p>

            <dl class="mt-6 divide-y divide-[#E5E7EB] border-y border-[#E5E7EB] text-sm text-[#6B7280]">
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

            <div class="mt-6 border-t border-[#E5E7EB] pt-5">
              <div class="flex flex-col gap-4">
                <div class="flex items-center justify-between gap-4">
                  <div>
                    <p class="text-sm font-semibold text-[#05050A]">
                      Quantidade
                    </p>
                    <p class="mt-1 text-sm text-slate-600">
                      {{ cartQuantity > 0 ? `${cartQuantity} ja no pedido` : 'Selecione e confirme em um toque.' }}
                    </p>
                  </div>

                  <div class="inline-flex h-11 items-center rounded-lg border border-[#D1D5DB] bg-white">
                    <button
                      type="button"
                      class="inline-flex h-10 w-10 items-center justify-center text-[#6B7280] transition hover:bg-[#FAFAFA] disabled:cursor-not-allowed disabled:opacity-40"
                      :disabled="!product.is_available || quantity <= 1"
                      aria-label="Diminuir quantidade"
                      @click="decrementQuantity"
                    >
                      <MinusIcon class="h-4 w-4" aria-hidden="true" />
                    </button>
                    <span class="min-w-10 text-center text-sm font-semibold text-[#05050A]">
                      {{ quantity }}
                    </span>
                    <button
                      type="button"
                      class="inline-flex h-10 w-10 items-center justify-center text-[#6B7280] transition hover:bg-[#FAFAFA] disabled:cursor-not-allowed disabled:opacity-40"
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
                  class="inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#FCE7F3]"
                  :class="product.is_available
                    ? 'bg-[#05050A] text-white hover:bg-[#D81B60]'
                    : 'cursor-not-allowed bg-slate-200 text-slate-500'"
                  :disabled="!product.is_available"
                  @click="handleAddToCart"
                >
                  <ShoppingBagIcon class="h-4 w-4" aria-hidden="true" />
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
      @open-cart="isCartOpen = true"
    />

    <CartDrawer
      :is-open="isCartOpen"
      :items="items"
      :item-count="itemCount"
      :subtotal="subtotal"
      :is-submitting="isSubmittingOrder"
      :is-whats-app-configured="isWhatsAppConfigured"
      @close="isCartOpen = false"
      @clear-cart="clearCart"
      @remove-item="removeItem"
      @update-quantity="updateQuantity"
      @submit-order="handleSubmitOrder"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  ArrowLeftIcon,
  MinusIcon,
  PlusIcon,
  ShoppingBagIcon,
} from '@heroicons/vue/24/outline'
import { useRoute, useRouter } from 'vue-router'
import CartDrawer from './CartDrawer.vue'
import FloatingCartButton from './FloatingCartButton.vue'
import { useCart } from '@/composables/useCart'
import { useToast } from '@/composables/useToast'
import { PublicRoutes } from '@/router/public.routes'
import { Logger } from '@/services/logger'
import { orderService } from '@/services/order.service'
import productService from '@/services/product.service'
import { storeSettingsService } from '@/services/store-settings.service'
import type { ProductDetail } from '@/types/product'
import { formatBRL } from '@/utils/formatters'

const route = useRoute()
const router = useRouter()
const toast = useToast()

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
const BRAND_LOGO_URL = '/brand-logo.png'

const product = ref<ProductDetail | null>(null)
const storeWhatsAppPhone = ref('')
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
  itemCount,
  subtotal,
  addItem,
  removeItem,
  updateQuantity,
  clearCart,
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

  return product.value.stock_quantity <= 5 ? 'Ultimas unidades' : 'Disponivel'
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

onMounted(() => {
  void Promise.allSettled([
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
  void router.push({ name: PublicRoutes.Products })
}

function canOpenWhatsAppCheckout(): boolean {
  if (items.value.length === 0) {
    toast.info('Adicione produtos ao pedido antes de finalizar pelo WhatsApp.')
    return false
  }

  if (!isWhatsAppConfigured.value) {
    toast.info('WhatsApp da loja ainda nao esta configurado.')
    isCartOpen.value = true
    return false
  }

  return true
}

function handleSubmitOrder(): void {
  if (!canOpenWhatsAppCheckout() || isSubmittingOrder.value) {
    return
  }

  isSubmittingOrder.value = true

  try {
    const whatsappUrl = orderService.buildWhatsAppHandoffUrl(
      storeWhatsAppPhone.value,
      items.value,
      subtotal.value
    )

    window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
    toast.success('Abrimos o WhatsApp com o pedido pronto para atendimento.')

    clearCart()
    isCartOpen.value = false
  } catch (error) {
    Logger.warn('Failed to open WhatsApp checkout handoff from product detail', {
      error: error instanceof Error ? error.message : 'unknown_error',
    })
    toast.error('Nao foi possivel abrir o WhatsApp agora. Tente novamente.')
  } finally {
    isSubmittingOrder.value = false
  }
}

onBeforeUnmount(() => {
  stopCarousel()
})
</script>

<style scoped>
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
