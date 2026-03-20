<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useProducts } from '@/composables/useProducts';
import { useCategories } from '@/composables/useCategories'; // Novo Import
import type { Product } from '@/schemas/product.schema';

// Componentes de Domínio e Layout (Padrão de Herança BipFlow)
import DashboardHeader from '@/components/dashboard/layout/DashboardHeader.vue';
import StatsGrid from '@/components/dashboard/stats/StatsGrid.vue';
import ProductListing from '@/components/dashboard/table/ProductListing.vue';
import ProductForm from '@/components/dashboard/ProductForm.vue';
import ConfirmModal from '@/components/dashboard/layout/ConfirmModal.vue';

/**
 * --- ENGINE STATE (Reactive Core) ---
 */
const isPanelOpen = ref(false);
const isDeleteModalOpen = ref(false);
const assetIdToPurge = ref<number | null>(null);
const selectedProduct = ref<Product | null>(null);

// Hub de Produtos
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

// Hub de Categorias
const { 
  categories, 
  fetchCategories 
} = useCategories();

/**
 * --- BUSINESS HANDLERS (The NYC Logic) ---
 */

// Abre o painel para um novo produto (Reset de Estado)
const handleOpenNewPanel = () => {
  selectedProduct.value = null;
  isPanelOpen.value = true;
};

// Abre o painel populado para edição
const handleEditRequest = (product: Product) => {
  selectedProduct.value = product;
  isPanelOpen.value = true;
};

// Fecha o painel e limpa rastro de memória (Clean State)
const handleClosePanel = () => {
  isPanelOpen.value = false;
  selectedProduct.value = null;
};

// Orquestrador de Persistência (Create vs Update com Suporte a Upload)
const handleSave = async (payload: any) => {
  try {
    /**
     * 🧹 NYC CLEAN PAYLOAD STRATEGY
     * Removemos campos virtuais/read-only que o Django rejeita.
     */
    const { 
      id, 
      created_at, 
      updated_at,
      category_name, 
      ...cleanData 
    } = payload;

    /**
     * 🛡️ IMAGE UPLOAD GUARD
     * O Django (ImageField) espera um binário (File).
     * Se 'image' for uma string (URL vinda do banco), significa que o 
     * usuário não trocou a foto. Logo, deletamos o campo do payload 
     * para não sobrescrever a imagem com uma string e causar erro 400.
     */
    if (typeof cleanData.image === 'string') {
      delete cleanData.image;
    }

    if (selectedProduct.value?.id) {
      await updateProduct(selectedProduct.value.id, cleanData);
      console.log(`🛠️ BipFlow: Asset ${selectedProduct.value.id} updated successfully.`);
    } else {
      await createProduct(cleanData);
      console.log(`🚀 BipFlow: New asset deployed.`);
    }
    
    handleClosePanel();
  } catch (err) {
    console.error("❌ BipFlow: Save operation failed at API level.", err);
  }
};

/**
 * --- DELETION PROTOCOL ---
 */
const openDeleteConfirm = (id: number) => {
  assetIdToPurge.value = id;
  isDeleteModalOpen.value = true;
};

const executeDelete = async () => {
  if (assetIdToPurge.value !== null) {
    try {
      await deleteProduct(assetIdToPurge.value);
      console.log(`🗑️ BipFlow: Asset purged from local registry.`);
    } finally {
      isDeleteModalOpen.value = false;
      assetIdToPurge.value = null;
    }
  }
};

/**
 * --- SYSTEM BOOTSTRAP ---
 * Carrega Produtos e Categorias em paralelo (Performance de Alto Nível)
 */
onMounted(async () => {
  await Promise.all([
    fetchData(),
    fetchCategories()
  ]);
});
</script>

<template>
  <div class="min-h-screen bg-zinc-950 text-zinc-200 selection:bg-indigo-500/30">
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
      title="Purge Active Asset?"
      message="Attention: This operation is final. Removing this asset will update the global inventory valuation in real-time."
      :is-loading="productsLoading"
      @close="isDeleteModalOpen = false"
      @confirm="executeDelete"
    />
  </div>
</template>