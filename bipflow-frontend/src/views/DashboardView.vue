<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useProducts } from '@/composables/useProducts';

// Componentes Refatorados por Domínio
import DashboardHeader from '@/components/dashboard/layout/DashboardHeader.vue';
import StatsGrid from '@/components/dashboard/stats/StatsGrid.vue';
import ProductListing from '@/components/dashboard/table/ProductListing.vue';
import ProductForm from '@/components/dashboard/ProductForm.vue';

// --- ENGINE STATE ---
const isPanelOpen = ref(false);
const {
  loading,
  error,
  totalRevenue,
  inventoryStats,
  products,
  fetchData,
  createProduct,
  deleteProduct
} = useProducts();

// --- BUSINESS HANDLERS ---
const handleSave = async (data: any) => {
  await createProduct(data);
  isPanelOpen.value = false;
};

const handleRemove = async (id: number) => {
  if (confirm('Confirm product removal from New York Hub?')) {
    await deleteProduct(id);
  }
};

onMounted(fetchData);
</script>

<template>
  <div class="min-h-screen bg-zinc-950 text-zinc-200 selection:bg-indigo-500/30">
    <DashboardHeader />

    <main class="max-w-7xl mx-auto px-6 py-12 space-y-16">
      <StatsGrid 
        :stats="inventoryStats" 
        :revenue="totalRevenue" 
        :is-loading="loading"
      />

      <ProductListing 
        :products="products"
        :is-loading="loading"
        :error="error"
        @open-panel="isPanelOpen = true"
        @delete="handleRemove"
        @retry="fetchData"
      />
    </main>

    <ProductForm 
      :is-open="isPanelOpen" 
      @close="isPanelOpen = false" 
      @save="handleSave" 
    />
  </div>
</template>