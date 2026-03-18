<script setup lang="ts">
import ProductTable from '../ProductTable.vue';
import { ExclamationTriangleIcon } from '@heroicons/vue/24/outline';

defineProps<{
  products: any[];
  isLoading: boolean;
  error: string | null;
}>();

defineEmits(['open-panel', 'delete', 'retry']);
</script>

<template>
  <section class="space-y-8">
    <div class="flex justify-between items-end border-l-2 border-indigo-500 pl-6">
      <div>
        <h3 class="text-3xl font-black text-white italic uppercase tracking-tighter leading-none transition-all">
          Active Assets
        </h3>
        <p class="text-[10px] text-zinc-500 font-bold uppercase mt-2 tracking-[0.2em]">Real-time Registry Control</p>
      </div>
      <button 
        @click="$emit('open-panel')" 
        class="bg-white text-black px-10 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-zinc-200 transition-all active:scale-95 shadow-xl shadow-white/5"
      >
        + Provision New Asset
      </button>
    </div>

    <div v-if="isLoading" class="space-y-4">
      <div v-for="i in 5" :key="i" class="h-20 bg-zinc-900/30 animate-pulse rounded-2xl border border-white/5"></div>
    </div>

    <div v-else-if="error" class="p-16 bg-red-950/10 border border-red-500/20 rounded-[3rem] text-center backdrop-blur-sm">
      <ExclamationTriangleIcon class="w-12 h-12 text-red-500 mx-auto mb-4 opacity-50" />
      <p class="text-red-400 font-black uppercase text-[11px] tracking-[0.3em] mb-6">{{ error }}</p>
      <button 
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
    />
  </section>
</template>