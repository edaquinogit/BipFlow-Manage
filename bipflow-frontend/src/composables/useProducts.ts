import { ref, computed } from 'vue';
import type { Product } from '../schemas/product.schema';
import ProductService from '../services/product.service'; 

export function useProducts() {
  const products = ref<Product[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  /**
   * --- 1. CALCULATED HUB (Blindagem NYC) ---
   * Resolvemos os erros de 'stock' e 'price' garantindo que o TS os trate como números.
   */
  const totalRevenue = computed(() => {
    const total = products.value.reduce((acc, p) => {
      // Usamos Number() para converter caso venha string do banco
      const price = Number(p.price || 0);
      const stock = Number(p.stock || 0);
      return acc + (price * stock);
    }, 0);

    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      maximumFractionDigits: 0 
    }).format(total);
  });

  const inventoryStats = computed(() => ({
    // Acessando stock com fallback de segurança
    totalItems: products.value.reduce((acc, p) => acc + (Number(p.stock) || 0), 0),
    lowStockCount: products.value.filter(p => (Number(p.stock) || 0) < 5).length
  }));

  /**
   * --- 2. ENGINE ACTIONS ---
   */
  const fetchData = async () => {
    loading.value = true;
    error.value = null;
    try {
      // Agora o ProductService.getAll() será reconhecido sem erros de módulo
      products.value = await ProductService.getAll();
    } catch (err) {
      error.value = "BipFlow: NYC Station Sync Failed.";
      console.error("[Engine Error]:", err);
    } finally {
      loading.value = false;
    }
  };

  // Funções de escrita para o Dashboard orquestrar
  const createProduct = async (data: Partial<Product>) => {
    await ProductService.create(data);
    await fetchData();
  };

  const deleteProduct = async (id: number) => {
    await ProductService.delete(id);
    products.value = products.value.filter(p => p.id !== id);
  };

  return {
    products,
    loading,
    error,
    totalRevenue,
    inventoryStats,
    fetchData,
    createProduct,
    deleteProduct
  };
}