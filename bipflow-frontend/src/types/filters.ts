/**
 * ========================================
 * 🔍 FILTER & SEARCH TYPES
 * ========================================
 *
 * TypeScript interfaces for filter payloads, state management,
 * and query parameter generation for the Product filtering system.
 *
 * Provides type-safe filtering across the entire application stack.
 */

/**
 * Product Filter Payload
 *
 * Represents all available filter parameters for product search.
 * All fields are optional to support partial filtering.
 */
export interface ProductFilterPayload {
  /** Text search across name, SKU, and description */
  search?: string;

  /** Filter by category ID or slug */
  category?: string | number;

  /** Filter by availability (true = in stock, false = out of stock) */
  in_stock?: boolean;

  /** Minimum price filter */
  min_price?: number;

  /** Maximum price filter */
  max_price?: number;

  /** Pagination page number (1-indexed) */
  page?: number;

  /** Items per page */
  page_size?: number;
}

/**
 * Filter State Management
 *
 * Represents the current state of all active filters.
 * Used for maintaining filter state during navigation and updates.
 */
export interface FilterState {
  search: string;
  categoryId: string | number | null;
  inStock: boolean | null;
  minPrice: number | null;
  maxPrice: number | null;
  page: number;
}

/**
 * Search Debounce Configuration
 *
 * Configuration for debouncing search input to prevent excessive API calls.
 */
export interface DebounceConfig {
  /** Debounce delay in milliseconds (recommended: 300-500ms) */
  delay: number;

  /** Maximum wait time before forcing execution (recommended: 1000ms) */
  maxWait: number;
}

/**
 * Filter Query Result Metadata
 *
 * Metadata about the current filtered result set.
 */
export interface FilterMetadata {
  /** Total number of results matching the current filters */
  total: number;

  /** Number of results displayed on current page */
  count: number;

  /** Current page number */
  page: number;

  /** Total number of pages */
  totalPages: number;

  /** Whether there are more pages to load */
  hasNextPage: boolean;

  /** Whether there are previous pages */
  hasPreviousPage: boolean;
}

/**
 * Converts ProductFilterPayload to URL query parameters
 *
 * @param filters - Filter payload object
 * @returns URLSearchParams ready for API requests
 */
export function filtersToQueryParams(filters: Partial<ProductFilterPayload>): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.search?.trim()) {
    params.set('search', filters.search.trim());
  }

  if (filters.category) {
    params.set('category', String(filters.category));
  }

  if (filters.in_stock !== undefined && filters.in_stock !== null) {
    params.set('in_stock', String(filters.in_stock));
  }

  if (filters.min_price !== undefined && filters.min_price !== null && filters.min_price >= 0) {
    params.set('min_price', String(filters.min_price));
  }

  if (filters.max_price !== undefined && filters.max_price !== null && filters.max_price > 0) {
    params.set('max_price', String(filters.max_price));
  }

  if (filters.page !== undefined && filters.page > 1) {
    params.set('page', String(filters.page));
  }

  if (filters.page_size !== undefined && filters.page_size > 0) {
    params.set('page_size', String(filters.page_size));
  }

  return params;
}

/**
 * Initialize default filter state
 *
 * @returns Fresh FilterState with default values
 */
export function createDefaultFilterState(): FilterState {
  return {
    search: '',
    categoryId: null,
    inStock: null,
    minPrice: null,
    maxPrice: null,
    page: 1,
  };
}

/**
 * Check if any filters are currently active
 *
 * @param filters - Filter state to check
 * @returns true if any non-default filters are set
 */
export function hasActiveFilters(filters: Partial<FilterState>): boolean {
  return !!(
    filters.search?.trim() ||
    filters.categoryId ||
    filters.inStock !== null ||
    filters.minPrice !== null ||
    filters.maxPrice !== null
  );
}

/**
 * Default debounce configuration
 * Recommended values: 300-500ms delay with 1000ms max wait
 */
export const DEFAULT_DEBOUNCE_CONFIG: DebounceConfig = {
  delay: 400,
  maxWait: 1000,
};
