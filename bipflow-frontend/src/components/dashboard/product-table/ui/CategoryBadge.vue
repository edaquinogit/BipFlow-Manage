<script setup lang="ts">
import type { Category as ProductCategory } from '@/schemas/product.schema';
import type { Category as CategorySchema } from '@/schemas/category.schema';

defineProps<{
  category: CategorySchema | ProductCategory | null;
}>();
</script>

<template>
  <span
    v-if="category"
    class="inline-flex items-center rounded-lg border border-[#E5E7EB] bg-zinc-50 px-3 py-1 text-[9px] font-black uppercase tracking-tighter text-bip-muted"
  >
    <span class="truncate max-w-24">{{ category.name }}</span>
  </span>

  <span
    v-else
    class="inline-flex items-center rounded-lg border border-[#E5E7EB] bg-zinc-50 px-3 py-1 text-[9px] font-black uppercase tracking-tighter text-bip-muted"
  >
    Sem categoria
  </span>
</template>
