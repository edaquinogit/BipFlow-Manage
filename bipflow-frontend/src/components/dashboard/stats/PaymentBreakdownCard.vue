<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue';
import { CreditCardIcon } from '@heroicons/vue/24/outline';
import type { PaymentMethodBreakdown, SaleOrderStatus, StatusBreakdown } from '@/types/sales';
import { formatBRL } from '@/utils/formatters';
import Card from '@/components/ui/Card.vue';

const props = defineProps<{
  byPaymentMethod: PaymentMethodBreakdown[];
  byStatus: StatusBreakdown[];
  isLoading: boolean;
}>();

// Deferred: keeps the ~500kB apexcharts bundle off this route's initial
// paint, since the donut only renders after data has loaded anyway.
const VueApexCharts = defineAsyncComponent(() => import('vue3-apexcharts'));

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
  prepared: 'border-amber-200 bg-amber-50 text-amber-800',
  sent: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  cancelled: 'border-[#D81B60]/20 bg-[#FCE7F3] text-[#7A143D]',
};

const series = computed(() => props.byPaymentMethod.map((row) => Number(row.revenue_total)));
const labels = computed(() =>
  props.byPaymentMethod.map((row) => PAYMENT_LABELS[row.payment_method] ?? row.payment_method)
);

const chartOptions = computed(() => ({
  chart: { background: 'transparent', fontFamily: 'inherit' },
  theme: { mode: 'light' as const },
  labels: labels.value,
  colors: ['#D81B60', '#f59e0b', '#34d399', '#818cf8'],
  legend: {
    position: 'bottom' as const,
    labels: { colors: '#6B7280' },
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
            color: '#6B7280',
            formatter: (chart: { globals: { seriesTotals: number[] } }) =>
              formatBRL(chart.globals.seriesTotals.reduce((sum, value) => sum + value, 0)),
          },
        },
      },
    },
  },
  tooltip: {
    theme: 'light' as const,
    y: { formatter: (value: number) => formatBRL(value) },
  },
}));
</script>

<template>
  <Card aria-label="Formas de pagamento e status dos pedidos">
    <div class="flex items-center justify-between gap-4">
      <div>
        <p class="text-[10px] font-black uppercase tracking-[0.4em] text-bip-muted">Formas de pagamento</p>
        <h3 class="mt-2 text-lg font-black italic tracking-tighter text-[#05050A]">Como vendem</h3>
      </div>
      <CreditCardIcon class="h-6 w-6 text-[#D81B60]" />
    </div>

    <div class="mt-6">
      <div v-if="isLoading" aria-live="polite" class="h-56 animate-pulse rounded-2xl bg-zinc-100">
        <span class="sr-only">Carregando formas de pagamento</span>
      </div>
      <p v-else-if="byPaymentMethod.length === 0" class="text-sm text-bip-muted">
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
        :class="STATUS_BADGE_CLASS[row.status] ?? 'border-[#E5E7EB] bg-zinc-50 text-[#05050A]'"
      >
        {{ STATUS_LABELS[row.status] ?? row.status }}: {{ row.orders_count }}
      </span>
    </div>
  </Card>
</template>
