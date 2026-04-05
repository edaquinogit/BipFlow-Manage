import api from "./api";
import { ProductSchema, type Product } from "../schemas/product.schema";
import { formatDrfErrorPayload } from "@/lib/drfErrors";
import { productServiceLogger } from "@/lib/logger";
import type { AxiosError } from "axios";

/**
 * 🛰️ PRODUCT SERVICE (BIPFLOW ENGINE - NYC STANDARD)
 * Camada de persistência e validação atômica para ativos do inventário.
 * Implementa o Singleton Pattern para garantir uma única instância de conexão.
 */
class ProductService {
  private readonly endpoint = "v1/products/";

  /**
   * 🔍 FETCH ALL ASSETS
   * Recupera a coleção completa e garante a integridade dos dados via Zod.
   */
  async getAll(): Promise<Product[]> {
    try {
      const { data } = await api.get(this.endpoint);

      // O safeParse evita que o dashboard quebre se um único campo vier errado do banco
      const validation = ProductSchema.array().safeParse(data);

      if (!validation.success) {
        console.error(
          "❌ BipFlow: Registry Data Corruption Detected.",
          validation.error.format(),
        );
        return data as Product[]; // Fallback para não travar a UI, mas loga o erro
      }

      return validation.data;
    } catch (err: unknown) {
      this.handleError(err, "Fetch All Assets");
      throw err;
    }
  }

  /**
   * 🚀 CREATE ASSET (MULTIPART DEPLOYMENT)
   * Do not set Content-Type manually: axios must add the multipart boundary.
   */
  async create(payload: FormData): Promise<Product> {
    try {
      const { data, status } = await api.post(this.endpoint, payload);

      if (status !== 201) {
        productServiceLogger.error(
          { status, data },
          "Create rejected: expected 201 Created",
        );
        throw new Error(`Expected 201 Created, received HTTP ${status}`);
      }

      return ProductSchema.parse(data);
    } catch (err: unknown) {
      this.handleError(err, "Asset Provisioning");
      throw err;
    }
  }

  /**
   * 🛰️ STRATEGIC UPDATE (PATCH / MULTIPART or JSON)
   * Uses FormData only if image is included. Otherwise sends JSON for better SKU handling.
   * This prevents duplicate SKU constraint violations during partial updates.
   */
  async update(
    id: number,
    productData: Partial<Product> | FormData,
  ): Promise<Product> {
    try {
      const isFormData = productData instanceof FormData;
      const endpoint = `${this.endpoint}${id}/`;

      interface AxiosConfig {
        headers?: Record<string, string>;
      }

      const config: AxiosConfig = {};
      if (!isFormData) {
        config.headers = { "Content-Type": "application/json" };
      }

      const { data } = await api.patch(endpoint, productData, config);

      const validation = ProductSchema.safeParse(data);

      if (!validation.success) {
        console.warn(
          `⚠️ BipFlow: Schema mismatch on Asset ${id}.`,
          validation.error.format(),
        );
        return data as Product;
      }

      return validation.data;
    } catch (err: unknown) {
      // Enhanced error logging for SKU conflicts
      const axiosError = err as AxiosError<Record<string, unknown>>;
      if (
        axiosError &&
        typeof axiosError === "object" &&
        "response" in axiosError &&
        axiosError.response?.status === 400
      ) {
        const responseData = axiosError.response?.data;
        if (responseData?.sku) {
          productServiceLogger.error(
            { id, error: responseData.sku },
            "SKU conflict: Product with this SKU already exists",
          );
        }
      }
      this.handleError(err, "Update Sequence");
      throw err;
    }
  }

  /**
   * 🗑️ PURGE ASSET
   * Remove permanentemente um registro do inventário.
   */
  async delete(id: number): Promise<void> {
    try {
      await api.delete(`${this.endpoint}${id}/`);
      console.log(`🗑️ BipFlow: Asset ${id} purged from registry.`);
    } catch (err: unknown) {
      this.handleError(err, "Delete Sequence");
      throw err;
    }
  }

  /**
   * 🛡️ INTERNAL ERROR HANDLER (AUDIT LOG PROTOCOL)
   */
  private handleError(err: unknown, context: string) {
    if (
      err &&
      typeof err === "object" &&
      "name" in err &&
      (err as Error).name === "ZodError"
    ) {
      console.error(
        `⚠️ [ProductService][${context}] Schema Mismatch:`,
        (err as { errors?: unknown }).errors ?? err,
      );
      return;
    }

    const ax = err as AxiosError<unknown>;
    if (ax.response) {
      const body = ax.response.data;
      const summary = formatDrfErrorPayload(body);
      productServiceLogger.error(
        {
          context,
          status: ax.response.status,
          drf: body,
          summary,
        },
        "DRF request failed",
      );
      console.error(
        `❌ [ProductService][${context}] API Error [${ax.response.status}]`,
        summary,
        body,
      );
      return;
    }

    console.error(
      `❌ [ProductService][${context}] Unexpected Failure:`,
      err instanceof Error ? err.message : err,
    );
  }
}

// Exportação da Instância Única (Singleton)
export default new ProductService();
