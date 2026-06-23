<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { ClockIcon, MagnifyingGlassIcon } from '@heroicons/vue/24/outline';
import { useAsyncResource } from '@/composables/useAsyncResource';
import { useCurrentStore } from '@/composables/useCurrentStore';
import { useCurrentUser } from '@/composables/useCurrentUser';
import { useToast } from '@/composables/useToast';
import {
  getDeliveryMethodLabel,
  getPaymentLabel,
  getSaleStatusLabel,
  SALE_STATUS_OPTIONS,
  SALE_TIMELINE_STEPS,
} from '@/constants/saleOrder';
import type {
  PaginatedSalesOrdersResponse,
  SaleOrder,
  SaleOrderFilters,
  SaleOrderStatus,
} from '@/types/sales';
import { Logger } from '@/services/logger';
import { salesService } from '@/services/sales.service';
import { useDebounceFn } from '@/utils/debounce';
import { formatBRL } from '@/utils/formatters';

const { selectedStore } = useCurrentStore();
const { canManageCatalog } = useCurrentUser();
const { success, error: toastError } = useToast();

const { data: salesHistory, isLoading: isSalesLoading, error: salesError, run: runSalesHistory } = (
  useAsyncResource<PaginatedSalesOrdersResponse>()
);
const recentSales = computed(() => salesHistory.value?.results ?? []);
const updatingSaleOrderId = ref<number | null>(null);

const salesSearchTerm = ref('');
const salesStatusFilter = ref<'all' | SaleOrderStatus>('all');
const saleStatusOptions = SALE_STATUS_OPTIONS;
const saleTimelineSteps = SALE_TIMELINE_STEPS;

const hasActiveSalesFilters = computed(() => (
  salesSearchTerm.value.trim() !== '' || salesStatusFilter.value !== 'all'
));

function buildSalesFilters(): Omit<SaleOrderFilters, 'pageSize'> {
  return {
    search: salesSearchTerm.value.trim() || undefined,
    status: salesStatusFilter.value === 'all' ? undefined : salesStatusFilter.value,
  };
}

const fetchSalesHistory = (filters: SaleOrderFilters = {}): Promise<void> => (
  runSalesHistory(
    () => salesService.list({ pageSize: 20, ...filters }),
    'Nao foi possivel carregar o historico agora.'
  )
);

const [emitSalesFiltersDebounced, cancelSalesFiltersDebounce] = useDebounceFn(() => {
  void fetchSalesHistory(buildSalesFilters());
}, 320);

watch(salesSearchTerm, () => {
  emitSalesFiltersDebounced();
});

watch(salesStatusFilter, () => {
  cancelSalesFiltersDebounce();
  void fetchSalesHistory(buildSalesFilters());
});

watch(selectedStore, () => {
  void fetchSalesHistory(buildSalesFilters());
});

onBeforeUnmount(() => {
  cancelSalesFiltersDebounce();
});

const handleUpdateSaleStatus = async (orderId: number, nextStatus: SaleOrderStatus): Promise<void> => {
  updatingSaleOrderId.value = orderId;

  try {
    const updatedOrder = await salesService.updateStatus(orderId, nextStatus);
    if (salesHistory.value) {
      salesHistory.value = {
        ...salesHistory.value,
        results: salesHistory.value.results.map((sale) => (
          sale.id === updatedOrder.id ? updatedOrder : sale
        )),
      };
    }
    success('Status do pedido atualizado.');
  } catch (error: unknown) {
    Logger.error('Sale order status update failed', { error, orderId, nextStatus });
    toastError('Nao foi possivel atualizar o pedido.');
  } finally {
    updatingSaleOrderId.value = null;
  }
};

function formatSaleDate(dateString: string): string {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return 'Data indisponivel';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getSaleStatusClass(status: SaleOrderStatus): string {
  const classes: Record<SaleOrderStatus, string> = {
    prepared: 'border-amber-400/20 bg-amber-400/10 text-amber-100',
    sent: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100',
    cancelled: 'border-rose-400/20 bg-rose-400/10 text-rose-100',
  };

  return classes[status];
}

function getSaleTimelineStepClass(
  currentStatus: SaleOrderStatus,
  stepStatus: Exclude<SaleOrderStatus, 'cancelled'>
): string {
  if (currentStatus === 'sent') {
    return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100';
  }

  if (currentStatus === stepStatus) {
    return 'border-amber-400/20 bg-amber-400/10 text-amber-100';
  }

  return 'border-white/10 bg-zinc-950 text-zinc-500';
}

function handleSaleStatusChange(sale: SaleOrder, event: Event): void {
  const nextStatus = (event.target as HTMLSelectElement).value as SaleOrderStatus;

  if (nextStatus === sale.status) {
    return;
  }

  void handleUpdateSaleStatus(sale.id, nextStatus);
}

onMounted(() => {
  void fetchSalesHistory();
});
</script>

<template>
  <div>
    <div class="flex items-center justify-between gap-4">
      <div>
        <p class="text-[10px] font-black uppercase tracking-[0.22em] text-zinc-500">Vendas</p>
        <h1 class="mt-1 text-xl font-black italic tracking-tighter text-white">Pedidos</h1>
      </div>
    </div>

    <div class="mt-6 grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px]">
      <label class="relative block">
        <span class="sr-only">Buscar pedido</span>
        <MagnifyingGlassIcon class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <input
          v-model="salesSearchTerm"
          type="search"
          class="h-11 w-full rounded-lg border border-zinc-800 bg-zinc-950 pl-10 pr-3 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
          placeholder="Cliente, telefone ou referencia"
        />
      </label>

      <label class="block">
        <span class="sr-only">Filtrar por status</span>
        <select
          v-model="salesStatusFilter"
          class="h-11 w-full appearance-none rounded-lg border border-zinc-800 bg-zinc-950 px-3 text-sm text-white outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20"
        >
          <option value="all">Todos status</option>
          <option v-for="option in saleStatusOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>
    </div>

    <div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <div v-if="isSalesLoading" class="rounded-lg border border-white/10 bg-white/[0.03] p-4 sm:col-span-2 xl:col-span-3">
        <div class="h-4 w-32 animate-pulse rounded bg-zinc-800" />
        <div class="mt-3 h-3 w-48 animate-pulse rounded bg-zinc-800" />
      </div>

      <div v-else-if="salesError" class="rounded-lg border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200 sm:col-span-2 xl:col-span-3">
        {{ salesError }}
      </div>

      <div v-else-if="recentSales.length === 0" class="rounded-lg border border-white/10 bg-white/[0.03] p-4 sm:col-span-2 xl:col-span-3">
        <p class="text-sm font-semibold text-white">
          {{ hasActiveSalesFilters ? 'Nenhum pedido encontrado.' : 'Nenhuma venda registrada ainda.' }}
        </p>
        <p class="mt-1 text-xs leading-5 text-zinc-500">
          {{
            hasActiveSalesFilters
              ? 'Ajuste a busca ou o filtro de status.'
              : 'Os pedidos finalizados pela vitrine aparecem aqui automaticamente.'
          }}
        </p>
      </div>

      <template v-else>
        <article
          v-for="sale in recentSales"
          :key="sale.id"
          class="rounded-lg border border-white/10 bg-white/[0.03] p-4"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <p class="truncate text-sm font-bold text-white">{{ sale.customer_name }}</p>
              <p class="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
                <ClockIcon class="h-3.5 w-3.5" />
                {{ formatSaleDate(sale.created_at) }} - {{ getPaymentLabel(sale.payment_method) }}
              </p>
            </div>
            <p class="shrink-0 text-sm font-black text-emerald-300">
              {{ formatBRL(sale.total) }}
            </p>
          </div>

          <p class="mt-3 text-xs text-zinc-500">
            {{ sale.item_count }} item<span v-if="sale.item_count !== 1">s</span> - {{ sale.order_reference }}
          </p>

          <div class="mt-3 flex flex-wrap gap-2 text-[11px] font-bold text-zinc-400">
            <span class="rounded-full border border-white/10 bg-zinc-950 px-2.5 py-1">
              {{ getDeliveryMethodLabel(sale.delivery_method) }}
            </span>
            <span
              v-if="sale.delivery_region_name"
              class="max-w-full truncate rounded-full border border-white/10 bg-zinc-950 px-2.5 py-1"
            >
              {{ sale.delivery_region_name }}
            </span>
          </div>

          <div class="mt-4 rounded-lg border border-white/10 bg-zinc-950/70 p-3">
            <div
              v-if="sale.status === 'cancelled'"
              class="flex items-center gap-2 rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs font-black uppercase tracking-widest text-rose-100"
            >
              <span class="h-2 w-2 rounded-full bg-rose-300" />
              Pedido cancelado
            </div>

            <div v-else class="grid grid-cols-2 gap-2">
              <div
                v-for="step in saleTimelineSteps"
                :key="step.value"
                class="flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-[10px] font-black uppercase tracking-widest"
                :class="getSaleTimelineStepClass(sale.status, step.value)"
              >
                <span
                  class="h-2 w-2 rounded-full"
                  :class="sale.status === 'sent' || sale.status === step.value ? 'bg-current' : 'bg-zinc-700'"
                />
                {{ step.label }}
              </div>
            </div>
          </div>

          <div class="mt-4 flex items-center justify-between gap-3">
            <span
              class="rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest"
              :class="getSaleStatusClass(sale.status)"
            >
              {{ getSaleStatusLabel(sale.status) }}
            </span>
            <label v-if="canManageCatalog" class="min-w-[148px]">
              <span class="sr-only">Atualizar status do pedido {{ sale.order_reference }}</span>
              <select
                :value="sale.status"
                :disabled="updatingSaleOrderId === sale.id"
                class="h-9 w-full rounded-lg border border-white/10 bg-zinc-950 px-2 text-xs font-bold text-zinc-100 outline-none transition focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                @change="handleSaleStatusChange(sale, $event)"
              >
                <option v-for="option in saleStatusOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </option>
              </select>
            </label>
          </div>
        </article>
      </template>
    </div>
  </div>
</template>
