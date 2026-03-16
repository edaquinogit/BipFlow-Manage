<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useProducts } from '../composables/useProducts';
import { authService } from '../services/auth.service';
import type { Product } from '../schemas/product.schema';

// Componentes da UI (Atomic Design)
import ProductTable from '../components/dashboard/ProductTable.vue';
import ProductForm from '../components/dashboard/ProductForm.vue';

const router = useRouter();

// --- ESTADO GLOBAL (COMPOSABLE) ---
const {
  loading,
  error,
  totalRevenue,
  inventoryStats,
  filteredProducts,
  fetchData,
} = useProducts();

// --- ESTADO LOCAL (VIEW) ---
const isPanelOpen = ref(false);

// --- AÇÕES (HANDLERS) ---
const handleLogout = () => {
  authService.logout();
  router.push('/login');
};

const handleDelete = async (id: number | undefined) => {
  if (!id) return;
  
  if (confirm('Confirm product removal from New York Hub?')) {
    // TODO: Conectar com deleteProduct do composable
    // await deleteProduct(id);
    await fetchData();
  }
};

const handleAddProduct = async (productData: Partial<Product>) => {
  console.log("🚀 Payload pronto para o Django:", productData);
  
  // TODO: Conectar com createProduct do composable
  // await createProduct(productData);
  
  isPanelOpen.value = false;
  // await fetchData(); // Atualiza a tabela após criar
};

// --- LIFECYCLE ---
onMounted(fetchData);
</script>

<template>
  <div class="min-h-screen bg-zinc-950 text-zinc-200 font-sans selection:bg-indigo-500">
    
    <header class="sticky top-0 z-30 border-b border-zinc-900 bg-zinc-950 backdrop-blur-xl">
      <div class="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
        
        <div class="flex items-center gap-4">
          <div class="h-10 w-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-900">
            <span class="text-white font-black text-xl italic tracking-tighter">B</span>
          </div>
          <div class="hidden sm:block">
            <h1 class="text-lg font-black tracking-tighter text-white uppercase italic leading-none">BipFlow</h1>
            <p class="text-[9px] text-zinc-500 uppercase tracking-[0.3em] font-bold mt-1">Omnichannel Engine</p>
          </div>
        </div>

        <div class="flex items-center gap-6">
          <span class="text-[10px] font-bold text-zinc-500 uppercase tracking-widest bg-zinc-900 px-3 py-1 rounded-full border border-zinc-800">
            NYC Station
          </span>
          <button @click="handleLogout" class="text-xs font-bold text-zinc-500 hover:text-white transition-colors">
            Logout
          </button>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-6 py-12 space-y-12">
      
      <section class="grid grid-cols-1 lg:grid-cols-3 gap-8 items-end">
        <div class="lg:col-span-2">
          <h2 class="text-5xl font-black text-white tracking-tighter mb-4">Dashboard</h2>
          <div class="flex gap-4">
            <div class="px-4 py-2 bg-zinc-900 rounded-lg border border-zinc-800">
              <p class="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">In Stock</p>
              <p class="text-xl font-bold text-zinc-200">{{ inventoryStats.totalItems }} Items</p>
            </div>
            <div class="px-4 py-2 bg-zinc-900 rounded-lg border border-zinc-800">
              <p class="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Low Stock</p>
              <p class="text-xl font-bold text-orange-400">{{ inventoryStats.lowStockCount }} Alerts</p>
            </div>
          </div>
        </div>

        <div class="relative group overflow-hidden bg-zinc-900 border border-zinc-800 p-8 rounded-3xl shadow-2xl">
          <div class="relative z-10">
            <p class="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">Inventory Valuation</p>
            <p class="text-4xl font-mono text-white font-black tracking-tighter">{{ totalRevenue }}</p>
          </div>
          <div class="absolute -right-2 -bottom-2 text-zinc-800 opacity-30 group-hover:opacity-60 transition-opacity duration-700">
            <svg class="w-32 h-32" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z" />
            </svg>
          </div>
        </div>
      </section>

      <section class="space-y-6">
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h3 class="text-xl font-bold text-white flex items-center gap-2">
            Active Listings
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          </h3>
          
          <button @click="isPanelOpen = true" class="w-full sm:w-auto bg-white text-black hover:bg-zinc-200 px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-xl shadow-zinc-800">
            + New Product
          </button>
        </div>

        <div v-if="loading" class="space-y-4">
          <div v-for="i in 5" :key="i" class="h-20 bg-zinc-900 animate-pulse rounded-2xl border border-zinc-800"></div>
        </div>

        <div v-else-if="error" class="group p-12 bg-red-950 border border-red-900 rounded-3xl text-center">
          <div class="inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-900 text-red-500 mb-4">!</div>
          <p class="text-zinc-300 font-medium">{{ error }}</p>
          <button @click="fetchData" class="mt-4 text-xs font-bold text-red-400 uppercase tracking-widest hover:text-red-300 transition-colors">
            Reconnect to Hub
          </button>
        </div>

        <ProductTable
          v-else
          :products="filteredProducts"
          :is-loading="loading"
          @delete="handleDelete"
          @edit="(product) => console.log('Edit:', product)"
        />
      </section>
    </main>

    <ProductForm 
      :is-open="isPanelOpen" 
      @close="isPanelOpen = false" 
      @save="handleAddProduct" 
    />
  </div>
</template>