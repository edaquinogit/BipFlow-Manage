import {
  ref,
  computed,
  watch,
  onBeforeUnmount,
  getCurrentInstance,
  type WatchStopHandle,
} from "vue";
import type { Product } from "../schemas/product.schema";
import ProductService from "../services/product.service";
import { Logger } from "../services/logger";
import { useToast } from "./useToast";
import {
  isAxiosError,
  getErrorMessage,
  buildErrorContext,
  type ApplicationError,
} from "../types/errors";
import {
  type ProductFilterPayload,
  type FilterState,
  createDefaultFilterState,
  hasActiveFilters,
  DEFAULT_DEBOUNCE_CONFIG,
} from "../types/filters";
import { debounce } from "../utils/debounce";

/**
 * Product Management Composable
 *
 * Manages product state, CRUD operations, business logic calculations,
 * and advanced filtering with debounced search.
 *
 * Features:
 * - Full CRUD operations for products
 * - Server-side filtering with debouncing
 * - Real-time search across name, SKU, and description
 * - Category, availability, and price range filtering
 * - Automatic filter state persistence
 */
export function useProducts() {
  // ==========================================
  // STATE
  // ==========================================
  const products = ref<Product[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const toast = useToast();

  // 🔍 FILTER STATE
  const filters = ref<FilterState>(createDefaultFilterState());
  const isSearching = ref(false);

  // 🔄 BULK SELECTION STATE
  const selectedAssetIds = ref<Set<number>>(new Set());

  // Debounced search function (will be initialized below)
  let debouncedSearch: ReturnType<typeof debounce> | null = null;
  let stopFilterWatcher: WatchStopHandle | null = null;

  // ==========================================
  // HELPERS
  // ==========================================

  /**
   * Extract stock quantity from product, handling field name variations.
   *
   * Handles legacy/alternative field names to support multiple data sources.
   */
  const _getStockValue = (product: Product): number => {
    const stockValue = product.stock_quantity ??
                       (product as Record<string, unknown>).stock ??
                       0;
    return Number(stockValue);
  };

  /**
   * Convert product data to FormData for multipart uploads.
   *
   * Validates image file size and handles object references properly.
   * Omits null/undefined values to avoid sending unnecessary data.
   *
   * @param data Product data to convert
   * @returns FormData ready for API submission
   * @throws Error if image exceeds 2MB limit
   */
  const _preparePayload = (data: Partial<Product>): FormData => {
    const formData = new FormData();
    const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

    Object.entries(data).forEach(([key, value]) => {
      if (value === null || value === undefined || value === "") return;

      // Handle image file validation
      if (key === "image") {
        if (value instanceof File) {
          if (value.size > MAX_FILE_SIZE) {
            throw new Error("Image file size cannot exceed 2MB.");
          }
          formData.append(key, value);
        }
        // Skip string URLs to prevent overwriting binary with text
        return;
      }

      // Handle numeric fields
      if (key === "price" || key === "stock_quantity") {
        formData.append(key, String(value === "" ? 0 : value));
      }
      // Handle related objects (extract ID)
      else if (
        typeof value === "object" &&
        value !== null &&
        "id" in value
      ) {
        formData.append(key, String((value as Record<string, unknown>).id));
      }
      // Handle all other values as strings
      else {
        formData.append(key, String(value));
      }
    });

    return formData;
  };

  /**
   * Extract error message from API response.
   *
   * Handles various error response formats from backend, including
   * Django REST framework field validation errors.
   */
  const _extractErrorMessage = (error: unknown): string => {
    if (isAxiosError(error)) {
      const data = error.response?.data;

      // Handle Django REST framework field validation errors
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        const fieldErrors = Object.entries(data)
          .filter(([, value]) => Array.isArray(value) && value.length > 0)
          .map(([field, messages]) => `${field}: ${(messages as string[]).join(', ')}`)
          .join('; ');

        if (fieldErrors) {
          return fieldErrors;
        }
      }

      // Fallback to standard error formats
      return (
        data?.detail ||
        data?.message ||
        error.message ||
        "Unknown connection error"
      );
    }

    return getErrorMessage(error, "Unknown connection error");
  };

  // ==========================================
  // COMPUTED
  // ==========================================

  /**
   * Calculate total revenue from all products.
   *
   * Returns formatted currency string (USD).
   */
  const totalRevenue = computed(() => {
    const total = products.value.reduce((acc, product) => {
      const price = Number(product.price || 0);
      return acc + price * _getStockValue(product);
    }, 0);

    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(total);
  });

  /**
   * Calculate inventory statistics.
   *
   * Tracks total items and low-stock count (< 5 units).
   */
  const inventoryStats = computed(() => ({
    totalItems: products.value.reduce((acc, p) => acc + _getStockValue(p), 0),
    lowStockCount: products.value.filter((p) => _getStockValue(p) < 5).length,
  }));

  /**
   * Check if any filters are currently active.
   */
  const hasFilters = computed(() => hasActiveFilters(filters.value));

  /**
   * Check if search is currently processing.
   */
  const isFilteringActive = computed(() => isSearching.value);

  /**
   * Get filter payload for API requests.
   */
  const filterPayload = computed((): Partial<ProductFilterPayload> => ({
    search: filters.value.search || undefined,
    category: filters.value.categoryId || undefined,
    in_stock: filters.value.inStock ?? undefined,
    min_price: filters.value.minPrice ?? undefined,
    max_price: filters.value.maxPrice ?? undefined,
  }));

  // ==========================================
  // BULK SELECTION COMPUTED
  // ==========================================

  /**
   * Check if any assets are currently selected.
   */
  const hasSelectedAssets = computed(() => selectedAssetIds.value.size > 0);

  /**
   * Get the count of selected assets.
   */
  const selectedAssetsCount = computed(() => selectedAssetIds.value.size);

  /**
   * Check if all visible products are selected.
   */
  const isAllSelected = computed(() => {
    if (products.value.length === 0) return false;
    return products.value.every(product => product.id && selectedAssetIds.value.has(product.id));
  });

  /**
   * Check if some (but not all) products are selected.
   */
  const isIndeterminate = computed(() => {
    const selectedCount = selectedAssetIds.value.size;
    return selectedCount > 0 && selectedCount < products.value.length;
  });

  // ==========================================
  // ACTIONS
  // ==========================================

  /**
   * Fetch all products from backend.
   */
  const fetchData = async (): Promise<void> => {
    loading.value = true;
    error.value = null;
    try {
      products.value = await ProductService.getAll();
    } catch (err: unknown) {
      const errorMessage = _extractErrorMessage(err);
      error.value = `Failed to fetch products: ${errorMessage}`;
      Logger.error(
        "Failed to fetch products",
        buildErrorContext(err as ApplicationError, {
          errorMessage,
        })
      );
    } finally {
      loading.value = false;
    }
  };

  /**
   * Create a new product.
   *
   * Prepares FormData payload and submits to API.
   * Updates local state on success and shows user feedback.
   *
   * @param data Product data to create
   * @returns Created product or undefined if failed
   * @throws Error (after logging) if creation fails
   */
  const createProduct = async (
    data: Partial<Product>
  ): Promise<Product | undefined> => {
    loading.value = true;
    error.value = null;
    try {
      const payload = _preparePayload(data);
      const newProduct = await ProductService.create(payload);

      products.value = [newProduct, ...products.value];
      Logger.info(`Product created successfully [ID: ${newProduct.id}]`);
      toast.success("Product created successfully.");
      return newProduct;
    } catch (err: unknown) {
      const errorMessage = _extractErrorMessage(err);
      error.value = `Failed to create product: ${errorMessage}`;
      Logger.error(
        "Product creation failed",
        buildErrorContext(err as ApplicationError, {
          errorMessage,
          inputData: Object.fromEntries(
            Object.entries(data).filter(([_, v]) => !(v instanceof File))
          ),
        })
      );
      toast.error("Failed to create product. Please try again.");
      throw err;
    } finally {
      loading.value = false;
    }
  };

  /**
   * Update an existing product.
   *
   * @param id Product ID to update
   * @param data Partial product data
   * @returns Updated product
   * @throws Error (after logging) if update fails
   */
  const updateProduct = async (
    id: number,
    data: Partial<Product>
  ): Promise<Product> => {
    loading.value = true;
    error.value = null;
    try {
      const payload = _preparePayload(data);
      const updatedProduct = await ProductService.update(id, payload);

      products.value = products.value.map((p) =>
        p.id === id ? updatedProduct : p
      );
      Logger.info(`Product updated successfully [ID: ${id}]`);
      toast.success("Product updated successfully.");
      return updatedProduct;
    } catch (err: unknown) {
      const errorMessage = _extractErrorMessage(err);
      error.value = `Failed to update product: ${errorMessage}`;
      Logger.error(
        "Product update failed",
        buildErrorContext(err as ApplicationError, {
          errorMessage,
          productId: id,
        })
      );
      toast.error("Failed to update product. Please try again.");
      throw err;
    } finally {
      loading.value = false;
    }
  };

  /**
   * Delete a product.
   *
   * Removes product from backend and local state.
   *
   * @param id Product ID to delete
   * @throws Error (after logging) if deletion fails
   */
  const deleteProduct = async (id: number): Promise<void> => {
    loading.value = true;
    error.value = null;
    try {
      await ProductService.delete(id);
      products.value = products.value.filter((p) => p.id !== id);
      Logger.info(`Product deleted successfully [ID: ${id}]`);
      toast.success("Product deleted successfully.");
    } catch (err: unknown) {
      const errorMessage = _extractErrorMessage(err);
      error.value = `Failed to delete product: ${errorMessage}`;
      Logger.error(
        "Product deletion failed",
        buildErrorContext(err as ApplicationError, {
          errorMessage,
          productId: id,
        })
      );
      toast.error("Failed to delete product. Please try again.");
      throw err;
    } finally {
      loading.value = false;
    }
  };

  /**
   * Perform filtered search on products.
   *
   * Fetches products matching the current filter state from the backend.
   * Handles debouncing to prevent excessive API calls.
   *
   * @throws Error if search fails
   */
  const performSearch = async (): Promise<void> => {
    isSearching.value = true;
    error.value = null;

    try {
      if (hasFilters.value) {
        products.value = await ProductService.getFiltered(filterPayload.value);
        Logger.info("Filtered search completed", {
          filterCount: Object.values(filterPayload.value).filter(v => v !== undefined).length,
          resultCount: products.value.length,
        });
      } else {
        // If no filters, fetch all products
        products.value = await ProductService.getAll();
      }
    } catch (err: unknown) {
      const errorMessage = _extractErrorMessage(err);
      error.value = `Search failed: ${errorMessage}`;
      Logger.error(
        "Product search failed",
        buildErrorContext(err as ApplicationError, {
          errorMessage,
          filters: filterPayload.value,
        })
      );
      toast.error("Search failed. Please try again.");
    } finally {
      isSearching.value = false;
    }
  };

  /**
   * Initialize debounced search function.
   *
   * This is called once to set up the debounced version of performSearch.
   */
  const initializeDebouncedSearch = (): void => {
    if (!debouncedSearch) {
      debouncedSearch = debounce(performSearch, {
        delay: DEFAULT_DEBOUNCE_CONFIG.delay,
        maxWait: DEFAULT_DEBOUNCE_CONFIG.maxWait,
        trailing: true,
      });
    }
  };

  /**
   * Release debounced callbacks and watchers.
   *
   * Keeps the composable safe when used both inside Vue components
   * and directly inside unit tests or standalone scripts.
   */
  const dispose = (): void => {
    if (debouncedSearch && typeof debouncedSearch === "object" && "cancel" in debouncedSearch) {
      (debouncedSearch as unknown as { cancel: () => void }).cancel?.();
    }

    stopFilterWatcher?.();
    stopFilterWatcher = null;
  };

  /**
   * Update filter state and trigger debounced search.
   *
   * @param updates Partial filter state updates
   */
  const updateFilters = (updates: Partial<FilterState>): void => {
    filters.value = {
      ...filters.value,
      ...updates,
      page: 1, // Reset to first page on filter change
    };

    // Initialize debounced search on first use
    if (!debouncedSearch) {
      initializeDebouncedSearch();
    }

    // Trigger debounced search
    if (debouncedSearch) {
      (debouncedSearch as unknown as (...args: unknown[]) => void)();
    }
  };

  /**
   * Update search term with debouncing.
   *
   * @param searchTerm New search term
   */
  const updateSearchTerm = (searchTerm: string): void => {
    updateFilters({ search: searchTerm });
  };

  /**
   * Update category filter.
   *
   * @param categoryId Category ID or null to clear
   */
  const updateCategory = (categoryId: string | number | null): void => {
    updateFilters({ categoryId });
  };

  /**
   * Update availability filter.
   *
   * @param inStock true for in stock, false for out of stock, null for all
   */
  const updateAvailability = (inStock: boolean | null): void => {
    updateFilters({ inStock });
  };

  /**
   * Update price range filters.
   *
   * @param minPrice Minimum price (null for no minimum)
   * @param maxPrice Maximum price (null for no maximum)
   */
  const updatePriceRange = (minPrice: number | null, maxPrice: number | null): void => {
    updateFilters({ minPrice, maxPrice });
  };

  /**
   * Clear all filters and reset to initial state.
   */
  const clearFilters = async (): Promise<void> => {
    filters.value = createDefaultFilterState();
    error.value = null;

    // Cancel any pending search
    if (debouncedSearch && typeof debouncedSearch === "object" && "cancel" in debouncedSearch) {
      (debouncedSearch as unknown as { cancel: () => void }).cancel?.();
    }

    // Fetch all products without filters
    await fetchData();
    Logger.info("All filters cleared");
    toast.info("Filters cleared.");
  };

  // ==========================================
  // BULK SELECTION ACTIONS
  // ==========================================

  /**
   * Toggle selection of a specific asset.
   *
   * @param assetId Product ID to toggle
   */
  const toggleSelection = (assetId: number): void => {
    if (selectedAssetIds.value.has(assetId)) {
      selectedAssetIds.value.delete(assetId);
    } else {
      selectedAssetIds.value.add(assetId);
    }
    Logger.info(`Asset selection toggled [ID: ${assetId}]`);
  };

  /**
   * Select all visible assets.
   */
  const selectAll = (): void => {
    const allIds = products.value
      .map(p => p.id)
      .filter((id): id is number => id !== undefined);

    selectedAssetIds.value = new Set(allIds);
    Logger.info(`All assets selected [Count: ${allIds.length}]`);
  };

  /**
   * Clear all asset selections.
   */
  const clearSelection = (): void => {
    selectedAssetIds.value.clear();
    Logger.info("Asset selection cleared");
  };

  /**
   * Bulk update category for selected assets.
   *
   * @param productIds Array of product IDs to update
   * @param categoryId New category ID
   * @returns Promise that resolves when update is complete
   */
  const bulkUpdateCategory = async (productIds: number[], categoryId: number): Promise<void> => {
    loading.value = true;
    error.value = null;

    try {
      const result = await ProductService.bulkUpdateCategory(productIds, categoryId);

      // Update local state immediately for UI reactivity
      products.value = products.value.map(product => {
        if (result.updated_products.includes(product.id!)) {
          return { ...product, category: result.new_category };
        }
        return product;
      });

      // Clear selection after successful update
      clearSelection();

      Logger.info(`Bulk category update completed [Products: ${productIds.length}, Category: ${categoryId}]`);
      toast.success(`Successfully updated ${productIds.length} asset${productIds.length === 1 ? '' : 's'}`);
    } catch (err: unknown) {
      const errorMessage = _extractErrorMessage(err);
      error.value = `Bulk update failed: ${errorMessage}`;
      Logger.error(
        "Bulk category update failed",
        buildErrorContext(err as ApplicationError, {
          productIds,
          categoryId,
          errorMessage,
        })
      );
      toast.error("Bulk update failed. Please try again.");
      throw err;
    } finally {
      loading.value = false;
    }
  };

  /**
   * Set up watchers for automatic search on filter changes.
   * This is called during component lifecycle.
   */
  const setupFilterWatchers = (): void => {
    stopFilterWatcher?.();

    stopFilterWatcher = watch(
      () => filters.value,
      () => {
        initializeDebouncedSearch();
        if (debouncedSearch) {
          (debouncedSearch as unknown as (...args: unknown[]) => void)();
        }
      },
      { deep: true }
    );
  };

  /**
   * Clean up debounced functions on unmount.
   */
  if (getCurrentInstance()) {
    onBeforeUnmount(() => {
      dispose();
    });
  }

  return {
    // State
    products,
    loading,
    error,
    filters,
    isSearching,
    selectedAssetIds,

    // Computed
    totalRevenue,
    inventoryStats,
    hasFilters,
    isFilteringActive,
    filterPayload,
    hasSelectedAssets,
    selectedAssetsCount,
    isAllSelected,
    isIndeterminate,

    // Actions
    fetchData,
    createProduct,
    updateProduct,
    deleteProduct,

    // Search & Filter Actions
    updateFilters,
    updateSearchTerm,
    updateCategory,
    updateAvailability,
    updatePriceRange,
    clearFilters,
    performSearch,
    setupFilterWatchers,
    dispose,

    // Bulk Selection Actions
    toggleSelection,
    selectAll,
    clearSelection,
    bulkUpdateCategory,
  };
}
