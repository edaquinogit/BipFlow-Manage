import api from './api';

// --- INTERFACES ---
export interface Category {
  id: number;
  name: string;
}

export interface Product {
  id: number;
  name: string;
  description?: string;
  price: string;
  category: string; // Nome da categoria (SlugRelatedField no Django)
  is_available: boolean;
  image: string | null;
}

// --- SERVIÇO ---
export const productService = {
  // === MÉTODOS DE PRODUTOS ===
  
  async getAll(): Promise<Product[]> {
    const response = await api.get<Product[]>('/products/');
    return response.data;
  },

  async getById(id: number): Promise<Product> {
    const response = await api.get<Product>(`/products/${id}/`);
    return response.data;
  },

  async create(formData: FormData): Promise<Product> {
    const response = await api.post<Product>('/products/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/products/${id}/`);
  },

  // === MÉTODOS DE CATEGORIAS ===

  async getCategories(): Promise<Category[]> {
    const response = await api.get<Category[]>('/categories/');
    return response.data;
  },

  async createCategory(name: string): Promise<Category> {
    // O Django espera um objeto { "name": "..." }
    const response = await api.post<Category>('/categories/', { name });
    return response.data;
  }
};