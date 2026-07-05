<script setup lang="ts">
import { onMounted, ref } from 'vue';
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
import ProductLabelModal from '@/components/dashboard/product-table/ProductLabelModal.vue';

const {
  selectedAssetIds,
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
const isLabelModalOpen = ref(false);
const productToLabel = ref<Product | null>(null);

const buildStockAdjustmentPayload = (
  originalProduct: Product,
  nextStockQuantity: number
): StockMovementInput | null => {
  const currentStockQuantity = Number(originalProduct.stock_quantity ?? 0);
  const stockDifference = nextStockQuantity - currentStockQuantity;

  if (stockDifference === 0) {
    return null;
  }

  return {
    movement_type: stockDifference > 0 ? 'entrada' : 'saida',
    quantity: Math.abs(stockDifference),
    reason: 'ajuste_inventario',
    notes: 'Ajuste realizado ao salvar a edicao do produto.',
  };
};

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
      const stockAdjustmentPayload = buildStockAdjustmentPayload(
        selectedProduct.value,
        Number(dataToSync.stock_quantity ?? 0)
      );
      const { stock_quantity: _stock_quantity, ...updatePayload } = dataToSync as Partial<Product> &
        Record<string, unknown>;

      await updateProduct(selectedProduct.value.id, updatePayload);

      if (stockAdjustmentPayload) {
        await adjustStock(selectedProduct.value.id, stockAdjustmentPayload);
      }
    } else {
      await createProduct(dataToSync);
    }

    // createProduct/updateProduct already splice the server's response into
    // `products.value` (and already show their own success toast) -- a full
    // refetch here was a second, redundant round-trip on every single save,
    // doubling exposure to a slow/cold backend for no benefit.
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

const openLabelModal = (product: Product): void => {
  productToLabel.value = product;
  isLabelModalOpen.value = true;
};

const closeLabelModal = (): void => {
  isLabelModalOpen.value = false;
  productToLabel.value = null;
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
  closeLabelModal();
  void fetchData();
  void fetchCategories(true);
};

onMounted(refreshProducts);
useStoreSwitchEffect(refreshProducts);
</script>

<template>
  <div class="space-y-10">
    <section id="dashboard-products">
      <ProductListing
        :is-bulk-updating="isBulkUpdating"
        @open-panel="handleOpenNewPanel"
        @edit="handleEditRequest"
        @delete="openDeleteConfirm"
        @bulk-update-category="handleBulkUpdateCategory"
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

    <ProductLabelModal
      :show="isLabelModalOpen"
      :product="productToLabel"
      @close="closeLabelModal"
    />
  </div>
</template>
