import { ref, computed } from "vue";
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

/**
 * Product Management Composable
 *
 * Manages product state, CRUD operations, and business logic calculations.
 * Provides reactive access to products, inventory statistics, and revenue metrics.
 */
export function useProducts() {
  // ==========================================
  // STATE
  // ==========================================
  const products = ref<Product[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const toast = useToast();

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
      if (value === null || value === undefined) return;

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
   * Handles various error response formats from backend.
   */
  const _extractErrorMessage = (error: unknown): string => {
    if (isAxiosError(error)) {
      return (
        error.response?.data?.detail ||
        error.response?.data?.message ||
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

  return {
    products,
    loading,
    error,
    totalRevenue,
    inventoryStats,
    fetchData,
    createProduct,
    updateProduct,
    deleteProduct,
  };
}
