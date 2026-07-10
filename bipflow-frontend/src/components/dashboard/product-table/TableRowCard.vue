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
    class="flex gap-3 p-4"
    :class="isSelected ? 'bg-bip-blush/40' : ''"
    data-cy="product-table-card"
  >
    <button
      v-if="canManageCatalog"
      type="button"
      data-cy="row-checkbox"
      class="flex h-11 w-8 shrink-0 items-center justify-center"
      @click="emit('toggle-selection', product.id!)"
    >
      <span
        class="flex h-5 w-5 items-center justify-center rounded border-2 transition-all duration-200"
        :class="[
          isSelected
            ? 'bg-bip-rose border-bip-rose shadow-lg shadow-bip-rose/25'
            : 'border-[#D1D5DB] bg-white'
        ]"
      >
        <svg
          v-if="isSelected"
          class="w-3 h-3 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
        </svg>
      </span>
      <span class="sr-only">Selecionar produto</span>
    </button>

    <ProductAvatar :image="product.image" :name="product.name" size="md" />

    <div class="min-w-0 flex-1">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <p class="truncate text-sm font-bold uppercase tracking-tight text-bip-black">
            {{ product.name }}
          </p>
          <p class="text-2xs font-mono font-bold uppercase tracking-widest text-bip-muted">
            {{ product.sku || 'Sem SKU' }}
          </p>
        </div>
        <span class="shrink-0 text-sm font-black font-mono text-bip-rose">
          {{ formatBRL(product.price) }}
        </span>
      </div>

      <div class="mt-2 flex flex-wrap items-center gap-2">
        <CategoryBadge :category="resolvedCategory" />
        <span
          class="inline-flex items-center rounded-lg border px-2 text-2xs font-black uppercase tracking-widest"
          :class="isLowStockRow ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-bip-line bg-zinc-50 text-bip-muted'"
        >
          Estoque: {{ product.stock_quantity }}
        </span>
      </div>

      <div v-if="canManageCatalog" class="mt-3 flex items-center gap-2">
        <button
          type="button"
          class="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-bip-line text-2xs font-black uppercase tracking-widest text-bip-muted transition hover:border-bip-rose/40 hover:bg-bip-blush hover:text-bip-rose"
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
    </div>
  </article>
</template>
