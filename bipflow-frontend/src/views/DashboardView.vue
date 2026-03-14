<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useProducts } from '../composables/useProducts';
import { authService } from '../services/auth.service';

// Componentes
import ProductTable from '../components/dashboard/ProductTable.vue';

const router = useRouter();

/**
 * Hook de Composição: Toda a inteligência de dados está isolada aqui.
 * Isso limpa a View e facilita testes unitários.
 */
const { 
  products, 
  loading, 
  error, 
  totalRevenue, 
  fetchData,
  deleteProduct // Assumindo que você adicionará essa função ao composable
} = useProducts();

const handleLogout = () => {
  authService.logout();
  router.push('/login');
};

const handleDelete = async (id: number) => {
  if (confirm('Are you sure you want to delete this product? 🍎')) {
    await deleteProduct(id);
    await fetchData(); // Refresh na lista
  }
};

onMounted(fetchData);
</script>

<template>
  <div class="min-h-screen bg-zinc-950 text-zinc-200 font-sans selection:bg-green-500/30">
    <header class="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
      <div class="max-w-7xl mx-auto px-4 md:px-8 py-4 flex justify-between items-center">
        <div class="flex items-center gap-3">
          <div class="h-10 w-10 bg-green-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-900/20">
            <span class="text-white font-black text-xl">B</span>
          </div>
          <div>
            <h1 class="text-xl font-black tracking-tight text-white leading-none">BIPFLOW</h1>
            <p class="text-[10px] text-zinc-500 uppercase tracking-[0.2em] font-bold">New York Hub</p>
          </div>
        </div>

        <div class="flex items-center gap-4">
          <button 
            @click="handleLogout" 
            class="text-xs font-bold text-zinc-500 hover:text-red-400 transition-colors uppercase tracking-widest"
          >
            Logout
          </button>
        </div>
      </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 md:px-8 py-10 space-y-10">
      
      <section class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2">
          <h2 class="text-4xl font-black text-white mb-2">Inventory Overview</h2>
          <p class="text-zinc-500 text-lg">Real-time valuation of your stock in USD.</p>
        </div>

        <div class="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden group">
          <div class="z-10">
            <p class="text-xs font-black text-zinc-500 uppercase tracking-widest mb-1">Global Revenue</p>
            <p class="text-3xl font-mono text-green-400 font-bold tracking-tighter">
              ${{ totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 }) }}
            </p>
          </div>
          <div class="absolute -right-4 -bottom-4 text-zinc-800/50 group-hover:text-green-500/10 transition-colors">
            <svg class="w-24 h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z"/></svg>
          </div>
        </div>
      </section>

      <section class="space-y-4">
        <div class="flex justify-between items-end">
          <div class="flex gap-4 items-center">
            <h3 class="text-xl font-bold text-white">Active Listings</h3>
            <span class="px-2 py-0.5 bg-zinc-800 rounded text-xs text-zinc-400 border border-zinc-700">
              {{ products.length }} items
            </span>
          </div>
          
          <button class="bg-green-600 hover:bg-green-500 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-xl shadow-green-900/40 active:scale-95">
            + Add Product
          </button>
        </div>

        <div v-if="loading" class="grid gap-4">
          <div v-for="i in 3" :key="i" class="h-16 bg-zinc-900 animate-pulse rounded-xl border border-zinc-800"></div>
        </div>

        <div v-else-if="error" class="p-8 bg-red-500/10 border border-red-500/20 rounded-2xl text-center">
          <p class="text-red-400 font-medium">Failed to sync with New York server.</p>
          <button @click="fetchData" class="mt-4 text-sm text-white underline">Retry connection</button>
        </div>

        <ProductTable 
          v-else 
          :products="products" 
          :is-loading="loading"
          @delete="handleDelete" 
        />
      </section>
    </main>
  </div>
</template>