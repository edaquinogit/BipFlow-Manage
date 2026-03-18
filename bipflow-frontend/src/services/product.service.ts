import api from './api';
import { ProductSchema, type Product } from '../schemas/product.schema';

/**
 * ProductService - BipFlow Engine (NYC Standard)
 * Singleton para gerenciamento de ativos via Django REST.
 */
class ProductService {
  private readonly endpoint = 'products/';

  /**
   * Obtém todos os produtos e valida via Zod Schema.
   */
  async getAll(): Promise<Product[]> {
    try {
      const { data } = await api.get(this.endpoint);
      // Validamos o array completo vindo do Backend
      return ProductSchema.array().parse(data);
    } catch (err: any) {
      this.handleError(err, 'Fetch All');
      throw err;
    }
  }

  /**
   * Provisiona um novo ativo no Hub.
   */
  async create(productData: Partial<Product>): Promise<Product> {
    try {
      const { data } = await api.post(this.endpoint, productData);
      return ProductSchema.parse(data);
    } catch (err: any) {
      this.handleError(err, 'Create');
      throw err;
    }
  }

  /**
   * Remove um ativo pelo ID.
   */
  async delete(id: number): Promise<void> {
    try {
      // Garantimos a barra final (padrão Django) para evitar 404/301
      await api.delete(`${this.endpoint}${id}/`);
    } catch (err: any) {
      this.handleError(err, 'Delete');
      throw err;
    }
  }

  /**
   * Handler de erros centralizado para Logs de Auditoria.
   */
  private handleError(err: any, context: string) {
    if (err.response) {
      console.error(`❌ [ProductService][${context}] Server Error:`, err.response.status);
    } else if (err.request) {
      console.error(`❌ [ProductService][${context}] Network Offline.`);
    } else {
      console.error(`❌ [ProductService][${context}] Schema Validation Failed:`, err.message);
    }
  }
}

// CRITICAL: Exportação Padrão da Instância
const productServiceInstance = new ProductService();
export default productServiceInstance;