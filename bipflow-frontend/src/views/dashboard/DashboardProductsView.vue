<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useProducts } from '@/composables/useProducts';
import { useCategories } from '@/composables/useCategories';
import { useStoreSwitchEffect } from '@/composables/useStoreSwitchEffect';
import { useToast } from '@/composables/useToast';
import type { Product } from '@/schemas/product.schema';
import type { StockMovementInput } from '@/types/stockMovement';
import { Logger } from '@/services/logger';
import { sanitizePayloadForDjango as sanitizeDashboardPayload } from './productPayload';

import ProductListing from '@/components/dashboard/product-table/ProductListing.vue';
import ProductForm from '@/components/dashboard/product-form/ProductFormRoot.vue';
import ConfirmModal from '@/components/dashboard/layout/ConfirmModal.vue';
import StockMovementModal from '@/components/dashboard/product-table/StockMovementModal.vue';
import ProductLabelModal from '@/components/dashboard/product-table/ProductLabelModal.vue';

const {
  selectedAssetIds,
  outOfStockProducts,
  lowStockProducts,
  fetchData,
  createProduct,
  updateProduct,
  deleteProduct,
  clearSelection,
  bulkUpdateCategory,
  adjustStock,
} = useProducts();

const { categories, fetchCategories } = useCategories();
const { success, error: toastError } = useToast();

const isPanelOpen = ref(false);
const selectedProduct = ref<Product | null>(null);
const isSaving = ref(false);
const isDeleteModalOpen = ref(false);
const assetIdToPurge = ref<number | null>(null);
const isDeletingAction = ref(false);
const isBulkUpdating = ref(false);
const isStockModalOpen = ref(false);
const productToAdjust = ref<Product | null>(null);
const isAdjustingStock = ref(false);
const isLabelModalOpen = ref(false);
const productToLabel = ref<Product | null>(null);

const getProductStockValue = (product: Product): number => Number(product.stock_quantity ?? 0);

// A secao "Produtos em atencao" e um resumo compacto; o limite de 5 e
// apenas uma escolha de apresentacao desta view (a lista completa fica
// disponivel via useProducts() para quem precisar dela, ex: StockAlertDrawer).
const outOfStockPreview = computed(() => outOfStockProducts.value.slice(0, 5));
const lowStockPreview = computed(() => lowStockProducts.value.slice(0, 5));

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
      // stock_quantity is read-only in the edit form (see ValuationSection's
      // isExistingProduct) but still lives in `form.value`/`payload` -- drop
      // it here so a resubmit never trips the backend's "use a stock
      // movement instead" rejection on a field the UI never let them touch.
      const { stock_quantity: _stock_quantity, ...updatePayload } = dataToSync as Partial<Product> &
        Record<string, unknown>;
      await updateProduct(selectedProduct.value.id, updatePayload);
      success('Produto atualizado com sucesso.');
    } else {
      await createProduct(dataToSync);
      success('Produto criado com sucesso.');
    }

    await fetchData();
    handleClosePanel();
  } catch {
    toastError('Não foi possível salvar o produto. Tente novamente.');
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
    toastError('Não foi possível remover o produto. Tente novamente.');
  } finally {
    isDeletingAction.value = false;
    isDeleteModalOpen.value = false;
    assetIdToPurge.value = null;
  }
};

const openStockModal = (product: Product): void => {
  productToAdjust.value = product;
  isStockModalOpen.value = true;
};

const closeStockModal = (): void => {
  isStockModalOpen.value = false;
  productToAdjust.value = null;
};

const openLabelModal = (product: Product): void => {
  productToLabel.value = product;
  isLabelModalOpen.value = true;
};

const closeLabelModal = (): void => {
  isLabelModalOpen.value = false;
  productToLabel.value = null;
};

const handleStockMovementSubmit = async (payload: StockMovementInput): Promise<void> => {
  if (!productToAdjust.value?.id) return;

  isAdjustingStock.value = true;
  try {
    await adjustStock(productToAdjust.value.id, payload);
    closeStockModal();
  } catch (error: unknown) {
    Logger.error('Stock adjustment failed', { error, productId: productToAdjust.value.id, payload });
    toastError('Não foi possível registrar a movimentação de estoque.');
  } finally {
    isAdjustingStock.value = false;
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
    toastError('Não foi possível atualizar os produtos selecionados.');
  } finally {
    isBulkUpdating.value = false;
  }
};

const refreshProducts = (): void => {
  clearSelection();
  isPanelOpen.value = false;
  selectedProduct.value = null;
  isDeleteModalOpen.value = false;
  closeStockModal();
  closeLabelModal();
  void fetchData();
  void fetchCategories(true);
};

onMounted(refreshProducts);
useStoreSwitchEffect(refreshProducts);
</script>

<template>
  <div class="space-y-10">
    <section v-if="outOfStockProducts.length > 0 || lowStockProducts.length > 0" class="space-y-3">
      <div class="flex items-center justify-between gap-4">
        <div>
          <p class="text-[10px] font-black uppercase tracking-[0.4em] text-bip-muted">Inventário</p>
          <h2 class="mt-1 text-sm font-black uppercase tracking-widest text-[#05050A]">Produtos em atenção</h2>
        </div>
        <span class="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-700">
          {{ outOfStockProducts.length + lowStockProducts.length }}
        </span>
      </div>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <article
          v-for="product in outOfStockPreview"
          :key="`out-${product.id ?? product.name}`"
          class="rounded-lg border border-[#D81B60]/20 bg-[#FCE7F3] p-4"
        >
          <div class="flex items-center justify-between gap-4">
            <p class="min-w-0 truncate text-sm font-bold text-[#05050A]">{{ product.name }}</p>
            <span class="shrink-0 text-xs font-black uppercase tracking-widest text-[#D81B60]">zerado</span>
          </div>
        </article>

        <article
          v-for="product in lowStockPreview"
          :key="`low-${product.id ?? product.name}`"
          class="rounded-lg border border-amber-200 bg-amber-50 p-4"
        >
          <div class="flex items-center justify-between gap-4">
            <p class="min-w-0 truncate text-sm font-bold text-[#05050A]">{{ product.name }}</p>
            <span class="shrink-0 text-xs font-black uppercase tracking-widest text-amber-700">
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
        @adjust-stock="openStockModal"
        @print-label="openLabelModal"
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
      title="Excluir produto?"
      message="Essa ação não pode ser desfeita. O produto será removido definitivamente do catálogo."
      :is-loading="isDeletingAction"
      @close="isDeleteModalOpen = false"
      @confirm="executeDelete"
    />

    <StockMovementModal
      :show="isStockModalOpen"
      :product="productToAdjust"
      :is-submitting="isAdjustingStock"
      @close="closeStockModal"
      @submit="handleStockMovementSubmit"
    />

    <ProductLabelModal
      :show="isLabelModalOpen"
      :product="productToLabel"
      @close="closeLabelModal"
    />
  </div>
</template>
