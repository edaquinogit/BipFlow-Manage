<script setup lang="ts">
import { computed } from 'vue';
import { CubeIcon, TrophyIcon } from '@heroicons/vue/24/outline';
import type { TopProductBreakdown } from '@/types/sales';
import { formatBRL } from '@/utils/formatters';

const props = defineProps<{
  products: TopProductBreakdown[];
  isLoading: boolean;
}>();

const maxRevenue = computed(() =>
  props.products.reduce((max, product) => Math.max(max, Number(product.revenue_total)), 0)
);

const progressFor = (revenue: string): number => {
  if (!maxRevenue.value) {
    return 0;
  }

  return Math.max(6, Math.round((Number(revenue) / maxRevenue.value) * 100));
};
</script>

<template>
  <div class="rounded-[2.5rem] border border-white/5 bg-zinc-900/40 p-8 backdrop-blur-md">
    <div class="flex items-center justify-between gap-4">
      <div>
        <p class="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500">Mais vendidos</p>
        <h3 class="mt-2 text-lg font-black italic tracking-tighter text-white">Top produtos</h3>
      </div>
      <TrophyIcon class="h-6 w-6 text-amber-300/70" />
    </div>

    <div class="mt-6 space-y-4">
      <template v-if="isLoading">
        <div v-for="i in 4" :key="i" class="h-12 animate-pulse rounded-2xl bg-zinc-800/40" />
      </template>

      <template v-else-if="products.length === 0">
        <p class="text-sm text-zinc-500">Nenhuma venda registrada neste periodo.</p>
      </template>

      <template v-else>
        <div
          v-for="(product, index) in products"
          :key="product.product_id ?? product.product_name"
          class="flex items-center gap-3"
        >
          <span class="w-4 shrink-0 text-xs font-black text-zinc-600">{{ index + 1 }}</span>

          <div class="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-zinc-950">
            <img
              v-if="product.image_url"
              :src="product.image_url"
              :alt="product.product_name"
              class="h-full w-full object-cover"
            />
            <div v-else class="flex h-full w-full items-center justify-center">
              <CubeIcon class="h-5 w-5 text-zinc-600" />
            </div>
          </div>

          <div class="min-w-0 flex-1">
            <div class="flex items-baseline justify-between gap-2">
              <p class="truncate text-sm font-bold text-white">{{ product.product_name }}</p>
              <p class="shrink-0 text-sm font-black text-rose-300">{{ formatBRL(product.revenue_total) }}</p>
            </div>
            <div class="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                class="h-full rounded-full bg-gradient-to-r from-rose-500 to-rose-300"
                :style="{ width: progressFor(product.revenue_total) + '%' }"
              />
            </div>
            <p class="mt-1 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
              {{ product.quantity_total }} unid. vendidas
            </p>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
