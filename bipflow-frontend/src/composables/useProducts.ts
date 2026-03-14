import { ref, computed } from 'vue';
import { ProductService } from '../services/product.service';
import type { Product } from '../schemas/product.schema';

export function useProducts() {
  // --- ESTADO (STATE) ---
  const products = ref<Product[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const selectedCategory = ref('All');

  // --- AÇÕES (ACTIONS) ---
  
  // Carrega os dados da API Django
  const fetchData = async () => {
    loading.value = true;
    error.value = null;
    
    try {
      const data = await ProductService.getAllProducts();
      // Garantimos que products sempre receba um array para não quebrar o .filter()
      products.value = Array.isArray(data) ? data : [];
    } catch (err: any) {
      error.value = "Failed to load products. Check your connection.";
      console.error("🏙️ NY Debug - Erro no Composable:", err);
      products.value = []; 
    } finally {
      loading.value = false;
    }
  };

  // --- COMPUTADOS (GETTERS) ---

  // Filtra os produtos baseado na categoria selecionada no Dashboard
  const filteredProducts = computed(() => {
    if (selectedCategory.value === 'All') return products.value;
    return products.value.filter(p => p.category === selectedCategory.value);
  });

  // Cálculo de Receita Dinâmico (Sempre em Dólar!)
  const totalRevenue = computed(() => {
    const total = filteredProducts.value.reduce((acc, p) => acc + Number(p.price), 0);
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD' 
    }).format(total);
  });

  // Retornamos tudo que o DashboardView vai precisar "consumir"
  return {
    products,
    loading,
    error,
    selectedCategory,
    filteredProducts,
    totalRevenue,
    fetchData
  };
}