<script setup lang="ts">
import StatCard from './StatCard.vue';
import StatSkeleton from './StatSkeleton.vue';
import RevenueCard from './RevenueCard.vue';
import { 
  ShoppingBagIcon, 
  ExclamationTriangleIcon 
} from '@heroicons/vue/24/outline';

// Definimos uma interface para os dados (Senior Pattern)
interface InventoryStats {
  totalItems: number;
  lowStockCount: number;
}

defineProps<{
  stats: InventoryStats | null;
  revenue: string;
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
        label="In Stock Units" 
        :value="stats?.totalItems ?? 0" 
        :icon="ShoppingBagIcon"
        color="indigo" 
      />

      <StatCard 
        label="Critical Alerts" 
        :value="stats?.lowStockCount ?? 0" 
        :icon="ExclamationTriangleIcon" 
        color="orange"
      />

      <RevenueCard :value="revenue" />
    </template>
    
  </section>
</template>