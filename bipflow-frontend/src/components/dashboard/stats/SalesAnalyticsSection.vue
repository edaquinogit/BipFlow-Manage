<script setup lang="ts">
import PeriodSwitcher from './PeriodSwitcher.vue';
import RevenueTrendCard from './RevenueTrendCard.vue';
import TopProductsCard from './TopProductsCard.vue';
import PaymentBreakdownCard from './PaymentBreakdownCard.vue';
import type { SaleOrderBreakdown, SaleOrderTimeseriesPoint } from '@/types/sales';

const PERIOD_OPTIONS = [
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
];

defineProps<{
  period: string;
  points: SaleOrderTimeseriesPoint[];
  breakdown: SaleOrderBreakdown | null;
  ordersCount: number;
  averageTicket: string;
  isLoading: boolean;
}>();

const emit = defineEmits<{
  (event: 'update:period', value: string): void;
}>();
</script>

<template>
  <section>
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p class="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500">Analise de vendas</p>
        <h2 class="mt-1 text-xl font-black italic tracking-tighter text-white">Performance da loja</h2>
      </div>
      <PeriodSwitcher
        :model-value="period"
        :options="PERIOD_OPTIONS"
        @update:model-value="emit('update:period', $event)"
      />
    </div>

    <div class="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div class="lg:col-span-2">
        <RevenueTrendCard
          :points="points"
          :orders-count="ordersCount"
          :average-ticket="averageTicket"
          :is-loading="isLoading"
        />
      </div>

      <div class="flex flex-col gap-6">
        <TopProductsCard :products="breakdown?.top_products ?? []" :is-loading="isLoading" />
        <PaymentBreakdownCard
          :by-payment-method="breakdown?.by_payment_method ?? []"
          :by-status="breakdown?.by_status ?? []"
          :is-loading="isLoading"
        />
      </div>
    </div>
  </section>
</template>
