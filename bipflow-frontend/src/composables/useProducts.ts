import { ref, computed } from 'vue';
import type { Product } from '../schemas/product.schema';
import ProductService from '../services/product.service';

/**
 * 🛰️ BIPFLOW PRODUCT HUB (NYC ARCHITECTURE)
 * Gerencia o estado global, cálculos e persistência de ativos.
 */
export function useProducts() {
  // ==========================================
  // 1. STATE (REACTIVE CORE)
  // ==========================================
  const products = ref<Product[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // ==========================================
  // 2. INTERNAL UTILS (PRIVATE HELPERS)
  // ==========================================

  /**
   * Extrai o valor de estoque lidando com inconsistências do banco.
   */
  const _getStockValue = (p: Product): number => {
    const val = (p as any).stock_quantity ?? (p as any).stock ?? 0;
    return Number(val);
  };

  /**
   * 🔄 PAYLOAD ADAPTER (Multipart/FormData Support)
   * Centraliza a validação de arquivos e conversão para o Django.
   */
  const _preparePayload = (data: Partial<Product>): FormData => {
    const formData = new FormData();
    const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB Limit

    Object.entries(data).forEach(([key, value]) => {
      if (value === null || value === undefined) return;

      // 🛡️ SECURITY GUARD: Validação de Imagem
      if (key === 'image') {
        if (value instanceof File) {
          if (value.size > MAX_FILE_SIZE) {
            throw new Error(`The image exceeds the 2MB limit.`);
          }
          formData.append(key, value);
        }
        // Se for string (URL), omitimos para o Django não tentar sobrescrever o binário com texto
        return;
      }

      // 🛠️ DATA FORMATTING: Price, Stock e Objects
      if (key === 'price' || key === 'stock') {
        formData.append(key, String(value === "" ? 0 : value));
      } else if (typeof value === 'object' && 'id' in (value as any)) {
        formData.append(key, String((value as any).id));
      } else {
        formData.append(key, String(value));
      }
    });

    return formData;
  };

  // ==========================================
  // 3. CALCULATED HUB (GETTERS)
  // ==========================================
  const totalRevenue = computed(() => {
    const total = products.value.reduce((acc, p) => {
      const price = Number(p.price || 0);
      return acc + (price * _getStockValue(p));
    }, 0);

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(total);
  });

  const inventoryStats = computed(() => ({
    totalItems: products.value.reduce((acc, p) => acc + _getStockValue(p), 0),
    lowStockCount: products.value.filter(p => _getStockValue(p) < 5).length
  }));

  // ==========================================
  // 4. ENGINE ACTIONS (CRUD)
  // ==========================================

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

  const createProduct = async (data: Partial<Product>): Promise<Product | undefined> => {
    loading.value = true;
    error.value = null;
    try {
      const payload = _preparePayload(data);
      const newAsset = await ProductService.create(payload);
      
      products.value = [newAsset, ...products.value];
      console.log(`✅ BipFlow: Asset ${newAsset.id} deployed.`);
      return newAsset;
    } catch (err: any) {
      error.value = err.message || "Deployment failed.";
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const updateProduct = async (id: number, data: Partial<Product>) => {
    loading.value = true;
    error.value = null;
    try {
      const payload = _preparePayload(data);
      const updatedAsset = await ProductService.update(id, payload);
      
      products.value = products.value.map(p => p.id === id ? updatedAsset : p);
      console.log(`🛠️ BipFlow: Asset ${id} synchronized.`);
      return updatedAsset;
    } catch (err: any) {
      error.value = "Sync update failed.";
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const deleteProduct = async (id: number) => {
    try {
      await ProductService.delete(id);
      products.value = products.value.filter(p => p.id !== id);
      console.log(`🗑️ BipFlow: Asset ${id} purged.`);
    } catch (err) {
      console.error("❌ BipFlow: Purge sequence failed.", err);
    }
  };

  // ==========================================
  // 5. EXPORT HUB
  // ==========================================
  return {
    products,
    loading,
    error,
    totalRevenue,
    inventoryStats,
    fetchData,
    createProduct,
    updateProduct,
    deleteProduct
  };
}