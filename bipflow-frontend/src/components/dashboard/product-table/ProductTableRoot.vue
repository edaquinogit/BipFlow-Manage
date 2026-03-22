<script setup lang="ts">
import { computed } from 'vue';
import type { Product } from '@/schemas/product.schema';
import TableEmptyState from './ui/TableEmptyState.vue';
import TableRow from '@/components/dashboard/product-table/TableRow.vue';

/**
 * 🛰️ REGISTRY PROPS
 * Interface blindada para recebimento de dados do Dashboard.
 */
const props = withDefaults(defineProps<{
  products: Product[];
  isLoading?: boolean;
}>(), {
  products: () => [],
  isLoading: false
});

const emit = defineEmits<{
  (e: 'delete', id: number): void;
  (e: 'edit', product: Product): void;
}>();

/**
 * 🛡️ INTEGRITY GUARD
 * Verifica se a lista de produtos é válida para exibição.
 */
const hasProducts = computed(() => props.products && props.products.length > 0);

// Proxy de eventos para manter o Root limpo
const onEdit = (product: Product) => emit('edit', product);
const onDelete = (id: number) => {
  if (id) emit('delete', id);
};
</script>

<template>
  <div class="relative w-full min-h-96 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl">
    
    <Transition name="fade">
      <div
  v-if="props.isLoading && hasProducts"
  class="absolute inset-0 z-30 flex flex-col items-center justify-center bg-zinc-950/60 backdrop-blur-sm transition-all"
>
        <div class="flex flex-col items-center gap-4">
          <div class="h-10 w-10 animate-spin rounded-full border-[3px] border-indigo-500 border-t-transparent"></div>
          <span class="text-[10px] font-black uppercase tracking-[0.3em] text-white italic">Syncing Registry...</span>
        </div>
      </div>
    </Transition>

    <div class="overflow-x-auto">
      <table class="w-full text-left border-collapse table-auto">
        <thead>
          <tr class="bg-zinc-800/50 text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-black border-b border-zinc-800">
            <th class="px-6 py-5">Asset Details</th>
            <th class="px-6 py-5 text-center">Category</th>
            <th class="px-6 py-5 text-center">Stock</th>
            <th class="px-6 py-5 text-right">Valuation</th>
            <th class="px-6 py-5 text-right">Actions</th>
          </tr>
        </thead>

        <tbody class="divide-y divide-zinc-800 relative">
          <TableEmptyState
            v-if="!hasProducts && !props.isLoading"
            :colspan="5"
          />

          <template v-if="props.isLoading && !hasProducts">
            <tr v-for="i in 5" :key="i" class="animate-pulse">
              <td colspan="5" class="px-6 py-8 bg-zinc-800/10 border-b border-zinc-800/50"></td>
            </tr>
          </template>

          <TableRow
            v-for="product in props.products"
            :key="product.id || Math.random()"
            :product="product"
            @edit="onEdit"
            @delete="onDelete"
          />
        </tbody>
      </table>
    </div>

    <footer v-if="hasProducts" class="bg-zinc-800/20 px-6 py-3 border-t border-zinc-800 flex justify-between items-center">
      <span class="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">
        Total Assets: {{ props.products.length }}
      </span>
      <span class="text-[9px] text-zinc-600 font-medium italic">
        BipFlow Inventory Hub v2.0
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
  background: #27272a;
  border-radius: 10px;
}
</style>