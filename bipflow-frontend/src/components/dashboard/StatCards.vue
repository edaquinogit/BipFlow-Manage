<script setup lang="ts">
defineProps<{
  totalRevenue: string;
  productCount: number;
}>();
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
    <div class="bg-zinc-800 p-6 rounded-xl border border-zinc-700">
      <p class="text-zinc-400 text-sm font-medium">Revenue (Filtered)</p>
      <h3 class="text-2xl font-bold text-green-500 mt-1">{{ totalRevenue }}</h3>
    </div>

    <div class="bg-zinc-800 p-6 rounded-xl border border-zinc-700">
      <p class="text-zinc-400 text-sm font-medium">Shown Products</p>
      <h3 class="text-2xl font-bold text-blue-500 mt-1">{{ productCount }}</h3>
    </div>
  </div>
</template>