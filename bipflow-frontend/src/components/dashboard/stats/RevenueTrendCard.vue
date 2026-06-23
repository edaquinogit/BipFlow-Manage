<script setup lang="ts">
import { computed } from 'vue';
import VueApexCharts from 'vue3-apexcharts';
import { ArrowTrendingUpIcon } from '@heroicons/vue/24/outline';
import type { SaleOrderTimeseriesPoint } from '@/types/sales';
import { formatBRL } from '@/utils/formatters';

const props = defineProps<{
  points: SaleOrderTimeseriesPoint[];
  ordersCount: number;
  averageTicket: string;
  comparisonSamePeriodLastYear?: string | null;
  isLoading: boolean;
}>();

const hasYoyComparison = computed(
  () => props.comparisonSamePeriodLastYear !== null && props.comparisonSamePeriodLastYear !== undefined
);
const isPositiveYoyComparison = computed(() => Number(props.comparisonSamePeriodLastYear ?? 0) >= 0);

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
  <section
    aria-label="Receita no periodo"
    class="relative overflow-hidden rounded-[2.5rem] border border-[#E5E7EB] bg-white p-8 shadow-[0_14px_35px_-28px_rgba(5,5,10,0.55)]"
  >
    <div class="relative z-10 flex flex-wrap items-start justify-between gap-6">
      <div>
        <p class="text-[10px] font-black uppercase tracking-[0.4em] text-bip-muted">Evolucao de vendas</p>
        <h3 class="mt-2 text-2xl font-black italic tracking-tighter text-[#05050A]">Receita no periodo</h3>
      </div>

      <div class="flex items-center gap-4 text-right">
        <div>
          <p class="text-[10px] font-black uppercase tracking-widest text-bip-muted">Pedidos</p>
          <p class="text-xl font-black text-[#05050A]">{{ ordersCount }}</p>
        </div>
        <div class="h-8 w-px bg-[#E5E7EB]" />
        <div>
          <p class="text-[10px] font-black uppercase tracking-widest text-bip-muted">Ticket medio</p>
          <p class="text-xl font-black text-[#05050A]">{{ formatBRL(averageTicket) }}</p>
        </div>
        <template v-if="hasYoyComparison">
          <div class="h-8 w-px bg-[#E5E7EB]" />
          <div>
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

    <div class="relative z-10 mt-8">
      <div v-if="isLoading" aria-live="polite" class="h-64 animate-pulse rounded-2xl bg-zinc-100">
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
  </section>
</template>
