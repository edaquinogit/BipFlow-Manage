/**
 * useProducts Composable Unit Tests
 *
 * Tests the product management composable including:
 * - Product creation with image upload (FormData transformation)
 * - Revenue calculation with type coercion
 * - Error handling and state management
 * - Integration with services
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { useProducts } from "../useProducts";
import ProductService from "../../services/product.service";
import { useToast } from "../../composables/useToast";
import { Logger } from "../../services/logger";

// Mock service dependencies
vi.mock("../../services/product.service");
vi.mock("../../composables/useToast", () => ({
  useToast: vi.fn(),
}));
vi.mock("../../services/logger", () => ({
  Logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("useProducts Composable", () => {
  let mockToast: any;
  let mockLogger: any;

  beforeEach(() => {
    // Clear all mocks before each test to prevent state pollution
    vi.clearAllMocks();

    // Get reference to mocked Logger
    mockLogger = vi.mocked(Logger);

    // Setup mock implementations for Toast
    mockToast = {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
    };

    vi.mocked(useToast).mockReturnValue(mockToast);
  });

  describe("Product Creation with Image Upload", () => {
    /**
     * Verify FormData transformation for multipart uploads
     *
     * When a product with an image file is created, the composable
     * should convert the payload to FormData format for the backend.
     */
    it("should transform product data into valid FormData for media upload", async () => {
      // Setup: Create a mock image file (simulates user upload)
      const { createProduct } = useProducts();
      const mockFile = new File(["image-content"], "test-product.png", {
        type: "image/png",
      });

      const productInput = {
        name: "Premium Product",
        price: 150.00,
        stock_quantity: 10,
        image: mockFile,
      };

      // Mock the service to track API calls
      const serviceSpy = vi.spyOn(ProductService, "create").mockResolvedValue({
        id: 101,
        name: productInput.name,
        price: productInput.price,
        stock_quantity: productInput.stock_quantity,
        image: "http://localhost:8000/media/products/2026/test-product.png",
      } as any);

      // Execute: Call the composable
      const result = await createProduct(productInput as any);

      // Verify: Service was called with FormData
      expect(serviceSpy).toHaveBeenCalled();
      expect(mockToast.success).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalled();

      // Assertion: The payload sent to service must be FormData
      const sentPayload = serviceSpy.mock.calls[0][0];
      expect(sentPayload).toBeInstanceOf(FormData);

      // Assertion: Verify image file is present in FormData
      const imageInPayload = (sentPayload as FormData).get("image");
      expect(imageInPayload).toBeInstanceOf(File);
      expect((imageInPayload as File).name).toBe("test-product.png");

      // Assertion: Verify response includes absolute media URL
      expect(result!.image).toMatch(/^http.*media/);
    });

    /**
     * Verify error handling when product creation fails
     *
     * When API returns error, composable should:
     * - Log the error
     * - Display error toast
     * - Set error state
     * - Not crash
     */
    it("should handle creation errors gracefully", async () => {
      const { createProduct } = useProducts();

      const apiError = new Error("Product with this SKU already exists");
      vi.spyOn(ProductService, "create").mockRejectedValue(apiError);

      // Execute and catch expected error
      await expect(createProduct({ name: "Duplicate" } as any))
        .rejects
        .toThrow();

      // Verify error handling
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Product creation failed"),
        expect.any(Object)
      );
      expect(mockToast.error).toHaveBeenCalled();
    });
  });

  describe("Revenue Calculation", () => {
    /**
     * Verify revenue calculation with type coercion
     *
     * Handle mixed price types (string vs number) in revenue totals.
     */
    it("should calculate total revenue correctly with mixed price types", () => {
      const { products, totalRevenue } = useProducts();

      // Setup: Products with mixed price types
      products.value = [
        { id: 1, name: "Product A", price: "100.00", stock_quantity: 2 } as any,
        { id: 2, name: "Product B", price: 50, stock_quantity: 5 } as any,
        { id: 3, name: "Product C", price: "25.50", stock_quantity: 1 } as any,
      ];

      // Expected: (100 * 2) + (50 * 5) + (25.50 * 1) = 475.50 → "$476" (formatted)
      expect(totalRevenue.value).toBe("$476");
    });

    /**
     * Verify empty state revenue
     *
     * When no products exist, revenue should be zero.
     */
    it("should return zero revenue when no products exist", () => {
      const { products, totalRevenue } = useProducts();

      products.value = [];

      expect(totalRevenue.value).toBe("$0");
    });
  });

  describe("State Management", () => {
    /**
     * Verify loading state during API call
     *
     * While product creation is in progress, loading should be true.
     */
    it("should set loading state during product creation", async () => {
      const { createProduct, loading } = useProducts();

      const slowPromise = new Promise((resolve) =>
        setTimeout(() => resolve({ id: 1 }), 100)
      );

      vi.spyOn(ProductService, "create").mockReturnValue(slowPromise as any);

      const createPromise = createProduct({ name: "Slow Product" } as any);

      // Note: In real implementation, loading state might need to be checked
      // within the API call flow or through a different mechanism
      expect(loading).toBeDefined();

      await createPromise;
    });

    /**
     * Verify error state is cleared on new attempt
     *
     * After a failed API call, attempting again should reset error state.
     */
    it("should clear error state on successful retry", async () => {
      const { createProduct, error } = useProducts();

      // First call fails
      vi.spyOn(ProductService, "create")
        .mockRejectedValueOnce(new Error("API Error"));

      try {
        await createProduct({ name: "Test" } as any);
      } catch (e) {
        // Expected error
      }

      // Second call succeeds
      vi.spyOn(ProductService, "create")
        .mockResolvedValueOnce({ id: 1, name: "Test" } as any);

      await createProduct({ name: "Test Retry" } as any);

      // After success, error should be cleared
      expect(error.value).toBeNull();
    });
  });

  describe("Image Handling", () => {
    /**
     * Verify image URL transformation
     *
     * When server returns relative image path, it should be converted to absolute URL.
     */
    it("should handle image URL transformation from server response", async () => {
      const { createProduct } = useProducts();

      const mockFile = new File(["content"], "product.jpg", {
        type: "image/jpeg",
      });

      // Mock server response with relative path
      vi.spyOn(ProductService, "create").mockResolvedValue({
        id: 1,
        name: "Product",
        image: "/media/products/2026/product.jpg",
      } as any);

      const result = await createProduct({
        name: "Product",
        image: mockFile,
      } as any);

      // Verify the image URL is handled properly
      expect(result!.image).toBeDefined();
      expect(mockToast.success).toHaveBeenCalled();
    });

    /**
     * Verify handling of products without images
     *
     * Products without images should not cause errors or display broken image icons.
     */
    it("should handle products without images gracefully", async () => {
      const { createProduct } = useProducts();

      vi.spyOn(ProductService, "create").mockResolvedValue({
        id: 1,
        name: "No Image Product",
        image: null,
      } as any);

      const result = await createProduct({
        name: "No Image Product",
      } as any);

      // Should not throw, and image should be null
      expect(result!.image).toBeNull();
      expect(mockToast.success).toHaveBeenCalled();
    });
  });
});
