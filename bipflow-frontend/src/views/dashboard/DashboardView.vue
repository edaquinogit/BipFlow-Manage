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
import type { StoreSettings, StoreSettingsPayload } from '@/types/store-settings';
import { authService } from '@/services/auth.service';
import { deliveryRegionService } from '@/services/delivery-region.service';
import { Logger } from '@/services/logger';
import { salesService } from '@/services/sales.service';
import { storeSettingsService } from '@/services/store-settings.service';

// Layout & UI Components
import DashboardHeader from '@/components/dashboard/layout/DashboardHeader.vue';
import DashboardMenuDrawer from '@/components/dashboard/layout/DashboardMenuDrawer.vue';
import BotConversationPanel from '@/components/dashboard/bot/BotConversationPanel.vue';
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
const botPanelRef = ref<InstanceType<typeof BotConversationPanel> | null>(null);

/**
 * 💾 DATA CONTEXT
 * Current operational data context.
 */
const assetIdToPurge = ref<number | null>(null);
const selectedProduct = ref<Product | null>(null);
const currentUserName = ref<string | null>(null);
const recentSales = ref<SaleOrder[]>([]);
const deliveryRegions = ref<DeliveryRegion[]>([]);
const storeSettings = ref<StoreSettings | null>(null);

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
const isStoreSettingsLoading = ref(false);
const storeSettingsError = ref<string | null>(null);
const isSavingStoreSettings = ref(false);

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

const fetchCurrentUser = async (): Promise<boolean> => {
  try {
    const currentUser = await authService.getCurrentUser();

    if (!currentUser.can_access_dashboard) {
      await router.replace('/403');
      return false;
    }

    currentUserName.value = currentUser.display_name || currentUser.email || currentUser.username;
    return true;
  } catch (error: unknown) {
    Logger.warn('Failed to fetch dashboard user profile', { error });
    currentUserName.value = null;
    return false;
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

const fetchStoreSettings = async (): Promise<void> => {
  isStoreSettingsLoading.value = true;
  storeSettingsError.value = null;

  try {
    storeSettings.value = await storeSettingsService.get();
  } catch (error: unknown) {
    Logger.warn('Failed to fetch store settings', { error });
    storeSettingsError.value = 'Nao foi possivel carregar o WhatsApp da loja agora.';
  } finally {
    isStoreSettingsLoading.value = false;
  }
};

const handleOpenDashboardMenu = (): void => {
  isDashboardMenuOpen.value = true;
  void fetchSalesHistory();
  void fetchDeliveryRegions();
  void fetchStoreSettings();
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

const handleFocusBot = (): void => {
  isDashboardMenuOpen.value = false;
  botPanelRef.value?.openPanel();

  requestAnimationFrame(() => {
    document.getElementById('dashboard-bot')?.scrollIntoView({
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

const handleSaveStoreSettings = async (payload: StoreSettingsPayload): Promise<void> => {
  isSavingStoreSettings.value = true;

  try {
    storeSettings.value = await storeSettingsService.update(payload);
    success('WhatsApp da loja atualizado.');
  } catch (error: unknown) {
    Logger.error('Store settings save failed', { error });
    toastError('Nao foi possivel salvar o WhatsApp da loja.');
  } finally {
    isSavingStoreSettings.value = false;
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
      success('Produto atualizado com sucesso.');
    } else {
      await createProduct(dataToSync);
      success('Produto criado com sucesso.');
    }

    // Sincronização de Estado (Resolve o bug do Avatar)
    await fetchData();
    handleClosePanel();

  } catch (err) {
    toastError('Nao foi possivel salvar o produto. Tente novamente.');
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
    success('Produto removido com sucesso.');
    await fetchData();
  } catch (error: unknown) {
    Logger.error('Product deletion failed', { error });
    toastError('Nao foi possivel remover o produto. Tente novamente.');
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
    toastError('Selecione pelo menos um produto antes de alterar a categoria.');
    return;
  }

  isBulkUpdating.value = true;
  try {
    await bulkUpdateCategory(Array.from(selectedAssetIds.value), categoryId);
  } catch (error: unknown) {
    Logger.error('Bulk category update failed', { error, categoryId });
    toastError('Nao foi possivel atualizar os produtos selecionados.');
  } finally {
    isBulkUpdating.value = false;
  }
};

/**
 * ⚡ SYSTEM BOOTSTRAP
 */
onMounted(async () => {
  const canAccessDashboard = await fetchCurrentUser();

  if (!canAccessDashboard) {
    return;
  }

  await Promise.allSettled([
    fetchData(),
    fetchCategories(),
    fetchSalesHistory(),
    fetchDeliveryRegions(),
    fetchStoreSettings()
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

      <BotConversationPanel ref="botPanelRef" />

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
      :store-settings="storeSettings"
      :is-store-settings-loading="isStoreSettingsLoading"
      :store-settings-error="storeSettingsError"
      :is-saving-store-settings="isSavingStoreSettings"
      :out-of-stock-products="outOfStockProducts"
      :low-stock-products="lowStockProducts"
      @close="isDashboardMenuOpen = false"
      @logout="handleLogout"
      @create-product="handleCreateProductFromMenu"
      @focus-products="handleFocusProducts"
      @focus-bot="handleFocusBot"
      @open-store="handleOpenStore"
      @save-delivery-region="handleSaveDeliveryRegion"
      @delete-delivery-region="handleDeleteDeliveryRegion"
      @save-store-settings="handleSaveStoreSettings"
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
