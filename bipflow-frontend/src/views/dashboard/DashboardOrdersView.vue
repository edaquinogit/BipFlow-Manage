<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { ClockIcon, MagnifyingGlassIcon } from '@heroicons/vue/24/outline';
import { useAsyncResource } from '@/composables/useAsyncResource';
import { useStoreSwitchEffect } from '@/composables/useStoreSwitchEffect';
import { useCurrentUser } from '@/composables/useCurrentUser';
import { useToast } from '@/composables/useToast';
import {
  getChannelLabel,
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
import ConfirmModal from '@/components/dashboard/layout/ConfirmModal.vue';

const { canManageCatalog } = useCurrentUser();
const { success, error: toastError } = useToast();

const { data: salesHistory, isLoading: isSalesLoading, error: salesError, run: runSalesHistory } = (
  useAsyncResource<PaginatedSalesOrdersResponse>()
);
const recentSales = computed(() => salesHistory.value?.results ?? []);
const updatingSaleOrderId = ref<number | null>(null);

// Etapa R2 of the QR-code stock-exit refinement (see
// docs/architecture/qrcode-stock-exit-refinement.md): cancelling now
// restocks every item automatically (bipdelivery/api/stock.py's
// apply_order_cancellation()) -- a real, semi-irreversible side effect that
// didn't exist before, so it gets its own confirmation instead of firing
// immediately like every other status transition.
const orderPendingCancellation = ref<SaleOrder | null>(null);
const isCancelConfirmOpen = computed(() => orderPendingCancellation.value !== null);
const cancelConfirmMessage = computed(() => {
  const order = orderPendingCancellation.value;
  if (!order) {
    return '';
  }
  return `O pedido ${order.order_reference} sera cancelado e o estoque de ${order.item_count} item(ns) sera devolvido automaticamente. Essa acao nao pode ser desfeita.`;
});

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
    'Não foi possível carregar o histórico agora.'
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

useStoreSwitchEffect(() => {
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
    toastError('Não foi possível atualizar o pedido.');
  } finally {
    updatingSaleOrderId.value = null;
  }
};

function formatSaleDate(dateString: string): string {
  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return 'Data indisponível';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

const SALE_STATUS_BADGE_CLASS: Record<SaleOrderStatus, string> = {
  prepared: 'border-amber-200 bg-amber-50 text-amber-800',
  sent: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  cancelled: 'border-[#D81B60]/20 bg-[#FCE7F3] text-[#7A143D]',
};

function getSaleStatusClass(status: SaleOrderStatus): string {
  return SALE_STATUS_BADGE_CLASS[status];
}

function getSaleTimelineStepClass(
  currentStatus: SaleOrderStatus,
  stepStatus: Exclude<SaleOrderStatus, 'cancelled'>
): string {
  if (currentStatus === 'sent') {
    return SALE_STATUS_BADGE_CLASS.sent;
  }

  if (currentStatus === stepStatus) {
    return SALE_STATUS_BADGE_CLASS.prepared;
  }

  return 'border-[#E5E7EB] bg-zinc-50 text-bip-muted';
}

function handleSaleStatusChange(sale: SaleOrder, event: Event): void {
  const nextStatus = (event.target as HTMLSelectElement).value as SaleOrderStatus;

  if (nextStatus === sale.status) {
    return;
  }

  if (nextStatus === 'cancelled') {
    orderPendingCancellation.value = sale;
    return;
  }

  void handleUpdateSaleStatus(sale.id, nextStatus);
}

function closeCancelConfirm(): void {
  orderPendingCancellation.value = null;
}

async function confirmCancellation(): Promise<void> {
  const order = orderPendingCancellation.value;
  if (!order) {
    return;
  }

  await handleUpdateSaleStatus(order.id, 'cancelled');
  orderPendingCancellation.value = null;
}

onMounted(() => {
  void fetchSalesHistory();
});
</script>

<template>
  <div>
    <div class="flex items-center justify-between gap-4">
      <div>
        <p class="text-[10px] font-black uppercase tracking-[0.4em] text-bip-muted">Vendas</p>
        <h1 class="mt-1 text-xl font-black italic tracking-tighter text-[#05050A]">Pedidos</h1>
      </div>
    </div>

    <div class="mt-6 grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px]">
      <label class="relative block">
        <span class="sr-only">Buscar pedido</span>
        <MagnifyingGlassIcon class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-bip-muted" />
        <input
          v-model="salesSearchTerm"
          type="search"
          class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white pl-10 pr-3 text-sm text-[#05050A] outline-none transition placeholder:text-bip-muted/70 focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
          placeholder="Cliente, telefone ou referência"
        />
      </label>

      <label class="block">
        <span class="sr-only">Filtrar por status</span>
        <select
          v-model="salesStatusFilter"
          class="h-11 w-full appearance-none rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
        >
          <option value="all">Todos status</option>
          <option v-for="option in saleStatusOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>
    </div>

    <div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <div v-if="isSalesLoading" class="rounded-lg border border-[#E5E7EB] bg-white p-4 sm:col-span-2 xl:col-span-3">
        <div class="h-4 w-32 animate-pulse rounded bg-zinc-100" />
        <div class="mt-3 h-3 w-48 animate-pulse rounded bg-zinc-100" />
      </div>

      <div v-else-if="salesError" class="rounded-lg border border-[#D81B60]/20 bg-[#FCE7F3] p-4 text-sm text-[#7A143D] sm:col-span-2 xl:col-span-3">
        {{ salesError }}
      </div>

      <div v-else-if="recentSales.length === 0" class="rounded-lg border border-[#E5E7EB] bg-white p-4 sm:col-span-2 xl:col-span-3">
        <p class="text-sm font-semibold text-[#05050A]">
          {{ hasActiveSalesFilters ? 'Nenhum pedido encontrado.' : 'Nenhuma venda registrada ainda.' }}
        </p>
        <p class="mt-1 text-xs leading-5 text-bip-muted">
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
          class="rounded-lg border border-[#E5E7EB] bg-white p-4"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <p class="truncate text-sm font-bold text-[#05050A]">{{ sale.customer_name }}</p>
              <p class="mt-1 flex items-center gap-1.5 text-xs text-bip-muted">
                <ClockIcon class="h-3.5 w-3.5" />
                {{ formatSaleDate(sale.created_at) }} - {{ getPaymentLabel(sale.payment_method) }}
              </p>
            </div>
            <p class="shrink-0 text-sm font-black text-[#D81B60]">
              {{ formatBRL(sale.total) }}
            </p>
          </div>

          <p class="mt-3 text-xs text-bip-muted">
            {{ sale.item_count }} item<span v-if="sale.item_count !== 1">s</span> - {{ sale.order_reference }}
          </p>

          <div class="mt-3 flex flex-wrap gap-2 text-[11px] font-bold text-bip-muted">
            <span
              class="rounded-full border px-2.5 py-1"
              :class="sale.channel === 'loja_fisica'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-[#E5E7EB] bg-zinc-50 text-bip-muted'"
            >
              {{ getChannelLabel(sale.channel) }}
            </span>
            <span
              v-if="sale.channel === 'loja_fisica' && sale.performed_by_username"
              data-cy="sale-operator-badge"
              class="rounded-full border border-[#E5E7EB] bg-zinc-50 px-2.5 py-1"
            >
              Operador: {{ sale.performed_by_username }}
            </span>
            <span class="rounded-full border border-[#E5E7EB] bg-zinc-50 px-2.5 py-1">
              {{ getDeliveryMethodLabel(sale.delivery_method) }}
            </span>
            <span
              v-if="sale.delivery_region_name"
              class="max-w-full truncate rounded-full border border-[#E5E7EB] bg-zinc-50 px-2.5 py-1"
            >
              {{ sale.delivery_region_name }}
            </span>
          </div>

          <div class="mt-4 rounded-lg border border-[#E5E7EB] bg-zinc-50 p-3">
            <div
              v-if="sale.status === 'cancelled'"
              class="flex items-center gap-2 rounded-lg border border-[#D81B60]/20 bg-[#FCE7F3] px-3 py-2 text-xs font-black uppercase tracking-widest text-[#7A143D]"
            >
              <span class="h-2 w-2 rounded-full bg-[#D81B60]" />
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
                  :class="sale.status === 'sent' || sale.status === step.value ? 'bg-current' : 'bg-zinc-300'"
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
                class="h-9 w-full rounded-lg border border-[#D1D5DB] bg-white px-2 text-xs font-bold text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3] disabled:cursor-not-allowed disabled:opacity-60"
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

    <ConfirmModal
      :show="isCancelConfirmOpen"
      title="Cancelar pedido?"
      :message="cancelConfirmMessage"
      confirm-label="Confirmar cancelamento"
      loading-label="Cancelando..."
      :is-loading="orderPendingCancellation !== null && updatingSaleOrderId === orderPendingCancellation.id"
      @close="closeCancelConfirm"
      @confirm="confirmCancellation"
    />
  </div>
</template>
