<template>
  <div class="min-h-screen bg-gray-50">
    <header class="border-b border-gray-200 bg-white shadow-sm">
      <div class="mx-auto flex max-w-7xl items-center justify-between px-4 py-6 sm:px-6 lg:px-8">
        <div>
          <h1 class="text-3xl font-bold text-gray-900">Produtos</h1>
          <p class="mt-1 text-sm text-gray-600">
            Descubra nossa seleção completa de produtos.
          </p>
        </div>

        <div v-if="!isInitialLoading" class="text-right">
          <p class="text-sm text-gray-600">{{ showingRange }}</p>
        </div>
      </div>
    </header>

    <main
      class="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"
      :aria-busy="isLoading ? 'true' : 'false'"
    >
      <p class="sr-only" aria-live="polite">{{ liveRegionMessage }}</p>

      <div class="grid grid-cols-1 gap-8 lg:grid-cols-4">
        <div class="lg:col-span-1">
          <ProductFilters
            :filters="filters"
            :categories="categories"
            @update-filters="handleUpdateFilters"
            @clear-filters="handleClearFilters"
          />
        </div>

        <div class="lg:col-span-3">
          <div v-if="isInitialLoading && products.length === 0" class="space-y-6">
            <div
              v-for="n in 6"
              :key="n"
              class="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm animate-pulse"
            >
              <div class="aspect-square bg-gray-200" />
              <div class="space-y-3 p-4">
                <div class="h-4 w-1/4 rounded bg-gray-200" />
                <div class="h-6 rounded bg-gray-200" />
                <div class="h-4 w-1/2 rounded bg-gray-200" />
                <div class="flex justify-between">
                  <div class="h-6 w-1/4 rounded bg-gray-200" />
                  <div class="h-4 w-1/3 rounded bg-gray-200" />
                </div>
              </div>
            </div>
          </div>

          <div
            v-else-if="error && products.length === 0"
            class="rounded-lg border border-red-200 bg-white p-8 text-center"
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
            <h2 class="mb-2 text-lg font-medium text-gray-900">Erro ao carregar produtos</h2>
            <p class="mb-6 text-gray-600">{{ error }}</p>
            <button
              type="button"
              aria-label="Tentar novamente"
              class="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              @click="retryFetch"
            >
              <svg class="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Tentar novamente
            </button>
          </div>

          <div
            v-else-if="products.length > 0"
            class="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3"
          >
            <ProductCard
              v-for="product in products"
              :key="product.id"
              :product="product"
            />
          </div>

          <div
            v-else
            class="rounded-lg border border-gray-200 bg-white p-12 text-center"
          >
            <div class="mb-4 text-gray-400">
              <svg class="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2M4 13h2m8-5v2m0 0v2m0-2h2m-2 0h-2"
                />
              </svg>
            </div>
            <h2 class="mb-2 text-lg font-medium text-gray-900">Nenhum produto encontrado</h2>
            <p class="mb-6 text-gray-600">
              Tente ajustar os filtros ou fazer uma nova busca.
            </p>
            <button
              type="button"
              aria-label="Limpar filtros"
              class="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              @click="handleClearFilters"
            >
              Limpar filtros
            </button>
          </div>

          <div
            v-if="products.length > 0 && isLoadingMore"
            class="mt-6 flex items-center justify-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 shadow-sm"
            aria-live="polite"
          >
            <span class="h-4 w-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
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
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter, type LocationQuery, type LocationQueryValue } from 'vue-router'
import ProductCard from './ProductCard.vue'
import ProductFilters from './ProductFilters.vue'
import ProductPagination from './ProductPagination.vue'
import { useProductSearch } from '@/composables/useProductSearch'
import type { Category } from '@/schemas/category.schema'
import { categoryService } from '@/services/category.service'
import { Logger } from '@/services/logger'
import type { ProductFilters as ProductFilterState } from '@/types/product'

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
const loadMoreTrigger = ref<HTMLDivElement | null>(null)
const categories = ref<Category[]>([])

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

let loadMoreObserver: IntersectionObserver | null = null
let isSyncingRouteState = false

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

function connectLoadMoreObserver(): void {
  if (!loadMoreTrigger.value) {
    return
  }

  loadMoreObserver = new IntersectionObserver(
    (entries) => {
      const [entry] = entries

      if (!entry?.isIntersecting || isInitialLoading.value || isLoadingMore.value || !hasNextPage.value) {
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
  await loadCategories()
  await nextTick()
  connectLoadMoreObserver()
})

onBeforeUnmount(() => {
  disconnectLoadMoreObserver()
})

function handleUpdateFilters(newFilters: Partial<ProductFilterState>): void {
  updateFilters(newFilters)
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
</script>
