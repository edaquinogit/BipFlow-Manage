<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { ArrowPathIcon } from '@heroicons/vue/24/outline';
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

const props = defineProps<{
  period: string;
  points: SaleOrderTimeseriesPoint[];
  breakdown: SaleOrderBreakdown | null;
  ordersCount: number;
  averageTicket: string;
  isLoading: boolean;
  error?: string | null;
  updatedAt?: Date | null;
}>();

const emit = defineEmits<{
  (event: 'update:period', value: string): void;
  (event: 'refresh'): void;
}>();

const now = ref(Date.now());
let tickHandle: ReturnType<typeof setInterval> | undefined;

onMounted(() => {
  tickHandle = setInterval(() => {
    now.value = Date.now();
  }, 30_000);
});

onBeforeUnmount(() => {
  if (tickHandle) {
    clearInterval(tickHandle);
  }
});

const updatedAtLabel = computed(() => {
  if (!props.updatedAt) {
    return null;
  }

  const elapsedSeconds = Math.max(0, Math.floor((now.value - props.updatedAt.getTime()) / 1000));
  if (elapsedSeconds < 60) {
    return 'Atualizado agora';
  }

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) {
    return `Atualizado ha ${elapsedMinutes} min`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  return `Atualizado ha ${elapsedHours}h`;
});
</script>

<template>
  <section aria-label="Analise de vendas da loja">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p class="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500">Analise de vendas</p>
        <h2 class="mt-1 text-xl font-black italic tracking-tighter text-white">Performance da loja</h2>
      </div>

      <div class="flex items-center gap-3">
        <span v-if="updatedAtLabel" class="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
          {{ updatedAtLabel }}
        </span>
        <button
          type="button"
          aria-label="Atualizar analise de vendas"
          class="rounded-full border border-white/10 bg-zinc-950 p-2 text-zinc-400 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="isLoading"
          @click="emit('refresh')"
        >
          <ArrowPathIcon class="h-4 w-4" :class="{ 'animate-spin': isLoading }" />
        </button>
        <PeriodSwitcher
          :model-value="period"
          :options="PERIOD_OPTIONS"
          @update:model-value="emit('update:period', $event)"
        />
      </div>
    </div>

    <div
      v-if="error"
      role="alert"
      class="mt-4 rounded-lg border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200"
    >
      {{ error }}
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
