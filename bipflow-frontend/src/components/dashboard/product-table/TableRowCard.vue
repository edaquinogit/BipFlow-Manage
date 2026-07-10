<script setup lang="ts">
import { computed } from 'vue';
import { PencilIcon, QrCodeIcon, TrashIcon } from '@heroicons/vue/24/outline';
import type { Product } from '@/schemas/product.schema';
import { formatBRL } from '@/utils/formatters';
import { getLowStockThreshold } from '@/utils/stockAlerts';
import ProductAvatar from './ui/ProductAvatar.vue';
import CategoryBadge from './ui/CategoryBadge.vue';

const props = defineProps<{
  product: Product;
  isSelected?: boolean;
  canManageCatalog?: boolean;
}>();

const emit = defineEmits<{
  (e: 'edit', product: Product): void;
  (e: 'delete', id: number): void;
  (e: 'toggle-selection', productId: number): void;
  (e: 'print-label', product: Product): void;
}>();

const resolvedCategory = computed(() => {
  if (!props.product.category || typeof props.product.category !== 'object') {
    return null;
  }

  return props.product.category;
});

const isLowStockRow = computed(() => props.product.stock_quantity <= getLowStockThreshold(props.product));
</script>

<template>
  <article
    class="rounded-xl border p-3 shadow-sm transition-colors duration-200"
    :class="isSelected ? 'border-bip-rose/40 bg-bip-blush/30' : 'border-bip-line bg-white'"
    data-cy="product-table-card"
  >
    <div class="flex items-start gap-2.5">
      <button
        v-if="canManageCatalog"
        type="button"
        data-cy="row-checkbox"
        class="flex h-9 w-9 shrink-0 items-center justify-center"
        @click="emit('toggle-selection', product.id!)"
      >
        <span
          class="flex h-[18px] w-[18px] items-center justify-center rounded-md border-2 transition-all duration-200"
          :class="[
            isSelected
              ? 'bg-bip-rose border-bip-rose shadow-sm shadow-bip-rose/30'
              : 'border-[#D1D5DB] bg-white'
          ]"
        >
          <svg
            v-if="isSelected"
            class="w-2.5 h-2.5 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
          </svg>
        </span>
        <span class="sr-only">Selecionar produto</span>
      </button>

      <ProductAvatar :image="product.image" :name="product.name" size="sm" />

      <div class="min-w-0 flex-1 self-center">
        <div class="flex items-start justify-between gap-2">
          <p class="truncate text-[13px] font-bold uppercase leading-tight tracking-tight text-bip-black">
            {{ product.name }}
          </p>
          <span class="shrink-0 text-[13px] font-black font-mono text-bip-rose">
            {{ formatBRL(product.price) }}
          </span>
        </div>
        <p class="mt-0.5 truncate text-[10px] font-mono font-bold uppercase tracking-widest text-bip-muted">
          {{ product.sku || 'Sem SKU' }}
        </p>
      </div>
    </div>

    <div class="mt-2 flex flex-wrap items-center gap-1.5">
      <CategoryBadge :category="resolvedCategory" />
      <span
        class="inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wide"
        :class="isLowStockRow ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-bip-line bg-zinc-50 text-bip-muted'"
      >
        Estoque {{ product.stock_quantity }}
      </span>
    </div>

    <div
      v-if="canManageCatalog"
      class="mt-2 flex items-center justify-end gap-1.5 border-t border-zinc-100 pt-2"
    >
      <button
        type="button"
        class="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-bip-line px-3 text-[10px] font-black uppercase tracking-widest text-bip-muted transition hover:border-bip-rose/40 hover:bg-bip-blush hover:text-bip-rose"
        @click="emit('edit', product)"
      >
        <PencilIcon class="h-3.5 w-3.5" />
        Editar
      </button>
      <button
        type="button"
        class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-bip-line text-bip-muted transition hover:border-bip-rose/40 hover:bg-bip-blush hover:text-bip-rose"
        aria-label="Imprimir etiqueta com QR Code"
        @click="emit('print-label', product)"
      >
        <QrCodeIcon class="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-bip-line text-bip-muted transition hover:border-danger/40 hover:bg-danger-soft hover:text-danger"
        aria-label="Remover produto"
        @click="emit('delete', product.id!)"
      >
        <TrashIcon class="h-3.5 w-3.5" />
      </button>
    </div>
  </article>
</template>
