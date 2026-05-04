<template>
  <div class="min-h-screen bg-slate-50">
    <header class="border-b border-slate-200 bg-white/90 backdrop-blur">
      <div class="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
        <div class="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div class="max-w-3xl">
            <p class="text-sm font-semibold uppercase tracking-[0.3em] text-rose-600">
              Catalogo BipFlow
            </p>
            <h1 class="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              Produtos para escolher rapido e comprar sem atrito
            </h1>
            <p class="mt-3 max-w-2xl text-base leading-7 text-slate-600">
              Uma vitrine mais leve, com foco no essencial: nome, preco e compra direta.
            </p>
          </div>

          <div class="w-full sm:max-w-xs">
            <label class="block">
              <span class="mb-2 block text-sm font-medium text-slate-700">Ordenacao</span>
              <select
                v-model="sortBy"
                class="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
              >
                <option value="featured">Mais relevantes</option>
                <option value="price-asc">Menor preco</option>
                <option value="price-desc">Maior preco</option>
                <option value="name-asc">Nome A-Z</option>
                <option value="newest">Mais recentes</option>
              </select>
            </label>
          </div>
        </div>

        <div class="overflow-x-auto pb-1">
          <div class="flex min-w-max gap-2">
            <button
              type="button"
              class="rounded-full px-4 py-2 text-sm font-medium transition"
              :class="!filters.categoryId
                ? 'bg-rose-600 text-white shadow-sm'
                : 'border border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-900'"
              @click="handleQuickCategory(undefined)"
            >
              Todas as categorias
            </button>

            <button
              v-for="category in categories"
              :key="category.id"
              type="button"
              class="rounded-full px-4 py-2 text-sm font-medium transition"
              :class="filters.categoryId === category.id
                ? 'bg-rose-600 text-white shadow-sm'
                : 'border border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-900'"
              @click="handleQuickCategory(category.id)"
            >
              {{ category.name }}
            </button>
          </div>
        </div>
      </div>
    </header>

    <main
      class="mx-auto max-w-7xl px-4 py-8 pb-24 sm:px-6 lg:px-8"
      :aria-busy="isLoading ? 'true' : 'false'"
    >
      <p class="sr-only" aria-live="polite">{{ liveRegionMessage }}</p>

      <div v-if="isInitialLoading && products.length === 0" class="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
        <div
          v-for="n in 8"
          :key="n"
          class="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm animate-pulse"
        >
          <div class="aspect-square bg-slate-200" />
          <div class="space-y-3 p-4">
            <div class="h-4 w-2/3 rounded bg-slate-200" />
            <div class="h-7 w-1/2 rounded bg-slate-200" />
            <div class="h-12 rounded-[20px] bg-slate-200" />
          </div>
        </div>
      </div>

      <div
        v-else-if="error && products.length === 0"
        class="rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-sm"
      >
        <div class="mb-4 text-rose-600">
          <svg class="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>
        <h2 class="mb-2 text-lg font-medium text-slate-900">Erro ao carregar produtos</h2>
        <p class="mb-6 text-slate-600">{{ error }}</p>
        <button
          type="button"
          aria-label="Tentar novamente"
          class="inline-flex items-center rounded-full bg-rose-600 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2"
          @click="retryFetch"
        >
          Tentar novamente
        </button>
      </div>

      <div
        v-else-if="displayedProducts.length > 0"
        class="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4"
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
        class="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm"
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
        <h2 class="mb-2 text-lg font-medium text-slate-900">Nenhum produto encontrado</h2>
        <p class="mb-6 text-slate-600">
          Escolha outra categoria para continuar explorando.
        </p>
        <button
          type="button"
          aria-label="Limpar filtros"
          class="inline-flex items-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2"
          @click="handleClearFilters"
        >
          Limpar filtros
        </button>
      </div>

      <div
        v-if="products.length > 0 && isLoadingMore"
        class="mt-6 flex items-center justify-center gap-3 rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm"
        aria-live="polite"
      >
        <span class="h-4 w-4 animate-spin rounded-full border-2 border-rose-200 border-t-rose-600" />
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

    <CatalogBotWidget @open-product="handleOpenBotProduct" />

    <CartDrawer
      :is-open="isCartOpen"
      :items="items"
      :customer="customer"
      :delivery-regions="deliveryRegions"
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
      @submit-order="handleSubmitOrder"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter, type LocationQuery, type LocationQueryValue } from 'vue-router'
import { PublicRoutes } from '@/router/public.routes'
import CartDrawer from './CartDrawer.vue'
import CatalogBotWidget from './CatalogBotWidget.vue'
import FloatingCartButton from './FloatingCartButton.vue'
import ProductCard from './ProductCard.vue'
import ProductPagination from './ProductPagination.vue'
import { useCart } from '@/composables/useCart'
import { useProductSearch } from '@/composables/useProductSearch'
import { useToast } from '@/composables/useToast'
import type { Category } from '@/schemas/category.schema'
import { categoryService } from '@/services/category.service'
import { deliveryRegionService } from '@/services/delivery-region.service'
import { Logger } from '@/services/logger'
import { orderService } from '@/services/order.service'
import type { DeliveryRegion } from '@/types/delivery'
import type { Product, ProductFilters as ProductFilterState, ProductSortOption } from '@/types/product'

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

const route = useRoute()
const router = useRouter()
const toast = useToast()
const loadMoreTrigger = ref<HTMLDivElement | null>(null)
const categories = ref<Category[]>([])
const deliveryRegions = ref<DeliveryRegion[]>([])
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

async function loadDeliveryRegions(): Promise<void> {
  try {
    deliveryRegions.value = await deliveryRegionService.getActive()
  } catch (err) {
    deliveryRegions.value = []
    Logger.warn('Failed to load delivery regions', {
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
    loadDeliveryRegions(),
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
  toast.success(`${quantity} unidade(s) de ${product.name} adicionada(s) ao carrinho.`)
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

function handleOpenBotProduct(slug: string): void {
  void router.push({
    name: PublicRoutes.ProductDetails,
    params: { slug },
  })
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
    if (deliveryRegions.value.length > 0 && !customer.value.deliveryRegionId) {
      toast.info('Selecione a regiao de entrega para calcular o frete.')
      isCartOpen.value = true
      return false
    }

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
    Logger.warn('Failed to finalize order via WhatsApp', {
      error: error instanceof Error ? error.message : 'unknown_error',
    })
    toast.error('Nao foi possivel finalizar o pedido agora. Revise os dados e tente novamente.')
  } finally {
    isSubmittingOrder.value = false
  }
}
</script>
