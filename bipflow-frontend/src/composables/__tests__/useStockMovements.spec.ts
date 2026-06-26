import { describe, it, expect, vi, beforeEach } from "vitest";
import { useStockMovements } from "../useStockMovements";
import StockMovementService from "../../services/stockMovement.service";
import type { PaginatedStockMovements, StockMovement } from "../../types/stockMovement";

vi.mock("../../services/stockMovement.service", () => ({
  default: { list: vi.fn() },
}));

const buildResponse = (
  overrides: Partial<{ count: number; total_pages: number; results: StockMovement[] }> = {}
): PaginatedStockMovements => ({
  count: 0,
  next: null,
  previous: null,
  page_size: 50,
  total_pages: 1,
  results: [],
  ...overrides,
});

describe("useStockMovements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches movements with the current filters and page on fetchMovements()", async () => {
    vi.mocked(StockMovementService.list).mockResolvedValue(
      buildResponse({ count: 2, results: [{ id: 1 }, { id: 2 }] as any })
    );

    const { fetchMovements, movements, count, loading } = useStockMovements();
    const promise = fetchMovements();
    expect(loading.value).toBe(true);

    await promise;

    expect(StockMovementService.list).toHaveBeenCalledWith({}, 1, 50);
    expect(movements.value).toHaveLength(2);
    expect(count.value).toBe(2);
    expect(loading.value).toBe(false);
  });

  it("sets an error message and leaves movements empty when the request fails", async () => {
    vi.mocked(StockMovementService.list).mockRejectedValue(new Error("network down"));

    const { fetchMovements, error, movements } = useStockMovements();
    await fetchMovements();

    expect(error.value).toBe("Não foi possível carregar o histórico de estoque.");
    expect(movements.value).toEqual([]);
  });

  it("resets to page 1 and refetches with the merged filters when filters change", async () => {
    vi.mocked(StockMovementService.list).mockResolvedValue(buildResponse());

    const { updateFilters, filters, page } = useStockMovements();
    updateFilters({ movement_type: "entrada" });
    await Promise.resolve();
    updateFilters({ reason: "compra" });
    await Promise.resolve();

    expect(filters.value).toEqual({ movement_type: "entrada", reason: "compra" });
    expect(page.value).toBe(1);
    expect(StockMovementService.list).toHaveBeenLastCalledWith(
      { movement_type: "entrada", reason: "compra" },
      1,
      50
    );
  });

  it("clearFilters resets filters and page back to defaults", async () => {
    vi.mocked(StockMovementService.list).mockResolvedValue(buildResponse());

    const { updateFilters, clearFilters, filters, page } = useStockMovements();
    updateFilters({ search: "abc" });
    await Promise.resolve();

    clearFilters();
    await Promise.resolve();

    expect(filters.value).toEqual({});
    expect(page.value).toBe(1);
    expect(StockMovementService.list).toHaveBeenLastCalledWith({}, 1, 50);
  });

  it("does not paginate before the first page or past the last page", async () => {
    vi.mocked(StockMovementService.list).mockResolvedValue(buildResponse({ total_pages: 2 }));

    const { fetchMovements, goToPreviousPage, goToNextPage, page, hasNextPage, hasPreviousPage } =
      useStockMovements();
    await fetchMovements();

    expect(hasPreviousPage.value).toBe(false);
    goToPreviousPage();
    expect(page.value).toBe(1);

    expect(hasNextPage.value).toBe(true);
    goToNextPage();
    await Promise.resolve();

    expect(page.value).toBe(2);
    expect(StockMovementService.list).toHaveBeenLastCalledWith({}, 2, 50);

    // Now on the last page (2 of 2): hasNextPage should be false and a
    // further goToNextPage() must be a no-op.
    expect(hasNextPage.value).toBe(false);
    const callCountBeforeNoOp = vi.mocked(StockMovementService.list).mock.calls.length;
    goToNextPage();
    expect(page.value).toBe(2);
    expect(StockMovementService.list).toHaveBeenCalledTimes(callCountBeforeNoOp);
  });
});
