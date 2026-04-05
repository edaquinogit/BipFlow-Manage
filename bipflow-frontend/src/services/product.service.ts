import api from "./api";
import { Logger } from "./logger";
import { ProductSchema, type Product } from "../schemas/product.schema";
import {
  isAxiosError,
  isZodError,
  buildErrorContext,
  type ApplicationError,
} from "../types/errors";

/**
 * Product Service - Business Logic Layer
 *
 * Handles all product-related API operations with strict type safety.
 * Implements singleton pattern for consistent state management.
 * Provides comprehensive error handling and schema validation via Zod.
 */
class ProductService {
  private readonly endpoint = "v1/products/";

  /**
   * Fetch all products from the backend.
   *
   * Performs schema validation to ensure data integrity. If validation fails,
   * logs warning but returns raw data to prevent UI lockup.
   *
   * @returns Array of validated Product objects
   * @throws Error if API request fails completely
   */
  async getAll(): Promise<Product[]> {
    try {
      const { data } = await api.get<unknown>(this.endpoint);

      const validation = ProductSchema.array().safeParse(data);

      if (!validation.success) {
        Logger.warn(
          'Product schema validation failed - returning unvalidated data',
          buildErrorContext(validation.error, { endpoint: this.endpoint })
        );
        return data as Product[];
      }

      return validation.data;
    } catch (error: unknown) {
      this.handleError(error as ApplicationError, "Fetch All Products");
      throw error;
    }
  }

  /**
   * Create a new product with optional image upload.
   *
   * Accepts FormData payload to support multipart file uploads.
   * Performs strict validation on response to ensure data consistency.
   *
   * @param payload FormData containing product data and optional image
   * @returns Created Product object with server-assigned ID and image URL
   * @throws Error if validation or API request fails
   */
  async create(payload: FormData): Promise<Product> {
    try {
      const { data } = await api.post<unknown>(this.endpoint, payload, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      return ProductSchema.parse(data);
    } catch (error: unknown) {
      this.handleError(error as ApplicationError, "Create Product");
      throw error;
    }
  }

  /**
   * Update an existing product.
   *
   * Supports both JSON and FormData payloads.
   * Uses PATCH to allow partial updates without requiring all fields.
   *
   * @param id Product ID to update
   * @param productData Partial product data or FormData
   * @returns Updated Product object
   * @throws Error if validation or API request fails
   */
  async update(
    id: number,
    productData: Partial<Product> | FormData,
  ): Promise<Product> {
    try {
      const isFormData = productData instanceof FormData;

      const { data } = await api.patch<unknown>(
        `${this.endpoint}${id}/`,
        productData,
        {
          headers: {
            "Content-Type": isFormData
              ? "multipart/form-data"
              : "application/json",
          },
        }
      );

      const validation = ProductSchema.safeParse(data);

      if (!validation.success) {
        Logger.warn(
          `Product schema mismatch after update [ID: ${id}]`,
          buildErrorContext(validation.error, { productId: id })
        );
        return data as Product;
      }

      return validation.data;
    } catch (error: unknown) {
      this.handleError(error as ApplicationError, "Update Product");
      throw error;
    }
  }

  /**
   * Delete a product by ID.
   *
   * Performs hard delete - operation cannot be undone.
   *
   * @param id Product ID to delete
   * @throws Error if product not found or API request fails
   */
  async delete(id: number): Promise<void> {
    try {
      await api.delete(`${this.endpoint}${id}/`);
    } catch (error: unknown) {
      this.handleError(error as ApplicationError, "Delete Product");
      throw error;
    }
  }

  /**
   * Centralized error handling and logging.
   *
   * Distinguishes between validation errors (Zod), API errors (Axios),
   * and unexpected runtime errors. Logs structured context for debugging.
   *
   * @param error Application error instance
   * @param context Operation context for logging
   */
  private handleError(error: ApplicationError, context: string): void {
    if (isZodError(error)) {
      Logger.error(
        `[ProductService][${context}] Schema validation failed`,
        buildErrorContext(error)
      );
    } else if (isAxiosError(error)) {
      Logger.error(
        `[ProductService][${context}] API request failed [HTTP ${error.response?.status}]`,
        buildErrorContext(error, {
          data: error.response?.data,
        })
      );
    } else if (error instanceof Error) {
      Logger.error(
        `[ProductService][${context}] Unexpected error: ${error.message}`,
        buildErrorContext(error)
      );
    } else {
      Logger.error(
        `[ProductService][${context}] Unknown error occurred`,
        { error }
      );
    }
  }
}

export default new ProductService();
