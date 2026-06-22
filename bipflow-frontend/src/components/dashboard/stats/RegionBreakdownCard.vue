<script setup lang="ts">
import { computed } from 'vue';
import { MapPinIcon } from '@heroicons/vue/24/outline';
import type { RegionBreakdown } from '@/types/sales';
import { formatBRL } from '@/utils/formatters';

const props = defineProps<{
  regions: RegionBreakdown[];
  isLoading: boolean;
}>();

const maxRevenue = computed(() =>
  props.regions.reduce((max, region) => Math.max(max, Number(region.revenue_total)), 0)
);

const progressFor = (revenue: string): number => {
  if (!maxRevenue.value) {
    return 0;
  }

  return Math.max(6, Math.round((Number(revenue) / maxRevenue.value) * 100));
};
</script>

<template>
  <section aria-label="Vendas por regiao de entrega" class="rounded-[2.5rem] border border-white/5 bg-zinc-900/40 p-8 backdrop-blur-md">
    <div class="flex items-center justify-between gap-4">
      <div>
        <p class="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500">Onde vendem</p>
        <h3 class="mt-2 text-lg font-black italic tracking-tighter text-white">Por regiao</h3>
      </div>
      <MapPinIcon class="h-6 w-6 text-emerald-300/70" />
    </div>

    <div class="mt-6 space-y-4">
      <template v-if="isLoading">
        <span class="sr-only">Carregando vendas por regiao</span>
        <div v-for="i in 4" :key="i" class="h-12 animate-pulse rounded-2xl bg-zinc-800/40" />
      </template>

      <template v-else-if="regions.length === 0">
        <p class="text-sm text-zinc-500">Nenhuma venda registrada neste periodo.</p>
      </template>

      <ol v-else class="space-y-4">
        <li
          v-for="region in regions"
          :key="region.region"
          :aria-label="`${region.region}: ${region.orders_count} pedidos, ${formatBRL(region.revenue_total)}`"
        >
          <div class="flex items-baseline justify-between gap-2">
            <p class="truncate text-sm font-bold text-white">{{ region.region }}</p>
            <p class="shrink-0 text-sm font-black text-emerald-300">{{ formatBRL(region.revenue_total) }}</p>
          </div>
          <div class="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              class="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300"
              :style="{ width: progressFor(region.revenue_total) + '%' }"
            />
          </div>
          <p class="mt-1 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
            {{ region.orders_count }} pedido<span v-if="region.orders_count !== 1">s</span>
          </p>
        </li>
      </ol>
    </div>
  </section>
</template>
