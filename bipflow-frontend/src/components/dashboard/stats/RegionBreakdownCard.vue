<script setup lang="ts">
import { computed } from 'vue';
import { MapPinIcon } from '@heroicons/vue/24/outline';
import type { RegionBreakdown } from '@/types/sales';
import { formatBRL } from '@/utils/formatters';
import Card from '@/components/ui/Card.vue';

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
  <Card aria-label="Vendas por regiao de entrega">
    <div class="flex items-center justify-between gap-4">
      <div>
        <p class="text-[10px] font-black uppercase tracking-[0.4em] text-bip-muted">Onde vendem</p>
        <h3 class="mt-2 text-lg font-black italic tracking-tighter text-[#05050A]">Por regiao</h3>
      </div>
      <MapPinIcon class="h-6 w-6 text-emerald-600" />
    </div>

    <div class="mt-6 space-y-4">
      <template v-if="isLoading">
        <span class="sr-only">Carregando vendas por regiao</span>
        <div v-for="i in 4" :key="i" class="h-12 animate-pulse rounded-2xl bg-zinc-100" />
      </template>

      <template v-else-if="regions.length === 0">
        <p class="text-sm text-bip-muted">Nenhuma venda registrada neste periodo.</p>
      </template>

      <ol v-else class="space-y-4">
        <li
          v-for="region in regions"
          :key="region.region"
          :aria-label="`${region.region}: ${region.orders_count} pedidos, ${formatBRL(region.revenue_total)}`"
        >
          <div class="flex items-baseline justify-between gap-2">
            <p class="truncate text-sm font-bold text-[#05050A]">{{ region.region }}</p>
            <p class="shrink-0 text-sm font-black text-emerald-700">{{ formatBRL(region.revenue_total) }}</p>
          </div>
          <div class="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
            <div
              class="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400"
              :style="{ width: progressFor(region.revenue_total) + '%' }"
            />
          </div>
          <p class="mt-1 text-[11px] font-bold uppercase tracking-wider text-bip-muted">
            {{ region.orders_count }} pedido<span v-if="region.orders_count !== 1">s</span>
          </p>
        </li>
      </ol>
    </div>
  </Card>
</template>
