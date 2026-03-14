import api from './api';
import { ProductSchema, type Product } from '../schemas/product.schema';

export const ProductService = {
  /**
   * Busca todos os produtos do Django e valida com Zod
   */
  async getAllProducts(): Promise<Product[]> {
    try {
      const response = await api.get('products/');
      
      // Validamos se o que veio do Django bate com o nosso contrato (Schema)
      return ProductSchema.array().parse(response.data);
      
    } catch (err: any) {
      if (err.response) {
        // O servidor respondeu com erro (ex: 401, 500)
        console.error("❌ Erro do Servidor Django:", err.response.status);
        console.error("Mensagem do Backend:", err.response.data);
      } else if (err.request) {
        // Sem resposta do servidor
        console.error("❌ O Django não respondeu. O servidor está ligado?");
      } else {
        // Erro de validação do Zod ou configuração
        console.error("❌ Erro na aplicação:", err.message);
      }
      throw err;
    }
  } // Fim da função getAllProducts
}; // Fim do objeto ProductService