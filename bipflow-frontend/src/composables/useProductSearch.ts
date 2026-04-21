import { computed, nextTick, onBeforeUnmount, ref, watch, type ComputedRef, type Ref } from 'vue'
import productService from '@/services/product.service'
import { Logger } from '@/services/logger'
import type { PaginatedProductsResponse, Product, ProductFilters } from '@/types/product'
import { debounce } from '@/utils/debounce'

export interface UseProductSearchOptions {
  pageSize?: number
  debounceDelay?: number
  cacheDuration?: number
  initialFilters?: Partial<ProductFilters>
  initialPage?: number
}

export interface UseProductSearchReturn {
  products: Ref<Product[]>
  isLoading: Ref<boolean>
  isInitialLoading: Ref<boolean>
  isLoadingMore: Ref<boolean>
  error: Ref<string | null>
  page: Ref<number>
  pageSize: Ref<number>
  totalCount: Ref<number>
  totalPages: Ref<number>
  filters: Ref<ProductFilters>
  hasNextPage: ComputedRef<boolean>
  hasPreviousPage: ComputedRef<boolean>
  isFirstPage: ComputedRef<boolean>
  isLastPage: ComputedRef<boolean>
  showingRange: ComputedRef<string>
  fetchProducts: () => Promise<void>
  updateFilters: (newFilters: Partial<ProductFilters>) => void
  clearFilters: () => void
  goToPage: (pageNumber: number) => void
  nextPage: (append?: boolean) => void
  previousPage: () => void
  resetSearch: () => void
}

function normalizeFilters(filters: Partial<ProductFilters>): ProductFilters {
  return {
    search: filters.search?.trim() || '',
    categoryId: filters.categoryId,
    priceMin: filters.priceMin,
    priceMax: filters.priceMax,
    inStockOnly: filters.inStockOnly ?? false,
  }
}

export const useProductSearch = (
  options: UseProductSearchOptions = {}
): UseProductSearchReturn => {
  const {
    pageSize: initialPageSize = 12,
    debounceDelay = 300,
    cacheDuration = 5 * 60 * 1000,
    initialFilters = {},
    initialPage = 1,
  } = options

  const products = ref<Product[]>([])
  const isLoading = ref(false)
  const isInitialLoading = ref(false)
  const isLoadingMore = ref(false)
  const error = ref<string | null>(null)
  const page = ref(Math.max(1, initialPage))
  const pageSize = ref(initialPageSize)
  const totalCount = ref(0)
  const totalPages = ref(0)
  const filters = ref<ProductFilters>(normalizeFilters(initialFilters))

  const cache = new Map<string, { data: PaginatedProductsResponse; timestamp: number }>()
  let lastIssuedRequest = 0

  const hasNextPage = computed(() => page.value < totalPages.value)
  const hasPreviousPage = computed(() => page.value > 1)
  const isFirstPage = computed(() => page.value === 1)
  const isLastPage = computed(() => page.value === totalPages.value)

  const showingRange = computed(() => {
    if (totalCount.value === 0) {
      return 'Nenhum produto encontrado'
    }

    const start = (page.value - 1) * pageSize.value + 1
    const end = Math.min(page.value * pageSize.value, totalCount.value)

    return `Exibindo ${start}-${end} de ${totalCount.value} produtos`
  })

  const getCacheKey = (): string =>
    JSON.stringify({
      ...filters.value,
      page: page.value,
      pageSize: pageSize.value,
    })

  const isCacheValid = (timestamp: number): boolean =>
    Date.now() - timestamp < cacheDuration

  const updateStateFromResponse = (
    response: PaginatedProductsResponse,
    append = false
  ): void => {
    products.value = append ? [...products.value, ...response.results] : response.results
    totalCount.value = response.count
    totalPages.value = response.total_pages
  }

  const fetchProductsInternal = async (append = false): Promise<void> => {
    if (isInitialLoading.value || isLoadingMore.value) {
      return
    }

    isLoading.value = true
    isInitialLoading.value = !append
    isLoadingMore.value = append
    error.value = null

    const requestId = ++lastIssuedRequest
    const cacheKey = getCacheKey()
    const cached = cache.get(cacheKey)

    if (cached && isCacheValid(cached.timestamp)) {
      Logger.debug('Using cached public products response', {
        cacheKey,
        page: page.value,
        append,
      })
      updateStateFromResponse(cached.data, append)
      isLoading.value = false
      isInitialLoading.value = false
      isLoadingMore.value = false
      return
    }

    try {
      const response = await productService.list(filters.value, page.value, pageSize.value)

      if (requestId !== lastIssuedRequest) {
        return
      }

      cache.set(cacheKey, {
        data: response,
        timestamp: Date.now(),
      })

      updateStateFromResponse(response, append)
      Logger.debug('Public products fetched successfully', {
        page: page.value,
        resultCount: response.results.length,
        totalCount: response.count,
        append,
      })
    } catch (err) {
      if (append) {
        page.value = Math.max(1, page.value - 1)
      }

      error.value = err instanceof Error ? err.message : 'Erro ao carregar produtos'
      Logger.error('Public product fetch failed', {
        append,
        page: page.value,
        error: error.value,
      })
    } finally {
      isLoading.value = false
      isInitialLoading.value = false
      isLoadingMore.value = false
    }
  }

  const debouncedSearch = debounce(async () => {
    await fetchProductsInternal()
  }, { delay: debounceDelay })

  const fetchProducts = async (): Promise<void> => {
    await fetchProductsInternal()
  }

  const updateFilters = (newFilters: Partial<ProductFilters>): void => {
    filters.value = normalizeFilters({
      ...filters.value,
      ...newFilters,
    })
    page.value = 1
    cache.clear()

    if ('search' in newFilters) {
      debouncedSearch()
      return
    }

    void fetchProductsInternal()
  }

  const clearFilters = (): void => {
    filters.value = normalizeFilters({})
    page.value = 1
    cache.clear()
    void fetchProductsInternal()
  }

  const goToPage = (pageNumber: number): void => {
    if (
      pageNumber < 1 ||
      pageNumber > totalPages.value ||
      pageNumber === page.value ||
      isLoading.value
    ) {
      return
    }

    page.value = pageNumber
    void fetchProductsInternal()
  }

  const nextPage = (append = false): void => {
    if (!hasNextPage.value || isLoading.value) {
      return
    }

    page.value += 1
    void fetchProductsInternal(append)
  }

  const previousPage = (): void => {
    if (!hasPreviousPage.value || isLoading.value) {
      return
    }

    page.value -= 1
    void fetchProductsInternal()
  }

  const resetSearch = (): void => {
    cache.clear()
    clearFilters()
  }

  watch(pageSize, () => {
    page.value = 1
    cache.clear()
    void fetchProductsInternal()
  })

  onBeforeUnmount(() => {
    debouncedSearch.cancel()
  })

  nextTick(() => {
    void fetchProductsInternal()
  })

  return {
    products,
    isLoading,
    isInitialLoading,
    isLoadingMore,
    error,
    page,
    pageSize,
    totalCount,
    totalPages,
    filters,
    hasNextPage,
    hasPreviousPage,
    isFirstPage,
    isLastPage,
    showingRange,
    fetchProducts,
    updateFilters,
    clearFilters,
    goToPage,
    nextPage,
    previousPage,
    resetSearch,
  }
}
