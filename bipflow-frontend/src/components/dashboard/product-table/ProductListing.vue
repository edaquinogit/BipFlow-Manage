<script setup lang="ts">
import ProductTable from '@/components/dashboard/product-table/ProductTableRoot.vue';
import SearchAndFilterBar from '@/components/dashboard/product-table/SearchAndFilterBar.vue';
import { ExclamationTriangleIcon } from '@heroicons/vue/24/outline';
import type { Product } from '@/schemas/product.schema';
import type { FilterState } from '@/types/filters';

/**
 * 🏷️ PROPS BOUNDARY (Strict Typing)
 * Define o contrato de dados que este componente exige do DashboardView.
 */
defineProps<{
  products: Product[];
  isLoading: boolean;
  error: string | null;
  filters: FilterState;
  isSearching?: boolean;
  categories?: Array<{ id: number | string; name: string }>;
}>();

/**
 * 📡 EVENT DISPATCHER (Type-Safe Emits)
 * Abandonamos o array simples ['edit', 'delete'] e usamos a tipagem baseada em interface.
 * Isso garante que o VS Code grite se você tentar emitir um 'delete' sem passar um 'id' numérico.
 */
defineEmits<{
  (e: 'open-panel'): void;
  (e: 'edit', product: Product): void;
  (e: 'delete', id: number): void;
  (e: 'retry'): void;
  (e: 'updateFilters', filters: FilterState): void;
  (e: 'clear-filters'): void;
}>();
</script>

<template>
  <section class="space-y-8" data-cy="product-listing-section">

    <div class="flex flex-col md:flex-row md:items-end justify-between gap-6 border-l-2 border-indigo-500 pl-6">
      <div>
        <h3 class="text-3xl font-black text-white italic uppercase tracking-tighter leading-none">
          Active Assets
        </h3>
        <p class="text-[10px] text-zinc-500 font-bold uppercase mt-2 tracking-[0.2em]">Real-time Registry Control</p>
      </div>

      <button
        data-cy="btn-add-product"
        @click="$emit('open-panel')"
        class="bg-white text-black px-10 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-zinc-200 transition-all active:scale-95 shadow-xl shadow-white/5"
      >
        + Provision New Asset
      </button>
    </div>

    <!-- Search and Filter Bar -->
    <SearchAndFilterBar
      :filters="filters"
      :is-searching="isSearching"
      :categories="categories"
      @updateFilters="(f) => $emit('updateFilters', f)"
      @clear-filters="$emit('clear-filters')"
    />

    <div v-if="isLoading" data-cy="loading-skeleton" class="space-y-4">
      <div v-for="i in 5" :key="i" class="h-24 bg-zinc-900/30 animate-pulse rounded-2xl border border-white/5"></div>
    </div>

    <div v-else-if="error" data-cy="error-state" class="p-16 bg-red-950/10 border border-red-500/20 rounded-[3rem] text-center backdrop-blur-sm">
      <ExclamationTriangleIcon class="w-12 h-12 text-red-500 mx-auto mb-4 opacity-50" />
      <p class="text-red-400 font-black uppercase text-[11px] tracking-[0.3em] mb-6">{{ error }}</p>
      <button
        data-cy="btn-retry-connection"
        @click="$emit('retry')"
        class="text-white font-black text-[10px] border border-white/10 px-10 py-3 rounded-full hover:bg-white/5 transition-all uppercase tracking-widest"
      >
        Re-establish Connection
      </button>
    </div>

    <ProductTable
      v-else
      :products="products"
      @delete="(id) => $emit('delete', id)"
      @edit="(product) => $emit('edit', product)"
    />
  </section>
</template>
