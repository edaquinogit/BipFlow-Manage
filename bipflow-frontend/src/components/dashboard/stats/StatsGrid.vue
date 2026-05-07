<script setup lang="ts">
import StatCard from './StatCard.vue';
import StatSkeleton from './StatSkeleton.vue';
import RevenueCard from './RevenueCard.vue';
import { 
  ShoppingBagIcon, 
  ExclamationTriangleIcon 
} from '@heroicons/vue/24/outline';

// Contrato de Interface (BipFlow Standard)
interface InventoryStats {
  totalItems: number;
  lowStockCount: number;
}

defineProps<{
  stats: InventoryStats | null;
  revenue: string | number;
  isLoading: boolean;
}>();
</script>

<template>
  <section class="grid grid-cols-1 md:grid-cols-3 gap-8">
    
    <template v-if="isLoading">
      <StatSkeleton v-for="i in 3" :key="i" />
    </template>
    
    <template v-else>
      <StatCard 
        label="Itens em estoque"
        :value="stats?.totalItems ?? 0" 
        :icon="(ShoppingBagIcon as any)" 
        color="indigo" 
      />

      <StatCard 
        label="Alertas criticos"
        :value="stats?.lowStockCount ?? 0" 
        :icon="(ExclamationTriangleIcon as any)" 
        color="orange"
      />

      <RevenueCard :value="revenue" />
    </template>

  </section>
</template>
