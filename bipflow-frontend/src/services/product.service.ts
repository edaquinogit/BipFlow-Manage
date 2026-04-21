import api from "./api";
import { z } from "zod";
import { Logger } from "./logger";
import { ProductSchema, type Product } from "../schemas/product.schema";
import {
  isAxiosError,
  isZodError,
  buildErrorContext,
  type ApplicationError,
} from "../types/errors";
import type { ProductFilterPayload } from "../types/filters";
import { filtersToQueryParams } from "../types/filters";
import type { PaginatedProductsResponse, ProductFilters } from "../types/product";
import { PaginatedProductsResponseSchema } from "../types/product";

/**
 * Product Service - Business Logic Layer
 *
 * Handles all product-related API operations with strict type safety.
 * Implements singleton pattern for consistent state management.
 * Provides comprehensive error handling and schema validation via Zod.
 */
class ProductService {
  private readonly endpoint = "v1/products/";
  private readonly paginatedEnvelopeSchema = z.object({
    count: z.number(),
    next: z.string().nullable(),
    previous: z.string().nullable(),
    page_size: z.number().optional(),
    total_pages: z.number().optional(),
    results: z.array(z.unknown()),
  });

  /**
   * Normalize backend product payloads into the richer frontend shape.
   *
   * The Django serializer returns `category` as a numeric FK plus
   * `category_name`, while dashboard and public views expect a category object.
   */
  private normalizeProductRecord(data: unknown): unknown {
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return data;
    }

    const rawProduct = { ...(data as Record<string, unknown>) };
    const rawCategory = rawProduct.category;
    const rawCategoryName = rawProduct.category_name;

    if (
      typeof rawCategory === "number" &&
      typeof rawCategoryName === "string" &&
      rawCategoryName.trim() !== ""
    ) {
      rawProduct.category = {
        id: rawCategory,
        name: rawCategoryName,
        slug: null,
      };
    }

    return rawProduct;
  }

  private normalizeProductCollection(data: unknown[]): unknown[] {
    return data.map((entry) => this.normalizeProductRecord(entry));
  }

  private normalizePaginatedPayload(data: unknown): unknown {
    const paginatedValidation = this.paginatedEnvelopeSchema.safeParse(data);

    if (!paginatedValidation.success) {
      return data;
    }

    return {
      ...paginatedValidation.data,
      results: this.normalizeProductCollection(paginatedValidation.data.results),
    };
  }

  /**
   * Normalize collection endpoints that may return either a raw array or
   * a paginated DRF payload with a `results` array.
   */
  private extractProductList(data: unknown): Product[] {
    const normalizedArrayData = Array.isArray(data)
      ? this.normalizeProductCollection(data)
      : data;
    const arrayValidation = ProductSchema.array().safeParse(normalizedArrayData);
    if (arrayValidation.success) {
      return arrayValidation.data;
    }

    const paginatedValidation = this.paginatedEnvelopeSchema.safeParse(data);
    if (paginatedValidation.success) {
      const normalizedPayload = this.normalizePaginatedPayload(data) as {
        results: unknown[];
      };
      const normalizedResults = normalizedPayload.results;
      const normalized = ProductSchema.array().safeParse(normalizedResults);

      if (normalized.success) {
        return normalized.data as Product[];
      }

      Logger.warn(
        "Paginated product results failed admin schema validation",
        buildErrorContext(normalized.error, { endpoint: this.endpoint })
      );
      return normalizedResults as Product[];
    }

    Logger.warn(
      "Product collection validation failed - returning empty list",
      buildErrorContext(arrayValidation.error, { endpoint: this.endpoint, data })
    );
    return [];
  }

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
      return this.extractProductList(data);
    } catch (error: unknown) {
      this.handleError(error as ApplicationError, "Fetch All Products");
      throw error;
    }
  }

  /**
   * Fetch products with advanced filtering and search capabilities.
   *
   * Supports server-side filtering for:
   * - Text search (name, SKU, description)
   * - Category filtering
   * - Availability filtering
   * - Price range filtering
   *
   * Implements efficient database queries with select_related for relationships.
   * Performs schema validation on all returned products.
   *
   * @param filters Filter payload with search and filter parameters
   * @returns Array of validated Product objects matching the filters
   * @throws Error if API request fails completely
   */
  async getFiltered(filters: Partial<ProductFilterPayload>): Promise<Product[]> {
    try {
      const queryParams = filtersToQueryParams(filters);
      const queryString = queryParams.toString();
      const url = queryString ? `${this.endpoint}?${queryString}` : this.endpoint;

      const { data } = await api.get<unknown>(url);
      const products = this.extractProductList(data);

      Logger.info('Filtered product search completed', {
        filterCount: queryParams.size,
        resultCount: products.length,
      });

      return products;
    } catch (error: unknown) {
      this.handleError(error as ApplicationError, "Fetch Filtered Products");
      throw error;
    }
  }

  /**
   * Fetch paginated products with filtering for customer-facing page.
   *
   * Returns paginated response with count, next/previous URLs, and results.
   * Optimized for customer browsing with efficient caching.
   *
   * @param filters Filter payload with search and filter parameters
   * @param page Page number (1-indexed)
   * @param pageSize Number of items per page
   * @returns Paginated products response
   * @throws Error if API request fails completely
   */
  async list(
    filters: Partial<ProductFilters> = {},
    page = 1,
    pageSize = 12
  ): Promise<PaginatedProductsResponse> {
    try {
      const queryParams = new URLSearchParams()

      // Add filters
      if (filters.search?.trim()) {
        queryParams.set('search', filters.search.trim())
      }
      if (filters.categoryId) {
        queryParams.set('category', String(filters.categoryId))
      }
      if (filters.priceMin !== undefined && filters.priceMin >= 0) {
        queryParams.set('min_price', String(filters.priceMin))
      }
      if (filters.priceMax !== undefined && filters.priceMax > 0) {
        queryParams.set('max_price', String(filters.priceMax))
      }
      if (filters.inStockOnly) {
        queryParams.set('in_stock', 'true')
      }

      // Add pagination
      queryParams.set('page', String(page))
      queryParams.set('page_size', String(pageSize))

      const url = `${this.endpoint}?${queryParams.toString()}`
      const { data } = await api.get<unknown>(url)
      const candidateData = this.normalizePaginatedPayload(data)

      const validation = PaginatedProductsResponseSchema.safeParse(candidateData)

      if (!validation.success) {
        Logger.warn(
          'Paginated products response validation failed',
          buildErrorContext(validation.error, {
            endpoint: this.endpoint,
            filters,
            page,
            pageSize,
          })
        )
        return candidateData as PaginatedProductsResponse
      }

      Logger.debug('Paginated products fetch completed', {
        page,
        pageSize,
        resultCount: validation.data.results.length,
        totalCount: validation.data.count,
      })

      return validation.data
    } catch (error: unknown) {
      this.handleError(error as ApplicationError, "List Products")
      throw error
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
   * Bulk update category for multiple products.
   *
   * Uses atomic transaction on backend to ensure data integrity.
   * Updates multiple products in a single efficient database operation.
   *
   * @param productIds Array of product IDs to update
   * @param categoryId New category ID for all products
   * @returns Object with update results
   * @throws Error if validation or API request fails
   */
  async bulkUpdateCategory(productIds: number[], categoryId: number): Promise<{
    updated_count: number;
    updated_products: number[];
    new_category: { id: number; name: string; slug: string | null };
  }> {
    try {
      const payload = {
        product_ids: productIds,
        new_category_id: categoryId,
      };

      const { data } = await api.patch<unknown>(
        `${this.endpoint}bulk_update_category/`,
        payload,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      return data as {
        updated_count: number;
        updated_products: number[];
        new_category: { id: number; name: string; slug: string | null };
      };
    } catch (error: unknown) {
      this.handleError(error as ApplicationError, "Bulk Update Category");
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
