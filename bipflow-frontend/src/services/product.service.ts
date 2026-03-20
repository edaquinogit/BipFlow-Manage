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
      // Validamos o array completo vindo do Backend (Data Integrity)
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
   * ATUALIZAÇÃO ESTRATÉGICA (PATCH)
   * Sincroniza alterações parciais de um ativo existente.
   */
  async update(id: number, productData: Partial<Product>): Promise<Product> {
    try {
      // O PATCH é sênior porque não sobrescreve campos omitidos no objeto
      const { data } = await api.patch(`${this.endpoint}${id}/`, productData);
      
      // Validação Zod pós-update: Garante que o retorno do Django é confiável
      return ProductSchema.parse(data);
    } catch (err: any) {
      this.handleError(err, 'Update');
      throw err;
    }
  }

  /**
   * Remove um ativo pelo ID.
   */
  async delete(id: number): Promise<void> {
    try {
      await api.delete(`${this.endpoint}${id}/`);
    } catch (err: any) {
      this.handleError(err, 'Delete');
      throw err;
    }
  }

  /**
   * Handler de erros centralizado para Logs de Auditoria BipFlow.
   */
  private handleError(err: any, context: string) {
    if (err.name === 'ZodError') {
      console.error(`⚠️ [ProductService][${context}] Schema Mismatch:`, err.errors);
    } else if (err.response) {
      console.error(`❌ [ProductService][${context}] API Error [${err.response.status}]:`, err.response.data);
    } else {
      console.error(`❌ [ProductService][${context}] Unexpected Failure:`, err.message);
    }
  }
}

// Exportação da Instância Única (Singleton Pattern)
export default new ProductService();