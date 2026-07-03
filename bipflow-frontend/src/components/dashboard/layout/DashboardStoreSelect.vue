<template>
  <label class="relative block min-w-0 sm:w-48">
    <span class="sr-only">Selecionar loja ativa</span>
    <select
      :value="selectedStore?.slug ?? ''"
      @change="handleStoreSelect"
      :disabled="isStoreLoading || stores.length === 0"
      class="h-10 w-full rounded-xl border border-bip-line bg-white px-3 pr-9 text-sm font-semibold text-bip-black outline-none transition hover:border-bip-rose/50 focus:border-bip-rose focus:ring-2 focus:ring-bip-blush disabled:cursor-not-allowed disabled:opacity-60 sm:w-48"
    >
      <option value="" disabled>
        {{ isStoreLoading ? 'Carregando loja...' : 'Selecione a loja' }}
      </option>
      <option
        v-for="store in stores"
        :key="store.id"
        :value="store.slug"
      >
        {{ store.name }}
      </option>
    </select>
    <span class="pointer-events-none absolute inset-y-0 right-3 inline-flex items-center text-bip-muted">
      ▾
    </span>
  </label>
</template>

<script setup lang="ts">
import type { Store } from '@/types/store';

const props = withDefaults(defineProps<{
  stores: Store[];
  selectedStore?: Store | null;
  isStoreLoading: boolean;
}>(), {
  stores: () => [],
  selectedStore: null,
  isStoreLoading: false,
});

const emit = defineEmits<{
  (event: 'select-store', value: string): void;
}>();

function handleStoreSelect(event: Event): void {
  const storeSlug = (event.target as HTMLSelectElement).value;
  emit('select-store', storeSlug);
}
</script>
