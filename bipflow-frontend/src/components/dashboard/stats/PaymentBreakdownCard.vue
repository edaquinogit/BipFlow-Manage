<script setup lang="ts">
import { computed } from 'vue';
import VueApexCharts from 'vue3-apexcharts';
import { CreditCardIcon } from '@heroicons/vue/24/outline';
import type { PaymentMethodBreakdown, SaleOrderStatus, StatusBreakdown } from '@/types/sales';
import { formatBRL } from '@/utils/formatters';

const props = defineProps<{
  byPaymentMethod: PaymentMethodBreakdown[];
  byStatus: StatusBreakdown[];
  isLoading: boolean;
}>();

const PAYMENT_LABELS: Record<PaymentMethodBreakdown['payment_method'], string> = {
  pix: 'Pix',
  card: 'Cartao',
  cash: 'Dinheiro',
};

const STATUS_LABELS: Record<SaleOrderStatus, string> = {
  prepared: 'Novo',
  sent: 'Enviado',
  cancelled: 'Cancelado',
};

const STATUS_BADGE_CLASS: Record<SaleOrderStatus, string> = {
  prepared: 'border-amber-400/20 bg-amber-400/10 text-amber-100',
  sent: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100',
  cancelled: 'border-rose-400/20 bg-rose-400/10 text-rose-100',
};

const series = computed(() => props.byPaymentMethod.map((row) => Number(row.revenue_total)));
const labels = computed(() =>
  props.byPaymentMethod.map((row) => PAYMENT_LABELS[row.payment_method] ?? row.payment_method)
);

const chartOptions = computed(() => ({
  chart: { background: 'transparent', fontFamily: 'inherit' },
  theme: { mode: 'dark' as const },
  labels: labels.value,
  colors: ['#fb7185', '#f59e0b', '#34d399', '#818cf8'],
  legend: {
    position: 'bottom' as const,
    labels: { colors: '#a1a1aa' },
    fontSize: '11px',
    fontWeight: 700,
  },
  dataLabels: {
    enabled: true,
    formatter: (value: number) => `${value.toFixed(0)}%`,
  },
  stroke: { show: false, colors: ['transparent'] },
  plotOptions: {
    pie: {
      donut: {
        size: '70%',
        labels: {
          show: true,
          total: {
            show: true,
            label: 'Total',
            color: '#a1a1aa',
            formatter: (chart: { globals: { seriesTotals: number[] } }) =>
              formatBRL(chart.globals.seriesTotals.reduce((sum, value) => sum + value, 0)),
          },
        },
      },
    },
  },
  tooltip: {
    theme: 'dark' as const,
    y: { formatter: (value: number) => formatBRL(value) },
  },
}));
</script>

<template>
  <section aria-label="Formas de pagamento e status dos pedidos" class="rounded-[2.5rem] border border-white/5 bg-zinc-900/40 p-8 backdrop-blur-md">
    <div class="flex items-center justify-between gap-4">
      <div>
        <p class="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500">Formas de pagamento</p>
        <h3 class="mt-2 text-lg font-black italic tracking-tighter text-white">Como vendem</h3>
      </div>
      <CreditCardIcon class="h-6 w-6 text-rose-300/70" />
    </div>

    <div class="mt-6">
      <div v-if="isLoading" aria-live="polite" class="h-56 animate-pulse rounded-2xl bg-zinc-800/40">
        <span class="sr-only">Carregando formas de pagamento</span>
      </div>
      <p v-else-if="byPaymentMethod.length === 0" class="text-sm text-zinc-500">
        Nenhuma venda registrada neste periodo.
      </p>
      <div v-else role="img" aria-label="Grafico de rosca com a receita por forma de pagamento">
        <VueApexCharts type="donut" height="230" :options="chartOptions" :series="series" />
      </div>
    </div>

    <div v-if="byStatus.length > 0" class="mt-6 flex flex-wrap gap-2">
      <span
        v-for="row in byStatus"
        :key="row.status"
        class="rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest"
        :class="STATUS_BADGE_CLASS[row.status] ?? 'border-white/10 bg-white/5 text-zinc-300'"
      >
        {{ STATUS_LABELS[row.status] ?? row.status }}: {{ row.orders_count }}
      </span>
    </div>
  </section>
</template>
