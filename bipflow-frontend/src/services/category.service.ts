import api from "./api";
import { CategorySchema } from "../schemas/category.schema";

const ENDPOINT = "v1/categories/" as const;

class CategoryService {
  async getAll() {
    try {
      const { data } = await api.get(ENDPOINT);
      return data;
    } catch (error) {
      console.error("[CategoryService] Failed to fetch categories", error);
      throw error;
    }
  }

  async create(payload: any) {
    try {
      const { data } = await api.post(ENDPOINT, payload);
      return data;
    } catch (error) {
      console.error("[CategoryService] Failed to create category", error);
      throw error;
    }
  }

  async remove(id: number | string) {
    try {
      await api.delete(`${ENDPOINT}${id}/`);
    } catch (error) {
      console.error(`[CategoryService] Failed to delete category ${id}`, error);
      throw error;
    }
  }
}

export const categoryService = new CategoryService();
