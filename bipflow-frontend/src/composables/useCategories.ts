import { ref, computed } from 'vue';
import type { Category } from '../schemas/category.schema';
import CategoryService from '../services/category.service';

// Mantemos o estado FORA da função para que ele funcione como um "Store" (Singleton)
// Isso garante que se você mudar de página e voltar, as categorias ainda estarão lá.
const categories = ref<Category[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const lastFetched = ref<number | null>(null);

export function useCategories() {
  
  /**
   * 📡 Sync: Busca todas as categorias (Com Cache de 5 minutos)
   */
  const fetchCategories = async (force = false) => {
    // Evita chamadas desnecessárias se já temos dados (TTL de 5min)
    const isCacheValid = lastFetched.value && (Date.now() - lastFetched.value < 300000);
    if (!force && categories.value.length > 0 && isCacheValid) return;

    loading.value = true;
    error.value = null;
    
    try {
      const data = await CategoryService.getAll();
      categories.value = data;
      lastFetched.value = Date.now();
      console.log("📂 BipFlow: Categories registry synchronized.");
    } catch (err) {
      error.value = "Registry connection failed.";
      console.error("[Category Sync Error]:", err);
    } finally {
      loading.value = false;
    }
  };

  /**
   * ➕ Action: Create & Refresh
   */
  const addCategory = async (payload: Partial<Category>) => {
    loading.value = true;
    try {
      const newCategory = await CategoryService.create(payload);
      // Otimização: Em vez de fetch total, apenas adicionamos ao estado
      categories.value = [...categories.value, newCategory];
      return newCategory;
    } catch (err) {
      error.value = "Failed to create new classification.";
      throw err;
    } finally {
      loading.value = false;
    }
  };

  /**
   * 🗑️ Action: Optimistic Delete
   */
  const deleteCategory = async (id: number) => {
    if (!id) return;
    
    const previousState = [...categories.value];
    // UI Instantânea (Optimistic Update)
    categories.value = categories.value.filter(cat => cat.id !== id);

    try {
      await CategoryService.delete(id);
    } catch (err) {
      // Rollback em caso de erro no servidor
      categories.value = previousState;
      error.value = "Decommission failed. Rollback executed.";
      console.error(err);
    }
  };

  // Helper para select/dropdowns (Ordenado alfabeticamente)
  const sortedCategories = computed(() => 
    [...categories.value].sort((a, b) => a.name.localeCompare(b.name))
  );

  return {
    categories: sortedCategories,
    rawCategories: categories,
    loading,
    error,
    fetchCategories,
    addCategory,
    deleteCategory
  };
}