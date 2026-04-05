<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useProducts } from '@/composables/useProducts';
import { useCategories } from '@/composables/useCategories';
import type { Product } from '@/schemas/product.schema';
import { PRODUCT_WRITABLE_API_KEYS } from '@/constants/productApiFields';
import { productsLogger } from '@/lib/logger';

// Layout & UI Components
import DashboardHeader from '@/components/dashboard/layout/DashboardHeader.vue';
import StatsGrid from '@/components/dashboard/stats/StatsGrid.vue';
import ProductListing from '@/components/dashboard/product-table/ProductListing.vue';
import ProductForm from '@/components/dashboard/product-form/ProductFormRoot.vue';
import ConfirmModal from '@/components/dashboard/layout/ConfirmModal.vue';

/**
 * 🛰️ UI STATE MACHINE
 * Estados visuais e controles de modais.
 */
const isPanelOpen = ref(false);
const isDeleteModalOpen = ref(false);

/**
 * 💾 DATA CONTEXT
 * Contexto de dados operacionais atuais.
 */
const assetIdToPurge = ref<number | null>(null);
const selectedProduct = ref<Product | null>(null);

/**
 * ⚙️ ASYNC ACTION STATES
 * Granularidade de loading para não travar a UI inteira durante requisições.
 */
const isSaving = ref(false);
const isDeletingAction = ref(false);

// Composables (Data Layer)
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
 * 🧠 EVENT HANDLERS (View Controllers)
 */
const handleOpenNewPanel = () => {
  selectedProduct.value = null;
  isPanelOpen.value = true;
};

const handleEditRequest = (product: Product) => {
  // Deep clone preventivo para isolamento de memória
  selectedProduct.value = { ...product };
  isPanelOpen.value = true;
};

const handleClosePanel = () => {
  isPanelOpen.value = false;
  selectedProduct.value = null;
};

/**
 * 🧹 DATA SANITIZER (Pure Logic)
 * Prepara o payload para o Django, removendo campos calculados e protegendo mídias.
 * @param rawPayload - O objeto vindo do formulário ou estado do Vue
 * @returns Um objeto limpo pronto para o backend
 */
const sanitizePayloadForDjango = (rawPayload: Partial<Product> & Record<string, unknown>) => {
  const {
    id: _id,
    created_at: _ca,
    updated_at: _ua,
    category_name: _cn,
    ...rest
  } = rawPayload;

  const cleanData: Record<string, unknown> = {};
  for (const key of PRODUCT_WRITABLE_API_KEYS) {
    if (key in rest && rest[key] !== undefined) {
      cleanData[key] = rest[key];
    }
  }

  if (typeof cleanData.image === 'string' || !cleanData.image) {
    delete cleanData.image;
  }

  return JSON.parse(JSON.stringify(cleanData)) as Partial<Product>;
};

/**
 * 🚀 PERSISTENCE ORCHESTRATOR
 */
const handleSave = async (payload: Partial<Product>) => {
  isSaving.value = true;
  
  try {
    const dataToSync = sanitizePayloadForDjango(payload);

    if (selectedProduct.value?.id) {
      await updateProduct(selectedProduct.value.id, dataToSync);
      productsLogger.info(
        { id: selectedProduct.value.id },
        'Asset synchronized (update)',
      );
    } else {
      await createProduct(dataToSync);
      productsLogger.info({}, 'Asset synchronized (201 Created)');
    }
    
    // Sincronização de Estado (Resolve o bug do Avatar)
    await fetchData();
    handleClosePanel();
    
  } catch (err) {
    productsLogger.error({ err }, 'Sync operation failed');
    console.error('❌ [BipFlow Core]: Sync operation failed.', err);
  } finally {
    isSaving.value = false;
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
  
  isDeletingAction.value = true;
  try {
    await deleteProduct(assetIdToPurge.value);
    console.info(`🗑️ [BipFlow Core]: Asset ${assetIdToPurge.value} purged.`);
    await fetchData(); 
  } catch (err) {
    console.error("❌ [BipFlow Core]: Purge operation failed.", err);
  } finally {
    isDeletingAction.value = false;
    isDeleteModalOpen.value = false;
    assetIdToPurge.value = null;
  }
};

/**
 * ⚡ SYSTEM BOOTSTRAP
 */
onMounted(async () => {
  await Promise.allSettled([
    fetchData(),
    fetchCategories()
  ]);
});
</script>

<template>
  <div class="min-h-screen bg-zinc-950 text-zinc-200 selection:bg-indigo-500/30 font-sans antialiased" data-cy="dashboard-view">
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
      :is-saving="isSaving"
      @close="handleClosePanel" 
      @save="handleSave" 
    />

    <ConfirmModal 
      :show="isDeleteModalOpen"
      title="Confirm Asset Deletion"
      message="This action is irreversible. The asset will be permanently removed from the BipFlow global registry."
      :is-loading="isDeletingAction"
      @close="isDeleteModalOpen = false"
      @confirm="executeDelete"
    />
  </div>
</template>