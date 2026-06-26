<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { ArrowDownTrayIcon, ExclamationTriangleIcon } from '@heroicons/vue/24/outline';
import { useStockMovements } from '@/composables/useStockMovements';
import { useProducts } from '@/composables/useProducts';
import { useStoreSwitchEffect } from '@/composables/useStoreSwitchEffect';
import { ALL_STOCK_MOVEMENT_REASONS } from '@/types/stockMovement';
import { formatDateTimeBR } from '@/utils/formatters';
import { downloadCsv } from '@/utils/csv';

const {
  movements,
  loading,
  error,
  filters,
  page,
  count,
  totalPages,
  hasNextPage,
  hasPreviousPage,
  fetchMovements,
  updateFilters,
  clearFilters,
  goToNextPage,
  goToPreviousPage,
} = useStockMovements();

const { products, fetchData: fetchProducts } = useProducts();

const reasonOptions = ALL_STOCK_MOVEMENT_REASONS;

const hasActiveFilters = computed(() => Object.keys(filters.value).length > 0);

const movementTypeLabel = (type: string): string => (type === 'entrada' ? 'Entrada' : 'Saída');

const handleExportCsv = (): void => {
  downloadCsv(
    `movimentacoes-estoque-${new Date().toISOString().slice(0, 10)}.csv`,
    ['Data', 'Produto', 'SKU', 'Tipo', 'Quantidade', 'Estoque anterior', 'Novo estoque', 'Motivo', 'Origem', 'Pedido', 'Operador', 'Observacao'],
    movements.value.map((movement) => [
      formatDateTimeBR(movement.created_at),
      movement.product_name ?? '',
      movement.product_sku ?? '',
      movement.movement_type_display,
      movement.quantity,
      movement.previous_stock,
      movement.new_stock,
      movement.reason_display,
      movement.source_display,
      movement.sale_order_reference ?? '',
      movement.performed_by_username ?? '',
      movement.notes,
    ])
  );
};

const refresh = (): void => {
  clearFilters();
  void fetchProducts();
};

onMounted(refresh);
useStoreSwitchEffect(refresh);
</script>

<template>
  <div class="space-y-8">
    <div class="flex flex-col gap-4 border-l-2 border-[#D81B60] pl-6 md:flex-row md:items-end md:justify-between">
      <div>
        <p class="text-[10px] font-black uppercase tracking-[0.4em] text-bip-muted">Inventário</p>
        <h1 class="mt-1 text-3xl font-black italic uppercase tracking-tighter text-[#05050A]">
          Histórico de estoque
        </h1>
        <p class="mt-2 text-[10px] font-bold uppercase tracking-[0.4em] text-bip-muted">
          Toda entrada, saída e venda registrada na loja
        </p>
      </div>

      <button
        type="button"
        data-cy="btn-export-csv"
        :disabled="movements.length === 0"
        class="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-5 text-xs font-black uppercase tracking-widest text-bip-muted transition hover:border-[#D81B60]/40 hover:bg-[#FCE7F3] hover:text-[#D81B60] disabled:cursor-not-allowed disabled:opacity-50"
        @click="handleExportCsv"
      >
        <ArrowDownTrayIcon class="h-4 w-4" />
        Exportar CSV
      </button>
    </div>

    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" data-cy="stock-ledger-filters">
      <label class="block">
        <span class="sr-only">Produto</span>
        <select
          :value="filters.product ?? ''"
          data-cy="filter-product"
          class="h-11 w-full appearance-none rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
          @change="updateFilters({ product: ($event.target as HTMLSelectElement).value ? Number(($event.target as HTMLSelectElement).value) : undefined })"
        >
          <option value="">Todos os produtos</option>
          <option v-for="product in products" :key="product.id" :value="product.id">
            {{ product.name }}
          </option>
        </select>
      </label>

      <label class="block">
        <span class="sr-only">Tipo</span>
        <select
          :value="filters.movement_type ?? ''"
          data-cy="filter-movement-type"
          class="h-11 w-full appearance-none rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
          @change="updateFilters({ movement_type: (($event.target as HTMLSelectElement).value || undefined) as 'entrada' | 'saida' | undefined })"
        >
          <option value="">Todos os tipos</option>
          <option value="entrada">Entrada</option>
          <option value="saida">Saída</option>
        </select>
      </label>

      <label class="block">
        <span class="sr-only">Origem</span>
        <select
          :value="filters.source ?? ''"
          data-cy="filter-source"
          class="h-11 w-full appearance-none rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
          @change="updateFilters({ source: (($event.target as HTMLSelectElement).value || undefined) as 'manual' | 'venda' | undefined })"
        >
          <option value="">Todas as origens</option>
          <option value="manual">Manual</option>
          <option value="venda">Venda</option>
        </select>
      </label>

      <label class="block">
        <span class="sr-only">Motivo</span>
        <select
          :value="filters.reason ?? ''"
          data-cy="filter-reason"
          class="h-11 w-full appearance-none rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
          @change="updateFilters({ reason: ($event.target as HTMLSelectElement).value || undefined })"
        >
          <option value="">Todos os motivos</option>
          <option v-for="option in reasonOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>

      <label class="block">
        <span class="text-[9px] font-black uppercase tracking-widest text-bip-muted">De</span>
        <input
          type="date"
          data-cy="filter-start-date"
          :value="filters.start ?? ''"
          class="mt-1 h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
          @change="updateFilters({ start: ($event.target as HTMLInputElement).value || undefined })"
        />
      </label>

      <label class="block">
        <span class="text-[9px] font-black uppercase tracking-widest text-bip-muted">Até</span>
        <input
          type="date"
          data-cy="filter-end-date"
          :value="filters.end ?? ''"
          class="mt-1 h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
          @change="updateFilters({ end: ($event.target as HTMLInputElement).value || undefined })"
        />
      </label>

      <label class="block sm:col-span-2 lg:col-span-1">
        <span class="sr-only">Buscar produto</span>
        <input
          :value="filters.search ?? ''"
          type="search"
          data-cy="filter-search"
          placeholder="Buscar por produto ou SKU"
          class="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#05050A] outline-none transition placeholder:text-bip-muted/70 focus:border-[#D81B60] focus:ring-2 focus:ring-[#FCE7F3]"
          @change="updateFilters({ search: ($event.target as HTMLInputElement).value || undefined })"
        />
      </label>

      <button
        v-if="hasActiveFilters"
        type="button"
        data-cy="btn-clear-filters"
        class="h-11 rounded-lg border border-[#E5E7EB] px-4 text-[10px] font-black uppercase tracking-widest text-bip-muted transition hover:bg-zinc-50"
        @click="clearFilters"
      >
        Limpar filtros
      </button>
    </div>

    <div v-if="loading" data-cy="loading-skeleton" class="space-y-3">
      <div v-for="i in 5" :key="i" class="h-14 animate-pulse rounded-xl border border-[#E5E7EB] bg-zinc-100"></div>
    </div>

    <div v-else-if="error" data-cy="error-state" class="rounded-2xl border border-[#D81B60]/20 bg-[#FCE7F3] p-10 text-center">
      <ExclamationTriangleIcon class="mx-auto mb-3 h-10 w-10 text-[#D81B60] opacity-70" />
      <p class="text-xs font-black uppercase tracking-widest text-[#7A143D]">{{ error }}</p>
      <button
        type="button"
        data-cy="btn-retry"
        class="mt-4 rounded-full border border-[#E5E7EB] px-8 py-2 text-[10px] font-black uppercase tracking-widest text-[#05050A] transition hover:bg-zinc-50"
        @click="fetchMovements"
      >
        Tentar novamente
      </button>
    </div>

    <div v-else-if="movements.length === 0" data-cy="empty-state" class="rounded-2xl border border-[#E5E7EB] bg-white p-10 text-center">
      <p class="text-sm font-bold text-[#05050A]">Nenhuma movimentação encontrada.</p>
      <p class="mt-1 text-xs text-bip-muted">Ajuste os filtros ou registre uma entrada/saída na página de Produtos.</p>
    </div>

    <div v-else class="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-2xl shadow-black/5">
      <div class="overflow-x-auto">
        <table class="w-full border-collapse text-left" data-cy="stock-ledger-table">
          <thead>
            <tr class="border-b border-[#E5E7EB] bg-zinc-50 text-[10px] font-black uppercase tracking-[0.2em] text-bip-muted">
              <th class="px-6 py-4">Data</th>
              <th class="px-6 py-4">Produto</th>
              <th class="px-6 py-4 text-center">Tipo</th>
              <th class="px-6 py-4 text-center">Quantidade</th>
              <th class="px-6 py-4 text-center">Saldo</th>
              <th class="px-6 py-4">Motivo</th>
              <th class="px-6 py-4">Origem</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-[#E5E7EB]">
            <tr v-for="movement in movements" :key="movement.id" data-cy="stock-ledger-row">
              <td class="px-6 py-4 text-xs font-bold text-bip-muted">{{ formatDateTimeBR(movement.created_at) }}</td>
              <td class="px-6 py-4">
                <span class="text-sm font-bold text-[#05050A]">{{ movement.product_name }}</span>
                <span v-if="movement.product_sku" class="ml-2 text-[9px] font-bold uppercase tracking-widest text-bip-muted">
                  {{ movement.product_sku }}
                </span>
              </td>
              <td class="px-6 py-4 text-center">
                <span
                  class="rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest"
                  :class="movement.movement_type === 'entrada' ? 'bg-emerald-50 text-emerald-700' : 'bg-[#FCE7F3] text-[#D81B60]'"
                >
                  {{ movementTypeLabel(movement.movement_type) }}
                </span>
              </td>
              <td class="px-6 py-4 text-center font-mono text-sm font-black text-[#05050A]">
                {{ movement.movement_type === 'entrada' ? '+' : '-' }}{{ movement.quantity }}
              </td>
              <td class="px-6 py-4 text-center font-mono text-xs text-bip-muted">
                {{ movement.previous_stock }} → {{ movement.new_stock }}
              </td>
              <td class="px-6 py-4 text-sm text-[#05050A]">{{ movement.reason_display }}</td>
              <td class="px-6 py-4 text-xs text-bip-muted">
                {{ movement.source_display }}
                <span v-if="movement.sale_order_reference"> · {{ movement.sale_order_reference }}</span>
                <span v-else-if="movement.performed_by_username"> · {{ movement.performed_by_username }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <footer class="flex items-center justify-between border-t border-[#E5E7EB] bg-zinc-50 px-6 py-3">
        <span class="text-[9px] font-bold uppercase tracking-widest text-bip-muted">
          {{ count }} movimentações · Página {{ page }} de {{ totalPages }}
        </span>
        <div class="flex gap-2">
          <button
            type="button"
            data-cy="btn-prev-page"
            :disabled="!hasPreviousPage"
            class="rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-bip-muted transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
            @click="goToPreviousPage"
          >
            Anterior
          </button>
          <button
            type="button"
            data-cy="btn-next-page"
            :disabled="!hasNextPage"
            class="rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-bip-muted transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
            @click="goToNextPage"
          >
            Próxima
          </button>
        </div>
      </footer>
    </div>
  </div>
</template>
