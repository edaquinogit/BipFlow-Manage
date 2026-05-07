<script setup lang="ts">
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
  <section class="space-y-8 border-b border-zinc-800/50 pb-10">
    <header>
      <h3 class="mb-1 text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">
        Preco e estoque
      </h3>
      <p class="text-[9px] font-bold uppercase tracking-widest text-zinc-500">
        Valores usados no catalogo e no checkout
      </p>
    </header>

    <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div class="group flex flex-col gap-2">
        <label class="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 transition-colors group-focus-within:text-emerald-400">
          Preco de venda
        </label>
        <div class="relative">
          <span class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-mono text-sm text-zinc-500">$</span>
          <input
            v-model.number="price"
            type="number"
            name="price"
            data-cy="input-product-price"
            step="0.01"
            min="0"
            class="w-full rounded-xl border border-zinc-800 bg-zinc-950 py-3 pl-8 pr-4 font-mono text-sm text-emerald-400 shadow-inner outline-none transition-all focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
            placeholder="0.00"
          />
        </div>
        <p v-if="errors.price" class="text-[9px] font-black uppercase tracking-widest text-red-500">
          {{ errors.price[0] }}
        </p>
      </div>

      <div class="group flex flex-col gap-2">
        <label class="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 transition-colors group-focus-within:text-indigo-400">
          Estoque
        </label>
        <input
          v-model.number="stock"
          type="number"
          name="stock_quantity"
          data-cy="input-product-stock"
          min="0"
          class="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 font-mono text-sm text-zinc-100 shadow-inner outline-none transition-all focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20"
          placeholder="0"
        />
        <p v-if="errors.stock_quantity" class="text-[9px] font-black uppercase tracking-widest text-red-500">
          {{ errors.stock_quantity[0] }}
        </p>
      </div>
    </div>

    <div class="group flex flex-col gap-2">
      <label class="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 transition-colors group-focus-within:text-indigo-400">
        Tamanho ou unidade
      </label>
      <input
        v-model="size"
        type="text"
        name="size"
        data-cy="input-product-size"
        class="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm font-bold text-zinc-100 shadow-inner outline-none transition-all placeholder:text-zinc-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/10"
        placeholder="Ex.: 500ml, P, unidade"
      />
      <p v-if="errors.size" class="text-[9px] font-black uppercase tracking-widest text-red-500">
        {{ errors.size[0] }}
      </p>
    </div>
  </section>
</template>

<style scoped>
input[type="number"]::-webkit-outer-spin-button,
input[type="number"]::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

input[type="number"] {
  appearance: textfield;
  -moz-appearance: textfield;
}
</style>
