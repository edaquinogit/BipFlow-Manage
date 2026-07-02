<script setup lang="ts">
import { computed } from 'vue';
import { ArrowsUpDownIcon, QrCodeIcon } from '@heroicons/vue/24/outline';
import type { Product } from '@/schemas/product.schema';
import { formatBRL } from '@/utils/formatters';
import { getLowStockThreshold } from '@/utils/stockAlerts';
import ProductAvatar from './ui/ProductAvatar.vue';
import CategoryBadge from './ui/CategoryBadge.vue';

/**
 * 🛰️ COMPONENT CONTRACT
 */
const props = defineProps<{
  product: Product;
  isSelected?: boolean;
  canManageCatalog?: boolean;
}>();

const emit = defineEmits<{
  (e: 'edit', product: Product): void;
  (e: 'delete', id: number): void;
  (e: 'toggle-selection', productId: number): void;
  (e: 'adjust-stock', product: Product): void;
  (e: 'print-label', product: Product): void;
}>();

const resolvedCategory = computed(() => {
  if (!props.product.category || typeof props.product.category !== 'object') {
    return null;
  }

  return props.product.category;
});

const isLowStockRow = computed(() => props.product.stock_quantity <= getLowStockThreshold(props.product));

</script>

<template>
  <tr
    class="group hover:bg-zinc-50 transition-all duration-200 border-b border-[#E5E7EB] last:border-0"
    data-cy="product-table-row"
  >

    <!-- Custom Themed Checkbox -->
    <td class="px-6 py-4">
      <button
        v-if="canManageCatalog"
        @click="emit('toggle-selection', product.id!)"
        class="w-5 h-5 rounded border-2 transition-all duration-200 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#FCE7F3]"
        :class="[
          isSelected
            ? 'bg-[#D81B60] border-[#D81B60] shadow-lg shadow-[#D81B60]/25'
            : 'border-[#D1D5DB] hover:border-[#D81B60]/50 bg-white'
        ]"
        title="Selecionar produto"
      >
        <svg
          v-if="isSelected"
          class="w-3 h-3 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
        </svg>
      </button>
    </td>

    <td class="px-6 py-4">
      <div class="flex items-center gap-4">
        <ProductAvatar :image="product.image" :name="product.name" />

        <div class="flex flex-col">
          <span class="text-sm font-bold text-[#05050A] uppercase tracking-tight group-hover:text-[#D81B60] transition-colors">
            {{ product.name }}
          </span>
          <span class="text-[9px] text-bip-muted font-mono font-bold tracking-widest uppercase">
            {{ product.sku || 'Sem SKU' }}
          </span>
          <span
            v-if="product.public_code"
            data-cy="product-public-code"
            class="text-[8px] text-bip-muted/70 font-mono font-semibold tracking-widest uppercase"
          >
            #{{ product.public_code }}
          </span>
        </div>
      </div>
    </td>

    <td class="px-6 py-4 text-center">
      <CategoryBadge :category="resolvedCategory" />
    </td>

    <td class="px-6 py-4 text-center">
      <div class="flex flex-col items-center">
        <span
          class="text-xs font-black font-mono"
          :class="isLowStockRow ? 'text-amber-600' : 'text-[#05050A]'"
        >
          {{ product.stock_quantity.toString().padStart(2, '0') }}
        </span>
        <div
          class="h-1 w-8 rounded-full mt-1 overflow-hidden bg-zinc-100"
          title="Nível de estoque"
        >
          <div
            class="h-full bg-[#D81B60] transition-all duration-500"
            :style="{ width: `${Math.min(product.stock_quantity * 10, 100)}%` }"
          />
        </div>
      </div>
    </td>

    <td class="px-6 py-4 text-right">
      <div class="flex flex-col items-end">
        <span class="text-sm font-black text-[#D81B60] font-mono">
          {{ formatBRL(product.price) }}
        </span>
        <span class="text-[8px] text-bip-muted uppercase font-bold tracking-widest">
          Preço unitário
        </span>
      </div>
    </td>

    <td class="px-6 py-4 text-right">
      <div v-if="canManageCatalog" class="flex justify-end items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
        <button
          @click="emit('adjust-stock', product)"
          class="p-2.5 hover:bg-[#FCE7F3] rounded-lg text-bip-muted hover:text-[#D81B60] transition-colors"
          title="Movimentar estoque"
        >
          <ArrowsUpDownIcon class="h-4 w-4" />
        </button>

        <button
          @click="emit('print-label', product)"
          class="p-2.5 hover:bg-[#FCE7F3] rounded-lg text-bip-muted hover:text-[#D81B60] transition-colors"
          title="Imprimir etiqueta com QR Code"
        >
          <QrCodeIcon class="h-4 w-4" />
        </button>

        <button
          @click="emit('edit', product)"
          class="p-2.5 hover:bg-[#FCE7F3] rounded-lg text-bip-muted hover:text-[#D81B60] transition-colors"
          title="Editar produto"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>

        <button
          @click="emit('delete', product.id!)"
          class="p-2.5 hover:bg-[#FCE7F3] rounded-lg text-bip-muted hover:text-[#D81B60] transition-colors"
          title="Remover produto"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </td>
  </tr>
</template>
