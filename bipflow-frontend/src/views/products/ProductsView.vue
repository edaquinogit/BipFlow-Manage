<template>
  <div class="min-h-screen bg-[#FAFAFA] text-[#05050A]">
    <header class="border-b border-[#E5E7EB] bg-[#FAFAFA]">
      <div class="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex items-center gap-3">
            <div class="flex h-12 w-32 shrink-0 items-center justify-center overflow-hidden">
              <img
                :src="BRAND_LOGO_URL"
                alt="KN Boutique Fitness"
                class="h-full w-full object-contain"
              />
            </div>
            <div>
              <p class="brand-wordmark brand-wordmark-premium text-xl">KN Boutique Fitness</p>
              <p class="text-sm text-[#6B7280]">Fitness, praia e movimento</p>
            </div>
          </div>

          <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              class="inline-flex h-11 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#FCE7F3]"
              :class="itemCount > 0
                ? 'border-[#05050A] bg-[#05050A] text-white shadow-[0_12px_28px_-18px_rgba(5,5,10,0.8)] hover:bg-[#D81B60] hover:border-[#D81B60]'
                : 'border-[#D1D5DB] bg-white text-[#05050A] hover:border-[#D81B60]'"
              @click="isCartOpen = true"
            >
              <ShoppingBagIcon class="h-4 w-4" aria-hidden="true" />
              <span>Pedido</span>
              <span :class="itemCount > 0 ? 'text-white/75' : 'text-[#6B7280]'">
                {{ itemCount }} item<span v-if="itemCount !== 1">s</span>
              </span>
              <span class="font-semibold">{{ formatBRL(subtotal) }}</span>
            </button>
          </div>
        </div>

        <section class="mt-5 rounded-xl border border-[#E5E7EB] bg-white px-4 py-5 sm:px-6">
          <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div class="max-w-2xl">
              <div class="flex items-center gap-3">
                <span class="h-px w-10 bg-[#D81B60]" aria-hidden="true" />
                <p class="brand-wordmark brand-wordmark-premium text-xl sm:text-2xl">
                  KN Boutique Fitness
                </p>
              </div>
              <h1 class="hero-display-title mt-3 max-w-2xl text-3xl font-semibold text-[#05050A] sm:text-4xl">
                Escolha seu look fitness
              </h1>
              <p class="premium-copy mt-3 max-w-xl text-base leading-7 text-[#6B7280]">
                Pecas selecionadas para treinar, caminhar e viver com conforto, estilo e presenca.
              </p>
            </div>

            <button
              type="button"
              class="inline-flex h-11 w-fit items-center justify-center gap-2 rounded-lg bg-[#05050A] px-4 text-sm font-semibold text-white transition hover:bg-[#D81B60] focus:outline-none focus:ring-2 focus:ring-[#FCE7F3]"
              @click="isCartOpen = true"
            >
              <ChatBubbleBottomCenterTextIcon class="h-4 w-4" aria-hidden="true" />
              Monte seu pedido e finalize pelo WhatsApp
            </button>
          </div>
        </section>

        <div class="mt-4 rounded-xl border border-[#E5E7EB] bg-white p-3">
          <div class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_13rem]">
            <label class="relative min-w-0 flex-1">
              <span class="sr-only">Buscar produtos</span>
              <MagnifyingGlassIcon
                class="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#9CA3AF]"
                aria-hidden="true"
              />
              <input
                :value="filters.search"
                type="search"
                class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white pl-10 pr-4 text-sm text-[#05050A] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
                placeholder="Buscar produto"
                aria-label="Buscar produtos por nome"
                @input="handleSearchInput"
              />
            </label>

            <label class="block">
              <span class="sr-only">Ordenacao</span>
              <select
                v-model="sortBy"
                class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
              >
                <option value="featured">Mais relevantes</option>
                <option value="price-asc">Menor preco</option>
                <option value="price-desc">Maior preco</option>
                <option value="name-asc">Nome A-Z</option>
                <option value="newest">Mais recentes</option>
              </select>
            </label>
          </div>

          <div class="no-scrollbar mt-3 overflow-x-auto">
            <div class="flex min-w-max gap-2">
              <button
                type="button"
                class="rounded-full border px-4 py-2 text-sm font-medium transition"
                :class="!filters.categoryId
                  ? 'border-[#05050A] bg-[#05050A] text-white'
                  : 'border-[#E5E7EB] bg-white text-[#6B7280] hover:border-[#D81B60] hover:text-[#05050A]'"
                @click="handleQuickCategory(undefined)"
              >
                Todas as categorias
              </button>

              <button
                v-for="category in categories"
                :key="category.id"
                type="button"
                class="rounded-full border px-4 py-2 text-sm font-medium transition"
                :class="filters.categoryId === category.id
                  ? 'border-[#05050A] bg-[#05050A] text-white'
                  : 'border-[#E5E7EB] bg-white text-[#6B7280] hover:border-[#D81B60] hover:text-[#05050A]'"
                @click="handleQuickCategory(category.id)"
              >
                {{ category.name }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>

    <main
      class="mx-auto max-w-7xl px-4 py-6 pb-24 sm:px-6 lg:px-8"
      :aria-busy="isLoading ? 'true' : 'false'"
    >
      <p class="sr-only" aria-live="polite">{{ liveRegionMessage }}</p>

      <div class="mb-6 flex items-center justify-between gap-4 text-sm text-[#6B7280]">
        <p>{{ showingRange }}</p>
        <button
          v-if="filters.search || filters.categoryId"
          type="button"
          class="font-medium text-[#05050A] underline-offset-4 hover:text-[#D81B60] hover:underline"
          @click="handleClearFilters"
        >
          Limpar filtros
        </button>
      </div>

      <div v-if="isInitialLoading && products.length === 0" class="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:gap-x-5 xl:grid-cols-4">
        <div
          v-for="n in 8"
          :key="n"
          class="animate-pulse"
        >
          <div class="aspect-[4/5] rounded-lg bg-[#F4F1F3]" />
          <div class="space-y-3 pt-4">
            <div class="h-4 w-2/3 rounded bg-slate-200" />
            <div class="h-7 w-1/2 rounded bg-slate-200" />
            <div class="h-10 rounded-lg bg-slate-200" />
          </div>
        </div>
      </div>

      <div
        v-else-if="error && products.length === 0"
        class="mx-auto max-w-xl py-24 text-center"
      >
        <div class="mb-4 text-red-600">
          <svg class="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>
        <h2 class="mb-2 text-lg font-medium text-[#05050A]">Erro ao carregar produtos</h2>
        <p class="mb-6 text-[#6B7280]">{{ error }}</p>
        <button
          type="button"
          aria-label="Tentar novamente"
          class="inline-flex items-center rounded-lg bg-[#05050A] px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-[#D81B60] focus:outline-none focus:ring-2 focus:ring-[#FCE7F3] focus:ring-offset-2"
          @click="retryFetch"
        >
          Tentar novamente
        </button>
      </div>

      <div
        v-else-if="displayedProducts.length > 0"
        class="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:gap-x-5 lg:gap-y-8 xl:grid-cols-4"
      >
        <ProductCard
          v-for="product in displayedProducts"
          :key="product.id"
          :product="product"
          :cart-quantity="getProductQuantity(product.id)"
          @add-to-cart="handleAddToCart"
          @open-details="handleOpenDetails"
        />
      </div>

      <div
        v-else
        class="mx-auto max-w-xl py-24 text-center"
      >
        <div class="mb-4 text-slate-400">
          <svg class="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2M4 13h2m8-5v2m0 0v2m0-2h2m-2 0h-2"
            />
          </svg>
        </div>
        <h2 class="mb-2 text-lg font-medium text-[#05050A]">Nenhum produto encontrado</h2>
        <p class="mb-6 text-[#6B7280]">
          Escolha outra categoria para continuar explorando.
        </p>
        <button
          type="button"
          aria-label="Limpar filtros"
          class="inline-flex items-center rounded-lg border border-[#D1D5DB] bg-white px-5 py-3 text-sm font-medium text-[#05050A] transition-colors hover:border-[#D81B60] hover:text-[#D81B60] focus:outline-none focus:ring-2 focus:ring-[#FCE7F3] focus:ring-offset-2"
          @click="handleClearFilters"
        >
          Limpar filtros
        </button>
      </div>

      <div
        v-if="products.length > 0 && isLoadingMore"
        class="mt-10 flex items-center justify-center gap-3 text-sm text-[#6B7280]"
        aria-live="polite"
      >
        <span class="h-4 w-4 animate-spin rounded-full border-2 border-[#E5E7EB] border-t-[#D81B60]" />
        Carregando mais produtos...
      </div>

      <div
        v-if="products.length > 0 && hasNextPage"
        ref="loadMoreTrigger"
        class="mt-4 h-1 w-full"
        aria-hidden="true"
      />

      <div v-if="totalPages > 1" class="mt-8">
        <ProductPagination
          :current-page="page"
          :total-pages="totalPages"
          :has-previous-page="hasPreviousPage"
          :has-next-page="hasNextPage"
          :showing-range="showingRange"
          @go-to-page="handleGoToPage"
          @next-page="nextPage"
          @previous-page="previousPage"
        />
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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter, type LocationQuery, type LocationQueryValue } from 'vue-router'
import { PublicRoutes } from '@/router/public.routes'
import CartDrawer from './CartDrawer.vue'
import FloatingCartButton from './FloatingCartButton.vue'
import ProductCard from './ProductCard.vue'
import ProductPagination from './ProductPagination.vue'
import {
  ChatBubbleBottomCenterTextIcon,
  MagnifyingGlassIcon,
  ShoppingBagIcon,
} from '@heroicons/vue/24/outline'
import { useCart } from '@/composables/useCart'
import { useProductSearch } from '@/composables/useProductSearch'
import { useToast } from '@/composables/useToast'
import type { Category } from '@/schemas/category.schema'
import { categoryService } from '@/services/category.service'
import { Logger } from '@/services/logger'
import { orderService } from '@/services/order.service'
import { storeSettingsService } from '@/services/store-settings.service'
import type { Product, ProductFilters as ProductFilterState, ProductSortOption } from '@/types/product'
import { formatBRL } from '@/utils/formatters'

function parseNumberParam(
  value: LocationQueryValue | LocationQueryValue[] | undefined
): number | undefined {
  const normalizedValue = Array.isArray(value) ? value[0] : value

  if (typeof normalizedValue !== 'string' || normalizedValue.trim() === '') {
    return undefined
  }

  const parsedValue = Number(normalizedValue)
  return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : undefined
}

function parseFiltersFromQuery(query: LocationQuery): ProductFilterState {
  return {
    search: typeof query.search === 'string' ? query.search : '',
    categoryId: parseNumberParam(query.category),
    priceMin: parseNumberParam(query.minPrice),
    priceMax: parseNumberParam(query.maxPrice),
    inStockOnly: query.inStockOnly === 'true',
  }
}

function parsePageFromQuery(query: LocationQuery): number {
  const parsedPage = parseNumberParam(query.page)
  return parsedPage && parsedPage >= 1 ? parsedPage : 1
}

const BRAND_LOGO_URL = '/brand-logo.png'

const route = useRoute()
const router = useRouter()
const toast = useToast()
const loadMoreTrigger = ref<HTMLDivElement | null>(null)
const categories = ref<Category[]>([])
const storeWhatsAppPhone = ref('')
const isCartOpen = ref(false)
const isSubmittingOrder = ref(false)
const sortBy = ref<ProductSortOption>('featured')

const initialFilters = parseFiltersFromQuery(route.query)
const initialPage = parsePageFromQuery(route.query)

const {
  products,
  isLoading,
  isInitialLoading,
  isLoadingMore,
  error,
  page,
  totalPages,
  filters,
  hasNextPage,
  hasPreviousPage,
  showingRange,
  fetchProducts,
  updateFilters,
  clearFilters,
  goToPage,
  nextPage,
  previousPage,
} = useProductSearch({
  initialFilters,
  initialPage,
})

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

let loadMoreObserver: IntersectionObserver | null = null
let isSyncingRouteState = false

const displayedProducts = computed(() => {
  const nextProducts = [...products.value]

  switch (sortBy.value) {
    case 'price-asc':
      return nextProducts.sort((left, right) => Number(left.price) - Number(right.price))
    case 'price-desc':
      return nextProducts.sort((left, right) => Number(right.price) - Number(left.price))
    case 'name-asc':
      return nextProducts.sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'))
    case 'newest':
      return nextProducts.sort(
        (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
      )
    default:
      return nextProducts
  }
})

const isWhatsAppConfigured = computed(() => storeWhatsAppPhone.value.length > 0)

const liveRegionMessage = computed(() => {
  if (isInitialLoading.value) {
    return 'Carregando produtos.'
  }

  if (isLoadingMore.value) {
    return 'Carregando mais produtos.'
  }

  if (error.value) {
    return `Erro ao carregar produtos: ${error.value}`
  }

  if (products.value.length === 0) {
    return 'Nenhum produto encontrado.'
  }

  return `${products.value.length} produtos exibidos. ${showingRange.value}`
})

function buildQueryFromState(): Record<string, string> {
  const query: Record<string, string> = {}

  if (filters.value.search?.trim()) {
    query.search = filters.value.search.trim()
  }

  if (filters.value.categoryId) {
    query.category = String(filters.value.categoryId)
  }

  if (filters.value.priceMin !== undefined) {
    query.minPrice = String(filters.value.priceMin)
  }

  if (filters.value.priceMax !== undefined) {
    query.maxPrice = String(filters.value.priceMax)
  }

  if (filters.value.inStockOnly) {
    query.inStockOnly = 'true'
  }

  if (page.value > 1) {
    query.page = String(page.value)
  }

  return query
}

function syncRouteQuery(): void {
  const currentQuery = JSON.stringify(route.query)
  const nextQuery = JSON.stringify(buildQueryFromState())

  if (currentQuery === nextQuery) {
    return
  }

  isSyncingRouteState = true
  router.replace({ query: buildQueryFromState() }).finally(() => {
    isSyncingRouteState = false
  })
}

async function loadCategories(): Promise<void> {
  try {
    categories.value = await categoryService.getAll()
  } catch (err) {
    categories.value = []
    Logger.warn('Failed to load public categories', {
      error: err instanceof Error ? err.message : 'unknown_error',
    })
  }
}

async function loadStoreSettings(): Promise<void> {
  try {
    const settings = await storeSettingsService.getPublic()
    storeWhatsAppPhone.value = settings.whatsapp_phone_digits
  } catch (err) {
    storeWhatsAppPhone.value = ''
    Logger.warn('Failed to load public store settings', {
      error: err instanceof Error ? err.message : 'unknown_error',
    })
  }
}

function connectLoadMoreObserver(): void {
  if (!loadMoreTrigger.value) {
    return
  }

  loadMoreObserver = new IntersectionObserver(
    (entries) => {
      const [entry] = entries

      if (
        !entry?.isIntersecting ||
        isInitialLoading.value ||
        isLoadingMore.value ||
        !hasNextPage.value
      ) {
        return
      }

      nextPage(true)
    },
    {
      rootMargin: '200px 0px',
      threshold: 0.1,
    }
  )

  loadMoreObserver.observe(loadMoreTrigger.value)
}

function disconnectLoadMoreObserver(): void {
  loadMoreObserver?.disconnect()
  loadMoreObserver = null
}

watch(
  () => [
    filters.value.search,
    filters.value.categoryId,
    filters.value.priceMin,
    filters.value.priceMax,
    filters.value.inStockOnly,
    page.value,
  ],
  () => {
    if (!isSyncingRouteState) {
      syncRouteQuery()
    }
  }
)

watch(
  () => route.query,
  (query) => {
    if (isSyncingRouteState) {
      return
    }

    const nextFilters = parseFiltersFromQuery(query)
    const nextPageValue = parsePageFromQuery(query)
    const filtersChanged = JSON.stringify(filters.value) !== JSON.stringify(nextFilters)

    if (filtersChanged) {
      updateFilters(nextFilters)
      return
    }

    if (page.value !== nextPageValue) {
      goToPage(nextPageValue)
    }
  }
)

watch(loadMoreTrigger, async () => {
  disconnectLoadMoreObserver()
  await nextTick()
  connectLoadMoreObserver()
})

onMounted(async () => {
  await Promise.allSettled([
    loadCategories(),
    loadStoreSettings(),
  ])
  await nextTick()
  connectLoadMoreObserver()
})

onBeforeUnmount(() => {
  disconnectLoadMoreObserver()
})

function handleQuickCategory(categoryId: number | undefined): void {
  updateFilters({ categoryId })
}

function handleSearchInput(event: Event): void {
  const target = event.target as HTMLInputElement
  updateFilters({ search: target.value })
}

function handleClearFilters(): void {
  clearFilters()
}

function handleGoToPage(pageNumber: number): void {
  goToPage(pageNumber)
}

function retryFetch(): void {
  void fetchProducts()
}

function handleAddToCart(product: Product, quantity: number): void {
  addItem(product, quantity)
  toast.success(`${quantity} unidade(s) de ${product.name} adicionada(s) ao pedido.`)
}

function handleOpenDetails(product: Product): void {
  if (!product.slug) {
    return
  }

  void router.push({
    name: PublicRoutes.ProductDetails,
    params: { slug: product.slug },
  })
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
    Logger.warn('Failed to open WhatsApp checkout handoff', {
      error: error instanceof Error ? error.message : 'unknown_error',
    })
    toast.error('Nao foi possivel abrir o WhatsApp agora. Tente novamente.')
  } finally {
    isSubmittingOrder.value = false
  }
}
</script>
