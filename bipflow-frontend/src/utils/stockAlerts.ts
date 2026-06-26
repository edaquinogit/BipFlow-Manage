/**
 * Minimal shape these helpers need -- deliberately structural (not the
 * admin `Product` from schemas/product.schema.ts) so the same threshold
 * logic is shared by both the dashboard (TableRow.vue/useProducts.ts) and
 * the public storefront (ProductCard.vue/ProductDetailView.vue), which use
 * two different Product types with incompatible fields elsewhere (e.g.
 * `price` is a number on one and a string on the other) -- see Etapa 4 of
 * docs/architecture/stock-movement-evolution.md.
 */
export interface StockAlertable {
  stock_quantity: number;
  is_available: boolean;
  low_stock_threshold?: number | null;
}

/**
 * Fallback low-stock threshold for products with no explicit
 * `low_stock_threshold` override (Etapa 3 of the stock-movement evolution).
 * Matches the value this whole feature replaced (`useProducts.ts`'s old
 * hardcoded `LOW_STOCK_THRESHOLD = 5`, and the storefront's old hardcoded
 * `<= 5` checks from Etapa 4).
 */
export const DEFAULT_LOW_STOCK_THRESHOLD = 5;

const getStockValue = (product: StockAlertable): number => Number(product.stock_quantity ?? 0);

/**
 * Single source of truth for "what counts as low stock for this product" --
 * shared by useProducts.ts (dashboard alerts/KPIs), TableRow.vue (the
 * per-row stock badge color), and the public storefront's "last units"
 * messaging, so none of them can silently disagree.
 */
export const getLowStockThreshold = (product: StockAlertable): number =>
  product.low_stock_threshold ?? DEFAULT_LOW_STOCK_THRESHOLD;

export const isOutOfStock = (product: StockAlertable): boolean =>
  getStockValue(product) <= 0 || !product.is_available;

export const isLowStock = (product: StockAlertable): boolean => {
  const stockValue = getStockValue(product);
  return stockValue > 0 && stockValue <= getLowStockThreshold(product) && !!product.is_available;
};
