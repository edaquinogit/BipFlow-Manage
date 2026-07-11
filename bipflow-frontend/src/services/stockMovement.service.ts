import api from "./api";
import { Logger } from "./logger";
import {
  isAxiosError,
  buildErrorContext,
  type ApplicationError,
} from "../types/errors";
import type { PaginatedStockMovements, StockMovementLedgerFilters } from "../types/stockMovement";
import { PaginatedStockMovementsSchema } from "../types/stockMovement";

/**
 * Store-wide stock movement ledger (Etapa 2) -- GET /v1/stock-movements/.
 *
 * Read-only by design: creating a movement always goes through
 * ProductService.createStockMovement (nested under one product's own
 * lock/validate workflow), never through this endpoint.
 */
class StockMovementService {
  private readonly endpoint = "v1/stock-movements/";

  private buildQueryParams(
    filters: StockMovementLedgerFilters,
    page: number,
    pageSize: number
  ): URLSearchParams {
    const params = new URLSearchParams();

    if (filters.product) params.set("product", String(filters.product));
    if (filters.movement_type) params.set("movement_type", filters.movement_type);
    if (filters.source) params.set("source", filters.source);
    if (filters.reason) params.set("reason", filters.reason);
    if (filters.search?.trim()) params.set("search", filters.search.trim());
    if (filters.start) params.set("start", filters.start);
    if (filters.end) params.set("end", filters.end);

    params.set("page", String(page));
    params.set("page_size", String(pageSize));

    return params;
  }

  async list(
    filters: StockMovementLedgerFilters = {},
    page = 1,
    pageSize = 50
  ): Promise<PaginatedStockMovements> {
    try {
      const queryParams = this.buildQueryParams(filters, page, pageSize);
      const { data } = await api.get<unknown>(`${this.endpoint}?${queryParams.toString()}`);

      const validation = PaginatedStockMovementsSchema.safeParse(data);
      if (!validation.success) {
        Logger.warn(
          "Stock movement ledger response validation failed",
          buildErrorContext(validation.error, { endpoint: this.endpoint, filters, page })
        );
        return data as PaginatedStockMovements;
      }

      return validation.data;
    } catch (error: unknown) {
      this.handleError(error as ApplicationError, "List Stock Movements");
      throw error;
    }
  }

  private handleError(error: ApplicationError, context: string): void {
    if (isAxiosError(error)) {
      Logger.error(
        `[StockMovementService][${context}] API request failed [HTTP ${error.response?.status}]`,
        buildErrorContext(error, { data: error.response?.data })
      );
    } else if (error instanceof Error) {
      Logger.error(`[StockMovementService][${context}] Unexpected error: ${error.message}`, buildErrorContext(error));
    } else {
      Logger.error(`[StockMovementService][${context}] Unknown error occurred`, buildErrorContext(error));
    }
  }
}

export default new StockMovementService();
