<script setup lang="ts">
import { computed } from 'vue';
import type { Product } from '@/schemas/product.schema';
import type { Store } from '@/types/store';
import TableEmptyState from './ui/TableEmptyState.vue';
import TableRow from '@/components/dashboard/product-table/TableRow.vue';

/**
 * 🛰️ REGISTRY PROPS
 * Interface blindada para recebimento de dados do Dashboard.
 */
const props = withDefaults(defineProps<{
  products: Product[];
  isLoading?: boolean;
  activeStore?: Store | null;
  canManageCatalog?: boolean;
  selectedAssetIds?: Set<number>;
  isAllSelected?: boolean;
  isIndeterminate?: boolean;
}>(), {
  products: () => [],
  isLoading: false,
  activeStore: null,
  canManageCatalog: false,
  selectedAssetIds: () => new Set(),
  isAllSelected: false,
  isIndeterminate: false
});

const emit = defineEmits<{
  (e: 'delete', id: number): void;
  (e: 'edit', product: Product): void;
  (e: 'toggle-selection', productId: number): void;
  (e: 'select-all'): void;
  (e: 'adjust-stock', product: Product): void;
}>();

/**
 * 🛡️ INTEGRITY GUARD
 * Verifica se a lista de produtos é válida para exibição.
 */
const hasProducts = computed(() => props.products && props.products.length > 0);
const activeStoreName = computed(() => props.activeStore?.name || 'BipFlow');

// Proxy de eventos para manter o Root limpo
const onEdit = (product: Product) => emit('edit', product);
const onDelete = (id: number) => {
  if (id) emit('delete', id);
};
const onAdjustStock = (product: Product) => emit('adjust-stock', product);
</script>

<template>
  <div class="relative z-0 w-full min-h-96 overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-2xl shadow-black/5">

    <Transition name="fade">
      <div
  v-if="props.isLoading && hasProducts"
  class="absolute inset-0 z-30 flex flex-col items-center justify-center bg-white/70 backdrop-blur-sm transition-all"
>
        <div class="flex flex-col items-center gap-4">
          <div class="h-10 w-10 animate-spin rounded-full border-[3px] border-[#D81B60] border-t-transparent"></div>
          <span class="text-[10px] font-black uppercase tracking-[0.3em] text-[#05050A] italic">Atualizando vitrine...</span>
        </div>
      </div>
    </Transition>

    <div class="overflow-x-auto">
      <table class="w-full text-left border-collapse table-auto" data-cy="product-table">
        <thead>
          <tr class="bg-zinc-50 text-[10px] uppercase tracking-[0.2em] text-bip-muted font-black border-b border-[#E5E7EB]">
            <th class="px-6 py-5">
              <button
                v-if="props.canManageCatalog"
                @click="emit('select-all')"
                class="w-5 h-5 rounded border-2 transition-all duration-200 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#FCE7F3] hover:border-[#D81B60]/50"
                :class="[
                  props.isAllSelected || props.isIndeterminate
                    ? 'bg-[#D81B60] border-[#D81B60]'
                    : 'border-[#D1D5DB] bg-white'
                ]"
                title="Selecionar todos os produtos"
              >
                <svg
                  v-if="isAllSelected"
                  class="w-3 h-3 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                </svg>
                <svg
                  v-else-if="isIndeterminate"
                  class="w-3 h-3 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M20 12H4" />
                </svg>
              </button>
            </th>
            <th class="px-6 py-5">Produto</th>
            <th class="px-6 py-5 text-center">Categoria</th>
            <th class="px-6 py-5 text-center">Estoque</th>
            <th class="px-6 py-5 text-right">Preço</th>
            <th class="px-6 py-5 text-right">Ações</th>
          </tr>
        </thead>

        <tbody class="divide-y divide-[#E5E7EB] relative">
          <TableEmptyState
            v-if="!hasProducts && !props.isLoading"
            :colspan="6"
          />

          <template v-if="props.isLoading && !hasProducts">
            <tr v-for="i in 5" :key="i" class="animate-pulse">
              <td colspan="5" class="px-6 py-8 bg-zinc-50 border-b border-[#E5E7EB]"></td>
            </tr>
          </template>

          <TableRow
            v-for="product in props.products"
            :key="product.id || Math.random()"
            :product="product"
            :can-manage-catalog="props.canManageCatalog"
            :is-selected="product.id ? props.selectedAssetIds.has(product.id) : false"
            @edit="onEdit"
            @delete="onDelete"
            @toggle-selection="(productId) => emit('toggle-selection', productId)"
            @adjust-stock="onAdjustStock"
          />
        </tbody>
      </table>
    </div>

    <footer v-if="hasProducts" class="bg-zinc-50 px-6 py-3 border-t border-[#E5E7EB] flex justify-between items-center">
      <span class="text-[9px] text-bip-muted font-bold uppercase tracking-widest">
        Total de produtos: {{ props.products.length }}
      </span>
      <span class="text-[9px] text-bip-muted font-medium italic">
        {{ activeStoreName }}
      </span>
    </footer>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.4s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

/* Scrollbar Custom para o overflow-x */
.overflow-x-auto::-webkit-scrollbar {
  height: 4px;
}
.overflow-x-auto::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 10px;
}
</style>
