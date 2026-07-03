<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';
import { ArrowTrendingUpIcon } from '@heroicons/vue/24/outline';
import type { SaleOrderTimeseriesPoint } from '@/types/sales';
import { formatBRL } from '@/utils/formatters';
import Card from '@/components/ui/Card.vue';

const props = defineProps<{
  points: SaleOrderTimeseriesPoint[];
  ordersCount: number;
  averageTicket: string;
  comparisonSamePeriodLastYear?: string | null;
  isLoading: boolean;
}>();

// Deferred: keeps the ~500kB apexcharts bundle off this route's initial
// paint, since the chart only renders after data has loaded anyway.
const VueApexCharts = defineAsyncComponent(() => import('vue3-apexcharts'));

const hasYoyComparison = computed(
  () => props.comparisonSamePeriodLastYear !== null && props.comparisonSamePeriodLastYear !== undefined
);
const isPositiveYoyComparison = computed(() => Number(props.comparisonSamePeriodLastYear ?? 0) >= 0);

const dailyTicketAverages = computed(() =>
  props.points.map((point) => (point.orders_count ? Number(point.revenue) / point.orders_count : 0))
);

const ticketMovingAverage = computed(() => {
  const windowSize = 7;
  const slice = dailyTicketAverages.value.slice(-windowSize);
  if (!slice.length) {
    return 0;
  }

  const sum = slice.reduce((total, dailyAverage) => total + dailyAverage, 0);
  return Number((sum / slice.length).toFixed(2));
});

const series = computed(() => [
  {
    name: 'Receita',
    data: props.points.map((point) => Number(point.revenue)),
  },
]);

const categories = computed(() =>
  props.points.map((point) => {
    const [, month, day] = point.date.split('-');
    return `${day}/${month}`;
  })
);

const chartOptions = computed(() => ({
  chart: {
    toolbar: { show: false },
    zoom: { enabled: false },
    background: 'transparent',
    fontFamily: 'inherit',
  },
  theme: { mode: 'light' as const },
  colors: ['#D81B60'],
  dataLabels: { enabled: false },
  stroke: { curve: 'smooth' as const, width: 3 },
  fill: {
    type: 'gradient',
    gradient: {
      shadeIntensity: 1,
      opacityFrom: 0.45,
      opacityTo: 0,
      stops: [0, 90, 100],
    },
  },
  grid: {
    borderColor: '#F3F4F6',
    strokeDashArray: 4,
    yaxis: { lines: { show: false } },
    padding: { left: 8, right: 8 },
  },
  xaxis: {
    categories: categories.value,
    axisBorder: { show: false },
    axisTicks: { show: false },
    labels: {
      style: { colors: '#6B7280', fontSize: '10px', fontWeight: 700 },
    },
  },
  yaxis: { show: false },
  tooltip: {
    theme: 'light' as const,
    y: { formatter: (value: number) => formatBRL(value) },
  },
}));
</script>

<template>
  <Card aria-label="Receita no periodo" overflow-hidden>
    <div class="relative z-10 grid gap-4 md:flex md:items-center md:justify-between">
      <div>
        <p class="text-[10px] font-black uppercase tracking-[0.4em] text-bip-muted">Evolucao de vendas</p>
        <h3 class="mt-2 text-2xl font-black italic tracking-tighter text-[#05050A]">Receita no periodo</h3>
      </div>

      <div class="grid gap-4 sm:grid-flow-col sm:grid-cols-3 sm:text-right">
        <div class="min-w-[120px]">
          <p class="text-[10px] font-black uppercase tracking-widest text-bip-muted">Pedidos</p>
          <p class="text-xl font-black text-[#05050A]">{{ ordersCount }}</p>
        </div>
        <div class="min-w-[120px]">
          <p class="text-[10px] font-black uppercase tracking-widest text-bip-muted">Ticket medio</p>
          <p class="text-xl font-black text-[#05050A]">{{ formatBRL(averageTicket) }}</p>
        </div>
        <div class="min-w-[120px]">
          <p class="text-[10px] font-black uppercase tracking-widest text-bip-muted">Ticket medio 7D</p>
          <p class="text-xl font-black text-[#05050A]">{{ formatBRL(ticketMovingAverage.toFixed(2)) }}</p>
        </div>
        <template v-if="hasYoyComparison" class="sm:col-span-3">
          <div class="h-8 w-px bg-[#E5E7EB] md:mx-auto" />
          <div class="min-w-[120px]">
            <p class="text-[10px] font-black uppercase tracking-widest text-bip-muted">Vs ano anterior</p>
            <p
              class="text-xl font-black"
              :class="isPositiveYoyComparison ? 'text-emerald-600' : 'text-[#D81B60]'"
            >
              {{ isPositiveYoyComparison ? '▲' : '▼' }} {{ Math.abs(Number(comparisonSamePeriodLastYear ?? 0)).toFixed(1) }}%
            </p>
          </div>
        </template>
      </div>
    </div>

    <div class="relative z-10 mt-6">
      <div v-if="isLoading" aria-live="polite" class="h-56 sm:h-64 animate-pulse rounded-2xl bg-zinc-100">
        <span class="sr-only">Carregando grafico de receita</span>
      </div>
      <div
        v-else-if="points.length === 0"
        class="flex h-64 items-center justify-center text-sm text-bip-muted"
      >
        Nenhuma venda registrada neste periodo.
      </div>
      <div v-else role="img" :aria-label="`Grafico de receita diaria, total de ${ordersCount} pedidos no periodo`">
        <VueApexCharts type="area" height="260" :options="chartOptions" :series="series" />
      </div>
    </div>

    <ArrowTrendingUpIcon class="absolute -right-6 -bottom-6 h-32 w-32 text-[#D81B60]/5" />
  </Card>
</template>
