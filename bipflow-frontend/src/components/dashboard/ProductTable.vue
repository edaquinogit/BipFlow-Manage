<script setup lang="ts">
import type { Product } from '../../schemas/product.schema';

/**
 * 1. NYC CORE INTERFACE
 * Definimos o contrato de dados com precisão.
 */
interface Props {
  products: Product[];
  isLoading?: boolean;
}

const { products = [], isLoading = false } = defineProps<Props>();

const emit = defineEmits<{
  (e: 'delete', id: number): void;
  (e: 'edit', product: Product): void;
}>();

/**
 * 2. FORMATTERS (Business Logic)
 * Padronização de moeda seguindo o mercado internacional (USD).
 */
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value || 0);
};
</script>

<template>
  <div class="w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl relative">
    
    <div v-if="isLoading && products.length > 0" class="absolute inset-0 z-10 flex items-center justify-center bg-zinc-950/40 backdrop-blur-[2px] transition-all">
      <div class="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent"></div>
    </div>

    <table class="w-full text-left border-collapse">
      <thead>
        <tr class="bg-zinc-800/50 text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-black border-b border-zinc-800">
          <th class="px-6 py-5">Asset Details</th>
          <th class="px-6 py-5 text-center">Category</th>
          <th class="px-6 py-5 text-center">Stock</th>
          <th class="px-6 py-5 text-right">Valuation</th>
          <th class="px-6 py-5 text-right">Actions</th>
        </tr>
      </thead>

      <tbody class="divide-y divide-zinc-800">
        <tr v-if="products.length === 0 && !isLoading">
          <td colspan="5" class="px-6 py-24 text-center">
            <div class="flex flex-col items-center opacity-40">
              <span class="text-4xl mb-4 italic font-black text-zinc-700 underline">EMPTY</span>
              <h3 class="text-white font-bold uppercase text-xs tracking-widest">No assets in registry</h3>
              <p class="text-[10px] mt-1 text-zinc-500 font-medium">Provision new items to populate the hub.</p>
            </div>
          </td>
        </tr>

        <tr 
          v-for="product in products" 
          :key="product.id" 
          class="group hover:bg-zinc-800/40 transition-all duration-200 border-transparent hover:border-l-indigo-500 border-l-2"
        >
          <td class="px-6 py-4">
            <div class="flex items-center gap-4">
              <div class="h-11 w-11 flex-none overflow-hidden rounded-lg border border-zinc-700 bg-zinc-800 shadow-inner group-hover:border-zinc-500 transition-colors">
                <img 
                  v-if="product.image" 
                  :src="product.image" 
                  class="h-full w-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div v-else class="flex h-full w-full items-center justify-center text-[10px] text-zinc-600 font-black uppercase">
                  {{ product.name?.substring(0, 2) || '??' }}
                </div>
              </div>
              
              <div class="flex flex-col gap-0.5">
                <span class="text-sm font-bold text-zinc-100 tracking-tight group-hover:text-indigo-300 transition-colors">
                  {{ product.name }}
                </span>
                <div class="flex items-center gap-2">
                  <span class="text-[9px] font-black font-mono text-zinc-500 uppercase tracking-widest">
                    SKU: {{ product.sku || 'N/A' }}
                  </span>
                  <span v-if="product.size" class="w-1 h-1 rounded-full bg-zinc-700"></span>
                  <span v-if="product.size" class="text-[9px] font-black text-indigo-400 uppercase tracking-widest">
                    SIZE: {{ product.size }}
                  </span>
                </div>
              </div>
            </div>
          </td>

          <td class="px-6 py-4 text-center">
            <span class="inline-block px-2 py-1 rounded bg-zinc-800 text-zinc-400 text-[9px] font-black uppercase border border-white/5 group-hover:border-indigo-500/30 group-hover:text-indigo-300 transition-all">
              {{ product.category_name || 'General' }}
            </span>
          </td>

          <td class="px-6 py-4 text-center">
            <div class="flex flex-col items-center">
              <span :class="[
                'font-mono text-xs font-bold',
                product.stock_quantity > 0 ? 'text-zinc-300' : 'text-red-500'
              ]">
                {{ product.stock_quantity }}
              </span>
              <span v-if="product.stock_quantity < 5 && product.stock_quantity > 0" class="text-[8px] text-amber-500 font-black uppercase tracking-tighter">Low Inventory</span>
            </div>
          </td>

          <td class="px-6 py-4 text-right">
            <span class="font-mono text-sm font-black text-emerald-400 tracking-tighter">
              {{ formatCurrency(product.price) }}
            </span>
          </td>

          <td class="px-6 py-4">
            <div class="flex items-center justify-end gap-2 opacity-20 group-hover:opacity-100 transition-opacity">
              <button 
                @click="emit('edit', product)"
                class="bg-zinc-800 hover:bg-zinc-700 text-white p-2 rounded-lg border border-white/5 hover:border-indigo-500/50 transition-all"
                title="Edit Asset"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
              </button>

              <button 
                @click="product.id && emit('delete', product.id)" 
                class="bg-zinc-800 hover:bg-red-900/40 text-zinc-500 hover:text-red-400 p-2 rounded-lg border border-white/5 hover:border-red-500/50 transition-all"
                title="Decommission Asset"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>