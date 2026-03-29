import api from "./api"; // Sua instância configurada do Axios
import { CategorySchema, type Category } from "../schemas/category.schema";

/**
 * CategoryService
 * Responsabilidade: Abstrair chamadas HTTP e validar dados de entrada/saída.
 */
class CategoryService {
  private readonly endpoint = "/categories/";

  async getAll(): Promise<Category[]> {
    const { data } = await api.get(this.endpoint);
    // Garantimos que o array que vem do Django segue o nosso Schema
    return data.map((item: any) => CategorySchema.parse(item));
  }

  async create(category: Partial<Category>): Promise<Category> {
    const { data } = await api.post(this.endpoint, category);
    return CategorySchema.parse(data);
  }

  async delete(id: number): Promise<void> {
    await api.delete(`${this.endpoint}${id}/`);
  }
}

export default new CategoryService();
