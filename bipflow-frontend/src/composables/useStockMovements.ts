import { ref, computed } from "vue";
import StockMovementService from "../services/stockMovement.service";
import { Logger } from "../services/logger";
import { buildErrorContext, type ApplicationError } from "../types/errors";
import type { StockMovement, StockMovementLedgerFilters } from "../types/stockMovement";

const DEFAULT_PAGE_SIZE = 50;

/**
 * Store-wide stock movement ledger (Etapa 2).
 *
 * Deliberately NOT a module-level singleton like useProducts/useCategories:
 * this composable only backs one view (DashboardStockMovementsView), so its
 * filters/pagination state belongs to that view's own lifecycle, not shared
 * across the dashboard.
 */
export function useStockMovements() {
  const movements = ref<StockMovement[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const filters = ref<StockMovementLedgerFilters>({});
  const page = ref(1);
  const count = ref(0);
  const totalPages = ref(1);

  const hasNextPage = computed(() => page.value < totalPages.value);
  const hasPreviousPage = computed(() => page.value > 1);

  const fetchMovements = async (): Promise<void> => {
    loading.value = true;
    error.value = null;

    try {
      const response = await StockMovementService.list(filters.value, page.value, DEFAULT_PAGE_SIZE);
      movements.value = response.results;
      count.value = response.count;
      totalPages.value = response.total_pages ?? 1;
    } catch (err: unknown) {
      error.value = "Não foi possível carregar o histórico de estoque.";
      Logger.error(
        "Failed to fetch stock movement ledger",
        buildErrorContext(err as ApplicationError, { filters: filters.value, page: page.value })
      );
    } finally {
      loading.value = false;
    }
  };

  const updateFilters = (updates: Partial<StockMovementLedgerFilters>): void => {
    filters.value = { ...filters.value, ...updates };
    page.value = 1;
    void fetchMovements();
  };

  const clearFilters = (): void => {
    filters.value = {};
    page.value = 1;
    void fetchMovements();
  };

  const goToNextPage = (): void => {
    if (!hasNextPage.value) return;
    page.value += 1;
    void fetchMovements();
  };

  const goToPreviousPage = (): void => {
    if (!hasPreviousPage.value) return;
    page.value -= 1;
    void fetchMovements();
  };

  return {
    movements,
    loading,
    error,
    filters,
    page,
    count,
    totalPages,
    hasNextPage,
    hasPreviousPage,
    fetchMovements,
    updateFilters,
    clearFilters,
    goToNextPage,
    goToPreviousPage,
  };
}
