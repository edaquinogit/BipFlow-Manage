<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useProducts } from '@/composables/useProducts';
import { useCategories } from '@/composables/useCategories';
import { useToast } from '@/composables/useToast';
import type { Product } from '@/schemas/product.schema';
import type { FilterState } from '@/types/filters';
import { Logger } from '@/services/logger';

// Layout & UI Components
import DashboardHeader from '@/components/dashboard/layout/DashboardHeader.vue';
import StatsGrid from '@/components/dashboard/stats/StatsGrid.vue';
import ProductListing from '@/components/dashboard/product-table/ProductListing.vue';
import ProductForm from '@/components/dashboard/product-form/ProductFormRoot.vue';
import ConfirmModal from '@/components/dashboard/layout/ConfirmModal.vue';

/**
 * 🛰️ UI STATE MACHINE
 * Visual states and modal controls.
 */
const isPanelOpen = ref(false);
const isDeleteModalOpen = ref(false);

/**
 * 💾 DATA CONTEXT
 * Current operational data context.
 */
const assetIdToPurge = ref<number | null>(null);
const selectedProduct = ref<Product | null>(null);

/**
 * ⚙️ ASYNC ACTION STATES
 * Loading granularity to prevent blocking the entire UI during requests.
 */
const isSaving = ref(false);
const isDeletingAction = ref(false);

// Composables (Data Layer)
const {
  loading: productsLoading,
  error,
  products,
  filters,
  isSearching,
  fetchData,
  createProduct,
  updateProduct,
  deleteProduct,
  totalRevenue,
  inventoryStats,
  updateFilters,
  clearFilters,
  setupFilterWatchers,
} = useProducts();

const { categories, fetchCategories } = useCategories();
const { success, error: toastError } = useToast();

/**
 * 🧠 EVENT HANDLERS (View Controllers)
 */
const handleOpenNewPanel = () => {
  selectedProduct.value = null;
  isPanelOpen.value = true;
};

const handleEditRequest = (product: Product) => {
  // Deep clone to prevent memory reference issues
  selectedProduct.value = { ...product };
  isPanelOpen.value = true;
};

const handleClosePanel = () => {
  isPanelOpen.value = false;
  selectedProduct.value = null;
};

/**
 * 🧹 DATA SANITIZER (Pure Logic)
 * Prepares the payload for Django, removing computed fields and protecting media.
 * @param rawPayload - The object from form or Vue state
 * @returns A clean object ready for the backend
 */
const sanitizePayloadForDjango = (
  rawPayload: Partial<Product>
): Partial<Product> => {
  const {
    id: _id,
    created_at: _created_at,
    updated_at: _updated_at,
    category_name: _category_name,
    is_available: _is_available,
    ...cleanData
  } = rawPayload as Record<string, unknown>;

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
      success('Product updated successfully');
    } else {
      await createProduct(dataToSync);
      success('Product created successfully');
    }

    // Sincronização de Estado (Resolve o bug do Avatar)
    await fetchData();
    handleClosePanel();

  } catch (err) {
    toastError('Failed to save product. Please try again.');
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

const executeDelete = async (): Promise<void> => {
  if (!assetIdToPurge.value) return;

  isDeletingAction.value = true;
  try {
    await deleteProduct(assetIdToPurge.value);
    success('Product deleted successfully.');
    await fetchData();
  } catch (error: unknown) {
    Logger.error('Product deletion failed', { error });
    toastError('Failed to delete product. Please try again.');
  } finally {
    isDeletingAction.value = false;
    isDeleteModalOpen.value = false;
    assetIdToPurge.value = null;
  }
};

/**
 * 🔍 FILTER EVENT HANDLERS
 */
const handleFiltersUpdate = (newFilters: FilterState): void => {
  updateFilters(newFilters);
};

const handleClearFilters = async (): Promise<void> => {
  await clearFilters();
};

/**
 * ⚡ SYSTEM BOOTSTRAP
 */
onMounted(async () => {
  await Promise.allSettled([
    fetchData(),
    fetchCategories()
  ]);

  // Initialize filter watchers
  setupFilterWatchers();
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
        :filters="filters"
        :is-searching="isSearching"
        :categories="categories"
        @open-panel="handleOpenNewPanel"
        @edit="handleEditRequest"
        @delete="openDeleteConfirm"
        @retry="fetchData"
        @updateFilters="handleFiltersUpdate"
        @clear-filters="handleClearFilters"
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
