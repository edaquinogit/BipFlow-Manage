<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { ArrowDownTrayIcon, ArrowPathIcon } from '@heroicons/vue/24/outline';
import PeriodSwitcher from './PeriodSwitcher.vue';
import RevenueTrendCard from './RevenueTrendCard.vue';
import TopProductsCard from './TopProductsCard.vue';
import PaymentBreakdownCard from './PaymentBreakdownCard.vue';
import RegionBreakdownCard from './RegionBreakdownCard.vue';
import CustomerInsightsCard from './CustomerInsightsCard.vue';
import type {
  SaleOrderBreakdown,
  SaleOrderCustomerInsights,
  SaleOrderDateRange,
  SaleOrderTimeseriesPoint,
} from '@/types/sales';

const PERIOD_OPTIONS = [
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
  { value: 'custom', label: 'Personalizado' },
];

const props = defineProps<{
  period: string;
  points: SaleOrderTimeseriesPoint[];
  breakdown: SaleOrderBreakdown | null;
  customerInsights: SaleOrderCustomerInsights | null;
  ordersCount: number;
  averageTicket: string;
  comparisonSamePeriodLastYear?: string | null;
  customRange?: SaleOrderDateRange | null;
  isLoading: boolean;
  error?: string | null;
  updatedAt?: Date | null;
}>();

const emit = defineEmits<{
  (event: 'update:period', value: string): void;
  (event: 'update:custom-range', value: SaleOrderDateRange): void;
  (event: 'refresh'): void;
  (event: 'export'): void;
}>();

const customStart = ref(props.customRange?.start ?? '');
const customEnd = ref(props.customRange?.end ?? '');

watch(
  () => props.customRange,
  (range) => {
    customStart.value = range?.start ?? '';
    customEnd.value = range?.end ?? '';
  }
);

const isCustomRangeInvalid = computed(
  () => Boolean(customStart.value) && Boolean(customEnd.value) && customStart.value > customEnd.value
);

const emitCustomRangeIfValid = (): void => {
  if (customStart.value && customEnd.value && customStart.value <= customEnd.value) {
    emit('update:custom-range', { start: customStart.value, end: customEnd.value });
  }
};

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
        <button
          type="button"
          class="flex items-center gap-1.5 rounded-full border border-white/10 bg-zinc-950 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-zinc-400 transition-colors hover:text-white"
          @click="emit('export')"
        >
          <ArrowDownTrayIcon class="h-3.5 w-3.5" />
          CSV
        </button>
      </div>
    </div>

    <div v-if="period === 'custom'" class="mt-4">
      <div class="flex flex-wrap items-end gap-3">
        <label class="text-xs">
          <span class="mb-1 block text-[10px] font-black uppercase tracking-widest text-zinc-500">De</span>
          <input
            v-model="customStart"
            type="date"
            :max="customEnd || undefined"
            class="h-10 rounded-lg border border-white/10 bg-zinc-950 px-3 text-sm text-white outline-none focus:border-rose-500"
            @change="emitCustomRangeIfValid"
          />
        </label>
        <label class="text-xs">
          <span class="mb-1 block text-[10px] font-black uppercase tracking-widest text-zinc-500">Ate</span>
          <input
            v-model="customEnd"
            type="date"
            :min="customStart || undefined"
            class="h-10 rounded-lg border border-white/10 bg-zinc-950 px-3 text-sm text-white outline-none focus:border-rose-500"
            @change="emitCustomRangeIfValid"
          />
        </label>
      </div>
      <p v-if="isCustomRangeInvalid" class="mt-2 text-xs font-bold text-rose-300">
        A data final deve ser igual ou posterior a data inicial.
      </p>
      <p v-else-if="!customRange" class="mt-2 text-xs font-bold text-zinc-500">
        Selecione as duas datas para atualizar a analise.
      </p>
    </div>

    <div
      v-if="error"
      role="alert"
      class="mt-4 rounded-lg border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200"
    >
      {{ error }}
    </div>

    <div class="mt-6">
      <RevenueTrendCard
        :points="points"
        :orders-count="ordersCount"
        :average-ticket="averageTicket"
        :comparison-same-period-last-year="comparisonSamePeriodLastYear"
        :is-loading="isLoading"
      />
    </div>

    <div class="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
      <TopProductsCard :products="breakdown?.top_products ?? []" :is-loading="isLoading" />
      <PaymentBreakdownCard
        :by-payment-method="breakdown?.by_payment_method ?? []"
        :by-status="breakdown?.by_status ?? []"
        :is-loading="isLoading"
      />
      <RegionBreakdownCard :regions="breakdown?.by_region ?? []" :is-loading="isLoading" />
      <CustomerInsightsCard :insights="customerInsights" :is-loading="isLoading" />
    </div>
  </section>
</template>
