import { ref, computed } from 'vue';
import type { Product } from '../schemas/product.schema';
import ProductService from '../services/product.service'; 

export function useProducts() {
  const products = ref<Product[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  /**
   * --- HELPER DE EXTRAÇÃO (ESTRATÉGIA SENIOR) ---
   * Resolve os 3 erros de 'p.stock' centralizando a lógica de fallback.
   * Se o banco retornar 'stock' ou 'stock_quantity', ele captura corretamente.
   */
  const getStockValue = (p: Product): number => {
    // Acessamos via chave de string para evitar o erro de tipagem do TS
    const val = (p as any).stock_quantity ?? (p as any).stock ?? 0;
    return Number(val);
  };

  /**
   * --- 1. CALCULATED HUB ---
   */
  const totalRevenue = computed(() => {
    const total = products.value.reduce((acc, p) => {
      const price = Number(p.price || 0);
      return acc + (price * getStockValue(p));
    }, 0);

    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD', 
      maximumFractionDigits: 0 
    }).format(total);
  });

  const inventoryStats = computed(() => ({
    totalItems: products.value.reduce((acc, p) => acc + getStockValue(p), 0),
    lowStockCount: products.value.filter(p => getStockValue(p) < 5).length
  }));

  /**
   * --- 2. ENGINE ACTIONS ---
   */
  const fetchData = async () => {
    loading.value = true;
    error.value = null;
    try {
      products.value = await ProductService.getAll();
    } catch (err) {
      error.value = "BipFlow: NYC Station Sync Failed.";
    } finally {
      loading.value = false;
    }
  };

  const createProduct = async (data: Partial<Product>) => {
    try {
      const newProduct = await ProductService.create(data);
      products.value = [newProduct, ...products.value];
    } catch (err) {
      console.error("❌ BipFlow: Provisioning failed.");
    }
  };

  /**
   * UPDATE ASSET (NYC HUB SYNC)
   * Realiza o patch no service e sincroniza o estado local de forma imutável.
   */
  const updateProduct = async (id: number, data: Partial<Product>) => {
    loading.value = true; // Inicia feedback visual
    try {
      const updated = await ProductService.update(id, data);
      
      // Mapeamento Imutável: Garante que a reatividade do Vue detecte a mudança
      products.value = products.value.map(p => 
        p.id === id ? { ...p, ...updated } : p
      );
      
      console.log(`🛠️ BipFlow: Asset ${id} synchronized with global registry.`);
    } catch (err) {
      error.value = "Failed to synchronize update with NYC Station.";
      console.error("❌ BipFlow: Update sequence failed.", err);
      throw err; // Repassa o erro para o Dashboard tratar se necessário
    } finally {
      loading.value = false;
    }
  };

  const deleteProduct = async (id: number) => {
    try {
      await ProductService.delete(id);
      products.value = products.value.filter(p => p.id !== id);
    } catch (err) {
      console.error("❌ BipFlow: Purge failed.", err);
    }
  };

  // --- RETURN HUB (Organização e Exportação Única) ---
  return {
    products,
    loading,
    error,
    totalRevenue,
    inventoryStats,
    fetchData,
    createProduct,
    updateProduct, // Apenas uma vez aqui
    deleteProduct
  };
}