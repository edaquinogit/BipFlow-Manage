<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useProducts } from '@/composables/useProducts';
import { useCategories } from '@/composables/useCategories';
import { useCurrentStore } from '@/composables/useCurrentStore';
import { useToast } from '@/composables/useToast';
import type { Product } from '@/schemas/product.schema';
import { Logger } from '@/services/logger';
import { sanitizePayloadForDjango as sanitizeDashboardPayload } from './productPayload';

import ProductListing from '@/components/dashboard/product-table/ProductListing.vue';
import ProductForm from '@/components/dashboard/product-form/ProductFormRoot.vue';
import ConfirmModal from '@/components/dashboard/layout/ConfirmModal.vue';

const {
  products,
  selectedAssetIds,
  fetchData,
  createProduct,
  updateProduct,
  deleteProduct,
  clearSelection,
  bulkUpdateCategory,
} = useProducts();

const { categories, fetchCategories } = useCategories();
const { selectedStore } = useCurrentStore();
const { success, error: toastError } = useToast();

const isPanelOpen = ref(false);
const selectedProduct = ref<Product | null>(null);
const isSaving = ref(false);
const isDeleteModalOpen = ref(false);
const assetIdToPurge = ref<number | null>(null);
const isDeletingAction = ref(false);
const isBulkUpdating = ref(false);

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

const handleOpenNewPanel = (): void => {
  selectedProduct.value = null;
  isPanelOpen.value = true;
};

const handleEditRequest = (product: Product): void => {
  selectedProduct.value = { ...product };
  isPanelOpen.value = true;
};

const handleClosePanel = (): void => {
  isPanelOpen.value = false;
  selectedProduct.value = null;
};

const handleSave = async (payload: Partial<Product>): Promise<void> => {
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

    await fetchData();
    handleClosePanel();
  } catch {
    toastError('Nao foi possivel salvar o produto. Tente novamente.');
  } finally {
    isSaving.value = false;
  }
};

const openDeleteConfirm = (id: number): void => {
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

const refreshProducts = (): void => {
  clearSelection();
  isPanelOpen.value = false;
  selectedProduct.value = null;
  isDeleteModalOpen.value = false;
  void fetchData();
  void fetchCategories(true);
};

onMounted(refreshProducts);
watch(selectedStore, refreshProducts);
</script>

<template>
  <div class="space-y-10">
    <section v-if="outOfStockProducts.length > 0 || lowStockProducts.length > 0" class="space-y-3">
      <div class="flex items-center justify-between gap-4">
        <div>
          <p class="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">Inventario</p>
          <h2 class="mt-1 text-sm font-black uppercase tracking-widest text-white">Produtos em atencao</h2>
        </div>
        <span class="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-200">
          {{ outOfStockProducts.length + lowStockProducts.length }}
        </span>
      </div>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <article
          v-for="product in outOfStockProducts"
          :key="`out-${product.id ?? product.name}`"
          class="rounded-lg border border-rose-500/20 bg-rose-500/10 p-4"
        >
          <div class="flex items-center justify-between gap-4">
            <p class="min-w-0 truncate text-sm font-bold text-white">{{ product.name }}</p>
            <span class="shrink-0 text-xs font-black uppercase tracking-widest text-rose-200">zerado</span>
          </div>
        </article>

        <article
          v-for="product in lowStockProducts"
          :key="`low-${product.id ?? product.name}`"
          class="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4"
        >
          <div class="flex items-center justify-between gap-4">
            <p class="min-w-0 truncate text-sm font-bold text-white">{{ product.name }}</p>
            <span class="shrink-0 text-xs font-black uppercase tracking-widest text-amber-200">
              {{ getProductStockValue(product) }} un.
            </span>
          </div>
        </article>
      </div>
    </section>

    <section id="dashboard-products">
      <ProductListing
        :is-bulk-updating="isBulkUpdating"
        @open-panel="handleOpenNewPanel"
        @edit="handleEditRequest"
        @delete="openDeleteConfirm"
        @bulk-update-category="handleBulkUpdateCategory"
      />
    </section>

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
