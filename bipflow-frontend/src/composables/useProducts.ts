import { ref, computed } from 'vue';
import { ProductService } from '../services/product.service';
import type { Product } from '../schemas/product.schema';

export function useProducts() {
  // --- 1. ESTADO (STATE) ---
  const products = ref<Product[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const selectedCategory = ref<string | number>('All');

  // --- 2. AÇÕES (ACTIONS) ---
  const fetchData = async () => {
    loading.value = true;
    error.value = null;
    try {
      const data = await ProductService.getAllProducts();
      products.value = Array.isArray(data) ? data : [];
    } catch (err) {
      error.value = "Failed to load inventory. Check backend connection.";
      products.value = [];
    } finally {
      loading.value = false;
    }
  };

  // --- 3. FILTRAGEM (INVENTORY LOGIC) ---
  const filteredProducts = computed(() => {
    const categoryFilter = selectedCategory.value;
    const list = products.value;

    if (!categoryFilter || categoryFilter === 'All') {
      return list;
    }

    return list.filter((p) => {
      // Normalização de comparação String vs Number
      const pCat = String(p.category);
      const sCat = String(categoryFilter);
      return pCat === sCat;
    });
  });

  // --- 4. INTELIGÊNCIA DE NEGÓCIO (BI) ---
  const totalRevenue = computed(() => {
    const rawTotal = filteredProducts.value.reduce((acc, p) => {
      const price = Number(p.price) || 0;
      const stock = Number(p.stock_quantity) || 0;
      return acc + (price * stock);
    }, 0);

    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD' 
    }).format(rawTotal);
  });

  const inventoryStats = computed(() => {
    const list = filteredProducts.value;
    return {
      totalItems: list.length,
      lowStockCount: list.filter(p => (Number(p.stock_quantity) || 0) < 5).length,
      outOfStock: list.filter(p => (Number(p.stock_quantity) || 0) === 0).length
    };
  });

  // --- 5. EXPOSIÇÃO ---
  return {
    products,
    loading,
    error,
    selectedCategory,
    filteredProducts,
    totalRevenue,
    inventoryStats,
    fetchData
  };
}