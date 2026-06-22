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
  isLoading: boolean;
}>();

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
  theme: { mode: 'dark' as const },
  colors: ['#fb7185'],
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
    borderColor: 'rgba(255,255,255,0.06)',
    strokeDashArray: 4,
    yaxis: { lines: { show: false } },
    padding: { left: 8, right: 8 },
  },
  xaxis: {
    categories: categories.value,
    axisBorder: { show: false },
    axisTicks: { show: false },
    labels: {
      style: { colors: '#71717a', fontSize: '10px', fontWeight: 700 },
    },
  },
  yaxis: { show: false },
  tooltip: {
    theme: 'dark' as const,
    y: { formatter: (value: number) => formatBRL(value) },
  },
}));
</script>

<template>
  <div class="relative overflow-hidden rounded-[2.5rem] border border-white/5 bg-zinc-900/40 p-8 backdrop-blur-md">
    <div class="relative z-10 flex flex-wrap items-start justify-between gap-6">
      <div>
        <p class="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500">Evolucao de vendas</p>
        <h3 class="mt-2 text-2xl font-black italic tracking-tighter text-white">Receita no periodo</h3>
      </div>

      <div class="flex items-center gap-4 text-right">
        <div>
          <p class="text-[10px] font-black uppercase tracking-widest text-zinc-500">Pedidos</p>
          <p class="text-xl font-black text-white">{{ ordersCount }}</p>
        </div>
        <div class="h-8 w-px bg-white/10" />
        <div>
          <p class="text-[10px] font-black uppercase tracking-widest text-zinc-500">Ticket medio</p>
          <p class="text-xl font-black text-white">{{ formatBRL(averageTicket) }}</p>
        </div>
      </div>
    </div>

    <div class="relative z-10 mt-8">
      <div v-if="isLoading" class="h-64 animate-pulse rounded-2xl bg-zinc-800/40" />
      <div
        v-else-if="points.length === 0"
        class="flex h-64 items-center justify-center text-sm text-zinc-500"
      >
        Nenhuma venda registrada neste periodo.
      </div>
      <VueApexCharts v-else type="area" height="260" :options="chartOptions" :series="series" />
    </div>

    <ArrowTrendingUpIcon class="absolute -right-6 -bottom-6 h-32 w-32 text-rose-500/5" />
  </div>
</template>
