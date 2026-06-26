<script setup lang="ts">
import { DEFAULT_LOW_STOCK_THRESHOLD } from '@/utils/stockAlerts';

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

// Unlike stock, an empty/cleared input here must resolve to null ("use the
// default threshold"), never to 0 -- 0 is a legitimate explicit choice
// ("only alert when truly zeroed"), not the same thing as "no override".
const normalizeLowStockThresholdModel = (value: unknown): number | null => {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  const numericValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numericValue) ? Math.max(0, Math.trunc(numericValue)) : null;
};

const price = defineModel<number>('price', {
  default: 0,
  set: normalizeNumberModel,
});
const stock = defineModel<number>('stock', {
  default: 0,
  set: normalizeStockModel,
});
const lowStockThreshold = defineModel<number | null>('lowStockThreshold', {
  default: null,
  set: normalizeLowStockThresholdModel,
});
const size = defineModel<string>('size', { default: '' });

interface Props {
  errors: Record<string, string[]>;
  isExistingProduct?: boolean;
}

const props = defineProps<Props>();
</script>

<template>
  <section class="space-y-8 border-b border-[#E5E7EB] pb-10">
    <header>
      <h3 class="mb-1 text-[10px] font-black uppercase tracking-[0.3em] text-[#D81B60]">
        Preço e estoque
      </h3>
      <p class="text-[9px] font-bold uppercase tracking-widest text-bip-muted">
        Valores usados no catalogo e no checkout
      </p>
    </header>

    <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div class="group flex flex-col gap-2">
        <label class="text-[10px] font-black uppercase tracking-[0.2em] text-bip-muted transition-colors group-focus-within:text-[#D81B60]">
          Preço de venda
        </label>
        <div class="relative">
          <span class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 font-mono text-sm text-bip-muted">$</span>
          <input
            v-model.number="price"
            type="number"
            name="price"
            data-cy="input-product-price"
            step="0.01"
            min="0"
            class="w-full rounded-xl border border-[#D1D5DB] bg-white py-3 pl-8 pr-4 font-mono text-sm text-emerald-700 outline-none transition-all focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
            placeholder="0.00"
          />
        </div>
        <p v-if="errors.price" class="text-[9px] font-black uppercase tracking-widest text-[#D81B60]">
          {{ errors.price[0] }}
        </p>
      </div>

      <div class="group flex flex-col gap-2">
        <label class="text-[10px] font-black uppercase tracking-[0.2em] text-bip-muted transition-colors group-focus-within:text-[#D81B60]">
          Estoque
        </label>
        <input
          v-model.number="stock"
          type="number"
          name="stock_quantity"
          data-cy="input-product-stock"
          min="0"
          :disabled="props.isExistingProduct"
          class="w-full rounded-xl border border-[#D1D5DB] bg-white px-4 py-3 font-mono text-sm text-[#05050A] outline-none transition-all focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3] disabled:cursor-not-allowed disabled:border-[#E5E7EB] disabled:bg-zinc-50 disabled:text-bip-muted"
          placeholder="0"
        />
        <p v-if="props.isExistingProduct" class="text-[9px] font-bold uppercase tracking-widest text-bip-muted">
          Use "Movimentar estoque" na tabela para ajustar a quantidade.
        </p>
        <p v-else-if="errors.stock_quantity" class="text-[9px] font-black uppercase tracking-widest text-[#D81B60]">
          {{ errors.stock_quantity[0] }}
        </p>
      </div>
    </div>

    <div class="group flex flex-col gap-2">
      <label class="text-[10px] font-black uppercase tracking-[0.2em] text-bip-muted transition-colors group-focus-within:text-[#D81B60]">
        Limite de estoque baixo
      </label>
      <input
        v-model.number="lowStockThreshold"
        type="number"
        name="low_stock_threshold"
        data-cy="input-product-low-stock-threshold"
        min="0"
        :placeholder="`Padrão: ${DEFAULT_LOW_STOCK_THRESHOLD} unidades`"
        class="w-full rounded-xl border border-[#D1D5DB] bg-white px-4 py-3 font-mono text-sm text-[#05050A] outline-none transition-all focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
      />
      <p class="text-[9px] font-bold uppercase tracking-widest text-bip-muted">
        Alerta o painel quando o estoque chegar nesse valor ou menos. Deixe em branco para usar o padrão.
      </p>
      <p v-if="errors.low_stock_threshold" class="text-[9px] font-black uppercase tracking-widest text-[#D81B60]">
        {{ errors.low_stock_threshold[0] }}
      </p>
    </div>

    <div class="group flex flex-col gap-2">
      <label class="text-[10px] font-black uppercase tracking-[0.2em] text-bip-muted transition-colors group-focus-within:text-[#D81B60]">
        Tamanho ou unidade
      </label>
      <input
        v-model="size"
        type="text"
        name="size"
        data-cy="input-product-size"
        class="w-full rounded-xl border border-[#D1D5DB] bg-white px-4 py-3 text-sm font-bold text-[#05050A] outline-none transition-all placeholder:text-bip-muted/70 focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
        placeholder="Ex.: 500ml, P, unidade"
      />
      <p v-if="errors.size" class="text-[9px] font-black uppercase tracking-widest text-[#D81B60]">
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
