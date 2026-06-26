import { describe, it, expect } from "vitest";
import {
  DEFAULT_LOW_STOCK_THRESHOLD,
  getLowStockThreshold,
  isLowStock,
  isOutOfStock,
} from "../stockAlerts";

describe("stockAlerts", () => {
  describe("getLowStockThreshold", () => {
    it("falls back to the default when low_stock_threshold is null/undefined", () => {
      expect(getLowStockThreshold({ low_stock_threshold: null } as any)).toBe(
        DEFAULT_LOW_STOCK_THRESHOLD
      );
      expect(getLowStockThreshold({} as any)).toBe(DEFAULT_LOW_STOCK_THRESHOLD);
    });

    it("uses the product's own override, including an explicit 0", () => {
      expect(getLowStockThreshold({ low_stock_threshold: 20 } as any)).toBe(20);
      expect(getLowStockThreshold({ low_stock_threshold: 0 } as any)).toBe(0);
    });
  });

  describe("isOutOfStock", () => {
    it("is true when stock is zero or the product is unavailable", () => {
      expect(isOutOfStock({ stock_quantity: 0, is_available: true } as any)).toBe(true);
      expect(isOutOfStock({ stock_quantity: 10, is_available: false } as any)).toBe(true);
    });

    it("is false for an available product with positive stock", () => {
      expect(isOutOfStock({ stock_quantity: 10, is_available: true } as any)).toBe(false);
    });
  });

  describe("isLowStock", () => {
    it("uses the default threshold when no override is set", () => {
      expect(isLowStock({ stock_quantity: 5, is_available: true } as any)).toBe(true);
      expect(isLowStock({ stock_quantity: 6, is_available: true } as any)).toBe(false);
    });

    it("uses the product's own threshold when set, even above the default", () => {
      expect(
        isLowStock({ stock_quantity: 15, is_available: true, low_stock_threshold: 20 } as any)
      ).toBe(true);
      expect(
        isLowStock({ stock_quantity: 25, is_available: true, low_stock_threshold: 20 } as any)
      ).toBe(false);
    });

    it("excludes zeroed/unavailable products -- those are out-of-stock, not low-stock", () => {
      expect(isLowStock({ stock_quantity: 0, is_available: true } as any)).toBe(false);
      expect(
        isLowStock({ stock_quantity: 3, is_available: false, low_stock_threshold: 10 } as any)
      ).toBe(false);
    });

    it("treats an explicit threshold of 0 as 'only alert when truly zeroed'", () => {
      expect(
        isLowStock({ stock_quantity: 1, is_available: true, low_stock_threshold: 0 } as any)
      ).toBe(false);
    });
  });

  describe("cross-schema reuse (Etapa 4)", () => {
    /**
     * These helpers must work identically for the dashboard's admin Product
     * (schemas/product.schema.ts, price: number) and the public storefront's
     * Product (types/product.ts, price: string, extra customer-facing
     * fields) -- they're structurally different types elsewhere, but both
     * satisfy the minimal StockAlertable shape these functions actually need.
     */
    it("classifies a storefront-shaped product (string price, no admin-only fields) the same way", () => {
      const storefrontProduct = {
        id: 7,
        name: "Produto Vitrine",
        slug: "produto-vitrine",
        price: "29.90",
        category: { id: 1, name: "Categoria", slug: "categoria" },
        image: null,
        stock_quantity: 3,
        is_available: true,
        created_at: "2026-06-26T00:00:00Z",
      };

      expect(isLowStock(storefrontProduct)).toBe(true);
      expect(isOutOfStock(storefrontProduct)).toBe(false);
    });

    it("respects a storefront product's own low_stock_threshold", () => {
      const storefrontProduct = {
        id: 8,
        name: "Produto Vitrine",
        slug: "produto-vitrine",
        price: "29.90",
        category: { id: 1, name: "Categoria", slug: "categoria" },
        image: null,
        stock_quantity: 18,
        low_stock_threshold: 20,
        is_available: true,
        created_at: "2026-06-26T00:00:00Z",
      };

      expect(isLowStock(storefrontProduct)).toBe(true);
    });
  });
});
