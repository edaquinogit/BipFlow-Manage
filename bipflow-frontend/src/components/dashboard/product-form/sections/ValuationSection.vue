<script setup lang="ts">
/**
 * 🛰️ BIPFLOW REGISTRY HUB - VALUATION SECTION
 * Padrão de Engenharia: Vue 3.4+ Atomic Synchronization
 * Foco: Métricas de Inventário e Integridade de Custos.
 */

// Sincronização direta com o Estado Global do Formulário (ProductFormRoot)
const normalizeNumberModel = (value: unknown): number => {
  if (value === '' || value === null || value === undefined) {
    return 0;
  }

  const numericValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

const normalizeStockModel = (value: unknown): number => {
  return Math.max(0, Math.trunc(normalizeNumberModel(value)));
};

const price = defineModel<number>('price', {
  default: 0,
  set: normalizeNumberModel,
});
const stock = defineModel<number>('stock', {
  default: 0,
  set: normalizeStockModel,
});
const size = defineModel<string>('size', { default: '' });

interface Props {
  errors: Record<string, string[]>;
}

defineProps<Props>();
</script>

<template>
  <section class="space-y-8 pb-10 border-b border-zinc-800/50">
    <header>
      <h3 class="text-[10px] font-black uppercase text-indigo-500 tracking-[0.3em] mb-1">
        Valuation & Inventory Metrics
      </h3>
      <p class="text-[9px] text-zinc-500 uppercase font-bold tracking-widest">
        Asset pricing and physical availability control
      </p>
    </header>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
      
      <div class="flex flex-col gap-2 group">
        <label class="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] group-focus-within:text-emerald-400 transition-colors">
          List Price (USD)
        </label>
        <div class="relative">
          <span class="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-mono text-sm pointer-events-none">$</span>
          <input 
            type="number" 
            v-model.number="price"
            name="price"
            data-cy="input-product-price"
            step="0.01"
            min="0"
            class="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 pl-8 pr-4 text-sm font-mono text-emerald-400 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all outline-none shadow-inner"
            placeholder="0.00"
          />
        </div>
        <p v-if="errors.price" class="text-[9px] text-red-500 font-black uppercase tracking-widest animate-pulse">
          {{ errors.price[0] }}
        </p>
      </div>

      <div class="flex flex-col gap-2 group">
        <label class="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] group-focus-within:text-indigo-400 transition-colors">
          Stock Units
        </label>
        <input 
          type="number" 
          v-model.number="stock"
          name="stock_quantity"
          data-cy="input-product-stock"
          min="0"
          class="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 px-4 text-sm font-mono text-zinc-100 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all outline-none shadow-inner"
          placeholder="0"
        />
        <p v-if="errors.stock_quantity" class="text-[9px] text-red-500 font-black uppercase tracking-widest animate-pulse">
          {{ errors.stock_quantity[0] }}
        </p>
      </div>
    </div>

    <div class="flex flex-col gap-2 group">
      <label class="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] group-focus-within:text-indigo-400 transition-colors">
        Dimension / Size
      </label>
      <input 
        type="text" 
        v-model="size" 
        name="size"
        data-cy="input-product-size"
        class="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 px-4 text-sm font-bold text-zinc-100 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/10 transition-all outline-none placeholder:text-zinc-700 shadow-inner"
        placeholder="e.g. XL, 42, 750ml, 1TB"
      />
      <p v-if="errors.size" class="text-[9px] text-red-500 font-black uppercase tracking-widest">
        {{ errors.size[0] }}
      </p>
    </div>
  </section>
</template>

<style scoped>
/* 🚫 ANTI-SPIN: Remove as setas de incremento dos campos numéricos.
  Usamos aspas no seletor para garantir compatibilidade com todos os parsers.
*/
input[type="number"]::-webkit-outer-spin-button,
input[type="number"]::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

/* Compatibilidade Firefox: 
  Usamos 'appearance' padrão e apenas o prefixo se necessário, 
  envolto em uma sintaxe que o linter não rejeite.
*/
input[type="number"] {
  appearance: textfield;
  -moz-appearance: textfield;
}
</style>
