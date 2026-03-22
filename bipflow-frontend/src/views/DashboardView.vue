<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useProducts } from '@/composables/useProducts';
import { useCategories } from '@/composables/useCategories';
import type { Product } from '@/schemas/product.schema';

// Layout & UI Components
import DashboardHeader from '@/components/dashboard/layout/DashboardHeader.vue';
import StatsGrid from '@/components/dashboard/stats/StatsGrid.vue';
import ProductListing from '@/components/dashboard/product-table/ProductListing.vue';
import ProductForm from '@/components/dashboard/product-form/ProductFormRoot.vue';
import ConfirmModal from '@/components/dashboard/layout/ConfirmModal.vue';

/**
 * 🛰️ ENGINE STATE
 */
const isPanelOpen = ref(false);
const isDeleteModalOpen = ref(false);
const assetIdToPurge = ref<number | null>(null);
const selectedProduct = ref<Product | null>(null);

const {
  loading: productsLoading,
  error,      
  products,
  fetchData,
  createProduct,
  updateProduct, 
  deleteProduct,
  totalRevenue,
  inventoryStats
} = useProducts();

const { categories, fetchCategories } = useCategories();

/**
 * 🧠 BUSINESS LOGIC (NYC HUB HANDLERS)
 */

const handleOpenNewPanel = () => {
  selectedProduct.value = null;
  isPanelOpen.value = true;
};

const handleEditRequest = (product: Product) => {
  // Deep clone preventivo para evitar mutação indesejada no estado global
  selectedProduct.value = { ...product };
  isPanelOpen.value = true;
};

const handleClosePanel = () => {
  isPanelOpen.value = false;
  selectedProduct.value = null;
};

/**
 * 💾 PERSISTENCE ORCHESTRATOR
 * Gerencia o ciclo de vida do dado com validação rigorosa de mídia.
 */
const handleSave = async (payload: any) => {
  try {
    /**
     * 1. 🧹 DATA SANITIZATION
     * Removemos campos protegidos (read-only) para não gerar erro 400 no Django.
     */
    const { 
      id, 
      created_at, 
      updated_at,
      category_name, 
      ...dataToSync 
    } = payload;

    /**
     * 2. 🛡️ ASSET MEDIA GUARD
     * Se 'image' for string, o usuário não subiu um arquivo novo.
     * Deletamos a string do payload para que o Django mantenha a foto atual.
     */
    if (typeof dataToSync.image === 'string') {
      delete dataToSync.image;
    }

    // 3. EXECUTION PHASE
    if (selectedProduct.value?.id) {
      await updateProduct(selectedProduct.value.id, dataToSync);
      console.log(`✅ BipFlow: Asset ${selectedProduct.value.id} synchronized.`);
    } else {
      await createProduct(dataToSync);
      console.log(`🚀 BipFlow: New asset deployed to registry.`);
    }
    
    /**
     * 4. 🔄 REGISTRY REFRESH (A SOLUÇÃO DO ERRO DE RENDERIZAÇÃO)
     * Forçamos uma nova busca no backend. Isso garante que o Vue receba 
     * a nova 'image_url' gerada pelo Django, reativando a exibição no Avatar.
     */
    await fetchData();
    
    // 5. UI FEEDBACK
    handleClosePanel();
    
  } catch (err) {
    console.error("❌ BipFlow: Save operation aborted.", err);
  }
};

/**
 * 🗑️ TERMINATION PROTOCOL
 */
const openDeleteConfirm = (id: number) => {
  assetIdToPurge.value = id;
  isDeleteModalOpen.value = true;
};

const executeDelete = async () => {
  if (!assetIdToPurge.value) return;
  
  try {
    await deleteProduct(assetIdToPurge.value);
    console.log(`🗑️ BipFlow: Asset purged.`);
    
    // Garante integridade do grid após exclusão
    await fetchData(); 
  } finally {
    isDeleteModalOpen.value = false;
    assetIdToPurge.value = null;
  }
};

/**
 * ⚡ SYSTEM BOOTSTRAP
 */
onMounted(async () => {
  // Carregamento paralelo para máxima performance na montagem da tela
  await Promise.all([
    fetchData(),
    fetchCategories()
  ]);
});
</script>

<template>
  <div class="min-h-screen bg-zinc-950 text-zinc-200 selection:bg-indigo-500/30 font-sans antialiased">
    <DashboardHeader />

    <main class="max-w-7xl mx-auto px-6 py-12 space-y-16">
      <StatsGrid 
        :stats="inventoryStats" 
        :revenue="totalRevenue" 
        :is-loading="productsLoading"
      />

      <ProductListing 
        :products="products"
        :is-loading="productsLoading"
        :error="error"
        @open-panel="handleOpenNewPanel"
        @edit="handleEditRequest"
        @delete="openDeleteConfirm"
        @retry="fetchData"
      />
    </main>

    <ProductForm 
      :is-open="isPanelOpen" 
      :initial-data="selectedProduct"
      :categories="categories"
      @close="handleClosePanel" 
      @save="handleSave" 
    />

    <ConfirmModal 
      :show="isDeleteModalOpen"
      title="Confirm Asset Deletion"
      message="This action is irreversible. The asset will be permanently removed from the BipFlow global registry."
      :is-loading="productsLoading"
      @close="isDeleteModalOpen = false"
      @confirm="executeDelete"
    />
  </div>
</template>