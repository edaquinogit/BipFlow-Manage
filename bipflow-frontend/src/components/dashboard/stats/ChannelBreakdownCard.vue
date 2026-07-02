<script setup lang="ts">
import { computed } from 'vue';
import { QrCodeIcon } from '@heroicons/vue/24/outline';
import type { ChannelBreakdown } from '@/types/sales';
import { getChannelLabel } from '@/constants/saleOrder';
import { formatBRL } from '@/utils/formatters';
import Card from '@/components/ui/Card.vue';

/**
 * Etapa 5 of the QR-code stock-exit evolution (see
 * docs/architecture/qrcode-stock-exit-evolution.md): compares revenue
 * between the virtual (e-commerce/WhatsApp) and loja_fisica (PDV)
 * channels. Only two categories, so a simple progress-bar list (same
 * pattern as RegionBreakdownCard.vue) reads better here than another donut
 * chart -- and it avoids pulling the ~500kB apexcharts bundle in for a
 * binary comparison.
 */
const props = defineProps<{
  byChannel: ChannelBreakdown[];
  isLoading: boolean;
}>();

const maxRevenue = computed(() =>
  props.byChannel.reduce((max, row) => Math.max(max, Number(row.revenue_total)), 0)
);

const progressFor = (revenue: string): number => {
  if (!maxRevenue.value) {
    return 0;
  }

  return Math.max(6, Math.round((Number(revenue) / maxRevenue.value) * 100));
};
</script>

<template>
  <Card aria-label="Vendas por canal: loja fisica ou virtual">
    <div class="flex items-center justify-between gap-4">
      <div>
        <p class="text-[10px] font-black uppercase tracking-[0.4em] text-bip-muted">Por onde vendem</p>
        <h3 class="mt-2 text-lg font-black italic tracking-tighter text-[#05050A]">Canal de venda</h3>
      </div>
      <QrCodeIcon class="h-6 w-6 text-[#D81B60]" />
    </div>

    <div class="mt-6 space-y-4">
      <template v-if="isLoading">
        <span class="sr-only">Carregando vendas por canal</span>
        <div v-for="i in 2" :key="i" class="h-12 animate-pulse rounded-2xl bg-zinc-100" />
      </template>

      <template v-else-if="byChannel.length === 0">
        <p class="text-sm text-bip-muted">Nenhuma venda registrada neste periodo.</p>
      </template>

      <ol v-else class="space-y-4">
        <li
          v-for="row in byChannel"
          :key="row.channel"
          :aria-label="`${getChannelLabel(row.channel)}: ${row.orders_count} pedidos, ${formatBRL(row.revenue_total)}`"
        >
          <div class="flex items-baseline justify-between gap-2">
            <p class="truncate text-sm font-bold text-[#05050A]">{{ getChannelLabel(row.channel) }}</p>
            <p class="shrink-0 text-sm font-black text-[#D81B60]">{{ formatBRL(row.revenue_total) }}</p>
          </div>
          <div class="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
            <div
              class="h-full rounded-full bg-gradient-to-r from-[#D81B60] to-[#F472B6]"
              :style="{ width: progressFor(row.revenue_total) + '%' }"
            />
          </div>
          <p class="mt-1 text-[11px] font-bold uppercase tracking-wider text-bip-muted">
            {{ row.orders_count }} pedido<span v-if="row.orders_count !== 1">s</span>
          </p>
        </li>
      </ol>
    </div>
  </Card>
</template>
