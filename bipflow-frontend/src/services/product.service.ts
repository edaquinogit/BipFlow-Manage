import api from "./api";
import { ProductSchema, type Product } from "../schemas/product.schema";

/**
 * 🛰️ PRODUCT SERVICE (BIPFLOW ENGINE - NYC STANDARD)
 * Camada de persistência e validação atômica para ativos do inventário.
 * Implementa o Singleton Pattern para garantir uma única instância de conexão.
 */
class ProductService {
  private readonly endpoint = "products/";

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
    } catch (err: any) {
      this.handleError(err, "Fetch All Assets");
      throw err;
    }
  }

  /**
   * 🚀 CREATE ASSET (MULTIPART DEPLOYMENT)
   * Despacha o payload (FormData) para suportar upload de imagens.
   */
  async create(payload: FormData): Promise<Product> {
    try {
      const { data } = await api.post(this.endpoint, payload, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      // Validação rigorosa no Create para garantir que o objeto novo está correto
      return ProductSchema.parse(data);
    } catch (err: any) {
      this.handleError(err, "Asset Provisioning");
      throw err;
    }
  }

  /**
   * 🛰️ STRATEGIC UPDATE (PATCH / MULTIPART)
   * Sincroniza alterações parciais no registro.
   */
  async update(
    id: number,
    productData: Partial<Product> | FormData,
  ): Promise<Product> {
    try {
      const isFormData = productData instanceof FormData;

      const { data } = await api.patch(`${this.endpoint}${id}/`, productData, {
        headers: {
          // Deixamos o Axios gerenciar o boundary se for FormData
          "Content-Type": isFormData
            ? "multipart/form-data"
            : "application/json",
        },
      });

      const validation = ProductSchema.safeParse(data);

      if (!validation.success) {
        console.warn(
          `⚠️ BipFlow: Schema mismatch on Asset ${id}.`,
          validation.error.format(),
        );
        return data as Product;
      }

      return validation.data;
    } catch (err: any) {
      this.handleError(err, "Update Sequence");
      throw err;
    }
  }

  /**
   * 🗑️ PURGE ASSET
   * Remove permanentemente um ativo do registro.
   */
  async delete(id: number): Promise<void> {
    try {
      await api.delete(`${this.endpoint}${id}/`);
      console.log(`🗑️ BipFlow: Asset ${id} purged from registry.`);
    } catch (err: any) {
      this.handleError(err, "Delete Sequence");
      throw err;
    }
  }

  /**
   * 🛡️ INTERNAL ERROR HANDLER (AUDIT LOG PROTOCOL)
   * Centraliza a telemetria de erros para debug profissional.
   */
  private handleError(err: any, context: string) {
    if (err.name === "ZodError") {
      console.error(
        `⚠️ [ProductService][${context}] Schema Mismatch:`,
        err.errors,
      );
    } else if (err.response) {
      // Erro vindo do Servidor (Django/Node)
      console.error(
        `❌ [ProductService][${context}] API Error [${err.response.status}]:`,
        err.response.data,
      );
    } else {
      // Erro de Rede ou Inesperado
      console.error(
        `❌ [ProductService][${context}] Unexpected Failure:`,
        err.message,
      );
    }
  }
}

// Exportação da Instância Única (Singleton)
export default new ProductService();
