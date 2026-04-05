<script setup lang="ts">
import type { Product } from '@/schemas/product.schema';
import ProductAvatar from './ui/ProductAvatar.vue'; // Certifique-se que o nome do arquivo de imagem seja este

/**
 * 🛰️ COMPONENT CONTRACT
 */
defineProps<{
  product: Product;
}>();

const emit = defineEmits<{
  (e: 'edit', product: Product): void;
  (e: 'delete', id: number): void;
}>();

// ==========================================
// 1. FORMATTERS (NYC FINANCIAL DISTRICT STYLE)
// ==========================================
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value);
};

const getCategoryName = (category: any): string => {
  if (!category) return 'Unclassified';
  if (typeof category === 'object') return category.name || 'General';
  return `Category #${category}`;
};
</script>

<template>
  <tr class="group hover:bg-zinc-800/40 transition-all duration-200 border-b border-zinc-800/50 last:border-0">
    
    <td class="px-6 py-4">
      <div class="flex items-center gap-4">
        <ProductAvatar :image="product.image" :name="product.name" />
        
        <div class="flex flex-col">
          <span class="text-sm font-bold text-white uppercase tracking-tight group-hover:text-indigo-400 transition-colors">
            {{ product.name }}
          </span>
          <span class="text-[9px] text-zinc-500 font-mono font-bold tracking-widest uppercase">
            {{ product.sku || 'N/A-STATION' }}
          </span>
        </div>
      </div>
    </td>

    <td class="px-6 py-4 text-center">
      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter bg-zinc-800 text-zinc-400 border border-white/5">
        {{ getCategoryName(product.category) }}
      </span>
    </td>

    <td class="px-6 py-4 text-center">
      <div class="flex flex-col items-center">
        <span 
          class="text-xs font-black font-mono"
          :class="product.stock_quantity > 5 ? 'text-zinc-300' : 'text-amber-500'"
        >
          {{ product.stock_quantity.toString().padStart(2, '0') }}
        </span>
        <div 
          class="h-1 w-8 rounded-full mt-1 overflow-hidden bg-zinc-800"
          title="Stock Level Visualizer"
        >
          <div 
            class="h-full bg-indigo-500 transition-all duration-500" 
            :style="{ width: `${Math.min(product.stock_quantity * 10, 100)}%` }"
          />
        </div>
      </div>
    </td>

    <td class="px-6 py-4 text-right">
      <div class="flex flex-col items-end">
        <span class="text-sm font-black text-indigo-400 font-mono">
          {{ formatCurrency(product.price) }}
        </span>
        <span class="text-[8px] text-zinc-600 uppercase font-bold tracking-widest">
          Unit Price (USD)
        </span>
      </div>
    </td>

    <td class="px-6 py-4 text-right">
      <div class="flex justify-end items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
        <button 
          @click="emit('edit', product)"
          class="p-2.5 hover:bg-indigo-500/10 rounded-lg text-zinc-500 hover:text-indigo-400 transition-colors"
          title="Edit Asset"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
        
        <button 
          @click="emit('delete', product.id!)"
          class="p-2.5 hover:bg-red-500/10 rounded-lg text-zinc-500 hover:text-red-500 transition-colors"
          title="Delete Asset"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </td>
  </tr>
</template>