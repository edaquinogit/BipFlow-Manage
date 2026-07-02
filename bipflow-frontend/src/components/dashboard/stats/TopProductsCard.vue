<script setup lang="ts">
import { computed } from 'vue';
import { CubeIcon, TrophyIcon } from '@heroicons/vue/24/outline';
import type { TopProductBreakdown } from '@/types/sales';
import { formatBRL } from '@/utils/formatters';
import Card from '@/components/ui/Card.vue';

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
  <Card aria-label="Top produtos mais vendidos">
    <div class="flex items-center justify-between gap-4">
      <div>
        <p class="text-[10px] font-black uppercase tracking-[0.4em] text-bip-muted">Mais vendidos</p>
        <h3 class="mt-2 text-lg font-black italic tracking-tighter text-[#05050A]">Top produtos</h3>
      </div>
      <TrophyIcon class="h-6 w-6 text-amber-500" />
    </div>

    <div class="mt-6 space-y-4">
      <template v-if="isLoading">
        <span class="sr-only">Carregando top produtos</span>
        <div v-for="i in 4" :key="i" class="h-12 animate-pulse rounded-2xl bg-zinc-100" />
      </template>

      <template v-else-if="products.length === 0">
        <p class="text-sm text-bip-muted">Nenhuma venda registrada neste periodo.</p>
      </template>

      <ol v-else class="space-y-4">
        <li
          v-for="(product, index) in products"
          :key="product.product_id ?? product.product_name"
          class="flex items-center gap-3"
          :aria-label="`${index + 1}o lugar: ${product.product_name}, ${product.quantity_total} unidades, ${formatBRL(product.revenue_total)}`"
        >
          <span class="w-4 shrink-0 text-xs font-black text-zinc-400" aria-hidden="true">{{ index + 1 }}</span>

          <div class="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-[#E5E7EB] bg-zinc-100">
            <img
              v-if="product.image_url"
              :src="product.image_url"
              :alt="product.product_name"
              loading="lazy"
              class="h-full w-full object-cover"
            />
            <div v-else class="flex h-full w-full items-center justify-center">
              <CubeIcon class="h-5 w-5 text-zinc-400" />
            </div>
          </div>

          <div class="min-w-0 flex-1">
            <div class="flex items-baseline justify-between gap-2">
              <p class="truncate text-sm font-bold text-[#05050A]">{{ product.product_name }}</p>
              <p class="shrink-0 text-sm font-black text-[#D81B60]">{{ formatBRL(product.revenue_total) }}</p>
            </div>
            <div class="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
              <div
                class="h-full rounded-full bg-gradient-to-r from-[#D81B60] to-[#D81B60]/60"
                :style="{ width: progressFor(product.revenue_total) + '%' }"
              />
            </div>
            <p class="mt-1 text-[11px] font-bold uppercase tracking-wider text-bip-muted">
              {{ product.quantity_total }} unid. vendidas
            </p>
          </div>
        </li>
      </ol>
    </div>
  </Card>
</template>
