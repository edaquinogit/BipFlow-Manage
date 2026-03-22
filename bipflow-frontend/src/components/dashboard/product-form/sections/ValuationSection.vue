<template>
  <section class="space-y-6 pb-10 border-b border-zinc-800/50">
    <h3 class="text-[10px] font-black uppercase text-indigo-500 tracking-[0.3em]">
      Valuation & Inventory Metrics
    </h3>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="flex flex-col gap-2">
        <label class="text-[10px] font-black text-zinc-500 uppercase tracking-widest">List Price (USD)</label>
        <div class="relative">
          <span class="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-mono text-xs">$</span>
          <input 
            type="number" 
            v-model="price" 
            step="0.01"
            class="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-3 pl-8 pr-4 text-sm font-mono text-emerald-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all outline-none"
            placeholder="0.00"
          />
        </div>
        <p v-if="errors.price" class="text-[9px] text-red-500 font-bold uppercase tracking-tighter">
          {{ errors.price[0] }}
        </p>
      </div>

      <div class="flex flex-col gap-2">
        <label class="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Stock Units</label>
        <input 
          type="number" 
          v-model="stock" 
          class="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-3 px-4 text-sm font-mono text-zinc-100 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all outline-none"
          placeholder="0"
        />
        <p v-if="errors.stock_quantity" class="text-[9px] text-red-500 font-bold uppercase tracking-tighter">
          {{ errors.stock_quantity[0] }}
        </p>
      </div>
    </div>

    <div class="flex flex-col gap-2">
      <label class="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Dimension / Size</label>
      <input 
        type="text" 
        v-model="size" 
        class="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-3 px-4 text-sm font-bold text-zinc-100 focus:border-indigo-500 transition-all outline-none placeholder:text-zinc-700"
        placeholder="e.g. XL, 42, 750ml, 1TB"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
/**
 * 🛰️ DATA BINDING ENGINE (Vue 3.4+)
 * Mapeamos os modelos para que o Root possa controlar o estado global.
 */
const price = defineModel<number>('price', { default: 0 });
const stock = defineModel<number>('stock', { default: 0 });
const size = defineModel<string>('size', { default: '' });

defineProps<{
  errors: Record<string, string[]>;
}>();
</script>

<style scoped>
/* Remove setas do input number para um look mais clean */
input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
</style>