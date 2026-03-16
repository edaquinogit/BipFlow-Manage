<script setup lang="ts">
import type { Product } from '../../schemas/product.schema';

/**
 * 1. VERSIONAMENTO DE PROPS (Padrão Sênior)
 * Usamos interfaces claras e valores default para evitar quebras no render.
 */
interface Props {
  products: Product[];
  isLoading?: boolean;
}

const { products = [], isLoading = false } = defineProps<Props>();

const emit = defineEmits<{
  (e: 'delete', id: number | undefined): void;
  (e: 'edit', product: Product): void;
}>();

/**
 * 2. FORMATAÇÃO CENTRALIZADA
 * Em um app real, isso iria para um /utils, mas aqui mantemos isolado e limpo.
 */
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value || 0);
};
</script>

<template>
  <div class="w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl">
    
    <div v-if="isLoading" class="absolute inset-0 z-20 flex items-center justify-center bg-zinc-950/60 backdrop-blur-sm">
      <div class="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
    </div>

    <table class="w-full text-left border-collapse">
      <thead>
        <tr class="bg-zinc-800/50 text-[10px] uppercase tracking-widest text-zinc-500 font-bold border-b border-zinc-800">
          <th class="px-6 py-5">Product Details</th>
          <th class="px-6 py-5 text-center">Category</th>
          <th class="px-6 py-5 text-center">Stock</th>
          <th class="px-6 py-5 text-right">Price</th>
          <th class="px-6 py-5 text-right">Actions</th>
        </tr>
      </thead>

      <tbody class="divide-y divide-zinc-800">
        <tr v-if="products.length === 0 && !isLoading">
          <td colspan="5" class="px-6 py-24 text-center">
            <div class="flex flex-col items-center opacity-40">
              <span class="text-4xl mb-4">📦</span>
              <h3 class="text-white font-medium">No products in inventory</h3>
              <p class="text-xs mt-1">Add items to start selling.</p>
            </div>
          </td>
        </tr>

        <tr 
          v-for="product in products" 
          :key="product.id" 
          class="group hover:bg-zinc-800/30 transition-all duration-200"
        >
          <td class="px-6 py-4">
            <div class="flex items-center gap-4">
              <div class="h-12 w-12 flex-none overflow-hidden rounded-lg border border-zinc-700 bg-zinc-800 shadow-inner">
                <img 
                  v-if="product.image" 
                  :src="product.image" 
                  class="h-full w-full object-cover group-hover:scale-110 transition-transform"
                />
                <div v-else class="flex h-full w-full items-center justify-center text-[10px] text-zinc-600 font-bold uppercase">
                  {{ product.name?.substring(0, 2) || '??' }}
                </div>
              </div>
              
              <div class="flex flex-col">
                <span class="text-sm font-semibold text-zinc-100">{{ product.name }}</span>
                <span class="text-[10px] font-mono text-zinc-500">SKU: {{ product.sku || 'N/A' }}</span>
              </div>
            </div>
          </td>

          <td class="px-6 py-4 text-center">
            <span class="inline-block px-2 py-1 rounded bg-indigo-500/10 text-indigo-400 text-[10px] font-bold uppercase border border-indigo-500/20">
              {{ product.category_name || 'General' }}
            </span>
          </td>

          <td class="px-6 py-4 text-center font-mono text-xs">
            <span :class="product.stock_quantity > 0 ? 'text-zinc-400' : 'text-red-500 font-bold'">
              {{ product.stock_quantity }}
            </span>
          </td>

          <td class="px-6 py-4 text-right">
            <span class="font-mono text-sm font-bold text-emerald-400">
              {{ formatCurrency(product.price) }}
            </span>
          </td>

          <td class="px-6 py-4">
            <div class="flex items-center justify-end gap-3">
              <button 
                @click="emit('edit', product)"
                class="text-zinc-500 hover:text-white transition-colors p-1"
                title="Edit"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              </button>

              <button 
                @click="emit('delete', product.id)" 
                class="text-zinc-500 hover:text-red-400 transition-colors p-1"
                title="Delete"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>