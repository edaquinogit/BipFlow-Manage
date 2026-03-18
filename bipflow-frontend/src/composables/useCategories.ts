import { ref } from 'vue';
import type { Category } from '../schemas/category.schema';
import CategoryService from '../services/category.service';

export function useCategories() {
  const categories = ref<Category[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  /**
   * 📡 Sync: Busca todas as categorias do Django
   */
  const fetchCategories = async () => {
    loading.value = true;
    error.value = null;
    try {
      // Chamada real ao Service
      const data = await CategoryService.getAll();
      categories.value = data;
    } catch (err) {
      error.value = "BipFlow Sync Error: Registry connection failed.";
      console.error("[Composable Error]:", err);
    } finally {
      loading.value = false;
    }
  };

  /**
   * ➕ Action: Adiciona nova categoria e sincroniza a lista
   */
  const addCategory = async (payload: Partial<Category>) => {
    loading.value = true;
    try {
      await CategoryService.create(payload);
      // Após criar com sucesso, re-sincronizamos a lista (Single Source of Truth)
      await fetchCategories();
    } catch (err) {
      error.value = "Failed to create new classification.";
      throw err; // Repassamos o erro para o componente tratar a UI (ex: parar o loading do botão)
    } finally {
      loading.value = false;
    }
  };

  /**
   * 🗑️ Action: Remove uma categoria
   */
  const deleteCategory = async (id: number) => {
    if (!id) return;
    
    loading.value = true;
    try {
      await CategoryService.delete(id);
      // Otimização: Filtramos localmente para feedback instantâneo (Optimistic Update)
      categories.value = categories.value.filter(cat => cat.id !== id);
    } catch (err) {
      error.value = "Failed to delete entry.";
      console.error(err);
    } finally {
      loading.value = false;
    }
  };

  return {
    categories,
    loading,
    error,
    fetchCategories,
    addCategory,
    deleteCategory
  };
}