<script setup lang="ts">
import ProductTable from '@/components/dashboard/product-table/ProductTableRoot.vue';
import SearchAndFilterBar from '@/components/dashboard/product-table/SearchAndFilterBar.vue';
import BulkActionBar from '@/components/dashboard/product-table/ui/BulkActionBar.vue';
import { ExclamationTriangleIcon, PlusIcon } from '@heroicons/vue/24/outline';
import { useCategories } from '@/composables/useCategories';
import { useCurrentStore } from '@/composables/useCurrentStore';
import { useCurrentUser } from '@/composables/useCurrentUser';
import { useProducts } from '@/composables/useProducts';
import type { Product } from '@/schemas/product.schema';

/**
 * Only state that genuinely belongs to the parent view's own orchestration
 * (panel/modal open state, the in-flight flag for its bulk-update call)
 * comes in as props/emits. Everything else below (products, filters,
 * categories, the active store, catalog permission) is read straight from
 * the same singleton composables the parent itself reads from -- there is
 * no need to thread it through props just to hand it back down.
 */
defineProps<{
  isBulkUpdating?: boolean;
}>();

defineEmits<{
  (e: 'open-panel'): void;
  (e: 'edit', product: Product): void;
  (e: 'delete', id: number): void;
  (e: 'bulk-update-category', categoryId: number): void;
}>();

const {
  products,
  loading: isLoading,
  error,
  filters,
  isSearching,
  selectedAssetIds,
  isAllSelected,
  isIndeterminate,
  fetchData,
  updateFilters,
  clearFilters,
  toggleSelection,
  selectAll,
  clearSelection,
} = useProducts();
const { categories } = useCategories();
const { selectedStore: activeStore } = useCurrentStore();
const { canManageCatalog } = useCurrentUser();
</script>

<template>
  <section class="relative isolate space-y-8 overflow-visible" data-cy="product-listing-section">

    <div class="flex flex-col md:flex-row md:items-end justify-between gap-6 border-l-2 border-[#D81B60] pl-6">
      <div>
        <h3 class="text-3xl font-black text-[#05050A] italic uppercase tracking-tighter leading-none">
          Produtos ativos
        </h3>
        <p class="text-[10px] text-bip-muted font-bold uppercase mt-2 tracking-[0.4em]">Controle da vitrine em tempo real</p>
      </div>

      <button
        v-if="canManageCatalog"
        data-cy="btn-add-product"
        @click="$emit('open-panel')"
        class="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#D81B60] px-5 text-sm font-semibold text-white shadow-xl shadow-[#D81B60]/20 transition-all hover:bg-[#D81B60]/90 active:scale-[0.98]"
      >
        <PlusIcon class="h-4 w-4 stroke-2" />
        Novo produto
      </button>
    </div>

    <!-- Search and Filter Bar -->
    <SearchAndFilterBar
      :filters="filters"
      :is-searching="isSearching"
      :categories="categories"
      @updateFilters="(f) => updateFilters(f)"
      @clear-filters="clearFilters"
    />

    <div v-if="isLoading" data-cy="loading-skeleton" class="space-y-4">
      <div v-for="i in 5" :key="i" class="h-24 bg-zinc-100 animate-pulse rounded-2xl border border-[#E5E7EB]"></div>
    </div>

    <div v-else-if="error" data-cy="error-state" class="p-16 bg-[#FCE7F3] border border-[#D81B60]/20 rounded-[3rem] text-center">
      <ExclamationTriangleIcon class="w-12 h-12 text-[#D81B60] mx-auto mb-4 opacity-70" />
      <p class="text-[#7A143D] font-black uppercase text-[11px] tracking-[0.3em] mb-6">{{ error }}</p>
      <button
        data-cy="btn-retry-connection"
        @click="fetchData"
        class="text-[#05050A] font-black text-[10px] border border-[#E5E7EB] px-10 py-3 rounded-full hover:bg-zinc-50 transition-all uppercase tracking-widest"
      >
        Tentar novamente
      </button>
    </div>

    <ProductTable
      v-else
      :products="products"
      :active-store="activeStore"
      :can-manage-catalog="canManageCatalog"
      :selected-asset-ids="selectedAssetIds"
      :is-all-selected="isAllSelected"
      :is-indeterminate="isIndeterminate"
      @delete="(id) => $emit('delete', id)"
      @edit="(product) => $emit('edit', product)"
      @toggle-selection="(productId) => toggleSelection(productId)"
      @select-all="selectAll"
    />
  </section>

  <!-- Bulk Action Bar -->
  <BulkActionBar
    :selected-count="selectedAssetIds?.size || 0"
    :categories="categories || []"
    :is-updating="isBulkUpdating"
    @cancel="clearSelection"
    @confirm-bulk-update="(categoryId) => $emit('bulk-update-category', categoryId)"
  />
</template>
