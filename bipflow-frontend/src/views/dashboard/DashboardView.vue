<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useProducts } from '@/composables/useProducts';
import { useCategories } from '@/composables/useCategories';
import { useToast } from '@/composables/useToast';
import type { Product } from '@/schemas/product.schema';
import type { DeliveryRegion, DeliveryRegionPayload } from '@/types/delivery';
import type { FilterState } from '@/types/filters';
import type { SaleOrder } from '@/types/sales';
import { authService } from '@/services/auth.service';
import { deliveryRegionService } from '@/services/delivery-region.service';
import { Logger } from '@/services/logger';
import { salesService } from '@/services/sales.service';

// Layout & UI Components
import DashboardHeader from '@/components/dashboard/layout/DashboardHeader.vue';
import DashboardMenuDrawer from '@/components/dashboard/layout/DashboardMenuDrawer.vue';
import StatsGrid from '@/components/dashboard/stats/StatsGrid.vue';
import ProductListing from '@/components/dashboard/product-table/ProductListing.vue';
import ProductForm from '@/components/dashboard/product-form/ProductFormRoot.vue';
import ConfirmModal from '@/components/dashboard/layout/ConfirmModal.vue';
import { sanitizePayloadForDjango as sanitizeDashboardPayload } from './productPayload';

/**
 * 🛰️ UI STATE MACHINE
 * Visual states and modal controls.
 */
const isPanelOpen = ref(false);
const isDeleteModalOpen = ref(false);
const isDashboardMenuOpen = ref(false);

/**
 * 💾 DATA CONTEXT
 * Current operational data context.
 */
const assetIdToPurge = ref<number | null>(null);
const selectedProduct = ref<Product | null>(null);
const currentUserName = ref<string | null>(null);
const recentSales = ref<SaleOrder[]>([]);
const deliveryRegions = ref<DeliveryRegion[]>([]);

/**
 * ⚙️ ASYNC ACTION STATES
 * Loading granularity to prevent blocking the entire UI during requests.
 */
const isSaving = ref(false);
const isDeletingAction = ref(false);
const isBulkUpdating = ref(false);
const isSalesLoading = ref(false);
const salesError = ref<string | null>(null);
const isDeliveryRegionsLoading = ref(false);
const deliveryRegionsError = ref<string | null>(null);
const isSavingDeliveryRegion = ref(false);
const deletingDeliveryRegionId = ref<number | null>(null);

// Composables (Data Layer)
const {
  loading: productsLoading,
  error,
  products,
  filters,
  isSearching,
  selectedAssetIds,
  isAllSelected,
  isIndeterminate,
  fetchData,
  createProduct,
  updateProduct,
  deleteProduct,
  totalRevenue,
  inventoryStats,
  updateFilters,
  clearFilters,
  toggleSelection,
  selectAll,
  clearSelection,
  bulkUpdateCategory,
} = useProducts();

const { categories, fetchCategories } = useCategories();
const { success, error: toastError } = useToast();
const router = useRouter();

const getProductStockValue = (product: Product): number => Number(product.stock_quantity ?? 0);

const outOfStockProducts = computed(() => (
  products.value
    .filter((product) => getProductStockValue(product) <= 0 || !product.is_available)
    .slice(0, 5)
));

const lowStockProducts = computed(() => (
  products.value
    .filter((product) => {
      const stockValue = getProductStockValue(product);
      return stockValue > 0 && stockValue <= 5 && product.is_available;
    })
    .sort((left, right) => getProductStockValue(left) - getProductStockValue(right))
    .slice(0, 5)
));

/**
 * 🧠 EVENT HANDLERS (View Controllers)
 */
const handleOpenNewPanel = () => {
  selectedProduct.value = null;
  isPanelOpen.value = true;
};

const fetchCurrentUser = async (): Promise<void> => {
  try {
    const currentUser = await authService.getCurrentUser();
    currentUserName.value = currentUser.display_name || currentUser.email || currentUser.username;
  } catch (error: unknown) {
    Logger.warn('Failed to fetch dashboard user profile', { error });
    currentUserName.value = null;
  }
};

const fetchSalesHistory = async (): Promise<void> => {
  isSalesLoading.value = true;
  salesError.value = null;

  try {
    recentSales.value = await salesService.getRecent(5);
  } catch (error: unknown) {
    Logger.warn('Failed to fetch dashboard sales history', { error });
    salesError.value = 'Nao foi possivel carregar o historico agora.';
  } finally {
    isSalesLoading.value = false;
  }
};

const fetchDeliveryRegions = async (): Promise<void> => {
  isDeliveryRegionsLoading.value = true;
  deliveryRegionsError.value = null;

  try {
    deliveryRegions.value = await deliveryRegionService.getAll();
  } catch (error: unknown) {
    Logger.warn('Failed to fetch delivery regions', { error });
    deliveryRegionsError.value = 'Nao foi possivel carregar as regioes de frete agora.';
  } finally {
    isDeliveryRegionsLoading.value = false;
  }
};

const handleOpenDashboardMenu = (): void => {
  isDashboardMenuOpen.value = true;
  void fetchSalesHistory();
  void fetchDeliveryRegions();
};

const handleCreateProductFromMenu = (): void => {
  isDashboardMenuOpen.value = false;
  handleOpenNewPanel();
};

const handleFocusProducts = (): void => {
  isDashboardMenuOpen.value = false;

  requestAnimationFrame(() => {
    document.getElementById('dashboard-products')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  });
};

const handleOpenStore = (): void => {
  isDashboardMenuOpen.value = false;
  window.open('/produtos', '_blank', 'noopener,noreferrer');
};

const handleLogout = async (): Promise<void> => {
  isDashboardMenuOpen.value = false;
  authService.logout();
  await router.push('/login');
};

const handleSaveDeliveryRegion = async (
  payload: DeliveryRegionPayload,
  regionId?: number
): Promise<void> => {
  isSavingDeliveryRegion.value = true;

  try {
    if (regionId) {
      await deliveryRegionService.update(regionId, payload);
      success('Frete da regiao atualizado.');
    } else {
      await deliveryRegionService.create(payload);
      success('Regiao de frete adicionada.');
    }

    await fetchDeliveryRegions();
  } catch (error: unknown) {
    Logger.error('Delivery region save failed', { error, regionId });
    toastError('Nao foi possivel salvar a regiao de frete.');
  } finally {
    isSavingDeliveryRegion.value = false;
  }
};

const handleDeleteDeliveryRegion = async (regionId: number): Promise<void> => {
  deletingDeliveryRegionId.value = regionId;

  try {
    await deliveryRegionService.delete(regionId);
    success('Regiao de frete removida.');
    await fetchDeliveryRegions();
  } catch (error: unknown) {
    Logger.error('Delivery region deletion failed', { error, regionId });
    toastError('Nao foi possivel remover a regiao de frete.');
  } finally {
    deletingDeliveryRegionId.value = null;
  }
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
 * 🚀 PERSISTENCE ORCHESTRATOR
 */
const handleSave = async (payload: Partial<Product>) => {
  isSaving.value = true;

  try {
    const dataToSync = sanitizeDashboardPayload(payload);

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
const handleFiltersUpdate = (newFilters: Partial<FilterState>): void => {
  updateFilters(newFilters);
};

const handleClearFilters = async (): Promise<void> => {
  await clearFilters();
};

const handleToggleSelection = (productId: number): void => {
  toggleSelection(productId);
};

const handleSelectAll = (): void => {
  selectAll();
};

const handleClearSelection = (): void => {
  clearSelection();
};

const handleBulkUpdateCategory = async (categoryId: number): Promise<void> => {
  if (selectedAssetIds.value.size === 0) {
    toastError('Select at least one asset before changing category.');
    return;
  }

  isBulkUpdating.value = true;
  try {
    await bulkUpdateCategory(Array.from(selectedAssetIds.value), categoryId);
  } catch (error: unknown) {
    Logger.error('Bulk category update failed', { error, categoryId });
    toastError('Failed to update selected assets.');
  } finally {
    isBulkUpdating.value = false;
  }
};

/**
 * ⚡ SYSTEM BOOTSTRAP
 */
onMounted(async () => {
  await Promise.allSettled([
    fetchCurrentUser(),
    fetchData(),
    fetchCategories(),
    fetchSalesHistory(),
    fetchDeliveryRegions()
  ]);
});
</script>

<template>
  <div class="min-h-screen bg-zinc-950 text-zinc-200 selection:bg-indigo-500/30 font-sans antialiased" data-cy="dashboard-view">
    <DashboardHeader
      :user-name="currentUserName"
      @open-menu="handleOpenDashboardMenu"
    />

    <main class="max-w-7xl mx-auto px-6 py-12 space-y-16">
      <StatsGrid
        :stats="inventoryStats"
        :revenue="totalRevenue"
        :is-loading="productsLoading"
      />

      <section id="dashboard-products">
        <ProductListing
          :products="products"
          :is-loading="productsLoading"
          :error="error"
          :filters="filters"
          :is-searching="isSearching"
          :categories="categories"
          :selected-asset-ids="selectedAssetIds"
          :is-all-selected="isAllSelected"
          :is-indeterminate="isIndeterminate"
          :is-bulk-updating="isBulkUpdating"
          @open-panel="handleOpenNewPanel"
          @edit="handleEditRequest"
          @delete="openDeleteConfirm"
          @retry="fetchData"
          @updateFilters="handleFiltersUpdate"
          @clear-filters="handleClearFilters"
          @toggle-selection="handleToggleSelection"
          @select-all="handleSelectAll"
          @clear-selection="handleClearSelection"
          @bulk-update-category="handleBulkUpdateCategory"
        />
      </section>
    </main>

    <DashboardMenuDrawer
      :is-open="isDashboardMenuOpen"
      :recent-sales="recentSales"
      :is-sales-loading="isSalesLoading"
      :sales-error="salesError"
      :delivery-regions="deliveryRegions"
      :is-delivery-regions-loading="isDeliveryRegionsLoading"
      :delivery-regions-error="deliveryRegionsError"
      :is-saving-delivery-region="isSavingDeliveryRegion"
      :deleting-delivery-region-id="deletingDeliveryRegionId"
      :out-of-stock-products="outOfStockProducts"
      :low-stock-products="lowStockProducts"
      @close="isDashboardMenuOpen = false"
      @logout="handleLogout"
      @create-product="handleCreateProductFromMenu"
      @focus-products="handleFocusProducts"
      @open-store="handleOpenStore"
      @save-delivery-region="handleSaveDeliveryRegion"
      @delete-delivery-region="handleDeleteDeliveryRegion"
    />

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
